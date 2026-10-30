"""API route for dataset-scoped ranked SLA risk scoring."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Dataset
from backend.schemas import PaginatedRisksResponse
from backend.analytics.service import get_dataset_risks

router = APIRouter(prefix="/api/risks", tags=["Dataset SLA Risks"])


@router.get(
    "/{dataset_id}",
    response_model=PaginatedRisksResponse,
    summary="Retrieve deterministically ranked SLA risk records for an imported dataset",
)
def get_dataset_risks_endpoint(
    dataset_id: str,
    target: str = Query(
        "resolution",
        description="Target SLA deadline: 'resolution' (default) or 'response'.",
    ),
    status: Optional[str] = Query(
        None,
        description="Filter by ticket status (e.g. 'active', 'historical', 'Open', 'Pending', 'Resolved').",
    ),
    priority: Optional[str] = Query(
        None,
        description="Filter by priority (e.g. 'Critical', 'High', 'Medium', 'Low').",
    ),
    risk_level: Optional[str] = Query(
        None,
        description="Filter by risk category or state ('Critical Risk', 'High Risk', 'Medium Risk', 'Low Risk', 'Breached', 'Unscorable', 'Resolved').",
    ),
    reference_time: Optional[datetime] = Query(
        None,
        description="Optional evaluation reference clock. Defaults to dataset snapshot time or current time.",
    ),
    page: int = Query(1, ge=1, description="Page number (1-indexed)."),
    page_size: int = Query(50, ge=1, le=200, description="Items per page."),
    db: Session = Depends(get_db),
) -> PaginatedRisksResponse:
    """Evaluate and rank tickets in the specified dataset by SLA risk using real engine thresholds."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' not found.",
        )

    # Normalize target query param
    t_clean = target.lower().strip()
    if "response" in t_clean:
        sla_target = "response_deadline"
    else:
        sla_target = "resolution_deadline"

    return get_dataset_risks(
        dataset=dataset,
        db=db,
        sla_target=sla_target,
        status_filter=status,
        priority_filter=priority,
        risk_level_filter=risk_level,
        reference_time=reference_time,
        page=page,
        page_size=page_size,
    )

