"""Evidence-based recommendation engine for SLA Sentinel.

Produces deterministic, explainable recommendations for active dataset tickets,
scoped to the requested dataset, reusing existing risk calculations, and avoiding
unsupported claims or fabricated capacity figures.
"""

from collections import Counter
from datetime import datetime, timezone
import math
from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session

from backend.engines.dataset_risk import (
    score_ticket_risk,
    normalize_to_utc,
    HISTORICAL_STATUSES,
)
from backend.models import Dataset, ImportedTicket, Team
from backend.schemas import RecommendationItem, PaginatedRecommendationsResponse


def _normalize_category_skills(category: Optional[str]) -> str:
    """Normalize category name for skill matching."""
    return (category or "").strip().lower()


def generate_dataset_recommendations(
    dataset: Dataset,
    db: Session,
    sla_target: str = "resolution_deadline",
    recommendation_type_filter: Optional[str] = None,
    risk_category_filter: Optional[str] = None,
    evidence_strength_filter: Optional[str] = None,
    reference_time: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 50,
) -> PaginatedRecommendationsResponse:
    """Generate evidence-backed operational recommendations for tickets in a dataset.

    Args:
        dataset: The Dataset ORM instance.
        db: Database session.
        sla_target: Target SLA ("resolution_deadline" or "response_deadline").
        recommendation_type_filter: Optional filter by type.
        risk_category_filter: Optional filter by risk category.
        evidence_strength_filter: Optional filter by evidence strength.
        reference_time: Optional evaluation reference clock.
        page: Page number (1-indexed).
        page_size: Page size.

    Returns:
        PaginatedRecommendationsResponse with structured recommendation items.
    """
    ref_time = normalize_to_utc(reference_time)
    if ref_time is None:
        if dataset.snapshot_at is not None:
            ref_time = normalize_to_utc(dataset.snapshot_at)
        else:
            ref_time = datetime.now(timezone.utc)

    # 1. Query all imported tickets for this dataset
    tickets: List[ImportedTicket] = (
        db.query(ImportedTicket)
        .filter(ImportedTicket.dataset_id == dataset.id)
        .all()
    )

    # 2. Pre-calculate active squad workloads within this dataset
    squad_workloads: Dict[str, int] = Counter()
    for t in tickets:
        if (t.status or "") not in HISTORICAL_STATUSES and t.assigned_team_id:
            squad_workloads[t.assigned_team_id] += 1

    # 3. Query all known teams for skill matching
    all_teams: List[Team] = db.query(Team).all()

    recommendations: List[RecommendationItem] = []

    for ticket in tickets:
        status = ticket.status or "Unknown"

        # Exclude historical / resolved tickets from active intervention recommendations
        if status in HISTORICAL_STATUSES:
            continue

        # Score risk using the existing verified engine
        risk_rec = score_ticket_risk(ticket, sla_target, ref_time)
        cat_norm = _normalize_category_skills(ticket.category)
        rec_id = f"rec:{dataset.id}:{ticket.source_ticket_id}:{sla_target}"

        rec_item: Optional[RecommendationItem] = None

        # ---------------------------------------------------------
        # Case A: Insufficient Data / Unscorable
        # ---------------------------------------------------------
        if risk_rec.current_sla_state == "Unscorable":
            rec_item = RecommendationItem(
                id=rec_id,
                recommendation_id=rec_id,
                dataset_id=dataset.id,
                ticket_id=ticket.source_ticket_id,
                ticket_title=ticket.title,
                status=status,
                priority=ticket.priority or "Normal",
                category=ticket.category,
                assigned_team_id=ticket.assigned_team_id,
                sla_target=sla_target,
                risk_score=None,
                risk_category="Unscorable",
                recommendation_type="insufficient_data",
                proposed_action="Populate missing SLA target timestamp or creation time to enable automated recommendations.",
                suggested_team_id=None,
                reason="Ticket cannot be safely scored because required SLA deadline or creation timestamp is missing or invalid.",
                evidence=[risk_rec.evidence] + risk_rec.coverage_warnings,
                evidence_strength="insufficient_data",
                limitations=["Automated risk scoring is unavailable without verified timestamps."],
                status_review="pending_review",
            )

        # ---------------------------------------------------------
        # Case B: Breached Active Tickets
        # ---------------------------------------------------------
        elif risk_rec.current_sla_state == "Breached":
            rec_item = RecommendationItem(
                id=rec_id,
                recommendation_id=rec_id,
                dataset_id=dataset.id,
                ticket_id=ticket.source_ticket_id,
                ticket_title=ticket.title,
                status=status,
                priority=ticket.priority or "Normal",
                category=ticket.category,
                assigned_team_id=ticket.assigned_team_id,
                sla_target=sla_target,
                risk_score=risk_rec.risk_score,
                risk_category="Critical Risk",
                recommendation_type="prioritize_ticket",
                proposed_action="Immediate lead escalation and priority remediation to contain SLA breach penalties.",
                suggested_team_id=None,
                reason=f"Active ticket has breached its {sla_target} deadline.",
                evidence=[risk_rec.evidence],
                evidence_strength="high",
                limitations=["SLA is already in breach; priority action focuses on damage containment."],
                status_review="pending_review",
            )

        # ---------------------------------------------------------
        # Case C: High Risk Active Tickets (>80% consumed)
        # ---------------------------------------------------------
        elif risk_rec.risk_category == "High Risk":
            if not ticket.assigned_team_id:
                rec_item = RecommendationItem(
                    id=rec_id,
                    recommendation_id=rec_id,
                    dataset_id=dataset.id,
                    ticket_id=ticket.source_ticket_id,
                    ticket_title=ticket.title,
                    status=status,
                    priority=ticket.priority or "Normal",
                    category=ticket.category,
                    assigned_team_id=None,
                    sla_target=sla_target,
                    risk_score=risk_rec.risk_score,
                    risk_category="High Risk",
                    recommendation_type="review_assignment",
                    proposed_action="Assign an active squad immediately to begin work before SLA breach.",
                    suggested_team_id=None,
                    reason="Ticket is in high breach risk (>80% SLA elapsed) but has no assigned squad.",
                    evidence=[risk_rec.evidence, "Ticket currently has no assigned squad."],
                    evidence_strength="high",
                    limitations=["Squad must be selected manually based on on-call availability."],
                    status_review="pending_review",
                )
            else:
                current_team_id = ticket.assigned_team_id
                current_load = squad_workloads.get(current_team_id, 0)

                # Check if a matching squad with strictly lower active workload exists in the DB
                candidate_teams = []
                for tm in all_teams:
                    if tm.id == current_team_id:
                        continue
                    skills = {str(s).strip().lower() for s in (tm.get_skill_tags_list() or [])}
                    if cat_norm and (cat_norm in skills or any(cat_norm in s or s in cat_norm for s in skills)):
                        candidate_teams.append(tm)

                # Find candidate with lowest load in this dataset
                candidate_teams.sort(key=lambda t: (squad_workloads.get(t.id, 0), t.name))
                best_candidate = candidate_teams[0] if candidate_teams else None

                if best_candidate and squad_workloads.get(best_candidate.id, 0) < current_load:
                    cand_load = squad_workloads.get(best_candidate.id, 0)
                    rec_item = RecommendationItem(
                        id=rec_id,
                        recommendation_id=rec_id,
                        dataset_id=dataset.id,
                        ticket_id=ticket.source_ticket_id,
                        ticket_title=ticket.title,
                        status=status,
                        priority=ticket.priority or "Normal",
                        category=ticket.category,
                        assigned_team_id=current_team_id,
                        sla_target=sla_target,
                        risk_score=risk_rec.risk_score,
                        risk_category="High Risk",
                        recommendation_type="reassign_ticket",
                        proposed_action=f"Reassign ticket from '{current_team_id}' ({current_load} active tickets) to '{best_candidate.name}' ({best_candidate.id}, {cand_load} active tickets).",
                        suggested_team_id=best_candidate.id,
                        reason=f"Current squad '{current_team_id}' has {current_load} active tickets in this dataset; alternate squad '{best_candidate.name}' ({best_candidate.id}) has verified category skills and lower queue load ({cand_load} active tickets).",
                        evidence=[
                            risk_rec.evidence,
                            f"Current squad '{current_team_id}' load: {current_load} active tickets in dataset.",
                            f"Target squad '{best_candidate.name}' ({best_candidate.id}) matches skills for '{ticket.category}' with {cand_load} active tickets.",
                        ],
                        evidence_strength="high",
                        limitations=["Workload is evaluated across dataset records; individual agent shifts are not tracked."],
                        status_review="pending_review",
                    )
                else:
                    rec_item = RecommendationItem(
                        id=rec_id,
                        recommendation_id=rec_id,
                        dataset_id=dataset.id,
                        ticket_id=ticket.source_ticket_id,
                        ticket_title=ticket.title,
                        status=status,
                        priority=ticket.priority or "Normal",
                        category=ticket.category,
                        assigned_team_id=current_team_id,
                        sla_target=sla_target,
                        risk_score=risk_rec.risk_score,
                        risk_category="High Risk",
                        recommendation_type="prioritize_ticket",
                        proposed_action=f"Prioritize ticket processing within squad '{current_team_id}' to protect remaining SLA buffer.",
                        suggested_team_id=None,
                        reason=f"Ticket has consumed {round(risk_rec.percent_elapsed or 0, 1)}% of allowed SLA. No alternative squad with matching skills and lower queue load is available.",
                        evidence=[risk_rec.evidence],
                        evidence_strength="high",
                        limitations=["No alternative team with lower active workload matched category skills."],
                        status_review="pending_review",
                    )

        # ---------------------------------------------------------
        # Case D: Medium Risk Active Tickets (50% - 80% consumed)
        # ---------------------------------------------------------
        elif risk_rec.risk_category == "Medium Risk":
            if not ticket.assigned_team_id:
                rec_item = RecommendationItem(
                    id=rec_id,
                    recommendation_id=rec_id,
                    dataset_id=dataset.id,
                    ticket_id=ticket.source_ticket_id,
                    ticket_title=ticket.title,
                    status=status,
                    priority=ticket.priority or "Normal",
                    category=ticket.category,
                    assigned_team_id=None,
                    sla_target=sla_target,
                    risk_score=risk_rec.risk_score,
                    risk_category="Medium Risk",
                    recommendation_type="review_assignment",
                    proposed_action="Assign a squad to initiate triage before SLA risk escalates.",
                    suggested_team_id=None,
                    reason="Ticket is at medium risk (50-80% of SLA consumed) and is currently unassigned.",
                    evidence=[risk_rec.evidence, "Ticket has no squad assignment in source data."],
                    evidence_strength="medium",
                    limitations=[],
                    status_review="pending_review",
                )
            else:
                rec_item = RecommendationItem(
                    id=rec_id,
                    recommendation_id=rec_id,
                    dataset_id=dataset.id,
                    ticket_id=ticket.source_ticket_id,
                    ticket_title=ticket.title,
                    status=status,
                    priority=ticket.priority or "Normal",
                    category=ticket.category,
                    assigned_team_id=ticket.assigned_team_id,
                    sla_target=sla_target,
                    risk_score=risk_rec.risk_score,
                    risk_category="Medium Risk",
                    recommendation_type="monitor_ticket",
                    proposed_action="Monitor ticket progression; verify active handling by assigned squad.",
                    suggested_team_id=None,
                    reason=f"Ticket is progressing within target ({round(risk_rec.percent_elapsed or 0, 1)}% elapsed).",
                    evidence=[risk_rec.evidence],
                    evidence_strength="medium",
                    limitations=[],
                    status_review="pending_review",
                )

        # ---------------------------------------------------------
        # Case E: Low Risk Active Tickets (<50% consumed)
        # ---------------------------------------------------------
        elif risk_rec.risk_category == "Low Risk":
            if not ticket.assigned_team_id:
                rec_item = RecommendationItem(
                    id=rec_id,
                    recommendation_id=rec_id,
                    dataset_id=dataset.id,
                    ticket_id=ticket.source_ticket_id,
                    ticket_title=ticket.title,
                    status=status,
                    priority=ticket.priority or "Normal",
                    category=ticket.category,
                    assigned_team_id=None,
                    sla_target=sla_target,
                    risk_score=risk_rec.risk_score,
                    risk_category="Low Risk",
                    recommendation_type="review_assignment",
                    proposed_action="Assign appropriate squad as part of regular queue triage.",
                    suggested_team_id=None,
                    reason="Ticket is healthy within SLA window but lacks an assigned squad.",
                    evidence=[risk_rec.evidence, "Unassigned ticket in queue."],
                    evidence_strength="low",
                    limitations=[],
                    status_review="pending_review",
                )
            else:
                rec_item = RecommendationItem(
                    id=rec_id,
                    recommendation_id=rec_id,
                    dataset_id=dataset.id,
                    ticket_id=ticket.source_ticket_id,
                    ticket_title=ticket.title,
                    status=status,
                    priority=ticket.priority or "Normal",
                    category=ticket.category,
                    assigned_team_id=ticket.assigned_team_id,
                    sla_target=sla_target,
                    risk_score=risk_rec.risk_score,
                    risk_category="Low Risk",
                    recommendation_type="monitor_ticket",
                    proposed_action="Standard queue monitoring; ticket is well within allowed SLA.",
                    suggested_team_id=None,
                    reason=f"Ticket is early in SLA window ({round(risk_rec.percent_elapsed or 0, 1)}% elapsed).",
                    evidence=[risk_rec.evidence],
                    evidence_strength="low",
                    limitations=[],
                    status_review="pending_review",
                )

        if rec_item:
            # Apply filters
            if recommendation_type_filter and rec_item.recommendation_type.lower() != recommendation_type_filter.lower():
                continue
            if risk_category_filter and rec_item.risk_category.lower() != risk_category_filter.lower():
                continue
            if evidence_strength_filter and rec_item.evidence_strength.lower() != evidence_strength_filter.lower():
                continue

            recommendations.append(rec_item)

    # 4. Deterministic sorting
    def sort_key(rec: RecommendationItem) -> Tuple[int, float, str]:
        type_rank = {
            "prioritize_ticket": 0,
            "reassign_ticket": 1,
            "review_assignment": 2,
            "monitor_ticket": 3,
            "insufficient_data": 4,
        }.get(rec.recommendation_type, 5)

        score_val = -(rec.risk_score if rec.risk_score is not None else -1.0)
        tie_breaker = rec.ticket_id
        return (type_rank, score_val, tie_breaker)

    recommendations.sort(key=sort_key)

    total = len(recommendations)
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    safe_page = max(1, page)
    offset = (safe_page - 1) * page_size
    items = recommendations[offset : offset + page_size]

    return PaginatedRecommendationsResponse(
        dataset_id=dataset.id,
        sla_target=sla_target,
        reference_time=ref_time,
        total=total,
        page=safe_page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )
