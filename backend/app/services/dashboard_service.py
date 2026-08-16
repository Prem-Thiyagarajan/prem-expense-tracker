# File: app/services/dashboard_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
import calendar
import pandas as pd

from app.models.transaction import Transaction
from app.models.category import Category
from app.crud.tag_crud import get_excluded_transaction_ids

#! CHANGE: Function now requires user_id
def get_dashboard_data(db: Session, month: str, user_id: int):
    try:
        month_start = datetime.strptime(month, "%Y-%m").date()
    except ValueError:
        return {"error": "Invalid month format. Please use YYYY-MM."}

    today = date.today()
    next_month_start = month_start + relativedelta(months=1)

    days_in_month = calendar.monthrange(month_start.year, month_start.month)[1]
    day_number_for_avg = days_in_month if month_start.replace(day=1) != today.replace(day=1) else today.day

    # --- CORE EXCLUSION LOGIC (scoped to user) ---
    # Which transactions to hide is now per-tag configurable (Settings >
    # Tags), not hardcoded to a tag literally named "Exclude from Analytics".
    transactions_to_exclude = get_excluded_transaction_ids(db, user_id, "dashboard")

    # --- BASE QUERY (scoped to user) ---
    base_query_this_month = db.query(Transaction).filter(
        Transaction.user_id == user_id, #! ADDED
        Transaction.type == "debit",
        Transaction.txn_date >= month_start,
        Transaction.txn_date < next_month_start,
        Transaction.id.notin_(transactions_to_exclude)
    )

    # --- CORE METRICS ---
    total_spent = float(base_query_this_month.with_entities(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0)
    
    prev_month_start = month_start - relativedelta(months=1)
    base_query_prev_month = db.query(Transaction).filter(
        Transaction.user_id == user_id, #! ADDED
        Transaction.type == "debit",
        Transaction.txn_date >= prev_month_start,
        Transaction.txn_date < month_start,
        Transaction.id.notin_(transactions_to_exclude)
    )
    prev_total_spent = float(base_query_prev_month.with_entities(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0)

    percent_change = ((total_spent - prev_total_spent) / prev_total_spent) * 100 if prev_total_spent > 0 else (100.0 if total_spent > 0 else 0.0)
    daily_average_spend = total_spent / day_number_for_avg if day_number_for_avg > 0 else 0
    projected_monthly_spend = daily_average_spend * days_in_month

    # --- CHART AND LIST DATA ---
    top_categories_query = base_query_this_month.join(Category).with_entities(
        Category.id, Category.name, func.sum(Transaction.amount).label("total"), Category.icon_name
    ).group_by(Category.id, Category.name, Category.icon_name).order_by(func.sum(Transaction.amount).desc()).limit(5).all()
    
    top_spending_categories = [{"id": cat_id, "category": cat_name, "amount": float(total), "icon_name": icon_name} for cat_id, cat_name, total, icon_name in top_categories_query]
    
    # --- CUMULATIVE SPEND (Raw SQL must also be scoped) ---
    # Range comparison on txn_date, not to_char(txn_date, ...) = :month -- a
    # function wrapped around the column can't use the (user_id, txn_date)
    # index, so it fell back to scanning every one of the user's transactions
    # (the actual cause of the slow month-navigation clicks).
    cumulative_spend_query = text("""
        WITH daily_sums AS (
            SELECT date_trunc('day', txn_date)::date AS day, SUM(amount) AS daily_total
            FROM transactions
            WHERE user_id = :user_id AND type = 'debit'
            AND txn_date >= :month_start AND txn_date < :next_month_start
            AND id NOT IN :excluded_ids
            GROUP BY 1
        )
        SELECT
            d.day,
            SUM(COALESCE(ds.daily_total, 0)) OVER (ORDER BY d.day) as cumulative_total
        FROM generate_series(
            date_trunc('month', CAST(:month_start AS date)),
            LEAST(date_trunc('month', CAST(:month_start AS date)) + interval '1 month - 1 day', CAST(:today AS date)),
            '1 day'::interval
        ) d(day)
        LEFT JOIN daily_sums ds ON d.day = ds.day;
    """)
    
    cumulative_spend_rows = db.execute(
        cumulative_spend_query, 
        {
            "user_id": user_id, #! PASS user_id to query
            "month_start": month_start.strftime("%Y-%m-%d"),
            "next_month_start": next_month_start.strftime("%Y-%m-%d"),
            "today": today.strftime("%Y-%m-%d"),
            "excluded_ids": tuple(transactions_to_exclude) if transactions_to_exclude else (0,)
        }
    ).fetchall()
    
    df = pd.DataFrame(cumulative_spend_rows, columns=['day', 'cumulative_total']).ffill()
    spending_trend_data = [{"day": row.day.day, "cumulative_spend": float(row.cumulative_total)} for index, row in df.iterrows()]

    # --- RECENT TRANSACTIONS (scoped to user) ---
    recent_txns_query = db.query(Transaction).filter(
        Transaction.user_id == user_id, #! ADDED
        Transaction.id.notin_(transactions_to_exclude)
    ).order_by(Transaction.txn_date.desc()).limit(5).all()
    
    recent_transactions = [{"id": txn.id, "description": txn.description, "amount": float(txn.amount), "txn_date": txn.txn_date.isoformat(), "category_id": txn.category_id} for txn in recent_txns_query]

    return {
        "totalSpent": round(total_spent, 2),
        "percentChangeFromLastMonth": round(percent_change, 2),
        "dailyAverageSpend": round(daily_average_spend, 2),
        "projectedMonthlySpend": round(projected_monthly_spend, 2),
        "topSpendingCategories": top_spending_categories,
        "spendingTrend": spending_trend_data,
        "recentTransactions": recent_transactions,
    }