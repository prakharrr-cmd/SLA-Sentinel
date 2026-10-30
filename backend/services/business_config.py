"""Business configuration service: manages persistent SLA policies, team capacity,
priority weights, risk thresholds, ticket categories, complexity, and performance history.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.models import (
    Team,
    TeamCapacity,
    SLAPolicy,
    PriorityWeight,
    RiskThreshold,
    TicketCategoryConfig,
    TicketComplexityConfig,
    AgentWorkload,
    TeamPerformanceHistory,
)


def seed_default_business_configuration(db: Session) -> None:
    """Seed sensible defaults for business configuration models if they do not exist.
    
    This operation is strictly idempotent.
    """
    now = datetime.now(timezone.utc)

    # 1. Ensure Default Teams
    default_teams = [
        ("team-a", "Squad Alpha - Payments & Billing", ["payments", "billing", "refunds", "invoicing"]),
        ("team-b", "Squad Bravo - Platform & Tech", ["technical", "platform", "api", "bug", "integrations"]),
        ("team-c", "Squad Charlie - Security & Access", ["security", "auth", "access", "permissions"]),
        ("team-d", "Squad Delta - Customer Support", ["general", "account", "inquiries", "onboarding"]),
    ]
    for tid, tname, skills in default_teams:
        if not db.query(Team).filter(Team.id == tid).first():
            db.add(Team(id=tid, name=tname, skill_tags=skills))
    db.flush()

    # 2. Team Capacity
    default_caps = [
        ("team-a", 12, 0.8, 1.0),
        ("team-b", 15, 0.8, 1.0),
        ("team-c", 10, 0.8, 1.0),
        ("team-d", 14, 0.8, 1.0),
    ]
    for tid, max_act, warn_th, crit_th in default_caps:
        if not db.query(TeamCapacity).filter(TeamCapacity.team_id == tid).first():
            db.add(
                TeamCapacity(
                    id=f"cap:{tid}",
                    team_id=tid,
                    max_active_tickets=max_act,
                    warning_threshold=warn_th,
                    critical_threshold=crit_th,
                    updated_at=now,
                )
            )

    # 3. SLA Policies (Separate Response and Resolution per Priority)
    default_sla_policies = [
        # Response SLAs
        ("policy:Critical:response", "response", "Critical", 1.0, "Critical initial response target (1 hour)"),
        ("policy:High:response", "response", "High", 2.0, "High initial response target (2 hours)"),
        ("policy:Medium:response", "response", "Medium", 4.0, "Medium initial response target (4 hours)"),
        ("policy:Low:response", "response", "Low", 8.0, "Low initial response target (8 hours)"),
        # Resolution SLAs
        ("policy:Critical:resolution", "resolution", "Critical", 4.0, "Critical full resolution target (4 hours)"),
        ("policy:High:resolution", "resolution", "High", 8.0, "High full resolution target (8 hours)"),
        ("policy:Medium:resolution", "resolution", "Medium", 24.0, "Medium full resolution target (24 hours)"),
        ("policy:Low:resolution", "resolution", "Low", 48.0, "Low full resolution target (48 hours)"),
    ]
    for pid, ttype, prio, hrs, desc in default_sla_policies:
        if not db.query(SLAPolicy).filter(SLAPolicy.id == pid).first():
            db.add(
                SLAPolicy(
                    id=pid,
                    target_type=ttype,
                    priority=prio,
                    target_hours=hrs,
                    description=desc,
                    created_at=now,
                    updated_at=now,
                )
            )

    # 4. Priority Weights
    default_weights = [
        ("weight:Critical", "Critical", 2.0, "Multiplier for Critical severity"),
        ("weight:High", "High", 1.5, "Multiplier for High severity"),
        ("weight:Medium", "Medium", 1.0, "Multiplier for Medium severity"),
        ("weight:Low", "Low", 0.7, "Multiplier for Low severity"),
    ]
    for wid, prio, mult, desc in default_weights:
        if not db.query(PriorityWeight).filter(PriorityWeight.id == wid).first():
            db.add(PriorityWeight(id=wid, priority=prio, weight_multiplier=mult, description=desc))

    # 5. Risk Thresholds
    default_thresholds = [
        ("tier:High", "High", 70.0, 100.0, "Critical SLA breach imminent or occurred"),
        ("tier:Medium", "Medium", 40.0, 69.99, "Elevated breach probability needing intervention"),
        ("tier:Low", "Low", 0.0, 39.99, "Standard operational cadence within SLA margin"),
    ]
    for tid, rlvl, min_s, max_s, desc in default_thresholds:
        if not db.query(RiskThreshold).filter(RiskThreshold.id == tid).first():
            db.add(RiskThreshold(id=tid, risk_level=rlvl, min_score=min_s, max_score=max_s, description=desc))

    # 6. Ticket Category Configs
    default_categories = [
        ("cat:Billing", "Billing", "Medium", 0.12, "team-a", "Invoicing, payment failures, refunds"),
        ("cat:Technical", "Technical", "High", 0.18, "team-b", "API faults, system downtime, bugs"),
        ("cat:Security", "Security", "Critical", 0.08, "team-c", "Account compromise, vulnerability, audit"),
        ("cat:Account Access", "Account Access", "Low", 0.05, "team-c", "Password reset, SSO, lockout"),
        ("cat:General", "General", "Low", 0.06, "team-d", "Product inquiries, usage guidance"),
    ]
    for cid, cname, comp, brate, team_id, desc in default_categories:
        if not db.query(TicketCategoryConfig).filter(TicketCategoryConfig.id == cid).first():
            db.add(
                TicketCategoryConfig(
                    id=cid,
                    category_name=cname,
                    default_complexity=comp,
                    historical_breach_rate=brate,
                    recommended_team_id=team_id,
                    description=desc,
                )
            )

    # 7. Complexity Multipliers
    default_complexities = [
        ("comp:Low", "Low", 0.8, "Standard routine operational tasks"),
        ("comp:Medium", "Medium", 1.0, "Average complexity requiring verification"),
        ("comp:High", "High", 1.5, "In-depth investigation or cross-service debugging"),
        ("comp:Critical", "Critical", 2.0, "High-stakes multi-system coordination"),
    ]
    for cid, clevel, mult, desc in default_complexities:
        if not db.query(TicketComplexityConfig).filter(TicketComplexityConfig.id == cid).first():
            db.add(TicketComplexityConfig(id=cid, complexity_level=clevel, duration_multiplier=mult, description=desc))

    # 8. Agent Workloads
    default_agents = [
        ("agent:101", "agent-101", "Sarah Chen", "team-a", 3, 6, "Available"),
        ("agent:102", "agent-102", "Marcus Vance", "team-a", 4, 6, "Available"),
        ("agent:201", "agent-201", "Elena Rostova", "team-b", 5, 6, "Available"),
        ("agent:202", "agent-202", "David Kim", "team-b", 4, 6, "Available"),
        ("agent:301", "agent-301", "Aisha Patel", "team-c", 2, 5, "Available"),
        ("agent:401", "agent-401", "Jordan Lee", "team-d", 3, 6, "Available"),
    ]
    for aid, ag_id, aname, tid, act_cnt, max_cap, st in default_agents:
        if not db.query(AgentWorkload).filter(AgentWorkload.agent_id == ag_id).first():
            db.add(
                AgentWorkload(
                    id=aid,
                    agent_id=ag_id,
                    agent_name=aname,
                    team_id=tid,
                    active_tickets_count=act_cnt,
                    max_capacity=max_cap,
                    status=st,
                )
            )

    # 9. Team Performance History
    default_perf = [
        ("perf:team-a", "team-a", "last_30_days", 340, 0.96, 0.91, 5.2),
        ("perf:team-b", "team-b", "last_30_days", 420, 0.92, 0.87, 7.4),
        ("perf:team-c", "team-c", "last_30_days", 190, 0.98, 0.95, 4.1),
        ("perf:team-d", "team-d", "last_30_days", 510, 0.97, 0.94, 3.8),
    ]
    for pid, tid, per, total_h, resp_comp, resol_comp, avg_h in default_perf:
        if not db.query(TeamPerformanceHistory).filter(TeamPerformanceHistory.id == pid).first():
            db.add(
                TeamPerformanceHistory(
                    id=pid,
                    team_id=tid,
                    period=per,
                    total_handled=total_h,
                    response_sla_compliance_rate=resp_comp,
                    resolution_sla_compliance_rate=resol_comp,
                    avg_resolution_hours=avg_h,
                    updated_at=now,
                )
            )

    db.commit()


def get_sla_policy_hours(
    db: Session,
    priority: Optional[str],
    target_type: str = "resolution",
    category: Optional[str] = None,
) -> float:
    """Retrieve SLA policy target hours from the database with sensible fallbacks."""
    prio_norm = (priority or "Medium").capitalize()
    target_norm = "response" if target_type.startswith("resp") else "resolution"

    policy = (
        db.query(SLAPolicy)
        .filter(
            SLAPolicy.is_active == True,
            SLAPolicy.target_type == target_norm,
            SLAPolicy.priority == prio_norm,
        )
        .first()
    )
    if policy:
        return float(policy.target_hours)

    if target_norm == "response":
        defaults = {"Critical": 1.0, "High": 2.0, "Medium": 4.0, "Low": 8.0}
        return defaults.get(prio_norm, 4.0)
    else:
        defaults = {"Critical": 4.0, "High": 8.0, "Medium": 24.0, "Low": 48.0}
        return defaults.get(prio_norm, 24.0)

