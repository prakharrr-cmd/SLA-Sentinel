"""Unit tests for Engine 2: Team Assignment."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base, Team, Ticket
from backend.engines.team_assignment import (
    assign_team,
    NoTeamAvailableError,
    DEFAULT_TEAM_NAME,
)


@pytest.fixture
def db_session():
    """Create a fresh in-memory SQLite database session for each test."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def test_lowest_workload_wins(db_session):
    """Verify that among teams matching the category, the team with lowest open tickets wins."""
    team_a = Team(
        id="team-a",
        name="Team A - Payments",
        skill_tags=["Payments", "Billing"],
    )
    team_b = Team(
        id="team-b",
        name="Team B - Payments",
        skill_tags=["Payments", "Card Processing"],
    )
    db_session.add_all([team_a, team_b])
    db_session.commit()

    # Assign 3 open tickets to Team A
    for i in range(3):
        t = Ticket(
            id=f"T-A-{i}",
            category="Payments",
            status="Open",
            assigned_team_id="team-a",
        )
        db_session.add(t)

    # Assign 1 open ticket to Team B
    t_b = Ticket(
        id="T-B-1",
        category="Payments",
        status="Pending",
        assigned_team_id="team-b",
    )
    db_session.add(t_b)
    db_session.commit()

    result = assign_team("Payments", db_session)

    assert result["team_id"] == "team-b"
    assert result["team_name"] == "Team B - Payments"
    assert result["open_tickets"] == 1
    assert result["matched_by"] == "skill_tag"


def test_tie_break_alphabetically_by_name(db_session):
    """Verify that when open ticket count is identical, tie-break chooses alphabetically by name."""
    team_beta = Team(
        id="team-2",
        name="Beta Squad",
        skill_tags=["Cloud", "DevOps"],
    )
    team_alpha = Team(
        id="team-1",
        name="Alpha Squad",
        skill_tags=["Cloud", "DevOps"],
    )
    db_session.add_all([team_beta, team_alpha])
    db_session.commit()

    # Both teams have 0 open tickets
    result = assign_team("Cloud", db_session)

    assert result["team_id"] == "team-1"
    assert result["team_name"] == "Alpha Squad"
    assert result["open_tickets"] == 0
    assert result["matched_by"] == "skill_tag"


def test_case_insensitive_and_whitespace_trimmed_tag_match(db_session):
    """Verify that category matching ignores letter casing and outer whitespace."""
    team = Team(
        id="team-infra",
        name="DevOps Engineers",
        skill_tags=[" Infrastructure ", " Cloud "],
    )
    db_session.add(team)
    db_session.commit()

    result = assign_team("  iNfraSTRuctuRe  ", db_session)

    assert result["team_id"] == "team-infra"
    assert result["team_name"] == "DevOps Engineers"
    assert result["matched_by"] == "skill_tag"


def test_no_match_falls_back_to_default_team(db_session):
    """Verify that when no team matches category, it routes to General Support fallback."""
    team_billing = Team(
        id="team-bill",
        name="Billing Squad",
        skill_tags=["Billing"],
    )
    default_team = Team(
        id="team-gen",
        name=DEFAULT_TEAM_NAME,
        skill_tags=["Triage", "General"],
    )
    db_session.add_all([team_billing, default_team])
    db_session.commit()

    # Search for an unrelated category
    result = assign_team("Hardware Damage", db_session)

    assert result["team_id"] == "team-gen"
    assert result["team_name"] == DEFAULT_TEAM_NAME
    assert result["matched_by"] == "fallback"


def test_no_match_and_no_fallback_raises_error(db_session):
    """Verify NoTeamAvailableError is raised when neither tag matches nor default team exists."""
    team_billing = Team(
        id="team-bill",
        name="Billing Squad",
        skill_tags=["Billing"],
    )
    db_session.add(team_billing)
    db_session.commit()

    with pytest.raises(NoTeamAvailableError, match="No team matches category 'Hardware'"):
        assign_team("Hardware", db_session)


def test_open_ticket_count_excludes_closed_and_resolved(db_session):
    """Verify that Closed and Resolved tickets do not count towards active workload."""
    team_a = Team(
        id="team-a",
        name="Team Alpha",
        skill_tags=["Support"],
    )
    team_b = Team(
        id="team-b",
        name="Team Beta",
        skill_tags=["Support"],
    )
    db_session.add_all([team_a, team_b])
    db_session.commit()

    # Team Alpha has 5 Closed/Resolved tickets and 0 open
    for i in range(3):
        db_session.add(
            Ticket(
                id=f"closed-{i}",
                category="Support",
                status="Closed",
                assigned_team_id="team-a",
            )
        )
    for i in range(2):
        db_session.add(
            Ticket(
                id=f"resolved-{i}",
                category="Support",
                status="resolved",
                assigned_team_id="team-a",
            )
        )

    # Team Beta has 1 Open ticket
    db_session.add(
        Ticket(
            id="open-1",
            category="Support",
            status="Open",
            assigned_team_id="team-b",
        )
    )
    db_session.commit()

    result = assign_team("Support", db_session)

    # Team Alpha has 0 open tickets vs Team Beta with 1 open ticket
    assert result["team_id"] == "team-a"
    assert result["open_tickets"] == 0

