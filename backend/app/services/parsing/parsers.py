# File: app/services/parsing/parsers.py
"""File readers + the per-format parsers. Behavior of parse_generic / parse_paytm
is ported unchanged from the original upload_service; only the plumbing around
them (config-driven, multi-sheet, logged) is new."""
import io
import re
import logging
from datetime import datetime

import pandas as pd

from .base import BankConfig, ParsedTxn

logger = logging.getLogger(__name__)

# ponytail: per-sheet row cap guards the pandas-in-memory path; raise if a real
# statement legitimately exceeds it.
MAX_ROWS_PER_SHEET = 20000


_TOKEN_RE = re.compile(r'[A-Za-z0-9]+')
_CAMEL_RE = re.compile(r'(?<=[a-z])(?=[A-Z])')


def _tokens(s) -> set[str]:
    """Lowercased word-tokens of a header, split on any non-alphanumeric run AND
    at lowercase->uppercase boundaries. So "Amount(INR)" -> {amount, inr} and a
    PDF's glued "WithdrawalAmount" -> {withdrawal, amount}, matching the spaced
    "Withdrawal Amount" form."""
    s = _CAMEL_RE.sub(' ', str(s))
    return {t.lower() for t in _TOKEN_RE.findall(s)}


def _find_col(aliases, columns) -> str | None:
    """First column in `columns` whose tokens are a superset of some alias's
    tokens. Alias "Withdrawal Amount" -> matches "Withdrawal Amount (INR)".
    Aliases are tried in order, so list the most specific one first."""
    col_tokens = [(c, _tokens(c)) for c in columns]
    for alias in aliases:
        at = _tokens(alias)
        if not at:
            continue
        for col, ct in col_tokens:
            if at <= ct:
                return col
    return None


def _to_amount(v) -> float:
    """Parse a statement amount, tolerating thousands commas and blanks.
    Returns NaN for anything non-numeric (callers treat NaN as 'no amount here').
    Always a native Python float -- pandas' numpy.float64 breaks psycopg2's
    parameter binding (it renders as literal "np.float64(...)" in the SQL)."""
    return float(pd.to_numeric(str(v).replace(',', '').strip(), errors='coerce'))


def _guess_header_cols(grid: pd.DataFrame, scan: int = 25) -> list[str]:
    """Best-effort header for diagnostics: the non-empty cells of the row with the
    most populated cells (the real header, whatever preamble sits above it)."""
    best_i, best_n = 0, -1
    for i in range(min(len(grid), scan)):
        n = int(grid.iloc[i].notna().sum())
        if n > best_n:
            best_i, best_n = i, n
    return [str(v) for v in grid.iloc[best_i] if pd.notna(v)]


def read_grids(filename: str, raw: bytes) -> list[pd.DataFrame]:
    """File -> raw grids with NO header assumed (columns are 0..N).

    CSV/PDF -> one grid; Excel -> one grid per sheet. The header row is located
    later (see find_header_row), so statements with a metadata preamble above the
    real column headers parse correctly instead of silently yielding nothing.

    Raises ValueError for an unsupported extension or an unreadable PDF (caller -> 400).
    """
    name = filename.lower()
    if name.endswith('.csv'):
        return [pd.read_csv(io.BytesIO(raw), header=None)]
    if name.endswith(('.xlsx', '.xls')):
        sheets = pd.read_excel(io.BytesIO(raw), sheet_name=None, header=None)  # dict{name: df}
        return list(sheets.values())
    if name.endswith('.pdf'):
        return _read_pdf_grids(raw)
    raise ValueError(f"Unsupported file type: {filename}")


def _read_pdf_grids(raw: bytes) -> list[pd.DataFrame]:
    """Turn every page into candidate grids, two ways:

    1. pdfplumber.extract_tables() (default, line-based) -- works when the table
       has real ruled cell borders.
    2. Word-position reconstruction (_reconstruct_pdf_grid) -- for borderless
       tables (shaded header + horizontal rules only, no vertical column lines),
       which is the common bank e-statement layout and what line detection misses.

    Every candidate is returned; detection (in __init__.py) keeps whichever matches
    a bank's signature columns and skips the rest (legends, notes, stray boxes).

    ponytail: pdfplumber only. Scanned/image PDFs (need OCR) and password-protected
    PDFs still fail with a clean ValueError. Add camelot/tabula only if a real bank
    PDF defeats both paths here.
    """
    try:
        import pdfplumber
    except ImportError:
        raise ValueError("PDF upload needs the 'pdfplumber' package installed on the server.")
    grids: list[pd.DataFrame] = []
    try:
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            for page in pdf.pages:
                for table in page.extract_tables():
                    if table and len(table) > 1:
                        grids.append(pd.DataFrame(table))
                words = page.extract_words()
                reconstructed = _reconstruct_pdf_grid(words)
                if reconstructed is not None and len(reconstructed) > 1:
                    grids.append(pd.DataFrame(reconstructed))
    except Exception as e:
        raise ValueError(f"Could not read PDF tables (password-protected or scanned?): {e}")
    if not grids:
        raise ValueError("No transaction tables found in the PDF.")
    return grids


# Keywords that anchor a column's x-position when reconstructing a borderless PDF
# table. Matched as substrings so a glued header word ("WithdrawalAmount") still
# anchors. "amount" is intentionally NOT here -- it's shared by withdrawal & deposit.
_PDF_ANCHOR_KEYWORDS = (
    "withdrawal", "deposit", "balance", "remarks", "narration", "description",
    "particulars", "cheque", "date", "debit", "credit",
)
# One transaction begins on a line that starts with a serial number and a date;
# its remarks/amount lines follow until the next such line or a boundary.
_DATE_RE = re.compile(r'^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$')
# Lines that are page furniture, not transaction data -- they end a transaction block.
_PDF_NOISE_RE = re.compile(
    r'never share|www\.|dial your bank|please call|base branch|account no|'
    r'statement of transactions|legends for transactions|sincerely|team icici|'
    r'system generated|^\s*s\s*no\b',
    re.I,
)


def _word_center(w) -> float:
    return (w["x0"] + w["x1"]) / 2


def _is_anchor(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in _PDF_ANCHOR_KEYWORDS)


def _cluster_lines(words, y_tol: float = 3.0) -> list[dict]:
    """Group positioned words into visual rows by their 'top' (y) coordinate."""
    lines: list[dict] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and abs(w["top"] - lines[-1]["top"]) <= y_tol:
            lines[-1]["words"].append(w)
        else:
            lines.append({"top": w["top"], "words": [w]})
    for ln in lines:
        ln["words"].sort(key=lambda w: w["x0"])
    return lines


def _line_text(line) -> str:
    return " ".join(w["text"] for w in line["words"])


def _is_row_start(line) -> bool:
    """A transaction's first line: a serial number followed by a date."""
    ws = line["words"]
    return (len(ws) >= 2 and ws[0]["text"].strip('.').isdigit()
            and bool(_DATE_RE.match(ws[1]["text"])))


def _is_boundary(line) -> bool:
    """Page header/footer/legend line -- stops a transaction block."""
    text = _line_text(line).strip()
    if _PDF_NOISE_RE.search(text):
        return True
    return text.isdigit() and len(text) <= 3  # a bare page number


def _column_centers(header_words) -> list[float]:
    """Column center x-positions from the header labels. Anchor keywords give the
    reliable centers; adjacent header words that stack at the same x (labels wrapped
    across lines, e.g. "Withdrawal" over "Amount (INR)") are merged into one."""
    anchors = sorted(_word_center(w) for w in header_words if _is_anchor(w["text"]))
    if not anchors:
        return []
    span = (anchors[-1] - anchors[0]) or 1.0
    gap = span / len(anchors) * 0.5  # min separation between distinct columns
    merged = [anchors[0]]
    for c in anchors[1:]:
        if c - merged[-1] <= gap:
            merged[-1] = (merged[-1] + c) / 2
        else:
            merged.append(c)
    return merged


def _column_bounds(header_words, centers) -> list[float]:
    """Left edge (x) of each column: the min x0 of the header words nearest that
    column's center. Bucketing by left edge (not nearest center) keeps a wide
    free-text column -- whose words can reach far right -- out of the next column,
    while right-aligned amounts still land correctly because each sits past its
    own column's left edge and before the next one's."""
    lefts = [float('inf')] * len(centers)
    for w in header_words:
        c = _word_center(w)
        i = min(range(len(centers)), key=lambda k: abs(c - centers[k]))
        lefts[i] = min(lefts[i], w["x0"])
    return [centers[i] if lefts[i] == float('inf') else lefts[i] for i in range(len(centers))]


def _bucket_row(words, bounds) -> list[str]:
    """Assign each word to the column whose left edge is the greatest one not past
    the word's center; join per-column text in reading order (top, then left)."""
    cells: list[list[tuple]] = [[] for _ in bounds]
    for w in words:
        c = _word_center(w)
        i = 0
        for k in range(len(bounds)):
            if c >= bounds[k]:
                i = k
            else:
                break
        cells[i].append((w["top"], w["x0"], w["text"]))
    out = []
    for cell in cells:
        cell.sort()
        out.append(" ".join(t for _, _, t in cell).strip())
    return out


def _reconstruct_pdf_grid(words) -> list[list[str]] | None:
    """Rebuild a borderless statement table from positioned words.

    Each transaction spans several physical lines (payee, wrapped remarks, then a
    line carrying the amount + balance). We group every line from a row-start
    (serial + date) up to the next row-start/boundary into ONE logical row, then
    bucket all its words by column left-edge -- so a wrapped remark, a ref number
    inside the remark, and the real amounts each land in the right column by
    x-position. Returns a header-first grid, or None if the page has no such table.
    """
    lines = _cluster_lines(words)
    starts = [i for i, ln in enumerate(lines) if _is_row_start(ln)]
    if not starts:
        return None  # no transactions on this page (e.g. the legend page)

    first = starts[0]
    # Header band = the label lines just above the first transaction. Start at the
    # top-most line carrying an anchor keyword, then extend up over tightly-stacked
    # wrapped lines (e.g. "S No. Transaction" above "Date ... Remarks"). This skips
    # the address/statement preamble, which has no anchors and sits further up.
    anchor_idxs = [k for k in range(first)
                   if any(_is_anchor(w["text"]) for w in lines[k]["words"])]
    if not anchor_idxs:
        return None
    top = anchor_idxs[0]
    while (top - 1 >= 0
           and not _PDF_NOISE_RE.search(_line_text(lines[top - 1]))
           and lines[top]["top"] - lines[top - 1]["top"] < 25):
        top -= 1
    header_words = [w for ln in lines[top:first] for w in ln["words"]]
    centers = _column_centers(header_words)
    if len(centers) < 4:
        return None

    # The serial-number column has no anchor keyword; seed it from the row-start
    # serial words themselves (always the left-most column).
    serials = [_word_center(lines[i]["words"][0]) for i in starts]
    sno = sorted(serials)[len(serials) // 2]
    if sno < centers[0] - 1:
        centers = [sno] + centers

    bounds = _column_bounds(header_words, centers)
    grid = [_bucket_row(header_words, bounds)]
    i = first
    while i < len(lines):
        if _is_row_start(lines[i]):
            block = list(lines[i]["words"])
            j = i + 1
            while j < len(lines) and not _is_row_start(lines[j]) and not _is_boundary(lines[j]):
                block.extend(lines[j]["words"])
                j += 1
            grid.append(_bucket_row(block, bounds))
            i = j
        else:
            i += 1
    return grid if len(grid) > 1 else None


def find_header_row(grid: pd.DataFrame, signature, scan: int = 25) -> int | None:
    """Index of the first row in which every name in `signature` resolves to a
    cell (token-subset match). None if not found in the first `scan` rows.
    Returns 0 for a clean export; a few rows down for a preamble statement.
    """
    if not signature:
        return None
    for i in range(min(len(grid), scan)):
        cells = [str(v) for v in grid.iloc[i] if pd.notna(v)]
        if all(_find_col((sig,), cells) is not None for sig in signature):
            return i
    return None


def promote_header(grid: pd.DataFrame, header_idx: int) -> pd.DataFrame:
    """Use row `header_idx` as column names and return the rows below it."""
    df = grid.iloc[header_idx + 1:].copy()
    df.columns = [str(v) for v in grid.iloc[header_idx]]
    return df


def parse_generic(df: pd.DataFrame, config: BankConfig, account_id: int) -> list[ParsedTxn]:
    """Parse a separate-debit/credit-column statement per a BankConfig.

    Resolves each field to a real column via its aliases. If a required column
    can't be found, raises ValueError naming the field and the columns present --
    a loud, actionable failure instead of silently returning zero transactions.
    """
    df = df.copy()
    cols = list(df.columns)
    date_col = _find_col(config.date_col, cols)
    desc_col = _find_col(config.desc_col, cols)
    debit_col = _find_col(config.debit_col, cols)
    credit_col = _find_col(config.credit_col, cols)
    ref_col = _find_col(config.ref_col, cols) if config.ref_col else None
    uid_col = _find_col(config.unique_id_col, cols) if config.unique_id_col else None

    missing = [name for name, col in (("date", date_col), ("description", desc_col),
                                      ("debit", debit_col), ("credit", credit_col)) if col is None]
    if missing:
        raise ValueError(
            f"{config.source} statement is missing required column(s) {missing}. "
            f"Columns found: {cols}. Add the actual name(s) to this bank's aliases in configs.py."
        )

    transactions: list[ParsedTxn] = []
    for index, row in df.iterrows():
        if pd.isna(row.get(date_col)):
            continue
        try:
            withdrawal = _to_amount(row.get(debit_col))
            deposit = _to_amount(row.get(credit_col))
            withdrawal = withdrawal if pd.notna(withdrawal) else 0.0
            deposit = deposit if pd.notna(deposit) else 0.0
            if withdrawal > 0:
                amount, txn_type = withdrawal, 'debit'
            elif deposit > 0:
                amount, txn_type = deposit, 'credit'
            else:
                continue

            txn_date = pd.to_datetime(row[date_col], dayfirst=True)
            description = str(row[desc_col])
            upi_match = re.search(r'(\d{12})', description)
            upi_ref = upi_match.group(1) if ('UPI' in description and upi_match) else None
            uid_part = (
                str(row[uid_col]) if uid_col and pd.notna(row.get(uid_col))
                else (str(row.get(ref_col, '')) if ref_col else f"{description[:10]}-{index}")
            )
            unique_key = f"{config.source}-{uid_part}-{txn_date.strftime('%Y%m%d')}-{amount:.2f}"

            transactions.append(ParsedTxn(
                txn_date=txn_date, description=description, amount=amount, type=txn_type,
                account_id=account_id, source=config.source, upi_ref=upi_ref,
                unique_key=unique_key, raw_data=row.to_json(date_format='iso'),
            ))
        except Exception:
            logger.warning("Skipping unparseable row in %s statement", config.source, exc_info=True)
    return transactions


def parse_paytm(df: pd.DataFrame, account_map: dict) -> list[ParsedTxn]:
    """Parse a Paytm wallet statement (single signed Amount column, per-row account)."""
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]

    transactions: list[ParsedTxn] = []
    for _, row in df.iterrows():
        if pd.isna(row.get('Date')) or "This is not included" in str(row.get('Remarks', '')):
            continue
        try:
            account_str = str(row['Your Account'])
            matched_account = next((acc_id for name, acc_id in account_map.items() if name in account_str), None)
            if not matched_account:
                continue

            source_provider = next((name for name, acc_id in account_map.items() if acc_id == matched_account), "Unknown")
            amount_val = pd.to_numeric(row.get('Amount'), errors='coerce')
            if pd.isna(amount_val) or amount_val == 0:
                continue
            amount, txn_type = float(abs(amount_val)), ('credit' if amount_val > 0 else 'debit')
            txn_date = datetime.strptime(f"{row['Date']} {row['Time']}", '%d/%m/%Y %H:%M:%S')
            description = str(row['Transaction Details'])
            upi_ref = str(int(row['UPI Ref No.'])) if pd.notna(row['UPI Ref No.']) else None

            transactions.append(ParsedTxn(
                txn_date=txn_date, description=description, amount=amount, type=txn_type,
                account_id=matched_account, source=source_provider, upi_ref=upi_ref,
                unique_key=None, raw_data=row.to_json(date_format='iso'),
            ))
        except Exception:
            logger.warning("Skipping unparseable Paytm row", exc_info=True)
    return transactions
