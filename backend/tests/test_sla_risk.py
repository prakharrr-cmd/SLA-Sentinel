"""Unit tests for Engine 1: SLA Risk Calculation."""

from datetime import datetime, timedelta, timezone
import pytest

from backend.engines.sla_risk import (
    calculate_sla_risk,
    flag_tickets,
    SLA_RISK_THRESHOLD,
)


def test_sla_risk_threshold_constant():
    """Verify that the module constant SLA_RISK_THRESHOLD is 0.80."""
    assert SLA_RISK_THRESHOLD == 0.80


def test_sla_risk_exactly_80_percent_is_normal():
    """Verify ratio == 0.80 (80%) results in Normal risk level."""
    now = datetime(2026, 10, 29, 12, 0, 0, tzinfo=timezone.utc)
    sla_limit = 10.0  # 10 hours
    creation_time = now - timedelta(hours=8)  # 8 hours elapsed: 8 / 10 = 0.80

    result = calculate_sla_risk(creation_time, sla_limit, current_time=now)

    assert result["ratio"] == 0.80
    assert result["percent_elapsed"] == 80.0
    assert result["risk_level"] == "Normal"
    assert result["is_high_risk"] is False
    assert result.get("breached", False) is False


def test_sla_risk_80_point_1_percent_is_high_risk():
    """Verify ratio > 0.80 (e.g. 80.1%) transitions to High Risk."""
    now = datetime(2026, 10, 29, 12, 0, 0, tzinfo=timezone.utc)
    sla_limit = timedelta(hours=10)  # 36,000 seconds
    # 80.1% of 36,000 seconds = 28,836 seconds
    creation_time = now - timedelta(seconds=28836)

    result = calculate_sla_risk(creation_time, sla_limit, current_time=now)

    assert pytest.approx(result["ratio"], rel=1e-4) == 0.801
    assert pytest.approx(result["percent_elapsed"], rel=1e-3) == 80.1
    assert result["risk_level"] == "High Risk"
    assert result["is_high_risk"] is True
    assert result.get("breached", False) is False


def test_sla_risk_exactly_100_percent_breached():
    """Verify ratio == 1.0 (100%) is High Risk with breached = True."""
    now = datetime(2026, 10, 29, 12, 0, 0, tzinfo=timezone.utc)
    sla_limit = 5.0
    creation_time = now - timedelta(hours=5)

    result = calculate_sla_risk(creation_time, sla_limit, current_time=now)

    assert result["ratio"] == 1.0
    assert result["percent_elapsed"] == 100.0
    assert result["risk_level"] == "High Risk"
    assert result["is_high_risk"] is True
    assert result.get("breached") is True


def test_sla_risk_greater_than_100_percent_breached():
    """Verify ratio > 1.0 (over 100%) remains High Risk with breached = True."""
    now = datetime(2026, 10, 29, 12, 0, 0, tzinfo=timezone.utc)
    sla_limit = 4.0
    creation_time = now - timedelta(hours=6)

    result = calculate_sla_risk(creation_time, sla_limit, current_time=now)

    assert result["ratio"] == 1.5
    assert result["percent_elapsed"] == 150.0
    assert result["risk_level"] == "High Risk"
    assert result["is_high_risk"] is True
    assert result.get("breached") is True


def test_sla_risk_naive_datetime_assumes_utc():
    """Verify naive datetimes are handled properly by assuming UTC without offset errors."""
    now_naive = datetime(2026, 10, 29, 10, 0, 0)
    created_naive = datetime(2026, 10, 29, 5, 0, 0)

    result = calculate_sla_risk(created_naive, 10, current_time=now_naive)

    assert result["ratio"] == 0.5
    assert result["percent_elapsed"] == 50.0
    assert result["risk_level"] == "Normal"
    assert result["is_high_risk"] is False


def test_sla_risk_mixed_naive_and_aware():
    """Verify mixing naive creation_time with timezone-aware current_time succeeds."""
    now_aware = datetime(2026, 10, 29, 10, 0, 0, tzinfo=timezone.utc)
    created_naive = datetime(2026, 10, 29, 5, 0, 0)

    result = calculate_sla_risk(created_naive, 10, current_time=now_aware)

    assert result["ratio"] == 0.5
    assert result["risk_level"] == "Normal"


def test_sla_risk_zero_limit_raises_value_error():
    """Verify sla_time_limit = 0 raises ValueError."""
    now = datetime.now(timezone.utc)
    with pytest.raises(ValueError, match="sla_time_limit must be greater than 0"):
        calculate_sla_risk(now, 0, current_time=now)

    with pytest.raises(ValueError, match="sla_time_limit must be greater than 0"):
        calculate_sla_risk(now, timedelta(0), current_time=now)


def test_sla_risk_negative_limit_raises_value_error():
    """Verify negative sla_time_limit raises ValueError."""
    now = datetime.now(timezone.utc)
    with pytest.raises(ValueError, match="sla_time_limit must be greater than 0"):
        calculate_sla_risk(now, -2.5, current_time=now)

    with pytest.raises(ValueError, match="sla_time_limit must be greater than 0"):
        calculate_sla_risk(now, timedelta(hours=-1), current_time=now)


def test_sla_risk_creation_in_future_raises_value_error():
    """Verify creation_time in the future raises ValueError."""
    now = datetime(2026, 10, 29, 12, 0, 0, tzinfo=timezone.utc)
    future = now + timedelta(minutes=15)

    with pytest.raises(ValueError, match="creation_time cannot be in the future"):
        calculate_sla_risk(future, 4.0, current_time=now)


def test_flag_tickets_helper():
    """Verify flag_tickets helper updates both dicts and objects with risk evaluations."""
    now = datetime.now(timezone.utc)
    tickets = [
        {
            "id": "T1",
            "creation_time": now - timedelta(hours=2),
            "sla_time_limit": 10.0,
        },
        {
            "id": "T2",
            "creation_time": now - timedelta(hours=9),
            "sla_time_limit": 10.0,
        },
    ]

    flagged = flag_tickets(tickets)
    assert len(flagged) == 2
    assert flagged[0]["sla_risk"]["risk_level"] == "Normal"
    assert flagged[1]["sla_risk"]["risk_level"] == "High Risk"

    # Test with custom object
    class DummyTicket:
        def __init__(self, creation_time, sla_time_limit):
            self.creation_time = creation_time
            self.sla_time_limit = sla_time_limit

    obj_ticket = DummyTicket(now - timedelta(hours=12), 10.0)
    flagged_objs = flag_tickets([obj_ticket])
    assert flagged_objs[0].sla_risk["breached"] is True

