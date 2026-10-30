"""Canonical ticket schema definitions, field aliases, and column matching."""

import re
from typing import Dict, List, Optional, Set

# Controlled canonical fields and their properties
CANONICAL_FIELDS: Dict[str, Dict[str, any]] = {
    "ticket_id": {
        "required": True,
        "type": "string",
        "label": "Ticket ID",
        "description": "Unique identifier for the ticket (Required).",
    },
    "title": {
        "required": False,
        "type": "string",
        "label": "Title / Problem",
        "description": "Short summary or subject of the issue.",
    },
    "description": {
        "required": False,
        "type": "string",
        "label": "Description",
        "description": "Full details or customer message.",
    },
    "category": {
        "required": False,
        "type": "string",
        "label": "Category / Type",
        "description": "Issue type or classification (e.g. Payments, Technical).",
    },
    "status": {
        "required": False,
        "type": "string",
        "label": "Status",
        "description": "Current lifecycle status (Open, Pending, Resolved, etc.).",
    },
    "priority": {
        "required": False,
        "type": "string",
        "label": "Priority",
        "description": "Severity/urgency level (Critical, High, Medium, Low).",
    },
    "created_at": {
        "required": True,
        "type": "datetime",
        "label": "Created At",
        "description": "Ticket creation timestamp (Required for SLA evaluation).",
    },
    "response_deadline": {
        "required": False,
        "type": "datetime",
        "label": "Response Deadline",
        "description": "Target SLA deadline for initial response.",
    },
    "resolution_deadline": {
        "required": False,
        "type": "datetime",
        "label": "Resolution Deadline",
        "description": "Target SLA deadline for complete resolution.",
    },
    "resolved_at": {
        "required": False,
        "type": "datetime",
        "label": "Resolved At",
        "description": "Actual resolution timestamp if ticket is resolved/closed.",
    },
    "resolution_duration": {
        "required": False,
        "type": "float",
        "label": "Resolution Duration",
        "description": "Elapsed time or duration to resolution.",
    },
    "response_duration": {
        "required": False,
        "type": "float",
        "label": "Response Duration",
        "description": "Elapsed time or duration to first response.",
    },
    "assigned_team_id": {
        "required": False,
        "type": "string",
        "label": "Assigned Squad / Team",
        "description": "Team or squad ID assigned to the ticket.",
    },
}

# Derived / Source Metrics that can be recognized and preserved separately
DERIVED_METRIC_COLUMNS: Set[str] = {
    "pending_hours",
    "deadline_hours_left",
    "pending_time",
    "hours_pending",
}

# Known aliases mapping normalized candidate names -> canonical field
ALIAS_MAP: Dict[str, str] = {
    # ticket_id
    "ticket id": "ticket_id",
    "ticket_id": "ticket_id",
    "ticketid": "ticket_id",
    "case id": "ticket_id",
    "case_id": "ticket_id",
    "incident id": "ticket_id",
    "incident_id": "ticket_id",
    "issue id": "ticket_id",
    "issue_id": "ticket_id",
    "id": "ticket_id",
    "ticket #": "ticket_id",
    "ticket no": "ticket_id",
    "ticket number": "ticket_id",

    # title
    "ticket subject": "title",
    "ticket_subject": "title",
    "subject": "title",
    "problem": "title",
    "issue title": "title",
    "issue_title": "title",
    "title": "title",
    "summary": "title",
    "heading": "title",

    # description
    "ticket description": "description",
    "ticket_description": "description",
    "description": "description",
    "issue": "description",
    "details": "description",
    "body": "description",
    "notes": "description",

    # category
    "ticket type": "category",
    "ticket_type": "category",
    "category": "category",
    "issue type": "category",
    "issue_type": "category",
    "type": "category",
    "product": "category",
    "department": "category",
    "topic": "category",
    "classification": "category",

    # status
    "ticket status": "status",
    "ticket_status": "status",
    "case status": "status",
    "case_status": "status",
    "incident status": "status",
    "status": "status",
    "state": "status",
    "ticket state": "status",

    # priority
    "ticket priority": "priority",
    "ticket_priority": "priority",
    "priority": "priority",
    "severity": "priority",
    "urgency": "priority",
    "priority level": "priority",
    "prio": "priority",

    # created_at
    "ticket created at": "created_at",
    "ticket_created_at": "created_at",
    "creation timestamp": "created_at",
    "creation_timestamp": "created_at",
    "created at": "created_at",
    "created_at": "created_at",
    "created": "created_at",
    "creation time": "created_at",
    "creation_time": "created_at",
    "creation date": "created_at",
    "creation_date": "created_at",
    "created date": "created_at",
    "created_date": "created_at",
    "opened at": "created_at",
    "opened_at": "created_at",
    "submitted at": "created_at",
    "submitted_at": "created_at",
    "date created": "created_at",
    "date_created": "created_at",

    # response_deadline
    "response deadline": "response_deadline",
    "response_deadline": "response_deadline",
    "response due at": "response_deadline",
    "response_due_at": "response_deadline",
    "first response due at": "response_deadline",
    "first_response_due_at": "response_deadline",
    "first response deadline": "response_deadline",
    "first_response_deadline": "response_deadline",

    # resolution_deadline
    "resolution deadline": "resolution_deadline",
    "resolution_deadline": "resolution_deadline",
    "resolution due at": "resolution_deadline",
    "resolution_due_at": "resolution_deadline",
    "sla deadline": "resolution_deadline",
    "sla_deadline": "resolution_deadline",
    "deadline": "resolution_deadline",
    "resolution target": "resolution_deadline",
    "resolution due": "resolution_deadline",

    # resolved_at
    "resolved at": "resolved_at",
    "resolved_at": "resolved_at",
    "resolution time": "resolved_at",
    "resolution_time": "resolved_at",
    "closed at": "resolved_at",
    "closed_at": "resolved_at",
    "completed at": "resolved_at",
    "completed_at": "resolved_at",
    "resolution date": "resolved_at",
    "resolution_date": "resolved_at",

    # resolution_duration
    "time to resolution": "resolution_duration",
    "time_to_resolution": "resolution_duration",
    "resolution time": "resolution_duration",
    "resolution_time": "resolution_duration",
    "resolution duration": "resolution_duration",
    "resolution_duration": "resolution_duration",

    # response_duration
    "first response time": "response_duration",
    "first_response_time": "response_duration",
    "response time": "response_duration",
    "response_time": "response_duration",
    "response duration": "response_duration",
    "response_duration": "response_duration",
    "first response at": "response_duration",
    "first_response_at": "response_duration",
    "first reply at": "response_duration",
    "first_reply_at": "response_duration",

    # assigned_team_id
    "assigned team": "assigned_team_id",
    "assigned_team": "assigned_team_id",
    "assigned team id": "assigned_team_id",
    "assigned_team_id": "assigned_team_id",
    "team": "assigned_team_id",
    "team id": "assigned_team_id",
    "squad": "assigned_team_id",
    "assigned squad": "assigned_team_id",
    "assigned_squad": "assigned_team_id",
    "group": "assigned_team_id",
    "assigned group": "assigned_team_id",
    "assigned to": "assigned_team_id",
    "assigned_to": "assigned_team_id",
    "agent": "assigned_team_id",
    "assignee": "assigned_team_id",
    "owner": "assigned_team_id",
}


def normalize_column_name(col: str) -> str:
    """Normalize a source column name by lowercasing, stripping punctuation, and trimming."""
    if not col:
        return ""
    # Strip whitespace, replace underscores/hyphens with space, collapse repeated spaces
    cleaned = col.strip().lower()
    cleaned = re.sub(r"[\s_\-]+", " ", cleaned)
    # Remove surrounding non-alphanumeric except spaces
    cleaned = re.sub(r"[^\w\s#]", "", cleaned)
    return cleaned.strip()


def suggest_canonical_mapping(columns: List[str]) -> Dict[str, Optional[str]]:
    """Suggest canonical fields for detected source columns.

    Ensures no canonical field is mapped more than once automatically
    and guarantees strict differentiation between response and resolution deadlines.
    """
    suggestions: Dict[str, Optional[str]] = {}
    assigned_canonicals: Set[str] = set()

    # Pass 1: Exact matches against ALIAS_MAP
    for raw_col in columns:
        normalized = normalize_column_name(raw_col)
        canonical = ALIAS_MAP.get(normalized)
        if canonical and canonical not in assigned_canonicals:
            suggestions[raw_col] = canonical
            assigned_canonicals.add(canonical)
        else:
            suggestions[raw_col] = None

    # Pass 2: Fuzzy fallback for unmapped columns
    for raw_col, current in suggestions.items():
        if current is not None:
            continue
        norm = normalize_column_name(raw_col)

        # Check explicit contains without conflating deadlines
        if "response" in norm and ("deadline" in norm or "due" in norm):
            target = "response_deadline"
        elif "resolution" in norm and ("deadline" in norm or "due" in norm):
            target = "resolution_deadline"
        elif "deadline" in norm and "deadline_hours_left" not in norm:
            target = "resolution_deadline"
        elif "subject" in norm or "problem" in norm:
            target = "title"
        elif "description" in norm or "summary" in norm:
            target = "description"
        elif "status" in norm or "state" in norm:
            target = "status"
        elif "priority" in norm or "severity" in norm or "urgency" in norm:
            target = "priority"
        elif "created" in norm or "creation" in norm or "opened" in norm or "submitted" in norm:
            target = "created_at"
        elif "team" in norm or "squad" in norm or "group" in norm or "assignee" in norm or "agent" in norm or "owner" in norm:
            target = "assigned_team_id"
        elif ("ticket" in norm or "case" in norm or "incident" in norm or "issue" in norm) and "id" in norm:
            target = "ticket_id"
        elif "category" in norm or "issue type" in norm:
            target = "category"
        else:
            target = None

        if target and target not in assigned_canonicals:
            suggestions[raw_col] = target
            assigned_canonicals.add(target)

    return suggestions

