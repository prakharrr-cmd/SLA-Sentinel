"""API endpoints for managing and inspecting business configuration factors."""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import (
    SLAPolicy,
    TeamCapacity,
    PriorityWeight,
    RiskThreshold,
    TicketCategoryConfig,
    TicketComplexityConfig,
    AgentWorkload,
    TeamPerformanceHistory,
)
from backend.services.business_config import seed_default_business_configuration

router = APIRouter(prefix="/api/config", tags=["Business Configuration"])


class SLAPolicyUpdate(BaseModel):
    target_hours: float = Field(..., gt=0, description="Updated target SLA duration in hours")
    description: str | None = None


class TeamCapacityUpdate(BaseModel):
    max_active_tickets: int = Field(..., gt=0, description="Maximum active ticket threshold")
    warning_threshold: float = Field(..., ge=0.0, le=1.0)
    critical_threshold: float = Field(..., ge=0.0, le=1.0)


class PriorityWeightUpdate(BaseModel):
    weight_multiplier: float = Field(..., gt=0)


@router.get("/summary")
def get_config_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve complete snapshot of active business configurations."""
    seed_default_business_configuration(db)

    sla_policies = db.query(SLAPolicy).all()
    team_capacities = db.query(TeamCapacity).all()
    priority_weights = db.query(PriorityWeight).all()
    risk_thresholds = db.query(RiskThreshold).all()
    categories = db.query(TicketCategoryConfig).all()
    complexities = db.query(TicketComplexityConfig).all()
    agents = db.query(AgentWorkload).all()
    team_perf = db.query(TeamPerformanceHistory).all()

    return {
        "sla_policies": [
            {
                "id": p.id,
                "target_type": p.target_type,
                "priority": p.priority,
                "target_hours": p.target_hours,
                "description": p.description,
            }
            for p in sla_policies
        ],
        "team_capacities": [
            {
                "id": c.id,
                "team_id": c.team_id,
                "max_active_tickets": c.max_active_tickets,
                "warning_threshold": c.warning_threshold,
                "critical_threshold": c.critical_threshold,
            }
            for c in team_capacities
        ],
        "priority_weights": [
            {
                "id": w.id,
                "priority": w.priority,
                "weight_multiplier": w.weight_multiplier,
            }
            for w in priority_weights
        ],
        "risk_thresholds": [
            {
                "id": t.id,
                "risk_level": t.risk_level,
                "min_score": t.min_score,
                "max_score": t.max_score,
            }
            for t in risk_thresholds
        ],
        "categories": [
            {
                "id": cat.id,
                "category_name": cat.category_name,
                "default_complexity": cat.default_complexity,
                "historical_breach_rate": cat.historical_breach_rate,
                "recommended_team_id": cat.recommended_team_id,
            }
            for cat in categories
        ],
        "complexities": [
            {
                "id": comp.id,
                "complexity_level": comp.complexity_level,
                "duration_multiplier": comp.duration_multiplier,
            }
            for comp in complexities
        ],
        "agents": [
            {
                "agent_id": a.agent_id,
                "agent_name": a.agent_name,
                "team_id": a.team_id,
                "active_tickets_count": a.active_tickets_count,
                "max_capacity": a.max_capacity,
                "status": a.status,
            }
            for a in agents
        ],
        "team_performance_history": [
            {
                "team_id": tp.team_id,
                "period": tp.period,
                "total_handled": tp.total_handled,
                "response_sla_compliance_rate": tp.response_sla_compliance_rate,
                "resolution_sla_compliance_rate": tp.resolution_sla_compliance_rate,
                "avg_resolution_hours": tp.avg_resolution_hours,
            }
            for tp in team_perf
        ],
    }


@router.put("/sla-policies/{policy_id}")
def update_sla_policy(
    policy_id: str,
    update_data: SLAPolicyUpdate,
    db: Session = Depends(get_db),
):
    """Update SLA target duration for a specific policy."""
    policy = db.query(SLAPolicy).filter(SLAPolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail=f"SLA policy '{policy_id}' not found.")

    policy.target_hours = update_data.target_hours
    if update_data.description:
        policy.description = update_data.description
    db.commit()
    db.refresh(policy)
    return {"message": f"Updated policy {policy_id}", "target_hours": policy.target_hours}


@router.put("/team-capacities/{team_id}")
def update_team_capacity(
    team_id: str,
    update_data: TeamCapacityUpdate,
    db: Session = Depends(get_db),
):
    """Update team capacity limits and warning thresholds."""
    cap = db.query(TeamCapacity).filter(TeamCapacity.team_id == team_id).first()
    if not cap:
        raise HTTPException(status_code=404, detail=f"Team capacity for '{team_id}' not found.")

    cap.max_active_tickets = update_data.max_active_tickets
    cap.warning_threshold = update_data.warning_threshold
    cap.critical_threshold = update_data.critical_threshold
    db.commit()
    db.refresh(cap)
    return {"message": f"Updated capacity for {team_id}", "max_active_tickets": cap.max_active_tickets}

