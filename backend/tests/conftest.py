"""Pytest configuration and database fixtures for isolated test execution."""

import os
from collections.abc import Generator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

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


@pytest.fixture(scope="session")
def test_engine() -> Generator[Engine, None, None]:
    """Create a session-wide engine for the isolated test database."""
    _ensure_test_database_exists()
    _run_migrations(TEST_DATABASE_URL)

    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(test_engine: Engine) -> Generator[Session, None, None]:
    """Provide a transactional database session rolled back after every test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, expire_on_commit=False)

    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()
