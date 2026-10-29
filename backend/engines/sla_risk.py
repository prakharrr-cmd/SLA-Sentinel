"""SLA Risk calculation engine."""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

SLA_RISK_THRESHOLD: float = 0.80


def calculate_sla_risk(
    creation_time: datetime,
    sla_time_limit: Union[timedelta, float, int],
    current_time: Optional[datetime] = None,
) -> dict[str, Any]:
    """Calculate SLA risk based on elapsed time relative to SLA limit.

    Args:
        creation_time: Ticket creation timestamp. If naive, assumed UTC.
        sla_time_limit: SLA limit as a timedelta or hours (numeric).
        current_time: Evaluation timestamp. Defaults to UTC now.

    Returns:
        dict: SLA risk metadata containing ratio, percent_elapsed, risk_level,
              is_high_risk, and breached (if ratio >= 1.0).

    Raises:
        ValueError: If sla_time_limit <= 0 or creation_time is in the future.
    """
    # Normalize sla_time_limit
    if isinstance(sla_time_limit, (int, float)):
        if sla_time_limit <= 0:
            raise ValueError(f"sla_time_limit must be greater than 0, got {sla_time_limit}")
        limit_delta = timedelta(hours=float(sla_time_limit))
    elif isinstance(sla_time_limit, timedelta):
        if sla_time_limit.total_seconds() <= 0:
            raise ValueError(f"sla_time_limit must be greater than 0, got {sla_time_limit}")
        limit_delta = sla_time_limit
    else:
        raise ValueError(f"Invalid sla_time_limit type: {type(sla_time_limit)}")

    # Normalize current_time
    if current_time is None:
        current_time = datetime.now(timezone.utc)
    elif current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    # Normalize creation_time
    if creation_time.tzinfo is None:
        creation_time = creation_time.replace(tzinfo=timezone.utc)

    if creation_time > current_time:
        raise ValueError("creation_time cannot be in the future relative to current_time")

    elapsed_seconds = (current_time - creation_time).total_seconds()
    limit_seconds = limit_delta.total_seconds()
    ratio = elapsed_seconds / limit_seconds
    percent_elapsed = ratio * 100.0

    is_high_risk = ratio > SLA_RISK_THRESHOLD
    risk_level = "High Risk" if is_high_risk else "Normal"

    result: dict[str, Any] = {
        "ratio": float(ratio),
        "percent_elapsed": float(percent_elapsed),
        "risk_level": risk_level,
        "is_high_risk": bool(is_high_risk),
    }

    if ratio >= 1.0:
        result["breached"] = True

    return result


def flag_tickets(tickets: list[Any]) -> list[Any]:
    """Attach SLA risk result to each ticket in a list of tickets.

    Supports both ticket dictionaries and object instances.
    """
    for ticket in tickets:
        if isinstance(ticket, dict):
            c_time = (
                ticket.get("creation_time")
                or ticket.get("created_at")
                or ticket.get("Ticket Created At")
            )
            limit = ticket.get("sla_time_limit") or ticket.get("sla_hours")
            if limit is None:
                deadline = (
                    ticket.get("deadline")
                    or ticket.get("Resolution Deadline")
                    or ticket.get("Response Deadline")
                )
                if deadline and c_time:
                    dt_c = datetime.fromisoformat(str(c_time)) if isinstance(c_time, str) else c_time
                    dt_d = datetime.fromisoformat(str(deadline)) if isinstance(deadline, str) else deadline
                    limit = dt_d - dt_c
            if limit is None:
                limit = 24.0

            if isinstance(c_time, str):
                try:
                    c_time = datetime.fromisoformat(c_time)
                except Exception:
                    pass

            if isinstance(c_time, datetime):
                ticket["sla_risk"] = calculate_sla_risk(c_time, limit)
        else:
            c_time = getattr(ticket, "creation_time", getattr(ticket, "created_at", None))
            limit = getattr(ticket, "sla_time_limit", getattr(ticket, "sla_hours", 24.0))
            if isinstance(c_time, str):
                try:
                    c_time = datetime.fromisoformat(c_time)
                except Exception:
                    pass
            if isinstance(c_time, datetime):
                ticket.sla_risk = calculate_sla_risk(c_time, limit)

    return tickets

