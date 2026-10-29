"""Integration tests for FastAPI endpoints wiring Engine 1 and Engine 2."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import get_db
from backend.models import Base, Team, Ticket
from backend.main import app

# Test SQLite in-memory database with StaticPool so all connections share the same memory instance
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    """Create fresh tables for every test."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    """Return FastAPI TestClient."""
    return TestClient(app)


def test_get_ticket_sla_risk_endpoint(client):
    """Verify GET /tickets/{id}/sla-risk calls Engine 1 correctly."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)
    ticket = Ticket(
        id="T101",
        title="Payment webhook error",
        category="Payments",
        status="Open",
        created_at=now - timedelta(hours=9),
        sla_time_limit=10.0,
    )
    db.add(ticket)
    db.commit()
    db.close()

    response = client.get("/tickets/T101/sla-risk")
    assert response.status_code == 200
    data = response.json()
    assert data["ticket_id"] == "T101"
    assert data["risk_level"] == "High Risk"
    assert data["is_high_risk"] is True
    assert pytest.approx(data["ratio"], rel=1e-2) == 0.9


def test_post_ticket_assign_endpoint(client):
    """Verify POST /tickets/{id}/assign calls Engine 2 and saves assigned_team_id."""
    db = TestingSessionLocal()
    team_a = Team(id="team-pay", name="Payments Squad", skill_tags=["Payments"])
    ticket = Ticket(
        id="T202",
        title="UPI double charge",
        category="Payments",
        status="Open",
        sla_time_limit=12.0,
        assigned_team_id=None,
    )
    db.add_all([team_a, ticket])
    db.commit()
    db.close()

    response = client.post("/tickets/T202/assign")
    assert response.status_code == 200
    data = response.json()
    assert data["ticket_id"] == "T202"
    assert data["team_id"] == "team-pay"
    assert data["team_name"] == "Payments Squad"
    assert data["matched_by"] == "skill_tag"

    # Verify team was saved on the ticket in the database
    db_verify = TestingSessionLocal()
    saved_ticket = db_verify.query(Ticket).filter(Ticket.id == "T202").first()
    assert saved_ticket.assigned_team_id == "team-pay"
    db_verify.close()


def test_assign_endpoint_ticket_not_found(client):
    """Verify 404 is returned when assigning a non-existent ticket."""
    response = client.post("/tickets/UNKNOWN-999/assign")
    assert response.status_code == 404
