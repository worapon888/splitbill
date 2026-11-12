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

## 5. Code Review & Verification Performed

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

## 6. Known Limitations (Phase 1)

- Domain tables (`users`, `groups`, `group_members`, `expenses`, `expense_shares`), seed data, and SplitBill business endpoints (`/groups`, `/expenses`, `/balances`) are scheduled for **Phase 2** and **Phase 3** per the incremental development plan.
- The frontend currently renders the Phase 1 foundation placeholder page (`"SplitBill — Shared Expense Manager"`).
