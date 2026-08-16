# Expense-tracker

ExpenseTracker is a full-stack personal finance dashboard built to provide clear, actionable insights into your spending habits. It offers powerful tools for automated data import, in-depth analysis, and proactive budget management.

## Core Features

Visualize Your Finances: The application features a dynamic dashboard for monthly overviews and an advanced analytics page with tools like a Spending Velocity Chart (comparing current vs. historical spending).

Automate Your Workflow: Drastically reduce manual entry by uploading .csv bank statements. The system intelligently parses transactions, prevents duplicates, and uses smart categorization rules. Full CRUD functionality for manual transactions is also available.

Intelligent Budgeting & Alerts: Create monthly budgets with ease. If you're starting fresh, the app provides smart suggestions based on your past spending. Receive proactive alerts when you approach your budget limits (75%, 90%, 100%) to stay on track.

Secure & Multi-Tenant: Built from the ground up with security in mind. Features a complete JWT-based authentication system, and all data is strictly scoped to the logged-in user, ensuring your financial information remains private.

Themeable by Design: A token-based design system (light/dark mode, persisted per device) drives every screen from one shared set of colors, type, radii, and shadows.

## Tech Stack & Deployment

This application is deployed across a modern cloud infrastructure, ensuring scalability and performance.

Frontend: Hosted on Vercel

Backend: Hosted on Render

Database: Hosted on Supabase (PostgreSQL)

| Backend                 | Frontend             |
| ----------------------- | -------------------- |
| Python                  | React & TypeScript   |
| FastAPI                 | Vite                 |
| SQLAlchemy (ORM)        | Tailwind CSS         |
| PostgreSQL              | Axios                |
| Pydantic                | Recharts             |
| Passlib & python-jose   | react-router-dom     |
| Pandas                  |                      |

## 📁 Project Structure



The project is a monorepo containing the backend and frontend, organized for clarity and maintainability.

```prem-kapil-expense-tracker/
├── backend/
│   ├── app/
│   │   ├── api/          # API Endpoints (Routers)
│   │   ├── core/         # Security, Dependencies
│   │   ├── crud/         # Database Functions
│   │   ├── models/       # SQLAlchemy DB Models
│   │   ├── schemas/      # Pydantic Validation Schemas
│   │   └── services/     # Business Logic
│   └── main.py           # App Entrypoint
│
├── frontend/
│   └── src/
│       ├── api/          # Central API Client (Axios)
│       ├── auth/         # Login, Register Components
│       ├── components/   # Shared UI (Modals, Navbar)
│       ├── Dashboard/    # Dashboard Feature Module
│       ├── Analytics/    # Analytics Feature Module
│       ├── types/        # TypeScript Definitions
│       ├── App.tsx       # Main Component & Routing
│       └── vite.config.ts # Vite & Proxy Configuration
│
└── README.md
```

## Security 

Password Security: Passwords are never stored in plain text. We use bcrypt for secure, one-way hashing.

Authentication: User sessions are managed with JSON Web Tokens (JWT), which are required for all protected API endpoints.

Data Isolation: All database queries are strictly scoped to the authenticated user, preventing any possibility of cross-user data access.