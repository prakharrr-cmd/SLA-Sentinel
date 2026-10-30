"""Local synthetic ticket activity simulator service.

Provides background event generation on the synthetic demo dataset:
- Ticket creation, status transitions, priority shifts, first responses, resolutions.
- Workload adjustments.
- Persistent event audit trail.
- Start, pause, resume, stop, speed adjustment, and demo reset.
"""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
import random
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import (
    ImportedTicket,
    SimulationState,
    SimulationEvent,
    AgentWorkload,
    Dataset,
)
from backend.services.demo_dataset import (
    DEMO_DATASET_ID,
    seed_synthetic_demo_dataset,
)

logger = logging.getLogger("sla_sentinel.simulator")

_simulation_task: Optional[asyncio.Task] = None
_simulation_lock = asyncio.Lock()


def get_simulation_state(db: Session) -> SimulationState:
    """Retrieve or initialize the simulation state record."""
    state = db.query(SimulationState).filter(SimulationState.id == "default").first()
    if not state:
        state = SimulationState(
            id="default",
            status="stopped",
            speed=1.0,
            interval_seconds=5.0,
            scenario="mixed",
            events_emitted=0,
            dataset_id=DEMO_DATASET_ID,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def get_recent_events(db: Session, limit: int = 50) -> List[SimulationEvent]:
    """Retrieve recent simulation event log entries."""
    return (
        db.query(SimulationEvent)
        .filter(SimulationEvent.dataset_id == DEMO_DATASET_ID)
        .order_by(SimulationEvent.timestamp.desc())
        .limit(limit)
        .all()
    )


def simulate_tick(db: Session) -> Optional[SimulationEvent]:
    """Execute a single atomic simulation step on the demo dataset."""
    state = get_simulation_state(db)
    if state.status != "running":
        return None

    now = datetime.now(timezone.utc)
    rng = random.Random()

    active_tickets: List[ImportedTicket] = (
        db.query(ImportedTicket)
        .filter(
            ImportedTicket.dataset_id == DEMO_DATASET_ID,
            ImportedTicket.status.notin_(["Resolved", "Closed"]),
        )
        .all()
    )

    if not active_tickets:
        return None

    event_type = rng.choices(
        ["ticket_created", "status_changed", "first_response", "priority_changed", "assignment_changed", "ticket_resolved"],
        weights=[25, 25, 15, 10, 10, 15],
        k=1,
    )[0]

    sim_event: Optional[SimulationEvent] = None

    if event_type == "ticket_created":
        count = db.query(ImportedTicket).filter(ImportedTicket.dataset_id == DEMO_DATASET_ID).count()
        new_id = f"TICK-SIM-{count + 1:04d}"
        categories = [
            ("Billing", "team-a", "Billing query regarding recurring invoice charges"),
            ("Technical", "team-b", "API gateway returning 502 Bad Gateway during load spike"),
            ("Security", "team-c", "Audit alert for unverified API key usage"),
            ("Account Access", "team-c", "User permission error on administrator console"),
            ("General", "team-d", "Documentation request regarding export webhooks"),
        ]
        cat, team, title = rng.choice(categories)
        prio = rng.choices(["Low", "Medium", "High", "Critical"], weights=[20, 45, 25, 10], k=1)[0]
        resol_target = {"Critical": 4.0, "High": 8.0, "Medium": 24.0, "Low": 48.0}[prio]
        resp_target = {"Critical": 1.0, "High": 2.0, "Medium": 4.0, "Low": 8.0}[prio]

        new_ticket = ImportedTicket(
            id=f"{DEMO_DATASET_ID}:{new_id}",
            dataset_id=DEMO_DATASET_ID,
            source_ticket_id=new_id,
            title=f"{title} [#{new_id}]",
            description="Dynamically generated support incident from active simulation environment.",
            category=cat,
            status="Open",
            priority=prio,
            created_at=now,
            response_deadline=now + timedelta(hours=resp_target),
            resolution_deadline=now + timedelta(hours=resol_target),
            assigned_team_id=team,
            current_assignee_id=None,
            customer_tier=rng.choice(["Standard", "Standard", "Premium", "VIP"]),
            complexity=rng.choice(["Low", "Medium", "High"]),
            source_metrics={"simulated_event": True},
            original_values={"simulated": True},
            is_valid=True,
        )
        db.add(new_ticket)

        ds = db.query(Dataset).filter(Dataset.id == DEMO_DATASET_ID).first()
        if ds:
            ds.total_rows += 1
            ds.accepted_rows += 1

        sim_event = SimulationEvent(
            id=f"evt:{uuid.uuid4().hex[:12]}",
            dataset_id=DEMO_DATASET_ID,
            event_type="ticket_created",
            ticket_id=new_id,
            details={
                "title": new_ticket.title,
                "category": cat,
                "priority": prio,
                "team": team,
            },
            timestamp=now,
        )

    elif event_type == "status_changed":
        open_tickets = [t for t in active_tickets if t.status == "Open"]
        target = rng.choice(open_tickets) if open_tickets else rng.choice(active_tickets)
        prev_status = target.status
        new_status = "In Progress" if prev_status == "Open" else "Pending"
        target.status = new_status

        sim_event = SimulationEvent(
            id=f"evt:{uuid.uuid4().hex[:12]}",
            dataset_id=DEMO_DATASET_ID,
            event_type="status_changed",
            ticket_id=target.source_ticket_id,
            details={
                "previous_status": prev_status,
                "new_status": new_status,
                "ticket_title": target.title,
            },
            timestamp=now,
        )

    elif event_type == "first_response":
        no_resp = [t for t in active_tickets if t.response_duration is None]
        if no_resp:
            target = rng.choice(no_resp)
            elapsed = (now - target.created_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600.0
            target.response_duration = round(max(0.1, elapsed), 2)

            sim_event = SimulationEvent(
                id=f"evt:{uuid.uuid4().hex[:12]}",
                dataset_id=DEMO_DATASET_ID,
                event_type="first_response",
                ticket_id=target.source_ticket_id,
                details={
                    "response_duration_hours": target.response_duration,
                    "within_sla": bool(target.response_deadline and now <= target.response_deadline.replace(tzinfo=timezone.utc)),
                },
                timestamp=now,
            )

    elif event_type == "priority_changed":
        target = rng.choice(active_tickets)
        old_prio = target.priority
        new_prio = "Critical" if old_prio == "High" else ("High" if old_prio == "Medium" else "Medium")
        target.priority = new_prio

        sim_event = SimulationEvent(
            id=f"evt:{uuid.uuid4().hex[:12]}",
            dataset_id=DEMO_DATASET_ID,
            event_type="priority_changed",
            ticket_id=target.source_ticket_id,
            details={
                "previous_priority": old_prio,
                "new_priority": new_prio,
                "reason": "Customer inquiry urgency escalation in simulated queue",
            },
            timestamp=now,
        )

    elif event_type == "assignment_changed":
        target = rng.choice(active_tickets)
        old_team = target.assigned_team_id
        teams = ["team-a", "team-b", "team-c", "team-d"]
        new_team = rng.choice([tm for tm in teams if tm != old_team])
        target.assigned_team_id = new_team

        sim_event = SimulationEvent(
            id=f"evt:{uuid.uuid4().hex[:12]}",
            dataset_id=DEMO_DATASET_ID,
            event_type="assignment_changed",
            ticket_id=target.source_ticket_id,
            details={
                "previous_team": old_team,
                "new_team": new_team,
                "reassigned_by": "Automated Dispatch Simulator",
            },
            timestamp=now,
        )

    elif event_type == "ticket_resolved":
        in_prog = [t for t in active_tickets if t.status in ["In Progress", "Pending"]]
        target = rng.choice(in_prog) if in_prog else rng.choice(active_tickets)
        target.status = "Resolved"
        target.resolved_at = now
        elapsed = (now - target.created_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600.0
        target.resolution_duration = round(max(0.2, elapsed), 2)
        if target.response_duration is None:
            target.response_duration = round(min(target.resolution_duration, 1.2), 2)

        met_sla = bool(target.resolution_deadline and now <= target.resolution_deadline.replace(tzinfo=timezone.utc))

        sim_event = SimulationEvent(
            id=f"evt:{uuid.uuid4().hex[:12]}",
            dataset_id=DEMO_DATASET_ID,
            event_type="ticket_resolved",
            ticket_id=target.source_ticket_id,
            details={
                "resolution_duration_hours": target.resolution_duration,
                "met_sla": met_sla,
                "ticket_title": target.title,
            },
            timestamp=now,
        )

    if sim_event:
        db.add(sim_event)
        state.events_emitted += 1
        state.last_event_at = now
        state.updated_at = now
        db.commit()

    return sim_event


async def _background_simulation_loop():
    """Persistent background task executing simulation ticks according to configured speed."""
    logger.info("Background simulation loop started.")
    try:
        while True:
            db: Session = SessionLocal()
            try:
                state = get_simulation_state(db)
                if state.status == "running":
                    interval = max(1.0, state.interval_seconds / max(0.1, state.speed))
                    simulate_tick(db)
                elif state.status in ["paused", "stopped"]:
                    interval = 3.0
                else:
                    interval = 5.0
            except Exception as exc:
                logger.error(f"Error during simulation tick: {exc}")
                interval = 5.0
            finally:
                db.close()

            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("Background simulation loop cancelled.")


async def ensure_simulation_worker_running():
    """Ensure the background simulation loop task is running."""
    global _simulation_task
    async with _simulation_lock:
        if _simulation_task is None or _simulation_task.done():
            _simulation_task = asyncio.create_task(_background_simulation_loop())


def start_simulation(db: Session) -> SimulationState:
    """Set simulation status to running."""
    state = get_simulation_state(db)
    state.status = "running"
    state.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(state)
    return state


def pause_simulation(db: Session) -> SimulationState:
    """Pause running simulation."""
    state = get_simulation_state(db)
    if state.status == "running":
        state.status = "paused"
        state.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(state)
    return state


def resume_simulation(db: Session) -> SimulationState:
    """Resume paused simulation."""
    state = get_simulation_state(db)
    if state.status == "paused":
        state.status = "running"
        state.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(state)
    return state


def stop_simulation(db: Session) -> SimulationState:
    """Stop active simulation."""
    state = get_simulation_state(db)
    state.status = "stopped"
    state.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(state)
    return state


def update_simulation_speed(db: Session, speed: float, interval_seconds: Optional[float] = None) -> SimulationState:
    """Adjust simulation speed multiplier and event interval."""
    state = get_simulation_state(db)
    state.speed = max(0.2, min(10.0, speed))
    if interval_seconds is not None:
        state.interval_seconds = max(1.0, min(60.0, interval_seconds))
    state.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(state)
    return state


def reset_simulation_environment(db: Session) -> Dict[str, Any]:
    """Reset the demo dataset and its decisions/actions to fresh initial state."""
    stop_simulation(db)
    ds = seed_synthetic_demo_dataset(db, force_reset=True)
    state = get_simulation_state(db)
    state.events_emitted = 0
    state.last_event_at = None
    state.status = "stopped"
    state.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "message": "Synthetic demo dataset and simulation environment reset successfully.",
        "dataset_id": ds.id,
        "total_tickets": ds.total_rows,
    }

