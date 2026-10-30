"""Outcome evaluation and SLA performance measurement service.

Evaluates observed operational performance, establishes empirical baseline vs. post-action
cohorts, distinguishes action completion from business outcomes, and provides
observational comparisons without unsupported causal claims.
"""

from datetime import datetime, timezone
import hashlib
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.engines.dataset_risk import (
    score_ticket_risk,
    normalize_to_utc,
    HISTORICAL_STATUSES,
)
from backend.models import (
    Dataset,
    ImportedTicket,
    ManagerDecision,
    TrackedAction,
    EvaluationSnapshot,
)
from backend.schemas import (
    ActionSummaryMetrics,
    SLAMetricCohort,
    MetricComparisonItem,
    TargetEvaluation,
    DatasetEvaluationResponse,
    ActionEvaluationResponse,
)

OBSERVATIONAL_DISCLAIMER = (
    "Observational before-and-after performance evaluation. Changes in metrics reflect observed "
    "cohort differences and do not establish causal attribution to individual completed actions."
)


def _safe_percent_change(baseline: Optional[float], post_action: Optional[float]) -> Optional[float]:
    """Calculate relative percentage change safely without zero division or missing values."""
    if baseline is None or post_action is None:
        return None
    if baseline == 0.0:
        return None
    return round(((post_action - baseline) / abs(baseline)) * 100.0, 2)


def _safe_diff(baseline: Optional[float], post_action: Optional[float]) -> Optional[float]:
    """Calculate absolute difference between post_action and baseline."""
    if baseline is None or post_action is None:
        return None
    return round(post_action - baseline, 4)


def evaluate_cohort(
    cohort: List[ImportedTicket],
    target_field: str,
    window_name: str,
    window_start: Optional[datetime],
    window_end: Optional[datetime],
    ref_time: datetime,
) -> SLAMetricCohort:
    """Calculate SLA metrics for a specific observational ticket window."""
    sample_size = len(cohort)
    eligible_count = 0
    met_count = 0
    breached_count = 0
    active_high_risk = 0
    durations: List[float] = []

    for t in cohort:
        c_at = normalize_to_utc(t.created_at)
        deadline = normalize_to_utc(getattr(t, target_field, None))
        r_at = normalize_to_utc(t.resolved_at)

        if not c_at or not deadline or deadline <= c_at:
            continue

        eligible_count += 1
        rec = score_ticket_risk(t, target_field, ref_time)

        if (t.status or "") in HISTORICAL_STATUSES:
            if rec.current_sla_state == "Met SLA":
                met_count += 1
            elif rec.current_sla_state == "Breached in Past":
                breached_count += 1

            if target_field == "resolution_deadline":
                dur = t.resolution_duration
                if dur is None and r_at and c_at:
                    dur = (r_at - c_at).total_seconds() / 3600.0
                if dur is not None and dur >= 0:
                    durations.append(dur)
            else:
                dur = t.response_duration
                if dur is not None and dur >= 0:
                    durations.append(dur)
        else:
            if rec.current_sla_state == "Breached":
                breached_count += 1
            elif rec.risk_category == "High Risk":
                active_high_risk += 1

    compliance_rate = round(met_count / eligible_count, 4) if eligible_count > 0 else None
    breach_rate = round(breached_count / eligible_count, 4) if eligible_count > 0 else None
    avg_dur = round(sum(durations) / len(durations), 2) if len(durations) > 0 else None

    return SLAMetricCohort(
        window_name=window_name,
        window_start=window_start,
        window_end=window_end,
        ticket_sample_size=sample_size,
        eligible_count=eligible_count,
        met_sla_count=met_count,
        breached_sla_count=breached_count,
        compliance_rate=compliance_rate,
        breach_rate=breach_rate,
        avg_duration_hours=avg_dur,
        active_high_risk_count=active_high_risk,
    )


def build_comparisons(base: SLAMetricCohort, post: SLAMetricCohort) -> List[MetricComparisonItem]:
    """Build side-by-side metric comparison items."""
    comparisons: List[MetricComparisonItem] = []

    # 1. Compliance Rate
    diff_comp = _safe_diff(base.compliance_rate, post.compliance_rate)
    pct_comp = _safe_percent_change(base.compliance_rate, post.compliance_rate)
    interp_comp = (
        "Improved" if diff_comp and diff_comp > 0 else ("Deteriorated" if diff_comp and diff_comp < 0 else "Unchanged or insufficient data")
    )
    comparisons.append(
        MetricComparisonItem(
            metric_name="SLA Compliance Rate",
            baseline_value=base.compliance_rate,
            post_action_value=post.compliance_rate,
            absolute_difference=diff_comp,
            relative_percent_change=pct_comp,
            interpretation=interp_comp,
        )
    )

    # 2. Breach Rate
    diff_br = _safe_diff(base.breach_rate, post.breach_rate)
    pct_br = _safe_percent_change(base.breach_rate, post.breach_rate)
    interp_br = (
        "Improved (Lower Breach Rate)" if diff_br and diff_br < 0 else ("Deteriorated (Higher Breach Rate)" if diff_br and diff_br > 0 else "Unchanged or insufficient data")
    )
    comparisons.append(
        MetricComparisonItem(
            metric_name="SLA Breach Rate",
            baseline_value=base.breach_rate,
            post_action_value=post.breach_rate,
            absolute_difference=diff_br,
            relative_percent_change=pct_br,
            interpretation=interp_br,
        )
    )

    # 3. Average Duration (Hours)
    diff_dur = _safe_diff(base.avg_duration_hours, post.avg_duration_hours)
    pct_dur = _safe_percent_change(base.avg_duration_hours, post.avg_duration_hours)
    interp_dur = (
        "Improved (Faster Turnaround)" if diff_dur and diff_dur < 0 else ("Deteriorated (Slower Turnaround)" if diff_dur and diff_dur > 0 else "Unchanged or insufficient data")
    )
    comparisons.append(
        MetricComparisonItem(
            metric_name="Average Duration (Hours)",
            baseline_value=base.avg_duration_hours,
            post_action_value=post.avg_duration_hours,
            absolute_difference=diff_dur,
            relative_percent_change=pct_dur,
            interpretation=interp_dur,
        )
    )

    return comparisons


def calculate_dataset_evaluation(
    dataset: Dataset,
    db: Session,
    reference_time: Optional[datetime] = None,
    save_snapshot: bool = True,
) -> DatasetEvaluationResponse:
    """Calculate comprehensive dataset outcome evaluation."""
    ref_time = normalize_to_utc(reference_time)
    if ref_time is None:
        if dataset.snapshot_at is not None:
            ref_time = normalize_to_utc(dataset.snapshot_at)
        else:
            ref_time = datetime.now(timezone.utc)

    # 1. Action Metrics (rejects are excluded from TrackedAction)
    actions: List[TrackedAction] = (
        db.query(TrackedAction)
        .filter(TrackedAction.dataset_id == dataset.id)
        .all()
    )

    total_approved = len(actions)
    pending = sum(1 for a in actions if a.current_status == "pending")
    in_prog = sum(1 for a in actions if a.current_status == "in_progress")
    completed_actions = [a for a in actions if a.current_status == "completed"]
    completed_count = len(completed_actions)
    failed = sum(1 for a in actions if a.current_status == "failed")
    cancelled = sum(1 for a in actions if a.current_status == "cancelled")
    comp_rate = round(completed_count / total_approved, 4) if total_approved > 0 else 0.0

    action_summary = ActionSummaryMetrics(
        total_approved_actions=total_approved,
        pending_actions=pending,
        in_progress_actions=in_prog,
        completed_actions=completed_count,
        failed_actions=failed,
        cancelled_actions=cancelled,
        action_completion_rate=comp_rate,
    )

    # 2. Tickets and Window Splitting
    tickets: List[ImportedTicket] = (
        db.query(ImportedTicket)
        .filter(ImportedTicket.dataset_id == dataset.id)
        .all()
    )

    total_tickets = len(tickets)
    dataset_limitations: List[str] = []

    if total_tickets == 0:
        dataset_limitations.append("Dataset contains 0 imported tickets.")

    # Determine Anchor Time for Baseline vs Post-Action window
    valid_completed_with_ts = [
        a for a in completed_actions if a.completed_at is not None
    ]

    if valid_completed_with_ts:
        anchor_ts = min(normalize_to_utc(a.completed_at) for a in valid_completed_with_ts)
        baseline_tickets = [
            t for t in tickets if normalize_to_utc(t.created_at) and normalize_to_utc(t.created_at) < anchor_ts
        ]
        post_tickets = [
            t for t in tickets if normalize_to_utc(t.created_at) and normalize_to_utc(t.created_at) >= anchor_ts
        ]

        base_start = min((normalize_to_utc(t.created_at) for t in baseline_tickets), default=None)
        base_end = anchor_ts
        post_start = anchor_ts
        post_end = max((normalize_to_utc(t.created_at) for t in post_tickets), default=ref_time)

        if not post_tickets:
            dataset_limitations.append(
                f"No tickets were created after the action completion anchor ({anchor_ts.strftime('%Y-%m-%d %H:%M:%S UTC')}). "
                "Post-action sample size is 0."
            )
    else:
        # No completed actions
        baseline_tickets = tickets
        post_tickets = []
        base_start = min((normalize_to_utc(t.created_at) for t in tickets if t.created_at), default=None)
        base_end = max((normalize_to_utc(t.created_at) for t in tickets if t.created_at), default=None)
        post_start = None
        post_end = None
        dataset_limitations.append("No completed actions exist for this dataset; post-action window is unpopulated.")

    # 3. Evaluate Resolution SLA Target
    res_base = evaluate_cohort(baseline_tickets, "resolution_deadline", "baseline", base_start, base_end, ref_time)
    res_post = evaluate_cohort(post_tickets, "resolution_deadline", "post_action", post_start, post_end, ref_time)
    res_comp = build_comparisons(res_base, res_post)
    res_coverage = (
        round((res_base.eligible_count + res_post.eligible_count) / total_tickets, 4)
        if total_tickets > 0
        else 0.0
    )
    res_limitations: List[str] = []
    if res_coverage < 1.0:
        res_limitations.append(f"Resolution SLA coverage is {round(res_coverage * 100, 1)}% due to missing or invalid deadlines.")

    resolution_eval = TargetEvaluation(
        target_type="resolution",
        baseline=res_base,
        post_action=res_post,
        comparisons=res_comp,
        data_coverage_rate=res_coverage,
        limitations=res_limitations,
    )

    # 4. Evaluate Response SLA Target
    resp_base = evaluate_cohort(baseline_tickets, "response_deadline", "baseline", base_start, base_end, ref_time)
    resp_post = evaluate_cohort(post_tickets, "response_deadline", "post_action", post_start, post_end, ref_time)
    resp_comp = build_comparisons(resp_base, resp_post)
    resp_coverage = (
        round((resp_base.eligible_count + resp_post.eligible_count) / total_tickets, 4)
        if total_tickets > 0
        else 0.0
    )
    resp_limitations: List[str] = []
    if resp_coverage < 1.0:
        resp_limitations.append(f"Response SLA coverage is {round(resp_coverage * 100, 1)}% due to missing or invalid deadlines.")

    response_eval = TargetEvaluation(
        target_type="response",
        baseline=resp_base,
        post_action=resp_post,
        comparisons=resp_comp,
        data_coverage_rate=resp_coverage,
        limitations=resp_limitations,
    )

    # Stable evaluation id
    eval_id_seed = f"{dataset.id}:{total_approved}:{completed_count}:{total_tickets}"
    eval_hash = hashlib.sha256(eval_id_seed.encode("utf-8")).hexdigest()[:12]
    evaluation_id = f"eval_{dataset.id}_{eval_hash}"

    eval_response = DatasetEvaluationResponse(
        evaluation_id=evaluation_id,
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        generated_at=datetime.now(timezone.utc),
        reference_time=ref_time,
        action_summary=action_summary,
        resolution_sla_evaluation=resolution_eval,
        response_sla_evaluation=response_eval,
        observational_disclaimer=OBSERVATIONAL_DISCLAIMER,
        limitations=dataset_limitations,
    )

    # Persist or update evaluation snapshot deterministically if requested
    if save_snapshot:
        existing_snap = db.query(EvaluationSnapshot).filter(EvaluationSnapshot.id == evaluation_id).first()
        if not existing_snap:
            snap = EvaluationSnapshot(
                id=evaluation_id,
                dataset_id=dataset.id,
                generated_at=eval_response.generated_at,
                sla_target="resolution_deadline",
                evaluation_window={
                    "baseline_start": base_start.isoformat() if base_start else None,
                    "baseline_end": base_end.isoformat() if base_end else None,
                    "post_action_start": post_start.isoformat() if post_start else None,
                    "post_action_end": post_end.isoformat() if post_end else None,
                },
                action_metrics=action_summary.model_dump(mode="json"),
                baseline_metrics=res_base.model_dump(mode="json"),
                post_action_metrics=res_post.model_dump(mode="json"),
                comparison_summary=[c.model_dump(mode="json") for c in res_comp],
                limitations=dataset_limitations,
            )
            db.add(snap)
            db.commit()

    return eval_response


def evaluate_action_outcome(
    dataset_id: str,
    action_id: str,
    db: Session,
    reference_time: Optional[datetime] = None,
) -> ActionEvaluationResponse:
    """Evaluate specific action execution state against the ticket's observed outcome."""
    ref_time = normalize_to_utc(reference_time) or datetime.now(timezone.utc)

    # Validate action
    action = db.query(TrackedAction).filter(TrackedAction.id == action_id).first()
    if not action:
        raise ValueError(f"Action '{action_id}' not found.")

    if action.dataset_id != dataset_id:
        raise ValueError(f"Action '{action_id}' does not belong to dataset '{dataset_id}'.")

    # Fetch source ticket
    ticket = (
        db.query(ImportedTicket)
        .filter(
            ImportedTicket.dataset_id == dataset_id,
            ImportedTicket.source_ticket_id == action.source_ticket_id,
        )
        .first()
    )

    sla_target = action.action_payload.get("sla_target") or "resolution_deadline"
    is_completed = (action.current_status == "completed")
    limitations: List[str] = []

    if not ticket:
        return ActionEvaluationResponse(
            dataset_id=dataset_id,
            action_id=action.id,
            decision_id=action.decision_id,
            recommendation_id=action.recommendation_id,
            source_ticket_id=action.source_ticket_id,
            action_type=action.action_type,
            current_status=action.current_status,
            created_at=action.created_at,
            completed_at=action.completed_at,
            sla_target=sla_target,
            is_action_completed=is_completed,
            ticket_outcome_observed=False,
            ticket_outcome_state="Ticket Record Missing",
            evidence="Ticket record could not be found in imported dataset.",
            limitations=["Underlying ticket data missing."],
        )

    risk_rec = score_ticket_risk(ticket, sla_target, ref_time)
    is_historical = (ticket.status or "") in HISTORICAL_STATUSES
    outcome_observed = is_historical and (ticket.resolved_at is not None)

    if outcome_observed:
        outcome_state = risk_rec.current_sla_state
    elif is_historical:
        outcome_state = "Resolved (Unverified Outcome)"
        limitations.append("Ticket is closed but lacks verified resolved_at timestamp.")
    else:
        outcome_state = f"Active ({risk_rec.current_sla_state})"
        limitations.append("Ticket remains active in queue; final resolution outcome has not occurred.")

    evidence = (
        f"Action '{action.id}' is '{action.current_status}'. "
        f"Ticket '{ticket.source_ticket_id}' has current state '{outcome_state}'. "
        "Action completion confirms recorded workflow execution; it does not guarantee SLA compliance."
    )

    return ActionEvaluationResponse(
        dataset_id=dataset_id,
        action_id=action.id,
        decision_id=action.decision_id,
        recommendation_id=action.recommendation_id,
        source_ticket_id=action.source_ticket_id,
        action_type=action.action_type,
        current_status=action.current_status,
        created_at=action.created_at,
        completed_at=action.completed_at,
        sla_target=sla_target,
        is_action_completed=is_completed,
        ticket_outcome_observed=outcome_observed,
        ticket_outcome_state=outcome_state,
        evidence=evidence,
        limitations=limitations,
    )

