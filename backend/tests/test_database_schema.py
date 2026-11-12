"""Database-focused tests covering schema constraints, seed data, and integrity."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import inspect, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models.expense import Expense, ExpenseShare
from app.models.group import Group, GroupMember
from app.models.user import User


def test_required_tables_and_constraints_exist(test_engine: Engine) -> None:
    """1. Verify all required tables, columns, PKs, FKs, and constraints exist."""
    inspector = inspect(test_engine)
    table_names = set(inspector.get_table_names())

    expected_tables = {"users", "groups", "group_members", "expenses", "expense_shares"}
    assert expected_tables.issubset(table_names)

    # Verify users table
    user_columns = {col["name"]: col for col in inspector.get_columns("users")}
    assert "id" in user_columns
    assert "username" in user_columns
    assert "created_at" in user_columns
    user_indexes = inspector.get_indexes("users")
    assert any(idx["name"] == "ix_users_username" and idx["unique"] for idx in user_indexes)

    # Verify groups table
    group_columns = {col["name"]: col for col in inspector.get_columns("groups")}
    assert "id" in group_columns
    assert "name" in group_columns
    assert "created_at" in group_columns

    # Verify group_members table constraints
    gm_uqs = inspector.get_unique_constraints("group_members")
    assert any(set(uq["column_names"]) == {"group_id", "user_id"} for uq in gm_uqs)

    # Verify expenses table constraints
    exp_uqs = inspector.get_unique_constraints("expenses")
    assert any(set(uq["column_names"]) == {"group_id", "idempotency_key"} for uq in exp_uqs)
    exp_checks = inspector.get_check_constraints("expenses")
    assert any("amount" in ck["sqltext"] for ck in exp_checks)

    # Verify expense_shares table constraints
    es_uqs = inspector.get_unique_constraints("expense_shares")
    assert any(set(uq["column_names"]) == {"expense_id", "user_id"} for uq in es_uqs)
    es_checks = inspector.get_check_constraints("expense_shares")
    assert any("amount" in ck["sqltext"] for ck in es_checks)


def test_seed_data_correctness(db_session: Session) -> None:
    """2. Verify seed script creates required users, groups, and memberships."""
    results = seed_database(db_session)
    assert results["users_created"] == 4
    assert results["groups_created"] == 2
    assert results["memberships_created"] == 5

    # Check Users
    users = db_session.execute(select(User).order_by(User.id)).scalars().all()
    usernames = [u.username for u in users]
    assert usernames == ["alice", "bob", "carol", "dan"]

    # Check Groups and IDs
    group1 = db_session.execute(select(Group).where(Group.id == 1)).scalar_one()
    group2 = db_session.execute(select(Group).where(Group.id == 2)).scalar_one()
    assert group1.name == "Chiang Mai trip"
    assert group2.name == "Office lunch"

    # Check Group 1 Members: alice, bob, carol
    g1_members = {u.username for u in group1.members}
    assert g1_members == {"alice", "bob", "carol"}

    # Check Group 2 Members: bob, dan
    g2_members = {u.username for u in group2.members}
    assert g2_members == {"bob", "dan"}

    # Verify bob belongs to multiple groups
    bob = db_session.execute(select(User).where(User.username == "bob")).scalar_one()
    assert len(bob.groups) == 2


def test_seed_script_idempotency(db_session: Session) -> None:
    """3. Verify running seed script repeatedly does not create duplicates."""
    seed_database(db_session)

    # Second execution must be a no-op
    second_run = seed_database(db_session)
    assert second_run["users_created"] == 0
    assert second_run["groups_created"] == 0
    assert second_run["memberships_created"] == 0

    # Counts must remain unchanged
    user_count = len(db_session.execute(select(User)).scalars().all())
    group_count = len(db_session.execute(select(Group)).scalars().all())
    member_count = len(db_session.execute(select(GroupMember)).scalars().all())

    assert user_count == 4
    assert group_count == 2
    assert member_count == 5


def test_unique_username_constraint(db_session: Session) -> None:
    """4. Enforce uniqueness of username column."""
    db_session.add(User(username="unique_user"))
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(User(username="unique_user"))
            db_session.flush()


def test_unique_group_membership_constraint(db_session: Session) -> None:
    """5. Enforce unique composite constraint on (group_id, user_id)."""
    user = User(username="member_test")
    group = Group(name="Group Test")
    db_session.add_all([user, group])
    db_session.flush()

    db_session.add(GroupMember(group_id=group.id, user_id=user.id))
    db_session.flush()

    # Duplicate membership attempt
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(GroupMember(group_id=group.id, user_id=user.id))
            db_session.flush()


def test_duplicate_idempotency_keys_within_group(db_session: Session) -> None:
    """6. Enforce idempotency key uniqueness per group while allowing across groups or nulls."""
    user = User(username="payer_test")
    group1 = Group(name="Group 1")
    group2 = Group(name="Group 2")
    db_session.add_all([user, group1, group2])
    db_session.flush()

    # Expense 1 with key "ik-001" in group 1
    exp1 = Expense(
        group_id=group1.id,
        paid_by=user.id,
        description="First",
        amount=Decimal("100.00"),
        idempotency_key="ik-001",
    )
    db_session.add(exp1)
    db_session.flush()

    # Same key in group 1 must fail
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            exp_duplicate = Expense(
                group_id=group1.id,
                paid_by=user.id,
                description="Duplicate",
                amount=Decimal("100.00"),
                idempotency_key="ik-001",
            )
            db_session.add(exp_duplicate)
            db_session.flush()

    # Same key in a DIFFERENT group must succeed
    exp_other_group = Expense(
        group_id=group2.id,
        paid_by=user.id,
        description="Other group",
        amount=Decimal("50.00"),
        idempotency_key="ik-001",
    )
    db_session.add(exp_other_group)
    db_session.flush()

    # Multiple expenses with null idempotency key within same group must succeed
    exp_null1 = Expense(
        group_id=group1.id,
        paid_by=user.id,
        description="Null key 1",
        amount=Decimal("20.00"),
        idempotency_key=None,
    )
    exp_null2 = Expense(
        group_id=group1.id,
        paid_by=user.id,
        description="Null key 2",
        amount=Decimal("30.00"),
        idempotency_key=None,
    )
    db_session.add_all([exp_null1, exp_null2])
    db_session.flush()


def test_numeric_monetary_precision_and_check_constraints(db_session: Session) -> None:
    """7. Verify exact NUMERIC(12,2) precision and check constraints (>0 and >=0)."""
    user = User(username="precision_user")
    group = Group(name="Precision Group")
    db_session.add_all([user, group])
    db_session.flush()

    exact_amount = Decimal("1234567890.12")
    expense = Expense(
        group_id=group.id,
        paid_by=user.id,
        description="Large expense",
        amount=exact_amount,
    )
    db_session.add(expense)
    db_session.flush()

    share = ExpenseShare(
        expense_id=expense.id,
        user_id=user.id,
        amount=Decimal("33.34"),
    )
    db_session.add(share)
    db_session.flush()

    # Read back and verify exact Decimal representation (no float conversion)
    refreshed_expense = db_session.execute(
        select(Expense).where(Expense.id == expense.id)
    ).scalar_one()
    assert refreshed_expense.amount == exact_amount
    assert isinstance(refreshed_expense.amount, Decimal)

    refreshed_share = db_session.execute(
        select(ExpenseShare).where(ExpenseShare.id == share.id)
    ).scalar_one()
    assert refreshed_share.amount == Decimal("33.34")
    assert isinstance(refreshed_share.amount, Decimal)

    # Check constraint: expense amount must be > 0
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            zero_expense = Expense(
                group_id=group.id,
                paid_by=user.id,
                description="Zero",
                amount=Decimal("0.00"),
            )
            db_session.add(zero_expense)
            db_session.flush()

    # Check constraint: expense share amount must not be negative (< 0)
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            negative_share = ExpenseShare(
                expense_id=expense.id,
                user_id=user.id,
                amount=Decimal("-0.01"),
            )
            db_session.add(negative_share)
            db_session.flush()


def test_expense_share_uniqueness(db_session: Session) -> None:
    """8. Enforce that each member may have only one share per expense."""
    user = User(username="share_user")
    group = Group(name="Share Group")
    db_session.add_all([user, group])
    db_session.flush()

    expense = Expense(
        group_id=group.id,
        paid_by=user.id,
        description="Dinner",
        amount=Decimal("100.00"),
    )
    db_session.add(expense)
    db_session.flush()

    share1 = ExpenseShare(
        expense_id=expense.id,
        user_id=user.id,
        amount=Decimal("50.00"),
    )
    db_session.add(share1)
    db_session.flush()

    # Duplicate share for same expense and user
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            share2 = ExpenseShare(
                expense_id=expense.id,
                user_id=user.id,
                amount=Decimal("50.00"),
            )
            db_session.add(share2)
            db_session.flush()


def test_foreign_key_integrity(db_session: Session) -> None:
    """9. Enforce foreign key constraints across groups, users, expenses, and shares."""
    user = User(username="fk_user")
    group = Group(name="FK Group")
    db_session.add_all([user, group])
    db_session.flush()

    # Invalid group_id on GroupMember
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(GroupMember(group_id=999999, user_id=user.id))
            db_session.flush()

    # Invalid user_id on GroupMember
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(GroupMember(group_id=group.id, user_id=999999))
            db_session.flush()

    # Invalid group_id on Expense
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(
                Expense(
                    group_id=999999,
                    paid_by=user.id,
                    description="Bad group",
                    amount=Decimal("10.00"),
                )
            )
            db_session.flush()

    # Invalid paid_by on Expense
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(
                Expense(
                    group_id=group.id,
                    paid_by=999999,
                    description="Bad payer",
                    amount=Decimal("10.00"),
                )
            )
            db_session.flush()

    # Verify CASCADE delete from Expense to ExpenseShares
    valid_expense = Expense(
        group_id=group.id,
        paid_by=user.id,
        description="To be deleted",
        amount=Decimal("50.00"),
    )
    db_session.add(valid_expense)
    db_session.flush()

    share = ExpenseShare(
        expense_id=valid_expense.id,
        user_id=user.id,
        amount=Decimal("50.00"),
    )
    db_session.add(share)
    db_session.flush()

    share_id = share.id
    db_session.delete(valid_expense)
    db_session.flush()

    # Share must be automatically deleted via foreign key CASCADE
    deleted_share = db_session.execute(
        select(ExpenseShare).where(ExpenseShare.id == share_id)
    ).scalar_one_or_none()
    assert deleted_share is None


def test_soft_delete_persistence(db_session: Session) -> None:
    """10. Soft-deleting an expense preserves the row, shares, and audit trail."""
    user = User(username="audit_user")
    group = Group(name="Audit Group")
    db_session.add_all([user, group])
    db_session.flush()

    expense = Expense(
        group_id=group.id,
        paid_by=user.id,
        description="Audit expense",
        amount=Decimal("120.00"),
        idempotency_key="audit-key-1",
    )
    db_session.add(expense)
    db_session.flush()

    share = ExpenseShare(
        expense_id=expense.id,
        user_id=user.id,
        amount=Decimal("120.00"),
    )
    db_session.add(share)
    db_session.flush()

    # Soft delete the expense
    now = datetime.now(UTC)
    expense.is_deleted = True
    expense.deleted_at = now
    db_session.flush()

    # Record still exists in the database
    persisted_expense = db_session.execute(
        select(Expense).where(Expense.id == expense.id)
    ).scalar_one()
    assert persisted_expense.is_deleted is True
    assert persisted_expense.deleted_at is not None
    assert persisted_expense.amount == Decimal("120.00")
    assert persisted_expense.idempotency_key == "audit-key-1"

    # Shares still exist and remain linked
    persisted_share = db_session.execute(
        select(ExpenseShare).where(ExpenseShare.expense_id == expense.id)
    ).scalar_one()
    assert persisted_share.amount == Decimal("120.00")
