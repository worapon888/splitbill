# SplitBill — Implementation Plan & Architecture

> **Note**: This document is preserved as the historical Phase 1 planning baseline. Current implementation and verification status is tracked in [`docs/final-audit-report.md`](final-audit-report.md).

## 1. Requirements Analysis & Checklist

### Mandatory Requirements — Part 1: Backend (FastAPI + PostgreSQL 16)

#### Seed Data

- [ ] **Users**: `alice`, `bob`, `carol`, `dan` (identified via `X-User` request header; full authentication is out of scope).
- [ ] **Groups**:
  - Group `1`: `"Chiang Mai trip"` — members: `alice`, `bob`, `carol`
  - Group `2`: `"Office lunch"` — members: `bob`, `dan`

#### Required API Endpoints

| Method   | Path                                       | Description                                                                    |
| :------- | :----------------------------------------- | :----------------------------------------------------------------------------- |
| `GET`    | `/groups`                                  | List the groups of the requesting user (`X-User`)                              |
| `GET`    | `/groups/{group_id}`                       | Return a group with its member list                                            |
| `POST`   | `/groups/{group_id}/expenses`              | Record a new expense (supports `Idempotency-Key` header)                       |
| `GET`    | `/groups/{group_id}/expenses`              | List expenses in reverse chronological order (excluding soft-deleted expenses) |
| `DELETE` | `/groups/{group_id}/expenses/{expense_id}` | Soft-delete an expense (payer only)                                            |
| `GET`    | `/groups/{group_id}/balances`              | Return the net balance of each member (`+` owed to member, `-` owed by member) |

_(Note: `GET /health` is included for local development and operational verification.)_

#### Critical Business Rules

- [ ] **1. Exact allocation**: The sum of shares must equal the expense amount to the satang (`0.01`). For `equal` splits, divide equally and allocate remaining satang (`0.01` at a time) to members in the exact order listed in `split.members`. For `exact` splits, reject requests where shares do not sum to `amount` with a descriptive error.
- [ ] **2. Zero-sum balances**: The net balances of all members in a group must sum to `0.00` at all times.
- [ ] **3. Monetary precision**: Amounts are transmitted as strings (e.g., `"1000.00"`). Use `Decimal` in Python and `NUMERIC(12, 2)` in PostgreSQL. Never use `float` for monetary values. Reject amounts with more than 2 decimal places (e.g., `"10.005"`) and amounts `<= 0`.
- [ ] **4. Group access**: Only group members may read or modify a group (e.g., `alice` accessing Group `2` must fail). Return `403 Forbidden` (documented with rationale in `README.md`).
- [ ] **5. Membership validation**: Both `paid_by` and every member listed in `split` must be members of the target group, and `X-User` must be a member of the group.
- [ ] **6. Idempotency**: A repeated `Idempotency-Key` header for the same group must return the originally created expense without creating a duplicate, including under concurrent requests.
- [ ] **7. Immutability & Soft Delete**: Expenses cannot be edited. Deletion is restricted to the payer (`X-User == expense.paid_by`) and implemented as a soft delete (`deleted_at` / `is_deleted`), retained in the database and excluded from balances and active expense listings.

#### Required Automated Tests (`pytest`)

- [ ] Equal split of `"100.00"` among 3 members produces `"33.34"`, `"33.33"`, `"33.33"`, and group balances sum to `"0.00"`.
- [ ] Exact split not summing to total `amount` is rejected (`422` / `400`).
- [ ] Amount with 3 decimal places (e.g., `"10.005"`) is rejected.
- [ ] Repeated `Idempotency-Key` creates only one expense (including concurrent execution).
- [ ] `alice` can neither read nor write Group `2` (`403 Forbidden`).
- [ ] Only the payer can delete an expense (`403 Forbidden` for non-payer group members).

### Mandatory Requirements — Part 2: Frontend (Next.js App Router + TypeScript + Tailwind CSS)

- [ ] **1. User & Group Selection**: Select active user (`alice`, `bob`, `carol`, `dan`); display only groups belonging to the selected user.
- [ ] **2. Expense Entry**: Form with description, amount, payer, and split type (`equal` among selected members or `exact` amounts per member).
- [ ] **3. Live Split Preview**: Real-time share calculation matching backend satang allocation rules (`100.00` split 3 ways -> `33.34`, `33.33`, `33.33`) using integer satang arithmetic (zero floating-point error: `0.1 + 0.2 === 0.30`). Display unallocated amount for `exact` splits and disable submit until unallocated amount is `0.00`. Format amounts in Thai locale style (`1,000.00`).
- [ ] **4. Plain-Language Error Handling**: Present API and validation errors clearly (e.g., `"The shares do not add up to the total"`, `"Not a member of this group"`).
- [ ] **5. Balances & Expense List**: Display net balances per member (clearly distinguishing owed to vs. owed by) alongside the reverse-chronological expense list and delete button for expenses paid by the active user.

### Optional Extensions (Out of Scope Until Mandatory Scope Is Complete & Tested)

- [ ] **Settlement Suggestions**: `GET /groups/{group_id}/settle-up` returning minimum payments to settle balances to `0.00`.
- [ ] **Repayments**: `POST /groups/{group_id}/payments` recording repayments between members.
- [ ] **Full Containerisation**: Docker Compose starting both FastAPI API and PostgreSQL with one command.

---

## 2. Identified Ambiguities & Adopted Interpretations

All ambiguities below are also documented in `README.md`:

1. **`403 Forbidden` vs `404 Not Found` for Unauthorized Group Access**:
   - _Ambiguity_: The brief allows either `403` or `404` when a valid user accesses a group they do not belong to (e.g., `alice` requesting Group `2`).
   - _Decision_: Return `403 Forbidden` with message `"Not a member of this group"` when the group exists and `404 Not Found` when the group ID does not exist. This aligns directly with Part 2 Frontend Requirement #4 (`"Not a member of this group"`).
2. **`X-User` vs `paid_by` During Expense Creation**:
   - _Ambiguity_: Can a group member (`X-User: bob`) record an expense that was paid by another member of the same group (`paid_by: "alice"`), yet only `alice` can delete it?
   - _Decision_: Yes. Any authenticated member of the group (`X-User`) may record an expense where `paid_by` is any member of that group (supporting the frontend's payer selector dropdown), while `DELETE` checks `X-User == expense.paid_by`.
3. **Duplicate or Empty Members in Equal/Exact Splits**:
   - _Ambiguity_: What happens if `split.members` is empty, contains duplicate usernames, or if an `exact` split contains `0.00` or negative share amounts?
   - _Decision_: `split.members` must contain at least one member and no duplicates. In `exact` splits, every specified member share must be `> 0.00` (or non-negative with total `> 0.00` and only positive participants included) and have at most 2 decimal places.
4. **Idempotency Key Scope & Payload Mismatch**:
   - _Ambiguity_: Is `Idempotency-Key` scoped globally or per `(group_id, idempotency_key)`? What if the same key is reused with a different request body?
   - _Decision_: Scoped per `(group_id, idempotency_key)` via a database unique constraint. Replays with the same key and payload return the original expense (`200 OK` / `201 Created`); if the same key is sent with a mutated payload, return `409 Conflict`. If `Idempotency-Key` header is omitted, the expense is created normally without idempotency caching.
5. **Deleted Expenses in `GET /groups/{group_id}/expenses`**:
   - _Ambiguity_: Should soft-deleted expenses be hidden from `GET /groups/{group_id}/expenses` or returned with a deleted flag?
   - _Decision_: Excluded from `GET /groups/{group_id}/expenses` and from balance calculations, while retained in the `expenses` table with `deleted_at` timestamp (`is_deleted = true`). Deleting an already-deleted expense returns `404 Not Found`.

---

## 3. Proposed Architecture

### Monorepo Structure

- **`backend/`**: Python 3.12+, FastAPI, SQLAlchemy 2.0 (mapped classes), Alembic migrations, Pydantic v2 schemas, layered into:
  - `api/`: HTTP route handlers, header dependencies (`X-User`, `Idempotency-Key`), HTTP status mapping.
  - `schemas/`: Strict Pydantic v2 request/response models and custom `Decimal` string validators.
  - `services/`: Pure domain logic (satang allocation, balance calculation, membership & permission enforcement).
  - `repositories/`: Database query and persistence encapsulation.
  - `models/`: SQLAlchemy 2.0 ORM declarations (`NUMERIC(12, 2)`, foreign keys, unique constraints).
  - `db/`: Engine, session factory (`SessionLocal`), declarative base.
  - `core/`: `pydantic-settings` environment configuration and custom domain exceptions.
- **`frontend/`**: Next.js (App Router), TypeScript, Tailwind CSS, modular components and integer-satang money utility (`lib/money.ts`) to guarantee exact parity with backend calculations.
- **Root Tooling**: Docker Compose (PostgreSQL 16), Husky + `lint-staged` + Prettier + Ruff + ESLint pre-commit quality gates.

---

## 4. Development Phases

- **Phase 1 — Project Initialization, Infrastructure & Quality Gates (Current)**
  - Monorepo layout, Docker Compose PostgreSQL 16, FastAPI skeleton + `/health`, SQLAlchemy + Alembic setup, Next.js TypeScript + Tailwind skeleton, Husky + `lint-staged` + Ruff + ESLint + Prettier automation.
- **Phase 2 — Database Schema, Migrations & Seed Data**
  - SQLAlchemy models (`users`, `groups`, `group_members`, `expenses`, `expense_shares`), Alembic initial migration, deterministic seed script/migration for `alice`, `bob`, `carol`, `dan` and Groups 1 & 2.
- **Phase 3 — Backend Domain Logic, Endpoints & Automated Tests**
  - Exact satang allocation, monetary validation, group access control, concurrent-safe idempotency, soft delete, zero-sum balance computation, and comprehensive `pytest` test suite covering all mandatory cases.
- **Phase 4 — Frontend Implementation & End-to-End Integration**
  - Single-page Next.js interface with user/group switcher, expense entry form, live satang-accurate split preview, Thai number formatting, error banner, balances summary, and expense list with payer-only deletion.
- **Phase 5 — Final Review & Documentation Polish**
  - Final verification of `README.md`, `AI_NOTES.md`, clean incremental commit log, and full test/lint pass from a fresh environment.

---

## 5. Key Technical Risks & Mitigations

1. **Floating-Point Rounding Errors**:
   - _Mitigation_: Strictly forbid `float` in monetary paths. Use `Decimal` with exact string parsing and `NUMERIC(12, 2)` in Python/PostgreSQL, and integer satang (`Math.round` avoided in favor of deterministic string-to-satang `BigInt`/`number` integer parsing) in TypeScript.
2. **Race Conditions on Concurrent `Idempotency-Key` Requests**:
   - _Mitigation_: Enforce a composite unique constraint `UNIQUE (group_id, idempotency_key)` in PostgreSQL and handle `IntegrityError` transactions gracefully by catching the conflict, rolling back the duplicate insert, and querying the committed expense record.
3. **Cross-Platform Pre-Commit Hook Execution (Windows vs Unix)**:
   - _Mitigation_: Configure root `package.json` scripts and `lint-staged` to invoke backend Ruff via `uv run` (or `.venv`) cleanly without brittle shell-specific paths.

---

## 6. Phase 1 Acceptance Criteria

- [x] Monorepo structure matches specification (`backend/`, `frontend/`, `docs/`, `docker-compose.yml`, `.gitignore`, `README.md`, `AI_NOTES.md`).
- [x] PostgreSQL 16 starts via `docker compose up -d` and reports `healthy`.
- [x] Backend runs on Python 3.12+, connects to PostgreSQL, and responds `200 OK` on `GET /health`.
- [x] Alembic is configured and wired to `settings.database_url`.
- [x] `pytest` and `ruff` pass with zero errors.
- [x] Next.js frontend renders `"SplitBill — Shared Expense Manager"` and passes `eslint` and `tsc --noEmit`.
- [x] Husky `pre-commit` hook and `lint-staged` enforce Ruff, ESLint, and Prettier on staged files.
