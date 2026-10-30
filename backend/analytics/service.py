"""Service module for dataset analytics and risk calculation."""

from collections import Counter, defaultdict
from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.engines.dataset_risk import (
    score_ticket_risk,
    sort_key_for_risk,
    normalize_to_utc,
    HISTORICAL_STATUSES,
)
from backend.models import Dataset, ImportedTicket
from backend.schemas import (
    DatasetAnalyticsResponse,
    DatasetSummaryMetrics,
    TicketDistribution,
    SLAPerformance,
    SLAPerformanceTarget,
    TrendsAndBottlenecks,
    BottleneckItem,
    PaginatedRisksResponse,
    TicketRiskRecord,
)


def calculate_dataset_analytics(
    dataset: Dataset,
    db: Session,
    reference_time: Optional[datetime] = None,
) -> DatasetAnalyticsResponse:
    """Calculate comprehensive, dataset-scoped operational analytics and SLA metrics.

    Args:
        dataset: The Dataset ORM instance.
        db: Database session.
        reference_time: Optional evaluation reference timestamp.

    Returns:
        DatasetAnalyticsResponse with summary, distribution, performance, and bottlenecks.
    """
    ref_time = normalize_to_utc(reference_time)
    if ref_time is None:
        if dataset.snapshot_at is not None:
            ref_time = normalize_to_utc(dataset.snapshot_at)
        else:
            ref_time = datetime.now(timezone.utc)

    tickets: List[ImportedTicket] = (
        db.query(ImportedTicket)
        .filter(ImportedTicket.dataset_id == dataset.id)
        .all()
    )

    total_imported = len(tickets)

    # 1. Distribution
    status_counts: Dict[str, int] = Counter()
    priority_counts: Dict[str, int] = Counter()
    active_count = 0
    historical_count = 0
    unrecognized_status = 0
    unrecognized_priority = 0

    scorable_resolution = 0
    scorable_response = 0

    for t in tickets:
        st = t.status or ""
        pr = t.priority or ""

        if not st:
            unrecognized_status += 1
            status_counts["Unspecified"] += 1
        else:
            status_counts[st] += 1

        if not pr:
            unrecognized_priority += 1
            priority_counts["Unspecified"] += 1
        else:
            priority_counts[pr] += 1

        if st in HISTORICAL_STATUSES:
            historical_count += 1
        else:
            active_count += 1

        c_at = normalize_to_utc(t.created_at)
        res_dl = normalize_to_utc(t.resolution_deadline)
        resp_dl = normalize_to_utc(t.response_deadline)

        if c_at and res_dl and res_dl > c_at:
            scorable_resolution += 1
        if c_at and resp_dl and resp_dl > c_at:
            scorable_response += 1

    distribution = TicketDistribution(
        by_status=dict(status_counts),
        by_priority=dict(priority_counts),
        active_tickets_count=active_count,
        historical_tickets_count=historical_count,
        unrecognized_status_count=unrecognized_status,
        unrecognized_priority_count=unrecognized_priority,
    )

    # 2. SLA Performance Evaluation (Response and Resolution independently)
    def evaluate_target(sla_field_name: str, display_type: str) -> SLAPerformanceTarget:
        eligible_count = 0
        missing_deadline = 0
        active_eligible = 0
        breached = 0
        at_risk = 0
        within_target = 0

        hist_eligible = 0
        hist_met = 0
        hist_breached = 0
        hist_unverifiable = 0
        limitations: List[str] = []

        for t in tickets:
            rec = score_ticket_risk(t, sla_field_name, ref_time)
            deadline = getattr(t, sla_field_name, None)
            c_at = t.created_at

            if deadline is None:
                missing_deadline += 1
            elif c_at and deadline > c_at:
                eligible_count += 1

            if t.status in HISTORICAL_STATUSES:
                if deadline is not None:
                    hist_eligible += 1
                    if rec.current_sla_state == "Met SLA":
                        hist_met += 1
                    elif rec.current_sla_state == "Breached in Past":
                        hist_breached += 1
                    else:
                        hist_unverifiable += 1
                else:
                    hist_unverifiable += 1
            else:
                if deadline is not None and c_at and deadline > c_at:
                    active_eligible += 1
                    if rec.current_sla_state == "Breached":
                        breached += 1
                    elif rec.current_sla_state == "High Risk":
                        at_risk += 1
                    elif rec.current_sla_state == "Within Target":
                        within_target += 1

        coverage_rate = (
            round(eligible_count / total_imported, 4) if total_imported > 0 else 0.0
        )

        hist_evaluated = hist_met + hist_breached
        hist_attainment = (
            round(hist_met / hist_evaluated, 4) if hist_evaluated > 0 else None
        )

        if missing_deadline > 0:
            limitations.append(
                f"{missing_deadline} of {total_imported} tickets lack a {display_type} deadline in source data."
            )
        if hist_unverifiable > 0:
            limitations.append(
                f"{hist_unverifiable} historical tickets lack resolved_at timestamps or deadlines for verified audit."
            )

        return SLAPerformanceTarget(
            target_type=display_type,
            eligible_count=eligible_count,
            coverage_rate=coverage_rate,
            missing_deadline_count=missing_deadline,
            active_eligible_count=active_eligible,
            breached_count=breached,
            at_risk_count=at_risk,
            within_target_count=within_target,
            historical_eligible_count=hist_eligible,
            historical_met_sla_count=hist_met,
            historical_breached_count=hist_breached,
            historical_unverifiable_count=hist_unverifiable,
            historical_attainment_rate=hist_attainment,
            limitations=limitations,
        )

    response_sla = evaluate_target("response_deadline", "response")
    resolution_sla = evaluate_target("resolution_deadline", "resolution")

    sla_performance = SLAPerformance(
        reference_time=ref_time,
        response_sla=response_sla,
        resolution_sla=resolution_sla,
    )

    # 3. Trends and Bottlenecks
    # Calculate workload concentration using resolution target as primary baseline
    category_stats = defaultdict(lambda: {"total": 0, "active": 0, "breached": 0})
    priority_stats = defaultdict(lambda: {"total": 0, "active": 0, "breached": 0})
    team_stats = defaultdict(lambda: {"total": 0, "active": 0, "breached": 0})

    for t in tickets:
        cat = t.category or "General"
        pri = t.priority or "Normal"
        tm = t.assigned_team_id or "Unassigned"

        is_active = (t.status or "") not in HISTORICAL_STATUSES
        res_rec = score_ticket_risk(t, "resolution_deadline", ref_time)
        is_breached = is_active and (res_rec.current_sla_state == "Breached")

        category_stats[cat]["total"] += 1
        priority_stats[pri]["total"] += 1
        team_stats[tm]["total"] += 1

        if is_active:
            category_stats[cat]["active"] += 1
            priority_stats[pri]["active"] += 1
            team_stats[tm]["active"] += 1

        if is_breached:
            category_stats[cat]["breached"] += 1
            priority_stats[pri]["breached"] += 1
            team_stats[tm]["breached"] += 1

    def build_bottleneck_items(stats: dict, dimension: str) -> List[BottleneckItem]:
        items: List[BottleneckItem] = []
        for key, s in stats.items():
            tot = s["total"]
            act = s["active"]
            br = s["breached"]
            rate = round(br / act, 4) if act > 0 else 0.0
            evidence = (
                f"{br} of {act} active {dimension} tickets are currently breached "
                f"({round(rate * 100, 1)}% breach rate across {tot} total tickets)."
            )
            items.append(
                BottleneckItem(
                    dimension=dimension,
                    key=key,
                    ticket_count=tot,
                    active_count=act,
                    breached_count=br,
                    breach_rate=rate,
                    evidence=evidence,
                )
            )
        # Sort by breached desc, then active desc
        items.sort(key=lambda x: (x.breached_count, x.active_count, x.ticket_count), reverse=True)
        return items

    cat_items = build_bottleneck_items(category_stats, "category")
    pri_items = build_bottleneck_items(priority_stats, "priority")
    tm_items = build_bottleneck_items(team_stats, "team")

    identified: List[str] = []
    # Identify top category breach concentration
    for c in cat_items:
        if c.breached_count > 0:
            identified.append(
                f"Category '{c.key}' accounts for {c.breached_count} SLA breaches ({round(c.breach_rate * 100, 1)}% of its active queue)."
            )
            break

    # Identify top priority breach concentration
    for p in pri_items:
        if p.key in {"Critical", "High"} and p.breached_count > 0:
            identified.append(
                f"Priority '{p.key}' has {p.breached_count} breached tickets out of {p.active_count} active."
            )
            break

    # Identify team bottleneck
    for tm in tm_items:
        if tm.key != "Unassigned" and tm.breached_count > 0:
            identified.append(
                f"Squad '{tm.key}' has {tm.breached_count} breached tickets in queue ({round(tm.breach_rate * 100, 1)}% of its {tm.active_count} active tickets)."
            )
            break

    trends_limitations = [
        "Workload metrics represent point-in-time snapshot at the evaluation reference clock.",
        "Correlation of ticket volume with breaches does not establish operational causation.",
    ]

    trends = TrendsAndBottlenecks(
        category_workload=cat_items,
        priority_workload=pri_items,
        team_workload=tm_items,
        identified_bottlenecks=identified,
        limitations=trends_limitations,
    )

    # 4. Summary
    val_sum = dataset.validation_summary if isinstance(dataset.validation_summary, dict) else {}
    invalid_rows = val_sum.get("invalid_rows", dataset.rejected_rows)

    summary = DatasetSummaryMetrics(
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        created_at=normalize_to_utc(dataset.created_at),
        snapshot_at=normalize_to_utc(dataset.snapshot_at),
        total_rows=dataset.total_rows,
        accepted_rows=dataset.accepted_rows,
        rejected_rows=dataset.rejected_rows,
        invalid_rows=invalid_rows,
        warning_count=dataset.warning_count,
        total_imported_tickets=total_imported,
        scorable_resolution_tickets=scorable_resolution,
        scorable_response_tickets=scorable_response,
    )

    return DatasetAnalyticsResponse(
        dataset_summary=summary,
        ticket_distribution=distribution,
        sla_performance=sla_performance,
        trends_and_bottlenecks=trends,
    )


def get_dataset_risks(
    dataset: Dataset,
    db: Session,
    sla_target: str = "resolution_deadline",
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    risk_level_filter: Optional[str] = None,
    reference_time: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 50,
) -> PaginatedRisksResponse:
    """Evaluate and rank all tickets in a dataset by SLA risk.

    Guarantees deterministic ranking, consistent reference clock, independent targets,
    and dataset isolation.
    """
    ref_time = normalize_to_utc(reference_time)
    if ref_time is None:
        if dataset.snapshot_at is not None:
            ref_time = normalize_to_utc(dataset.snapshot_at)
        else:
            ref_time = datetime.now(timezone.utc)

    # Query all imported tickets for this dataset only
    query = (
        db.query(ImportedTicket)
        .filter(ImportedTicket.dataset_id == dataset.id)
    )

    tickets = query.all()

    # Score all tickets against the specified target using consistent ref_time
    scored_records: List[TicketRiskRecord] = []
    for t in tickets:
        rec = score_ticket_risk(t, sla_target, ref_time)

        # Apply filters
        if status_filter:
            s_low = status_filter.lower()
            if s_low == "active":
                if t.status in HISTORICAL_STATUSES:
                    continue
            elif s_low == "historical" or s_low == "resolved":
                if t.status not in HISTORICAL_STATUSES:
                    continue
            elif (t.status or "").lower() != s_low:
                continue

        if priority_filter:
            if (t.priority or "").lower() != priority_filter.lower():
                continue

        if risk_level_filter:
            rl_low = risk_level_filter.lower()
            if (
                rec.risk_category.lower() != rl_low
                and rec.current_sla_state.lower() != rl_low
            ):
                continue

        scored_records.append(rec)

    # Sort deterministically
    scored_records.sort(key=sort_key_for_risk)

    total = len(scored_records)
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    safe_page = max(1, page)
    offset = (safe_page - 1) * page_size
    page_items = scored_records[offset : offset + page_size]

    return PaginatedRisksResponse(
        dataset_id=dataset.id,
        sla_target=sla_target,
        reference_time=ref_time,
        total=total,
        page=safe_page,
        page_size=page_size,
        total_pages=total_pages,
        items=page_items,
    )

