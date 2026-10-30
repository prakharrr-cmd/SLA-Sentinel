"""Row validation, normalization, timestamp parsing, and data quality reporting."""

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional, Set, Tuple

# Supported controlled priority values
VALID_PRIORITIES = {"Critical", "High", "Medium", "Low"}

# Priority aliases
PRIORITY_MAP = {
    "critical": "Critical",
    "urgent": "Critical",
    "p1": "Critical",
    "high": "High",
    "p2": "High",
    "medium": "Medium",
    "normal": "Medium",
    "p3": "Medium",
    "low": "Low",
    "minor": "Low",
    "p4": "Low",
}

# Status normalizations
STATUS_MAP = {
    "open": "Open",
    "opened": "Open",
    "new": "Open",
    "pending": "Pending",
    "pending customer response": "Pending",
    "awaiting response": "Pending",
    "in progress": "In Progress",
    "in-progress": "In Progress",
    "assigned": "In Progress",
    "escalated": "Escalated",
    "resolved": "Resolved",
    "closed": "Closed",
    "completed": "Closed",
}


def parse_timestamp(val: Any) -> Optional[datetime]:
    """Parse various datetime string formats into timezone-aware UTC datetime.

    Handles explicit formats including 'DD-MM-YYYY HH.MM' (e.g. '31-05-2023 19.14'),
    'DD-MM-YYYY HH:MM:SS', ISO 8601, and standard date strings.
    """
    if val is None:
        return None

    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)

    s = str(val).strip()
    if not s or s.lower() in {"null", "none", "nan", "nat", ""}:
        return None

    # Replace dot in time part (e.g., "31-05-2023 19.14" -> "31-05-2023 19:14")
    # Matches patterns where a dot is between hours and minutes: e.g. " 19.14" or " 3.14"
    normalized_s = re.sub(r"(\s+\d{1,2})\.(\d{2})", r"\1:\2", s)

    formats = [
        # ISO / standard date + time
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        # DD-MM-YYYY / DD/MM/YYYY
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        # MM/DD/YYYY with 12-hour AM/PM or 24-hour
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m-%d-%Y %H:%M:%S",
        "%m-%d-%Y %H:%M",
        # YYYY/MM/DD
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        # DD.MM.YYYY
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%Y %H:%M",
        # Date only (defaults to 00:00:00 UTC)
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%m-%d-%Y",
        "%Y/%m/%d",
        "%d.%m.%Y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(normalized_s, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            else:
                dt = dt.astimezone(timezone.utc)
            return dt
        except ValueError:
            continue

    # Attempt isoformat fallback
    try:
        dt = datetime.fromisoformat(normalized_s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    except Exception:
        pass

    return None


def normalize_status(val: Any) -> str:
    """Normalize status string to controlled operational status."""
    if not val:
        return "Open"
    cleaned = str(val).strip().lower()
    return STATUS_MAP.get(cleaned, str(val).strip().title())


def normalize_priority(val: Any) -> Tuple[str, Optional[str]]:
    """Normalize priority string to Critical/High/Medium/Low.

    Returns:
        (normalized_priority, warning_message_if_any)
    """
    if not val:
        return "Medium", "Priority was missing; defaulted to 'Medium'."
    cleaned = str(val).strip().lower()
    matched = PRIORITY_MAP.get(cleaned)
    if matched:
        return matched, None
    return "Medium", f"Unrecognized priority '{val}' normalized to 'Medium'."


def validate_and_normalize_dataset(
    raw_rows: List[Dict[str, Any]],
    mapping: Dict[str, str],
    registered_team_ids: Optional[Set[str]] = None,
    max_reported_issues: int = 100,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """Validate each raw row against the canonical mapping and build validation reports.

    Returns:
        (accepted_records, validation_errors, validation_warnings, summary_metrics)
    """
    accepted_records: List[Dict[str, Any]] = []
    validation_errors: List[Dict[str, Any]] = []
    validation_warnings: List[Dict[str, Any]] = []

    # Build canonical_to_source mapping regardless of key-value orientation:
    # Supports both canonical_field -> source_column and source_column -> canonical_field
    from backend.ingestion.canonical import CANONICAL_FIELDS
    canonical_keys = set(CANONICAL_FIELDS.keys())

    canonical_to_source: Dict[str, str] = {}
    for k, v in mapping.items():
        if not k or not v:
            continue
        k_str = str(k).strip()
        v_str = str(v).strip()
        # Case 1: k is source column, v is canonical field (standard backend schema)
        if v_str in canonical_keys:
            canonical_to_source[v_str] = k_str
        # Case 2: k is canonical field, v is source column (frontend state orientation)
        elif k_str in canonical_keys:
            canonical_to_source[k_str] = v_str
        # Case 3: Case-insensitive fallback
        elif v_str.lower() in canonical_keys:
            canonical_to_source[v_str.lower()] = k_str
        elif k_str.lower() in canonical_keys:
            canonical_to_source[k_str.lower()] = v_str

    # Check required mapping
    if "ticket_id" not in canonical_to_source:
        raise ValueError("Mapping must include a column mapped to 'ticket_id'.")

    seen_ticket_ids: Dict[str, int] = {}
    duplicate_count = 0
    missing_created_at_count = 0
    inconsistent_deadline_count = 0

    for row_idx, raw_row in enumerate(raw_rows, start=1):
        row_has_error = False

        # 1. Ticket ID Validation
        src_id_col = canonical_to_source["ticket_id"]
        raw_ticket_id = raw_row.get(src_id_col)
        ticket_id = str(raw_ticket_id).strip() if raw_ticket_id is not None else ""

        if not ticket_id or ticket_id.lower() in {"null", "none", "nan"}:
            if len(validation_errors) < max_reported_issues:
                validation_errors.append({
                    "row": row_idx,
                    "field": "ticket_id",
                    "message": f"Missing or empty required Ticket ID in column '{src_id_col}'.",
                    "raw_value": raw_ticket_id,
                })
            row_has_error = True

        # Duplicate ID check
        if ticket_id:
            if ticket_id in seen_ticket_ids:
                first_row = seen_ticket_ids[ticket_id]
                duplicate_count += 1
                if len(validation_errors) < max_reported_issues:
                    validation_errors.append({
                        "row": row_idx,
                        "field": "ticket_id",
                        "message": (
                            f"Duplicate ticket ID '{ticket_id}'. Earlier occurrence already accepted at row {first_row}."
                        ),
                        "raw_value": ticket_id,
                    })
                row_has_error = True
            else:
                seen_ticket_ids[ticket_id] = row_idx

        # 2. Created At Validation
        created_at_dt: Optional[datetime] = None
        src_created_col = canonical_to_source.get("created_at")
        if src_created_col:
            raw_created = raw_row.get(src_created_col)
            if raw_created:
                created_at_dt = parse_timestamp(raw_created)
                if not created_at_dt:
                    if len(validation_errors) < max_reported_issues:
                        validation_errors.append({
                            "row": row_idx,
                            "field": "created_at",
                            "message": f"Unable to parse timestamp '{raw_created}' in column '{src_created_col}'.",
                            "raw_value": raw_created,
                        })
                    row_has_error = True
            else:
                missing_created_at_count += 1
                if len(validation_errors) < max_reported_issues:
                    validation_errors.append({
                        "row": row_idx,
                        "field": "created_at",
                        "message": f"Required timestamp 'created_at' is blank in column '{src_created_col}'.",
                        "raw_value": raw_created,
                    })
                row_has_error = True
        else:
            missing_created_at_count += 1
            if len(validation_errors) < max_reported_issues:
                validation_errors.append({
                    "row": row_idx,
                    "field": "created_at",
                    "message": "Dataset has no column mapped to required 'created_at'.",
                    "raw_value": None,
                })
            row_has_error = True

        if row_has_error:
            continue

        # 3. Optional Deadlines & Timestamps
        src_res_deadline_col = canonical_to_source.get("resolution_deadline")
        resolution_deadline_dt = (
            parse_timestamp(raw_row.get(src_res_deadline_col)) if src_res_deadline_col else None
        )

        src_resp_deadline_col = canonical_to_source.get("response_deadline")
        response_deadline_dt = (
            parse_timestamp(raw_row.get(src_resp_deadline_col)) if src_resp_deadline_col else None
        )

        src_resolved_col = canonical_to_source.get("resolved_at")
        resolved_at_dt = (
            parse_timestamp(raw_row.get(src_resolved_col)) if src_resolved_col else None
        )

        # Inconsistency: Deadline earlier than creation time
        if resolution_deadline_dt and created_at_dt and resolution_deadline_dt < created_at_dt:
            inconsistent_deadline_count += 1
            if len(validation_warnings) < max_reported_issues:
                validation_warnings.append({
                    "row": row_idx,
                    "field": "resolution_deadline",
                    "message": f"Resolution deadline ({resolution_deadline_dt}) is earlier than creation time ({created_at_dt}).",
                    "raw_value": raw_row.get(src_res_deadline_col),
                })

        if response_deadline_dt and created_at_dt and response_deadline_dt < created_at_dt:
            inconsistent_deadline_count += 1
            if len(validation_warnings) < max_reported_issues:
                validation_warnings.append({
                    "row": row_idx,
                    "field": "response_deadline",
                    "message": f"Response deadline ({response_deadline_dt}) is earlier than creation time ({created_at_dt}).",
                    "raw_value": raw_row.get(src_resp_deadline_col),
                })

        # 4. Durations
        resolution_duration: Optional[float] = None
        src_res_dur_col = canonical_to_source.get("resolution_duration")
        if src_res_dur_col and raw_row.get(src_res_dur_col) is not None:
            try:
                val = float(str(raw_row[src_res_dur_col]).strip())
                if val < 0:
                    if len(validation_warnings) < max_reported_issues:
                        validation_warnings.append({
                            "row": row_idx,
                            "field": "resolution_duration",
                            "message": f"Negative resolution duration ({val}) is impossible; set to None.",
                            "raw_value": raw_row.get(src_res_dur_col),
                        })
                else:
                    resolution_duration = val
            except (ValueError, TypeError):
                pass

        response_duration: Optional[float] = None
        src_resp_dur_col = canonical_to_source.get("response_duration")
        if src_resp_dur_col and raw_row.get(src_resp_dur_col) is not None:
            try:
                val = float(str(raw_row[src_resp_dur_col]).strip())
                if val < 0:
                    if len(validation_warnings) < max_reported_issues:
                        validation_warnings.append({
                            "row": row_idx,
                            "field": "response_duration",
                            "message": f"Negative response duration ({val}) is impossible; set to None.",
                            "raw_value": raw_row.get(src_resp_dur_col),
                        })
                else:
                    response_duration = val
            except (ValueError, TypeError):
                pass

        # 5. Status & Priority Normalization
        src_status_col = canonical_to_source.get("status")
        status_val = normalize_status(raw_row.get(src_status_col)) if src_status_col else "Open"

        src_priority_col = canonical_to_source.get("priority")
        priority_val, prio_warn = normalize_priority(raw_row.get(src_priority_col))
        if prio_warn and len(validation_warnings) < max_reported_issues:
            validation_warnings.append({
                "row": row_idx,
                "field": "priority",
                "message": prio_warn,
                "raw_value": raw_row.get(src_priority_col),
            })

        # 6. Team Assignment Validation
        assigned_team: Optional[str] = None
        src_team_col = canonical_to_source.get("assigned_team_id")
        if src_team_col:
            raw_team = raw_row.get(src_team_col)
            if raw_team and str(raw_team).strip():
                team_clean = str(raw_team).strip()
                assigned_team = team_clean
                if registered_team_ids and team_clean not in registered_team_ids:
                    if len(validation_warnings) < max_reported_issues:
                        validation_warnings.append({
                            "row": row_idx,
                            "field": "assigned_team_id",
                            "message": f"Assigned team '{team_clean}' is not in registered teams database.",
                            "raw_value": team_clean,
                        })

        # 7. Extract Source Metrics
        source_metrics: Dict[str, Any] = {}
        for metric_col in ["pending_hours", "deadline_hours_left", "pending_time"]:
            if metric_col in raw_row:
                try:
                    source_metrics[metric_col] = float(raw_row[metric_col])
                except (ValueError, TypeError):
                    source_metrics[metric_col] = raw_row[metric_col]

        # 8. Build Normalized Record
        title_val = None
        src_title_col = canonical_to_source.get("title")
        if src_title_col and raw_row.get(src_title_col):
            title_val = str(raw_row[src_title_col]).strip()

        desc_val = None
        src_desc_col = canonical_to_source.get("description")
        if src_desc_col and raw_row.get(src_desc_col):
            desc_val = str(raw_row[src_desc_col]).strip()

        cat_val = None
        src_cat_col = canonical_to_source.get("category")
        if src_cat_col and raw_row.get(src_cat_col):
            cat_val = str(raw_row[src_cat_col]).strip()

        record = {
            "source_ticket_id": ticket_id,
            "title": title_val,
            "description": desc_val,
            "category": cat_val,
            "status": status_val,
            "priority": priority_val,
            "created_at": created_at_dt,
            "response_deadline": response_deadline_dt,
            "resolution_deadline": resolution_deadline_dt,
            "resolved_at": resolved_at_dt,
            "resolution_duration": resolution_duration,
            "response_duration": response_duration,
            "assigned_team_id": assigned_team,
            "source_metrics": source_metrics,
            "original_values": dict(raw_row),  # Never lose raw source fields
            "is_valid": True,
        }
        accepted_records.append(record)

    # Coverage Notes & Limitations
    coverage_notes: List[str] = []
    if "assigned_team_id" not in canonical_to_source:
        coverage_notes.append("No assigned team field present in source dataset; tickets unassigned.")
    if "resolution_deadline" not in canonical_to_source and "response_deadline" not in canonical_to_source:
        coverage_notes.append("No SLA deadline columns mapped; SLA breach scoring will require default SLA limit.")
    if duplicate_count > 0:
        coverage_notes.append(f"{duplicate_count} duplicate ticket IDs were rejected per deterministic first-occurrence policy.")
    if inconsistent_deadline_count > 0:
        coverage_notes.append(f"{inconsistent_deadline_count} records had deadlines prior to creation timestamp.")

    summary_metrics = {
        "total_rows": len(raw_rows),
        "accepted_rows": len(accepted_records),
        "rejected_rows": len(raw_rows) - len(accepted_records),
        "warning_count": len(validation_warnings),
        "duplicate_count": duplicate_count,
        "missing_created_at_count": missing_created_at_count,
        "coverage_notes": coverage_notes,
    }

    return accepted_records, validation_errors, validation_warnings, summary_metrics

