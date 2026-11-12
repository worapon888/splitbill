"""Pytest configuration and database fixtures for isolated test execution."""

import os
from collections.abc import Generator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.db.session import get_db
from app.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://splitbill:splitbill_dev_password@localhost:5432/splitbill_test",
)


def _ensure_test_database_exists() -> None:
    """Ensure that the isolated splitbill_test database exists in PostgreSQL."""
    admin_url = "postgresql+psycopg://splitbill:splitbill_dev_password@localhost:5432/postgres"
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        result = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = 'splitbill_test'")
        ).scalar()
        if not result:
            conn.execute(text("CREATE DATABASE splitbill_test"))
    admin_engine.dispose()


def _run_migrations(db_url: str) -> None:
    """Run all Alembic migrations on the test database."""
    base_dir = Path(__file__).resolve().parent.parent
    alembic_ini_path = base_dir / "alembic.ini"

    alembic_cfg = Config(str(alembic_ini_path))
    alembic_cfg.set_main_option("script_location", str(base_dir / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    command.upgrade(alembic_cfg, "head")


def _truncate_tables(engine: Engine) -> None:
    """Truncate all domain tables to ensure a clean test baseline."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE expense_shares, expenses, group_members, "
                "groups, users RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture(scope="session")
def test_engine() -> Generator[Engine, None, None]:
    """Create a session-wide engine for the isolated test database."""
    _ensure_test_database_exists()
    _run_migrations(TEST_DATABASE_URL)

    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    _truncate_tables(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(test_engine: Engine) -> Generator[Session, None, None]:
    """Provide a transactional database session with savepoint isolation."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def seeded_db(db_session: Session) -> Session:
    """Provide a pre-seeded transactional database session."""
    seed_database(db_session)
    return db_session


@pytest.fixture
def client(seeded_db: Session) -> Generator[TestClient, None, None]:
    """Provide a FastAPI TestClient bound to the isolated, seeded transactional session."""
    app.dependency_overrides[get_db] = lambda: seeded_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
