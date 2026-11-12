"""API router for recording, listing, and soft-deleting group expenses."""

from typing import Any

from fastapi import APIRouter, Response, status

from app.api.deps import (
    CurrentUser,
    DbSession,
    GroupMemberGroup,
    IdempotencyKeyHeader,
)
from app.schemas.expense import ExpenseCreate, ExpenseResponse
from app.services.expense_service import ExpenseService

router = APIRouter(prefix="/groups/{group_id}/expenses", tags=["expenses"])


@router.post(
    "",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new expense",
)
def create_expense(
    expense_in: ExpenseCreate,
    response: Response,
    group: GroupMemberGroup,
    idempotency_key: IdempotencyKeyHeader,
    db: DbSession,
) -> ExpenseResponse:
    """Record an expense with satang-accurate shares and concurrent idempotency protection."""
    expense_resp, is_replay = ExpenseService.create_expense(
        db=db,
        group_id=group.id,
        expense_in=expense_in,
        idempotency_key=idempotency_key,
    )
    if is_replay:
        response.status_code = status.HTTP_200_OK
    return expense_resp


@router.get(
    "",
    response_model=list[ExpenseResponse],
    summary="List group expenses",
)
def list_expenses(
    group: GroupMemberGroup,
    db: DbSession,
) -> list[ExpenseResponse]:
    """Return active group expenses in reverse chronological order."""
    return ExpenseService.list_expenses(db, group.id)


@router.delete(
    "/{expense_id}",
    summary="Soft-delete an expense",
)
def delete_expense(
    expense_id: int,
    group: GroupMemberGroup,
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, Any]:
    """Soft-delete an expense, restricted strictly to the original payer."""
    ExpenseService.soft_delete_expense(
        db=db,
        group_id=group.id,
        expense_id=expense_id,
        current_user=current_user,
    )
    return {"message": "Expense deleted successfully", "id": expense_id}
