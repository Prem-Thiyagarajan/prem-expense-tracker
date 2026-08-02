# File: app/services/parsing/__init__.py
"""Public entry point: turn one uploaded statement file into normalized txns.

    from app.services import parsing
    txns = parsing.parse_statement(filename, raw_bytes, account_map)

Detection order: filename hint (backward compatible) -> header-signature match.
Unknown formats and unconfigured accounts are logged and skipped, not fatal.
"""
import logging

from .base import ParsedTxn, BankConfig
from .configs import BANK_CONFIGS
from .keys import KeyBuilder
from .parsers import (
    read_grids, parse_generic, parse_paytm, find_header_row, promote_header,
    _guess_header_cols, MAX_ROWS_PER_SHEET,
)

logger = logging.getLogger(__name__)

__all__ = ["parse_statement", "BANK_CONFIGS", "ParsedTxn", "BankConfig", "MAX_ROWS_PER_SHEET"]

# Paytm wallet statements: single signed-amount layout, identified by these headers.
PAYTM_SIGNATURE = {"Date", "Amount", "Transaction Details", "Your Account"}


def _detect(filename: str, grid) -> tuple[str, int] | None:
    """Return (fmt, header_row_index) where fmt is a BANK_CONFIGS key or 'paytm'.

    Filename hint wins for backward compatibility (falling back to header row 0 if
    the signature isn't found); otherwise identify the statement by locating a
    known header row anywhere in the first rows. None if nothing matches.
    """
    name = (filename or "").lower()

    if 'paytm' in name:
        idx = find_header_row(grid, PAYTM_SIGNATURE)
        return ('paytm', idx if idx is not None else 0)
    for key, cfg in BANK_CONFIGS.items():
        if key in name:
            idx = find_header_row(grid, set(cfg.signature_columns))
            return (key, idx if idx is not None else 0)

    # Not named after a bank (e.g. ICICI's "OpTransactionHistory..."): identify by header.
    for key, cfg in BANK_CONFIGS.items():
        idx = find_header_row(grid, set(cfg.signature_columns))
        if idx is not None:
            return (key, idx)
    idx = find_header_row(grid, PAYTM_SIGNATURE)
    if idx is not None:
        return ('paytm', idx)
    return None


def _match_account(account_map: dict, target_name: str) -> int | None:
    """The user's account whose name overlaps `target_name`, case-insensitively.

    BankConfig.account_name is a fixed label ("ICICI Bank") but a user's own
    account name is free text ("ICICI", "ICICI Bank", "ICICI Savings"...). An
    exact-match lookup silently drops every transaction for that account the
    moment the names don't match character-for-character -- with no error,
    since an unconfigured account is a deliberate, quiet skip. Substring
    matching in either direction tolerates that without requiring the user to
    name accounts to match internal config strings exactly.
    """
    target = target_name.lower()
    for name, acc_id in account_map.items():
        name_l = name.lower()
        if name_l in target or target in name_l:
            return acc_id
    return None


def parse_statement(filename: str, raw: bytes, account_map: dict) -> list[ParsedTxn]:
    """Read every sheet/table, detect its format, and return all parsed transactions.

    Raises ValueError for unsupported file types or oversized sheets.
    """
    grids = read_grids(filename, raw)
    # Shared across every grid in this file (a PDF yields one grid per page, an
    # Excel workbook one per sheet) so occurrence numbering for repeated
    # no-reference transactions doesn't reset -- and collide -- at each page/sheet
    # boundary. See KeyBuilder's docstring.
    keys = KeyBuilder()
    out: list[ParsedTxn] = []
    # (row_count, columns) per unrecognized grid -- row_count ranks candidates: a real
    # transaction table has dozens of rows, a stray legend/notes block has a handful.
    unrecognized: list[tuple[int, list[str]]] = []
    for grid in grids:
        if len(grid) > MAX_ROWS_PER_SHEET:
            raise ValueError(f"{filename}: a sheet exceeds the {MAX_ROWS_PER_SHEET}-row limit.")
        detected = _detect(filename, grid)
        if detected is None:
            cols = _guess_header_cols(grid)
            unrecognized.append((len(grid), cols))
            logger.info("Skipping %s: unrecognized format (%d rows). Columns found near header: %s",
                        filename, len(grid), cols)
            continue
        fmt, header_idx = detected
        df = promote_header(grid, header_idx)
        if fmt == 'paytm':
            out.extend(parse_paytm(df, account_map, keys))
        else:
            cfg = BANK_CONFIGS[fmt]
            account_id = _match_account(account_map, cfg.account_name)
            if account_id is None:
                logger.info("Skipping %s: account '%s' not configured for this user.", filename, cfg.account_name)
                continue
            out.extend(parse_generic(df, cfg, account_id, keys))

    # Loud, actionable failure: nothing parsed AND at least one sheet was unrecognized.
    # (A recognized-but-unconfigured account is a deliberate skip, not surfaced here.)
    if not out and unrecognized:
        unrecognized.sort(key=lambda u: u[0], reverse=True)
        shapes = [f"{rows} rows x {len(cols)} cols" for rows, cols in unrecognized]
        # Show the top few candidates by row count -- the real transaction table is
        # almost always the one with the most rows, but showing more than one avoids
        # a second round-trip if the row-count heuristic guesses wrong.
        top = [cols for _, cols in unrecognized[:3]]
        expected = {cfg.source: list(cfg.signature_columns) for cfg in BANK_CONFIGS.values()}
        raise ValueError(
            f"Couldn't recognize the layout of {filename}. Found {len(unrecognized)} unmatched "
            f"table(s), shapes: {shapes}. Columns of the largest candidates: {top}. "
            f"Expected signature columns per bank: {expected}. "
            f"If your bank renamed a column, add the new name to that bank's aliases in configs.py."
        )
    return out
