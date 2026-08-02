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
from .keys import KeyBuilder, extract_upi_ref, normalize_ref

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
    if name.endswith(('.xlsx', '.xls', '.xlsm')):
        # .xlsm (macro-enabled) is the same underlying zip+XML format as .xlsx --
        # pandas auto-detects the right engine (openpyxl) from the file's magic
        # bytes, not the extension, so nothing else changes.
        sheets = pd.read_excel(io.BytesIO(raw), sheet_name=None, header=None)  # dict{name: df}
        return list(sheets.values())
    if name.endswith('.xlsb'):
        # Binary workbook format -- pandas can't auto-detect this from a byte
        # buffer the way it does .xlsx/.xls, so the engine must be explicit.
        sheets = pd.read_excel(io.BytesIO(raw), sheet_name=None, header=None, engine='pyxlsb')
        return list(sheets.values())
    if name.endswith('.pdf'):
        return _read_pdf_grids(raw)
    raise ValueError(f"Unsupported file type: {filename}")


def _read_pdf_grids(raw: bytes) -> list[pd.DataFrame]:
    """Turn every page into candidate grids, three ways:

    1. pdfplumber.extract_tables() (default, line-based) -- works when the table
       has real ruled cell borders.
    2. Word-position reconstruction (_reconstruct_pdf_grid) -- for borderless
       BANK e-statement tables (shaded header + horizontal rules only, no
       vertical column lines).
    3. Paytm-shaped reconstruction (_reconstruct_paytm_pdf_grid) -- Paytm's PDF
       isn't a ruled table at all (one card per transaction, wrapped across
       several lines), so neither of the above recognizes it; this bucket-by-
       fixed-column-position pass is Paytm-specific.

    Every candidate is returned; detection (in __init__.py) keeps whichever matches
    a bank's or Paytm's signature columns and skips the rest (legends, notes,
    stray boxes).

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
            # The passbook never repeats the year per row ("31 Jul", no "2026")
            # -- only the title banner on page 1 has it ("1 MAR'26 - 31 JUL'26").
            year_info = _paytm_statement_year_range(pdf.pages[0].extract_text() or "") if pdf.pages else None
            for page in pdf.pages:
                for table in page.extract_tables():
                    if table and len(table) > 1:
                        grids.append(pd.DataFrame(table))
                words = page.extract_words()
                reconstructed = _reconstruct_pdf_grid(words)
                if reconstructed is not None and len(reconstructed) > 1:
                    grids.append(pd.DataFrame(reconstructed))
                paytm_grid = _reconstruct_paytm_pdf_grid(words, year_info)
                if paytm_grid is not None and len(paytm_grid) > 1:
                    grids.append(pd.DataFrame(paytm_grid))
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


# Paytm's PDF isn't a ruled bank-statement table -- it's one card per
# transaction, several lines each, at FIXED x-positions (verified against a
# real export; stable across pages/transactions). Column left-edges:
#   Date & Time < 85  |  Transaction Details 85-285  |  Notes & Tags 285-390
#   |  Your Account 390-478  |  Amount >= 478
_PAYTM_PDF_COLUMN_BOUNDS = {"datetime": 0, "desc": 85, "tags": 285, "account": 390, "amount": 478}
_MONTH_ABBR = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
_PAYTM_HEADER_WORDS = {"transaction", "your", "account", "amount"}
_PAYTM_TIME_RE = re.compile(r'(\d{1,2}):(\d{2})\s*([AP]M)', re.I)
_PAYTM_YEAR_RANGE_RE = re.compile(
    r"(\d{1,2})\s([A-Za-z]{3})'(\d{2})\s*-\s*(\d{1,2})\s([A-Za-z]{3})'(\d{2})")


def _is_paytm_pdf_row_start(line) -> bool:
    """A transaction card's first line: a bare day-of-month then a 3-letter
    month ("31 Jul") -- Paytm's passbook has no serial number to anchor on."""
    ws = line["words"]
    if len(ws) < 2:
        return False
    day, mon = ws[0]["text"].rstrip('.'), ws[1]["text"].rstrip('.').lower()
    return day.isdigit() and 1 <= int(day) <= 31 and mon in _MONTH_ABBR


def _paytm_statement_year_range(first_page_text: str) -> tuple[int, int, int, int] | None:
    """(start_month, start_year, end_month, end_year) from the title banner
    ("1 MAR'26 - 31 JUL'26") -- individual rows only ever show "DD Mon", never
    a year, so this is the sole source of truth for which year each row is in.
    """
    m = _PAYTM_YEAR_RANGE_RE.search(first_page_text or "")
    if not m:
        return None
    _, mon1, y1, _, mon2, y2 = m.groups()
    mon1_n, mon2_n = _MONTH_ABBR.get(mon1.lower()), _MONTH_ABBR.get(mon2.lower())
    if not mon1_n or not mon2_n:
        return None
    return mon1_n, 2000 + int(y1), mon2_n, 2000 + int(y2)


def _paytm_pdf_amount_to_signed_str(text: str) -> str:
    """"Rs.36,201" -> "36201" (no sign shown = money IN, Paytm's own convention
    for self-transfers, the only case with no +/- prefix); "- Rs.100" -> "-100".
    "Rs." must be stripped before the digit/dot filter -- its own period would
    otherwise survive as a bogus decimal point ("Rs.36,201" -> "0.36201")."""
    sign = "-" if text.strip().startswith("-") else ""
    cleaned = re.sub(r"Rs\.?", "", text, flags=re.I).replace(",", "")
    digits = re.sub(r"[^\d.]", "", cleaned)
    return f"{sign}{digits}" if digits else ""


def _reconstruct_paytm_pdf_grid(words, year_info: tuple[int, int, int, int] | None) -> list[list[str]] | None:
    """Rebuild a Paytm-CSV-shaped grid (Date, Time, Transaction Details, Your
    Account, Amount, UPI Ref No., Remarks) from one page's positioned words.

    Bucketing is by FIXED column bounds (see _PAYTM_PDF_COLUMN_BOUNDS) rather
    than anchor-derived ones like _reconstruct_pdf_grid -- Paytm's own layout
    is stable enough that this is more reliable than re-deriving it per page,
    and its headers ("Notes & Tags", "Your Account") don't share any words
    with the bank-PDF anchor list, so there's no risk of the two colliding.

    Returns a grid already shaped like the Paytm CSV export, so it flows
    through the existing, already-tested parse_paytm() unchanged.
    """
    lines = _cluster_lines(words)
    starts = [i for i, ln in enumerate(lines) if _is_paytm_pdf_row_start(ln)]
    if not starts:
        return None

    header_words = [w for ln in lines[:starts[0]] for w in ln["words"]]
    header_tokens = {w["text"].lower().strip(':&') for w in header_words}
    if not _PAYTM_HEADER_WORDS <= header_tokens:
        return None  # not a Paytm-shaped page

    start_month, start_year, _end_month, end_year = year_info or (1, 2000, 12, 2099)

    def year_for(month: int) -> int:
        if start_year == end_year:
            return start_year
        return start_year if month >= start_month else end_year

    def band(x0: float) -> str:
        if x0 < _PAYTM_PDF_COLUMN_BOUNDS["desc"]:
            return "datetime"
        if x0 < _PAYTM_PDF_COLUMN_BOUNDS["tags"]:
            return "desc"
        if x0 < _PAYTM_PDF_COLUMN_BOUNDS["account"]:
            return "tags"
        if x0 < _PAYTM_PDF_COLUMN_BOUNDS["amount"]:
            return "account"
        return "amount"

    rows = [["Date", "Time", "Transaction Details", "Your Account", "Amount", "UPI Ref No.", "Remarks"]]
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else len(lines)
        block_words = [w for ln in lines[start:end] for w in ln["words"]]
        buckets: dict[str, list] = {"datetime": [], "desc": [], "account": [], "amount": []}
        for w in block_words:
            b = band(w["x0"])
            if b in buckets:
                buckets[b].append(w)

        # Date & Time is always exactly 2 stacked lines ("31 Jul" / "3:47 PM");
        # anything else there is a stray disclaimer line bleeding into this
        # column's x-range -- harmless, it sorts after these by position.
        dt_lines = _cluster_lines(buckets["datetime"])
        if len(dt_lines) < 2:
            continue
        day, mon = dt_lines[0]["words"][0]["text"], dt_lines[0]["words"][1]["text"].rstrip('.').lower()
        month_num = _MONTH_ABBR.get(mon)
        time_match = _PAYTM_TIME_RE.match(_line_text(dt_lines[1]))
        if month_num is None or not time_match:
            continue
        date_str = f"{int(day):02d}/{month_num:02d}/{year_for(month_num)}"
        hour, minute, ampm = int(time_match[1]), time_match[2], time_match[3].upper()
        if ampm == "PM" and hour != 12:
            hour += 12
        if ampm == "AM" and hour == 12:
            hour = 0
        time_str = f"{hour:02d}:{minute}:00"

        # First line of the desc band is the payee/description; UPI Ref No.
        # sits a couple of lines further down in the SAME band (Paytm has no
        # dedicated ref column), so it's pulled out by regex across the block.
        desc_lines = _cluster_lines(buckets["desc"])
        if not desc_lines:
            continue
        description = _line_text(desc_lines[0])
        full_desc_text = " ".join(_line_text(ln) for ln in desc_lines)
        ref_match = re.search(r"UPI Ref No:\s*(\d+)", full_desc_text)
        upi_ref = ref_match.group(1) if ref_match else ""

        account_text = " ".join(_line_text(ln) for ln in _cluster_lines(buckets["account"]))

        amount_words = sorted(buckets["amount"], key=lambda w: (w["top"], w["x0"]))
        amount_str = _paytm_pdf_amount_to_signed_str(" ".join(w["text"] for w in amount_words))
        if not amount_str:
            continue

        rows.append([date_str, time_str, description, account_text, amount_str, upi_ref, ""])

    return rows if len(rows) > 1 else None


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


def parse_generic(df: pd.DataFrame, config: BankConfig, account_id: int, keys: KeyBuilder) -> list[ParsedTxn]:
    """Parse a separate-debit/credit-column statement per a BankConfig.

    Resolves each field to a real column via its aliases. If a required column
    can't be found, raises ValueError naming the field and the columns present --
    a loud, actionable failure instead of silently returning zero transactions.

    `keys` must be shared across every grid of the same file (see parse_statement) --
    a fresh builder per grid would renumber occurrences per page/sheet instead of
    per file, colliding genuine repeats that happen to land on different pages.
    """
    df = df.copy()
    cols = list(df.columns)
    date_col = _find_col(config.date_col, cols)
    desc_col = _find_col(config.desc_col, cols)
    debit_col = _find_col(config.debit_col, cols)
    credit_col = _find_col(config.credit_col, cols)

    missing = [name for name, col in (("date", date_col), ("description", desc_col),
                                      ("debit", debit_col), ("credit", credit_col)) if col is None]
    if missing:
        raise ValueError(
            f"{config.source} statement is missing required column(s) {missing}. "
            f"Columns found: {cols}. Add the actual name(s) to this bank's aliases in configs.py."
        )

    transactions: list[ParsedTxn] = []
    for _, row in df.iterrows():
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
            upi_ref = extract_upi_ref(description)
            unique_key = keys.build(
                account_id=account_id, txn_date=txn_date, amount=amount,
                txn_type=txn_type, upi_ref=upi_ref, description=description,
            )

            transactions.append(ParsedTxn(
                txn_date=txn_date, description=description, amount=amount, type=txn_type,
                account_id=account_id, source=config.source, upi_ref=upi_ref,
                unique_key=unique_key, raw_data=row.to_json(date_format='iso'),
            ))
        except Exception:
            logger.warning("Skipping unparseable row in %s statement", config.source, exc_info=True)
    return transactions


def parse_paytm(df: pd.DataFrame, account_map: dict, keys: KeyBuilder) -> list[ParsedTxn]:
    """Parse a Paytm wallet statement (single signed Amount column, per-row account).

    `keys` must be shared across every grid of the same file -- see parse_generic.
    """
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
            # Paytm writes amounts >= 1,000 with a thousands comma ("1,270.00");
            # pd.to_numeric can't parse that directly and silently returns NaN,
            # which the old code then read as "no amount" and dropped the row.
            amount_val = pd.to_numeric(str(row.get('Amount')).replace(',', ''), errors='coerce')
            if pd.isna(amount_val) or amount_val == 0:
                continue
            amount, txn_type = float(abs(amount_val)), ('credit' if amount_val > 0 else 'debit')
            txn_date = datetime.strptime(f"{row['Date']} {row['Time']}", '%d/%m/%Y %H:%M:%S')
            description = str(row['Transaction Details'])
            upi_ref = normalize_ref(row.get('UPI Ref No.'))
            unique_key = keys.build(
                account_id=matched_account, txn_date=txn_date, amount=amount,
                txn_type=txn_type, upi_ref=upi_ref, description=description,
            )

            transactions.append(ParsedTxn(
                txn_date=txn_date, description=description, amount=amount, type=txn_type,
                account_id=matched_account, source=source_provider, upi_ref=upi_ref,
                unique_key=unique_key, raw_data=row.to_json(date_format='iso'),
            ))
        except Exception:
            logger.warning("Skipping unparseable Paytm row", exc_info=True)
    return transactions
