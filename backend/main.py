"""FastAPI web application exposing ticket operations and engine integration."""

from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import get_db, init_db
from backend.models import Ticket, Team
from backend.schemas import (
    TicketCreate,
    TicketResponse,
    SLARiskResponse,
    AssignTeamResponse,
    TeamCreate,
    TeamResponse,
)
from backend.engines.sla_risk import calculate_sla_risk
from backend.engines.team_assignment import assign_team, NoTeamAvailableError


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager initializing database tables on startup."""
    init_db()
    yield


app = FastAPI(
    title="OpsPulse / SLA Sentinel Backend API",
    description="Rule-based operations intelligence engine for SLA risk and team routing.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    """Health check and root information endpoint."""
    return {"message": "SLA-Sentinel Backend API is running."}


# ---------------------------------------------------------
# Team Endpoints
# ---------------------------------------------------------
@app.post("/teams", response_model=TeamResponse, status_code=201)
def create_team(team_in: TeamCreate, db: Session = Depends(get_db)):
    """Create a new squad / team."""
    existing = db.query(Team).filter(Team.id == team_in.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Team '{team_in.id}' already exists.")
    team = Team(
        id=team_in.id,
        name=team_in.name,
        skill_tags=team_in.skill_tags,
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@app.get("/teams", response_model=List[TeamResponse])
def list_teams(db: Session = Depends(get_db)):
    """List all registered teams."""
    return db.query(Team).all()


# ---------------------------------------------------------
# Ticket Endpoints
# ---------------------------------------------------------
@app.post("/tickets", response_model=TicketResponse, status_code=201)
def create_ticket(ticket_in: TicketCreate, db: Session = Depends(get_db)):
    """Create a new ticket."""
    existing = db.query(Ticket).filter(Ticket.id == ticket_in.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Ticket '{ticket_in.id}' already exists.")
    ticket = Ticket(
        id=ticket_in.id,
        title=ticket_in.title,
        description=ticket_in.description,
        category=ticket_in.category,
        status=ticket_in.status,
        priority=ticket_in.priority,
        created_at=ticket_in.created_at,
        sla_time_limit=ticket_in.sla_time_limit,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@app.get("/tickets", response_model=List[TicketResponse])
def list_tickets(db: Session = Depends(get_db)):
    """List all tickets."""
    return db.query(Ticket).all()


# ---------------------------------------------------------
# Engine Integration Endpoints
# ---------------------------------------------------------
@app.get("/tickets/{ticket_id}/sla-risk", response_model=SLARiskResponse)
def get_ticket_sla_risk(ticket_id: str, db: Session = Depends(get_db)):
    """Engine 1: Evaluate SLA risk for a specific ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found.")

    risk = calculate_sla_risk(ticket.created_at, ticket.sla_time_limit)
    return {
        "ticket_id": ticket.id,
        **risk,
    }


@app.post("/tickets/{ticket_id}/assign", response_model=AssignTeamResponse)
def assign_ticket_team(ticket_id: str, db: Session = Depends(get_db)):
    """Engine 2: Determine best team and assign it to the ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found.")

    try:
        assignment = assign_team(ticket.category, db)
    except NoTeamAvailableError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    ticket.assigned_team_id = assignment["team_id"]
    db.commit()
    db.refresh(ticket)

    return {
        "ticket_id": ticket.id,
        **assignment,
    }
