"""Automated tests for business configuration, synthetic demo dataset, and local simulator."""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.demo_dataset import DEMO_DATASET_ID, DEMO_DATASET_NAME


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def seed_demo_env(test_db):
    from backend.services.business_config import seed_default_business_configuration
    from backend.services.demo_dataset import seed_synthetic_demo_dataset
    seed_default_business_configuration(test_db)
    seed_synthetic_demo_dataset(test_db)


def test_business_config_summary(client):
    """Verify that business configuration summary endpoint returns all active factors."""
    res = client.get("/api/config/summary")
    assert res.status_code == 200
    data = res.json()

    assert "sla_policies" in data
    assert "team_capacities" in data
    assert "priority_weights" in data
    assert "risk_thresholds" in data
    assert "categories" in data
    assert "complexities" in data
    assert "agents" in data
    assert "team_performance_history" in data

    policies = data["sla_policies"]
    target_types = {p["target_type"] for p in policies}
    assert "response" in target_types
    assert "resolution" in target_types


def test_update_sla_policy_and_capacity(client):
    """Verify business configuration mutation endpoints."""
    res = client.put(
        "/api/config/sla-policies/policy:Critical:resolution",
        json={"target_hours": 3.5, "description": "Updated critical SLA target"},
    )
    assert res.status_code == 200
    assert res.json()["target_hours"] == 3.5

    res = client.put(
        "/api/config/team-capacities/team-a",
        json={"max_active_tickets": 18, "warning_threshold": 0.75, "critical_threshold": 0.95},
    )
    assert res.status_code == 200
    assert res.json()["max_active_tickets"] == 18


def test_synthetic_demo_dataset_composition(client):
    """Verify synthetic demo dataset exists, has ~250 tickets, and is tagged as SIMULATED DATA."""
    res = client.get(f"/api/datasets/{DEMO_DATASET_ID}")
    assert res.status_code == 200
    dataset = res.json()

    assert dataset["name"] == DEMO_DATASET_NAME
    assert dataset["total_rows"] >= 240
    assert dataset["validation_summary"]["is_simulated"] is True
    assert dataset["validation_summary"]["data_classification"] == "SIMULATED DATA"

    t_res = client.get(f"/api/datasets/{DEMO_DATASET_ID}/tickets?page=1&page_size=100")
    assert t_res.status_code == 200
    tickets = t_res.json()["items"]
    assert len(tickets) > 0


def test_simulator_lifecycle_and_tick(client):
    """Verify simulator controls: status, start, pause, resume, tick, speed, and events."""
    res = client.get("/api/simulation/status")
    assert res.status_code == 200
    assert "status" in res.json()

    res = client.post("/api/simulation/start")
    assert res.status_code == 200
    assert res.json()["status"] == "running"

    res = client.post("/api/simulation/tick")
    assert res.status_code == 200
    assert "event_type" in res.json()

    res = client.get("/api/simulation/events?limit=10")
    assert res.status_code == 200
    assert len(res.json()) >= 1

    res = client.post("/api/simulation/speed", json={"speed": 2.5, "interval_seconds": 4.0})
    assert res.status_code == 200
    assert res.json()["speed"] == 2.5

    res = client.post("/api/simulation/pause")
    assert res.status_code == 200
    assert res.json()["status"] == "paused"

    res = client.post("/api/simulation/resume")
    assert res.status_code == 200
    assert res.json()["status"] == "running"

    res = client.post("/api/simulation/stop")
    assert res.status_code == 200
    assert res.json()["status"] == "stopped"


def test_simulator_reset_preserves_csv_datasets(client):
    """Verify that resetting simulator demo data does NOT contaminate or erase CSV-imported datasets."""
    csv_content = (
        "ticket_id,title,category,status,priority,created_at,resolution_deadline\n"
        "CSV-REAL-001,Production Outage,Technical,Open,Critical,2026-10-30T10:00:00Z,2026-10-30T14:00:00Z\n"
        "CSV-REAL-002,User Refund,Billing,Open,Medium,2026-10-30T09:00:00Z,2026-10-31T09:00:00Z\n"
    )
    import_res = client.post(
        "/api/datasets/import",
        json={
            "csv_text": csv_content,
            "mapping": {
                "ticket_id": "ticket_id",
                "title": "title",
                "category": "category",
                "status": "status",
                "priority": "priority",
                "created_at": "created_at",
                "resolution_deadline": "resolution_deadline",
            },
            "dataset_name": "Isolated Real CSV Dataset",
        },
    )
    assert import_res.status_code == 201
    real_dataset_id = import_res.json()["dataset_id"]

    reset_res = client.post("/api/simulation/reset")
    assert reset_res.status_code == 200

    check_res = client.get(f"/api/datasets/{real_dataset_id}")
    assert check_res.status_code == 200
    assert check_res.json()["total_rows"] == 2

