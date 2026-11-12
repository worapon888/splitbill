"""Repository layer for group and membership queries."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.group import Group, GroupMember
from app.models.user import User


class GroupRepository:
    """Encapsulates database access for Groups and GroupMembers."""

    @staticmethod
    def get_user_groups(db: Session, user_id: int) -> list[Group]:
        """Return all groups where the specified user is an active member."""
        stmt = (
            select(Group)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .where(GroupMember.user_id == user_id)
            .order_by(Group.id.asc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_group_by_id(db: Session, group_id: int) -> Group | None:
        """Fetch group by primary key."""
        stmt = select(Group).where(Group.id == group_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_group_members(db: Session, group_id: int) -> list[User]:
        """Fetch all members of a group ordered by username."""
        stmt = (
            select(User)
            .join(GroupMember, GroupMember.user_id == User.id)
            .where(GroupMember.group_id == group_id)
            .order_by(User.username.asc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_group_member_map(db: Session, group_id: int) -> dict[str, User]:
        """Return mapping of username -> User object for all members in the group."""
        members = GroupRepository.get_group_members(db, group_id)
        return {u.username: u for u in members}
