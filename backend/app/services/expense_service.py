"""Service layer orchestrating expense recording, idempotency, and deletion."""

from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ExpenseNotFoundException,
    IdempotencyConflictException,
    InvalidPayerException,
    InvalidSplitException,
    UnauthorizedPayerException,
)
from app.models.expense import Expense, ExpenseShare
from app.models.user import User
from app.repositories.expense_repository import ExpenseRepository
from app.repositories.group_repository import GroupRepository
from app.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseShareItem
from app.services.financial_service import calculate_equal_split, validate_exact_split


def _to_expense_response(expense: Expense) -> ExpenseResponse:
    """Map SQLAlchemy Expense model to Pydantic ExpenseResponse schema."""
    shares = [
        ExpenseShareItem(
            username=share.user.username,
            amount=f"{share.amount:.2f}",
        )
        for share in expense.shares
    ]
    return ExpenseResponse(
        id=expense.id,
        group_id=expense.group_id,
        paid_by=expense.payer.username,
        description=expense.description,
        amount=f"{expense.amount:.2f}",
        created_at=expense.created_at,
        shares=shares,
    )


class ExpenseService:
    """Domain service for managing group shared expenses."""

    @staticmethod
    def create_expense(
        db: Session,
        group_id: int,
        expense_in: ExpenseCreate,
        idempotency_key: str | None = None,
    ) -> tuple[ExpenseResponse, bool]:
        """Record an expense with satang-accurate shares and concurrent-safe idempotency.

        Returns (ExpenseResponse, is_replay).
        """
        # 1. Fetch group members and validate payer
        member_map = GroupRepository.get_group_member_map(db, group_id)
        if expense_in.paid_by not in member_map:
            raise InvalidPayerException(
                f"Payer '{expense_in.paid_by}' is not a member of this group."
            )
        payer_user = member_map[expense_in.paid_by]

        total_amount = Decimal(expense_in.amount)

        # 2. Calculate and validate shares according to split type
        if expense_in.split.type == "equal":
            split_members = expense_in.split.members or []
            # Verify all split participants belong to the group
            for member_name in split_members:
                if member_name not in member_map:
                    raise InvalidSplitException(
                        f"Participant '{member_name}' is not a member of this group."
                    )
            allocated_shares = calculate_equal_split(total_amount, split_members)
        elif expense_in.split.type == "exact":
            split_shares = expense_in.split.shares or {}
            for member_name in split_shares:
                if member_name not in member_map:
                    raise InvalidSplitException(
                        f"Participant '{member_name}' is not a member of this group."
                    )
            allocated_shares = validate_exact_split(total_amount, split_shares)
        else:
            raise InvalidSplitException(f"Unsupported split type: {expense_in.split.type}")

        # 3. Check for existing idempotency key before attempting insert
        if idempotency_key is not None:
            existing = ExpenseRepository.get_expense_by_idempotency_key(
                db, group_id, idempotency_key
            )
            if existing is not None:
                return (
                    ExpenseService._verify_or_reject_idempotency(
                        existing, expense_in, payer_user, allocated_shares
                    ),
                    True,
                )

        # 4. Construct models
        expense = Expense(
            group_id=group_id,
            paid_by=payer_user.id,
            description=expense_in.description,
            amount=total_amount,
            idempotency_key=idempotency_key,
        )

        shares = [
            ExpenseShare(
                user_id=member_map[member_name].id,
                amount=share_amount,
            )
            for member_name, share_amount in allocated_shares
        ]

        # 5. Persist atomically with concurrency-safe exception handling
        try:
            saved_expense = ExpenseRepository.create_expense(db, expense, shares)
            return _to_expense_response(saved_expense), False
        except IntegrityError:
            db.rollback()
            # If an idempotency collision occurred due to concurrent requests
            if idempotency_key is not None:
                existing = ExpenseRepository.get_expense_by_idempotency_key(
                    db, group_id, idempotency_key
                )
                if existing is not None:
                    return (
                        ExpenseService._verify_or_reject_idempotency(
                            existing, expense_in, payer_user, allocated_shares
                        ),
                        True,
                    )
            raise

    @staticmethod
    def _verify_or_reject_idempotency(
        existing: Expense,
        expense_in: ExpenseCreate,
        payer_user: User,
        allocated_shares: list[tuple[str, Decimal]],
    ) -> ExpenseResponse:
        """Verify that an existing expense matches the replayed payload or raise 409 Conflict."""
        # Check basic fields
        if existing.paid_by != payer_user.id:
            raise IdempotencyConflictException(
                "Idempotency key reused with different request payload (paid_by mismatch)."
            )
        if existing.amount != Decimal(expense_in.amount):
            raise IdempotencyConflictException(
                "Idempotency key reused with different request payload (amount mismatch)."
            )
        if existing.description != expense_in.description:
            raise IdempotencyConflictException(
                "Idempotency key reused with different request payload (description mismatch)."
            )

        # Check shares
        existing_share_map = {s.user.username: s.amount for s in existing.shares}
        expected_share_map = {uname: amt for uname, amt in allocated_shares}

        if existing_share_map != expected_share_map:
            raise IdempotencyConflictException(
                "Idempotency key reused with different request payload (shares mismatch)."
            )

        return _to_expense_response(existing)

    @staticmethod
    def list_expenses(db: Session, group_id: int) -> list[ExpenseResponse]:
        """Return active expenses for a group in reverse chronological order."""
        expenses = ExpenseRepository.get_active_group_expenses(db, group_id)
        return [_to_expense_response(exp) for exp in expenses]

    @staticmethod
    def soft_delete_expense(
        db: Session,
        group_id: int,
        expense_id: int,
        current_user: User,
    ) -> None:
        """Soft-delete an expense, restricting deletion strictly to the original payer."""
        expense = ExpenseRepository.get_expense_by_id(
            db, expense_id=expense_id, group_id=group_id, include_deleted=True
        )
        if expense is None or expense.is_deleted:
            raise ExpenseNotFoundException("Expense not found")

        if expense.paid_by != current_user.id:
            raise UnauthorizedPayerException("Only the payer can delete this expense")

        ExpenseRepository.soft_delete_expense(db, expense)
