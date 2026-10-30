"""Tests for Task 2: Dataset-Aware Analytics and SLA Risk Scoring."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from backend.models import Dataset, ImportedTicket


@pytest.fixture
def sample_dataset(test_db):
    """Seed a test dataset with known tickets spanning active, resolved, breached, and missing SLA."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)

    ds = Dataset(
        id="ds_test_analytics_1",
        name="Q3 Incident Logs",
        source_filename="q3_incidents.csv",
        file_format="csv",
        created_at=ref_time - timedelta(days=1),
        snapshot_at=ref_time,
        status="completed",
        total_rows=6,
        accepted_rows=6,
        rejected_rows=0,
        warning_count=1,
        applied_mapping={},
        validation_summary={"invalid_rows": 0},
    )
    test_db.add(ds)

    tickets = [
        # Ticket 1: Active, Breached Resolution SLA
        # Created 10h ago, SLA limit 4h -> deadline was 6h ago -> breached!
        ImportedTicket(
            id="ds_test_analytics_1:T101",
            dataset_id="ds_test_analytics_1",
            source_ticket_id="T101",
            title="Database Connection Pool Exhaustion",
            status="Open",
            priority="Critical",
            created_at=ref_time - timedelta(hours=10),
            resolution_deadline=ref_time - timedelta(hours=6),
            response_deadline=ref_time - timedelta(hours=9),
            assigned_team_id="team-c",
        ),
        # Ticket 2: Active, High Risk (>80%) Resolution SLA
        # Created 8.5h ago, SLA limit 10h -> deadline in 1.5h -> 85% elapsed (>80%)!
        ImportedTicket(
            id="ds_test_analytics_1:T102",
            dataset_id="ds_test_analytics_1",
            source_ticket_id="T102",
            title="Webhook Gateway Timeout",
            status="Pending",
            priority="High",
            created_at=ref_time - timedelta(hours=8.5),
            resolution_deadline=ref_time + timedelta(hours=1.5),
            response_deadline=ref_time - timedelta(hours=7),
            assigned_team_id="team-a",
        ),
        # Ticket 3: Active, Within Target (Medium Risk, 60% elapsed)
        # Created 6h ago, SLA limit 10h -> deadline in 4h -> 60% elapsed
        ImportedTicket(
            id="ds_test_analytics_1:T103",
            dataset_id="ds_test_analytics_1",
            source_ticket_id="T103",
            title="Password Reset Email Delivery Delay",
            status="In Progress",
            priority="Medium",
            created_at=ref_time - timedelta(hours=6),
            resolution_deadline=ref_time + timedelta(hours=4),
            response_deadline=ref_time + timedelta(hours=2),
            assigned_team_id="team-d",
        ),
        # Ticket 4: Historical / Resolved ticket that met SLA
        # Resolved 2h before deadline -> Met SLA, NOT currently at risk!
        ImportedTicket(
            id="ds_test_analytics_1:T104",
            dataset_id="ds_test_analytics_1",
            source_ticket_id="T104",
            title="Refund calculation bug",
            status="Resolved",
            priority="High",
            created_at=ref_time - timedelta(hours=20),
            resolution_deadline=ref_time - timedelta(hours=10),
            resolved_at=ref_time - timedelta(hours=12),
            assigned_team_id="team-a",
        ),
        # Ticket 5: Historical / Resolved ticket that breached in the past
        # Resolved 3h AFTER deadline -> Breached in Past, NOT currently at risk!
        ImportedTicket(
            id="ds_test_analytics_1:T105",
            dataset_id="ds_test_analytics_1",
            source_ticket_id="T105",
            title="Stale Cache Invalidation",
            status="Closed",
            priority="Low",
            created_at=ref_time - timedelta(hours=30),
            resolution_deadline=ref_time - timedelta(hours=20),
            resolved_at=ref_time - timedelta(hours=17),
            assigned_team_id="team-c",
        ),
        # Ticket 6: Active, Missing resolution deadline -> Unscorable!
        ImportedTicket(
            id="ds_test_analytics_1:T106",
            dataset_id="ds_test_analytics_1",
            source_ticket_id="T106",
            title="Feature request without SLA contract",
            status="Open",
            priority="Low",
            created_at=ref_time - timedelta(hours=2),
            resolution_deadline=None,
            response_deadline=ref_time + timedelta(hours=1),
            assigned_team_id="team-d",
        ),
    ]

    for t in tickets:
        test_db.add(t)

    test_db.commit()
    return ds


@pytest.fixture
def second_isolated_dataset(test_db):
    """Seed a second dataset to verify dataset isolation."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    ds2 = Dataset(
        id="ds_isolated_2",
        name="Isolated Secondary Dataset",
        source_filename="isolated.csv",
        file_format="csv",
        created_at=ref_time,
        snapshot_at=ref_time,
        status="completed",
        total_rows=1,
        accepted_rows=1,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={},
        validation_summary={"invalid_rows": 0},
    )
    test_db.add(ds2)

    t = ImportedTicket(
        id="ds_isolated_2:ISO_999",
        dataset_id="ds_isolated_2",
        source_ticket_id="ISO_999",
        title="Other Dataset Record",
        status="Open",
        priority="Critical",
        created_at=ref_time - timedelta(hours=5),
        resolution_deadline=ref_time - timedelta(hours=1),
        assigned_team_id="team-b",
    )
    test_db.add(t)
    test_db.commit()
    return ds2


def test_analytics_for_known_dataset(client: TestClient, sample_dataset):
    """Verify GET /api/analytics/{dataset_id} returns accurate aggregates and distributions."""
    res = client.get(f"/api/analytics/{sample_dataset.id}")
    assert res.status_code == 200
    data = res.json()

    summary = data["dataset_summary"]
    assert summary["dataset_id"] == sample_dataset.id
    assert summary["total_imported_tickets"] == 6
    assert summary["scorable_resolution_tickets"] == 5
    assert summary["scorable_response_tickets"] == 4

    dist = data["ticket_distribution"]
    assert dist["active_tickets_count"] == 4  # T101, T102, T103, T106
    assert dist["historical_tickets_count"] == 2  # T104, T105
    assert dist["by_status"]["Open"] == 2
    assert dist["by_priority"]["Critical"] == 1
    assert dist["by_priority"]["High"] == 2

    sla = data["sla_performance"]
    res_sla = sla["resolution_sla"]
    assert res_sla["target_type"] == "resolution"
    assert res_sla["eligible_count"] == 5
    assert res_sla["missing_deadline_count"] == 1  # T106
    assert res_sla["breached_count"] == 1  # T101
    assert res_sla["at_risk_count"] == 1  # T102
    assert res_sla["within_target_count"] == 1  # T103
    assert res_sla["historical_met_sla_count"] == 1  # T104
    assert res_sla["historical_breached_count"] == 1  # T105
    assert res_sla["historical_attainment_rate"] == 0.5  # 1 / 2

    # Verify limitations are reported
    assert any("lack a resolution deadline" in lim for lim in res_sla["limitations"])


def test_analytics_unknown_dataset_404(client: TestClient):
    """Verify GET /api/analytics/{dataset_id} returns 404 for unknown dataset ID."""
    res = client.get("/api/analytics/ds_non_existent_999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_dataset_isolation_analytics(client: TestClient, sample_dataset, second_isolated_dataset):
    """Verify analytics for one dataset do not bleed into another."""
    res1 = client.get(f"/api/analytics/{sample_dataset.id}")
    res2 = client.get(f"/api/analytics/{second_isolated_dataset.id}")

    assert res1.status_code == 200
    assert res2.status_code == 200

    assert res1.json()["dataset_summary"]["total_imported_tickets"] == 6
    assert res2.json()["dataset_summary"]["total_imported_tickets"] == 1


def test_independent_response_and_resolution_sla(client: TestClient, sample_dataset):
    """Verify response and resolution SLAs are evaluated independently."""
    res = client.get(f"/api/analytics/{sample_dataset.id}")
    data = res.json()["sla_performance"]

    resp_sla = data["response_sla"]
    res_sla = data["resolution_sla"]

    assert resp_sla["target_type"] == "response"
    assert res_sla["target_type"] == "resolution"

    # Eligible counts differ because T106 has response_deadline but no resolution_deadline
    assert resp_sla["missing_deadline_count"] == 2
    assert res_sla["missing_deadline_count"] == 1


def test_risks_ranked_deterministic_ordering(client: TestClient, sample_dataset):
    """Verify GET /api/risks/{dataset_id} returns ranked active risks first, followed by resolved."""
    res = client.get(f"/api/risks/{sample_dataset.id}")
    assert res.status_code == 200
    data = res.json()

    assert data["dataset_id"] == sample_dataset.id
    assert data["sla_target"] == "resolution_deadline"
    assert data["total"] == 6

    items = data["items"]
    ticket_ids = [item["ticket_id"] for item in items]

    # Expected order:
    # 1. T101: Active Breached (ratio >= 1.0)
    # 2. T102: Active High Risk (85% elapsed)
    # 3. T103: Active Within Target (60% elapsed)
    # 4. T106: Active Unscorable (missing deadline)
    # 5. T104 & T105: Resolved tickets (urgency 5)
    assert ticket_ids[0] == "T101"
    assert items[0]["current_sla_state"] == "Breached"
    assert items[0]["risk_category"] == "Critical Risk"
    assert items[0]["risk_score"] == 100.0

    assert ticket_ids[1] == "T102"
    assert items[1]["current_sla_state"] == "High Risk"
    assert items[1]["risk_category"] == "High Risk"
    assert items[1]["risk_score"] == 85.0

    assert ticket_ids[2] == "T103"
    assert items[2]["current_sla_state"] == "Within Target"
    assert items[2]["risk_category"] == "Medium Risk"
    assert items[2]["risk_score"] == 60.0

    assert ticket_ids[3] == "T106"
    assert items[3]["current_sla_state"] == "Unscorable"
    assert items[3]["risk_score"] is None
    assert "missing" in items[3]["evidence"].lower()


def test_resolved_tickets_not_at_risk(client: TestClient, sample_dataset):
    """Verify resolved tickets are not marked at risk merely because deadline is in the past."""
    res = client.get(f"/api/risks/{sample_dataset.id}?status=resolved")
    assert res.status_code == 200
    data = res.json()

    assert data["total"] == 2
    for item in data["items"]:
        assert item["risk_category"] == "Resolved"
        assert item["risk_score"] is None
        assert item["current_sla_state"] in {"Met SLA", "Breached in Past"}


def test_risks_filtering_and_pagination(client: TestClient, sample_dataset):
    """Verify filtering by status, priority, and pagination works correctly."""
    # Priority filter
    res = client.get(f"/api/risks/{sample_dataset.id}?priority=Critical")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["ticket_id"] == "T101"

    # Status filter
    res_active = client.get(f"/api/risks/{sample_dataset.id}?status=active")
    assert res_active.status_code == 200
    assert res_active.json()["total"] == 4

    # Pagination
    res_page = client.get(f"/api/risks/{sample_dataset.id}?page=1&page_size=2")
    assert res_page.status_code == 200
    page_data = res_page.json()
    assert page_data["page"] == 1
    assert page_data["page_size"] == 2
    assert page_data["total_pages"] == 3
    assert len(page_data["items"]) == 2


def test_risks_unknown_dataset_404(client: TestClient):
    """Verify GET /api/risks/{dataset_id} returns 404 for unknown dataset."""
    res = client.get("/api/risks/ds_unknown_000")
    assert res.status_code == 404


def test_risks_tie_breaking_deterministic(test_db, client: TestClient):
    """Verify deterministic tie-breaking on source_ticket_id when scores are identical."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    ds = Dataset(
        id="ds_tie_break",
        name="Tie Break Test",
        source_filename="tie.csv",
        file_format="csv",
        created_at=ref_time,
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

    # Three tickets with identical timestamps and limits, but different source_ticket_ids
    for tid in ["T_GAMMA", "T_ALPHA", "T_BETA"]:
        test_db.add(
            ImportedTicket(
                id=f"ds_tie_break:{tid}",
                dataset_id="ds_tie_break",
                source_ticket_id=tid,
                status="Open",
                priority="High",
                created_at=ref_time - timedelta(hours=5),
                resolution_deadline=ref_time - timedelta(hours=1),  # Breached identically
            )
        )
    test_db.commit()

    res = client.get(f"/api/risks/{ds.id}")
    assert res.status_code == 200
    ids = [item["ticket_id"] for item in res.json()["items"]]
    assert ids == ["T_ALPHA", "T_BETA", "T_GAMMA"]


def test_invalid_sla_dates_handled_gracefully(test_db, client: TestClient):
    """Verify invalid dates (deadline <= created_at) do not crash the engine and are flagged as Unscorable."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    ds = Dataset(
        id="ds_invalid_dates",
        name="Invalid Dates Test",
        source_filename="inv.csv",
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
    test_db.add(ds)

    # Deadline is 2 hours BEFORE created_at
    test_db.add(
        ImportedTicket(
            id="ds_invalid_dates:INV1",
            dataset_id="ds_invalid_dates",
            source_ticket_id="INV1",
            status="Open",
            priority="Critical",
            created_at=ref_time - timedelta(hours=5),
            resolution_deadline=ref_time - timedelta(hours=7),
        )
    )
    test_db.commit()

    res = client.get(f"/api/risks/{ds.id}")
    assert res.status_code == 200
    item = res.json()["items"][0]
    assert item["current_sla_state"] == "Unscorable"
    assert item["risk_category"] == "Unscorable"
    assert "earlier than or equal to creation time" in item["evidence"]


def test_empty_dataset_analytics_and_risks(test_db, client: TestClient):
    """Verify empty dataset (0 imported tickets) returns zeroed metrics and empty list without errors."""
    ref_time = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)
    ds = Dataset(
        id="ds_empty",
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
    test_db.add(ds)
    test_db.commit()

    res_an = client.get(f"/api/analytics/{ds.id}")
    assert res_an.status_code == 200
    an_data = res_an.json()
    assert an_data["dataset_summary"]["total_imported_tickets"] == 0
    assert an_data["ticket_distribution"]["active_tickets_count"] == 0
    assert an_data["sla_performance"]["resolution_sla"]["eligible_count"] == 0

    res_rk = client.get(f"/api/risks/{ds.id}")
    assert res_rk.status_code == 200
    rk_data = res_rk.json()
    assert rk_data["total"] == 0
    assert rk_data["items"] == []

