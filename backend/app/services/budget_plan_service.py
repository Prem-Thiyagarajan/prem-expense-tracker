# File: app/services/budget_plan_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.models.transaction import Transaction
from app.models.goal import Goal
from app.models.category import Category
from app.models.alert import Alert
from app.crud import goal_crud, alert_crud
from app.schemas.budget_plan_schema import BudgetPlanUpdate
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
import pandas as pd
import math
from decimal import Decimal

BUDGET_THRESHOLDS = [Decimal("100.0"), Decimal("90.0"), Decimal("75.0")]

def clean_nan_values(data):
    if isinstance(data, dict): return {k: clean_nan_values(v) for k, v in data.items()}
    if isinstance(data, list): return [clean_nan_values(i) for i in data]
    if pd.isna(data) or (isinstance(data, float) and math.isnan(data)): return None
    return data

def update_budget_plan(db: Session, plan_data: BudgetPlanUpdate, user_id: int):
    for item in plan_data.budgets:
        goal_crud.upsert_budget_for_category(db, item.category_id, plan_data.month, item.limit_amount, user_id)
    db.commit()
    return {"message": "Budgets saved successfully"}

def delete_budget_plan(db: Session, month: str, user_id: int):
    return goal_crud.delete_goals_by_month(db, month, user_id)

def get_budget_plan(db: Session, month: str, user_id: int):
    month_start = datetime.strptime(month, "%Y-%m").date()
    next_month_start = month_start + relativedelta(months=1)
    today = date.today()

    # NOTE: the "Exclude from Analytics" tag is deliberately NOT applied here.
    # It suppresses transactions from reporting surfaces (dashboard, analytics),
    # but budgeting is about money actually leaving the account: a spend you hid
    # from your charts still consumed the category's limit. Every other service
    # that reads this tag excludes; budget features are the single exception.
    # alert_service.get_total_spend_for_category_in_month does the same, so
    # budget progress and budget alerts always agree on one number.

    existing_goals = db.query(Goal).filter(Goal.month == month, Goal.user_id == user_id).all()

    if existing_goals:
        # Range comparison on txn_date, not to_char(txn_date, ...) = :month --
        # a function wrapped around the column can't use the (user_id,
        # txn_date) index (same fix already applied in dashboard_service.py).
        spent_by_category = dict(db.query(
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), 0)
        ).filter(
            Transaction.user_id == user_id,
            Transaction.type == "debit",
            Transaction.txn_date >= month_start,
            Transaction.txn_date < next_month_start
        ).group_by(Transaction.category_id).all())

        goal_map = {goal.category_id: goal for goal in existing_goals}
        all_categories = db.query(Category).filter(Category.is_income == False, Category.user_id == user_id).all()
        response_plan = []
        day_of_month = today.day if month_start.strftime("%Y-%m") == today.strftime("%Y-%m") else 31

        # Alerts already raised for this month's goals, fetched once rather
        # than with a query per category inside the loop below.
        existing_alert_keys = {
            (goal_id, threshold) for goal_id, threshold in db.query(
                Alert.goal_id, Alert.threshold_percentage
            ).filter(
                Alert.user_id == user_id,
                Alert.goal_id.in_([g.id for g in existing_goals]),
            ).all()
        }

        # ✅ --- THIS IS THE FIX ---
        # The loop will now process every available category, not just those with a budget.
        for cat in all_categories:
            goal = goal_map.get(cat.id)
            # If a goal exists, use its budget. Otherwise, the budget is 0.
            budget = Decimal(goal.limit_amount) if goal else Decimal(0)

            spent = Decimal(spent_by_category.get(cat.id, 0))
            remaining = budget - spent
            
            # Perform calculations, which will work correctly even if the budget is 0.
            daily_burn_rate = (spent / Decimal(day_of_month)) if day_of_month > 0 else Decimal(0)
            days_left = (remaining / daily_burn_rate) if daily_burn_rate > 0 and remaining > 0 else Decimal(0)
            if daily_burn_rate == 0 and remaining > 0: days_left = Decimal(999)
            
            # Append EVERY category to the response plan.
            response_plan.append({
                "categoryId": cat.id, "categoryName": cat.name, "icon_name": cat.icon_name,
                "budget": float(budget), "spent": float(spent), "remaining": float(remaining), 
                "progress": float((spent / budget) * 100) if budget > 0 else 0.0,
                "daysLeft": round(float(days_left))
            })
            
            # The retroactive alert checking logic remains, but only runs if a budget is set.
            if goal and budget > 0:
                spent_percentage = (spent / budget) * 100
                for threshold in BUDGET_THRESHOLDS:
                    if spent_percentage >= threshold:
                        if (goal.id, threshold) not in existing_alert_keys:
                            alert_crud.create_alert(db, user_id=user_id, alert_in={
                                "goal_id": goal.id,
                                "threshold_percentage": threshold
                            })
                            existing_alert_keys.add((goal.id, threshold))
                        break
        
        db.commit()

        # Range comparison on txn_date, not to_char(txn_date, ...) = :month --
        # same index-defeating issue as the ORM query above.
        pacing_query = text("""
            WITH daily_sums AS (
                SELECT date(txn_date) as day, SUM(amount) as daily_total FROM transactions
                WHERE user_id = :user_id AND type = 'debit' AND txn_date >= :month_start AND txn_date < :next_month_start GROUP BY 1
            ), all_days AS (
                SELECT generate_series(date_trunc('month', CAST(:month_start AS date)),
                date_trunc('month', CAST(:month_start AS date)) + interval '1 month - 1 day', '1 day'::interval)::date AS day
            )
            SELECT d.day, COALESCE(SUM(ds.daily_total) OVER (ORDER BY d.day), 0) as cumulative_spend
            FROM all_days d LEFT JOIN daily_sums ds ON d.day = ds.day
        """)
        pacing_result = db.execute(pacing_query, {
            "user_id": user_id, "month_start": month_start, "next_month_start": next_month_start
        }).fetchall()
        df = pd.DataFrame(pacing_result, columns=['day', 'cumulative_spend']).ffill()
        pacing_data = [{"day": row.day.day, "actualSpend": float(row.cumulative_spend)} for index, row in df.iterrows()]
        
        # Sort the final list by the amount spent
        final_payload = {"plan": sorted(response_plan, key=lambda x: x['spent'], reverse=True), "historicalData": None, "pacingData": pacing_data}
        return clean_nan_values(final_payload)
    else:
        # --- SMART EMPTY STATE LOGIC (No changes below this line) ---
        avg_period_end = month_start
        avg_period_start = avg_period_end - relativedelta(months=3)
        
        historical_base_query = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.type == "debit",
            Transaction.txn_date >= avg_period_start,
            Transaction.txn_date < avg_period_end
        )

        historical_spend_rows = historical_base_query.with_entities(func.to_char(Transaction.txn_date, "YYYY-MM").label("month"), func.sum(Transaction.amount).label("total_spend")).group_by("month").order_by("month").all()
        historical_spend = [{"month": row.month, "totalSpend": float(row.total_spend)} for row in historical_spend_rows]
        average_total_spend = sum(h['totalSpend'] for h in historical_spend) / 3 if historical_spend else 0
        
        avg_spend_rows = historical_base_query.with_entities(Transaction.category_id, (func.sum(Transaction.amount) / 3).label("average_spend")).group_by(Transaction.category_id).all()
        suggested_budgets_map = {row[0]: float(row[1]) for row in avg_spend_rows}
        
        current_month_spend_rows = db.query(Transaction.category_id, func.sum(Transaction.amount).label("current_spend")).filter(
            Transaction.user_id == user_id,
            Transaction.type == "debit",
            Transaction.txn_date >= month_start,
            Transaction.txn_date < next_month_start
        ).group_by(Transaction.category_id).all()
        current_spend_map = {row[0]: float(row[1]) for row in current_month_spend_rows}
        
        all_categories = db.query(Category).filter(Category.is_income == False, Category.user_id == user_id).all()
        suggested_budgets = []
        for cat in all_categories:
            suggested_budgets.append({
                "categoryId": cat.id, "categoryName": cat.name, "icon_name": cat.icon_name,
                "suggestedAmount": round(suggested_budgets_map.get(cat.id, 0)),
                "currentSpend": round(current_spend_map.get(cat.id, 0))
            })
            
        historical_data = {
            "historicalSpend": historical_spend,
            "averageTotalSpend": round(average_total_spend),
            "suggestedBudgets": sorted(suggested_budgets, key=lambda x: (x['currentSpend'], x['suggestedAmount']), reverse=True)
        }
        final_payload = {"plan": None, "historicalData": historical_data}
        return clean_nan_values(final_payload)