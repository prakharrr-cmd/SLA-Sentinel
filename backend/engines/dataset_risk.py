"""Dataset-aware SLA risk scoring engine and record adapter.

Evaluates imported tickets against independent SLA targets (response vs resolution),
distinguishes active from historical tickets, and reuses the core SLA risk logic
while providing deterministic ranking, audit explanations, and data quality disclosures.
"""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Tuple

from backend.engines.sla_risk import calculate_sla_risk, SLA_RISK_THRESHOLD
from backend.models import ImportedTicket
from backend.schemas import TicketRiskRecord


HISTORICAL_STATUSES = {"Resolved", "Closed"}


def normalize_to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime is timezone-aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def score_ticket_risk(
    ticket: ImportedTicket,
    sla_target: str,
    reference_time: datetime,
) -> TicketRiskRecord:
    """Score SLA risk for a single imported ticket against a target deadline.

    Args:
        ticket: ImportedTicket model instance.
        sla_target: "resolution_deadline" or "response_deadline"
        reference_time: Consistent UTC evaluation timestamp.

    Returns:
        TicketRiskRecord with score, category, SLA state, evidence, and warnings.
    """
    ref_time = normalize_to_utc(reference_time)
    created_at = normalize_to_utc(ticket.created_at)
    status = ticket.status or "Unknown"
    priority = ticket.priority or "Unknown"

    if sla_target == "response_deadline":
        applicable_deadline = normalize_to_utc(ticket.response_deadline)
    else:
        sla_target = "resolution_deadline"
        applicable_deadline = normalize_to_utc(ticket.resolution_deadline)

    coverage_warnings: List[str] = []
    is_historical = status in HISTORICAL_STATUSES

    # -------------------------------------------------------------
    # 1. Historical / Resolved Ticket Evaluation
    # -------------------------------------------------------------
    if is_historical:
        resolved_at = normalize_to_utc(ticket.resolved_at)
        if applicable_deadline is None:
            coverage_warnings.append(f"Historical ticket has no {sla_target}.")
            return TicketRiskRecord(
                dataset_id=ticket.dataset_id,
                ticket_id=ticket.source_ticket_id,
                title=ticket.title,
                status=status,
                priority=priority,
                created_at=created_at,
                sla_target=sla_target,
                applicable_deadline=None,
                current_sla_state="Resolved (No Deadline)",
                risk_score=None,
                risk_category="Resolved",
                ratio=None,
                percent_elapsed=None,
                evidence=f"Ticket is {status}. No {sla_target} was configured in source data.",
                coverage_warnings=coverage_warnings,
                assigned_team_id=ticket.assigned_team_id,
            )

        if resolved_at is not None:
            if resolved_at <= applicable_deadline:
                return TicketRiskRecord(
                    dataset_id=ticket.dataset_id,
                    ticket_id=ticket.source_ticket_id,
                    title=ticket.title,
                    status=status,
                    priority=priority,
                    created_at=created_at,
                    sla_target=sla_target,
                    applicable_deadline=applicable_deadline,
                    current_sla_state="Met SLA",
                    risk_score=None,
                    risk_category="Resolved",
                    ratio=None,
                    percent_elapsed=None,
                    evidence=(
                        f"Ticket was resolved at {resolved_at.strftime('%Y-%m-%d %H:%M:%S UTC')}, "
                        f"before the deadline of {applicable_deadline.strftime('%Y-%m-%d %H:%M:%S UTC')}."
                    ),
                    coverage_warnings=coverage_warnings,
                    assigned_team_id=ticket.assigned_team_id,
                )
            else:
                return TicketRiskRecord(
                    dataset_id=ticket.dataset_id,
                    ticket_id=ticket.source_ticket_id,
                    title=ticket.title,
                    status=status,
                    priority=priority,
                    created_at=created_at,
                    sla_target=sla_target,
                    applicable_deadline=applicable_deadline,
                    current_sla_state="Breached in Past",
                    risk_score=None,
                    risk_category="Resolved",
                    ratio=None,
                    percent_elapsed=None,
                    evidence=(
                        f"Ticket was resolved at {resolved_at.strftime('%Y-%m-%d %H:%M:%S UTC')}, "
                        f"which breached the deadline of {applicable_deadline.strftime('%Y-%m-%d %H:%M:%S UTC')}."
                    ),
                    coverage_warnings=coverage_warnings,
                    assigned_team_id=ticket.assigned_team_id,
                )

        # Missing resolved_at timestamp on a closed ticket
        coverage_warnings.append("Historical ticket lacks resolved_at timestamp to independently verify SLA outcome.")
        return TicketRiskRecord(
            dataset_id=ticket.dataset_id,
            ticket_id=ticket.source_ticket_id,
            title=ticket.title,
            status=status,
            priority=priority,
            created_at=created_at,
            sla_target=sla_target,
            applicable_deadline=applicable_deadline,
            current_sla_state="Resolved (Unverified)",
            risk_score=None,
            risk_category="Resolved",
            ratio=None,
            percent_elapsed=None,
            evidence=f"Ticket is {status}, but lacks resolved_at timestamp to verify whether SLA was met before close.",
            coverage_warnings=coverage_warnings,
            assigned_team_id=ticket.assigned_team_id,
        )

    # -------------------------------------------------------------
    # 2. Active Ticket Evaluation
    # -------------------------------------------------------------
    if created_at is None:
        coverage_warnings.append("Ticket is missing creation timestamp (created_at).")
        return TicketRiskRecord(
            dataset_id=ticket.dataset_id,
            ticket_id=ticket.source_ticket_id,
            title=ticket.title,
            status=status,
            priority=priority,
            created_at=None,
            sla_target=sla_target,
            applicable_deadline=applicable_deadline,
            current_sla_state="Unscorable",
            risk_score=None,
            risk_category="Unscorable",
            ratio=None,
            percent_elapsed=None,
            evidence="Ticket cannot be scored because created_at timestamp is missing.",
            coverage_warnings=coverage_warnings,
            assigned_team_id=ticket.assigned_team_id,
        )

    if applicable_deadline is None:
        coverage_warnings.append(f"Ticket has no {sla_target}.")
        return TicketRiskRecord(
            dataset_id=ticket.dataset_id,
            ticket_id=ticket.source_ticket_id,
            title=ticket.title,
            status=status,
            priority=priority,
            created_at=created_at,
            sla_target=sla_target,
            applicable_deadline=None,
            current_sla_state="Unscorable",
            risk_score=None,
            risk_category="Unscorable",
            ratio=None,
            percent_elapsed=None,
            evidence=f"Active ticket cannot be scored for SLA risk because {sla_target} is missing in source data.",
            coverage_warnings=coverage_warnings,
            assigned_team_id=ticket.assigned_team_id,
        )

    if applicable_deadline <= created_at:
        coverage_warnings.append(f"{sla_target} is earlier than or equal to created_at.")
        return TicketRiskRecord(
            dataset_id=ticket.dataset_id,
            ticket_id=ticket.source_ticket_id,
            title=ticket.title,
            status=status,
            priority=priority,
            created_at=created_at,
            sla_target=sla_target,
            applicable_deadline=applicable_deadline,
            current_sla_state="Unscorable",
            risk_score=None,
            risk_category="Unscorable",
            ratio=None,
            percent_elapsed=None,
            evidence=(
                f"Invalid SLA configuration: deadline ({applicable_deadline.strftime('%Y-%m-%d %H:%M:%S UTC')}) "
                f"is earlier than or equal to creation time ({created_at.strftime('%Y-%m-%d %H:%M:%S UTC')})."
            ),
            coverage_warnings=coverage_warnings,
            assigned_team_id=ticket.assigned_team_id,
        )

    if created_at > ref_time:
        coverage_warnings.append("created_at is in the future relative to evaluation reference time.")
        return TicketRiskRecord(
            dataset_id=ticket.dataset_id,
            ticket_id=ticket.source_ticket_id,
            title=ticket.title,
            status=status,
            priority=priority,
            created_at=created_at,
            sla_target=sla_target,
            applicable_deadline=applicable_deadline,
            current_sla_state="Unscorable",
            risk_score=None,
            risk_category="Unscorable",
            ratio=None,
            percent_elapsed=None,
            evidence=(
                f"Ticket creation time ({created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}) "
                f"is in the future relative to the reference clock ({ref_time.strftime('%Y-%m-%d %H:%M:%S UTC')})."
            ),
            coverage_warnings=coverage_warnings,
            assigned_team_id=ticket.assigned_team_id,
        )

    # Valid active ticket with scorable timestamps
    limit_delta = applicable_deadline - created_at
    engine_calc = calculate_sla_risk(
        creation_time=created_at,
        sla_time_limit=limit_delta,
        current_time=ref_time,
    )
    ratio = float(engine_calc["ratio"])
    pct = float(engine_calc["percent_elapsed"])
    limit_hours = round(limit_delta.total_seconds() / 3600.0, 2)

    if ratio >= 1.0:
        current_sla_state = "Breached"
        risk_category = "Critical Risk"
        risk_score = round(min(ratio * 100.0, 100.0), 1)
        overdue_hours = round((ref_time - applicable_deadline).total_seconds() / 3600.0, 2)
        evidence = (
            f"Active ticket has exceeded its {limit_hours}h {sla_target} by {overdue_hours}h "
            f"({round(pct, 1)}% of window elapsed)."
        )
    elif ratio > SLA_RISK_THRESHOLD:
        current_sla_state = "High Risk"
        risk_category = "High Risk"
        risk_score = round(pct, 1)
        remaining_hours = round((applicable_deadline - ref_time).total_seconds() / 3600.0, 2)
        evidence = (
            f"Active ticket has consumed {round(pct, 1)}% of its {limit_hours}h SLA limit "
            f"(exceeds {int(SLA_RISK_THRESHOLD * 100)}% risk threshold). {remaining_hours}h remaining."
        )
    elif ratio > 0.50:
        current_sla_state = "Within Target"
        risk_category = "Medium Risk"
        risk_score = round(pct, 1)
        remaining_hours = round((applicable_deadline - ref_time).total_seconds() / 3600.0, 2)
        evidence = (
            f"Active ticket is progressing within allowed target ({round(pct, 1)}% elapsed of {limit_hours}h window). "
            f"{remaining_hours}h remaining."
        )
    else:
        current_sla_state = "Within Target"
        risk_category = "Low Risk"
        risk_score = round(pct, 1)
        remaining_hours = round((applicable_deadline - ref_time).total_seconds() / 3600.0, 2)
        evidence = (
            f"Active ticket is early in SLA window ({round(pct, 1)}% elapsed of {limit_hours}h window). "
            f"{remaining_hours}h remaining."
        )

    return TicketRiskRecord(
        dataset_id=ticket.dataset_id,
        ticket_id=ticket.source_ticket_id,
        title=ticket.title,
        status=status,
        priority=priority,
        created_at=created_at,
        sla_target=sla_target,
        applicable_deadline=applicable_deadline,
        current_sla_state=current_sla_state,
        risk_score=risk_score,
        risk_category=risk_category,
        ratio=ratio,
        percent_elapsed=pct,
        evidence=evidence,
        coverage_warnings=coverage_warnings,
        assigned_team_id=ticket.assigned_team_id,
    )


def sort_key_for_risk(record: TicketRiskRecord) -> Tuple[int, float, float, float, str]:
    """Deterministic tie-breaking sort key for ranked SLA risks.

    Ordering priority:
    1. SLA urgency rank:
       - 0: Breached active tickets
       - 1: High Risk active tickets (>80%)
       - 2: Medium Risk active tickets (>50%)
       - 3: Low Risk active tickets
       - 4: Unscorable active tickets
       - 5: Resolved / Historical tickets
    2. Risk score (descending, None -> -1.0)
    3. Elapsed ratio (descending, None -> -1.0)
    4. Deadline timestamp (ascending, None -> inf)
    5. source_ticket_id (deterministic string tie-breaker)
    """
    if record.current_sla_state == "Breached":
        urgency = 0
    elif record.risk_category == "High Risk":
        urgency = 1
    elif record.risk_category == "Medium Risk":
        urgency = 2
    elif record.risk_category == "Low Risk":
        urgency = 3
    elif record.risk_category == "Unscorable":
        urgency = 4
    else:  # Resolved
        urgency = 5

    score_val = -(record.risk_score if record.risk_score is not None else -1.0)
    ratio_val = -(record.ratio if record.ratio is not None else -1.0)
    deadline_ts = (
        record.applicable_deadline.timestamp()
        if record.applicable_deadline is not None
        else float("inf")
    )
    tie_breaker = record.ticket_id

    return (urgency, score_val, ratio_val, deadline_ts, tie_breaker)

