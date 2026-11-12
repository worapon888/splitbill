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

## REST API Reference

All endpoints (except `/health`) require the `X-User` request header identifying the active participant (`alice`, `bob`, `carol`, or `dan`).

### 1. List Groups

- **Method**: `GET`
- **Path**: `/groups`
- **Headers**: `X-User: <username>`
- **Description**: Returns all groups where the requesting user is an active member.
- **Response**: `200 OK`

```json
[
  {
    "id": 1,
    "name": "Chiang Mai trip"
  }
]
```

### 2. Get Group Details

- **Method**: `GET`
- **Path**: `/groups/{group_id}`
- **Headers**: `X-User: <username>`
- **Description**: Returns group details and member username list.
- **Access Control**:
  - `403 Forbidden` with `{"detail": "Not a member of this group"}` if user does not belong to group.
  - `404 Not Found` with `{"detail": "Group not found"}` if group ID does not exist.
- **Response**: `200 OK`

```json
{
  "id": 1,
  "name": "Chiang Mai trip",
  "members": ["alice", "bob", "carol"]
}
```

### 3. Record an Expense

- **Method**: `POST`
- **Path**: `/groups/{group_id}/expenses`
- **Headers**:
  - `X-User: <username>` (Required)
  - `Idempotency-Key: <key>` (Optional)
- **Description**: Records a new shared expense with satang-accurate share allocation. Supports both `equal` and `exact` split specifications.
- **Status Codes**:
  - `201 Created`: Newly created expense.
  - `200 OK`: Idempotent replay of an existing expense with matching payload.
  - `400 Bad Request`: Invalid payer, invalid participant, or exact shares do not sum to total.
  - `403 Forbidden`: Requesting user is not a member of the group.
  - `409 Conflict`: Reused `Idempotency-Key` with a mutated request payload.
  - `422 Unprocessable Entity`: Invalid monetary string format, $\le 0$, or $> 2$ decimal places.

#### Example Request: Equal Split

```json
{
  "description": "Chiang Mai Dinner",
  "amount": "100.00",
  "paid_by": "alice",
  "split": {
    "type": "equal",
    "members": ["alice", "bob", "carol"]
  }
}
```

#### Example Response: Equal Split (`201 Created`)

```json
{
  "id": 1,
  "group_id": 1,
  "paid_by": "alice",
  "description": "Chiang Mai Dinner",
  "amount": "100.00",
  "created_at": "2026-11-12T08:16:52.753008Z",
  "shares": [
    {
      "username": "alice",
      "amount": "33.34"
    },
    {
      "username": "bob",
      "amount": "33.33"
    },
    {
      "username": "carol",
      "amount": "33.33"
    }
  ]
}
```

#### Example Request: Exact Split

```json
{
  "description": "Office Lunch Catering",
  "amount": "1000.00",
  "paid_by": "bob",
  "split": {
    "type": "exact",
    "shares": {
      "bob": "700.00",
      "dan": "300.00"
    }
  }
}
```

### 4. List Expenses

- **Method**: `GET`
- **Path**: `/groups/{group_id}/expenses`
- **Headers**: `X-User: <username>`
- **Description**: Returns all active expenses for the group in reverse chronological order (`created_at DESC, id DESC`). Soft-deleted expenses are excluded.
- **Response**: `200 OK`

```json
[
  {
    "id": 2,
    "group_id": 1,
    "paid_by": "bob",
    "description": "Taxi to Nimman",
    "amount": "150.00",
    "created_at": "2026-11-12T08:30:00.000000Z",
    "shares": [
      {
        "username": "bob",
        "amount": "75.00"
      },
      {
        "username": "carol",
        "amount": "75.00"
      }
    ]
  },
  {
    "id": 1,
    "group_id": 1,
    "paid_by": "alice",
    "description": "Chiang Mai Dinner",
    "amount": "100.00",
    "created_at": "2026-11-12T08:16:52.753008Z",
    "shares": [
      {
        "username": "alice",
        "amount": "33.34"
      },
      {
        "username": "bob",
        "amount": "33.33"
      },
      {
        "username": "carol",
        "amount": "33.33"
      }
    ]
  }
]
```

### 5. Soft-Delete an Expense

- **Method**: `DELETE`
- **Path**: `/groups/{group_id}/expenses/{expense_id}`
- **Headers**: `X-User: <username>`
- **Description**: Soft-deletes an expense. Restricted strictly to the original payer (`expense.paid_by`).
- **Access Control & Status Codes**:
  - `200 OK`: `{"message": "Expense deleted successfully", "id": 1}`
  - `403 Forbidden`: `{"detail": "Only the payer can delete this expense"}` if caller is not the payer.
  - `404 Not Found`: `{"detail": "Expense not found"}` if already deleted or does not exist.

### 6. Get Group Balances

- **Method**: `GET`
- **Path**: `/groups/{group_id}/balances`
- **Headers**: `X-User: <username>`
- **Description**: Calculates the net balance of every member in the group.
  $$\text{Balance} = \text{Total Paid} - \text{Total Share Owed}$$
  - Positive balance (`+`): money owed to member.
  - Negative balance (`-`): member owes money.
  - All group members are included (even if balance is `0.00`).
  - Soft-deleted expenses are excluded.
  - The sum of member balances always sums to exactly `0.00`.
- **Response**: `200 OK`

```json
[
  {
    "username": "alice",
    "balance": "66.66"
  },
  {
    "username": "bob",
    "balance": "-33.33"
  },
  {
    "username": "carol",
    "balance": "-33.33"
  }
]
```

---

## Financial Calculation & Business Logic

### 1. Satang Remainder Distribution (Equal Split)

Monetary calculations strictly avoid floating-point errors by performing integer satang arithmetic (`1 THB = 100 satang`):

1. Convert total amount to integer satang: $T = \text{round}(\text{amount} \times 100)$.
2. Calculate base satang per member: $B = T // N$.
3. Calculate remainder satang: $R = T \% N$.
4. Allocate $B + 1$ satang to the first $R$ members in the exact order specified in `split.members`, and $B$ satang to the remaining members.
5. Convert back to 2-decimal string format (`f"{satang / 100:.2f}"`).

**Example**: $100.00$ THB divided equally among `alice`, `bob`, `carol`:

- $T = 10000$ satang, $N = 3$.
- $B = 3333$ satang (`33.33`), $R = 1$ satang (`0.01`).
- `alice` (index 0) gets $3334$ satang (`33.34`).
- `bob` (index 1) gets $3333$ satang (`33.33`).
- `carol` (index 2) gets $3333$ satang (`33.33`).
- Total: $33.34 + 33.33 + 33.33 = 100.00$.

### 2. Exact Split Validation

- Every specified member share must be strictly $> 0.00$ and have $\le 2$ decimal places.
- Sum of shares must equal the expense total exactly. Requests where $\sum \text{shares} \neq \text{amount}$ are rejected with `400 Bad Request` and detail `"The shares do not add up to the total"`.

### 3. Zero-Sum Balance Guarantee

For any group:
$$\sum_{m \in \text{members}} \text{Balance}_m = \sum_{m \in \text{members}} \text{Total Paid}_m - \sum_{m \in \text{members}} \text{Total Owed}_m = \sum_{e \in \text{expenses}} \text{Amount}_e - \sum_{e \in \text{expenses}} \left( \sum_{s \in \text{shares}} \text{Amount}_s \right) = 0.00$$

Every balance calculation verifies this invariant before returning.

---

## Idempotency & Transactional Concurrency Strategy

Expense creation supports the optional `Idempotency-Key` header:

1. **Scoped Uniqueness**: The database enforces composite unique constraint `uq_expenses_group_idempotency_key` on `(group_id, idempotency_key)`. Multiple null keys are permitted within the same group.
2. **Concurrent Safety**:
   - If concurrent requests arrive simultaneously with the same key, both attempt to insert.
   - PostgreSQL allows exactly one insert to commit; the competing request encounters an `IntegrityError`.
   - The service catches `IntegrityError`, immediately issues `session.rollback()`, queries the committed expense, verifies the request payload matches, and returns the original expense.
3. **Payload Mismatch Detection**:
   - Replaying the same key with an identical payload returns `200 OK` with the original expense.
   - Reusing the same key with a different payload (different amount, description, payer, or split) is rejected with `409 Conflict` and detail `"Idempotency key reused with different request payload"`.
4. **Missing Key**:
   - Omitting `Idempotency-Key` creates the expense normally without idempotency caching.

---

## Current Implementation Status

- [x] **Phase 1**: Monorepo initialization, requirements analysis (`docs/implementation-plan.md`), PostgreSQL 16 Docker Compose setup, FastAPI skeleton with `/health`, SQLAlchemy 2.0 + Alembic wiring, Next.js TypeScript + Tailwind CSS initialization, and Husky + `lint-staged` + Ruff + ESLint + Prettier pre-commit automation.
- [x] **Phase 2**: Database schema models (`users`, `groups`, `group_members`, `expenses`, `expense_shares`), Alembic migrations, idempotent seed data (`alice`, `bob`, `carol`, `dan`; Groups 1 & 2), and isolated test suite covering all 10 schema integrity areas.
- [x] **Phase 3**: All 6 REST API endpoints (`GET /groups`, `GET /groups/{id}`, `POST /groups/{id}/expenses`, `GET /groups/{id}/expenses`, `DELETE /groups/{id}/expenses/{id}`, `GET /groups/{id}/balances`), satang remainder allocation, zero-sum balances, ACID concurrent idempotency handling, payer-only soft deletion, and 25 comprehensive automated tests.
- [x] **Phase 4**: Next.js shared-expense interface, live satang split preview, typed API client with non-member/auth handling, idempotent retry lifecycle, payer-only deletion with confirmation, zero-sum verification banner, Vitest suite (25 tests), and verified production build.

---

## Frontend Application (Phase 4)

The SplitBill frontend is built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, and **Tailwind CSS v4**. It interacts directly with the FastAPI REST API.

### Features & User Workflows

1. **Active User Simulation (`X-User` Header)**:
   - Quick switcher between seeded users (`alice`, `bob`, `carol`, `dan`).
   - Dynamically re-fetches groups accessible only to the active user.
   - Cleanses state upon switching users to prevent cross-account data leakage.

2. **Group Management & Switching**:
   - Lists only groups where the active user is a registered member (`GET /groups`).
   - Automatically loads group member roster (`GET /groups/{id}`), active balances, and expense history.
   - Empty state gracefully handles users with no groups (e.g. Dan when not in Chiang Mai trip).

3. **Satang-Accurate Live Split Preview**:
   - Zero JavaScript floating point errors: calculated entirely in integer satang (`1 THB = 100 satang`).
   - **Equal Split**: Automatically calculates quotient satang and distributes remainder satang (0.01 at a time) strictly matching backend order-based remainder rules.
   - **Exact Split**: Real-time validation verifying $\sum \text{shares} = \text{total}$. Displays live allocation status (unallocated / over-allocated) and disables submission until exactly zero difference is reached.

4. **Member Balances & Zero-Sum Invariant Card**:
   - Renders net balance for each group member with visual indicators:
     - Positive balance (+฿X.XX): member gets back money (green badge).
     - Negative balance (-฿X.XX): member owes money (rose badge).
     - Zero balance (฿0.00): settled up (neutral badge).
   - Real-time client-side badge verifying $\sum \text{balances} = 0.00$ THB.

5. **Reverse-Chronological Expense Feed & Payer Deletion**:
   - Lists all non-deleted expenses ordered newest first (`GET /groups/{id}/expenses`).
   - Shows detailed share breakdown for every participant.
   - **Payer-Only Deletion**: The delete button is rendered **only** when `currentUser === expense.paid_by`. Non-payers cannot see or click delete.
   - Two-step inline confirmation prevents accidental deletions.
   - Deleting an expense immediately refreshes expenses and balances without full page reload.

6. **Idempotent Retry & Error Resilience**:
   - Generates client-side UUID idempotency key on form initialization.
   - Automatically retains the key on network errors or validation failures, allowing safe retry without creating duplicate expenses.
   - Generates a fresh key only after a successful expense creation.
   - Displays clear, contextual error banners for backend 4xx/5xx responses or network failures.

### Frontend Environment Variables

Create `frontend/.env.local` (or copy from `frontend/.env.example`):

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Running Frontend Tests

```bash
# Run all frontend tests via Vitest
npm run test:frontend

# Or directly in frontend folder
cd frontend && npm test
```
