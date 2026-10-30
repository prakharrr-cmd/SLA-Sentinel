"""FastAPI web application exposing ticket operations, dataset intake pipeline, and engines."""

from contextlib import asynccontextmanager
import os
from typing import List
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import get_db, init_db, SessionLocal
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
from backend.routes.datasets import router as datasets_router
from backend.routes.analytics import router as analytics_router
from backend.routes.risks import router as risks_router
from backend.routes.recommendations import router as recommendations_router
from backend.routes.decisions import router as decisions_router
from backend.routes.actions import router as actions_router
from backend.routes.evaluations import router as evaluations_router
from backend.routes.config import router as config_router
from backend.routes.simulation import router as simulation_router
from backend.services.business_config import seed_default_business_configuration
from backend.services.demo_dataset import seed_synthetic_demo_dataset
from backend.services.simulator import ensure_simulation_worker_running


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager initializing database tables and demo seed on startup."""
    init_db()
    db = SessionLocal()
    try:
        seed_default_business_configuration(db)
        seed_synthetic_demo_dataset(db)
    finally:
        db.close()
    await ensure_simulation_worker_running()
    yield


app = FastAPI(
    title="OpsPulse / SLA Sentinel Backend API",
    description="Rule-based operations intelligence engine for SLA risk, team routing, and dataset intake.",
    version="1.1.0",
    lifespan=lifespan,
)

# Configurable CORS origins
configured_origins_env = os.getenv("CORS_ORIGINS", "")
if configured_origins_env:
    allowed_origins = [o.strip() for o in configured_origins_env.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register dataset intake & validation pipeline
app.include_router(datasets_router)
for _route in datasets_router.routes:
    if _route not in app.routes:
        app.routes.append(_route)

# Register dataset analytics and risk scoring
app.include_router(analytics_router)
for _route in analytics_router.routes:
    if _route not in app.routes:
        app.routes.append(_route)

app.include_router(risks_router)
for _route in risks_router.routes:
    if _route not in app.routes:
        app.routes.append(_route)

app.include_router(recommendations_router)
for _route in recommendations_router.routes:
    if _route not in app.routes:
        app.routes.append(_route)

app.include_router(decisions_router)
for _route in decisions_router.routes:
    if _route not in app.routes:
        app.routes.append(_route)

app.include_router(actions_router)
for _route in actions_router.routes:
    if _route not in app.routes:
        app.routes.append(_route)

app.include_router(evaluations_router)
for _route in evaluations_router.routes:
    if _route not in app.routes:
        app.routes.append(_route)

app.include_router(config_router)
for _route in config_router.routes:
    if _route not in app.routes:
        app.routes.append(_route)

app.include_router(simulation_router)
for _route in simulation_router.routes:
    if _route not in app.routes:
        app.routes.append(_route)


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
