"""FastAPI dependencies for requester identification, group membership, and headers."""

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import (
    GroupNotFoundException,
    NotGroupMemberException,
    UserNotFoundException,
)
from app.db.session import get_db
from app.models.group import Group, GroupMember
from app.models.user import User

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    x_user: Annotated[
        str,
        Header(alias="X-User", description="Username of the requesting user"),
    ],
) -> User:
    """Extract and validate the active requesting user from the X-User header."""
    username = x_user.strip()
    stmt = select(User).where(User.username == username)
    user = db.execute(stmt).scalar_one_or_none()
    if user is None:
        raise UserNotFoundException(f"User '{username}' not found.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_group_for_member(
    group_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> Group:
    """Verify group existence and enforce that the current user is a member of the group."""
    group_stmt = select(Group).where(Group.id == group_id)
    group = db.execute(group_stmt).scalar_one_or_none()
    if group is None:
        raise GroupNotFoundException("Group not found")

    membership_stmt = select(GroupMember).where(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
    )
    membership = db.execute(membership_stmt).scalar_one_or_none()
    if membership is None:
        raise NotGroupMemberException("Not a member of this group")

    return group


GroupMemberGroup = Annotated[Group, Depends(get_group_for_member)]


def get_idempotency_key(
    idempotency_key: Annotated[
        str | None,
        Header(
            alias="Idempotency-Key",
            description="Optional idempotency key for preventing duplicate operations",
        ),
    ] = None,
) -> str | None:
    """Extract and normalize optional Idempotency-Key header."""
    if idempotency_key is not None:
        stripped = idempotency_key.strip()
        return stripped if stripped else None
    return None


IdempotencyKeyHeader = Annotated[str | None, Depends(get_idempotency_key)]
