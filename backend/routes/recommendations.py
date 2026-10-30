"""API route for dataset-scoped evidence-based recommendations."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Dataset
from backend.schemas import PaginatedRecommendationsResponse
from backend.engines.recommendations import generate_dataset_recommendations

router = APIRouter(prefix="/api/recommendations", tags=["Dataset Recommendations"])


@router.get(
    "/{dataset_id}",
    response_model=PaginatedRecommendationsResponse,
    summary="Retrieve evidence-backed operational recommendations for an imported dataset",
)
def get_dataset_recommendations_endpoint(
    dataset_id: str,
    target: str = Query(
        "resolution",
        description="Target SLA deadline: 'resolution' (default) or 'response'.",
    ),
    recommendation_type: Optional[str] = Query(
        None,
        description="Filter by type ('prioritize_ticket', 'reassign_ticket', 'review_assignment', 'monitor_ticket', 'insufficient_data').",
    ),
    risk_category: Optional[str] = Query(
        None,
        description="Filter by risk category ('Critical Risk', 'High Risk', 'Medium Risk', 'Low Risk', 'Unscorable').",
    ),
    evidence_strength: Optional[str] = Query(
        None,
        description="Filter by evidence strength ('high', 'medium', 'low', 'insufficient_data').",
    ),
    reference_time: Optional[datetime] = Query(
        None,
        description="Optional evaluation reference clock. Defaults to dataset snapshot time or current time.",
    ),
    page: int = Query(1, ge=1, description="Page number (1-indexed)."),
    page_size: int = Query(50, ge=1, le=200, description="Items per page."),
    db: Session = Depends(get_db),
) -> PaginatedRecommendationsResponse:
    """Generate deterministically ranked, evidence-backed operational recommendations

    for active tickets within the specified dataset.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' not found.",
        )

    t_clean = target.lower().strip()
    if "response" in t_clean:
        sla_target = "response_deadline"
    else:
        sla_target = "resolution_deadline"

    return generate_dataset_recommendations(
        dataset=dataset,
        db=db,
        sla_target=sla_target,
        recommendation_type_filter=recommendation_type,
        risk_category_filter=risk_category,
        evidence_strength_filter=evidence_strength,
        reference_time=reference_time,
        page=page,
        page_size=page_size,
    )

