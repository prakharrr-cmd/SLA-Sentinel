"""SQLAlchemy database models for Teams, Tickets, Datasets, Decisions, Actions, Evaluations, Business Config, and Simulation."""

from datetime import datetime, timezone
import json
from typing import Any, List
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class Team(Base):
    """Team model representing support squads and their skill tags."""

    __tablename__ = "teams"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    skill_tags = Column(JSON, nullable=False, default=list)

    tickets = relationship("Ticket", back_populates="team")

    def get_skill_tags_list(self) -> List[str]:
        """Normalize skill tags to a list of strings."""
        if isinstance(self.skill_tags, list):
            return [str(t) for t in self.skill_tags]
        if isinstance(self.skill_tags, str):
            try:
                parsed = json.loads(self.skill_tags)
                if isinstance(parsed, list):
                    return [str(t) for t in parsed]
            except Exception:
                pass
            return [t.strip() for t in self.skill_tags.split(",") if t.strip()]
        return []


class Ticket(Base):
    """Ticket model representing support issues and their workflow status."""

    __tablename__ = "tickets"

    id = Column(String(50), primary_key=True)
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="Open")
    priority = Column(String(50), nullable=True, default="Medium")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    sla_time_limit = Column(Float, nullable=False, default=24.0)  # hours
    assigned_team_id = Column(String(50), ForeignKey("teams.id"), nullable=True)

    team = relationship("Team", back_populates="tickets")


class Dataset(Base):
    """Dataset model tracking imported CSV/Excel batches, schemas, and reports."""

    __tablename__ = "datasets"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=True)
    source_filename = Column(String(255), nullable=False)
    file_format = Column(String(50), nullable=False, default="csv")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    snapshot_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), nullable=False, default="completed")  # completed, partial, failed
    total_rows = Column(Integer, nullable=False, default=0)
    accepted_rows = Column(Integer, nullable=False, default=0)
    rejected_rows = Column(Integer, nullable=False, default=0)
    warning_count = Column(Integer, nullable=False, default=0)
    applied_mapping = Column(JSON, nullable=False, default=dict)
    validation_summary = Column(JSON, nullable=False, default=dict)
    is_simulated = Column(Boolean, nullable=False, default=False)

    tickets = relationship(
        "ImportedTicket",
        back_populates="dataset",
        cascade="all, delete-orphan",
    )


class ImportedTicket(Base):
    """Canonical imported ticket record scoped to a specific dataset."""

    __tablename__ = "imported_tickets"

    id = Column(String(100), primary_key=True)  # stable surrogate id: e.g. "{dataset_id}:{source_ticket_id}"
    dataset_id = Column(
        String(50),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_ticket_id = Column(String(100), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="Open")
    priority = Column(String(50), nullable=False, default="Medium")
    created_at = Column(DateTime(timezone=True), nullable=False)
    response_deadline = Column(DateTime(timezone=True), nullable=True)
    resolution_deadline = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_duration = Column(Float, nullable=True)
    response_duration = Column(Float, nullable=True)
    assigned_team_id = Column(String(50), nullable=True)
    current_assignee_id = Column(String(100), nullable=True)
    customer_tier = Column(String(50), nullable=True, default="Standard")
    complexity = Column(String(50), nullable=True, default="Medium")
    source_metrics = Column(JSON, nullable=True, default=dict)
    original_values = Column(JSON, nullable=False, default=dict)
    is_valid = Column(Boolean, nullable=False, default=True)

    dataset = relationship("Dataset", back_populates="tickets")

    __table_args__ = (
        UniqueConstraint("dataset_id", "source_ticket_id", name="uq_dataset_source_ticket"),
    )


class ManagerDecision(Base):
    """Auditable manager decision for an evidence-backed recommendation."""

    __tablename__ = "manager_decisions"

    id = Column(String(100), primary_key=True)
    dataset_id = Column(
        String(50),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recommendation_id = Column(String(150), nullable=False, index=True)
    source_ticket_id = Column(String(100), nullable=False, index=True)
    decision_type = Column(String(50), nullable=False)  # approved, rejected, modified
    original_recommendation_snapshot = Column(JSON, nullable=False, default=dict)
    manager_action = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    manager_id = Column(String(100), nullable=False, default="unauthenticated_operator")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    previous_decision_id = Column(
        String(100),
        ForeignKey("manager_decisions.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_effective = Column(Boolean, nullable=False, default=True)
    idempotency_key = Column(String(100), nullable=True, index=True)

    dataset = relationship("Dataset")
    previous_decision = relationship("ManagerDecision", remote_side=[id])


class TrackedAction(Base):
    """Persistent operational action record created from an approved/modified manager decision."""

    __tablename__ = "tracked_actions"

    id = Column(String(100), primary_key=True)
    dataset_id = Column(
        String(50),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    decision_id = Column(
        String(100),
        ForeignKey("manager_decisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        unique=True,
    )
    recommendation_id = Column(String(150), nullable=False, index=True)
    source_ticket_id = Column(String(100), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    action_payload = Column(JSON, nullable=False, default=dict)
    current_status = Column(String(50), nullable=False, default="pending", index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)
    reason = Column(Text, nullable=True)
    actor_id = Column(String(100), nullable=False, default="unauthenticated_operator")

    dataset = relationship("Dataset")
    decision = relationship("ManagerDecision")
    status_history = relationship(
        "ActionStatusHistory",
        back_populates="action",
        cascade="all, delete-orphan",
        order_by="ActionStatusHistory.change_timestamp.asc()",
    )

    __table_args__ = (
        UniqueConstraint("decision_id", name="uq_action_decision"),
    )


class ActionStatusHistory(Base):
    """Append-only audit record tracking every lifecycle status transition for an action."""

    __tablename__ = "action_status_history"

    id = Column(String(100), primary_key=True)
    action_id = Column(
        String(100),
        ForeignKey("tracked_actions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    change_timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    reason = Column(Text, nullable=True)
    actor_id = Column(String(100), nullable=False, default="unauthenticated_operator")

    action = relationship("TrackedAction", back_populates="status_history")


class EvaluationSnapshot(Base):
    """Immutable evaluation snapshot capturing baseline vs post-action outcome metrics."""

    __tablename__ = "evaluation_snapshots"

    id = Column(String(100), primary_key=True)
    dataset_id = Column(
        String(50),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    generated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    sla_target = Column(String(50), nullable=False, default="resolution_deadline")
    evaluation_window = Column(JSON, nullable=False, default=dict)
    action_metrics = Column(JSON, nullable=False, default=dict)
    baseline_metrics = Column(JSON, nullable=False, default=dict)
    post_action_metrics = Column(JSON, nullable=False, default=dict)
    comparison_summary = Column(JSON, nullable=False, default=dict)
    limitations = Column(JSON, nullable=False, default=list)

    dataset = relationship("Dataset")


# -------------------------------------------------------------
# Business Configuration & Factors Models (Phase 3)
# -------------------------------------------------------------

class SLAPolicy(Base):
    """Configurable response and resolution SLA target policies."""

    __tablename__ = "sla_policies"

    id = Column(String(100), primary_key=True)
    target_type = Column(String(50), nullable=False)  # "response" or "resolution"
    priority = Column(String(50), nullable=False, default="All")
    category = Column(String(100), nullable=False, default="All")
    complexity = Column(String(50), nullable=False, default="All")
    customer_tier = Column(String(50), nullable=False, default="All")
    target_hours = Column(Float, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class TeamCapacity(Base):
    """Team workload capacity limits and threshold configurations."""

    __tablename__ = "team_capacities"

    id = Column(String(100), primary_key=True)
    team_id = Column(String(50), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, unique=True)
    max_active_tickets = Column(Integer, nullable=False, default=10)
    warning_threshold = Column(Float, nullable=False, default=0.8)
    critical_threshold = Column(Float, nullable=False, default=1.0)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    team = relationship("Team")


class PriorityWeight(Base):
    """Priority weights used by scoring and risk ranking engines."""

    __tablename__ = "priority_weights"

    id = Column(String(50), primary_key=True)
    priority = Column(String(50), nullable=False, unique=True)
    weight_multiplier = Column(Float, nullable=False, default=1.0)
    description = Column(Text, nullable=True)


class RiskThreshold(Base):
    """Risk tier thresholds for score categorization."""

    __tablename__ = "risk_thresholds"

    id = Column(String(50), primary_key=True)
    risk_level = Column(String(50), nullable=False, unique=True)
    min_score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    description = Column(Text, nullable=True)


class TicketCategoryConfig(Base):
    """Ticket categories, default complexities, and benchmark breach rates."""

    __tablename__ = "ticket_category_configs"

    id = Column(String(100), primary_key=True)
    category_name = Column(String(100), nullable=False, unique=True)
    default_complexity = Column(String(50), nullable=False, default="Medium")
    historical_breach_rate = Column(Float, nullable=False, default=0.15)
    recommended_team_id = Column(String(50), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=True)


class TicketComplexityConfig(Base):
    """Ticket complexity level definitions and duration multipliers."""

    __tablename__ = "ticket_complexity_configs"

    id = Column(String(50), primary_key=True)
    complexity_level = Column(String(50), nullable=False, unique=True)
    duration_multiplier = Column(Float, nullable=False, default=1.0)
    description = Column(Text, nullable=True)


class AgentWorkload(Base):
    """Agent assignment and live operational workload tracking."""

    __tablename__ = "agent_workloads"

    id = Column(String(100), primary_key=True)
    agent_id = Column(String(100), nullable=False, unique=True)
    agent_name = Column(String(100), nullable=False)
    team_id = Column(String(50), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    active_tickets_count = Column(Integer, nullable=False, default=0)
    max_capacity = Column(Integer, nullable=False, default=5)
    status = Column(String(50), nullable=False, default="Available")


class TeamPerformanceHistory(Base):
    """Empirically measured historical team performance benchmarks."""

    __tablename__ = "team_performance_history"

    id = Column(String(100), primary_key=True)
    team_id = Column(String(50), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    period = Column(String(50), nullable=False, default="last_30_days")
    total_handled = Column(Integer, nullable=False, default=0)
    response_sla_compliance_rate = Column(Float, nullable=False, default=0.95)
    resolution_sla_compliance_rate = Column(Float, nullable=False, default=0.90)
    avg_resolution_hours = Column(Float, nullable=False, default=6.5)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    team = relationship("Team")


# -------------------------------------------------------------
# Synthetic Simulator State & Event Log Models (Phase 5)
# -------------------------------------------------------------

class SimulationState(Base):
    """State record for the local live synthetic ticket simulator."""

    __tablename__ = "simulation_state"

    id = Column(String(50), primary_key=True, default="default")
    status = Column(String(50), nullable=False, default="stopped")
    speed = Column(Float, nullable=False, default=1.0)
    interval_seconds = Column(Float, nullable=False, default=5.0)
    scenario = Column(String(50), nullable=False, default="mixed")
    events_emitted = Column(Integer, nullable=False, default=0)
    dataset_id = Column(String(50), nullable=False, default="demo-dataset-sla-sentinel")
    last_event_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class SimulationEvent(Base):
    """Persistent audit log of synthetic ticket activity events."""

    __tablename__ = "simulation_events"

    id = Column(String(100), primary_key=True)
    dataset_id = Column(String(50), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    ticket_id = Column(String(100), nullable=True, index=True)
    details = Column(JSON, nullable=False, default=dict)
    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
