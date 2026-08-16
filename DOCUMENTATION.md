# Prem Expense Tracker — Project Documentation

> **Source of truth** for understanding, developing, and deploying this application. Read this before touching the code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Backend Deep Dive](#5-backend-deep-dive)
6. [Frontend Deep Dive](#6-frontend-deep-dive)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Authentication Flow](#9-authentication-flow)
10. [Key Business Logic](#10-key-business-logic)
11. [Local Development Setup](#11-local-development-setup)
12. [Deployment](#12-deployment)
13. [Environment Variables Reference](#13-environment-variables-reference)
14. [Password Management](#14-password-management)
15. [Converting This Document to Word (.docx)](#15-converting-this-document-to-word-docx)

---

## 1. Project Overview

**Prem Expense Tracker** is a personal finance dashboard that lets users track spending, set monthly budgets, and understand their financial habits. It is a multi-tenant application — each user sees only their own data.

### Core Features

| Feature | Description |
|---|---|
| Dashboard | Monthly KPI cards (total spent, daily average, projected spend), spending trend chart, top categories donut chart, recent transactions |
| Transactions | Full CRUD, filterable by date/category/account/type/search, paginated, multi-tag support |
| Statement Import | Upload bank statements as CSV, Excel (.xls/.xlsx), or PDF from HDFC, ICICI, SBI, or Paytm — auto-detects the bank and layout, deduplicates, and categorises |
| Budgets | Set monthly spending limits per category; smart suggestions from past 3 months if no history |
| Budget Alerts | Proactive alerts at 75%, 90%, and 100% of a category budget |
| Analytics | Spending velocity, habit identifier, category distribution, monthly breakdown, transaction heatmap |
| Settings | Manage categories (with icons), tags, bank accounts |
| Auth | JWT-based registration + login; Remember Me (7-day token); Change Password from Profile; session timer in navbar; auto-logout on expiry |

---

## 2. Architecture

### Production (Deployed)

```
┌─────────────┐     HTTPS      ┌──────────────────────────┐     HTTPS      ┌──────────────────────────┐
│             │  ──────────►  │                          │  ──────────►  │                          │
│   Browser   │                │  Vercel (React SPA)      │                │  Render (FastAPI)        │
│             │  ◄──────────  │  prem-expense-tracker    │  ◄──────────  │  Docker container        │
└─────────────┘                │  .vercel.app             │                │  port 80                 │
                               └──────────────────────────┘                └────────────┬─────────────┘
                                                                                         │ PostgreSQL
                                                                                         ▼ connection
                                                                           ┌──────────────────────────┐
                                                                           │  Supabase (PostgreSQL)   │
                                                                           │  personal_finance DB     │
                                                                           └──────────────────────────┘
```

### Local Development

```
┌─────────────┐   localhost    ┌──────────────────────────┐   proxy /api   ┌──────────────────────────┐
│             │  :5173 ──────►│  Vite Dev Server         │  ──────────►  │  Uvicorn (FastAPI)       │
│   Browser   │                │  npm run dev             │                │  localhost:8000          │
│             │  ◄──────────  │                          │  ◄──────────  │                          │
└─────────────┘                └──────────────────────────┘                └────────────┬─────────────┘
                                                                                         │
                                                                                         ▼
                                                                           ┌──────────────────────────┐
                                                                           │  Local PostgreSQL        │
                                                                           │  localhost:5432          │
                                                                           │  personal_finance DB     │
                                                                           └──────────────────────────┘
```

> **Note on the proxy:** The Vite dev server automatically forwards any request starting with `/api` to `http://localhost:8000`. This means the React frontend never directly exposes the backend URL, and there are no CORS issues during local development.

### Request Lifecycle (Production)

```
User action in browser
  → Axios sends request with JWT Bearer token
  → Vercel serves the SPA (static)
  → API call hits Render backend
  → FastAPI validates JWT in request interceptor
  → CRUD layer queries Supabase PostgreSQL with user_id filter
  → Response JSON returned to browser
  → React updates UI
```

---

## 3. Tech Stack

### Backend

| Library | Version | Purpose |
|---|---|---|
| Python | 3.11 | Runtime |
| FastAPI | 0.116.1 | Web framework, automatic OpenAPI docs |
| Uvicorn | 0.35.0 | ASGI server |
| SQLAlchemy | 2.0.41 | ORM — models and queries |
| psycopg2-binary | 2.9.10 | PostgreSQL driver |
| Pydantic | 2.11.7 | Request/response validation and serialization |
| pydantic-settings | 2.10.1 | Settings from environment variables |
| python-jose | 3.5.0 | JWT creation and validation |
| passlib + bcrypt | 1.7.4 / 3.2.2 | Password hashing |
| Pandas | 2.3.1 | CSV/Excel parsing for bank statement uploads |
| pdfplumber | 0.11.4 | PDF word/table extraction for borderless bank statement PDFs |
| RapidFuzz / thefuzz | 3.13.0 / 0.22.1 | Fuzzy string matching for smart categorisation |
| openpyxl / xlrd | 3.1.5 / 2.0.2 | Excel file support |
| python-multipart | 0.0.20 | File upload (multipart form data) |
| python-dotenv | 1.1.1 | Load `.env` file for local dev |
| alembic | 1.16.4 | DB migrations — two migrations applied to date (`0001_content_based_unique_keys`, `0002_add_subscriptions_table`); `alembic upgrade head` is required after a fresh local DB creation |

### Frontend

| Library | Version | Purpose |
|---|---|---|
| React | 19.1.0 | UI framework |
| TypeScript | 5.8.3 | Type safety |
| Vite | 7.0.4 | Build tool and dev server |
| React Router DOM | 7.7.0 | Client-side routing |
| Axios | 1.10.0 | HTTP client with interceptors |
| Tailwind CSS | 3.4.1 | Utility-first styling, extended with the app's design-token system (colors, radii, shadows, fonts) and a `data-theme` attribute for light/dark mode — see §6 |
| Recharts | 3.1.0 | Charts (Area, Pie, Bar) |
| lucide-react | 0.525.0 | Icon library (also used for category icons) |
| react-select | 5.10.2 | Multi-select dropdown for tags |
| react-hot-toast | 2.5.2 | Toast notifications |
| dayjs | 1.11.13 | Date formatting and session countdown |
| html2canvas | 1.4.1 | Export charts as PNG |

---

## 4. Repository Structure

```
prem-expense-tracker/               ← Monorepo root
│
├── DOCUMENTATION.md                ← You are here
├── README.md                       ← Brief project summary
├── Dockerfile.backend              ← Docker build for the backend (used by Render)
├── .dockerignore                   ← Excludes node_modules, venv, .env from Docker build
├── .gitignore                      ← Excludes .env, node_modules, venv, dist
│
├── backend/                        ← Python FastAPI application
│   ├── requirements.txt            ← All Python dependencies
│   ├── .env                        ← Local secrets (NOT committed to git in production)
│   ├── alembic/versions/           ← DB migrations, applied in order (0001, 0002, 0003...)
│   └── app/
│       ├── main.py                 ← FastAPI app entry point
│       ├── api/                    ← Route handlers
│       ├── models/                 ← SQLAlchemy DB models
│       ├── schemas/                ← Pydantic request/response shapes
│       ├── crud/                   ← Raw database operations
│       ├── services/               ← Business logic
│       │   └── parsing/            ← Modular CSV/Excel/PDF statement parser (see 5)
│       ├── core/                   ← Auth, config, DI
│       └── db/                     ← DB engine and session
│
└── frontend/                       ← React TypeScript application
    ├── package.json
    ├── vite.config.ts              ← Vite config with /api proxy
    ├── tailwind.config.js
    ├── vercel.json                 ← Vercel SPA rewrite rule
    └── src/
        ├── api/                    ← All Axios API calls
        ├── auth/                   ← Login, Register, ProtectedRoute
        ├── components/             ← Shared UI components (Navbar, Modals)
        ├── Dashboard/              ← Dashboard page and sub-components
        ├── Expenses/               ← Expenses page and sub-components
        ├── Budgets/                ← Budgets page and sub-components
        ├── Analytics/              ← Analytics page and sub-components
        ├── Merchants/              ← Merchant mapping page
        ├── Settings/               ← Settings page and sub-components
        ├── Profile/                ← Profile page
        ├── types/                  ← TypeScript interfaces
        ├── utils/                  ← Shared helpers
        └── App.tsx                 ← Router configuration
```

---

## 5. Backend Deep Dive

All backend code lives inside `backend/app/`. The app follows a layered architecture:

```
HTTP Request
    → api/ (route handler)
        → schemas/ (validates input)
        → crud/ (DB operations) or services/ (business logic)
            → models/ (SQLAlchemy ORM)
                → PostgreSQL
    → schemas/ (serializes output)
→ HTTP Response
```

### `main.py` — FastAPI Entry Point

The single file where the FastAPI application is created. Responsibilities:
- Creates the `FastAPI()` app instance
- Attaches `CORSMiddleware` with a whitelist of allowed origins (Vercel URL + localhost:5173)
- Mounts the main API router at prefix `/api/v1`
- Defines the root `GET /` health-check endpoint

**CORS origins configured:**
```
https://prem-expense-tracker.vercel.app   ← production frontend
http://localhost:5173                      ← local Vite dev server
http://127.0.0.1:5173                     ← local Vite dev server (alternate)
```

If you add another frontend URL (e.g. a staging URL), you must add it here.

---

### `app/api/` — Route Handlers

This folder contains one file per feature domain. All routes are registered through `api_router.py` and mounted under `/api/v1`.

| File | Prefix | Purpose |
|---|---|---|
| `api_router.py` | — | Aggregates all routers into one |
| `auth_router.py` | `/auth` | Register, JSON login with Remember Me, change password |
| `users_router.py` | `/users` | Get/delete current user profile |
| `account_router.py` | `/accounts` | CRUD for bank accounts |
| `category_router.py` | `/categories` | CRUD for spending categories |
| `transaction_router.py` | `/transactions` | CRUD + filtering + pagination |
| `merchant_router.py` | `/merchants` | CRUD for merchants |
| `tag_router.py` | `/tags` | CRUD for tags |
| `transaction_tag_router.py` | `/transaction-tags` | Add/remove tags on transactions |
| `goal_router.py` | `/goals` | CRUD for monthly budget goals |
| `alert_router.py` | `/alerts` | Read and acknowledge alerts |
| `budget_plan_router.py` | `/budgets` | Get/save/delete monthly budget plans |
| `dashboard_router.py` | `/dashboard` | Dashboard data endpoint |
| `analytics_router.py` | `/analytics` | Analytics data endpoint |
| `upload_router.py` | `/settings` | Bank statement CSV upload |
| `test_router.py` | `/test` | DB connectivity test |

Every route except `/auth/register`, `/auth/login/password`, `/auth/login`, and `/test/test-db` requires a valid JWT via `Depends(deps.get_current_active_user)`.

---

### `app/models/` — SQLAlchemy ORM Models

These Python classes map directly to database tables. SQLAlchemy uses them to generate SQL at runtime.

| File | Table | Notes |
|---|---|---|
| `user.py` | `users` | Root entity; owns all other data |
| `account.py` | `accounts` | Bank account linked to user |
| `category.py` | `categories` | Spending categories with icon support |
| `transaction.py` | `transactions` | Core financial record |
| `tag.py` | `tags` | Labels for transactions |
| `transaction_tag.py` | `transaction_tags` | Many-to-many junction between transactions and tags |
| `merchant.py` | `merchants` | Merchant with optional default category |
| `goal.py` | `goals` | Monthly budget limit per category |
| `alert.py` | `alerts` | Budget threshold notifications |

All models extend `Base` from `app/db/base_class.py`. All relationships include cascade rules so deleting a user removes all their data.

---

### `app/schemas/` — Pydantic Schemas

Pydantic schemas serve two purposes:
1. **Input validation** — FastAPI automatically validates request bodies and query parameters against these
2. **Output serialization** — FastAPI uses `response_model` to shape what gets returned

Each domain has a schema file. Common pattern:

```python
class ThingBase(BaseModel):      # shared fields
class ThingCreate(ThingBase):    # fields required to create
class ThingUpdate(ThingBase):    # fields allowed to update (usually Optional)
class ThingOut(ThingBase):       # what gets returned in responses
    id: int
    model_config = ConfigDict(from_attributes=True)  # allows ORM model → schema
```

| File | Covers |
|---|---|
| `user_schema.py` | UserCreate (with password validation), UserOut |
| `auth_schema.py` | Token, LoginRequest (identifier + password + remember_me), ChangePasswordRequest (old_password + new_password) |
| `account_schema.py` | AccountCreate, AccountUpdate, AccountOut |
| `category_schema.py` | CategoryCreate, CategoryUpdate, CategoryOut |
| `transaction_schema.py` | TransactionCreate, TransactionUpdate, TransactionOut |
| `tag_schema.py` | TagCreate, TagOut |
| `merchant_schema.py` | MerchantCreate, MerchantOut |
| `goal_schema.py` | GoalCreate, GoalUpdate, GoalOut |
| `alert_schema.py` | AlertOut |
| `budget_plan_schema.py` | BudgetPlanRequest, BudgetPlanResponse, CategoryBudgetItem |
| `transaction_tag_schema.py` | TransactionTagCreate, TransactionTagOut |
| `transaction_log_schema.py` | Upload response shapes |

---

### `app/crud/` — Database Operations

Each file contains plain functions that talk directly to the database using SQLAlchemy sessions. Every query is scoped with a `user_id` filter — it is impossible for a user to access another user's data.

Pattern:
```python
def get_all_things(db: Session, user_id: int) -> list[Thing]:
    return db.query(Thing).filter(Thing.user_id == user_id).all()
```

| File | Key Behaviours |
|---|---|
| `user_crud.py` | Create user, get by email, get by ID, update password, delete cascade |
| `account_crud.py` | UniqueConstraint on (user_id, name) |
| `category_crud.py` | On delete: uncategorises existing transactions |
| `transaction_crud.py` | Smart category detection (`_get_smart_category`), triggers budget alerts on create/update |
| `merchant_crud.py` | UniqueConstraint on (user_id, name) |
| `tag_crud.py` | UniqueConstraint on (user_id, name) |
| `transaction_tag_crud.py` | Manages the junction table |
| `goal_crud.py` | `upsert_budget_for_category` — creates or updates or deletes depending on amount |
| `alert_crud.py` | Prevents duplicate unacknowledged alerts; creates new_category alerts |

---

### `app/services/` — Business Logic

Services contain logic that is too complex for a single CRUD call. Routers delegate to services, which call CRUD functions internally.

| File | Responsibility |
|---|---|
| `auth_service.py` | Authenticates user credentials, returns User or None |
| `transaction_service.py` | Applies multi-filter queries with pagination (page/limit) and eager-loaded tags |
| `alert_service.py` | Calculates category spend for a month; creates threshold alerts at 75/90/100% |
| `budget_plan_service.py` | Constructs the full budget plan view: pacing analysis, suggestions from history, retroactive alert creation |
| `dashboard_service.py` | Assembles KPI metrics, spending trend data, top categories, recent transactions |
| `analytics_service.py` | Spending velocity vs historical, habit identifier, category distribution, heatmap, monthly breakdown |
| `upload_service.py` | Detects duplicates by `unique_key`, applies smart categorisation, creates transactions (see `app/services/parsing/` for the actual file parsing) |

---

### `app/services/parsing/` — Statement Parsing Package

Turns an uploaded CSV/Excel/PDF file into a list of normalized transaction dicts. Built to survive bank statement layout changes (renamed columns, different export tools) without code changes — see [Key Business Logic](#10-key-business-logic) for the end-to-end flow.

| File | Responsibility |
|---|---|
| `base.py` | `BankConfig` dataclass — declarative per-bank layout: each column (`date_col`, `desc_col`, `debit_col`, `credit_col`, `ref_col`, `unique_id_col`) is a **tuple of aliases**, not a single string |
| `configs.py` | `BANK_CONFIGS` registry — one `BankConfig` entry per bank (HDFC, ICICI, SBI). Adding a new bank or a renamed column is a one-line/one-tuple change here, nothing else |
| `parsers.py` | Tokenizing alias matcher (`_find_col`) that matches a config alias to a real header regardless of spacing, casing, glued `camelCase`, or trailing text like `(INR)`; native-float amount parsing (avoids a numpy/psycopg2 binding bug); CSV/Excel reading; and PDF table reconstruction — clusters `pdfplumber` words into lines by y-position, groups multi-line transaction blocks, and buckets words into columns by x-position (left-edge, not nearest-center, so wide description columns don't bleed into amount columns) |
| `__init__.py` | Public entry point `parse_statement(filename, raw_bytes, account_map)`. Detects bank + header row (filename hint, then header-signature scan), dispatches to the matching parser, and skips unconfigured accounts. If nothing parses, raises a `ValueError` naming the columns/shapes it actually found, so a layout change is diagnosable without needing the raw file |

**Why alias tuples instead of fixed column names:** banks periodically rename statement columns (e.g. `"Value Date"` → `"Transaction Date"`, or gluing `"Withdrawal Amount(INR)"` with no space). Instead of chasing every variant with new parsing code, each `BankConfig` field lists known aliases, and `_find_col` matches by word-tokens being a subset of the real header's tokens — so most renames just need a new string added to a tuple in `configs.py`, not new logic.

---

### `app/core/` — Cross-Cutting Concerns

| File | What it does |
|---|---|
| `config.py` | `Settings` class reads `DATABASE_URL` from environment via `pydantic-settings`. Import as `from app.core.config import settings` |
| `security.py` | `get_password_hash()`, `verify_password()`, `create_access_token()` — all JWT and bcrypt logic. Constants: `ACCESS_TOKEN_EXPIRE_MINUTES = 60` (session), `REMEMBER_ME_EXPIRE_DAYS = 30` (Remember Me) |
| `deps.py` | FastAPI dependency `get_current_active_user(token)` — decodes JWT, loads user from DB, raises 401 if invalid. Injected into every protected route |

---

### `app/db/` — Database Setup

| File | What it does |
|---|---|
| `session.py` | Creates the SQLAlchemy `engine` from the `DATABASE_URL` env var; defines `SessionLocal` factory; exports `get_db()` generator dependency. **Raises `RuntimeError` at import time if `DATABASE_URL` isn't set** — there is no hardcoded fallback, so a working `.env` (or Render env var) is required to start the app |
| `base_class.py` | Declares `Base = declarative_base()` — all models import and extend this |
| `dependency.py` | Re-exports `get_db` for use as a FastAPI `Depends()` |
| `init_test_db.py` | Creates all tables from models (used for test setup) |

---

## 6. Frontend Deep Dive

All frontend source code lives inside `frontend/src/`. The app is a Single Page Application — React Router handles all navigation client-side.

### Design system & theming

The app uses a token-based design system ("Pocket" — warm cream field, 2px ink borders, hard offset shadows, candy-coloured accents):

- **Tokens** live in `tailwind.config.js`'s `theme.extend` — `colors.{bg,card,ink,line,shadow,muted,faint,hair,link,nav}` are theme-aware (backed by CSS custom properties, see below), `colors.candy.{yellow,mint,pink,coral,blue,lilac}` are fixed accents identical in both themes, plus `colors.candyLine` (`#1E1B16`, fixed) — used specifically for borders drawn on top of a candy fill, since a theme-swapping border nearly disappears against a fill that doesn't itself change between themes. Also: `fontFamily.{heading,body,money,mono}` (Bricolage Grotesque / Archivo / Archivo Black / JetBrains Mono), `borderRadius.{chip,card,cardLg,sheet,pickerSheet}`, `borderWidth.{DEFAULT: 1.5px, 2: 2px}`, `boxShadow.{chip,card,overlay,sheet,press}` (hard offset shadows, no blur).
- **`src/index.css`** defines the light-mode values as CSS custom properties on `:root` and dark-mode overrides under `[data-theme="dark"]`, plus `--scrim` (45% ink, used for modal/overlay backdrops). Fonts are loaded via a `<link>` in `index.html`, which also runs a small inline script that applies the persisted (or system) theme to `<html data-theme>` before React mounts, avoiding a flash of the wrong theme.
- **`src/theme/ThemeContext.tsx`** — `ThemeProvider`/`useTheme()`. Persists the light/dark choice to `localStorage`, falls back to `prefers-color-scheme` on first load, sets `data-theme` on `document.documentElement`. Mounted at the top of `App.tsx`.
- **`src/components/MonthContext.tsx`** — `MonthProvider`/`useMonth()`. One shared `{month: "YYYY-MM"}` selection (plus a picker-modal open/close flag) used by every month-scoped screen (Dashboard, Analytics in "month" view mode, Budgets), instead of each page owning its own local state. Mounted in `App.tsx`'s `MainLayout`.
- **`src/components/MonthControl.tsx`** — the `‹ Month Year ›` control every month-scoped page renders; the label opens `MonthPickerModal`.
- **`src/components/MonthPickerModal.tsx`** — year stepper (disabled past the current year) over a 3×4 month grid; future months are dashed/inert; the selected month gets the candy-blue fill.

### `src/App.tsx` — Router Configuration

Defines all routes, wrapped in `ThemeProvider` and `MonthProvider`. Every route except `/login` and `/register` is wrapped in `<ProtectedRoute>`, which redirects unauthenticated users to `/login`.

```
/                 → redirect to /dashboard
/login            → LoginPage
/register         → RegisterPage
/dashboard        → Dashboard
/expenses         → Expenses
/budgets          → Budgets
/analytics        → Analytics
/settings         → Settings
/profile          → ProfilePage
```

---

### `src/api/apiClient.ts` — The API Layer

**This is the only file that makes HTTP calls.** All components import functions from here — nothing calls `axios` directly from a component.

- Creates an Axios instance with `baseURL = VITE_API_BASE_URL || http://localhost:8000/api/v1`
- **Smart token storage:** `getToken()` checks `localStorage` first (Remember Me sessions), then `sessionStorage` (tab sessions). `clearToken()` wipes both on logout/401
- **Request interceptor:** Calls `getToken()` and adds `Authorization: Bearer <token>` to every request
- **Response interceptor:** On 401 — shows toast, calls `clearToken()`, redirects to `/login`
- Exports one named function per API call (e.g. `getDashboardData`, `createTransaction`, `uploadStatements`, `changePassword`)

---

### `src/auth/` — Authentication Pages

| File | Purpose |
|---|---|
| `LoginPage.tsx` | Email/username + password form. **Remember Me checkbox** — checked stores 7-day token in `localStorage`; unchecked stores 60-min token in `sessionStorage`. **Forgot Password** button opens a modal explaining to contact admin for reset. Show/hide password toggle |
| `RegisterPage.tsx` | Name, email, password, confirm password. Show/hide toggle on both password fields. `PasswordStrength` component shown directly below the password field (live feedback as you type). Validates all fields before submitting |
| `PasswordStrength.tsx` | Shows 5 password criteria (length, uppercase, lowercase, digit, special char) with live green/red checkmarks. Reused on Register and Profile pages |
| `ProtectedRoute.tsx` | Checks `localStorage` then `sessionStorage` for `accessToken`. If missing in both → `<Navigate to="/login">` |

---

### `src/components/` — Shared UI

| File | Purpose |
|---|---|
| `Navbar.tsx` | Top navigation bar (sticky, cream, 2px ink bottom border). Contains: logo tile + wordmark, yellow-pill nav links, a **theme toggle**, an **assistant entry button** (visual only — not yet wired to a panel), **session countdown timer** (decoded from JWT `exp`), **alert bell** (fetches unread alerts on load), avatar dropdown (profile + sign out) |
| `ui/Modal.tsx` | Base modal wrapper — centered overlay, click-outside-to-close, escape key support |
| `ui/LargeModal.tsx` | Same as Modal but `max-w-4xl` for complex forms (e.g. budget setup) |
| `ui/ConfirmModal.tsx` | Delete confirmation dialog with Cancel + Confirm (red) buttons |

**Alert bell in Navbar:** Polls unread alerts on mount. Two alert types appear:
- `budget` — triggered when spending crosses 75%, 90%, or 100% of a goal
- `new_category` — triggered when the upload service encounters an unrecognised category name

---

### `src/Dashboard/` — Dashboard Feature

| File | Purpose |
|---|---|
| `Dashboard.tsx` | Page component. Reads/writes the month via `useMonth()` (shared context, not local state). Fetches `getDashboardData(month)` when month changes. Renders the mint hero (total spend + delta pill) inline, then passes data to sub-components |
| `components/KPICards.tsx` | 2 metric cards: Daily Average, Projected Monthly — total spend + % change moved into the page's own hero card |
| `components/SpendingTrendChart.tsx` | AreaChart — cumulative daily spend for the selected month |
| `components/TopSpendCategoriesChart.tsx` | Donut PieChart — top 5 spending categories. Clicking a slice navigates to `/expenses` filtered by that category. Download button exports as PNG via html2canvas |
| `components/RecentTransactionsTable.tsx` | Last 5 transactions with icon, description, category, date, amount |

`components/BudgetGaugeChart.tsx` and `components/SpendingPacing.tsx` exist in this directory but are dead code — not imported by `Dashboard.tsx` or anywhere else.

---

### `src/Expenses/` — Transaction Management

| File | Purpose |
|---|---|
| `Expenses.tsx` | Page component. Owns filter state, pagination, fetch, and CRUD handlers |
| `components/ExpenseFilters.tsx` | Date range, account, category, type, and keyword search inputs. Calls parent `onApplyFilters` |
| `components/TransactionsTable.tsx` | Paginated list of transactions (10 per page). Edit + Delete actions per row |
| `components/TransactionModal.tsx` | Add/Edit form: description, amount, type (Debit/Credit), date, category, account, multi-tag select (react-select) |
| `components/TransactionItem.tsx` | Single transaction row rendering |

---

### `src/Budgets/` — Budget Planning & Monitoring

| File | Purpose |
|---|---|
| `Budgets.tsx` | Page component. Reads/writes the month via the shared `useMonth()` context (renders `<MonthControl />`, not a page-local filter). Fetches budget plan for current month. Decides between empty state and monitoring view |
| `components/SmartEmptyState.tsx` | Shown when no budget exists. Displays suggested amounts based on last 3 months of spend |
| `components/SetupModal.tsx` | Large modal for bulk category budget allocation. Has a total target with auto-distribute and lock/unlock |
| `components/MonitoringView.tsx` | Current month budget progress per category, incl. the Money Remaining card (coral + compacted/exact/over-% treatment when negative) |
| `components/CategoryBudgetCard.tsx` | Individual category budget input row |
| `components/TotalBudgetCard.tsx` | Summary card showing total budget vs total allocated |

`components/BudgetsKPICards.tsx` and `components/AddCategoryModal.tsx` exist in this directory but are dead code — not imported by `Budgets.tsx` or anywhere else. (`components/BudgetMonthFilter.tsx` — the old page-local month selector — has been deleted; superseded by the shared `MonthControl`.)

---

### `src/Analytics/` — Analytics View

| File | Purpose |
|---|---|
| `Analytics.tsx` | Page component. Owns `timePeriod`, `viewMode` (trend/month), `includeCapitalTransfers` state. In `viewMode === 'month'`, `timePeriod` is kept in sync with the shared `useMonth()` context and the header renders `<MonthControl />`; `viewMode === 'trend'` keeps its own independent range selector. Renders a static Wrapped teaser card (not yet wired to the actual Wrapped overlay) |
| `components/AnalyticsHeader.tsx` | Time period selector (3m, 6m, 1y, all, or specific month via the shared month control), view toggle, capital transfers toggle, KPI display |
| `components/SpendingVelocityChart.tsx` | Line chart — current month vs previous month vs historical average (day-by-day) |
| `components/HabitIdentifierChart.tsx` | Bar chart — transaction count and average spend by category |
| `components/CategoryDistribution.tsx` | Pie/bar chart — percentage breakdown of spend by category |
| `components/MonthlyBreakdownChart.tsx` | Bar chart — month-by-month total spending |
| `components/CategorySpending.tsx` | Transaction heatmap — colour-coded daily spend calendar |
| `components/BudgetVsSpendChart.tsx` | Budget limit vs actual spend per category |

---

### `src/Merchants/Merchants.tsx` — Merchant Mapping

Single file (no subcomponents folder, like Profile). Three things on one page:
- **Bulk-suggestion banner**: one card per cluster from `GET /merchants/clusters` (transactions with no merchant at all yet, grouped by shared UPI handle) — raw description sample, an editable clean-name input pre-filled with a guess derived from the handle, a category picker, and "Apply to N": creates the merchant (`POST /merchants`) then links every transaction in the cluster to it (`PUT /transactions/{id}` per id).
- **Search + list of existing merchants**: `GET /merchants?q=`, inline rename/recategorise (`PUT /merchants/{id}`) and delete (`DELETE /merchants/{id}`).
- **"N unmapped" badge + "Rescan backlog" button**: `GET /merchants/unmapped-count` and `POST /merchants/rescan` — sweeps the existing backlog against merchants that already exist (exact handle auto-applies, fuzzy raises a `new_merchant` alert instead of showing up here).

The Navbar's notification dropdown renders `new_merchant` alerts the same visual way as `new_category` ones; accept composes `PUT /transactions/{id}` + `PUT /alerts/{id}/acknowledge` (no dedicated "accept" endpoint).

---

### `src/Settings/` — App Configuration

| File | Purpose |
|---|---|
| `Settings.tsx` | Page component. Loads categories, tags, accounts on mount |
| `components/CategorySettingsCard.tsx` | Lists categories with edit/delete. Opens CategoryModal |
| `components/CategoryModal.tsx` | Form: category name + icon picker. Supports add and edit |
| `components/IconPicker.tsx` | Grid of 33 selectable lucide icons for categories |
| `components/TagsCard.tsx` | Lists tags with edit/delete |
| `components/TagModal.tsx` | Form: tag name |
| `components/AccountsCard.tsx` | Lists bank accounts with edit/delete |
| `components/AccountModal.tsx` | Form: account name, type (Savings/Current/etc.), provider (bank name) |
| `components/DataSyncCard.tsx` | File input for uploading multiple bank statements (CSV, XLSX, XLS, or PDF). Calls `uploadStatements()` |
| `components/ConfirmDeleteAccountModal.tsx` | Password re-entry confirmation before permanently deleting the user account |
| `components/SettingsHeader.tsx` | Page heading |

---

### `src/Profile/ProfilePage.tsx`

Displays the current user's username and email (fetched from `GET /users/me`), and includes a full **Change Password** form:
- Current password field (verified against the backend before accepting)
- New password field with live `PasswordStrength` indicator
- Confirm new password field with real-time match validation
- Show/hide eye toggle on all three password fields
- Calls `POST /auth/change-password`

---

### `src/types/index.ts` — TypeScript Interfaces

All 19 data types shared across the frontend are defined here. Key ones:

```typescript
User             { id, username, email, created_at }
Account          { id, name, type, provider, account_number }
Category         { id, name, is_income, icon_name }
Tag              { id, name }
Transaction      { id, txn_date, description, amount, type, source, account_id, category_id, tags, ... }
Alert            { id, type, threshold_percentage, context, is_acknowledged, triggered_at }
DashboardData    { total_spent, percent_change, daily_average, projected_monthly, top_categories, spending_trend, recent_transactions }
BudgetPageData   { month, budgets: CategoryBudget[], suggestions: CategoryBudget[] }
AnalyticsData    { velocity, habit_identifier, category_distribution, monthly_breakdown, heatmap, budget_vs_spend }
```

---

### `src/utils/`

| File | Exports |
|---|---|
| `formatter.ts` | `formatCurrency(amount)` → `₹1,234.56`; `formatDate(dateStr)` → `15 Jan 2025` |
| `iconHelper.tsx` | `getCategoryIcon(categoryName, iconName)` returns the correct lucide icon component in a bordered, pastel-tinted circle (ink icon/border on a light tint — never white-on-saturated, so contrast holds in both themes). Registry of 33 icons mapped to names like `utensils`, `car`, `shopping-bag` |

---

## 7. Database Schema

### Entity Relationship Diagram

```
users
 │  id, username, email, hashed_password, created_at
 │
 ├──── accounts (user_id FK)
 │      id, name, type, provider, account_number
 │      UNIQUE(user_id, name)
 │
 ├──── categories (user_id FK)
 │      id, name, is_income, icon_name
 │      UNIQUE(user_id, name)
 │         │
 │         ├──── goals (category_id FK, user_id FK)
 │         │      id, month[YYYY-MM], limit_amount
 │         │         │
 │         │         └──── alerts (goal_id FK, user_id FK)
 │         │                id, type, threshold_percentage, context(JSON),
 │         │                triggered_at, is_acknowledged
 │         │
 │         └──── merchants (category_id FK, user_id FK)
 │                id, name
 │                UNIQUE(user_id, name)
 │
 ├──── transactions (user_id FK, account_id FK, category_id FK, merchant_id FK)
 │      id, txn_date, description, amount, type[debit|credit],
 │      source, upi_ref, unique_key, raw_data(JSON), created_at
 │      UNIQUE(user_id, unique_key)
 │         │
 │         └──── transaction_tags (transaction_id FK, tag_id FK, user_id FK)
 │                [junction table — many-to-many]
 │
 └──── tags (user_id FK)
        id, name
        UNIQUE(user_id, name)
        │
        └──── transaction_tags (tag_id FK)
```

### Table Details

#### `users`
```
Column           Type          Constraints
───────────────────────────────────────────
id               Integer       PK, auto-increment
username         String(50)    UNIQUE, indexed, NOT NULL
email            String(255)   UNIQUE, indexed, NOT NULL
hashed_password  String(255)   NOT NULL
created_at       DateTime      server default = now()
```

#### `accounts`
```
Column          Type      Constraints
──────────────────────────────────────
id              Integer   PK
name            String    indexed, NOT NULL
type            String    e.g. "Savings", "Current", "Credit Card"
provider        String    e.g. "HDFC", "ICICI"
account_number  String    nullable
user_id         Integer   FK → users.id, NOT NULL
                          UNIQUE(user_id, name)
```

#### `categories`
```
Column     Type        Constraints
────────────────────────────────────
id         Integer     PK
name       String      indexed, NOT NULL
is_income  Boolean     default False
icon_name  String(50)  nullable
user_id    Integer     FK → users.id, NOT NULL
                       UNIQUE(user_id, name)
```

#### `transactions`
```
Column       Type      Constraints
────────────────────────────────────────────────────
id           Integer   PK
txn_date     DateTime  NOT NULL
description  String    NOT NULL
amount       Float     NOT NULL
type         String    "debit" or "credit"
source       String    bank/upload source identifier
account_id   Integer   FK → accounts.id
category_id  Integer   FK → categories.id, nullable
merchant_id  Integer   FK → merchants.id, nullable
user_id      Integer   FK → users.id, NOT NULL
upi_ref      String    nullable, indexed (UPI reference number)
unique_key   String    nullable, indexed — composite dedup key
raw_data     JSON      nullable — original parsed CSV row
created_at   DateTime  server default = now()
                       UNIQUE(user_id, unique_key)
```

#### `tags`
```
Column   Type     Constraints
──────────────────────────────
id       Integer  PK
name     String   indexed, NOT NULL
user_id  Integer  FK → users.id
                  UNIQUE(user_id, name)
```

#### `transaction_tags`
```
Column          Type     Constraints
──────────────────────────────────────
transaction_id  Integer  FK → transactions.id, CASCADE DELETE, PK
tag_id          Integer  FK → tags.id, CASCADE DELETE, PK
user_id         Integer  FK → users.id, CASCADE DELETE
```

#### `merchants`
```
Column       Type     Constraints
───────────────────────────────────
id           Integer  PK
name         String   indexed, NOT NULL
category_id  Integer  FK → categories.id, nullable
user_id      Integer  FK → users.id
                      UNIQUE(user_id, name)
```

#### `goals`
```
Column        Type           Constraints
─────────────────────────────────────────
id            Integer        PK
category_id   Integer        FK → categories.id, NOT NULL
month         String         YYYY-MM format, indexed
limit_amount  Numeric(12,2)  NOT NULL
user_id       Integer        FK → users.id, indexed
created_at    DateTime       server default = now()
updated_at    DateTime       server default = now(), auto-updates
```

#### `alerts`
```
Column                Type           Constraints
─────────────────────────────────────────────────
id                    Integer        PK
type                  String         "budget", "new_category", or "new_merchant"; default "budget"
goal_id               Integer        FK → goals.id, CASCADE DELETE, nullable
threshold_percentage  Numeric(5,2)   nullable (75.00, 90.00, 100.00)
context               JSON           flexible data payload -- category name for new_category; transaction id/
                                     description snippet/suggested merchant+category/match reason/similarity
                                     score for new_merchant (see merchant_matching_service.py)
triggered_at          DateTime       nullable
is_acknowledged       Boolean        default False
user_id               Integer        FK → users.id, CASCADE DELETE, indexed
```

### Key Design Decisions

- **User-scoped isolation:** Every table has `user_id`. Every query adds `.filter(Model.user_id == user_id)`. It is architecturally impossible for a user to see another user's data.
- **`unique_key` on transactions:** Prevents duplicate imports. Composite key built as `{source}-{ref}-{date}-{amount}`. Checked per user before inserting.
- **Cascade deletes:** Deleting a `User` cascades to all their data. Deleting a `Category` uncategorises transactions (sets `category_id = NULL`) rather than deleting them.
- **`raw_data` JSON column:** Stores the original CSV row for each imported transaction, useful for debugging import issues.
- **Month stored as `YYYY-MM` string:** Goals and budget plans are keyed by month string. Simple and avoids timezone issues.

---

## 8. API Reference

All endpoints are prefixed with `/api/v1`. All endpoints except auth require `Authorization: Bearer <token>` header.

### Authentication

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | None | `{ username, email, password }` | `UserOut` |
| POST | `/auth/login` | None | `{ identifier, password, remember_me }` | `{ access_token, token_type }` — token valid 30 days if `remember_me: true`, 60 min otherwise |
| POST | `/auth/login/password` | None | form-data: `username`, `password` | `{ access_token, token_type }` — legacy form endpoint (Swagger UI) |
| POST | `/auth/change-password` | Required | `{ old_password, new_password }` | `{ message }` |

### Users

| Method | Path | Response |
|---|---|---|
| GET | `/users/me` | `UserOut` |
| DELETE | `/users/me` | `{ message }` (requires `{ password }` in body) |

### Accounts

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/accounts` | — | `AccountOut[]` |
| POST | `/accounts` | `{ name, type, provider }` | `AccountOut` |
| PUT | `/accounts/{id}` | `AccountUpdate` | `AccountOut` |
| DELETE | `/accounts/{id}` | — | `{ message }` |

### Categories

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/categories` | — | `CategoryOut[]` |
| POST | `/categories` | `{ name, is_income, icon_name? }` | `CategoryOut` |
| PUT | `/categories/{id}` | `CategoryUpdate` | `CategoryOut` |
| DELETE | `/categories/{id}` | — | `{ message }` |

### Transactions

| Method | Path | Params / Body | Response |
|---|---|---|---|
| GET | `/transactions` | `page`, `limit`, `account_id?`, `category_id?`, `start_date?`, `end_date?`, `type?`, `search_term?` | `{ total_count, transactions: TransactionOut[] }` |
| POST | `/transactions` | `TransactionCreate` | `TransactionOut` |
| GET | `/transactions/{id}` | — | `TransactionOut` |
| PUT | `/transactions/{id}` | `TransactionUpdate` | `TransactionOut` |
| DELETE | `/transactions/{id}` | — | `{ message }` |

### Transaction Tags

| Method | Path | Body / Params | Response |
|---|---|---|---|
| POST | `/transaction-tags` | `{ transaction_id, tag_id }` | `TransactionTagOut` |
| DELETE | `/transaction-tags` | query: `transaction_id`, `tag_id` | `{ message }` |
| GET | `/transaction-tags/{transaction_id}` | — | `TagOut[]` |

### Tags

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/tags` | — | `TagOut[]` |
| POST | `/tags` | `{ name }` | `TagOut` |
| PUT | `/tags/{id}` | `{ name }` | `TagOut` |
| DELETE | `/tags/{id}` | — | `{ message }` |

### Merchants

| Method | Path | Body / Params | Response |
|---|---|---|---|
| GET | `/merchants` | `q?` (case-insensitive name search) | `MerchantOut[]` |
| POST | `/merchants` | `{ name, category_id? }` | `MerchantOut` |
| PUT | `/merchants/{id}` | `MerchantUpdate` | `MerchantOut` — renaming/recategorising never touches transactions already linked to the merchant, only affects future matches |
| DELETE | `/merchants/{id}` | — | `{ message }` |
| GET | `/merchants/unmapped-count` | — | `{ count }` — transactions with `merchant_id IS NULL`; backs the notification-bell badge and the Merchants page's "N unmapped" indicator |
| GET | `/merchants/clusters` | — | `MerchantClusterOut[]` — groups *currently-unmapped* transactions (no merchant at all) by shared UPI handle, for the cold-start bulk-naming banner |
| POST | `/merchants/rescan` | — | `{ auto_applied, suggested }` — sweeps unmapped transactions against existing merchants using the same algorithm as upload time (exact UPI-handle match auto-applies; fuzzy match raises a `new_merchant` alert instead) |

Matching (`app/services/merchant_matching_service.py`) is 100% local -- no LLM calls anywhere in this feature, since raw transaction descriptions are financial PII and a rescan sweeps the whole backlog unreviewed. Exact `name@bank` VPA handle match is high-confidence and auto-applies; otherwise RapidFuzz similarity against the merchant's known description strings (threshold calibrated against real production data) is medium-confidence and only raises a suggestion. The old hardcoded `MERCHANT_CATEGORY_RULES` dict in `upload_service.py` was retired via `alembic/versions/0003_seed_merchants_from_rules.py`, which both seeded real `Merchant` rows and backfilled matching pre-existing unmapped transactions so the new fingerprint-based matcher starts with real history to compare against.

### Goals (Monthly Budget Limits)

| Method | Path | Params / Body | Response |
|---|---|---|---|
| GET | `/goals` | `month?` (YYYY-MM), `skip?`, `limit?` | `GoalOut[]` |
| POST | `/goals` | `{ category_id, month, limit_amount }` | `GoalOut` |
| GET | `/goals/{id}` | — | `GoalOut` |
| PUT | `/goals/{id}` | `GoalUpdate` | `GoalOut` |
| DELETE | `/goals/{id}` | — | `{ message }` |

### Alerts

| Method | Path | Response |
|---|---|---|
| GET | `/alerts` | `AlertOut[]` |
| GET | `/alerts/unread` | `AlertOut[]` |
| PUT | `/alerts/{id}/acknowledge` | `AlertOut` |

### Budget Plans

| Method | Path | Params / Body | Response |
|---|---|---|---|
| GET | `/budgets/plan` | `month` (YYYY-MM) | `BudgetPageData` |
| POST | `/budgets/plan` | `{ month, budgets: [{ category_id, limit_amount }] }` | `{ message }` |
| DELETE | `/budgets/plan` | query: `month` | `{ message }` |

### Dashboard

| Method | Path | Params | Response |
|---|---|---|---|
| GET | `/dashboard` | `month` (YYYY-MM) | `DashboardData` |

### Analytics

| Method | Path | Params | Response |
|---|---|---|---|
| GET | `/analytics` | `time_period` (`3m`\|`6m`\|`1y`\|`all`\|`YYYY-MM`), `include_capital_transfers` (bool) | `AnalyticsData` |

### Upload

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/settings/upload-statements` | `multipart/form-data`: `files[]` (CSV, XLSX, XLS, or PDF; max 10 files, 10 MB each) | `{ message }` — count of transactions found and inserted |

---

## 9. Authentication Flow

### Registration

```
1. User fills Register form (username, email, password, confirm password)
2. Frontend validates password strength before submitting
3. POST /auth/register → backend hashes password with bcrypt → inserts user row
4. Response: UserOut (no token — user must log in after registering)
5. Frontend navigates to /login
```

### Login

```
1. User submits email/username + password (+ optional Remember Me checkbox)
2. POST /auth/login (JSON body: { identifier, password, remember_me })
3. Backend:
   a. Looks up user by email or username
   b. Verifies password with bcrypt
   c. If remember_me = true  → JWT exp: now + 30 days
      If remember_me = false → JWT exp: now + 60 minutes
   d. Returns { access_token, token_type: "bearer" }
4. Frontend:
   If remember_me = true  → stores token in localStorage  (survives tab/browser close)
   If remember_me = false → stores token in sessionStorage (cleared when tab closes)
5. Navigates to /dashboard
```

### Authenticated Requests

```
Every API call:
  → Axios request interceptor calls getToken()
      → checks localStorage first, then sessionStorage
      → adds header: Authorization: Bearer <token>
  → Backend: FastAPI dependency get_current_active_user()
      → Decodes JWT with SECRET_KEY (HS256)
      → Extracts email from 'sub' claim
      → Loads user from DB
      → Returns user object to route handler
      → If token invalid/expired → HTTP 401
  → Axios response interceptor catches 401
      → Shows toast "Your session has expired"
      → Calls clearToken() — wipes both localStorage and sessionStorage
      → Redirects to /login
```

### Change Password (Logged In)

```
1. User goes to Profile page → Change Password section
2. Enters current password, new password, confirm new password
3. POST /auth/change-password  (requires Bearer token)
4. Backend verifies old password with bcrypt
5. If correct → hashes new password → updates hashed_password in DB
6. Returns { message: "Password updated successfully" }
7. User can now log in with the new password
```

### Session Timer (Navbar)

The Navbar decodes the JWT in storage client-side to read the `exp` claim, then runs a `setInterval` every second to display a countdown. For Remember Me sessions (7-day token), this will show a large remaining time. When the timer hits zero, the next API call will receive a 401 and the interceptor handles logout.

---

## 10. Key Business Logic

### Smart Categorisation (CSV Import & Manual Entry)

When a transaction description is provided, the system attempts to auto-assign a category using this pipeline:

```
Step 1 — Explicit notation
  Does description contain "/CategoryName"?
  → Yes: parse the category name directly
  → No: continue

Step 2 — Fuzzy match against existing categories
  Uses RapidFuzz with 85% similarity threshold
  Includes common aliases: "misc" → "Miscellaneous", "ent" → "Entertainment"
  → Match found: use that category
  → No match: continue

Step 3 — Merchant matching (local only, no LLM -- see app/services/merchant_matching_service.py)
  Exact UPI-handle match against an existing merchant's known handles
  → Match: auto-apply that merchant + its category (high confidence)
  → No handle match: fuzzy similarity against the merchant's known
    description strings (RapidFuzz, threshold calibrated against real
    production data)
    → Above threshold: raise a 'new_merchant' suggestion alert instead of
      auto-applying (medium confidence -- needs a human accept/dismiss);
      category stays unset until then
    → No match: continue

Step 4 — Default
  Assign "Miscellaneous" category
  Create a "new_category" alert to notify the user
```

### Budget Alert System

Triggered every time a debit transaction is created or updated.

```
For each goal (budget limit) the user has for this category + month:
  Calculate total_spend = SUM of all debit transactions in that category/month
    (excluding transactions tagged "Exclude from Analytics")

  Check thresholds in order: 100% → 90% → 75%
  For each threshold crossed:
    Check if an unacknowledged alert already exists for this goal + threshold
    If not → create a new Alert record

  User sees alerts via the bell icon in the Navbar
```

### Statement Import (CSV / Excel / PDF)

Parsing (`app/services/parsing/`) and persistence (`upload_service.py`) are separate layers — see the "`app/services/parsing/` — Statement Parsing Package" subsection under [Backend Deep Dive](#5-backend-deep-dive) for the package breakdown.

```
1. Read the file into one or more grids (rows of cells):
   - CSV/Excel → read directly with Pandas (one grid per sheet)
   - PDF → extract words with pdfplumber, cluster into lines by y-position,
     group multi-line transaction blocks, bucket words into columns by
     x-position → reconstructed into the same grid shape as a CSV/Excel read

2. Detect the bank + header row for each grid:
   - Try the filename first (e.g. "icici_july.csv"), else scan the first
     rows for a header whose columns match a bank's signature_columns
   - Column names are matched by alias + word-tokens (case/spacing/"(INR)"
     tolerant), not exact string equality — see BankConfig in configs.py

3. For each detected row:
   a. Build unique_key = "{source}-{ref}-{date}-{amount}"
   b. Check if unique_key already exists for this user → skip if duplicate
   c. Detect merchant via fuzzy name matching against user's merchant list
   d. Run smart categorisation pipeline (see above)
   e. Insert transaction

4. If a grid's header can't be matched to any configured bank, the upload
   fails loudly: the error names the shapes/columns of the unmatched
   table(s) found, so a bank's renamed column is diagnosable without
   needing the raw file — see parse_statement() in parsing/__init__.py

5. Return summary: { message: "... Found N potential transactions and
   inserted M new records." }
```

### Analytics Time Periods

The analytics endpoint supports these `time_period` values:

| Value | Meaning |
|---|---|
| `3m` | Last 3 months of data |
| `6m` | Last 6 months of data |
| `1y` | Last 12 months of data |
| `all` | All historical data |
| `YYYY-MM` | Single specific month |

`include_capital_transfers=true/false` toggles whether transactions tagged "Capital Transfer" are included in the calculations.

---

## 11. Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL running locally (or use the Supabase connection string)
- Git

### Step 1 — Clone the repo

```bash
git clone <repo-url>
cd prem-expense-tracker
```

### Step 2 — Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Set up the `.env` file in `backend/`:

```env
# Option A: Local PostgreSQL
DATABASE_URL=postgresql+psycopg2://postgres:<your-password>@localhost:5432/personal_finance

# Option B: Use Supabase directly (same DB as production — be careful)
DATABASE_URL=postgresql+psycopg2://postgres:<supabase-password>@<supabase-host>:5432/postgres

SECRET_KEY="any-random-string-for-local-dev"
```

Create the database (if using local PostgreSQL):

```bash
# In psql or pgAdmin, run:
CREATE DATABASE personal_finance;
```

The app uses SQLAlchemy to auto-create tables on first run.

Start the backend:

```bash
# From the backend/ directory
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

**Testing the statement parser:** the parsing package has a standalone self-check covering CSV/Excel/PDF layouts, alias matching, and dedup keys — no DB or running server needed:

```bash
# From the backend/ directory, with the venv active
python tests/test_parsing.py
```

### Step 3 — Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will open at `http://localhost:5173`. All `/api` requests are automatically proxied to `http://localhost:8000` via the Vite config — no manual URL switching needed.

### Switching Between Local and Production Database

- To work against a **fresh local database** → use `DATABASE_URL` pointing to local PostgreSQL
- To work against **production data** → change `DATABASE_URL` in `backend/.env` to the Supabase connection string (use caution — real user data)
- The frontend always uses `http://localhost:8000/api/v1` in local dev (falls back in apiClient.ts if `VITE_API_BASE_URL` is not set)

---

## 12. Deployment

### Frontend — Vercel

The React app is deployed to Vercel as a static Single Page Application.

**How it works:**
- Vercel serves the built `dist/` folder
- `vercel.json` contains a rewrite rule: all URL paths → `index.html` (required for client-side routing)
- The frontend calls the backend via the full Render URL set in `VITE_API_BASE_URL`

**Environment variable to set on Vercel:**
```
VITE_API_BASE_URL = https://<your-render-service>.onrender.com/api/v1
```

**Deploy steps:**
1. Push to connected GitHub branch
2. Vercel auto-builds with `npm run build`
3. Serves the `dist/` output

---

### Backend — Render

The FastAPI app runs in a Docker container on Render.

**`Dockerfile.backend`:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend .
EXPOSE 80
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
```

**Environment variables to set on Render dashboard:**
```
DATABASE_URL = postgresql+psycopg2://postgres:<password>@<supabase-host>:5432/postgres
SECRET_KEY   = <strong-random-secret>
```

**Important:** Render injects these as real environment variables. The `load_dotenv(".env")` call in `main.py` is ignored in production (the `.env` file isn't included in the Docker image due to `.dockerignore`).

**If you add a new environment variable to the backend**, you must:
1. Add it to `app/core/config.py` → `Settings` class
2. Set it in the Render dashboard

---

### Database — Supabase

Supabase hosts the PostgreSQL instance. No special setup — the app connects to it like any PostgreSQL database.

**Note:** The application does not use Supabase's own SDK, auth, or real-time features. It uses Supabase purely as a managed PostgreSQL host.

**Table creation:** SQLAlchemy creates tables automatically from the ORM models. If you add a new model, the tables are created on next startup. For production schema changes, use Alembic migrations (already in `requirements.txt`).

---

### Adding a New Frontend URL (e.g. Staging)

If you deploy a second frontend (staging, preview, etc.), you must add its URL to the CORS allowlist in `backend/app/main.py`:

```python
origins = [
    "https://prem-expense-tracker.vercel.app",
    "https://your-staging-url.vercel.app",   ← add here
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```

Then redeploy the backend.

---

## 13. Environment Variables Reference

### Backend

| Variable | Required | Example | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql+psycopg2://user:pass@host:5432/dbname` | Read by `app/db/session.py` via `os.getenv()` and also by `app/core/config.py` via pydantic-settings. **No hardcoded fallback** — the app refuses to start without it |
| `SECRET_KEY` | Yes | `<run: python -c "import secrets; print(secrets.token_urlsafe(64))">` | Used to sign JWT tokens. Must be a long random string; use a different value in production than in dev |

### Frontend

| Variable | Required | Default | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | No | `http://localhost:8000/api/v1` | Set on Vercel to point to the Render backend URL. If not set, falls back to localhost (local dev) |

> **Security note:** The `SECRET_KEY` in `backend/.env` is for local development only. The production `SECRET_KEY` should be a strong random string set directly on Render — never commit production secrets to git.

---

## 14. Password Management

### Option A — Change Password While Logged In (Preferred)

If you know your current password, go to **Profile page → Change Password section**.

1. Enter your **current password**
2. Enter and confirm your **new password** (must meet strength requirements)
3. Click **Update Password**

The change takes effect immediately. Your existing session stays active.

---

### Option B — Reset Forgotten Password via Supabase (Admin Reset)

Use this when you cannot log in because you've forgotten your password. This requires access to the Supabase dashboard.

**Step 1 — Generate a new bcrypt hash**

Run this in your terminal (with the backend venv activated):

```bash
cd backend
venv\Scripts\activate
python -c "from passlib.context import CryptContext; ctx = CryptContext(schemes=['bcrypt'], deprecated='auto'); print(ctx.hash('YourNewPassword123!'))"
```

Replace `YourNewPassword123!` with your chosen new password. Copy the output hash (starts with `$2b$12$...`).

**Step 2 — Update the password in Supabase**

1. Go to [supabase.com](https://supabase.com) → your project
2. Left sidebar → **SQL Editor** → New Query
3. Run:

```sql
UPDATE users
SET hashed_password = '$2b$12$<paste-your-hash-here>'
WHERE id = <your-user-id>;
```

To find your user ID first:
```sql
SELECT id, username, email FROM users;
```

**Step 3 — Verify and log in**

```sql
SELECT id, username, email FROM users WHERE id = <your-user-id>;
```

Confirm the hash updated, then log in with your new password. Once logged in, you can change it again from Profile if needed.

---

### Password Requirements

All passwords (registration and change) must meet:

| Rule | Requirement |
|---|---|
| Length | At least 8 characters |
| Uppercase | At least one uppercase letter (A–Z) |
| Lowercase | At least one lowercase letter (a–z) |
| Number | At least one digit (0–9) |
| Special character | At least one special character (!@#$%^&* etc.) |

---

## 15. Converting This Document to Word (.docx)

### Option A — Using Pandoc (Recommended, one-time install)

**Install Pandoc (one time):**

```bash
winget install pandoc
```

Or download the installer from [pandoc.org/installing.html](https://pandoc.org/installing.html) → Windows → .msi installer.

**Convert:**

```bash
cd "c:\Prem-1\Personal Finance Tracker-Project\Post Prod\prem-expense-tracker"
pandoc DOCUMENTATION.md -o DOCUMENTATION.docx
```

For a styled output with a reference template:

```bash
pandoc DOCUMENTATION.md -o DOCUMENTATION.docx --reference-doc=custom-reference.docx
```

---

### Option B — Using Python (No extra install needed)

If you already have the backend venv set up, run:

```bash
cd "c:\Prem-1\Personal Finance Tracker-Project\Post Prod\prem-expense-tracker\backend"
venv\Scripts\activate
pip install python-docx
```

Then run the generator script (regenerate `generate_doc.py` based on the current `DOCUMENTATION.md` and execute it). This produces a styled Word document with coloured headings, tables, and code blocks.

---

### Option C — Online (No install)

1. Go to [cloudconvert.com/md-to-docx](https://cloudconvert.com/md-to-docx)
2. Upload `DOCUMENTATION.md`
3. Download the converted `.docx`

Note: avoid uploading if the document contains sensitive details (connection strings, secret keys).
