"""Comprehensive pytest tests for SplitBill REST APIs, business rules, and concurrency."""

import concurrent.futures
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseSplit
from app.services.expense_service import ExpenseService
from tests.conftest import _truncate_tables


def test_equal_split_calculation_and_satang_allocation(client: TestClient) -> None:
    """1. Equal split of 100.00 across three members produces 33.34, 33.33, 33.33."""
    payload = {
        "description": "Chiang Mai Dinner",
        "amount": "100.00",
        "paid_by": "alice",
        "split": {
            "type": "equal",
            "members": ["alice", "bob", "carol"],
        },
    }
    response = client.post(
        "/groups/1/expenses",
        json=payload,
        headers={"X-User": "alice"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == "100.00"

    # Verify order-based satang distribution: alice (index 0) gets 33.34, others 33.33
    shares = {s["username"]: s["amount"] for s in data["shares"]}
    assert shares["alice"] == "33.34"
    assert shares["bob"] == "33.33"
    assert shares["carol"] == "33.33"

    # Verify balances: alice paid 100.00, owes 33.34 -> +66.66; bob & carol owe 33.33 -> -33.33
    balance_resp = client.get("/groups/1/balances", headers={"X-User": "alice"})
    assert balance_resp.status_code == 200
    balances = {b["username"]: b["balance"] for b in balance_resp.json()}
    assert balances["alice"] == "66.66"
    assert balances["bob"] == "-33.33"
    assert balances["carol"] == "-33.33"

    # Sum of balances must equal 0.00
    total = sum(Decimal(val) for val in balances.values())
    assert total == Decimal("0.00")


def test_exact_split_with_invalid_total(client: TestClient) -> None:
    """2. Exact split not summing to total amount is rejected."""
    payload = {
        "description": "Lunch with mismatch",
        "amount": "1000.00",
        "paid_by": "bob",
        "split": {
            "type": "exact",
            "shares": {
                "bob": "500.00",
                "dan": "400.00",  # Sum = 900.00 != 1000.00
            },
        },
    }
    response = client.post(
        "/groups/2/expenses",
        json=payload,
        headers={"X-User": "bob"},
    )
    assert response.status_code == 400
    assert "The shares do not add up to the total" in response.json()["detail"]


def test_rejection_of_three_decimal_monetary_amounts(client: TestClient) -> None:
    """3. Reject amounts with more than two decimal places."""
    # Invalid expense amount
    payload1 = {
        "description": "Micro satang amount",
        "amount": "10.005",
        "paid_by": "alice",
        "split": {
            "type": "equal",
            "members": ["alice", "bob"],
        },
    }
    resp1 = client.post(
        "/groups/1/expenses",
        json=payload1,
        headers={"X-User": "alice"},
    )
    assert resp1.status_code == 422

    # Invalid share amount
    payload2 = {
        "description": "Micro satang share",
        "amount": "100.00",
        "paid_by": "bob",
        "split": {
            "type": "exact",
            "shares": {
                "bob": "66.666",
                "dan": "33.334",
            },
        },
    }
    resp2 = client.post(
        "/groups/2/expenses",
        json=payload2,
        headers={"X-User": "bob"},
    )
    assert resp2.status_code == 422


def test_repeated_idempotency_key(client: TestClient) -> None:
    """4. Repeated Idempotency-Key returns original expense without duplicate creation."""
    payload = {
        "description": "Gas refill",
        "amount": "500.00",
        "paid_by": "alice",
        "split": {
            "type": "equal",
            "members": ["alice", "bob"],
        },
    }
    headers = {"X-User": "alice", "Idempotency-Key": "gas-key-101"}

    # Initial request
    resp1 = client.post("/groups/1/expenses", json=payload, headers=headers)
    assert resp1.status_code == 201
    expense_id = resp1.json()["id"]

    # Replay identical request
    resp2 = client.post("/groups/1/expenses", json=payload, headers=headers)
    assert resp2.status_code in (200, 201)
    assert resp2.json()["id"] == expense_id
    assert resp2.json()["amount"] == "500.00"

    # Verify only one expense exists in list
    list_resp = client.get("/groups/1/expenses", headers={"X-User": "alice"})
    matching = [e for e in list_resp.json() if e["id"] == expense_id]
    assert len(matching) == 1


def test_concurrent_requests_using_same_key(test_engine: Engine) -> None:
    """5. Concurrent requests with same idempotency key create only one expense."""
    with Session(test_engine) as init_session:
        seed_database(init_session)

    payload = ExpenseCreate(
        description="Concurrent Coffee",
        amount="150.00",
        paid_by="alice",
        split=ExpenseSplit(
            type="equal",
            members=["alice", "bob", "carol"],
        ),
    )

    def worker(worker_idx: int):
        with Session(test_engine) as db:
            return ExpenseService.create_expense(
                db=db,
                group_id=1,
                expense_in=payload,
                idempotency_key="concurrent-coffee-test",
            )

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(worker, i) for i in range(5)]
        results = [f.result() for f in futures]

    # All responses return the same expense ID
    created_ids = {resp.id for resp, is_replay in results}
    assert len(created_ids) == 1
    assert all(resp.amount == "150.00" for resp, _ in results)

    # Exactly 1 newly created and 4 replayed
    new_creations = [resp for resp, is_replay in results if not is_replay]
    assert len(new_creations) == 1

    # Database verification: exactly one record exists
    with Session(test_engine) as verify_session:
        stmt = select(Expense).where(
            Expense.group_id == 1,
            Expense.idempotency_key == "concurrent-coffee-test",
        )
        expenses = verify_session.execute(stmt).scalars().all()
        assert len(expenses) == 1

    # Restore clean baseline for other tests
    _truncate_tables(test_engine)


def test_group_access_denied_for_non_members(client: TestClient) -> None:
    """6. Group access is denied with 403 Forbidden for non-members."""
    # alice is not a member of Group 2 (bob, dan)
    resp_detail = client.get("/groups/2", headers={"X-User": "alice"})
    assert resp_detail.status_code == 403
    assert resp_detail.json()["detail"] == "Not a member of this group"

    resp_expenses = client.get("/groups/2/expenses", headers={"X-User": "alice"})
    assert resp_expenses.status_code == 403

    resp_balances = client.get("/groups/2/balances", headers={"X-User": "alice"})
    assert resp_balances.status_code == 403

    resp_post = client.post(
        "/groups/2/expenses",
        json={
            "description": "Unauthorized expense",
            "amount": "100.00",
            "paid_by": "alice",
            "split": {"type": "equal", "members": ["bob", "dan"]},
        },
        headers={"X-User": "alice"},
    )
    assert resp_post.status_code == 403

    # Non-existent group returns 404 Not Found
    resp_404 = client.get("/groups/9999", headers={"X-User": "alice"})
    assert resp_404.status_code == 404
    assert resp_404.json()["detail"] == "Group not found"


def test_payer_only_expense_deletion(client: TestClient) -> None:
    """7. Only the payer can delete an expense; non-payers are rejected with 403."""
    # Create expense paid by alice
    create_resp = client.post(
        "/groups/1/expenses",
        json={
            "description": "Snacks",
            "amount": "60.00",
            "paid_by": "alice",
            "split": {"type": "equal", "members": ["alice", "bob"]},
        },
        headers={"X-User": "alice"},
    )
    expense_id = create_resp.json()["id"]

    # bob is in Group 1, but is not the payer
    del_forbidden = client.delete(
        f"/groups/1/expenses/{expense_id}",
        headers={"X-User": "bob"},
    )
    assert del_forbidden.status_code == 403
    assert del_forbidden.json()["detail"] == "Only the payer can delete this expense"

    # alice is the payer -> succeeds
    del_ok = client.delete(
        f"/groups/1/expenses/{expense_id}",
        headers={"X-User": "alice"},
    )
    assert del_ok.status_code == 200
    assert del_ok.json()["message"] == "Expense deleted successfully"

    # Repeated deletion returns 404 Not Found
    del_repeated = client.delete(
        f"/groups/1/expenses/{expense_id}",
        headers={"X-User": "alice"},
    )
    assert del_repeated.status_code == 404
    assert del_repeated.json()["detail"] == "Expense not found"


def test_soft_deleted_expenses_excluded_from_balances(client: TestClient) -> None:
    """8. Soft-deleted expenses are excluded from balances and expense lists."""
    # Initial balance should be 0.00
    init_b = client.get("/groups/1/balances", headers={"X-User": "alice"}).json()
    assert all(b["balance"] == "0.00" for b in init_b)

    # Record expense
    create_resp = client.post(
        "/groups/1/expenses",
        json={
            "description": "Hotel Room",
            "amount": "900.00",
            "paid_by": "alice",
            "split": {"type": "equal", "members": ["alice", "bob", "carol"]},
        },
        headers={"X-User": "alice"},
    )
    expense_id = create_resp.json()["id"]

    # Check active balances
    mid_b = {
        b["username"]: b["balance"]
        for b in client.get("/groups/1/balances", headers={"X-User": "alice"}).json()
    }
    assert mid_b["alice"] == "600.00"
    assert mid_b["bob"] == "-300.00"
    assert mid_b["carol"] == "-300.00"

    # Soft delete the expense
    client.delete(f"/groups/1/expenses/{expense_id}", headers={"X-User": "alice"})

    # Check balances after deletion: back to 0.00
    post_b = client.get("/groups/1/balances", headers={"X-User": "alice"}).json()
    assert all(b["balance"] == "0.00" for b in post_b)

    # Excluded from active expense listing
    expenses = client.get("/groups/1/expenses", headers={"X-User": "alice"}).json()
    assert not any(e["id"] == expense_id for e in expenses)


def test_zero_sum_balances(client: TestClient) -> None:
    """9. Zero-sum balances invariant holds across multiple complex expenses."""
    # Expense 1: alice pays 300.00 split among alice, bob, carol
    client.post(
        "/groups/1/expenses",
        json={
            "description": "Groceries",
            "amount": "300.00",
            "paid_by": "alice",
            "split": {"type": "equal", "members": ["alice", "bob", "carol"]},
        },
        headers={"X-User": "alice"},
    )

    # Expense 2: bob pays 150.00 split between bob and carol
    client.post(
        "/groups/1/expenses",
        json={
            "description": "Taxi",
            "amount": "150.00",
            "paid_by": "bob",
            "split": {"type": "equal", "members": ["bob", "carol"]},
        },
        headers={"X-User": "bob"},
    )

    # Expense 3: carol pays 70.00 exact split: alice 30.00, carol 40.00
    client.post(
        "/groups/1/expenses",
        json={
            "description": "Coffee",
            "amount": "70.00",
            "paid_by": "carol",
            "split": {"type": "exact", "shares": {"alice": "30.00", "carol": "40.00"}},
        },
        headers={"X-User": "carol"},
    )

    resp = client.get("/groups/1/balances", headers={"X-User": "alice"})
    assert resp.status_code == 200
    balances = {b["username"]: Decimal(b["balance"]) for b in resp.json()}

    # Verify all members included
    assert set(balances.keys()) == {"alice", "bob", "carol"}

    # Exact zero-sum verification
    total_sum = sum(balances.values())
    assert total_sum == Decimal("0.00")


def test_invalid_split_participants(client: TestClient) -> None:
    """10. Reject non-group members in split or as payer."""
    # dan is not in Group 1
    resp_payer = client.post(
        "/groups/1/expenses",
        json={
            "description": "Bad payer",
            "amount": "100.00",
            "paid_by": "dan",
            "split": {"type": "equal", "members": ["alice", "bob"]},
        },
        headers={"X-User": "alice"},
    )
    assert resp_payer.status_code == 400
    assert "Payer 'dan' is not a member of this group" in resp_payer.json()["detail"]

    # dan in equal split participants
    resp_part = client.post(
        "/groups/1/expenses",
        json={
            "description": "Bad participant",
            "amount": "100.00",
            "paid_by": "alice",
            "split": {"type": "equal", "members": ["alice", "dan"]},
        },
        headers={"X-User": "alice"},
    )
    assert resp_part.status_code == 400
    assert "Participant 'dan' is not a member of this group" in resp_part.json()["detail"]

    # duplicate participants in equal split
    resp_dup = client.post(
        "/groups/1/expenses",
        json={
            "description": "Duplicate member",
            "amount": "100.00",
            "paid_by": "alice",
            "split": {"type": "equal", "members": ["alice", "alice"]},
        },
        headers={"X-User": "alice"},
    )
    assert resp_dup.status_code == 422


def test_negative_and_zero_expense_amounts(client: TestClient) -> None:
    """11. Reject non-positive amounts."""
    # Zero expense amount
    resp_zero = client.post(
        "/groups/1/expenses",
        json={
            "description": "Zero",
            "amount": "0.00",
            "paid_by": "alice",
            "split": {"type": "equal", "members": ["alice", "bob"]},
        },
        headers={"X-User": "alice"},
    )
    assert resp_zero.status_code == 422

    # Negative expense amount
    resp_neg = client.post(
        "/groups/1/expenses",
        json={
            "description": "Negative",
            "amount": "-50.00",
            "paid_by": "alice",
            "split": {"type": "equal", "members": ["alice", "bob"]},
        },
        headers={"X-User": "alice"},
    )
    assert resp_neg.status_code == 422

    # Zero share in exact split
    resp_zero_share = client.post(
        "/groups/1/expenses",
        json={
            "description": "Zero share",
            "amount": "100.00",
            "paid_by": "alice",
            "split": {"type": "exact", "shares": {"alice": "100.00", "bob": "0.00"}},
        },
        headers={"X-User": "alice"},
    )
    assert resp_zero_share.status_code in (400, 422)


def test_valid_expense_creation_and_retrieval(client: TestClient) -> None:
    """12. Valid expense creation and reverse chronological order retrieval."""
    # Create Expense 1
    resp1 = client.post(
        "/groups/1/expenses",
        json={
            "description": "First Expense",
            "amount": "10.00",
            "paid_by": "alice",
            "split": {"type": "equal", "members": ["alice", "bob"]},
        },
        headers={"X-User": "alice"},
    )
    assert resp1.status_code == 201
    id1 = resp1.json()["id"]

    # Create Expense 2
    resp2 = client.post(
        "/groups/1/expenses",
        json={
            "description": "Second Expense",
            "amount": "20.00",
            "paid_by": "bob",
            "split": {"type": "equal", "members": ["alice", "bob"]},
        },
        headers={"X-User": "bob"},
    )
    assert resp2.status_code == 201
    id2 = resp2.json()["id"]

    # List expenses: should be [Expense 2, Expense 1]
    list_resp = client.get("/groups/1/expenses", headers={"X-User": "alice"})
    assert list_resp.status_code == 200
    expenses = list_resp.json()
    assert len(expenses) >= 2
    assert expenses[0]["id"] == id2
    assert expenses[1]["id"] == id1


def test_incorrect_reuse_of_idempotency_key(client: TestClient) -> None:
    """13. Reusing an idempotency key with a mutated payload returns 409 Conflict."""
    payload_orig = {
        "description": "Original Purchase",
        "amount": "100.00",
        "paid_by": "alice",
        "split": {"type": "equal", "members": ["alice", "bob"]},
    }
    client.post(
        "/groups/1/expenses",
        json=payload_orig,
        headers={"X-User": "alice", "Idempotency-Key": "unique-id-999"},
    )

    # Same key with different amount -> 409 Conflict
    payload_diff_amount = {
        "description": "Original Purchase",
        "amount": "200.00",
        "paid_by": "alice",
        "split": {"type": "equal", "members": ["alice", "bob"]},
    }
    resp_conflict = client.post(
        "/groups/1/expenses",
        json=payload_diff_amount,
        headers={"X-User": "alice", "Idempotency-Key": "unique-id-999"},
    )
    assert resp_conflict.status_code == 409
    assert "Idempotency key reused with different request payload" in resp_conflict.json()["detail"]


def test_correct_response_formats_and_status_codes(client: TestClient) -> None:
    """14. Verify standard response structures and HTTP status codes."""
    # GET /groups
    groups_resp = client.get("/groups", headers={"X-User": "alice"})
    assert groups_resp.status_code == 200
    groups = groups_resp.json()
    assert isinstance(groups, list)
    assert all("id" in g and "name" in g for g in groups)

    # GET /groups/{group_id}
    detail_resp = client.get("/groups/1", headers={"X-User": "alice"})
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == 1
    assert detail["name"] == "Chiang Mai trip"
    assert set(detail["members"]) == {"alice", "bob", "carol"}

    # Missing X-User header
    missing_header = client.get("/groups")
    assert missing_header.status_code == 422

    # Non-existent user
    unknown_user = client.get("/groups", headers={"X-User": "unknown_ghost"})
    assert unknown_user.status_code == 401
    assert "User 'unknown_ghost' not found" in unknown_user.json()["detail"]
