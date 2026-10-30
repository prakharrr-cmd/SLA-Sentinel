"""Automated tests for Task 4: Persistent Manager Decisions & Audit Trail."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from backend.models import Dataset, ImportedTicket, ManagerDecision
from backend.tests.conftest import TestingSessionLocal


@pytest.fixture
def decision_test_dataset(test_db):
    """Seed a dataset and active tickets for manager decision tests."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)

    ds = Dataset(
        id="ds_decision_test",
        name="Decision Audit Test Dataset",
        source_filename="decision_data.csv",
        file_format="csv",
        created_at=ref_time - timedelta(days=1),
        snapshot_at=ref_time,
        status="completed",
        total_rows=3,
        accepted_rows=3,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={},
        validation_summary={},
    )
    test_db.add(ds)

    t1 = ImportedTicket(
        id="ds_decision_test:T101",
        dataset_id="ds_decision_test",
        source_ticket_id="T101",
        title="Payment webhook failure",
        status="Open",
        priority="High",
        category="Payments",
        created_at=ref_time - timedelta(hours=8),
        resolution_deadline=ref_time + timedelta(hours=2),
        assigned_team_id="team-a",
    )
    t2 = ImportedTicket(
        id="ds_decision_test:T102",
        dataset_id="ds_decision_test",
        source_ticket_id="T102",
        title="Database lock escalation",
        status="Pending",
        priority="Critical",
        category="Infrastructure",
        created_at=ref_time - timedelta(hours=10),
        resolution_deadline=ref_time - timedelta(hours=1),
        assigned_team_id="team-c",
    )
    test_db.add_all([t1, t2])
    test_db.commit()
    return ds


def test_approve_decision_persists_and_retrieves(client: TestClient, decision_test_dataset):
    """Test 1: Approve decision persists and can be retrieved."""
    rec_id = f"rec:{decision_test_dataset.id}:T101:resolution_deadline"
    payload = {
        "dataset_id": decision_test_dataset.id,
        "recommendation_id": rec_id,
        "source_ticket_id": "T101",
        "decision_type": "approved",
        "reason": "Agreed with fast-tracking payment webhook triage.",
        "manager_id": "manager_prakhar",
        "original_recommendation": {
            "id": rec_id,
            "recommendation_type": "prioritize_ticket",
            "proposed_action": "Prioritize ticket within assigned squad.",
            "risk_score": 80.0,
        },
    }

    res = client.post("/api/decisions", json=payload)
    assert res.status_code == 201
    data = res.json()

    decision_id = data["id"]
    assert decision_id.startswith("dec_")
    assert data["decision_type"] == "approved"
    assert data["is_effective"] is True
    assert data["manager_id"] == "manager_prakhar"
    assert data["original_recommendation_snapshot"]["risk_score"] == 80.0

    # Retrieve single decision
    res_get = client.get(f"/api/decisions/{decision_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == decision_id
    assert res_get.json()["reason"] == "Agreed with fast-tracking payment webhook triage."


def test_reject_decision_persists_with_reason(client: TestClient, decision_test_dataset):
    """Test 2: Reject decision persists with its reason."""
    rec_id = f"rec:{decision_test_dataset.id}:T102:resolution_deadline"
    payload = {
        "dataset_id": decision_test_dataset.id,
        "recommendation_id": rec_id,
        "source_ticket_id": "T102",
        "decision_type": "rejected",
        "reason": "Infrastructure team is already coordinating with upstream database provider.",
        "manager_id": "manager_ansh",
    }

    res = client.post("/api/decisions", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["decision_type"] == "rejected"
    assert data["reason"] == "Infrastructure team is already coordinating with upstream database provider."
    assert data["is_effective"] is True


def test_modified_decision_preserves_original_and_revised_action(client: TestClient, decision_test_dataset):
    """Test 3: Modified decision preserves the original recommendation and the revised action."""
    rec_id = f"rec:{decision_test_dataset.id}:T101:resolution_deadline"
    payload = {
        "dataset_id": decision_test_dataset.id,
        "recommendation_id": rec_id,
        "source_ticket_id": "T101",
        "decision_type": "modified",
        "reason": "Routing to senior payments specialist rather than junior triage queue.",
        "manager_action": {
            "action": "reassign",
            "target_team_id": "team-specialists",
            "override_priority": "Critical",
        },
        "original_recommendation": {
            "id": rec_id,
            "recommendation_type": "reassign_ticket",
            "proposed_action": "Reassign to Team B",
        },
    }

    res = client.post("/api/decisions", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["decision_type"] == "modified"
    assert data["original_recommendation_snapshot"]["proposed_action"] == "Reassign to Team B"
    assert data["manager_action"]["target_team_id"] == "team-specialists"
    assert data["reason"] == "Routing to senior payments specialist rather than junior triage queue."


def test_decision_history_retains_earlier_records_after_revision(client: TestClient, decision_test_dataset):
    """Test 4: Decision history retains earlier records after a later revision."""
    rec_id = f"rec:{decision_test_dataset.id}:T101:resolution_deadline"

    # Step 1: First decision (Approved)
    res1 = client.post(
        "/api/decisions",
        json={
            "dataset_id": decision_test_dataset.id,
            "recommendation_id": rec_id,
            "source_ticket_id": "T101",
            "decision_type": "approved",
            "reason": "Initial approval",
        },
    )
    assert res1.status_code == 201
    d1 = res1.json()

    # Step 2: Revised decision (Modified)
    res2 = client.post(
        "/api/decisions",
        json={
            "dataset_id": decision_test_dataset.id,
            "recommendation_id": rec_id,
            "source_ticket_id": "T101",
            "decision_type": "modified",
            "reason": "Revising earlier approval due to new customer SLA context",
            "manager_action": {"action": "escalate_to_director"},
        },
    )
    assert res2.status_code == 201
    d2 = res2.json()

    assert d2["previous_decision_id"] == d1["id"]
    assert d2["is_effective"] is True

    # Step 3: Verify d1 is still intact in history but marked is_effective = False
    get_d1 = client.get(f"/api/decisions/{d1['id']}").json()
    assert get_d1["is_effective"] is False
    assert get_d1["reason"] == "Initial approval"

    # Step 4: Verify recommendation audit trail returns both decisions in order
    history_res = client.get(f"/api/recommendations/{rec_id}/decisions")
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) == 2
    assert history[0]["id"] == d1["id"]
    assert history[0]["is_effective"] is False
    assert history[1]["id"] == d2["id"]
    assert history[1]["is_effective"] is True


def test_invalid_decision_type_rejected(client: TestClient, decision_test_dataset):
    """Test 5: Invalid decision type is rejected with 400 Bad Request."""
    res = client.post(
        "/api/decisions",
        json={
            "dataset_id": decision_test_dataset.id,
            "recommendation_id": f"rec:{decision_test_dataset.id}:T101:resolution_deadline",
            "source_ticket_id": "T101",
            "decision_type": "invalid_action_type",
        },
    )
    assert res.status_code == 400
    assert "Invalid decision_type" in res.json()["detail"]


def test_required_reason_validation_works(client: TestClient, decision_test_dataset):
    """Test 6: Required reason validation for rejected and modified decisions."""
    # Rejected without reason -> 422
    res_reject = client.post(
        "/api/decisions",
        json={
            "dataset_id": decision_test_dataset.id,
            "recommendation_id": f"rec:{decision_test_dataset.id}:T101:resolution_deadline",
            "source_ticket_id": "T101",
            "decision_type": "rejected",
            "reason": "   ",  # whitespace only
        },
    )
    assert res_reject.status_code == 422
    assert "Reason is required" in res_reject.json()["detail"]

    # Modified without manager_action -> 422
    res_mod = client.post(
        "/api/decisions",
        json={
            "dataset_id": decision_test_dataset.id,
            "recommendation_id": f"rec:{decision_test_dataset.id}:T101:resolution_deadline",
            "source_ticket_id": "T101",
            "decision_type": "modified",
            "reason": "Valid reason provided",
            "manager_action": None,
        },
    )
    assert res_mod.status_code == 422
    assert "manager_action is required" in res_mod.json()["detail"]


def test_unknown_dataset_or_ticket_returns_appropriate_error(client: TestClient, decision_test_dataset):
    """Test 7: Unknown dataset or recommendation returns 404."""
    # Unknown dataset
    res_ds = client.post(
        "/api/decisions",
        json={
            "dataset_id": "ds_nonexistent_999",
            "recommendation_id": "rec:ds_nonexistent_999:T101:resolution_deadline",
            "source_ticket_id": "T101",
            "decision_type": "approved",
        },
    )
    assert res_ds.status_code == 404
    assert "Dataset 'ds_nonexistent_999' not found" in res_ds.json()["detail"]

    # Unknown ticket in dataset
    res_tk = client.post(
        "/api/decisions",
        json={
            "dataset_id": decision_test_dataset.id,
            "recommendation_id": f"rec:{decision_test_dataset.id}:T_UNKNOWN:resolution_deadline",
            "source_ticket_id": "T_UNKNOWN",
            "decision_type": "approved",
        },
    )
    assert res_tk.status_code == 404
    assert "not found in dataset" in res_tk.json()["detail"]


def test_cross_dataset_references_rejected(test_db, client: TestClient, decision_test_dataset):
    """Test 8: Cross-dataset recommendation/ticket references are rejected with 400."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    ds_b = Dataset(
        id="ds_b_other",
        name="Dataset B",
        source_filename="b.csv",
        file_format="csv",
        created_at=ref_time,
        snapshot_at=ref_time,
        status="completed",
        total_rows=1,
        accepted_rows=1,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={},
        validation_summary={},
    )
    test_db.add(ds_b)
    test_db.commit()

    # Pass recommendation_id pointing to ds_b while dataset_id is decision_test_dataset.id
    res = client.post(
        "/api/decisions",
        json={
            "dataset_id": decision_test_dataset.id,
            "recommendation_id": f"rec:{ds_b.id}:T101:resolution_deadline",
            "source_ticket_id": "T101",
            "decision_type": "approved",
        },
    )
    assert res.status_code == 400
    assert "Cross-dataset recommendation reference rejected" in res.json()["detail"]


def test_idempotent_repeated_submission(client: TestClient, decision_test_dataset):
    """Test 9: Repeated submission with idempotency_key returns identical record without duplicates."""
    rec_id = f"rec:{decision_test_dataset.id}:T101:resolution_deadline"
    idempotency_token = "client_txn_key_abc_123"

    payload = {
        "dataset_id": decision_test_dataset.id,
        "recommendation_id": rec_id,
        "source_ticket_id": "T101",
        "decision_type": "approved",
        "reason": "Idempotent approval test",
        "idempotency_key": idempotency_token,
    }

    res1 = client.post("/api/decisions", json=payload)
    assert res1.status_code == 201
    d1 = res1.json()

    # Submit second time with same idempotency key
    res2 = client.post("/api/decisions", json=payload)
    assert res2.status_code == 200 or res2.status_code == 201
    d2 = res2.json()

    assert d1["id"] == d2["id"]
    assert d2["idempotency_key"] == idempotency_token

    # Verify dataset decisions count is 1
    ds_res = client.get(f"/api/datasets/{decision_test_dataset.id}/decisions")
    assert ds_res.json()["total"] == 1


def test_persistence_across_separate_session(client: TestClient, decision_test_dataset):
    """Test 10 & 11: Decision records remain available in a fresh database session."""
    rec_id = f"rec:{decision_test_dataset.id}:T101:resolution_deadline"

    res = client.post(
        "/api/decisions",
        json={
            "dataset_id": decision_test_dataset.id,
            "recommendation_id": rec_id,
            "source_ticket_id": "T101",
            "decision_type": "approved",
            "reason": "Testing transactional session commit",
        },
    )
    assert res.status_code == 201
    d_id = res.json()["id"]

    # Open completely separate database session and query directly
    fresh_session = TestingSessionLocal()
    try:
        persisted = fresh_session.query(ManagerDecision).filter(ManagerDecision.id == d_id).first()
        assert persisted is not None
        assert persisted.id == d_id
        assert persisted.decision_type == "approved"
        assert persisted.reason == "Testing transactional session commit"
        assert persisted.is_effective is True
    finally:
        fresh_session.close()


def test_dataset_decisions_pagination_and_filters(client: TestClient, decision_test_dataset):
    """Verify GET /api/datasets/{dataset_id}/decisions with pagination and filtering."""
    # Create two decisions for T101 and T102
    client.post(
        "/api/decisions",
        json={
            "dataset_id": decision_test_dataset.id,
            "recommendation_id": f"rec:{decision_test_dataset.id}:T101:resolution_deadline",
            "source_ticket_id": "T101",
            "decision_type": "approved",
            "reason": "Approved",
        },
    )
    client.post(
        "/api/decisions",
        json={
            "dataset_id": decision_test_dataset.id,
            "recommendation_id": f"rec:{decision_test_dataset.id}:T102:resolution_deadline",
            "source_ticket_id": "T102",
            "decision_type": "rejected",
            "reason": "Rejected with reason",
        },
    )

    # Filter by decision_type
    res_app = client.get(f"/api/datasets/{decision_test_dataset.id}/decisions?decision_type=approved")
    assert res_app.status_code == 200
    app_data = res_app.json()
    assert app_data["total"] == 1
    assert app_data["items"][0]["decision_type"] == "approved"

    # Filter by source_ticket_id
    res_t102 = client.get(f"/api/datasets/{decision_test_dataset.id}/decisions?source_ticket_id=T102")
    assert res_t102.status_code == 200
    assert res_t102.json()["total"] == 1
    assert res_t102.json()["items"][0]["source_ticket_id"] == "T102"
