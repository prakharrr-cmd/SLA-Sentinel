"""Automated test suite for Task 6: Outcome Evaluation & SLA Performance Measurement."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from backend.models import (
    Dataset,
    ImportedTicket,
    ManagerDecision,
    TrackedAction,
    EvaluationSnapshot,
)
from backend.tests.conftest import TestingSessionLocal


@pytest.fixture
def eval_test_data(test_db):
    """Seed comprehensive dataset, tickets, decisions, and actions for evaluation tests."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    anchor_time = datetime(2026, 10, 30, 8, 0, 0, tzinfo=timezone.utc)

    ds = Dataset(
        id="ds_eval_1",
        name="Outcome Evaluation Dataset",
        source_filename="eval_tickets.csv",
        file_format="csv",
        created_at=ref_time - timedelta(days=2),
        snapshot_at=ref_time,
        status="completed",
        total_rows=6,
        accepted_rows=6,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={},
        validation_summary={},
    )
    test_db.add(ds)

    # 1. Baseline Ticket 1 (Met SLA in past)
    # Created 24h ago, deadline 12h ago, resolved 16h ago (before anchor)
    t1 = ImportedTicket(
        id="ds_eval_1:T101",
        dataset_id="ds_eval_1",
        source_ticket_id="T101",
        title="Checkout failure",
        status="Closed",
        priority="Critical",
        category="Payments",
        created_at=anchor_time - timedelta(hours=16),
        resolution_deadline=anchor_time - timedelta(hours=4),
        resolved_at=anchor_time - timedelta(hours=8),
        resolution_duration=8.0,
        response_deadline=anchor_time - timedelta(hours=14),
        response_duration=1.5,
        assigned_team_id="team-a",
    )
    test_db.add(t1)

    # 2. Baseline Ticket 2 (Breached in past)
    # Created 20h ago, deadline 10h ago, resolved 5h ago (before anchor)
    t2 = ImportedTicket(
        id="ds_eval_1:T102",
        dataset_id="ds_eval_1",
        source_ticket_id="T102",
        title="Database sync lag",
        status="Resolved",
        priority="High",
        category="Database",
        created_at=anchor_time - timedelta(hours=12),
        resolution_deadline=anchor_time - timedelta(hours=6),
        resolved_at=anchor_time - timedelta(hours=2),
        resolution_duration=10.0,
        response_deadline=anchor_time - timedelta(hours=10),
        response_duration=3.0,
        assigned_team_id="team-b",
    )
    test_db.add(t2)

    # 3. Post-Action Ticket 3 (Met SLA)
    # Created after anchor
    t3 = ImportedTicket(
        id="ds_eval_1:T103",
        dataset_id="ds_eval_1",
        source_ticket_id="T103",
        title="API 500 error",
        status="Closed",
        priority="Critical",
        category="Backend",
        created_at=anchor_time + timedelta(hours=1),
        resolution_deadline=anchor_time + timedelta(hours=5),
        resolved_at=anchor_time + timedelta(hours=3),
        resolution_duration=2.0,
        response_deadline=anchor_time + timedelta(hours=2),
        response_duration=0.5,
        assigned_team_id="team-a",
    )
    test_db.add(t3)

    # 4. Post-Action Ticket 4 (Active - In progress, deadline in future)
    t4 = ImportedTicket(
        id="ds_eval_1:T104",
        dataset_id="ds_eval_1",
        source_ticket_id="T104",
        title="Report export stuck",
        status="In Progress",
        priority="Medium",
        category="Reports",
        created_at=anchor_time + timedelta(hours=2),
        resolution_deadline=ref_time + timedelta(hours=4),
        resolved_at=None,
        resolution_duration=None,
        response_deadline=anchor_time + timedelta(hours=3),
        response_duration=0.8,
        assigned_team_id="team-c",
    )
    test_db.add(t4)

    # 5. Ticket with missing deadline (Tests data coverage limitations)
    t5 = ImportedTicket(
        id="ds_eval_1:T105",
        dataset_id="ds_eval_1",
        source_ticket_id="T105",
        title="General inquiry",
        status="Closed",
        priority="Low",
        category="General",
        created_at=anchor_time - timedelta(hours=5),
        resolution_deadline=None,
        resolved_at=anchor_time - timedelta(hours=1),
        resolution_duration=4.0,
        assigned_team_id=None,
    )
    test_db.add(t5)

    # Decisions and Actions
    # Decision 1 (Approved -> Action Completed)
    d1 = ManagerDecision(
        id="dec_eval_1",
        dataset_id="ds_eval_1",
        recommendation_id="rec:ds_eval_1:T101:resolution_deadline",
        source_ticket_id="T101",
        decision_type="approved",
        original_recommendation_snapshot={
            "id": "rec:ds_eval_1:T101:resolution_deadline",
            "sla_target": "resolution_deadline",
        },
        manager_id="manager_eval",
        created_at=anchor_time - timedelta(hours=1),
        is_effective=True,
    )
    test_db.add(d1)

    act1 = TrackedAction(
        id="act_eval_1",
        dataset_id="ds_eval_1",
        decision_id="dec_eval_1",
        recommendation_id="rec:ds_eval_1:T101:resolution_deadline",
        source_ticket_id="T101",
        action_type="reassign_team",
        action_payload={"sla_target": "resolution_deadline", "suggested_team_id": "team-a"},
        current_status="completed",
        actor_id="lead_1",
        created_at=anchor_time - timedelta(minutes=30),
        completed_at=anchor_time,
    )
    test_db.add(act1)

    # Decision 2 (Modified -> Action In Progress)
    d2 = ManagerDecision(
        id="dec_eval_2",
        dataset_id="ds_eval_1",
        recommendation_id="rec:ds_eval_1:T102:resolution_deadline",
        source_ticket_id="T102",
        decision_type="modified",
        original_recommendation_snapshot={
            "id": "rec:ds_eval_1:T102:resolution_deadline",
            "sla_target": "resolution_deadline",
        },
        manager_id="manager_eval",
        created_at=anchor_time - timedelta(hours=2),
        is_effective=True,
    )
    test_db.add(d2)

    act2 = TrackedAction(
        id="act_eval_2",
        dataset_id="ds_eval_1",
        decision_id="dec_eval_2",
        recommendation_id="rec:ds_eval_1:T102:resolution_deadline",
        source_ticket_id="T102",
        action_type="prioritize_ticket",
        action_payload={"sla_target": "resolution_deadline"},
        current_status="in_progress",
        actor_id="lead_1",
        created_at=anchor_time - timedelta(hours=1),
        completed_at=None,
    )
    test_db.add(act2)

    # Decision 3 (Rejected -> No action created)
    d3 = ManagerDecision(
        id="dec_eval_3",
        dataset_id="ds_eval_1",
        recommendation_id="rec:ds_eval_1:T105:resolution_deadline",
        source_ticket_id="T105",
        decision_type="rejected",
        original_recommendation_snapshot={
            "id": "rec:ds_eval_1:T105:resolution_deadline",
            "sla_target": "resolution_deadline",
        },
        manager_id="manager_eval",
        created_at=anchor_time - timedelta(hours=2),
        is_effective=True,
    )
    test_db.add(d3)

    test_db.commit()
    return {
        "dataset_id": "ds_eval_1",
        "action_completed_id": "act_eval_1",
        "action_in_progress_id": "act_eval_2",
        "ref_time": ref_time,
        "anchor_time": anchor_time,
    }


def test_dataset_evaluation_with_completed_actions(client, eval_test_data):
    """Test 1: Valid SLA outcome evaluation comparing baseline vs. post-action cohorts."""
    ds_id = eval_test_data["dataset_id"]
    res = client.get(f"/api/evaluations/{ds_id}")
    assert res.status_code == 200

    data = res.json()
    assert data["dataset_id"] == ds_id
    assert data["evaluation_id"].startswith(f"eval_{ds_id}_")

    # Action Summary
    act_summary = data["action_summary"]
    assert act_summary["total_approved_actions"] == 2
    assert act_summary["completed_actions"] == 1
    assert act_summary["in_progress_actions"] == 1
    assert act_summary["pending_actions"] == 0
    assert act_summary["action_completion_rate"] == 0.5

    # Resolution SLA Target
    res_eval = data["resolution_sla_evaluation"]
    assert res_eval["target_type"] == "resolution"
    base = res_eval["baseline"]
    post = res_eval["post_action"]

    # Baseline: T101 (Met), T102 (Breached), T105 (no deadline)
    assert base["ticket_sample_size"] == 3
    assert base["eligible_count"] == 2
    assert base["met_sla_count"] == 1
    assert base["breached_sla_count"] == 1
    assert base["compliance_rate"] == 0.5
    assert base["breach_rate"] == 0.5
    assert base["avg_duration_hours"] == 9.0  # (8.0 + 10.0) / 2

    # Post-action: T103 (Met), T104 (In progress, not yet breached or met)
    assert post["ticket_sample_size"] == 2
    assert post["eligible_count"] == 2
    assert post["met_sla_count"] == 1
    assert post["breached_sla_count"] == 0
    assert post["compliance_rate"] == 0.5
    assert post["breach_rate"] == 0.0
    assert post["avg_duration_hours"] == 2.0  # T103 only

    # Comparisons
    comps = {c["metric_name"]: c for c in res_eval["comparisons"]}
    assert "SLA Compliance Rate" in comps
    assert "SLA Breach Rate" in comps
    assert "Average Duration (Hours)" in comps
    assert comps["Average Duration (Hours)"]["absolute_difference"] == -7.0
    assert comps["Average Duration (Hours)"]["relative_percent_change"] == -77.78

    # Observational disclaimer
    assert "Observational before-and-after performance evaluation" in data["observational_disclaimer"]


def test_independent_resolution_and_response_targets(client, eval_test_data):
    """Test 2: Response SLA and Resolution SLA are evaluated independently."""
    ds_id = eval_test_data["dataset_id"]
    res = client.get(f"/api/evaluations/{ds_id}")
    assert res.status_code == 200
    data = res.json()

    res_eval = data["resolution_sla_evaluation"]
    resp_eval = data["response_sla_evaluation"]

    assert res_eval["target_type"] == "resolution"
    assert resp_eval["target_type"] == "response"

    # In baseline, response durations are 1.5h and 3.0h -> avg = 2.25h
    assert resp_eval["baseline"]["avg_duration_hours"] == 2.25
    # Resolution durations are 8.0h and 10.0h -> avg = 9.0h
    assert res_eval["baseline"]["avg_duration_hours"] == 9.0


def test_window_identification(client, eval_test_data):
    """Test 3: Clearly identified baseline and post-action cohort windows."""
    ds_id = eval_test_data["dataset_id"]
    res = client.get(f"/api/evaluations/{ds_id}")
    assert res.status_code == 200
    data = res.json()

    base_cohort = data["resolution_sla_evaluation"]["baseline"]
    post_cohort = data["resolution_sla_evaluation"]["post_action"]

    assert base_cohort["window_name"] == "baseline"
    assert post_cohort["window_name"] == "post_action"

    # Baseline end equals anchor time; Post-action start equals anchor time
    assert base_cohort["window_end"] == post_cohort["window_start"]


def test_missing_timestamps_do_not_fabricate_outcomes(client, eval_test_data):
    """Test 4 & 5: Missing timestamps report data coverage and limitations without fabricating outcomes."""
    ds_id = eval_test_data["dataset_id"]
    res = client.get(f"/api/evaluations/{ds_id}")
    assert res.status_code == 200
    data = res.json()

    res_eval = data["resolution_sla_evaluation"]
    # 5 total tickets, 4 have resolution deadlines -> coverage = 4/5 = 0.8
    assert res_eval["data_coverage_rate"] == 0.8
    assert len(res_eval["limitations"]) > 0
    assert "80.0%" in res_eval["limitations"][0]


def test_empty_dataset_handling(client, test_db):
    """Test 6: Handling an empty dataset with 0 tickets and 0 actions."""
    empty_ds = Dataset(
        id="ds_empty",
        name="Empty Dataset",
        source_filename="empty.csv",
        file_format="csv",
        created_at=datetime.now(timezone.utc),
        status="completed",
        total_rows=0,
        accepted_rows=0,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={},
        validation_summary={},
    )
    test_db.add(empty_ds)
    test_db.commit()

    res = client.get("/api/evaluations/ds_empty")
    assert res.status_code == 200
    data = res.json()

    assert data["dataset_id"] == "ds_empty"
    assert data["action_summary"]["total_approved_actions"] == 0
    assert data["action_summary"]["action_completion_rate"] == 0.0
    assert data["resolution_sla_evaluation"]["baseline"]["ticket_sample_size"] == 0
    assert data["resolution_sla_evaluation"]["post_action"]["ticket_sample_size"] == 0
    assert data["resolution_sla_evaluation"]["baseline"]["compliance_rate"] is None
    assert "Dataset contains 0 imported tickets." in data["limitations"]


def test_no_completed_actions_handling(client, test_db):
    """Test 7 & 8: Dataset with only pending/in_progress actions has 0 post-action sample size."""
    ds = Dataset(
        id="ds_no_completed",
        name="No Completed Actions Dataset",
        source_filename="test.csv",
        file_format="csv",
        created_at=datetime.now(timezone.utc),
        status="completed",
        total_rows=1,
        accepted_rows=1,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={},
        validation_summary={},
    )
    test_db.add(ds)

    t = ImportedTicket(
        id="ds_no_completed:T1",
        dataset_id="ds_no_completed",
        source_ticket_id="T1",
        title="Pending issue",
        status="Open",
        priority="High",
        created_at=datetime(2026, 10, 30, 9, 0, 0, tzinfo=timezone.utc),
        resolution_deadline=datetime(2026, 10, 30, 18, 0, 0, tzinfo=timezone.utc),
    )
    test_db.add(t)

    dec = ManagerDecision(
        id="dec_pend_1",
        dataset_id="ds_no_completed",
        recommendation_id="rec:1",
        source_ticket_id="T1",
        decision_type="approved",
        original_recommendation_snapshot={},
        manager_id="mgr",
    )
    test_db.add(dec)

    act = TrackedAction(
        id="act_pend_1",
        dataset_id="ds_no_completed",
        decision_id="dec_pend_1",
        recommendation_id="rec:1",
        source_ticket_id="T1",
        action_type="reassign_team",
        action_payload={},
        current_status="pending",
        actor_id="mgr",
    )
    test_db.add(act)
    test_db.commit()

    res = client.get("/api/evaluations/ds_no_completed")
    assert res.status_code == 200
    data = res.json()

    assert data["action_summary"]["pending_actions"] == 1
    assert data["action_summary"]["completed_actions"] == 0
    assert data["resolution_sla_evaluation"]["baseline"]["ticket_sample_size"] == 1
    assert data["resolution_sla_evaluation"]["post_action"]["ticket_sample_size"] == 0
    assert any("No completed actions exist" in lim for lim in data["limitations"])


def test_action_completed_does_not_imply_ticket_outcome_met(client, test_db):
    """Test 10: Action completion is distinct from ticket SLA outcome."""
    ds = Dataset(
        id="ds_distinction",
        name="Outcome Distinction Dataset",
        source_filename="test.csv",
        file_format="csv",
        status="completed",
        total_rows=1,
        accepted_rows=1,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={},
        validation_summary={},
    )
    test_db.add(ds)

    c_at = datetime(2026, 10, 30, 8, 0, 0, tzinfo=timezone.utc)
    deadline = datetime(2026, 10, 30, 10, 0, 0, tzinfo=timezone.utc)
    resolved = datetime(2026, 10, 30, 14, 0, 0, tzinfo=timezone.utc)  # Breached

    t = ImportedTicket(
        id="ds_distinction:T_BREACH",
        dataset_id="ds_distinction",
        source_ticket_id="T_BREACH",
        title="Breached Ticket with Action",
        status="Closed",
        priority="Critical",
        created_at=c_at,
        resolution_deadline=deadline,
        resolved_at=resolved,
        resolution_duration=6.0,
    )
    test_db.add(t)

    dec = ManagerDecision(
        id="dec_dist_1",
        dataset_id="ds_distinction",
        recommendation_id="rec:dist:1",
        source_ticket_id="T_BREACH",
        decision_type="approved",
        original_recommendation_snapshot={},
        manager_id="mgr",
    )
    test_db.add(dec)

    act = TrackedAction(
        id="act_dist_1",
        dataset_id="ds_distinction",
        decision_id="dec_dist_1",
        recommendation_id="rec:dist:1",
        source_ticket_id="T_BREACH",
        action_type="reassign_team",
        action_payload={"sla_target": "resolution_deadline"},
        current_status="completed",
        actor_id="lead_ops",
        completed_at=datetime(2026, 10, 30, 9, 30, 0, tzinfo=timezone.utc),
    )
    test_db.add(act)
    test_db.commit()

    res = client.get("/api/evaluations/ds_distinction/actions/act_dist_1")
    assert res.status_code == 200
    data = res.json()

    assert data["is_action_completed"] is True
    assert data["ticket_outcome_observed"] is True
    assert data["ticket_outcome_state"] == "Breached in Past"
    assert "Action completion confirms recorded workflow execution; it does not guarantee SLA compliance." in data["evidence"]


def test_cross_dataset_action_evaluation_rejected(client, eval_test_data, test_db):
    """Test 11: Cross-dataset action evaluation is rejected with 400 Bad Request."""
    ds2 = Dataset(
        id="ds_eval_2",
        name="Second Dataset",
        source_filename="second.csv",
        file_format="csv",
        status="completed",
        total_rows=0,
        accepted_rows=0,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={},
        validation_summary={},
    )
    test_db.add(ds2)
    test_db.commit()

    act_id = eval_test_data["action_completed_id"]
    res = client.get(f"/api/evaluations/ds_eval_2/actions/{act_id}")
    assert res.status_code == 400
    assert "belongs to dataset 'ds_eval_1'" in res.json()["detail"]


def test_zero_baseline_percentage_change_safety(client, test_db):
    """Test 12: Zero baseline metric safely results in None relative change without ZeroDivisionError."""
    ref = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    anchor = datetime(2026, 10, 30, 8, 0, 0, tzinfo=timezone.utc)

    ds = Dataset(
        id="ds_zero_base",
        name="Zero Baseline Dataset",
        source_filename="zero.csv",
        file_format="csv",
        status="completed",
        total_rows=2,
        accepted_rows=2,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={},
        validation_summary={},
    )
    test_db.add(ds)

    # Baseline ticket has Met SLA -> breach rate = 0.0
    t1 = ImportedTicket(
        id="ds_zero_base:T1",
        dataset_id="ds_zero_base",
        source_ticket_id="T1",
        title="Zero breach ticket",
        status="Closed",
        created_at=anchor - timedelta(hours=2),
        resolution_deadline=anchor - timedelta(hours=1),
        resolved_at=anchor - timedelta(hours=1, minutes=30),
        resolution_duration=0.5,
    )
    test_db.add(t1)

    # Post-action ticket breached -> breach rate = 1.0
    t2 = ImportedTicket(
        id="ds_zero_base:T2",
        dataset_id="ds_zero_base",
        source_ticket_id="T2",
        title="Post action breached ticket",
        status="Closed",
        created_at=anchor + timedelta(hours=1),
        resolution_deadline=anchor + timedelta(hours=2),
        resolved_at=anchor + timedelta(hours=3),
        resolution_duration=2.0,
    )
    test_db.add(t2)

    dec = ManagerDecision(
        id="dec_zb",
        dataset_id="ds_zero_base",
        recommendation_id="rec:zb",
        source_ticket_id="T1",
        decision_type="approved",
        original_recommendation_snapshot={},
        manager_id="mgr",
    )
    test_db.add(dec)

    act = TrackedAction(
        id="act_zb",
        dataset_id="ds_zero_base",
        decision_id="dec_zb",
        recommendation_id="rec:zb",
        source_ticket_id="T1",
        action_type="reassign_team",
        action_payload={},
        current_status="completed",
        actor_id="mgr",
        completed_at=anchor,
    )
    test_db.add(act)
    test_db.commit()

    res = client.get("/api/evaluations/ds_zero_base")
    assert res.status_code == 200
    data = res.json()

    comps = {c["metric_name"]: c for c in data["resolution_sla_evaluation"]["comparisons"]}
    br_comp = comps["SLA Breach Rate"]
    assert br_comp["baseline_value"] == 0.0
    assert br_comp["post_action_value"] == 1.0
    assert br_comp["absolute_difference"] == 1.0
    assert br_comp["relative_percent_change"] is None  # Handled safely without ZeroDivisionError


def test_deterministic_evaluation_and_snapshot_persistence(client, eval_test_data, test_db):
    """Test 13: EvaluationSnapshot is persisted deterministically."""
    ds_id = eval_test_data["dataset_id"]
    res = client.get(f"/api/evaluations/{ds_id}")
    assert res.status_code == 200
    eval_id = res.json()["evaluation_id"]

    # Verify snapshot row in DB
    snap = test_db.query(EvaluationSnapshot).filter(EvaluationSnapshot.id == eval_id).first()
    assert snap is not None
    assert snap.dataset_id == ds_id
    assert snap.sla_target == "resolution_deadline"
    assert snap.action_metrics["completed_actions"] == 1


def test_not_found_handling(client):
    """Test 14: 404 response for unknown datasets and actions."""
    res_ds = client.get("/api/evaluations/ds_non_existent")
    assert res_ds.status_code == 404
    assert "Dataset 'ds_non_existent' not found." in res_ds.json()["detail"]

    res_act = client.get("/api/evaluations/ds_non_existent/actions/act_non_existent")
    assert res_act.status_code == 404

