# File: app/api/api_router.py
from fastapi import APIRouter
from . import (
    account_router, alert_router, analytics_router, budget_plan_router,
    category_router, dashboard_router, goal_router, merchant_router,
    tag_router, transaction_router, transaction_tag_router,
    upload_router,
    auth_router,
    users_router
)

# ###########################################################################
# !! THIS IS THE CRITICAL FIX !!
# By adding `redirect_slashes=False`, we tell FastAPI to stop issuing
# 307 redirects, which were causing the browser to lose the auth token.
api_router = APIRouter(redirect_slashes=False)
# ###########################################################################


# --- Include all other routers as before ---

# Authentication and User Routes
api_router.include_router(auth_router.router, prefix="/auth")
api_router.include_router(users_router.router, prefix="/users")

# Application-Specific, Screen-Based Endpoints
api_router.include_router(dashboard_router.router, prefix="/dashboard")
api_router.include_router(budget_plan_router.router, prefix="/budgets")
api_router.include_router(analytics_router.router, prefix="/analytics")
api_router.include_router(upload_router.router, prefix="/settings")

# Core CRUD Endpoints for Individual Resources
api_router.include_router(transaction_router.router, prefix="/transactions")
api_router.include_router(account_router.router, prefix="/accounts")
api_router.include_router(category_router.router, prefix="/categories")
api_router.include_router(merchant_router.router, prefix="/merchants")
api_router.include_router(goal_router.router, prefix="/goals")
api_router.include_router(tag_router.router, prefix="/tags")
api_router.include_router(transaction_tag_router.router, prefix="/transaction-tags")
api_router.include_router(alert_router.router, prefix="/alerts")