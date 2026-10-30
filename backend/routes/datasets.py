"""FastAPI endpoints for dataset intake, preview, column mapping, validation, and retrieval."""

import math
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Dataset, ImportedTicket
from backend.schemas import (
    PreviewResponse,
    ImportRequest,
    ImportResponse,
    DatasetSummaryResponse,
    DatasetDetailResponse,
    PaginatedImportedTicketsResponse,
    ImportedTicketResponse,
)
from backend.ingestion.service import stage_preview_data, execute_import
from backend.ingestion.parsers import FileParsingError

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])


@router.post(
    "/preview",
    response_model=PreviewResponse,
    summary="Upload and preview a support ticket dataset (CSV / Excel / Pasted Text)",
)
async def preview_dataset(
    file: Optional[UploadFile] = File(None),
    csv_text: Optional[str] = Form(None),
    sheet_name: Optional[str] = Form(None),
):
    """Preview uploaded or pasted operational data without modifying the operational database.

    Infers column types, suggests canonical schema mappings, detects potential warnings,
    and returns a bounded sample of preview records.
    """
    if not file and not csv_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either an uploaded file (.csv or .xlsx) or raw csv_text must be provided.",
        )

    try:
        if file:
            content = await file.read()
            filename = file.filename or "uploaded_dataset.csv"
        else:
            content = csv_text.encode("utf-8")
            filename = "pasted_content.csv"

        preview = stage_preview_data(
            content=content,
            filename=filename,
            sheet_name=sheet_name,
        )
        return preview
    except FileParsingError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during preview generation: {str(exc)}",
        )


@router.post(
    "/import",
    response_model=ImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Confirm column mapping and commit validated dataset records",
)
def import_dataset(
    payload: ImportRequest,
    db: Session = Depends(get_db),
):
    """Commit a previewed dataset with confirmed column mappings into persistent storage.

    Executes schema normalization, row validation, duplicate handling, and stores
    normalized records with full audit report.
    """
    try:
        result = execute_import(
            db=db,
            mapping=payload.mapping,
            upload_id=payload.upload_id,
            csv_text=payload.csv_text,
            source_filename=payload.source_filename,
            dataset_name=payload.dataset_name,
            selected_sla_target=payload.selected_sla_target or "resolution_deadline",
        )
        return result
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during import execution: {str(exc)}",
        )


@router.get(
    "",
    response_model=List[DatasetSummaryResponse],
    summary="List all imported datasets and their validation summaries",
)
def list_datasets(db: Session = Depends(get_db)):
    """Retrieve metadata, creation dates, and status summaries for all persisted datasets."""
    datasets = db.query(Dataset).order_by(Dataset.created_at.desc()).all()
    return datasets


@router.get(
    "/{dataset_id}",
    response_model=DatasetDetailResponse,
    summary="Get details, column mappings, and quality report for a specific dataset",
)
def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """Retrieve comprehensive dataset record including applied mapping and validation diagnostics."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found.",
        )
    return dataset


@router.get(
    "/{dataset_id}/tickets",
    response_model=PaginatedImportedTicketsResponse,
    summary="Retrieve paginated normalized tickets for a specific dataset",
)
def get_dataset_tickets(
    dataset_id: str,
    page: int = Query(default=1, ge=1, description="Page number starting at 1"),
    page_size: int = Query(default=50, ge=1, le=500, description="Page size"),
    status_filter: Optional[str] = Query(default=None, alias="status", description="Filter by status"),
    db: Session = Depends(get_db),
):
    """Retrieve paginated canonical tickets from an ingested dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found.",
        )

    query = db.query(ImportedTicket).filter(ImportedTicket.dataset_id == dataset_id)
    if status_filter:
        query = query.filter(ImportedTicket.status == status_filter)

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(ImportedTicket.created_at.asc()).offset(offset).limit(page_size).all()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return {
        "dataset_id": dataset_id,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }

