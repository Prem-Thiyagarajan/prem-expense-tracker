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
from .parsers import read_frames, parse_generic, parse_paytm, _clean_col, MAX_ROWS_PER_SHEET

logger = logging.getLogger(__name__)

__all__ = ["parse_statement", "BANK_CONFIGS", "ParsedTxn", "BankConfig", "MAX_ROWS_PER_SHEET"]


def _detect(filename: str, columns) -> str | None:
    """Return a BANK_CONFIGS key, the literal 'paytm', or None."""
    name = (filename or "").lower()
    if 'paytm' in name:
        return 'paytm'
    for key in BANK_CONFIGS:
        if key in name:
            return key
    # Header-signature fallback: works even if the file isn't named after the bank.
    cleaned = {_clean_col(str(c)).lower() for c in columns}
    for key, cfg in BANK_CONFIGS.items():
        sig = {_clean_col(c).lower() for c in cfg.signature_columns}
        if sig and sig <= cleaned:
            return key
    return None


def parse_statement(filename: str, raw: bytes, account_map: dict) -> list[ParsedTxn]:
    """Read every sheet, detect its format, and return all parsed transactions.

    Raises ValueError for unsupported file types or oversized sheets.
    """
    frames = read_frames(filename, raw)
    out: list[ParsedTxn] = []
    for df in frames:
        if len(df) > MAX_ROWS_PER_SHEET:
            raise ValueError(f"{filename}: a sheet exceeds the {MAX_ROWS_PER_SHEET}-row limit.")
        fmt = _detect(filename, df.columns)
        if fmt == 'paytm':
            out.extend(parse_paytm(df, account_map))
        elif fmt in BANK_CONFIGS:
            cfg = BANK_CONFIGS[fmt]
            account_id = account_map.get(cfg.account_name)
            if account_id is None:
                logger.info("Skipping %s: account '%s' not configured for this user.", filename, cfg.account_name)
                continue
            out.extend(parse_generic(df, cfg, account_id))
        else:
            logger.info("Skipping %s: unrecognized statement format.", filename)
    return out
