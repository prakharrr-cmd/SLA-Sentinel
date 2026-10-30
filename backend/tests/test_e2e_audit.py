"""Comprehensive End-to-End Testing and Data Integrity Audit (Task 8).

Validates the full operational workflow, cross-dataset isolation, edge cases,
failure resilience, schema boundaries, and empirical evaluation invariants.
"""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from backend.models import (
    Dataset,
    ImportedTicket,
    ManagerDecision,
    TrackedAction,
    ActionStatusHistory,
    EvaluationSnapshot,
)
from backend.tests.conftest import TestingSessionLocal


# =========================================================================
# PHASE 1: 20-STEP END-TO-END WORKFLOW TEST
# =========================================================================

def test_full_20_step_e2e_workflow(client, test_db):
    """Execute the complete 20-step SLA Sentinel operational workflow."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    ref_iso = ref_time.isoformat()

    # Step 1: Upload a CSV dataset (with 5 valid rows and 1 duplicate row)
    csv_raw = (
        "ticket_id,created_at,status,priority,category,assigned_team,title,resolution_deadline,response_deadline,resolved_at,resolution_duration,response_duration\n"
        "T1,2026-10-30T06:00:00Z,Open,Critical,Payments,team-a,Payment webhook down,2026-10-30T10:00:00Z,2026-10-30T07:00:00Z,,0.0,0.5\n"
        "T2,2026-10-30T07:00:00Z,Open,High,Database,team-b,Database latency spike,2026-10-30T13:00:00Z,2026-10-30T08:00:00Z,,0.0,0.8\n"
        "T3,2026-10-30T08:00:00Z,In Progress,Medium,General,team-c,UI glitch in header,2026-10-30T16:00:00Z,2026-10-30T09:00:00Z,,0.0,0.2\n"
        "T4,2026-10-30T04:00:00Z,Closed,High,Payments,team-a,Duplicate billing alert,2026-10-30T08:00:00Z,2026-10-30T05:00:00Z,2026-10-30T07:30:00Z,3.5,0.4\n"
        "T5,2026-10-30T02:00:00Z,Resolved,Critical,Infrastructure,team-b,Server crashed,2026-10-30T06:00:00Z,2026-10-30T03:00:00Z,2026-10-30T08:00:00Z,6.0,0.9\n"
        "T1,2026-10-30T06:00:00Z,Open,Critical,Payments,team-a,Duplicate row of T1,2026-10-30T10:00:00Z,2026-10-30T07:00:00Z,,0.0,0.5\n"
    )

    # Step 2: Preview detected columns and sample rows
    preview_res = client.post("/api/datasets/preview", data={"csv_text": csv_raw})
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["total_rows"] == 6
    assert "ticket_id" in preview_data["detected_columns"]
    assert len(preview_data["preview_rows"]) == 6
    upload_id = preview_data["upload_id"]

    # Step 3: Map canonical fields
    mapping = {
        "ticket_id": "ticket_id",
        "created_at": "created_at",
        "status": "status",
        "priority": "priority",
        "category": "category",
        "assigned_team": "assigned_team_id",
        "title": "title",
        "resolution_deadline": "resolution_deadline",
        "response_deadline": "response_deadline",
        "resolved_at": "resolved_at",
        "resolution_duration": "resolution_duration",
        "response_duration": "response_duration",
    }

    # Step 4: Import the dataset
    import_res = client.post(
        "/api/datasets/import",
        json={
            "upload_id": upload_id,
            "mapping": mapping,
            "dataset_name": "E2E Workflow Dataset",
            "selected_sla_target": "resolution_deadline",
        },
    )
    assert import_res.status_code == 201
    import_data = import_res.json()
    ds_id = import_data["dataset_id"]

    # Step 5: Confirm accepted / rejected row counts (5 accepted, 1 rejected duplicate)
    assert import_data["total_rows"] == 6
    assert import_data["accepted_rows"] == 5
    assert import_data["rejected_rows"] == 1
    assert len(import_data["validation_errors"]) == 1
    assert import_data["validation_errors"][0]["field"] == "ticket_id"

    # Step 6: Open the imported dataset
    ds_res = client.get(f"/api/datasets/{ds_id}")
    assert ds_res.status_code == 200
    assert ds_res.json()["id"] == ds_id

    tickets_res = client.get(f"/api/datasets/{ds_id}/tickets?page=1&page_size=10")
    assert tickets_res.status_code == 200
    assert tickets_res.json()["total"] == 5

    # Step 7: Verify analytics and SLA coverage
    analytics_res = client.get(f"/api/analytics/{ds_id}", params={"reference_time": ref_iso})
    assert analytics_res.status_code == 200
    analytics_data = analytics_res.json()
    assert analytics_data["dataset_summary"]["total_imported_tickets"] == 5
    assert analytics_data["sla_performance"]["resolution_sla"]["coverage_rate"] == 1.0

    # Step 8: Open risk queue and switch between Resolution SLA and Response SLA
    res_risks = client.get(f"/api/risks/{ds_id}", params={"target": "resolution", "reference_time": ref_iso})
    assert res_risks.status_code == 200
    assert res_risks.json()["sla_target"] == "resolution_deadline"
    assert len(res_risks.json()["items"]) == 5

    resp_risks = client.get(f"/api/risks/{ds_id}", params={"target": "response", "reference_time": ref_iso})
    assert resp_risks.status_code == 200
    assert resp_risks.json()["sla_target"] == "response_deadline"
    assert len(resp_risks.json()["items"]) == 5

    # Step 9: Open recommendations
    recs_res = client.get(f"/api/recommendations/{ds_id}", params={"target": "resolution", "reference_time": ref_iso})
    assert recs_res.status_code == 200
    recs = recs_res.json()["items"]
    assert len(recs) >= 2

    rec_1 = recs[0]
    rec_2 = recs[1]

    # Step 10: Approve one recommendation (rec_1)
    appr_res = client.post(
        "/api/decisions",
        json={
            "dataset_id": ds_id,
            "recommendation_id": rec_1["id"],
            "source_ticket_id": rec_1["ticket_id"],
            "decision_type": "approved",
            "reason": "Approved by E2E lead operator",
            "manager_id": "e2e_lead",
            "original_recommendation": rec_1,
        },
    )
    assert appr_res.status_code == 201
    dec_appr = appr_res.json()
    assert dec_appr["decision_type"] == "approved"

    # Step 11: Reject another recommendation with a reason (rec_2)
    rej_res = client.post(
        "/api/decisions",
        json={
            "dataset_id": ds_id,
            "recommendation_id": rec_2["id"],
            "source_ticket_id": rec_2["ticket_id"],
            "decision_type": "rejected",
            "reason": "Ticket handled via phone incident bridge",
            "manager_id": "e2e_lead",
            "original_recommendation": rec_2,
        },
    )
    assert rej_res.status_code == 201
    dec_rej = rej_res.json()
    assert dec_rej["decision_type"] == "rejected"

    # Step 12: Modify another recommendation with a reason (rec_1 revision)
    mod_res = client.post(
        "/api/decisions",
        json={
            "dataset_id": ds_id,
            "recommendation_id": rec_1["id"],
            "source_ticket_id": rec_1["ticket_id"],
            "decision_type": "modified",
            "reason": "Reassigning specifically to team-c with senior engineer pairing",
            "manager_action": {"suggested_team_id": "team-c", "sla_target": "resolution_deadline"},
            "manager_id": "e2e_lead",
            "original_recommendation": rec_1,
        },
    )
    assert mod_res.status_code == 201
    dec_mod = mod_res.json()
    assert dec_mod["decision_type"] == "modified"

    # Step 13: Verify decision history
    hist_res = client.get(f"/api/recommendations/{rec_1['id']}/decisions")
    assert hist_res.status_code == 200
    dec_history = hist_res.json()
    assert len(dec_history) == 2  # approved, then modified

    # Verify superseding: first decision is no longer effective, second (latest) is effective
    assert dec_history[0]["is_effective"] is False  # superseded approved decision
    assert dec_history[1]["is_effective"] is True   # latest modified decision

    # Step 14: Verify actions are created only for approved or modified decisions
    # Creating action for rejected decision must fail with 400
    act_fail_res = client.post(
        "/api/actions",
        json={
            "dataset_id": ds_id,
            "decision_id": dec_rej["id"],
            "actor_id": "e2e_lead",
        },
    )
    assert act_fail_res.status_code == 400
    assert "Cannot create an executable action from a rejected decision" in act_fail_res.json()["detail"]

    # Creating action for modified decision succeeds
    act_create_res = client.post(
        "/api/actions",
        json={
            "dataset_id": ds_id,
            "decision_id": dec_mod["id"],
            "actor_id": "e2e_lead",
            "notes": "Action from modified decision",
        },
    )
    assert act_create_res.status_code == 201
    action = act_create_res.json()
    act_id = action["id"]
    assert action["current_status"] == "pending"

    # Step 15: Update action status through valid transitions
    # pending -> in_progress
    trans_1 = client.patch(
        f"/api/actions/{act_id}/status",
        json={"new_status": "in_progress", "actor_id": "engineer_1"},
    )
    assert trans_1.status_code == 200
    assert trans_1.json()["current_status"] == "in_progress"

    # in_progress -> completed
    trans_2 = client.patch(
        f"/api/actions/{act_id}/status",
        json={"new_status": "completed", "actor_id": "engineer_1"},
    )
    assert trans_2.status_code == 200
    assert trans_2.json()["current_status"] == "completed"
    assert trans_2.json()["completed_at"] is not None

    # Step 16: Test failure/cancellation reasons (requires explanation)
    # Create another approved decision & action to test failure
    d_cancel = client.post(
        "/api/decisions",
        json={
            "dataset_id": ds_id,
            "recommendation_id": f"rec:{ds_id}:T4:resolution_deadline",
            "source_ticket_id": "T4",
            "decision_type": "approved",
            "reason": "Approved T4 escalation",
            "manager_id": "mgr",
            "original_recommendation": {"id": f"rec:{ds_id}:T4:resolution_deadline"},
        },
    ).json()

    a_cancel = client.post(
        "/api/actions",
        json={"dataset_id": ds_id, "decision_id": d_cancel["id"], "actor_id": "mgr"},
    ).json()

    # Cancel without reason -> 422 Unprocessable Content
    fail_no_reason = client.patch(
        f"/api/actions/{a_cancel['id']}/status",
        json={"new_status": "cancelled", "actor_id": "mgr"},
    )
    assert fail_no_reason.status_code == 422

    # Cancel with reason -> 200 OK
    succ_cancel = client.patch(
        f"/api/actions/{a_cancel['id']}/status",
        json={"new_status": "cancelled", "reason": "Redundant action", "actor_id": "mgr"},
    )
    assert succ_cancel.status_code == 200
    assert succ_cancel.json()["current_status"] == "cancelled"

    # Step 17: Verify action history (append-only transition log)
    act_hist_res = client.get(f"/api/actions/{act_id}/history")
    assert act_hist_res.status_code == 200
    act_hist = act_hist_res.json()
    assert len(act_hist) == 3  # initial creation (pending), pending->in_progress, in_progress->completed
    assert act_hist[0]["new_status"] == "pending"
    assert act_hist[1]["new_status"] == "in_progress"
    assert act_hist[2]["new_status"] == "completed"

    # Step 18: Open the outcome evaluation
    eval_res = client.get(f"/api/evaluations/{ds_id}", params={"reference_time": ref_iso})
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["dataset_id"] == ds_id
    assert eval_data["action_summary"]["total_approved_actions"] == 2
    assert eval_data["action_summary"]["completed_actions"] == 1
    assert "Observational before-and-after performance evaluation" in eval_data["observational_disclaimer"]

    # Step 19: Confirm action completion and ticket SLA outcome remain separate
    action_eval_res = client.get(f"/api/evaluations/{ds_id}/actions/{act_id}")
    assert action_eval_res.status_code == 200
    action_eval_data = action_eval_res.json()
    assert action_eval_data["is_action_completed"] is True
    # Action completion does not guarantee SLA attainment
    assert "does not guarantee SLA compliance" in action_eval_data["evidence"]

    # Step 20: Switch to another dataset and verify complete isolation
    ds2_res = client.post(
        "/api/datasets/import",
        json={
            "csv_text": (
                "ticket_id,created_at,status,priority\n"
                "ISO_1,2026-10-30T09:00:00Z,Open,Low\n"
            ),
            "mapping": {
                "ticket_id": "ticket_id",
                "created_at": "created_at",
                "status": "status",
                "priority": "priority",
            },
            "dataset_name": "Isolated Second Dataset",
        },
    )
    ds2_id = ds2_res.json()["dataset_id"]

    # Query DS2: actions, decisions, tickets must only show DS2 data
    ds2_tickets = client.get(f"/api/datasets/{ds2_id}/tickets").json()
    assert ds2_tickets["total"] == 1
    assert ds2_tickets["items"][0]["source_ticket_id"] == "ISO_1"

    ds2_actions = client.get(f"/api/datasets/{ds2_id}/actions").json()
    assert ds2_actions["total"] == 0

    ds2_decisions = client.get(f"/api/datasets/{ds2_id}/decisions").json()
    assert ds2_decisions["total"] == 0


# =========================================================================
# PHASE 2: DATA ISOLATION & INTEGRITY TESTS
# =========================================================================

def test_cross_dataset_isolation_enforcement(client, test_db):
    """Verify Dataset A cannot be mutated or referenced by Dataset B entities."""
    # Seed Dataset A
    ds_a = Dataset(id="ds_iso_a", name="Dataset A", source_filename="a.csv", file_format="csv", status="completed", total_rows=1, accepted_rows=1, rejected_rows=0, warning_count=0, applied_mapping={}, validation_summary={})
    t_a = ImportedTicket(id="ds_iso_a:TA1", dataset_id="ds_iso_a", source_ticket_id="TA1", status="Open", priority="High", created_at=datetime.now(timezone.utc))
    test_db.add_all([ds_a, t_a])

    # Seed Dataset B
    ds_b = Dataset(id="ds_iso_b", name="Dataset B", source_filename="b.csv", file_format="csv", status="completed", total_rows=1, accepted_rows=1, rejected_rows=0, warning_count=0, applied_mapping={}, validation_summary={})
    t_b = ImportedTicket(id="ds_iso_b:TB1", dataset_id="ds_iso_b", source_ticket_id="TB1", status="Open", priority="Low", created_at=datetime.now(timezone.utc))
    test_db.add_all([ds_b, t_b])

    # Seed decision in Dataset A
    dec_a = ManagerDecision(
        id="dec_iso_a1",
        dataset_id="ds_iso_a",
        recommendation_id="rec:ds_iso_a:TA1:resolution_deadline",
        source_ticket_id="TA1",
        decision_type="approved",
        original_recommendation_snapshot={},
        manager_id="mgr",
        is_effective=True,
    )
    test_db.add(dec_a)
    test_db.commit()

    # 1. Decision in Dataset B cannot reference a recommendation belonging to Dataset A
    cross_dec_res = client.post(
        "/api/decisions",
        json={
            "dataset_id": "ds_iso_b",
            "recommendation_id": "rec:ds_iso_a:TA1:resolution_deadline",
            "source_ticket_id": "TB1",
            "decision_type": "approved",
            "manager_id": "mgr",
        },
    )
    assert cross_dec_res.status_code == 400
    assert "Cross-dataset recommendation reference rejected" in cross_dec_res.json()["detail"]

    # 2. Action in Dataset B cannot reference a decision belonging to Dataset A
    cross_act_res = client.post(
        "/api/actions",
        json={
            "dataset_id": "ds_iso_b",
            "decision_id": "dec_iso_a1",
            "actor_id": "mgr",
        },
    )
    assert cross_act_res.status_code == 400
    assert "Cross-dataset action reference rejected" in cross_act_res.json()["detail"]

    # 3. Action evaluation under Dataset B for an action belonging to Dataset A is rejected
    act_a = TrackedAction(
        id="act_iso_a1",
        dataset_id="ds_iso_a",
        decision_id="dec_iso_a1",
        recommendation_id="rec:ds_iso_a:TA1:resolution_deadline",
        source_ticket_id="TA1",
        action_type="reassign_team",
        action_payload={},
        current_status="completed",
        actor_id="mgr",
        completed_at=datetime.now(timezone.utc),
    )
    test_db.add(act_a)
    test_db.commit()

    cross_eval_res = client.get("/api/evaluations/ds_iso_b/actions/act_iso_a1")
    assert cross_eval_res.status_code == 400
    assert "belongs to dataset 'ds_iso_a'" in cross_eval_res.json()["detail"]


def test_duplicate_action_prevention(client, test_db):
    """Verify duplicate action creation for the same decision returns 409 Conflict."""
    ds = Dataset(id="ds_dup_act", name="Dup Action DS", source_filename="x.csv", file_format="csv", status="completed", total_rows=1, accepted_rows=1, rejected_rows=0, warning_count=0, applied_mapping={}, validation_summary={})
    dec = ManagerDecision(id="dec_single", dataset_id="ds_dup_act", recommendation_id="rec:1", source_ticket_id="T1", decision_type="approved", original_recommendation_snapshot={}, manager_id="m", is_effective=True)
    test_db.add_all([ds, dec])
    test_db.commit()

    # First creation -> 201
    res1 = client.post("/api/actions", json={"dataset_id": "ds_dup_act", "decision_id": "dec_single", "actor_id": "m"})
    assert res1.status_code == 201

    # Second creation -> 409 Conflict
    res2 = client.post("/api/actions", json={"dataset_id": "ds_dup_act", "decision_id": "dec_single", "actor_id": "m"})
    assert res2.status_code == 409
    assert "already exists for decision" in res2.json()["detail"]


def test_idempotent_decision_creation(client, test_db):
    """Verify idempotent decision requests return the existing record without duplicates."""
    ds = Dataset(id="ds_idem", name="Idem DS", source_filename="x.csv", file_format="csv", status="completed", total_rows=1, accepted_rows=1, rejected_rows=0, warning_count=0, applied_mapping={}, validation_summary={})
    ticket = ImportedTicket(id="ds_idem:T1", dataset_id="ds_idem", source_ticket_id="T1", status="Open", priority="High", created_at=datetime.now(timezone.utc))
    test_db.add_all([ds, ticket])
    test_db.commit()

    payload = {
        "dataset_id": "ds_idem",
        "recommendation_id": "rec:ds_idem:T1:resolution_deadline",
        "source_ticket_id": "T1",
        "decision_type": "approved",
        "reason": "First attempt",
        "manager_id": "lead",
        "idempotency_key": "idem-key-12345",
    }

    r1 = client.post("/api/decisions", json=payload)
    assert r1.status_code == 201
    d1_id = r1.json()["id"]

    # Repeat with same idempotency key
    r2 = client.post("/api/decisions", json=payload)
    assert r2.status_code == 201
    d2_id = r2.json()["id"]
    assert d1_id == d2_id

    # Confirm only one decision in DB
    count = test_db.query(ManagerDecision).filter(ManagerDecision.dataset_id == "ds_idem").count()
    assert count == 1


def test_not_found_handling_across_all_endpoints(client):
    """Verify all routes return 404 for unknown dataset or resource IDs."""
    bogus = "ds_nonexistent_999"

    assert client.get(f"/api/datasets/{bogus}").status_code == 404
    assert client.get(f"/api/datasets/{bogus}/tickets").status_code == 404
    assert client.get(f"/api/analytics/{bogus}").status_code == 404
    assert client.get(f"/api/risks/{bogus}").status_code == 404
    assert client.get(f"/api/recommendations/{bogus}").status_code == 404
    assert client.get(f"/api/datasets/{bogus}/decisions").status_code == 404
    assert client.get(f"/api/datasets/{bogus}/actions").status_code == 404
    assert client.get(f"/api/evaluations/{bogus}").status_code == 404
    assert client.get(f"/api/actions/act_nonexistent").status_code == 404
    assert client.get(f"/api/decisions/dec_nonexistent").status_code == 404


# =========================================================================
# PHASE 3: FAILURE & EDGE-CASE TESTING
# =========================================================================

def test_empty_csv_and_whitespace_rejection(client):
    """Verify empty or whitespace-only CSV input is rejected cleanly."""
    res_empty = client.post("/api/datasets/preview", data={"csv_text": ""})
    assert res_empty.status_code == 400

    res_spaces = client.post("/api/datasets/preview", data={"csv_text": "   \n\t  \n"})
    assert res_spaces.status_code == 400


def test_missing_required_column_mappings_rejected(client):
    """Verify attempting to import without mandatory fields (ticket_id, status) is rejected."""
    csv_raw = "foo,bar\n123,hello\n"
    prev = client.post("/api/datasets/preview", data={"csv_text": csv_raw}).json()

    # Missing ticket_id, created_at, status
    res = client.post(
        "/api/datasets/import",
        json={
            "upload_id": prev["upload_id"],
            "mapping": {"foo": "title", "bar": "category"},
        },
    )
    assert res.status_code == 400
    assert "Mapping must include" in res.json()["detail"]


def test_dataset_with_no_deadlines_unscorable_coverage(client, test_db):
    """Verify dataset where all tickets lack deadlines returns coverage=0.0 and unscorable categories."""
    ds = Dataset(
        id="ds_no_deadlines",
        name="No Deadlines Dataset",
        source_filename="no_dl.csv",
        file_format="csv",
        status="completed",
        total_rows=2,
        accepted_rows=2,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={},
        validation_summary={},
    )
    t1 = ImportedTicket(id="ds_no_deadlines:T1", dataset_id="ds_no_deadlines", source_ticket_id="T1", status="Open", priority="High", created_at=datetime.now(timezone.utc), resolution_deadline=None)
    t2 = ImportedTicket(id="ds_no_deadlines:T2", dataset_id="ds_no_deadlines", source_ticket_id="T2", status="Open", priority="Low", created_at=datetime.now(timezone.utc), resolution_deadline=None)
    test_db.add_all([ds, t1, t2])
    test_db.commit()

    # Analytics SLA coverage
    analytics = client.get("/api/analytics/ds_no_deadlines").json()
    assert analytics["sla_performance"]["resolution_sla"]["coverage_rate"] == 0.0

    # Risk ranking
    risks = client.get("/api/risks/ds_no_deadlines", params={"target": "resolution"}).json()
    for item in risks["items"]:
        assert item["risk_category"] == "Unscorable"
        assert item["current_sla_state"] == "Unscorable"


def test_dataset_with_only_resolved_tickets(client, test_db):
    """Verify dataset with 100% resolved tickets returns no active at-risk tickets."""
    ref = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    ds = Dataset(id="ds_all_resolved", name="All Resolved DS", source_filename="res.csv", file_format="csv", status="completed", total_rows=1, accepted_rows=1, rejected_rows=0, warning_count=0, applied_mapping={}, validation_summary={})
    t = ImportedTicket(
        id="ds_all_resolved:T1",
        dataset_id="ds_all_resolved",
        source_ticket_id="T1",
        status="Closed",
        priority="Medium",
        created_at=ref - timedelta(hours=5),
        resolution_deadline=ref - timedelta(hours=2),
        resolved_at=ref - timedelta(hours=3),
        resolution_duration=2.0,
    )
    test_db.add_all([ds, t])
    test_db.commit()

    res = client.get("/api/analytics/ds_all_resolved", params={"reference_time": ref.isoformat()})
    assert res.status_code == 200
    analytics = res.json()
    assert analytics["sla_performance"]["resolution_sla"]["at_risk_count"] == 0
    assert analytics["sla_performance"]["resolution_sla"]["historical_met_sla_count"] == 1


def test_invalid_action_status_transitions_rejected(client, test_db):
    """Verify invalid action lifecycle transitions are blocked."""
    ds = Dataset(id="ds_trans", name="Trans DS", source_filename="t.csv", file_format="csv", status="completed", total_rows=1, accepted_rows=1, rejected_rows=0, warning_count=0, applied_mapping={}, validation_summary={})
    dec = ManagerDecision(id="dec_t1", dataset_id="ds_trans", recommendation_id="rec:1", source_ticket_id="T1", decision_type="approved", original_recommendation_snapshot={}, manager_id="m", is_effective=True)
    act = TrackedAction(id="act_t1", dataset_id="ds_trans", decision_id="dec_t1", recommendation_id="rec:1", source_ticket_id="T1", action_type="reassign_team", action_payload={}, current_status="completed", actor_id="m", completed_at=datetime.now(timezone.utc))
    test_db.add_all([ds, dec, act])
    test_db.commit()

    # Terminal action ('completed') cannot transition to 'in_progress' or 'cancelled'
    res = client.patch("/api/actions/act_t1/status", json={"new_status": "in_progress", "actor_id": "m"})
    assert res.status_code == 400
    assert "Invalid status transition" in res.json()["detail"]


def test_empty_dataset_evaluation_resilience(client, test_db):
    """Verify evaluation on an empty dataset produces 0 sample size without ZeroDivisionError."""
    ds = Dataset(id="ds_e2e_empty", name="Empty DS", source_filename="empty.csv", file_format="csv", status="completed", total_rows=0, accepted_rows=0, rejected_rows=0, warning_count=0, applied_mapping={}, validation_summary={})
    test_db.add(ds)
    test_db.commit()

    eval_res = client.get("/api/evaluations/ds_e2e_empty")
    assert eval_res.status_code == 200
    data = eval_res.json()
    assert data["action_summary"]["total_approved_actions"] == 0
    assert data["resolution_sla_evaluation"]["baseline"]["ticket_sample_size"] == 0
    assert data["resolution_sla_evaluation"]["baseline"]["compliance_rate"] is None
    assert any("Dataset contains 0 imported tickets" in lim for lim in data["limitations"])
