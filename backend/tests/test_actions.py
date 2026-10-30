"""Automated tests for Task 5: Persistent Action Tracking & Execution Status."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from backend.models import Dataset, ImportedTicket, ManagerDecision, TrackedAction, ActionStatusHistory
from backend.tests.conftest import TestingSessionLocal


@pytest.fixture
def action_test_data(test_db):
    """Seed dataset, ticket, and decisions (approved, rejected, modified) for action tests."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)

    ds = Dataset(
        id="ds_action_test",
        name="Action Tracking Test Dataset",
        source_filename="actions_data.csv",
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
        id="ds_action_test:T101",
        dataset_id="ds_action_test",
        source_ticket_id="T101",
        title="Payment gateway timeout",
        status="Open",
        priority="Critical",
        category="Payments",
        created_at=ref_time - timedelta(hours=8),
        resolution_deadline=ref_time + timedelta(hours=2),
        assigned_team_id="team-a",
    )
    test_db.add(t1)

    # Approved decision
    d_approved = ManagerDecision(
        id="dec_approved_1",
        dataset_id="ds_action_test",
        recommendation_id="rec:ds_action_test:T101:resolution_deadline",
        source_ticket_id="T101",
        decision_type="approved",
        original_recommendation_snapshot={
            "id": "rec:ds_action_test:T101:resolution_deadline",
            "recommendation_type": "prioritize_ticket",
            "proposed_action": "Immediate lead escalation and priority remediation to contain SLA breach penalties.",
            "suggested_team_id": None,
            "risk_score": 95.0,
            "sla_target": "resolution_deadline",
        },
        manager_action=None,
        reason="Approved priority triage by ops manager.",
        manager_id="manager_prakhar",
        created_at=ref_time,
        is_effective=True,
    )

    # Rejected decision
    d_rejected = ManagerDecision(
        id="dec_rejected_1",
        dataset_id="ds_action_test",
        recommendation_id="rec:ds_action_test:T101:resolution_deadline",
        source_ticket_id="T101",
        decision_type="rejected",
        original_recommendation_snapshot={
            "id": "rec:ds_action_test:T101:resolution_deadline",
            "recommendation_type": "prioritize_ticket",
            "proposed_action": "Prioritize ticket",
        },
        manager_action=None,
        reason="Upstream provider incident already resolved.",
        manager_id="manager_ansh",
        created_at=ref_time,
        is_effective=True,
    )

    # Modified decision
    d_modified = ManagerDecision(
        id="dec_modified_1",
        dataset_id="ds_action_test",
        recommendation_id="rec:ds_action_test:T101:resolution_deadline",
        source_ticket_id="T101",
        decision_type="modified",
        original_recommendation_snapshot={
            "id": "rec:ds_action_test:T101:resolution_deadline",
            "recommendation_type": "reassign_ticket",
            "proposed_action": "Reassign to Team B",
        },
        manager_action={
            "action": "reassign_to_specialist",
            "target_team_id": "team-specialists",
            "specialist_instruction": "Assign to Tier 3 on-call SME immediately",
        },
        reason="Tier 2 squad lacks database access; routing directly to Tier 3 specialists.",
        manager_id="manager_prakhar",
        created_at=ref_time,
        is_effective=True,
    )

    test_db.add_all([d_approved, d_rejected, d_modified])
    test_db.commit()
    return ds


def test_action_created_from_approved_decision(client: TestClient, action_test_data):
    """Test 1: Action can be created from an approved decision."""
    payload = {
        "dataset_id": action_test_data.id,
        "decision_id": "dec_approved_1",
        "actor_id": "operator_prakhar",
        "notes": "Dispatching to operational queue",
    }
    res = client.post("/api/actions", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["id"].startswith("act_")
    assert data["dataset_id"] == action_test_data.id
    assert data["decision_id"] == "dec_approved_1"
    assert data["recommendation_id"] == "rec:ds_action_test:T101:resolution_deadline"
    assert data["source_ticket_id"] == "T101"
    assert data["current_status"] == "pending"
    assert data["completed_at"] is None
    assert data["action_type"] == "prioritize_ticket"
    assert "Immediate lead escalation" in data["action_payload"]["proposed_action"]

    # Retrieve single action
    get_res = client.get(f"/api/actions/{data['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == data["id"]
    assert get_res.json()["current_status"] == "pending"


def test_action_cannot_be_created_from_rejected_decision(client: TestClient, action_test_data):
    """Test 2: Action cannot be created from a rejected decision."""
    payload = {
        "dataset_id": action_test_data.id,
        "decision_id": "dec_rejected_1",
    }
    res = client.post("/api/actions", json=payload)
    assert res.status_code == 400
    assert "Cannot create an executable action from a rejected decision" in res.json()["detail"]


def test_modified_decision_creates_revised_action(client: TestClient, action_test_data):
    """Test 3: Modified decision creates the revised action, not the original action."""
    payload = {
        "dataset_id": action_test_data.id,
        "decision_id": "dec_modified_1",
        "actor_id": "operator_ansh",
    }
    res = client.post("/api/actions", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["action_type"] == "reassign_to_specialist"
    assert data["action_payload"]["target_team_id"] == "team-specialists"
    assert data["action_payload"]["specialist_instruction"] == "Assign to Tier 3 on-call SME immediately"


def test_duplicate_action_creation_prevented(client: TestClient, action_test_data):
    """Test 4: Duplicate creation for the same decision is prevented (409 Conflict)."""
    payload = {
        "dataset_id": action_test_data.id,
        "decision_id": "dec_approved_1",
    }
    res1 = client.post("/api/actions", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/actions", json=payload)
    assert res2.status_code == 409
    assert "already exists for decision" in res2.json()["detail"]


def test_valid_status_transitions_succeed(client: TestClient, action_test_data):
    """Test 5 & 7: Valid status transitions succeed (pending -> in_progress -> completed) and set completed_at."""
    res_create = client.post(
        "/api/actions",
        json={"dataset_id": action_test_data.id, "decision_id": "dec_approved_1"},
    )
    action_id = res_create.json()["id"]

    # Step 1: pending -> in_progress
    res_in_prog = client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "in_progress", "actor_id": "operator_prakhar"},
    )
    assert res_in_prog.status_code == 200
    assert res_in_prog.json()["current_status"] == "in_progress"
    assert res_in_prog.json()["completed_at"] is None

    # Step 2: in_progress -> completed
    res_comp = client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "completed", "actor_id": "operator_prakhar"},
    )
    assert res_comp.status_code == 200
    assert res_comp.json()["current_status"] == "completed"
    assert res_comp.json()["completed_at"] is not None


def test_invalid_status_transitions_rejected(client: TestClient, action_test_data):
    """Test 6: Invalid transitions are rejected with 400 Bad Request."""
    res_create = client.post(
        "/api/actions",
        json={"dataset_id": action_test_data.id, "decision_id": "dec_approved_1"},
    )
    action_id = res_create.json()["id"]

    # pending -> completed directly (not allowed without being in_progress)
    res_invalid1 = client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "completed"},
    )
    assert res_invalid1.status_code == 400
    assert "Invalid status transition" in res_invalid1.json()["detail"]

    # Move to in_progress -> completed
    client.patch(f"/api/actions/{action_id}/status", json={"new_status": "in_progress"})
    client.patch(f"/api/actions/{action_id}/status", json={"new_status": "completed"})

    # completed -> in_progress (terminal state)
    res_invalid2 = client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "in_progress"},
    )
    assert res_invalid2.status_code == 400
    assert "Invalid status transition" in res_invalid2.json()["detail"]


def test_failure_requires_a_reason(client: TestClient, action_test_data):
    """Test 8: Transitioning to failed requires a non-empty reason (422)."""
    res_create = client.post(
        "/api/actions",
        json={"dataset_id": action_test_data.id, "decision_id": "dec_approved_1"},
    )
    action_id = res_create.json()["id"]
    client.patch(f"/api/actions/{action_id}/status", json={"new_status": "in_progress"})

    # Failed without reason -> 422
    res_fail_no_reason = client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "failed", "reason": "   "},
    )
    assert res_fail_no_reason.status_code == 422
    assert "Reason is required" in res_fail_no_reason.json()["detail"]

    # Failed with valid reason -> 200
    res_fail_valid = client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "failed", "reason": "Target squad queue was at hard capacity limit"},
    )
    assert res_fail_valid.status_code == 200
    assert res_fail_valid.json()["current_status"] == "failed"
    assert res_fail_valid.json()["reason"] == "Target squad queue was at hard capacity limit"


def test_cancellation_requires_a_reason(client: TestClient, action_test_data):
    """Test 9: Transitioning to cancelled requires a non-empty reason (422)."""
    res_create = client.post(
        "/api/actions",
        json={"dataset_id": action_test_data.id, "decision_id": "dec_approved_1"},
    )
    action_id = res_create.json()["id"]

    # Cancelled without reason -> 422
    res_cancel_no_reason = client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "cancelled", "reason": None},
    )
    assert res_cancel_no_reason.status_code == 422
    assert "Reason is required" in res_cancel_no_reason.json()["detail"]

    # Cancelled with valid reason -> 200
    res_cancel_valid = client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "cancelled", "reason": "Customer withdrew incident report"},
    )
    assert res_cancel_valid.status_code == 200
    assert res_cancel_valid.json()["current_status"] == "cancelled"


def test_status_transitions_append_history_and_preserve_earlier(client: TestClient, action_test_data):
    """Test 10 & 11: Every valid transition appends history, leaving previous history unchanged."""
    res_create = client.post(
        "/api/actions",
        json={"dataset_id": action_test_data.id, "decision_id": "dec_approved_1"},
    )
    action_id = res_create.json()["id"]

    # Step 1: in_progress
    client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "in_progress", "reason": "Engineer picked up ticket", "actor_id": "agent_007"},
    )

    # Step 2: completed
    client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "completed", "reason": "Work completed successfully", "actor_id": "agent_007"},
    )

    # Retrieve history
    res_hist = client.get(f"/api/actions/{action_id}/history")
    assert res_hist.status_code == 200
    history = res_hist.json()

    assert len(history) == 3
    # Entry 0: initial creation
    assert history[0]["previous_status"] is None
    assert history[0]["new_status"] == "pending"

    # Entry 1: in_progress
    assert history[1]["previous_status"] == "pending"
    assert history[1]["new_status"] == "in_progress"
    assert history[1]["reason"] == "Engineer picked up ticket"

    # Entry 2: completed
    assert history[2]["previous_status"] == "in_progress"
    assert history[2]["new_status"] == "completed"
    assert history[2]["reason"] == "Work completed successfully"


def test_cross_dataset_action_rejected(test_db, client: TestClient, action_test_data):
    """Test 12: Cross-dataset references are rejected with 400 Bad Request."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    other_ds = Dataset(
        id="ds_other_actions",
        name="Other Dataset",
        source_filename="other.csv",
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
    test_db.add(other_ds)
    test_db.commit()

    # Supply other_ds.id with dec_approved_1 (which belongs to action_test_data.id)
    res = client.post(
        "/api/actions",
        json={"dataset_id": other_ds.id, "decision_id": "dec_approved_1"},
    )
    assert res.status_code == 400
    assert "Cross-dataset action reference rejected" in res.json()["detail"]


def test_action_and_history_survive_new_database_session(client: TestClient, action_test_data):
    """Test 13: Action and history survive a new database session."""
    res_create = client.post(
        "/api/actions",
        json={"dataset_id": action_test_data.id, "decision_id": "dec_approved_1"},
    )
    action_id = res_create.json()["id"]

    client.patch(
        f"/api/actions/{action_id}/status",
        json={"new_status": "in_progress", "reason": "Moving into active execution"},
    )

    # Open fresh separate session and check persistence
    fresh_session = TestingSessionLocal()
    try:
        persisted_action = fresh_session.query(TrackedAction).filter(TrackedAction.id == action_id).first()
        assert persisted_action is not None
        assert persisted_action.current_status == "in_progress"

        persisted_history = (
            fresh_session.query(ActionStatusHistory)
            .filter(ActionStatusHistory.action_id == action_id)
            .all()
        )
        assert len(persisted_history) == 2
    finally:
        fresh_session.close()


def test_dataset_actions_pagination_and_filter(client: TestClient, action_test_data):
    """Test dataset actions retrieval with pagination and status filter."""
    # Create action 1 from dec_approved_1
    client.post(
        "/api/actions",
        json={"dataset_id": action_test_data.id, "decision_id": "dec_approved_1"},
    )
    # Create action 2 from dec_modified_1
    res2 = client.post(
        "/api/actions",
        json={"dataset_id": action_test_data.id, "decision_id": "dec_modified_1"},
    )
    a2_id = res2.json()["id"]

    # Transition action 2 to in_progress
    client.patch(f"/api/actions/{a2_id}/status", json={"new_status": "in_progress"})

    # Filter by status = pending
    res_pending = client.get(f"/api/datasets/{action_test_data.id}/actions?status=pending")
    assert res_pending.status_code == 200
    assert res_pending.json()["total"] == 1
    assert res_pending.json()["items"][0]["current_status"] == "pending"

    # Filter by status = in_progress
    res_in_prog = client.get(f"/api/datasets/{action_test_data.id}/actions?status=in_progress")
    assert res_in_prog.status_code == 200
    assert res_in_prog.json()["total"] == 1
    assert res_in_prog.json()["items"][0]["current_status"] == "in_progress"

