"""Pytest fixtures for SLA Sentinel backend tests."""

import pytest
from fastapi.testclient import TestClient
from backend.models import Base
from backend.main import app
from backend.tests.test_api_integration import (
    test_engine,
    TestingSessionLocal,
    override_get_db,
)


@pytest.fixture(autouse=True)
def setup_database():
    """Create fresh tables before every test."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    """Return FastAPI TestClient."""
    return TestClient(app)


@pytest.fixture
def test_db():
    """Direct database session for tests."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
