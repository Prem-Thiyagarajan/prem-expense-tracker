# File: app/services/subscription_service.py
"""
Recurrence math for subscriptions: computing each cycle's due date from the
`first_due_date` anchor + `interval`, and telling "still upcoming" apart from
"missed" using `last_paid_date` (the due date of the most recently confirmed
cycle) compared against today.
"""
from calendar import monthrange
from datetime import date, timedelta
from typing import Optional, Tuple

INTERVAL_MONTHS = {"monthly": 1, "quarterly": 3, "yearly": 12}
INTERVAL_DAYS = {"weekly": 7, "biweekly": 14}


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, monthrange(year, month)[1])  # clamp e.g. Jan 31 + 1mo -> Feb 28/29
    return date(year, month, day)


def next_occurrence(d: date, interval: str) -> date:
    """The next due date one cycle after `d`."""
    if interval in INTERVAL_MONTHS:
        return _add_months(d, INTERVAL_MONTHS[interval])
    if interval in INTERVAL_DAYS:
        return d + timedelta(days=INTERVAL_DAYS[interval])
    raise ValueError(f"Unknown subscription interval: {interval}")


def previous_occurrence(d: date, interval: str) -> date:
    """The due date one cycle before `d` — the inverse of next_occurrence, used to undo a mistaken "mark as paid"."""
    if interval in INTERVAL_MONTHS:
        return _add_months(d, -INTERVAL_MONTHS[interval])
    if interval in INTERVAL_DAYS:
        return d - timedelta(days=INTERVAL_DAYS[interval])
    raise ValueError(f"Unknown subscription interval: {interval}")


def compute_status(
    first_due_date: date,
    interval: str,
    last_paid_date: Optional[date],
    today: date,
) -> Tuple[date, Optional[date]]:
    """
    Returns (upcoming_due_date, overdue_due_date).

    `overdue_due_date` is the most recent cycle that's already past and was
    never confirmed paid, or None if nothing's overdue. `upcoming_due_date`
    is the next cycle to watch for — the one right after `overdue_due_date`
    when there is one, otherwise the first unconfirmed cycle (which may
    land today or in the future).

    Walks forward one cycle at a time from `last_paid_date` (or
    `first_due_date` if nothing's ever been confirmed). Subscriptions cycle
    at minimum weekly, so even a subscription left unconfirmed for a long
    stretch only walks a bounded number of steps.
    """
    cursor = next_occurrence(last_paid_date, interval) if last_paid_date else first_due_date

    overdue_date = None
    while cursor < today:
        overdue_date = cursor
        cursor = next_occurrence(cursor, interval)

    return cursor, overdue_date
