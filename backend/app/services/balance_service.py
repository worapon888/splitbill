"""Service layer calculating member net balances and verifying zero-sum property."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.group import Group
from app.repositories.expense_repository import ExpenseRepository
from app.repositories.group_repository import GroupRepository
from app.schemas.balance import BalanceResponse


class BalanceService:
    """Computes net financial balances for members of a group."""

    @staticmethod
    def get_group_balances(db: Session, group: Group) -> list[BalanceResponse]:
        """Compute the net balance of every member in the group.

        Formula:
            Balance = Total Paid - Total Share Owed
            - Positive balance (+): money owed to member.
            - Negative balance (-): member owes money.
            - Zero balance (0.00): all settled.

        Guarantees:
            1. All group members are included (even if balance is 0.00).
            2. Soft-deleted expenses are completely excluded.
            3. The sum of all member balances equals exactly 0.00.
        """
        members = GroupRepository.get_group_members(db, group.id)
        active_expenses = ExpenseRepository.get_active_group_expenses(db, group.id)

        # Initialize totals for all members
        total_paid: dict[int, Decimal] = {m.id: Decimal("0.00") for m in members}
        total_owed: dict[int, Decimal] = {m.id: Decimal("0.00") for m in members}

        for exp in active_expenses:
            if exp.paid_by in total_paid:
                total_paid[exp.paid_by] += exp.amount

            for share in exp.shares:
                if share.user_id in total_owed:
                    total_owed[share.user_id] += share.amount

        # Calculate net balance per member
        balances: list[BalanceResponse] = []
        total_balance_sum = Decimal("0.00")

        for m in members:
            net_balance = total_paid[m.id] - total_owed[m.id]
            total_balance_sum += net_balance
            balances.append(
                BalanceResponse(
                    username=m.username,
                    balance=f"{net_balance:.2f}",
                )
            )

        # Verification of zero-sum invariant
        if total_balance_sum != Decimal("0.00"):
            raise RuntimeError(
                f"Zero-sum invariant violated: group {group.id} "
                f"total balances sum to {total_balance_sum}"
            )

        return balances
