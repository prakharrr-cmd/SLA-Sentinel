"""API routes for controlling the local live synthetic ticket simulator."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.simulator import (
    get_simulation_state,
    get_recent_events,
    simulate_tick,
    start_simulation,
    pause_simulation,
    resume_simulation,
    stop_simulation,
    update_simulation_speed,
    reset_simulation_environment,
    ensure_simulation_worker_running,
)

router = APIRouter(prefix="/api/simulation", tags=["Synthetic Simulator"])


class SpeedUpdateRequest(BaseModel):
    speed: float = Field(..., gt=0, le=10.0, description="Speed multiplier (e.g. 1.0, 2.0, 5.0)")
    interval_seconds: Optional[float] = Field(None, ge=1.0, le=60.0, description="Base interval in seconds")


@router.get("/status")
async def get_status(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve current simulation state and execution status."""
    await ensure_simulation_worker_running()
    state = get_simulation_state(db)
    return {
        "status": state.status,
        "speed": state.speed,
        "interval_seconds": state.interval_seconds,
        "scenario": state.scenario,
        "events_emitted": state.events_emitted,
        "dataset_id": state.dataset_id,
        "last_event_at": state.last_event_at.isoformat() if state.last_event_at else None,
        "updated_at": state.updated_at.isoformat() if state.updated_at else None,
    }


@router.post("/start")
async def start(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Start local synthetic ticket simulation."""
    await ensure_simulation_worker_running()
    state = start_simulation(db)
    return {"message": "Simulation started", "status": state.status, "speed": state.speed}


@router.post("/pause")
def pause(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Pause currently running simulation."""
    state = pause_simulation(db)
    return {"message": "Simulation paused", "status": state.status}


@router.post("/resume")
async def resume(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Resume paused simulation."""
    await ensure_simulation_worker_running()
    state = resume_simulation(db)
    return {"message": "Simulation resumed", "status": state.status}


@router.post("/stop")
def stop(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Stop active simulation."""
    state = stop_simulation(db)
    return {"message": "Simulation stopped", "status": state.status}


@router.post("/speed")
def set_speed(payload: SpeedUpdateRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Adjust simulation speed multiplier and event interval."""
    state = update_simulation_speed(db, payload.speed, payload.interval_seconds)
    return {
        "message": "Simulation speed updated",
        "speed": state.speed,
        "interval_seconds": state.interval_seconds,
    }


@router.post("/tick")
def trigger_tick(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Trigger a single immediate simulation tick for testing."""
    state = get_simulation_state(db)
    orig_status = state.status
    if state.status != "running":
        state.status = "running"
        db.flush()

    event = simulate_tick(db)

    state.status = orig_status
    db.commit()

    if not event:
        return {"message": "No event generated during tick"}

    return {
        "message": f"Simulation tick executed: {event.event_type}",
        "event_id": event.id,
        "event_type": event.event_type,
        "ticket_id": event.ticket_id,
        "details": event.details,
        "timestamp": event.timestamp.isoformat(),
    }


@router.post("/reset")
def reset_data(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Reset the synthetic demo dataset and related simulator state."""
    return reset_simulation_environment(db)


@router.get("/events")
def list_events(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve recent simulation event history."""
    events = get_recent_events(db, limit=limit)
    return [
        {
            "id": e.id,
            "dataset_id": e.dataset_id,
            "event_type": e.event_type,
            "ticket_id": e.ticket_id,
            "details": e.details,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in events
    ]

