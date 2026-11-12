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

## Database Architecture & Entity Relationships

The database is built on **PostgreSQL 16** and mapped with **SQLAlchemy 2.0** typed declarative models. Monetary amounts are strictly stored as `NUMERIC(12, 2)` (`Decimal` in Python), completely prohibiting floating-point representations.

### Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ GROUP_MEMBERS : "belongs to"
    GROUPS ||--o{ GROUP_MEMBERS : "contains"
    GROUPS ||--o{ EXPENSES : "hosts"
    USERS ||--o{ EXPENSES : "pays"
    EXPENSES ||--o{ EXPENSE_SHARES : "divided into"
    USERS ||--o{ EXPENSE_SHARES : "allocated"

    USERS {
        int id PK "autoincrement"
        string username UK "unique, indexed, not null"
        datetime created_at "timestamptz, default now()"
    }

    GROUPS {
        int id PK "autoincrement (1: Chiang Mai trip, 2: Office lunch)"
        string name "not null"
        datetime created_at "timestamptz, default now()"
    }

    GROUP_MEMBERS {
        int id PK "autoincrement"
        int group_id FK "CASCADE"
        int user_id FK "CASCADE"
        datetime joined_at "timestamptz, default now()"
    }

    EXPENSES {
        int id PK "autoincrement"
        int group_id FK "CASCADE"
        int paid_by FK "RESTRICT"
        string description "not null"
        numeric amount "NUMERIC(12,2), CK > 0"
        string idempotency_key "nullable, UK per group"
        boolean is_deleted "default false, not null"
        datetime deleted_at "nullable, timestamptz"
        datetime created_at "timestamptz, default now()"
    }

    EXPENSE_SHARES {
        int id PK "autoincrement"
        int expense_id FK "CASCADE"
        int user_id FK "RESTRICT"
        numeric amount "NUMERIC(12,2), CK >= 0"
        datetime created_at "timestamptz, default now()"
    }
```

### Table Specifications & Constraints

1. **`users`**:
   - `id`: `Integer`, Primary Key, autoincrement.
   - `username`: `VARCHAR(50)`, unique (`ix_users_username`), non-null.
   - `created_at`: `TIMESTAMPTZ`, default `now()`, non-null.

2. **`groups`**:
   - `id`: `Integer`, Primary Key, autoincrement. Preserves ID 1 (`"Chiang Mai trip"`) and ID 2 (`"Office lunch"`).
   - `name`: `VARCHAR(100)`, non-null.
   - `created_at`: `TIMESTAMPTZ`, default `now()`, non-null.

3. **`group_members`**:
   - `id`: `Integer`, Primary Key, autoincrement.
   - `group_id`: `Integer`, Foreign Key to `groups.id` (`ON DELETE CASCADE`), non-null, indexed.
   - `user_id`: `Integer`, Foreign Key to `users.id` (`ON DELETE CASCADE`), non-null, indexed.
   - `joined_at`: `TIMESTAMPTZ`, default `now()`, non-null.
   - **Constraint**: `uq_group_members_group_user` composite unique constraint on `(group_id, user_id)`.

4. **`expenses`**:
   - `id`: `Integer`, Primary Key, autoincrement.
   - `group_id`: `Integer`, Foreign Key to `groups.id` (`ON DELETE CASCADE`), non-null, indexed.
   - `paid_by`: `Integer`, Foreign Key to `users.id` (`ON DELETE RESTRICT`), non-null, indexed.
   - `description`: `VARCHAR(255)`, non-null.
   - `amount`: `NUMERIC(12, 2)`, non-null. Check constraint `ck_expenses_amount_positive` enforces `amount > 0`.
   - `idempotency_key`: `VARCHAR(128)`, nullable. Composite unique constraint `uq_expenses_group_idempotency_key` enforces unique keys per `group_id` while allowing null keys.
   - `is_deleted`: `Boolean`, non-null, default `false`. Supports soft deletion without removing auditing history.
   - `deleted_at`: `TIMESTAMPTZ`, nullable.
   - `created_at`: `TIMESTAMPTZ`, default `now()`, non-null.
   - **Indexes**: `ix_expenses_group_created_at_desc` on `(group_id, created_at DESC, id DESC)` for fast reverse-chronological retrieval.

5. **`expense_shares`**:
   - `id`: `Integer`, Primary Key, autoincrement.
   - `expense_id`: `Integer`, Foreign Key to `expenses.id` (`ON DELETE CASCADE`), non-null, indexed.
   - `user_id`: `Integer`, Foreign Key to `users.id` (`ON DELETE RESTRICT`), non-null, indexed.
   - `amount`: `NUMERIC(12, 2)`, non-null. Check constraint `ck_expense_shares_amount_non_negative` enforces `amount >= 0`.
   - `created_at`: `TIMESTAMPTZ`, default `now()`, non-null.
   - **Constraint**: `uq_expense_shares_expense_user` enforces that each user may have at most one share per expense.

---

## Database Migrations (Alembic)

Run Alembic commands from the `backend/` directory or via root npm scripts:

```bash
cd backend

# Check current migration revision
uv run alembic current

# Apply all pending migrations to head
uv run alembic upgrade head

# Roll back one migration step
uv run alembic downgrade -1

# Generate a new migration after updating SQLAlchemy models
uv run alembic revision --autogenerate -m "describe schema change"
```

---

## Seed Data & Seeding Script

The seed script (`backend/app/db/seed.py`) populates mandatory initial users, groups, and memberships:

- **Users**: `alice`, `bob`, `carol`, `dan`
- **Groups & Memberships**:
  - **Group 1**: `"Chiang Mai trip"` (Members: `alice`, `bob`, `carol`)
  - **Group 2**: `"Office lunch"` (Members: `bob`, `dan`)

Key properties:

- **Idempotent**: Can be run repeatedly without duplicating records or generating unique constraint errors.
- **Explicit ID Preservation**: Enforces Group IDs `1` and `2`, and automatically synchronizes PostgreSQL identity sequence counters (`setval`) so subsequent autoincrement inserts do not collide.

Execute the seed script from the repository root:

```bash
npm run seed
```

Or directly in `backend/`:

```bash
uv run python -m app.db.seed
```

---

## Database Testing & Test Isolation

All database-focused tests execute against an **isolated test database** (`splitbill_test`) to prevent any mutation or data loss in the development database (`splitbill`).

### Test Architecture

- **Automatic Provisioning**: `backend/tests/conftest.py` ensures the `splitbill_test` database exists and runs Alembic migrations (`upgrade head`) before the test suite executes.
- **Transactional Rollback & Savepoints**: Each test runs within a transaction that is rolled back upon test completion. Expected constraint violations (`IntegrityError`) are wrapped in SQLAlchemy savepoints (`with db_session.begin_nested():`) so transaction blocks are not aborted by PostgreSQL.
- **Coverage**:
  1. Required tables, primary keys, foreign keys, unique constraints, and check constraints.
  2. Seed data correctness (users, groups, memberships, multi-group membership).
  3. Seed script idempotency (zero duplicates on multiple executions).
  4. Unique username constraint.
  5. Unique group membership constraint (`uq_group_members_group_user`).
  6. Idempotency key uniqueness within a group, cross-group reuse, and multiple null keys.
  7. Exact `NUMERIC(12, 2)` monetary precision, no float rounding, and check constraints (`amount > 0` on expenses, `amount >= 0` on shares).
  8. Expense share uniqueness (`uq_expense_shares_expense_user`).
  9. Foreign key integrity and cascade deletion.
  10. Soft-delete persistence and audit preservation.

Run tests:

```bash
npm run test
# or directly:
cd backend && uv run pytest
```

---

## Documented Assumptions & Design Decisions

### Database Constraints vs. Service-Layer Responsibilities

| Rule / Concern                 | Database Layer Enforcement                                                | Service Layer / Transaction Responsibility                                                                                                          |
| :----------------------------- | :------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Monetary Precision**         | `NUMERIC(12, 2)` rejects floats and truncates or rejects invalid numbers. | Validates string input format (`100.00`) and max 2 decimal places before query execution.                                                           |
| **Positive Expense Amount**    | `ck_expenses_amount_positive` (`amount > 0`).                             | Rejects requests with descriptive error message before database insert.                                                                             |
| **Non-Negative Share Amount**  | `ck_expense_shares_amount_non_negative` (`amount >= 0`).                  | Rejects negative share requests before database insert.                                                                                             |
| **Duplicate Share per Member** | `uq_expense_shares_expense_user` (`expense_id, user_id`).                 | Validates split member list uniqueness in Pydantic schema.                                                                                          |
| **Idempotency Key Scope**      | `uq_expenses_group_idempotency_key` (`group_id, idempotency_key`).        | Catches concurrent insert conflict (`IntegrityError`), replays existing expense on identical payload, or returns `409 Conflict` on mutated payload. |
| **Soft Delete**                | `is_deleted` column default `false`; `deleted_at` timestamp.              | Restricts deletion to payer (`X-User == expense.paid_by`); filters out deleted expenses from listings and balance calculations.                     |
| **Payer Membership**           | FK `paid_by` references `users.id`.                                       | Verifies `paid_by` is an active member of `group_id` (`GroupMember`).                                                                               |
| **Split Member Membership**    | FK `user_id` references `users.id`.                                       | Verifies every member in `split.members` belongs to `group_id`.                                                                                     |
| **Exact Share Totals**         | Stored as individual numeric shares.                                      | Verifies `sum(shares) == expense.amount` to the satang (`0.01`).                                                                                    |
| **Satang Allocation**          | Stored as exact `NUMERIC(12, 2)` values.                                  | Computes equal division remainder and allocates `0.01` sequentially to members in `split.members`.                                                  |
| **Zero-Sum Balances**          | Stores raw transaction shares.                                            | Aggregates credits and debits ensuring `sum(balances) == 0.00`.                                                                                     |

### Key Architectural Decisions

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
   - Deleting an expense sets `is_deleted = true` and `deleted_at = now()`. Soft-deleted expenses remain stored in PostgreSQL for auditability and idempotency history, but are excluded from `GET /groups/{group_id}/expenses` and `GET /groups/{group_id}/balances`.

---

## Current Implementation Status

- [x] **Phase 1**: Monorepo initialization, requirements analysis (`docs/implementation-plan.md`), PostgreSQL 16 Docker Compose setup, FastAPI skeleton with `/health`, SQLAlchemy 2.0 + Alembic wiring, Next.js TypeScript + Tailwind CSS initialization, and Husky + `lint-staged` + Ruff + ESLint + Prettier pre-commit automation.
- [x] **Phase 2**: Database schema models (`users`, `groups`, `group_members`, `expenses`, `expense_shares`), Alembic migrations, idempotent seed data (`alice`, `bob`, `carol`, `dan`; Groups 1 & 2), and isolated test suite covering all 10 schema integrity areas.
- [ ] **Phase 3**: Backend domain services, REST API endpoints, and mandatory `pytest` suite.
- [ ] **Phase 4**: Next.js shared-expense interface, live satang split preview, and API integration.
