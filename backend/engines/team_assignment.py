"""Team Assignment engine based on skill matching and workload balancing."""

import json
from typing import Any, Optional, Set
from sqlalchemy import func
from sqlalchemy.orm import Session

DEFAULT_TEAM_NAME: str = "General Support"
CLOSED_STATUSES: set[str] = {"closed", "resolved"}


class NoTeamAvailableError(Exception):
    """Raised when no suitable team is available for assignment."""

    pass


def _extract_skill_tags(raw_tags: Any) -> Set[str]:
    """Normalize skill tags to a set of trimmed, lowercase strings."""
    if isinstance(raw_tags, (list, tuple, set)):
        return {str(t).strip().lower() for t in raw_tags if str(t).strip()}
    if isinstance(raw_tags, str):
        trimmed = raw_tags.strip()
        if trimmed.startswith("[") and trimmed.endswith("]"):
            try:
                parsed = json.loads(trimmed)
                if isinstance(parsed, list):
                    return {str(t).strip().lower() for t in parsed if str(t).strip()}
            except Exception:
                pass
        return {t.strip().lower() for t in trimmed.split(",") if t.strip()}
    return set()


def assign_team(
    ticket_category: str,
    db_session: Session,
    team_model: Optional[Any] = None,
    ticket_model: Optional[Any] = None,
) -> dict[str, Any]:
    """Assign the best available team to a ticket based on category and open workload.

    Args:
        ticket_category: Category / topic of the ticket.
        db_session: SQLAlchemy database session.
        team_model: Team ORM model class. Defaults to backend.models.Team.
        ticket_model: Ticket ORM model class. Defaults to backend.models.Ticket.

    Returns:
        dict: Assignment details containing team_id, team_name, open_tickets,
              and matched_by ("skill_tag" or "fallback").

    Raises:
        NoTeamAvailableError: If no matching team exists and the fallback team
                              is unavailable.
    """
    if team_model is None:
        from backend.models import Team as team_model
    if ticket_model is None:
        from backend.models import Ticket as ticket_model

    # 1. Load all teams from DB
    all_teams = db_session.query(team_model).all()

    # 2. Filter teams matching the category (case-insensitive, trimmed)
    category_normalized = ticket_category.strip().lower() if ticket_category else ""
    matching_teams = []
    if category_normalized:
        for team in all_teams:
            tags = _extract_skill_tags(getattr(team, "skill_tags", None))
            if category_normalized in tags:
                matching_teams.append(team)

    # Determine candidate pool and match type
    if matching_teams:
        candidates = matching_teams
        matched_by = "skill_tag"
    else:
        # Fallback to default team
        fallback_team = next(
            (
                t
                for t in all_teams
                if getattr(t, "name", "").strip().lower() == DEFAULT_TEAM_NAME.strip().lower()
            ),
            None,
        )
        if fallback_team is None:
            raise NoTeamAvailableError(
                f"No team matches category '{ticket_category}' and default team "
                f"'{DEFAULT_TEAM_NAME}' is not available."
            )
        candidates = [fallback_team]
        matched_by = "fallback"

    # 3. Count currently open tickets across all teams in ONE query (GROUP BY)
    closed_list = list(CLOSED_STATUSES)
    workload_query = (
        db_session.query(
            ticket_model.assigned_team_id,
            func.count(ticket_model.id),
        )
        .filter(ticket_model.assigned_team_id.isnot(None))
        .filter(
            func.coalesce(func.lower(ticket_model.status), "").not_in(closed_list)
        )
        .group_by(ticket_model.assigned_team_id)
        .all()
    )
    workload_map: dict[str, int] = {
        str(t_id): count for t_id, count in workload_query
    }

    # 4 & 5. Pick team with lowest count, tie-break alphabetically by team name
    best_team = min(
        candidates,
        key=lambda t: (workload_map.get(str(t.id), 0), getattr(t, "name", "")),
    )
    best_open_count = workload_map.get(str(best_team.id), 0)

    return {
        "team_id": best_team.id,
        "team_name": best_team.name,
        "open_tickets": int(best_open_count),
        "matched_by": matched_by,
    }

