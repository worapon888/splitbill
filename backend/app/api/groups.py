"""API router for group management and member balances."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession, GroupMemberGroup
from app.repositories.group_repository import GroupRepository
from app.schemas.balance import BalanceResponse
from app.schemas.group import GroupDetailResponse, GroupResponse
from app.services.balance_service import BalanceService

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get(
    "",
    response_model=list[GroupResponse],
    summary="List groups of requesting user",
)
def list_groups(
    current_user: CurrentUser,
    db: DbSession,
) -> list[GroupResponse]:
    """Return all groups where the requesting user (X-User) is an active member."""
    groups = GroupRepository.get_user_groups(db, current_user.id)
    return [GroupResponse(id=g.id, name=g.name) for g in groups]


@router.get(
    "/{group_id}",
    response_model=GroupDetailResponse,
    summary="Get group details with membership list",
)
def get_group(
    group: GroupMemberGroup,
    db: DbSession,
) -> GroupDetailResponse:
    """Return details and member list for the specified group.

    Requires requester to be an active group member (HTTP 403 otherwise).
    """
    members = GroupRepository.get_group_members(db, group.id)
    return GroupDetailResponse(
        id=group.id,
        name=group.name,
        members=[m.username for m in members],
    )


@router.get(
    "/{group_id}/balances",
    response_model=list[BalanceResponse],
    summary="Get net balances of group members",
)
def get_balances(
    group: GroupMemberGroup,
    db: DbSession,
) -> list[BalanceResponse]:
    """Calculate and return net balances for all group members (sum always equals 0.00)."""
    return BalanceService.get_group_balances(db, group)
