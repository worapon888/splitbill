# SplitBill — Shared Expense Manager

SplitBill is a full-stack application for recording shared group expenses and calculating net member balances accurate to the satang (`0.01 THB`).

---

## Technology Stack

- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, `pytest`, Ruff
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, ESLint 9
- **Database**: PostgreSQL 16 (via Docker Compose)
- **Code Quality & Git Hooks**: Husky v9, `lint-staged`, Prettier, ESLint, Ruff

---

## Project Structure

```text
splitbill/
├── .husky/
│   └── pre-commit
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers & endpoint handlers
│   │   ├── core/           # Environment configuration & settings
│   │   ├── db/             # SQLAlchemy engine, SessionLocal & Base
│   │   ├── models/         # SQLAlchemy 2.0 ORM models
│   │   ├── schemas/        # Pydantic v2 request/response schemas
│   │   ├── repositories/   # Database persistence layer
│   │   ├── services/       # Domain business logic
│   │   └── main.py         # FastAPI application factory & entry point
│   ├── alembic/            # Alembic migration environment & versions
│   ├── tests/              # pytest test suite
│   ├── alembic.ini
│   ├── pyproject.toml
│   └── .env.example
├── frontend/
│   ├── src/
│   │   └── app/            # Next.js App Router pages & styles
│   ├── eslint.config.mjs
│   ├── next.config.mjs
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── tsconfig.json
│   └── .env.example
├── docs/
│   └── implementation-plan.md
├── docker-compose.yml
├── package.json            # Monorepo quality scripts, Husky & lint-staged
├── .prettierrc.json
├── .gitignore
├── README.md
└── AI_NOTES.md
```

---

## Prerequisites

- **Docker Desktop** (with Docker Compose v2)
- **Python 3.12+** and **[uv](https://docs.astral.sh/uv/)** (or standard `venv` + `pip`)
- **Node.js 20+** and **npm 10+**
- **Git**

---

## Local Installation & Environment Configuration

### 1. Clone and Install Root Quality Tooling

```bash
cd splitbill
npm install
```

### 2. Configure Environment Variables

Copy the example environment files at the repository root, backend, and frontend:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Default local development variables (`backend/.env`):

```env
APP_NAME=SplitBill API
APP_ENV=development
DEBUG=true
POSTGRES_USER=splitbill
POSTGRES_PASSWORD=splitbill_dev_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=splitbill
DATABASE_URL=postgresql+psycopg://splitbill:splitbill_dev_password@localhost:5432/splitbill
CORS_ORIGINS=["http://localhost:3000"]
```

### 3. Start PostgreSQL 16

```bash
docker compose up -d
docker compose ps
```

Wait until `splitbill-postgres` reports status `healthy`.

### 4. Backend Setup & Startup

```bash
cd backend
uv sync --python 3.12
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify the health endpoint:

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"SplitBill API","database":"connected"}
```

### 5. Frontend Setup & Startup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see `"SplitBill — Shared Expense Manager"`.

---

## Database Migrations (Alembic)

Run Alembic commands from the `backend/` directory:

```bash
cd backend

# Check current migration revision
uv run alembic current

# Apply all pending migrations
uv run alembic upgrade head

# Generate a new migration after updating SQLAlchemy models
uv run alembic revision --autogenerate -m "describe schema change"

# Roll back one migration step
uv run alembic downgrade -1
```

---

## Running Tests, Linting & Formatting

### Monorepo Root Commands

From the repository root (`splitbill/`):

| Command                | Description                                                                |
| :--------------------- | :------------------------------------------------------------------------- |
| `npm run lint`         | Run Ruff linter on `backend/` and ESLint on `frontend/`                    |
| `npm run format`       | Auto-format Python files with Ruff and TS/JSON/MD/YAML files with Prettier |
| `npm run format:check` | Check formatting across backend (Ruff) and frontend/docs (Prettier)        |
| `npm run typecheck`    | Run TypeScript compiler check (`tsc --noEmit`) on `frontend/`              |
| `npm run test`         | Run backend `pytest` suite                                                 |

### Direct Backend Commands

```bash
cd backend
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

### Direct Frontend Commands

```bash
cd frontend
npm run lint
npm run typecheck
```

---

## Git Hooks & Pre-Commit Workflow

This repository uses **Husky** and **lint-staged** to enforce code quality automatically on `git commit`:

1. **Staged Python files (`backend/**/*.py`)**:
   - Runs `ruff check --fix`
   - Runs `ruff format`
   - Re-verifies with `ruff check` and `ruff format --check`
2. **Staged Frontend files (`frontend/**/*.{ts,tsx,js,jsx,mjs}`)**:
   - Runs `eslint --fix`
   - Runs `prettier --write`
3. **Staged Config & Documentation files (`*.{json,yaml,yml,md}`, `docs/**/*.md`, `frontend/**/*.json`)**:
   - Runs `prettier --write`

Key behaviors:

- Only **staged files** are processed (`lint-staged` stashes unstaged changes automatically).
- Automatic formatting/lint fixes are re-staged and included in the commit.
- If any lint error cannot be auto-fixed, the commit is aborted with a non-zero exit code.
- The full test suite is intentionally excluded from `pre-commit` to keep commits fast; run `npm run test` explicitly before pushing.

---

## Documented Assumptions & Design Decisions

To resolve ambiguities in the project brief, the following decisions have been adopted and documented in `docs/implementation-plan.md`:

1. **`403 Forbidden` vs `404 Not Found` for Group Access Control**:
   - When an authenticated user (`X-User`) attempts to read or modify an existing group they do not belong to (e.g., `alice` requesting Group `2`), the API returns **`403 Forbidden`** with detail `"Not a member of this group"`.
   - _Rationale_: In Part 2 (Frontend Requirement #4), the specification explicitly lists `"Not a member of this group"` as an example plain-language API error. Returning `403 Forbidden` cleanly distinguishes membership denial from a non-existent group ID (`404 Not Found`).
2. **`X-User` vs `paid_by` on Expense Creation**:
   - Any member of a group (`X-User`) may record an expense paid by any member of that same group (`paid_by`), supporting the frontend's payer selection input. Deletion (`DELETE /groups/{group_id}/expenses/{expense_id}`), however, is strictly restricted to the payer (`X-User == expense.paid_by`).
3. **Monetary Storage & Satang Allocation**:
   - Monetary values are represented as `NUMERIC(12, 2)` in PostgreSQL, `Decimal` in Python, and integer satang in TypeScript. `float` is never used.
   - Equal splits divide total satang using integer floor division (`total_satang // n`) and distribute the remainder (`total_satang % n`) one satang (`0.01`) at a time to members in the exact order listed in `split.members`.
4. **Idempotency Scope & Concurrency**:
   - `Idempotency-Key` is scoped per `(group_id, idempotency_key)` with a database-level unique constraint to guarantee safety under concurrent requests. Replaying the same key with the same payload returns the original expense; reusing the same key with a different payload returns `409 Conflict`.
5. **Soft Delete Behavior**:
   - Deleting an expense sets `deleted_at` (soft delete). Soft-deleted expenses remain stored in PostgreSQL for auditability and idempotency history, but are excluded from `GET /groups/{group_id}/expenses` and `GET /groups/{group_id}/balances`.

---

## Current Implementation Status

- [x] **Phase 1**: Monorepo initialization, requirements analysis (`docs/implementation-plan.md`), PostgreSQL 16 Docker Compose setup, FastAPI skeleton with `/health`, SQLAlchemy 2.0 + Alembic wiring, Next.js TypeScript + Tailwind CSS initialization, and Husky + `lint-staged` + Ruff + ESLint + Prettier pre-commit automation.
- [ ] **Phase 2**: Database schema models (`users`, `groups`, `group_members`, `expenses`, `expense_shares`), Alembic migrations, and seed data (`alice`, `bob`, `carol`, `dan`; Groups 1 & 2).
- [ ] **Phase 3**: Backend domain services, REST API endpoints, and mandatory `pytest` suite.
- [ ] **Phase 4**: Next.js shared-expense interface, live satang split preview, and API integration.
