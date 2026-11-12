"""Idempotent seed data script for SplitBill development and testing."""

import sys
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.group import Group, GroupMember
from app.models.user import User

SEED_USERS: list[str] = ["alice", "bob", "carol", "dan"]

SEED_GROUPS: list[dict[str, Any]] = [
    {
        "id": 1,
        "name": "Chiang Mai trip",
        "members": ["alice", "bob", "carol"],
    },
    {
        "id": 2,
        "name": "Office lunch",
        "members": ["bob", "dan"],
    },
]


def seed_database(session: Session) -> dict[str, Any]:
    """Seed users, groups, and group memberships idempotently.

    Preserves group IDs 1 and 2, handles existing records safely, and ensures
    PostgreSQL sequence counters are synchronized after explicit ID assignment.
    """
    results: dict[str, Any] = {
        "users_created": 0,
        "groups_created": 0,
        "memberships_created": 0,
    }

    # 1. Seed Users
    user_map: dict[str, User] = {}
    for username in SEED_USERS:
        stmt = select(User).where(User.username == username)
        user = session.execute(stmt).scalar_one_or_none()
        if user is None:
            user = User(username=username)
            session.add(user)
            session.flush()
            results["users_created"] += 1
        user_map[username] = user

    # Synchronize users identity sequence if any users exist
    max_user_id = session.execute(select(func.max(User.id))).scalar() or 1
    session.execute(
        text("SELECT setval(pg_get_serial_sequence('users', 'id'), :val, true)"),
        {"val": max_user_id},
    )

    # 2. Seed Groups with explicit IDs preserved (1 and 2)
    group_map: dict[int, Group] = {}
    for group_def in SEED_GROUPS:
        target_id: int = group_def["id"]
        target_name: str = group_def["name"]

        stmt = select(Group).where(Group.id == target_id)
        group = session.execute(stmt).scalar_one_or_none()

        if group is None:
            group = Group(id=target_id, name=target_name)
            session.add(group)
            session.flush()
            results["groups_created"] += 1
        else:
            if group.name != target_name:
                group.name = target_name
                session.flush()

        group_map[target_id] = group

    # Synchronize groups identity sequence so future autoincrements start above max(id)
    max_group_id = session.execute(select(func.max(Group.id))).scalar() or 2
    session.execute(
        text("SELECT setval(pg_get_serial_sequence('groups', 'id'), :val, true)"),
        {"val": max_group_id},
    )

    # 3. Seed Group Memberships
    for group_def in SEED_GROUPS:
        group_id = group_def["id"]
        for member_name in group_def["members"]:
            user = user_map[member_name]
            member_stmt = select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user.id,
            )
            membership = session.execute(member_stmt).scalar_one_or_none()
            if membership is None:
                membership = GroupMember(group_id=group_id, user_id=user.id)
                session.add(membership)
                results["memberships_created"] += 1

    session.commit()
    return results


def main() -> None:
    """Entry point for executing seed data script via CLI."""
    with SessionLocal() as session:
        try:
            results = seed_database(session)
            print(
                f"[Seed] Successfully seeded database: "
                f"{results['users_created']} users created, "
                f"{results['groups_created']} groups created, "
                f"{results['memberships_created']} memberships created."
            )
        except Exception as e:
            print(f"[Seed] Error seeding database: {e}", file=sys.stderr)
            session.rollback()
            sys.exit(1)


if __name__ == "__main__":
    main()
