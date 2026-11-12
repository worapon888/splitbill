# AI Usage Notes (`AI_NOTES.md`)

## 1. AI Tool Used

- **Tool**: Google Antigravity (powered by Gemini)
- **Developer Accountability**: Every generated file, configuration, and architectural decision was reviewed, executed, and verified against the `Developer-Take-Home-Test.pdf` specification.

---

## 2. Scope of AI Assistance in Phase 1

In **Phase 1 (Project Initialization, Architecture & Quality Automation)**, AI assistance was used for:

1. **Requirements Analysis & Planning**:
   - Extracting mandatory vs. optional requirements, endpoints, business rules, test cases, and ambiguities from `Developer-Take-Home-Test.pdf` into `docs/implementation-plan.md`.
2. **Monorepo & Infrastructure Scaffolding**:
   - Creating the `backend/`, `frontend/`, and `docs/` directory layout.
   - Authoring `docker-compose.yml` for PostgreSQL 16 with environment-variable configuration, named persistence volume, and `pg_isready` health check.
3. **Backend Skeleton (`backend/`)**:
   - Configuring `pyproject.toml` (Python 3.12+, FastAPI, SQLAlchemy 2.0, Psycopg 3, Alembic, Pydantic v2, `pytest`, Ruff).
   - Setting up `app/core/config.py`, `app/db/session.py`, `app/api/health.py`, `app/main.py`, `alembic/env.py`, and initial smoke test `tests/test_health.py`.
4. **Frontend Skeleton (`frontend/`)**:
   - Initializing Next.js 15 App Router with TypeScript, Tailwind CSS v4, and ESLint 9.
   - Creating the minimal Phase 1 landing page (`"SplitBill — Shared Expense Manager"`).
5. **Git Hooks & Code Quality Automation (Step 6.1)**:
   - Configuring Husky v9 (`.husky/pre-commit`), `lint-staged`, Prettier, ESLint, and Ruff at the monorepo root so staged Python, TypeScript, JSON, YAML, and Markdown files are automatically linted and formatted before commit.

---

## 3. Effective Prompts Used

### Prompt 1 — Architecture & Phase 1 Initialization

> _"Initialize a clean, maintainable Full Stack monorepo with a working development environment for SplitBill (Python 3.12+, FastAPI, SQLAlchemy 2.x, PostgreSQL 16, Alembic, Pydantic v2, pytest, Ruff, Next.js App Router, TypeScript, Tailwind CSS, ESLint). First analyze the attached PDF and create `docs/implementation-plan.md` separating mandatory requirements from optional extensions and documenting ambiguities in `README.md`. Implement only Phase 1 plus `/health` verification."_

### Prompt 2 — Git Hooks & Pre-Commit Quality Gate

> _"Set up Husky, lint-staged, and Prettier at the monorepo root. Configure a pre-commit hook that runs `ruff check --fix` and `ruff format` (with recheck) on staged `backend/**/*.py` files, ESLint `--fix` and Prettier on staged `frontend/**/*.{ts,tsx,js,jsx}` files, and Prettier on staged JSON/YAML/Markdown files, plus root scripts for `lint`, `format`, `format:check`, `typecheck`, and `test`."_

---

## 4. Detection & Correction of Suboptimal / Unsafe AI Output

During Phase 1 setup, the following issues were identified and corrected before committing:

1. **ESLint v9 Flat Config Resolution from Monorepo Root (`lint-staged`)**:
   - _Issue_: When `lint-staged` executes from the monorepo root directory on staged `frontend/src/**/*.tsx` files, invoking bare `eslint --fix` fails because ESLint v9 looks for `eslint.config.mjs` in the root working directory rather than `frontend/eslint.config.mjs`, and `next/core-web-vitals` plugins are installed in `frontend/node_modules`.
   - _Detection_: Verified by testing `npx lint-staged` from the repository root against a staged TypeScript file in `frontend/`.
   - _Correction_: Updated the `lint-staged` configuration for `frontend/**/*.{ts,tsx,js,jsx,mjs}` to invoke `frontend/node_modules/eslint/bin/eslint.js --config frontend/eslint.config.mjs --fix`, ensuring deterministic config and plugin resolution from the monorepo root.

2. **Cross-Platform Python Virtual Environment Invocation in Hooks**:
   - _Issue_: Hardcoding `.venv/bin/ruff` in `package.json` fails on Windows where virtualenv binaries live under `.venv\Scripts\ruff.exe`.
   - _Detection_: Inspected `package.json` scripts on Windows PowerShell environment.
   - _Correction_: Used `uv run --project backend ruff ...` and `uv run --project backend pytest ...`, which resolves the backend virtual environment portably across Windows, macOS, and Linux.

3. **Ruff `isort` First-Party vs. Third-Party Classification in `alembic/env.py`**:
   - _Issue_: Setting `src = ["app", "tests", "alembic"]` in `backend/pyproject.toml` caused Ruff `I001` to misclassify `app` as third-party when invoked from the monorepo root, and including `alembic` in `src` caused Ruff to treat the installed `alembic` library as a local first-party folder.
   - _Detection_: Detected by running `npm run lint` (`uv run --project backend ruff check backend`), which flagged `I001` in `backend/alembic/env.py` and `backend/tests/test_health.py`.
   - _Correction_: Configured `src = ["."]` along with `[tool.ruff.lint.isort]` (`known-first-party = ["app"]` and `known-third-party = ["alembic"]`) in `backend/pyproject.toml`.

---

## 5. Code Review & Verification Performed (Phase 1)

Every component in Phase 1 was verified by executing the actual toolchain commands:

- Started PostgreSQL 16 via `docker compose up -d` and verified container health status (`healthy`).
- Installed backend dependencies with `uv sync --python 3.12` and verified Python 3.12 environment.
- Executed `uv run alembic current` and `uv run alembic upgrade head` against the live PostgreSQL 16 database.
- Executed `uv run pytest` to verify `GET /health` returns `200 OK` with active database connectivity.
- Executed `uv run ruff check` and `uv run ruff format --check` with zero warnings or errors.
- Installed frontend dependencies, verified `npm run lint` and `npm run typecheck` (`tsc --noEmit`), and verified the Next.js development server responds on `http://localhost:3000`.
- Verified Husky `pre-commit` and `lint-staged`:
  - Confirmed a staged file with a lint error blocks `git commit`.
  - Confirmed a staged file with formatting issues is automatically formatted and included in the commit.
  - Confirmed unstaged changes remain untouched during pre-commit execution.

---

## 6. Scope of AI Assistance in Phase 2

In **Phase 2 (Database Schema, Alembic Migrations & Seed Data)**, AI assistance was used for:

1. **SQLAlchemy 2.0 Typed Declarative Models**:
   - Designing typed declarative models in `app/models/`:
     - `User`: unique username, timestamps, bidirectional relationships.
     - `Group`: name, autoincrement ID preserving IDs 1 and 2, memberships relationship.
     - `GroupMember`: composite unique constraint `(group_id, user_id)`, cascade foreign keys.
     - `Expense`: `NUMERIC(12, 2)` amount with check constraint `ck_expenses_amount_positive` (`amount > 0`), scoped idempotency unique constraint `uq_expenses_group_idempotency_key`, reverse-chronological index `ix_expenses_group_created_at_desc`, and soft-delete fields (`is_deleted`, `deleted_at`).
     - `ExpenseShare`: `NUMERIC(12, 2)` share amount with check constraint `ck_expense_shares_amount_non_negative` (`amount >= 0`), unique constraint `uq_expense_shares_expense_user`, and cascade deletion.
2. **Alembic Database Migration**:
   - Generating and refining initial migration `32909da78918_create_splitbill_core_schema.py` creating all 5 tables, foreign keys, unique constraints, check constraints, and indexes.
   - Verifying bidirectional migration execution (`upgrade head` -> `downgrade -1` -> `upgrade head`).
3. **Idempotent Seed Script**:
   - Authoring `backend/app/db/seed.py` to seed mandatory users (`alice`, `bob`, `carol`, `dan`) and groups (`1: Chiang Mai trip`, `2: Office lunch`).
   - Adding sequence synchronization logic (`pg_get_serial_sequence` + `setval`) ensuring future inserts do not collide with explicit IDs 1 and 2.
4. **Isolated Test Suite (`pytest`)**:
   - Creating isolated PostgreSQL test database (`splitbill_test`) in `conftest.py`.
   - Authoring 10 comprehensive schema and integrity tests in `tests/test_database_schema.py` covering constraints, seed correctness and idempotency, monetary precision, foreign keys, and soft delete.

---

## 7. Detection & Correction of Suboptimal / Unsafe AI Output (Phase 2)

During Phase 2, the following technical issues were identified and addressed:

1. **ESLint Triple-Slash Reference Error in Auto-Generated `next-env.d.ts`**:
   - _Issue_: Running `npm run lint` triggered `@typescript-eslint/triple-slash-reference` on Next.js's auto-generated `next-env.d.ts` (`/// <reference path="./.next/types/routes.d.ts" />`).
   - _Detection_: Flagged by root `npm run lint`.
   - _Correction_: Added `next-env.d.ts` to `ignores` in `frontend/eslint.config.mjs` as recommended by Next.js documentation.

2. **PostgreSQL Transaction Abort on Expected `IntegrityError` in Tests**:
   - _Issue_: In `tests/test_database_schema.py`, when testing expected database constraint violations (e.g., unique username or negative amount), PostgreSQL marked the entire connection transaction as aborted (`current transaction is aborted, commands ignored until end of transaction block`). Subsequent statements in the same test failed with `ForeignKeyViolation` or transaction deassociation warnings.
   - _Detection_: Two tests failed (`test_duplicate_idempotency_keys_within_group` and `test_foreign_key_integrity`) during initial test execution.
   - _Correction_: Wrapped each expected failure in a SQLAlchemy savepoint block (`with db_session.begin_nested():`) inside `pytest.raises(IntegrityError)`. When the error occurs, PostgreSQL cleanly rolls back to the savepoint without aborting the parent transaction.

3. **PostgreSQL Sequence Out-of-Sync After Explicit ID Insertion**:
   - _Issue_: Seeding Group IDs 1 and 2 explicitly does not advance the PostgreSQL identity sequence (`groups_id_seq`). Subsequent insertions via `Group(name="...")` would attempt to assign ID 1 and fail with a primary key collision.
   - _Detection_: Code review of the seed data script and PostgreSQL autoincrement semantics.
   - _Correction_: Added `SELECT setval(pg_get_serial_sequence('groups', 'id'), COALESCE(MAX(id), 1))` in `seed_database()` so the sequence automatically advances past seeded IDs.

4. **Module Resolution in Monorepo Seed Script Execution**:
   - _Issue_: Invoking `uv run --project backend python -m app.db.seed` from the monorepo root failed because Python resolves modules relative to the current working directory (`splitbill/` rather than `splitbill/backend`).
   - _Detection_: Verified `npm run seed` from root.
   - _Correction_: Updated `package.json` script to `uv run --directory backend python -m app.db.seed`, ensuring `backend` is set as the working directory during execution.

5. **Alembic `path_separator` Deprecation Warning**:
   - _Issue_: Alembic logged a deprecation warning: `No path_separator found in configuration; falling back to legacy splitting...`.
   - _Detection_: Observed in pytest warning summaries.
   - _Correction_: Added `path_separator = os` to `backend/alembic.ini`.

---

## 8. Code Review & Verification Performed (Phase 2)

- Executed `uv run alembic upgrade head` and confirmed tables created in PostgreSQL container.
- Verified bidirectional migrations: `alembic downgrade -1` dropped all tables cleanly; `alembic upgrade head` recreated them.
- Executed `npm run seed` and queried PostgreSQL via `docker compose exec db psql` to confirm:
  - Users: `alice` (id=1), `bob` (id=2), `carol` (id=3), `dan` (id=4).
  - Groups: `1: Chiang Mai trip`, `2: Office lunch`.
  - Memberships: Group 1 has alice, bob, carol; Group 2 has bob, dan; bob belongs to both groups.
- Executed `npm run seed` a second time to verify idempotency: 0 users created, 0 groups created, 0 memberships created.
- Executed full test suite (`npm run test`): 11 tests passed (1 smoke test + 10 database schema & constraint tests) running against isolated `splitbill_test`.
- Executed quality suite (`npm run lint`, `npm run format:check`, `npm run typecheck`): all passed with 0 errors.

---

## 9. Known Limitations (Phase 2)

- REST API endpoints (`/groups`, `/expenses`, `/balances`) and business validation services (satang splitting, zero-sum checking, membership enforcement) are scheduled for **Phase 3**.
- Frontend UI components for group switching and expense entry are scheduled for **Phase 4**.
