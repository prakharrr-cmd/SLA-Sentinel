"""SQLAlchemy database models for Teams and Tickets."""

from datetime import datetime, timezone
import json
from typing import Any, List
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, JSON
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

