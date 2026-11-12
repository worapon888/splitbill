"""Pydantic request and response schemas package."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response schema for the application health check endpoint."""

    status: str
    service: str
    database: str
