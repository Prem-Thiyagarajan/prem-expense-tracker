# File: app/services/assistant/tools.py
"""Read-only tools the assistant may call, wired to the existing services.

SECURITY MODEL — the important part of this file:

  * `user_id` is NEVER a tool parameter. It is closed over from the JWT-derived
    `current_user` in the router and passed positionally by `run_tool`. A model
    that hallucinates {"user_id": 7} cannot reach another user's rows, because
    no schema below accepts that key and unknown keys are dropped.
  * Every tool is a read. Nothing here creates, updates or deletes. Writes are
    intentionally absent from v1 — the assistant guides the user to the screen
    that performs the action instead.
  * Results are COMPACTED before being handed back to the model. The raw service
    payloads carry per-day trend arrays and full transaction rows that would
    burn thousands of tokens per turn for data the model does not need to answer
    in two sentences.
"""
import json
import logging
from datetime import date
from typing import Any, Callable, Dict

from sqlalchemy.orm import Session

from app.crud import account_crud, category_crud, tag_crud
from app.services.analytics_service import get_analytics_data
from app.services.budget_plan_service import get_budget_plan
from app.services.dashboard_service import get_dashboard_data
from app.services.transaction_service import get_filtered_transactions

logger = logging.getLogger(__name__)

# Hard cap on rows returned to the model, regardless of what it asks for.
MAX_TXN_ROWS = 25


# ── Tool schemas (OpenAI-compatible function calling) ────────────────────────
# Descriptions are terse on purpose: this block is re-sent on every request and
# every model round-trip, so wording here is a recurring token cost against
# Groq's 8k/minute org-wide cap. Say what the tool returns and when to pick it;
# nothing else.

_MONTH = {"month": {"type": "string", "description": "YYYY-MM"}}


def _fn(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required},
        },
    }


TOOL_SCHEMAS = [
    _fn(
        "get_month_summary",
        "One month's totals: spent, vs last month, daily avg, projected total, top categories.",
        _MONTH,
        ["month"],
    ),
    _fn(
        "get_budget_status",
        "Budget for a month: per-category limit, spent, remaining, % used, days to depletion. "
        "If no plan exists, returns suggested limits.",
        _MONTH,
        ["month"],
    ),
    _fn(
        "get_spending_analytics",
        "Multi-month patterns: category split, monthly totals, repeat habits. For trends, not one month.",
        {"time_period": {"type": "string", "enum": ["3m", "6m", "1y", "all"]}},
        [],
    ),
    _fn(
        "search_transactions",
        "Individual transactions, newest first, max 25. For a merchant, a date, or examples behind a number.",
        {
            "search_term": {"type": "string"},
            "category_id": {"type": "integer"},
            "account_id": {"type": "integer"},
            "start_date": {"type": "string", "description": "YYYY-MM-DD"},
            "end_date": {"type": "string", "description": "YYYY-MM-DD"},
            "type": {"type": "string", "enum": ["debit", "credit"]},
            "limit": {"type": "integer", "description": "1-25"},
        },
        [],
    ),
    _fn("list_categories", "Category names and ids. Call before using category_id.", {}, []),
    _fn("list_accounts", "Account names and ids.", {}, []),
    _fn("list_tags", "Tag names and ids.", {}, []),
]


# ── Implementations ─────────────────────────────────────────────────────────
# Every signature is (db, user_id, **model_args). The first two are supplied by
# the router; only the rest ever come from the model.

def _month_summary(db: Session, user_id: int, month: str | None = None, **_: Any) -> dict:
    data = get_dashboard_data(db, month=month, user_id=user_id)
    if not isinstance(data, dict) or "error" in data:
        return {"error": data.get("error", "Could not load that month.") if isinstance(data, dict) else "Could not load that month."}
    # Drop spendingTrend (one point per day) and recentTransactions — the model
    # is writing two sentences, not drawing a chart.
    return {
        "month": month,
        "total_spent": data.get("totalSpent"),
        "percent_change_vs_last_month": data.get("percentChangeFromLastMonth"),
        "daily_average_spend": data.get("dailyAverageSpend"),
        "projected_month_end_spend": data.get("projectedMonthlySpend"),
        "top_categories": [
            {"category": c.get("category"), "amount": c.get("amount")}
            for c in (data.get("topSpendingCategories") or [])[:6]
        ],
    }


def _budget_status(db: Session, user_id: int, month: str | None = None, **_: Any) -> dict:
    data = get_budget_plan(db, month=month, user_id=user_id) or {}
    plan = data.get("plan")
    if plan:
        return {
            "month": month,
            "has_plan": True,
            "categories": [
                {
                    "category": c.get("categoryName"),
                    "limit": c.get("budget"),
                    "spent": c.get("spent"),
                    "remaining": c.get("remaining"),
                    "percent_used": c.get("progress"),
                    "days_until_depleted": c.get("daysLeft"),
                }
                # budget == 0 means "no limit set", not "limit of zero" — filtering
                # here stops the model reporting phantom 0-rupee budgets.
                for c in plan
                if (c.get("budget") or 0) > 0
            ],
        }

    historical = data.get("historicalData") or {}
    return {
        "month": month,
        "has_plan": False,
        "average_monthly_spend": historical.get("averageTotalSpend"),
        "suggested_limits": [
            {
                "category": s.get("categoryName"),
                "suggested": s.get("suggestedAmount"),
                "current_spend": s.get("currentSpend"),
            }
            for s in (historical.get("suggestedBudgets") or [])[:8]
        ],
    }


def _spending_analytics(db: Session, user_id: int, time_period: str = "6m", **_: Any) -> dict:
    if time_period not in {"3m", "6m", "1y", "all"}:
        time_period = "6m"
    data = get_analytics_data(
        db, time_period=time_period, include_capital_transfers=False, user_id=user_id
    ) or {}
    return {
        "time_period": time_period,
        "category_distribution": (data.get("categoryDistribution") or [])[:10],
        "monthly_breakdown": (data.get("monthlyBreakdown") or [])[-12:],
        "repeat_habits": (data.get("habitIdentifier") or [])[:6],
    }


def _search_transactions(db: Session, user_id: int, **kwargs: Any) -> dict:
    limit = kwargs.get("limit")
    try:
        limit = min(int(limit), MAX_TXN_ROWS) if limit else 10
    except (TypeError, ValueError):
        limit = 10
    limit = max(1, limit)

    filters: Dict[str, Any] = {"page": 1, "limit": limit}
    for key in ("search_term", "category_id", "account_id", "type"):
        if kwargs.get(key) not in (None, ""):
            filters[key] = kwargs[key]
    # Parse dates rather than forwarding raw strings — the service compares them
    # against date columns, and a malformed string would surface as a 500.
    for key in ("start_date", "end_date"):
        raw = kwargs.get(key)
        if raw:
            try:
                filters[key] = date.fromisoformat(str(raw))
            except ValueError:
                pass

    result = get_filtered_transactions(db, filters=filters, user_id=user_id)
    rows = (result or {}).get("transactions", []) if isinstance(result, dict) else getattr(result, "transactions", [])

    def field(row: Any, name: str):
        return row.get(name) if isinstance(row, dict) else getattr(row, name, None)

    out = []
    for row in rows[:limit]:
        txn_date = field(row, "txn_date")
        out.append(
            {
                "date": txn_date.isoformat()[:10] if hasattr(txn_date, "isoformat") else str(txn_date)[:10],
                "description": field(row, "description"),
                "amount": float(field(row, "amount") or 0),
                "type": field(row, "type"),
            }
        )
    total = (result or {}).get("total_count") if isinstance(result, dict) else getattr(result, "total_count", None)
    return {"total_matching": total, "returned": len(out), "transactions": out}


def _list_categories(db: Session, user_id: int, **_: Any) -> dict:
    rows = category_crud.get_all_categories(db, user_id=user_id) or []
    return {
        "categories": [
            {"id": c.id, "name": c.name, "type": getattr(c, "type", None)} for c in rows
        ]
    }


def _list_accounts(db: Session, user_id: int, **_: Any) -> dict:
    rows = account_crud.get_all_accounts(db, user_id=user_id) or []
    return {
        "accounts": [
            {"id": a.id, "name": a.name, "type": getattr(a, "type", None)} for a in rows
        ]
    }


def _list_tags(db: Session, user_id: int, **_: Any) -> dict:
    rows = tag_crud.get_all_tags(db, user_id=user_id) or []
    return {"tags": [{"id": t.id, "name": t.name} for t in rows]}


TOOL_IMPLS: Dict[str, Callable[..., dict]] = {
    "get_month_summary": _month_summary,
    "get_budget_status": _budget_status,
    "get_spending_analytics": _spending_analytics,
    "search_transactions": _search_transactions,
    "list_categories": _list_categories,
    "list_accounts": _list_accounts,
    "list_tags": _list_tags,
}


def run_tool(
    db: Session, user_id: int, name: str, raw_args: str, default_month: str | None
) -> str:
    """Execute one model-requested tool and return a JSON string for the model.

    Never raises: a tool failure becomes an `{"error": ...}` result so the model
    can apologise gracefully instead of the whole SSE stream dying mid-answer.
    """
    impl = TOOL_IMPLS.get(name)
    if impl is None:
        return json.dumps({"error": f"Unknown tool '{name}'."})

    try:
        args = json.loads(raw_args) if raw_args else {}
        if not isinstance(args, dict):
            args = {}
    except json.JSONDecodeError:
        args = {}

    # Defence in depth: even though no schema exposes these, strip anything that
    # could be read as an identity claim before the args reach an impl.
    for forbidden in ("user_id", "user", "db", "self"):
        args.pop(forbidden, None)

    if "month" in impl.__code__.co_varnames and not args.get("month"):
        args["month"] = default_month or date.today().strftime("%Y-%m")

    try:
        result = impl(db, user_id, **args)
    except Exception:
        logger.exception("assistant tool '%s' failed for user %s", name, user_id)
        return json.dumps({"error": f"Could not run {name}."})

    try:
        return json.dumps(result, default=str)
    except (TypeError, ValueError):
        logger.exception("assistant tool '%s' returned unserialisable data", name)
        return json.dumps({"error": f"Could not read the result of {name}."})
