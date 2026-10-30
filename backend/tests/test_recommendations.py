"""Tests for Task 3: Evidence-Based Recommendation Engine."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from backend.models import Dataset, ImportedTicket, Team


@pytest.fixture
def recommendation_dataset(test_db):
    """Seed teams, a dataset, and active/resolved tickets for recommendation tests."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Seed candidate squads
    team_a = Team(
        id="team-a",
        name="Team A - Payments",
        skill_tags=["payments", "billing", "refunds"],
    )
    team_b = Team(
        id="team-b",
        name="Team B - Payments",
        skill_tags=["payments", "card processing"],
    )
    team_c = Team(
        id="team-c",
        name="Team C - DevOps",
        skill_tags=["infrastructure", "cloud"],
    )
    test_db.add_all([team_a, team_b, team_c])

    # 2. Seed dataset
    ds = Dataset(
        id="ds_rec_test_1",
        name="Operations Live Log",
        source_filename="ops.csv",
        file_format="csv",
        created_at=ref_time - timedelta(days=1),
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

    # 3. Seed tickets:
    # T1: Active, Breached -> should produce 'prioritize_ticket'
    t1 = ImportedTicket(
        id="ds_rec_test_1:T1",
        dataset_id="ds_rec_test_1",
        source_ticket_id="T1",
        title="Payment gateway fatal error",
        status="Open",
        priority="Critical",
        category="Payments",
        created_at=ref_time - timedelta(hours=10),
        resolution_deadline=ref_time - timedelta(hours=2),  # Breached
        response_deadline=ref_time - timedelta(hours=8),
        assigned_team_id="team-a",
    )

    # T2: Active, High Risk (>80%), assigned to congested team-a (which has multiple active tickets),
    # while team-b has zero tickets and matches Payments -> should produce 'reassign_ticket' to team-b
    t2 = ImportedTicket(
        id="ds_rec_test_1:T2",
        dataset_id="ds_rec_test_1",
        source_ticket_id="T2",
        title="Refund webhook failure",
        status="Pending",
        priority="High",
        category="Payments",
        created_at=ref_time - timedelta(hours=8.5),
        resolution_deadline=ref_time + timedelta(hours=1.5),  # 85% elapsed
        response_deadline=ref_time - timedelta(hours=5),
        assigned_team_id="team-a",
    )

    # T3: Active, High Risk (>80%), DevOps category, assigned to team-c,
    # no alternate DevOps team exists -> should produce 'prioritize_ticket'
    t3 = ImportedTicket(
        id="ds_rec_test_1:T3",
        dataset_id="ds_rec_test_1",
        source_ticket_id="T3",
        title="Kubernetes node crash",
        status="In Progress",
        priority="Critical",
        category="Infrastructure",
        created_at=ref_time - timedelta(hours=9),
        resolution_deadline=ref_time + timedelta(hours=1),  # 90% elapsed
        response_deadline=ref_time - timedelta(hours=7),
        assigned_team_id="team-c",
    )

    # T4: Active, High Risk, unassigned -> should produce 'review_assignment'
    t4 = ImportedTicket(
        id="ds_rec_test_1:T4",
        dataset_id="ds_rec_test_1",
        source_ticket_id="T4",
        title="Unassigned high priority bug",
        status="Open",
        priority="High",
        category="Payments",
        created_at=ref_time - timedelta(hours=8.5),
        resolution_deadline=ref_time + timedelta(hours=1.5),
        response_deadline=ref_time - timedelta(hours=5),
        assigned_team_id=None,
    )

    # T5: Historical / Resolved ticket -> must be EXCLUDED from active recommendations
    t5 = ImportedTicket(
        id="ds_rec_test_1:T5",
        dataset_id="ds_rec_test_1",
        source_ticket_id="T5",
        title="Resolved login issue",
        status="Resolved",
        priority="Medium",
        category="Support",
        created_at=ref_time - timedelta(hours=20),
        resolution_deadline=ref_time - timedelta(hours=5),
        resolved_at=ref_time - timedelta(hours=6),
        assigned_team_id="team-a",
    )

    # T6: Active, Missing resolution deadline -> should produce 'insufficient_data'
    t6 = ImportedTicket(
        id="ds_rec_test_1:T6",
        dataset_id="ds_rec_test_1",
        source_ticket_id="T6",
        title="Feature request without deadline",
        status="Open",
        priority="Low",
        category="General",
        created_at=ref_time - timedelta(hours=2),
        resolution_deadline=None,
        response_deadline=ref_time + timedelta(hours=4),
        assigned_team_id=None,
    )

    test_db.add_all([t1, t2, t3, t4, t5, t6])
    test_db.commit()
    return ds


def test_recommendations_known_dataset(client: TestClient, recommendation_dataset):
    """Verify GET /api/recommendations/{dataset_id} returns structured recommendations."""
    res = client.get(f"/api/recommendations/{recommendation_dataset.id}")
    assert res.status_code == 200
    data = res.json()

    assert data["dataset_id"] == recommendation_dataset.id
    assert data["sla_target"] == "resolution_deadline"

    # T5 (Resolved) is excluded, so only active tickets (5 total) appear
    assert data["total"] == 5
    items = data["items"]

    # Ticket IDs in recommendations
    rec_ticket_ids = [item["ticket_id"] for item in items]
    assert "T5" not in rec_ticket_ids  # Historical excluded!
    assert "T1" in rec_ticket_ids
    assert "T2" in rec_ticket_ids
    assert "T3" in rec_ticket_ids
    assert "T4" in rec_ticket_ids
    assert "T6" in rec_ticket_ids


def test_breached_ticket_produces_prioritize_recommendation(client: TestClient, recommendation_dataset):
    """Verify breached active ticket yields prioritize_ticket with high evidence strength."""
    res = client.get(f"/api/recommendations/{recommendation_dataset.id}")
    data = res.json()
    t1_rec = next(item for item in data["items"] if item["ticket_id"] == "T1")

    assert t1_rec["recommendation_type"] == "prioritize_ticket"
    assert t1_rec["risk_category"] == "Critical Risk"
    assert t1_rec["evidence_strength"] == "high"
    assert "breach" in t1_rec["reason"].lower()
    assert t1_rec["status_review"] == "pending_review"


def test_reassign_ticket_when_better_team_available(client: TestClient, recommendation_dataset):
    """Verify high-risk ticket on congested squad produces reassign_ticket to lower-load candidate."""
    res = client.get(f"/api/recommendations/{recommendation_dataset.id}")
    data = res.json()
    t2_rec = next(item for item in data["items"] if item["ticket_id"] == "T2")

    assert t2_rec["recommendation_type"] == "reassign_ticket"
    assert t2_rec["suggested_team_id"] == "team-b"
    assert "team-a" in t2_rec["proposed_action"]
    assert "team-b" in t2_rec["proposed_action"].lower()
    assert t2_rec["evidence_strength"] == "high"


def test_prioritize_when_no_better_team_available(client: TestClient, recommendation_dataset):
    """Verify high-risk ticket without alternative team produces prioritize_ticket instead of faking reassignment."""
    res = client.get(f"/api/recommendations/{recommendation_dataset.id}")
    data = res.json()
    t3_rec = next(item for item in data["items"] if item["ticket_id"] == "T3")

    assert t3_rec["recommendation_type"] == "prioritize_ticket"
    assert t3_rec["suggested_team_id"] is None
    assert "No alternative squad" in t3_rec["reason"]


def test_unassigned_high_risk_produces_review_assignment(client: TestClient, recommendation_dataset):
    """Verify unassigned ticket produces review_assignment."""
    res = client.get(f"/api/recommendations/{recommendation_dataset.id}")
    data = res.json()
    t4_rec = next(item for item in data["items"] if item["ticket_id"] == "T4")

    assert t4_rec["recommendation_type"] == "review_assignment"
    assert "no assigned squad" in t4_rec["reason"].lower()


def test_missing_deadline_produces_insufficient_data(client: TestClient, recommendation_dataset):
    """Verify ticket missing deadline produces insufficient_data without fabricating recommendations."""
    res = client.get(f"/api/recommendations/{recommendation_dataset.id}")
    data = res.json()
    t6_rec = next(item for item in data["items"] if item["ticket_id"] == "T6")

    assert t6_rec["recommendation_type"] == "insufficient_data"
    assert t6_rec["evidence_strength"] == "insufficient_data"
    assert "missing" in t6_rec["reason"].lower()


def test_recommendations_unknown_dataset_404(client: TestClient):
    """Verify GET /api/recommendations/{dataset_id} returns 404 for unknown dataset ID."""
    res = client.get("/api/recommendations/ds_does_not_exist_404")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_recommendations_dataset_isolation(test_db, client: TestClient, recommendation_dataset):
    """Verify recommendations are strictly scoped and do not leak records between datasets."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    other_ds = Dataset(
        id="ds_other_rec_2",
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
    test_db.add(
        ImportedTicket(
            id="ds_other_rec_2:OTHER_1",
            dataset_id="ds_other_rec_2",
            source_ticket_id="OTHER_1",
            title="Isolated ticket in dataset 2",
            status="Open",
            priority="Critical",
            created_at=ref_time - timedelta(hours=5),
            resolution_deadline=ref_time - timedelta(hours=1),
        )
    )
    test_db.commit()

    res1 = client.get(f"/api/recommendations/{recommendation_dataset.id}")
    res2 = client.get(f"/api/recommendations/{other_ds.id}")

    ids1 = [item["ticket_id"] for item in res1.json()["items"]]
    ids2 = [item["ticket_id"] for item in res2.json()["items"]]

    assert "OTHER_1" not in ids1
    assert ids2 == ["OTHER_1"]


def test_recommendations_filtering_and_pagination(client: TestClient, recommendation_dataset):
    """Verify filtering by recommendation_type and pagination works."""
    # Filter by type
    res_type = client.get(f"/api/recommendations/{recommendation_dataset.id}?recommendation_type=reassign_ticket")
    assert res_type.status_code == 200
    type_data = res_type.json()
    assert type_data["total"] == 1
    assert type_data["items"][0]["ticket_id"] == "T2"

    # Pagination
    res_p1 = client.get(f"/api/recommendations/{recommendation_dataset.id}?page=1&page_size=2")
    assert res_p1.status_code == 200
    p1_data = res_p1.json()
    assert p1_data["page"] == 1
    assert p1_data["page_size"] == 2
    assert len(p1_data["items"]) == 2
    assert p1_data["total"] == 5
    assert p1_data["total_pages"] == 3


def test_recommendations_independent_response_target(client: TestClient, recommendation_dataset):
    """Verify target=response evaluates response deadline independently."""
    res_resp = client.get(f"/api/recommendations/{recommendation_dataset.id}?target=response")
    assert res_resp.status_code == 200
    data = res_resp.json()
    assert data["sla_target"] == "response_deadline"

    # T6 has response_deadline, so under target=response it is NOT insufficient_data!
    t6_rec = next(item for item in data["items"] if item["ticket_id"] == "T6")
    assert t6_rec["sla_target"] == "response_deadline"
    assert t6_rec["recommendation_type"] != "insufficient_data"


def test_recommendations_empty_dataset(test_db, client: TestClient):
    """Verify empty dataset returns 0 recommendations without errors."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    empty_ds = Dataset(
        id="ds_empty_rec",
        name="Empty Dataset",
        source_filename="empty.csv",
        file_format="csv",
        created_at=ref_time,
        snapshot_at=ref_time,
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

    res = client.get(f"/api/recommendations/{empty_ds.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["items"] == []

