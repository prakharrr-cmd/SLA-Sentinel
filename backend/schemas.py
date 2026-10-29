"""Pydantic schemas for request and response validation."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TeamBase(BaseModel):
    id: str
    name: str
    skill_tags: List[str] = Field(default_factory=list)


class TeamCreate(TeamBase):
    pass


class TeamResponse(TeamBase):
    model_config = ConfigDict(from_attributes=True)


class TicketBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: str
    status: str = "Open"
    priority: Optional[str] = "Medium"
    created_at: Optional[datetime] = None
    sla_time_limit: float = 24.0


class TicketCreate(TicketBase):
    id: str


class TicketResponse(TicketBase):
    id: str
    assigned_team_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SLARiskResponse(BaseModel):
    ticket_id: str
    ratio: float
    percent_elapsed: float
    risk_level: str
    is_high_risk: bool
    breached: Optional[bool] = None


class AssignTeamResponse(BaseModel):
    ticket_id: str
    team_id: str
    team_name: str
    open_tickets: int
    matched_by: str
