"""Synthetic demo dataset generator for SLA Sentinel testing.

Generates a realistic, reproducible dataset of ~250 tickets with varied priorities,
categories, complexities, customer VIP tiers, teams, agents, statuses, and SLA outcomes.
Tagged as SIMULATED DATA with is_simulated=True.
"""

from datetime import datetime, timedelta, timezone
import random
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.models import Dataset, ImportedTicket, ManagerDecision, TrackedAction, ActionStatusHistory, SimulationEvent
from backend.services.business_config import seed_default_business_configuration

DEMO_DATASET_ID = "demo-dataset-sla-sentinel"
DEMO_DATASET_NAME = "SLA Sentinel Demo Dataset"
DEMO_REFERENCE_TIME = datetime(2026, 10, 30, 12, 0, 0, tzinfo=timezone.utc)


def seed_synthetic_demo_dataset(db: Session, force_reset: bool = False) -> Dataset:
    """Generate or retrieve the synthetic demo dataset idempotently.
    
    If already existing and force_reset is False, returns existing dataset.
    """
    seed_default_business_configuration(db)

    existing = db.query(Dataset).filter(Dataset.id == DEMO_DATASET_ID).first()
    if existing and not force_reset:
        ticket_count = db.query(ImportedTicket).filter(ImportedTicket.dataset_id == DEMO_DATASET_ID).count()
        if ticket_count >= 240:
            return existing

    if existing and force_reset:
        action_ids = [a.id for a in db.query(TrackedAction).filter(TrackedAction.dataset_id == DEMO_DATASET_ID).all()]
        if action_ids:
            db.query(ActionStatusHistory).filter(ActionStatusHistory.action_id.in_(action_ids)).delete(synchronize_session=False)
            db.query(TrackedAction).filter(TrackedAction.dataset_id == DEMO_DATASET_ID).delete(synchronize_session=False)

        db.query(ManagerDecision).filter(ManagerDecision.dataset_id == DEMO_DATASET_ID).delete(synchronize_session=False)
        db.query(SimulationEvent).filter(SimulationEvent.dataset_id == DEMO_DATASET_ID).delete(synchronize_session=False)
        db.query(ImportedTicket).filter(ImportedTicket.dataset_id == DEMO_DATASET_ID).delete(synchronize_session=False)
        db.delete(existing)
        db.commit()

    rng = random.Random(42)
    ref_time = DEMO_REFERENCE_TIME

    dataset = Dataset(
        id=DEMO_DATASET_ID,
        name=DEMO_DATASET_NAME,
        source_filename="synthetic_demo_seed_250.csv",
        file_format="synthetic",
        created_at=ref_time - timedelta(days=7),
        snapshot_at=ref_time,
        status="completed",
        total_rows=250,
        accepted_rows=250,
        rejected_rows=0,
        warning_count=0,
        applied_mapping={
            "ticket_id": "ticket_id",
            "title": "title",
            "category": "category",
            "status": "status",
            "priority": "priority",
            "created_at": "created_at",
            "response_deadline": "response_deadline",
            "resolution_deadline": "resolution_deadline",
            "assigned_team_id": "assigned_team_id",
        },
        validation_summary={
            "is_simulated": True,
            "data_classification": "SIMULATED DATA",
            "notice": "This dataset is synthetically generated for testing operational SLA workflows. Not customer data.",
            "total_records": 250,
        },
        is_simulated=True,
    )
    db.add(dataset)
    db.flush()

    categories = [
        ("Billing", "team-a", ["Invoice discrepancy on annual renewal", "Payment gateway 402 card declined", "Chargeback alert for order", "Refund request duplicate transaction", "Currency conversion miscalculation"]),
        ("Technical", "team-b", ["API rate limit throttled prematurely", "500 Internal Error on /checkout webhook", "Database connection pool exhausted", "Memory leak in background sync service", "Slow query on tenant reporting index"]),
        ("Security", "team-c", ["Suspicious login attempt from unknown ASN", "MFA token validation desynchronized", "API key rotation required for compliance", "Privilege escalation audit flag", "Session hijacking signature detected"]),
        ("Account Access", "team-c", ["User locked out after password reset", "SSO SAML assertion failure for domain", "Invitation link expired for administrator", "Role permissions not reflecting in console", "OAuth2 callback redirect URI mismatch"]),
        ("General", "team-d", ["Feature inquiry on webhook payload retention", "Request documentation on export CSV format", "Update primary billing contact email", "Onboarding assistance for sub-account", "Notification settings clarification"]),
    ]

    agents_by_team = {
        "team-a": ["agent-101", "agent-102"],
        "team-b": ["agent-201", "agent-202"],
        "team-c": ["agent-301"],
        "team-d": ["agent-401"],
    }

    tier_choices = ["Standard", "Standard", "Premium", "VIP"]
    complexity_choices = ["Low", "Medium", "High", "Critical"]

    tickets: List[ImportedTicket] = []
    ticket_idx = 1

    def make_ticket(
        status: str,
        priority: str,
        created_offset_hours: float,
        resp_target_hours: float,
        resol_target_hours: float,
        has_resp: bool,
        resp_duration_hours: Optional[float],
        is_resolved: bool,
        resol_duration_hours: Optional[float],
        has_deadlines: bool = True,
    ) -> ImportedTicket:
        nonlocal ticket_idx
        tid = f"TICK-{ticket_idx:04d}"
        ticket_idx += 1

        cat_tuple = rng.choice(categories)
        cat_name = cat_tuple[0]
        team_id = cat_tuple[1]
        title_sample = rng.choice(cat_tuple[2])
        title = f"{title_sample} [#{tid}]"

        agent_id = rng.choice(agents_by_team.get(team_id, ["agent-101"]))
        customer_tier = rng.choice(tier_choices)
        complexity = rng.choice(complexity_choices)

        created_at = ref_time - timedelta(hours=created_offset_hours)

        if has_deadlines:
            resp_deadline = created_at + timedelta(hours=resp_target_hours)
            resol_deadline = created_at + timedelta(hours=resol_target_hours)
        else:
            resp_deadline = None
            resol_deadline = None

        if is_resolved and resol_duration_hours is not None:
            resolved_at = created_at + timedelta(hours=resol_duration_hours)
            res_dur = resol_duration_hours
        else:
            resolved_at = None
            res_dur = None

        resp_dur = resp_duration_hours if has_resp else None

        return ImportedTicket(
            id=f"{DEMO_DATASET_ID}:{tid}",
            dataset_id=DEMO_DATASET_ID,
            source_ticket_id=tid,
            title=title,
            description=f"Synthetic incident simulation for {cat_name}. Customer tier: {customer_tier}. Complexity: {complexity}.",
            category=cat_name,
            status=status,
            priority=priority,
            created_at=created_at,
            response_deadline=resp_deadline,
            resolution_deadline=resol_deadline,
            resolved_at=resolved_at,
            resolution_duration=res_dur,
            response_duration=resp_dur,
            assigned_team_id=team_id,
            current_assignee_id=agent_id,
            customer_tier=customer_tier,
            complexity=complexity,
            source_metrics={
                "pending_hours": round(created_offset_hours, 1) if not is_resolved else round(resol_duration_hours or 0.0, 1),
                "is_simulated": True,
            },
            original_values={"synthetic": True},
            is_valid=True,
        )

    # 1. 80 Resolved within SLA
    for _ in range(80):
        prio = rng.choice(["Low", "Medium", "High", "Critical"])
        target_resol = {"Critical": 4.0, "High": 8.0, "Medium": 24.0, "Low": 48.0}[prio]
        target_resp = {"Critical": 1.0, "High": 2.0, "Medium": 4.0, "Low": 8.0}[prio]
        created_offset = rng.uniform(target_resol + 10, 168.0)
        resol_dur = rng.uniform(0.3 * target_resol, 0.85 * target_resol)
        resp_dur = rng.uniform(0.2 * target_resp, 0.8 * target_resp)
        tickets.append(make_ticket(
            status="Resolved",
            priority=prio,
            created_offset_hours=created_offset,
            resp_target_hours=target_resp,
            resol_target_hours=target_resol,
            has_resp=True,
            resp_duration_hours=round(resp_dur, 2),
            is_resolved=True,
            resol_duration_hours=round(resol_dur, 2),
        ))

    # 2. 25 Resolved after SLA breach
    for _ in range(25):
        prio = rng.choice(["Medium", "High", "Critical"])
        target_resol = {"Critical": 4.0, "High": 8.0, "Medium": 24.0}[prio]
        target_resp = {"Critical": 1.0, "High": 2.0, "Medium": 4.0}[prio]
        created_offset = rng.uniform(target_resol + 20, 140.0)
        resol_dur = rng.uniform(1.2 * target_resol, 2.5 * target_resol)
        resp_dur = rng.uniform(0.5 * target_resp, 1.5 * target_resp)
        tickets.append(make_ticket(
            status="Closed",
            priority=prio,
            created_offset_hours=created_offset,
            resp_target_hours=target_resp,
            resol_target_hours=target_resol,
            has_resp=True,
            resp_duration_hours=round(resp_dur, 2),
            is_resolved=True,
            resol_duration_hours=round(resol_dur, 2),
        ))

    # 3. 40 Open/In Progress approaching SLA (high risk)
    for _ in range(40):
        prio = rng.choice(["High", "Critical", "Medium"])
        target_resol = {"Critical": 4.0, "High": 8.0, "Medium": 24.0}[prio]
        target_resp = {"Critical": 1.0, "High": 2.0, "Medium": 4.0}[prio]
        elapsed_fraction = rng.uniform(0.78, 0.95)
        created_offset = target_resol * elapsed_fraction
        has_resp = rng.random() > 0.3
        resp_dur = round(rng.uniform(0.4 * target_resp, 0.9 * target_resp), 2) if has_resp else None
        tickets.append(make_ticket(
            status=rng.choice(["Open", "In Progress", "Pending"]),
            priority=prio,
            created_offset_hours=created_offset,
            resp_target_hours=target_resp,
            resol_target_hours=target_resol,
            has_resp=has_resp,
            resp_duration_hours=resp_dur,
            is_resolved=False,
            resol_duration_hours=None,
        ))

    # 4. 20 Open/In Progress already breached
    for _ in range(20):
        prio = rng.choice(["Critical", "High", "Medium"])
        target_resol = {"Critical": 4.0, "High": 8.0, "Medium": 24.0}[prio]
        target_resp = {"Critical": 1.0, "High": 2.0, "Medium": 4.0}[prio]
        elapsed_fraction = rng.uniform(1.10, 1.85)
        created_offset = target_resol * elapsed_fraction
        has_resp = rng.random() > 0.4
        resp_dur = round(rng.uniform(0.8 * target_resp, 1.6 * target_resp), 2) if has_resp else None
        tickets.append(make_ticket(
            status=rng.choice(["In Progress", "Open"]),
            priority=prio,
            created_offset_hours=created_offset,
            resp_target_hours=target_resp,
            resol_target_hours=target_resol,
            has_resp=has_resp,
            resp_duration_hours=resp_dur,
            is_resolved=False,
            resol_duration_hours=None,
        ))

    # 5. 65 Open/In Progress safe (low risk)
    for _ in range(65):
        prio = rng.choice(["Low", "Medium", "High"])
        target_resol = {"High": 8.0, "Medium": 24.0, "Low": 48.0}[prio]
        target_resp = {"High": 2.0, "Medium": 4.0, "Low": 8.0}[prio]
        elapsed_fraction = rng.uniform(0.08, 0.42)
        created_offset = target_resol * elapsed_fraction
        has_resp = rng.random() > 0.5
        resp_dur = round(rng.uniform(0.2 * target_resp, 0.6 * target_resp), 2) if has_resp else None
        tickets.append(make_ticket(
            status=rng.choice(["Open", "In Progress"]),
            priority=prio,
            created_offset_hours=created_offset,
            resp_target_hours=target_resp,
            resol_target_hours=target_resol,
            has_resp=has_resp,
            resp_duration_hours=resp_dur,
            is_resolved=False,
            resol_duration_hours=None,
        ))

    # 6. 20 Unscorable (missing deadlines)
    for _ in range(20):
        prio = rng.choice(["Low", "Medium", "High"])
        created_offset = rng.uniform(4.0, 48.0)
        tickets.append(make_ticket(
            status=rng.choice(["Open", "Pending"]),
            priority=prio,
            created_offset_hours=created_offset,
            resp_target_hours=4.0,
            resol_target_hours=24.0,
            has_resp=False,
            resp_duration_hours=None,
            is_resolved=False,
            resol_duration_hours=None,
            has_deadlines=False,
        ))

    db.add_all(tickets)
    db.commit()
    db.refresh(dataset)
    return dataset

