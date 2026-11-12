"""SQLAlchemy models for Expenses and ExpenseShares."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.user import User


class Expense(Base):
    """Expense entity representing a monetary transaction within a group."""

    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
        UniqueConstraint(
            "group_id",
            "idempotency_key",
            name="uq_expenses_group_idempotency_key",
        ),
        Index(
            "ix_expenses_group_created_at_desc",
            "group_id",
            text("created_at DESC"),
            text("id DESC"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    paid_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2),
        nullable=False,
    )
    idempotency_key: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    group: Mapped["Group"] = relationship("Group", back_populates="expenses")
    payer: Mapped["User"] = relationship("User", back_populates="expenses_paid")
    shares: Mapped[list["ExpenseShare"]] = relationship(
        "ExpenseShare",
        back_populates="expense",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<Expense(id={self.id}, group_id={self.group_id}, "
            f"amount={self.amount}, is_deleted={self.is_deleted})>"
        )


class ExpenseShare(Base):
    """Share of an expense allocated to a specific group member."""

    __tablename__ = "expense_shares"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_expense_shares_amount_non_negative"),
        UniqueConstraint(
            "expense_id",
            "user_id",
            name="uq_expense_shares_expense_user",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    expense_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("expenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    expense: Mapped["Expense"] = relationship("Expense", back_populates="shares")
    user: Mapped["User"] = relationship("User", back_populates="expense_shares")

    def __repr__(self) -> str:
        return (
            f"<ExpenseShare(id={self.id}, expense_id={self.expense_id}, "
            f"user_id={self.user_id}, amount={self.amount})>"
        )
