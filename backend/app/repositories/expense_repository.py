"""Repository layer for expense and share persistence and queries."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.expense import Expense, ExpenseShare


class ExpenseRepository:
    """Encapsulates database access for Expenses and ExpenseShares."""

    @staticmethod
    def get_expense_by_id(
        db: Session,
        expense_id: int,
        group_id: int,
        include_deleted: bool = False,
    ) -> Expense | None:
        """Fetch expense by id within a group, optionally including soft-deleted."""
        stmt = (
            select(Expense)
            .options(
                selectinload(Expense.payer),
                selectinload(Expense.shares).selectinload(ExpenseShare.user),
            )
            .where(Expense.id == expense_id, Expense.group_id == group_id)
        )
        if not include_deleted:
            stmt = stmt.where(Expense.is_deleted.is_(False))
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_expense_by_idempotency_key(
        db: Session,
        group_id: int,
        idempotency_key: str,
    ) -> Expense | None:
        """Fetch existing expense by group_id and idempotency_key."""
        stmt = (
            select(Expense)
            .options(
                selectinload(Expense.payer),
                selectinload(Expense.shares).selectinload(ExpenseShare.user),
            )
            .where(
                Expense.group_id == group_id,
                Expense.idempotency_key == idempotency_key,
            )
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_active_group_expenses(db: Session, group_id: int) -> list[Expense]:
        """Fetch active (non-deleted) expenses in reverse chronological order."""
        stmt = (
            select(Expense)
            .options(
                selectinload(Expense.payer),
                selectinload(Expense.shares).selectinload(ExpenseShare.user),
            )
            .where(
                Expense.group_id == group_id,
                Expense.is_deleted.is_(False),
            )
            .order_by(Expense.created_at.desc(), Expense.id.desc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def create_expense(
        db: Session,
        expense: Expense,
        shares: list[ExpenseShare],
    ) -> Expense:
        """Persist a new expense and its allocated shares atomically."""
        db.add(expense)
        db.flush()  # obtain expense.id

        for share in shares:
            share.expense_id = expense.id
            db.add(share)

        db.commit()
        db.refresh(expense)
        return expense

    @staticmethod
    def soft_delete_expense(db: Session, expense: Expense) -> None:
        """Soft-delete an expense by setting is_deleted=True and deleted_at."""
        expense.is_deleted = True
        expense.deleted_at = datetime.now(UTC)
        db.commit()
        db.refresh(expense)
