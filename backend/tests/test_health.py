"""Smoke tests for the FastAPI application and health endpoint."""

from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_returns_ok() -> None:
    """Verify GET /health returns 200 OK and confirms database connectivity."""
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "SplitBill API"
    assert payload["database"] == "connected"
