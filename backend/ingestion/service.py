"""Staging, preview generation, and atomic persistence orchestration for datasets."""

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
from typing import Any, Dict, List, Optional, Set
import uuid

from sqlalchemy.orm import Session

from backend.models import Dataset, ImportedTicket, Team
from backend.ingestion.parsers import parse_raw_content, PREVIEW_SAMPLE_LIMIT
from backend.ingestion.canonical import suggest_canonical_mapping, CANONICAL_FIELDS
from backend.ingestion.validator import validate_and_normalize_dataset

STAGING_DIR = Path(tempfile.gettempdir()) / "sla_sentinel_staging"
STAGING_DIR.mkdir(parents=True, exist_ok=True)


def stage_preview_data(
    content: bytes,
    filename: str = "dataset.csv",
    sheet_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Parse raw content, infer schema, generate suggested mappings, and stage preview."""
    parsed = parse_raw_content(content, filename=filename, sheet_name=sheet_name)

    upload_id = uuid.uuid4().hex
    staging_file = STAGING_DIR / f"{upload_id}.json"

    columns = parsed["detected_columns"]
    suggested_mappings = suggest_canonical_mapping(columns)

    preview_rows = parsed["rows"][:PREVIEW_SAMPLE_LIMIT]

    # Check for critical warnings in preview
    warnings = list(parsed["warnings"])
    mapped_canonicals = {v for v in suggested_mappings.values() if v}
    if "ticket_id" not in mapped_canonicals:
        warnings.append("No source column could be automatically matched to required 'Ticket ID'. Please map manually.")
    if "created_at" not in mapped_canonicals:
        warnings.append("No source column matched 'Ticket Created At'. SLA evaluation requires a creation timestamp.")

    # Save to staging file for confirmation stage
    staging_payload = {
        "upload_id": upload_id,
        "filename": parsed["filename"],
        "file_format": parsed["file_format"],
        "detected_columns": columns,
        "inferred_types": parsed["inferred_types"],
        "suggested_mappings": suggested_mappings,
        "total_rows": parsed["total_rows"],
        "rows": parsed["rows"],  # Staged for immediate import
        "warnings": warnings,
        "sheet_names": parsed["sheet_names"],
        "selected_sheet": parsed["selected_sheet"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    with open(staging_file, "w", encoding="utf-8") as f:
        json.dump(staging_payload, f)

    return {
        "upload_id": upload_id,
        "filename": parsed["filename"],
        "file_format": parsed["file_format"],
        "detected_columns": columns,
        "headers": columns,
        "inferred_types": parsed["inferred_types"],
        "suggested_mappings": suggested_mappings,
        "total_rows": parsed["total_rows"],
        "row_count": parsed["total_rows"],
        "preview_rows": preview_rows,
        "warnings": warnings,
        "sheet_names": parsed["sheet_names"],
        "selected_sheet": parsed["selected_sheet"],
        "delimiter": parsed.get("delimiter", ","),
    }


def load_staged_dataset(upload_id: str) -> Dict[str, Any]:
    """Retrieve staged dataset from temporary storage."""
    staging_file = STAGING_DIR / f"{upload_id}.json"
    if not staging_file.exists():
        raise FileNotFoundError(f"Staged preview '{upload_id}' has expired or does not exist.")

    with open(staging_file, "r", encoding="utf-8") as f:
        return json.load(f)


def execute_import(
    db: Session,
    mapping: Dict[str, str],
    upload_id: Optional[str] = None,
    csv_text: Optional[str] = None,
    source_filename: Optional[str] = "uploaded_dataset.csv",
    dataset_name: Optional[str] = None,
    selected_sla_target: str = "resolution_deadline",
) -> Dict[str, Any]:
    """Execute complete dataset import, validate rows, and persist to database atomically.

    Raises ValueError if dataset is completely invalid.
    Rolls back transaction on any database error.
    """
    raw_rows: List[Dict[str, Any]] = []
    detected_columns: List[str] = []
    file_format = "csv"
    staged_filepath: Optional[Path] = None

    if upload_id:
        staged_data = load_staged_dataset(upload_id)
        raw_rows = staged_data["rows"]
        detected_columns = staged_data["detected_columns"]
        source_filename = staged_data["filename"]
        file_format = staged_data["file_format"]
        staged_filepath = STAGING_DIR / f"{upload_id}.json"
    elif csv_text:
        parsed = parse_raw_content(csv_text.encode("utf-8"), filename=source_filename or "pasted.csv")
        raw_rows = parsed["rows"]
        detected_columns = parsed["detected_columns"]
        file_format = parsed["file_format"]
    else:
        raise ValueError("Either upload_id from preview or csv_text must be provided.")

    if not raw_rows:
        raise ValueError("Cannot import an empty dataset.")

    # Retrieve registered teams for cross-referencing assigned squads
    registered_teams = db.query(Team.id).all()
    registered_team_ids = {t[0] for t in registered_teams}

    # Validate and normalize
    accepted, errors, warnings, summary = validate_and_normalize_dataset(
        raw_rows=raw_rows,
        mapping=mapping,
        registered_team_ids=registered_team_ids,
    )

    if not accepted:
        raise ValueError(
            f"Dataset failed validation: 0 of {len(raw_rows)} rows were accepted. "
            f"Top error: {errors[0]['message'] if errors else 'No valid records.'}"
        )

    dataset_id = f"ds_{uuid.uuid4().hex[:12]}"
    status = "completed" if len(accepted) == len(raw_rows) else "partial"

    # Atomic write to DB
    try:
        dataset_record = Dataset(
            id=dataset_id,
            name=dataset_name or source_filename or f"Import {dataset_id}",
            source_filename=source_filename or "dataset.csv",
            file_format=file_format,
            created_at=datetime.now(timezone.utc),
            snapshot_at=None,
            status=status,
            total_rows=len(raw_rows),
            accepted_rows=len(accepted),
            rejected_rows=len(raw_rows) - len(accepted),
            warning_count=len(warnings),
            applied_mapping=mapping,
            validation_summary={
                "metrics": summary,
                "errors": errors[:50],  # Bounded
                "warnings": warnings[:50],
                "selected_sla_target": selected_sla_target,
            },
        )
        db.add(dataset_record)

        # Batch insert tickets
        ticket_records: List[ImportedTicket] = []
        for rec in accepted:
            ticket = ImportedTicket(
                id=f"{dataset_id}:{rec['source_ticket_id']}",
                dataset_id=dataset_id,
                source_ticket_id=rec["source_ticket_id"],
                title=rec["title"],
                description=rec["description"],
                category=rec["category"],
                status=rec["status"],
                priority=rec["priority"],
                created_at=rec["created_at"],
                response_deadline=rec["response_deadline"],
                resolution_deadline=rec["resolution_deadline"],
                resolved_at=rec["resolved_at"],
                resolution_duration=rec["resolution_duration"],
                response_duration=rec["response_duration"],
                assigned_team_id=rec["assigned_team_id"],
                source_metrics=rec["source_metrics"],
                original_values=rec["original_values"],
                is_valid=rec["is_valid"],
            )
            ticket_records.append(ticket)

        db.add_all(ticket_records)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise RuntimeError(f"Database transaction failed during import persistence: {exc}")

    # Clean up staged file upon successful commit
    if staged_filepath and staged_filepath.exists():
        try:
            os.remove(staged_filepath)
        except OSError:
            pass

    # Build sample records response
    sample_records = [
        {
            "ticket_id": r["source_ticket_id"],
            "title": r["title"],
            "category": r["category"],
            "status": r["status"],
            "priority": r["priority"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "resolution_deadline": r["resolution_deadline"].isoformat() if r["resolution_deadline"] else None,
            "response_deadline": r["response_deadline"].isoformat() if r["response_deadline"] else None,
            "assigned_team_id": r["assigned_team_id"],
        }
        for r in accepted[:5]
    ]

    return {
        "dataset_id": dataset_id,
        "status": status,
        "total_rows": len(raw_rows),
        "accepted_rows": len(accepted),
        "rejected_rows": len(raw_rows) - len(accepted),
        "warning_count": len(warnings),
        "detected_columns": detected_columns,
        "applied_mapping": mapping,
        "validation_errors": errors[:50],
        "validation_warnings": warnings[:50],
        "sample_records": sample_records,
        "message": (
            f"Successfully imported {len(accepted)} of {len(raw_rows)} records into dataset '{dataset_id}' "
            f"({len(raw_rows) - len(accepted)} rejected)."
        ),
    }

