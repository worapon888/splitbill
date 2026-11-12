"""Health check endpoint for development and operational readiness."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import check_database_connection, get_db
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check API and database health",
)
def health_check(
    db: Annotated[Session, Depends(get_db)],
) -> HealthResponse:
    """Verify the FastAPI application is running and PostgreSQL is reachable."""
    try:
        check_database_connection(db)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed",
        ) from exc

    return HealthResponse(
        status="ok",
        service=settings.app_name,
        database="connected",
    )
