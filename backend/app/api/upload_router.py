# File: app/api/upload_router.py
import logging
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import upload_service, parsing
from app.models.account import Account
from app.models.user import User
from app.core import deps

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_FILES = 10
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = ('.csv', '.xlsx', '.xls', '.pdf')


@router.post("/upload-statements")
def upload_statements(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    files: List[UploadFile] = File(..., description="Bank statement files (CSV/XLSX/XLS) to upload.")
):
    """Upload statement files for the current user, parse them, and insert new
    non-duplicate transactions. Format detection and parsing live in
    app.services.parsing; this route only validates input and persists results."""
    if not files:
        raise HTTPException(status_code=400, detail="At least one statement file must be uploaded.")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Too many files. Upload at most {MAX_FILES} at a time.")

    user_accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    account_map = {acc.name: acc.id for acc in user_accounts}
    if not account_map:
        raise HTTPException(status_code=400, detail="No accounts configured for your profile. Please add an account in Settings before uploading.")

    all_txns = []
    for file in files:
        filename = file.filename or ""
        if not filename.lower().endswith(ALLOWED_EXTENSIONS):
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {filename}. Allowed: CSV, XLSX, XLS, PDF.")
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"{filename} is too large (max {MAX_FILE_SIZE // (1024 * 1024)} MB).")

        raw = file.file.read()
        if len(raw) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"{filename} is too large (max {MAX_FILE_SIZE // (1024 * 1024)} MB).")

        try:
            all_txns.extend(parsing.parse_statement(filename, raw, account_map))
        except ValueError as e:
            # Safe, caller-facing messages (unsupported type / oversized sheet).
            raise HTTPException(status_code=400, detail=str(e))
        except Exception:
            # Never leak internals; log the real error server-side.
            logger.exception("Failed to parse uploaded file %s for user %s", filename, current_user.id)
            raise HTTPException(status_code=400, detail=f"Could not parse {filename}. Please check that it is a valid statement export.")

    if not all_txns:
        raise HTTPException(status_code=400, detail="The uploaded file(s) did not contain any valid transactions for your configured accounts.")

    inserted_count = upload_service.process_and_insert_transactions(db, all_txns, user_id=current_user.id)
    return {"message": f"Upload successful. Found {len(all_txns)} potential transactions and inserted {inserted_count} new records."}
