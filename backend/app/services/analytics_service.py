# File: app/services/analytics_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func, text, case, Integer
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
import calendar
import pandas as pd
import math

from app.models.transaction import Transaction
from app.models.category import Category
from app.crud.tag_crud import get_excluded_transaction_ids

def clean_nan_values(data):
    if isinstance(data, dict): return {k: clean_nan_values(v) for k, v in data.items()}
    if isinstance(data, list): return [clean_nan_values(i) for i in data]
    if pd.isna(data) or (isinstance(data, float) and math.isnan(data)): return None
    return data

def get_cumulative_spend_for_period(db: Session, start_date: date, end_date: date, excluded_ids: list, user_id: int) -> pd.DataFrame:
    query_text = """
        WITH daily_totals AS (
            SELECT EXTRACT(DAY FROM txn_date)::integer AS day, SUM(amount) AS total
            FROM transactions 
            WHERE user_id = :user_id AND type = 'debit' AND txn_date >= :start_date AND txn_date < :end_date
            AND id NOT IN :excluded_ids
            GROUP BY 1
        ),
        all_days AS (SELECT generate_series(1, 31) AS day)
        SELECT d.day, COALESCE(SUM(t.total) OVER (ORDER BY d.day), 0) AS cumulative_spend
        FROM all_days d LEFT JOIN daily_totals t ON d.day = t.day
    """
    result = db.execute(text(query_text), {
        "user_id": user_id, "start_date": start_date, "end_date": end_date, 
        "excluded_ids": tuple(excluded_ids) if excluded_ids else (0,)
    }).fetchall()
    df = pd.DataFrame(result, columns=['day', 'cumulative_spend']).ffill()
    return df

def get_analytics_data(db: Session, time_period: str, include_capital_transfers: bool, user_id: int):
    today = date.today()
    is_monthly_view = not (time_period.endswith('m') or time_period.endswith('y') or time_period == "all")

    if is_monthly_view:
        start_date = datetime.strptime(time_period, "%Y-%m").date().replace(day=1)
        end_date = start_date + relativedelta(months=1)
    else: 
        if time_period == "all":
            start_date = date(2000, 1, 1)
        else:
            months_map = {"3m": 3, "6m": 6, "1y": 12}
            num_months = months_map.get(time_period, 6)
            start_date = today.replace(day=1) - relativedelta(months=num_months - 1)
        end_date = today + relativedelta(days=1)

    transactions_to_exclude = []
    if not include_capital_transfers:
        # Which transactions to hide is per-tag configurable (Settings >
        # Tags) now, not hardcoded to a tag literally named "Exclude from
        # Analytics" -- see app/crud/tag_crud.get_excluded_transaction_ids.
        transactions_to_exclude = get_excluded_transaction_ids(db, user_id, "analytics")

    base_query = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.type == 'debit',
        Transaction.txn_date >= start_date,
        Transaction.txn_date < end_date,
        Transaction.id.notin_(transactions_to_exclude)
    )
    
    all_time_query = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.type == 'debit',
        Transaction.id.notin_(transactions_to_exclude)
    )
    monthly_spending_rows = all_time_query.with_entities(
        func.to_char(Transaction.txn_date, 'YYYY-MM').label('month'),
        func.sum(Transaction.amount).label('total')
    ).group_by('month').all()

    highest_spend_month_data = None
    average_spend_per_month = 0
    if monthly_spending_rows:
        df_monthly = pd.DataFrame(monthly_spending_rows, columns=['month', 'total'])
        df_monthly['total'] = pd.to_numeric(df_monthly['total'])
        if not df_monthly.empty:
            highest_month_row = df_monthly.loc[df_monthly['total'].idxmax()]
            highest_spend_month_data = {"month": highest_month_row['month'], "actual": float(highest_month_row['total'])}
            average_spend_per_month = float(df_monthly['total'].mean())

    overview_data = {"highestSpendMonth": highest_spend_month_data, "averageSpendPerMonth": average_spend_per_month}
    
    # //! THIS IS THE FIX: Initialize keys with empty lists
    spending_velocity = []
    spending_composition = []
    monthly_breakdown = []

    if is_monthly_view:
        composition_rows = base_query.with_entities(
            func.extract('day', Transaction.txn_date).cast(Integer).label('day'),
            func.sum(case((Transaction.amount < 1000, Transaction.amount), else_=0)).label('small_total'),
            func.sum(case((Transaction.amount >= 1000, Transaction.amount), else_=0)).label('large_total')
        ).group_by('day').order_by('day').all()
        df_composition = pd.DataFrame(composition_rows, columns=['day', 'small_total', 'large_total'])
        df_all_days = pd.DataFrame({'day': range(1, calendar.monthrange(start_date.year, start_date.month)[1] + 1)})
        df_merged = pd.merge(df_all_days, df_composition, on='day', how='left').fillna(0)
        df_merged['cumulative_small'] = df_merged['small_total'].cumsum()
        df_merged['cumulative_large'] = df_merged['large_total'].cumsum()
        spending_composition = df_merged[['day', 'cumulative_small', 'cumulative_large']].to_dict(orient='records')
    else:
        current_month_start_for_velocity = today.replace(day=1)
        current_month_end_for_velocity = current_month_start_for_velocity + relativedelta(months=1)
        df_current = get_cumulative_spend_for_period(db, current_month_start_for_velocity, current_month_end_for_velocity, transactions_to_exclude, user_id)
        df_current.rename(columns={'cumulative_spend': 'current'}, inplace=True)
        df_current.loc[df_current['day'] > today.day, 'current'] = None
        prev_month_start = current_month_start_for_velocity - relativedelta(months=1)
        df_prev = get_cumulative_spend_for_period(db, prev_month_start, current_month_start_for_velocity, transactions_to_exclude, user_id)
        df_prev.rename(columns={'cumulative_spend': 'previous'}, inplace=True)
        historical_period_start = start_date
        historical_period_end = current_month_start_for_velocity
        all_months_query = db.query(func.extract('day', Transaction.txn_date).cast(Integer).label('day'), func.to_char(Transaction.txn_date, 'YYYY-MM').label('month'), func.sum(Transaction.amount).label('daily_total')).filter(Transaction.user_id == user_id, Transaction.type == 'debit', Transaction.txn_date >= historical_period_start, Transaction.txn_date < historical_period_end, Transaction.id.notin_(transactions_to_exclude)).group_by('day', 'month').all()
        if all_months_query:
            df_pivot = pd.DataFrame(all_months_query, columns=['day', 'month', 'daily_total']).pivot_table(index='day', columns='month', values='daily_total', fill_value=0)
            num_historical_months = len(df_pivot.columns)
            df_avg = pd.DataFrame(df_pivot.cumsum(axis=0).sum(axis=1) / num_historical_months, columns=['average']).reset_index() if num_historical_months > 0 else pd.DataFrame({'day': range(1, 32), 'average': [0]*31})
        else:
            df_avg = pd.DataFrame({'day': range(1, 32), 'average': [0]*31})
        df_merged = pd.merge(pd.DataFrame({'day': range(1, 32)}), df_current, on='day', how='left').merge(df_prev, on='day', how='left').merge(df_avg, on='day', how='left')
        spending_velocity = df_merged.to_dict(orient='records')
        monthly_rows = base_query.with_entities(func.to_char(Transaction.txn_date, 'YYYY-MM').label('month'), func.sum(Transaction.amount).label('total')).group_by('month').order_by('month').all()
        monthly_breakdown = [{"month": row.month, "spend": float(row.total)} for row in monthly_rows]

    habit_identifier_rows = base_query.join(Category).with_entities(Category.name.label("category"), func.count(Transaction.id).label("transaction_count"), func.sum(Transaction.amount).label("total_spend"), func.avg(Transaction.amount).label("average_spend")).group_by(Category.name).having(func.count(Transaction.id) > 0).all()
    habit_identifier_data = [{"category": r.category, "transaction_count": int(r.transaction_count), "total_spend": float(r.total_spend), "average_spend": float(r.average_spend)} for r in habit_identifier_rows]
    
    category_distribution_rows = base_query.join(Category).with_entities(Category.name.label("category"), func.coalesce(func.sum(Transaction.amount), 0).label("total"), Category.icon_name.label("icon_name")).group_by(Category.name, Category.icon_name).all()
    total_overall = sum(float(row.total) for row in category_distribution_rows) or 1
    category_distribution = [{"category": row.category, "total": float(row.total), "percentage": round((float(row.total) / total_overall) * 100, 2), "icon_name": row.icon_name} for row in category_distribution_rows]

    heatmap_query = base_query.with_entities(func.date(Transaction.txn_date).label('date'), func.sum(Transaction.amount).label('spend')).group_by(func.date(Transaction.txn_date)).all()
    transaction_heatmap = [{"date": res.date.isoformat(), "spend": float(res.spend)} for res in heatmap_query]

    final_payload = {
        "overview": overview_data,
        "spendingVelocity": spending_velocity,
        "spendingComposition": spending_composition,
        "habitIdentifier": habit_identifier_data,
        "categoryDistribution": category_distribution,
        "transactionHeatmap": transaction_heatmap,
        "monthlyBreakdown": monthly_breakdown
    }
    return clean_nan_values(final_payload)