# SplitBill — Final Audit & Submission Verification Report

## Executive Summary

- **Audit Date**: 2026-11-15 (updating initial 2026-11-12 Phase 5 report)
- **Audit Target**: SplitBill Monorepo (Chowpa Developer Take-Home Assessment)
- **Final Classification**: **READY WITH CONDITIONS**
- **Verification Status (2026-11-15)**: Frontend Vitest suite (25/25), `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm --prefix frontend run build` all **PASS**. Backend `pytest` suite (25 tests) and database migration/seed verification are **BLOCKED** in this environment because Docker Desktop / PostgreSQL (`localhost:5432`) is not running. Actual development time requires developer confirmation.

---

## 1. Requirement-by-Requirement Compliance Checklist

|   #    | Assessment Requirement                      |   Status    | Verifying Source File(s) / Tests                                                                                                              | Evidence & Findings                                                                                                                                                                                                                   |
| :----: | :------------------------------------------ | :---------: | :-------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1**  | **All 6 REST API endpoints implemented**    |  **PASS**   | `backend/app/api/groups.py`<br>`backend/app/api/expenses.py`<br>`backend/tests/test_api_endpoints.py`                                         | Verified `GET /groups`, `GET /groups/{id}`, `POST /groups/{id}/expenses`, `GET /groups/{id}/expenses`, `DELETE /groups/{id}/expenses/{id}`, `GET /groups/{id}/balances`. Plus `GET /health`.                                          |
| **2**  | **Seed users and groups**                   |  **PASS**   | `backend/app/db/seed.py`<br>`backend/tests/test_database_schema.py`                                                                           | Users: `alice`, `bob`, `carol`, `dan`. Group 1: `"Chiang Mai trip"` (`alice`, `bob`, `carol`). Group 2: `"Office lunch"` (`bob`, `dan`). Idempotent execution verified (`ON CONFLICT DO NOTHING` + sequence reset).                   |
| **3**  | **Equal & Exact expense splitting**         |  **PASS**   | `backend/app/services/financial_service.py`<br>`frontend/src/lib/money.ts`<br>`backend/tests/test_api_endpoints.py#L18`                       | Both modes supported and tested. Equal split distributes remainder satang deterministically. Exact split verifies $\sum \text{shares} = \text{total}$ down to 0.01 THB.                                                               |
| **4**  | **Satang-accurate calculations (No Float)** |  **PASS**   | `backend/app/models/expense.py`<br>`backend/app/schemas/expense.py`<br>`frontend/src/lib/money.ts`                                            | Backend uses Python `Decimal` and PostgreSQL `NUMERIC(12,2)`. Frontend uses pure integer satang arithmetic ($1\text{ THB} = 100\text{ satang}$). Float math is strictly avoided.                                                      |
| **5**  | **Zero-sum balance invariant**              |  **PASS**   | `backend/app/services/balance_service.py#L61`<br>`backend/tests/test_api_endpoints.py#L311`<br>`frontend/src/components/BalancesCard.tsx`     | Backend asserts $\sum \text{balance} == 0.00$ before returning. Frontend displays a live verification badge confirming net zero-sum.                                                                                                  |
| **6**  | **Group membership authorization**          |  **PASS**   | `backend/app/api/deps.py#L40`<br>`backend/tests/test_api_endpoints.py#L200`                                                                   | Non-members attempting to access or modify groups receive `403 Forbidden` (`{"detail": "Not a member of this group"}`). Non-existent groups return `404 Not Found`.                                                                   |
| **7**  | **Payer-only deletion**                     |  **PASS**   | `backend/app/services/expense_service.py#L191`<br>`backend/tests/test_api_endpoints.py#L231`<br>`frontend/src/components/ExpenseList.tsx#L87` | Non-payers receive `403 Forbidden` (`{"detail": "Only the payer can delete this expense"}`). UI hides delete button from non-payers.                                                                                                  |
| **8**  | **Soft deletion**                           |  **PASS**   | `backend/app/repositories/expense_repository.py#L90`<br>`backend/tests/test_api_endpoints.py#L271`                                            | Record is updated with `is_deleted = True` and timestamp `deleted_at`. Record remains in DB; excluded from balances and active listing. Repeated delete returns `404 Not Found`.                                                      |
| **9**  | **Idempotency under concurrent requests**   |  **PASS**   | `backend/app/services/expense_service.py#L119`<br>`backend/tests/test_api_endpoints.py#L150`                                                  | Composite unique constraint `(group_id, idempotency_key)`. Concurrent requests caught by `IntegrityError`, rolled back, and returned original committed result. Replays return original; modified payload returns `409 Conflict`.     |
| **10** | **PostgreSQL & Alembic migrations**         | **BLOCKED** | `backend/alembic/versions/32909da78918_create_splitbill_core_schema.py`<br>`backend/tests/test_database_schema.py`                            | Migration script defines `users`, `groups`, `group_members`, `expenses`, `expense_shares` with foreign keys, checks, and unique indexes without `Base.metadata.create_all()`. Live execution is **BLOCKED** (PostgreSQL unavailable). |
| **11** | **Mandatory automated test suite**          | **BLOCKED** | `backend/tests/`<br>`frontend/src/__tests__/`                                                                                                 | Frontend Vitest suite (`25/25`) **PASSED** on 2026-11-15. Backend pytest suite (25 tests across 3 files) is **BLOCKED** in this environment (PostgreSQL unavailable; previously recorded as passing on 2026-11-12).                   |
| **12** | **Next.js single-page interface**           |  **PASS**   | `frontend/src/app/page.tsx`                                                                                                                   | Clean, responsive single-page dashboard organizing user selector, group selector, balances, live expense form, and transaction history.                                                                                               |
| **13** | **Live split preview**                      |  **PASS**   | `frontend/src/components/ExpenseForm.tsx#L336`                                                                                                | Updates in real-time as amount or participants change. Matches exact satang distribution order.                                                                                                                                       |
| **14** | **Frontend validation & error handling**    |  **PASS**   | `frontend/src/components/AlertBanner.tsx`<br>`frontend/src/lib/api.ts`                                                                        | Network errors and 4xx/5xx responses parsed and presented clearly. Submission disabled when exact split sum $\neq$ total.                                                                                                             |
| **15** | **README documentation completeness**       |  **PASS**   | `README.md`                                                                                                                                   | Contains overview, architecture, setup from fresh clone, environment variables, migration/seed steps, run commands, testing guide, design decisions, Known Limitations & Next Steps, and Development Time placeholder.                |
| **16** | **AI_NOTES.md completeness**                |  **PASS**   | `AI_NOTES.md`                                                                                                                                 | Documents tool used, assisted components, real prompts, real errors detected and corrected across all phases, and review processes.                                                                                                   |
| **17** | **Incremental Git commit history**          |  **PASS**   | `git log --oneline`                                                                                                                           | 5 incremental commits following Conventional Commits format with Husky pre-commit hooks configured.                                                                                                                                   |

---

## 2. Backend Code Review Findings

1. **Monetary Precision**:
   - PostgreSQL column types are strictly `NUMERIC(12, 2)`.
   - Python models and services use `decimal.Decimal` throughout. Zero use of standard float math for financial transactions.
   - Pydantic models validate input strings with regex `/^\d+(\.\d{1,2})?$/`, ensuring no three-decimal numbers (e.g. `10.005`) or negative numbers reach persistence layers.
2. **ACID Transaction & Concurrency Safety**:
   - `ExpenseService.create_expense` executes inside an atomic database session.
   - Idempotency key race conditions are handled by catching PostgreSQL `IntegrityError` caused by the unique constraint `uq_expenses_group_idempotency_key`.
   - The service issues `session.rollback()`, queries the winning committed record, verifies payload parity, and returns the original result without leaking uncommitted state.
   - Concurrency was verified with a 5-worker multi-threaded executor test connecting directly to PostgreSQL.
3. **Authorization & Boundaries**:
   - FastAPI dependency `get_group_for_member` enforces group membership prior to entering route logic.
   - Returns standard `403 Forbidden` (`{"detail": "Not a member of this group"}`) when the user is not in the group, and `404 Not Found` if the group does not exist.
   - Payer identity is verified on `DELETE /groups/{group_id}/expenses/{expense_id}`: non-payers receive `403 Forbidden` (`{"detail": "Only the payer can delete this expense"}`).

---

## 3. Frontend Code Review Findings

1. **Financial Parity**:
   - `frontend/src/lib/money.ts` reimplements the exact integer-satang algorithm ($T = \text{round}(\text{amount} \times 100)$, $B = \lfloor T / N \rfloor$, $R = T \pmod N$, allocating remainder satang to the first $R$ participants in selection order).
   - Zero floating-point drift: `0.10 + 0.20 === 0.30` verified in integer satang.
2. **State Management & Stale Data Prevention**:
   - `frontend/src/app/page.tsx` utilizes reactive state hooks with dependency arrays.
   - Switching user immediately resets selected group and dependent balances/expenses, re-fetching accessible groups for the new user.
   - Stale data from previous users or groups cannot leak into the active view.
3. **User Experience & Defenses**:
   - Real-time split preview displays calculated shares before submission.
   - For exact splits, the submit button is disabled unless remaining satang is strictly `0` and all participant shares are $> 0$.
   - Delete button is conditionally rendered only for expenses where `currentUser === expense.paid_by`.
   - Inline two-step confirmation prevents accidental soft deletions.
   - Idempotency key UUID is generated upon form mount, preserved across network retry attempts, and renewed only upon successful response.

---

## 4. Real End-to-End Integration Verification (Historical: 2026-11-12)

> **Note**: The live end-to-end integration check below was recorded in the initial Phase 5 audit (`3726735`) on 2026-11-12. It was **not** re-executed during the 2026-11-15 audit because Docker Desktop / PostgreSQL is not running in this environment (**BLOCKED**).

A live automated end-to-end integration check was recorded against running services (PostgreSQL 16 on `:5432`, FastAPI on `:8000`, Next.js on `:3000`) with 23 assertions:

```text
[PASS] 1. Backend /health returns 200 OK
[PASS] 2. User alice sees only Group 1 (Chiang Mai trip)
[PASS] 3. Group 1 detail contains alice, bob, carol
[PASS] 4-7. Created 100.00 THB expense with exact satang shares: alice=33.34, bob=33.33, carol=33.33
[PASS] 9. Expense is confirmed persisted in PostgreSQL and listed in reverse-chronological order
[PASS] 10. Balances verified and sum to exact 0.00: {'alice': 66.66, 'bob': -33.33, 'carol': -33.33}
[PASS] 11-12. Application refresh confirms persistence
[PASS] 13-14. Bob is forbidden from deleting alice's expense (403 Forbidden)
[PASS] 15-16. Alice successfully soft-deletes the expense (200 OK)
[PASS] 17. Expense excluded from active expenses list
[PASS] 18. Balances verified after deletion; zero-sum holds: {'alice': 0.0, 'bob': 0.0, 'carol': 0.0}
[PASS] 19. Exact split with unequal total rejected with 400 Bad Request
[PASS] 20. Valid exact split (50.00 + 30.00 + 20.00 = 100.00) created successfully
[PASS] 21. Replay of same idempotency key returns original expense
[PASS] 22. Reusing idempotency key with different payload returns 409 Conflict
[PASS] 23. Dan accessing Group 1 returns 403 Forbidden ('Not a member of this group')
```

---

## 5. Automated Test Suite Results

### 2026-11-15 Audit Execution

- **Frontend (`npm run test:frontend` / `vitest run`)**: **PASS** — 25 passed in 2.05s (`src/__tests__/money.test.ts`: 15 tests, `src/__tests__/components.test.tsx`: 10 tests).
- **Backend (`npm run test:backend` / `pytest backend/tests`)**: **BLOCKED** — PostgreSQL on `localhost:5432` is not running and Docker Desktop is unavailable in this environment (`backend/tests/conftest.py` requires a live PostgreSQL instance for `splitbill_test`).
  - Test files present: `test_health.py` (1 test), `test_database_schema.py` (10 tests), `test_api_endpoints.py` (14 tests) — 25 tests total (previously recorded as passing in commit `3726735` on 2026-11-12).

---

## 6. Code Quality & Security Audit

1. **Security & Secrets**:
   - Scanned tracked files and Git history (`git log --all --full-history --stat -- "*.env*"`, `git grep`) for API keys, passwords, private keys, or tokens.
   - Database credentials default to local development values (`splitbill:splitbill_dev_password@localhost:5432/splitbill`) managed via `.env.example` and `backend/.env.example`.
   - `.env` and `.env.*` files (except `!.env.example`) are properly ignored in `.gitignore`.
2. **Linting, Formatting & Build (Verified 2026-11-15)**:
   - `npm run lint`: Ruff (`backend`) and ESLint 9 (`frontend`) passed with **0 errors and 0 warnings**.
   - `npm run format:check`: Prettier and Ruff format checks passed with **0 style deviations**.
   - `npm run typecheck`: TypeScript (`tsc --noEmit`) passed with **0 type errors**.
   - `npm --prefix frontend run build`: Next.js 15 production build compiled and statically generated all routes successfully.

---

## 7. Documentation Completeness

- [`README.md`](file:///c:/Users/User/Desktop/splitbill/README.md):
  - Setup instructions from fresh clone.
  - Environment variable definitions (`DATABASE_URL`, `NEXT_PUBLIC_API_BASE_URL`).
  - Database migration and seed commands.
  - API endpoint specification table and financial algorithm explanations.
  - Known Limitations & Next Steps.
  - Development time section (`Actual development time: To be confirmed by developer`; notes that the earlier `~4.5 hours` figure was an unverified estimate).
- [`AI_NOTES.md`](file:///c:/Users/User/Desktop/splitbill/AI_NOTES.md):
  - Documents tool used (Google Antigravity / Gemini).
  - Breakdown of assisted phases.
  - Real prompt examples.
  - Genuine errors caught and corrected (e.g. Starlette TestClient concurrency deadlock, ESLint monorepo resolution, Vitest path alias resolution, React 19 object child rendering).
  - Code review and verification methodology.

---

## 8. Git Commit History

The repository maintains an incremental history of 5 commits prior to the 2026-11-15 audit edits:

```text
3726735 docs: generate phase 5 final audit and verification report
7aec3fe feat(frontend): implement splitbill expense management interface
7a1a4f5 feat(api): implement expense APIs and financial business rules
397a923 feat(db): add splitbill schema migrations and seed data
c1a4b2d chore: initialize splitbill monorepo with git hooks
```

- Husky pre-commit hooks (`.husky/pre-commit`) and `lint-staged` are configured.

---

## 9. Submission Readiness Classification

### **READY WITH CONDITIONS**

All mandatory source code, frontend tests, linting, typechecking, formatting, and production build checks pass, and documentation inconsistencies have been corrected. Remaining conditions before final submission:

1. **Developer Confirmation**: Confirm and fill in the actual development time in `README.md` (`Actual development time: To be confirmed by developer`).
2. **PostgreSQL Verification**: Start Docker Desktop / PostgreSQL (`docker compose up -d`) and run `npm run test` (plus `alembic upgrade head` and `npm run seed`) to re-verify the 25 backend tests and database setup after the final documentation edits.
