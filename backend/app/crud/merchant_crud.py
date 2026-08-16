# File: app/crud/merchant_crud.py
from typing import Optional
from sqlalchemy.orm import Session
from app.models.merchant import Merchant
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.merchant_schema import MerchantCreate, MerchantUpdate
from app.crud import alert_crud
from app.services import merchant_matching_service
from fastapi import HTTPException

#! CHANGE: All functions now require a user_id
def create_merchant(db: Session, merchant_in: MerchantCreate, user_id: int):
    # Check for name uniqueness only within the current user's merchants
    existing = db.query(Merchant).filter(
        Merchant.name == merchant_in.name,
        Merchant.user_id == user_id
    ).first()
    if existing:
        raise ValueError("You already have a merchant with this name.")
    
    # If a category is assigned, ensure it belongs to the current user
    if merchant_in.category_id:
        category = db.query(Category).filter(
            Category.id == merchant_in.category_id,
            Category.user_id == user_id
        ).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found for the current user.")

    # Assign the new merchant to the current user
    merchant = Merchant(**merchant_in.model_dump(), user_id=user_id)
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    return merchant

def get_all_merchants(db: Session, user_id: int, q: Optional[str] = None):
    # Fetch merchants only for the current user, optionally filtered by a
    # case-insensitive name search.
    query = db.query(Merchant).filter(Merchant.user_id == user_id)
    if q:
        query = query.filter(Merchant.name.ilike(f"%{q}%"))
    return query.order_by(Merchant.name).all()


def get_unmapped_count(db: Session, user_id: int) -> int:
    return db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.merchant_id.is_(None),
    ).count()


def get_unmapped_clusters(db: Session, user_id: int) -> list[dict]:
    """Groups of currently-unmapped transactions (no merchant at all yet)
    sharing a UPI handle -- the cold-start bulk-naming banner. Distinct from
    rescan_unmapped_transactions below: this never touches merchants that
    already exist, it's purely about transactions with nothing assigned."""
    rows = db.query(Transaction.id, Transaction.description).filter(
        Transaction.user_id == user_id,
        Transaction.merchant_id.is_(None),
    ).all()
    description_by_id = dict(rows)

    clusters = merchant_matching_service.cluster_unmapped_descriptions(list(rows))
    result = []
    for txn_ids in clusters:
        sample_description = description_by_id[txn_ids[0]]
        result.append({
            "handle": merchant_matching_service.extract_vpa_handle(sample_description),
            "sample_description": sample_description,
            "transaction_ids": txn_ids,
            "count": len(txn_ids),
        })
    return result


def rescan_unmapped_transactions(db: Session, user_id: int) -> dict:
    """Sweeps transactions with no merchant_id against the user's existing
    merchants, using the same tiered algorithm as upload time (see
    merchant_matching_service.py): exact handle -> auto-apply, fuzzy ->
    suggestion alert. Retroactively cleans up the backlog left before a
    merchant existed, or from before this feature shipped."""
    fingerprints = merchant_matching_service.build_fingerprints(db, user_id=user_id)
    if not fingerprints:
        return {"auto_applied": 0, "suggested": 0}

    unmapped = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.merchant_id.is_(None),
    ).all()

    auto_applied = 0
    suggested = 0
    for txn in unmapped:
        match = merchant_matching_service.match_description(txn.description, fingerprints)
        if not match:
            continue
        if match.confidence == merchant_matching_service.HIGH_CONFIDENCE:
            txn.merchant_id = match.merchant_id
            if match.category_id:
                txn.category_id = match.category_id
            auto_applied += 1
        else:
            alert = alert_crud.create_new_merchant_alert(
                db, user_id=user_id, transaction_id=txn.id, description=txn.description,
                suggested_merchant_id=match.merchant_id, suggested_merchant_name=match.merchant_name,
                suggested_category_id=match.category_id, match_reason=match.reason,
                similarity=match.similarity,
            )
            if alert:
                suggested += 1

    if auto_applied or suggested:
        db.commit()

    return {"auto_applied": auto_applied, "suggested": suggested}

def update_merchant(db: Session, merchant_id: int, merchant_in: MerchantUpdate, user_id: int):
    # Ensure the merchant exists and belongs to the current user
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == user_id
    ).first()
    if not merchant:
        return None

    # If the name is being changed, check for uniqueness among the user's other merchants
    if merchant_in.name and merchant_in.name != merchant.name:
        existing = db.query(Merchant).filter(
            Merchant.name == merchant_in.name,
            Merchant.user_id == user_id
        ).first()
        if existing:
            raise ValueError("You already have another merchant with this name.")
            
    # If the category is being changed, ensure it belongs to the user
    if merchant_in.category_id and merchant_in.category_id != merchant.category_id:
        category = db.query(Category).filter(
            Category.id == merchant_in.category_id,
            Category.user_id == user_id
        ).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found for the current user.")

    # Update the merchant data
    merchant.name = merchant_in.name
    merchant.category_id = merchant_in.category_id
    db.commit()
    db.refresh(merchant)
    return merchant

def delete_merchant(db: Session, merchant_id: int, user_id: int):
    # Ensure the merchant exists and belongs to the user before deleting
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == user_id
    ).first()
    if merchant:
        db.delete(merchant)
        db.commit()
    return merchant