# File: app/api/merchant_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.schemas.merchant_schema import (
    MerchantCreate, MerchantOut, MerchantUpdate,
    UnmappedCountOut, MerchantClusterOut, RescanResultOut,
)
from app.crud import merchant_crud
from app.core import deps #! NEW: Import dependencies
from app.models.user import User #! NEW: Import User model for type hint

router = APIRouter()

#! CHANGE: Protect all routes and pass user_id down
@router.post("/", response_model=MerchantOut)
def create_merchant_for_user(
    merchant_in: MerchantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    try:
        return merchant_crud.create_merchant(db, merchant_in=merchant_in, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

@router.get("/", response_model=List[MerchantOut])
def get_all_user_merchants(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return merchant_crud.get_all_merchants(db, user_id=current_user.id, q=q)

# No GET/POST /{merchant_id} route exists in this router (only PUT/DELETE
# do), so these static-path GET/POST routes below can't collide with a
# dynamic one -- if a GET /{merchant_id} is ever added, it MUST be declared
# after these, or it would shadow them (Starlette matches path templates
# before validating the {merchant_id}: int type, so an untyped-at-routing
# "/unmapped-count" would bind to "{merchant_id}" first and 422, never
# falling through to try the next route).
@router.get("/unmapped-count", response_model=UnmappedCountOut)
def get_unmapped_transaction_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Count of transactions with no merchant_id -- backs the notification-bell
    badge and the "N unmapped" indicator on the Merchants page."""
    count = merchant_crud.get_unmapped_count(db, user_id=current_user.id)
    return {"count": count}

@router.get("/clusters", response_model=List[MerchantClusterOut])
def get_unmapped_merchant_clusters(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Groups currently-unmapped transactions by shared UPI handle, for the
    cold-start bulk-naming banner. Distinct from /rescan: this only looks at
    transactions with no merchant at all, never matches against merchants
    that already exist."""
    return merchant_crud.get_unmapped_clusters(db, user_id=current_user.id)

@router.post("/rescan", response_model=RescanResultOut)
def rescan_unmapped_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Sweeps unmapped transactions against the user's existing merchants:
    exact-handle matches auto-apply, fuzzy matches raise a new_merchant
    suggestion alert. Same algorithm upload time uses -- see
    app/services/merchant_matching_service.py."""
    return merchant_crud.rescan_unmapped_transactions(db, user_id=current_user.id)

@router.put("/{merchant_id}", response_model=MerchantOut)
def update_user_merchant(
    merchant_id: int, 
    merchant_in: MerchantUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    try:
        merchant = merchant_crud.update_merchant(db, merchant_id=merchant_id, merchant_in=merchant_in, user_id=current_user.id)
        if not merchant:
            raise HTTPException(status_code=404, detail="Merchant not found or you do not have permission to edit it")
        return merchant
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

@router.delete("/{merchant_id}", response_model=MerchantOut)
def delete_user_merchant(
    merchant_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    merchant = merchant_crud.delete_merchant(db, merchant_id=merchant_id, user_id=current_user.id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found or you do not have permission to delete it")
    return merchant