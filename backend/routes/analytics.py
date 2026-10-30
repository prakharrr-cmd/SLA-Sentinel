"""API route for dataset-scoped analytics and performance metrics."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Dataset
from backend.schemas import DatasetAnalyticsResponse
from backend.analytics.service import calculate_dataset_analytics

router = APIRouter(prefix="/api/analytics", tags=["Dataset Analytics"])


@router.get(
    "/{dataset_id}",
    response_model=DatasetAnalyticsResponse,
    summary="Retrieve comprehensive operational analytics for an imported dataset",
)
def get_dataset_analytics_endpoint(
    dataset_id: str,
    reference_time: Optional[datetime] = Query(
        None,
        description="Optional ISO timestamp to evaluate SLA metrics against a fixed reference clock.",
    ),
    db: Session = Depends(get_db),
) -> DatasetAnalyticsResponse:
    """Retrieve verified operational analytics, ticket distributions, SLA performance,

    and defensible bottleneck metrics for a specific imported dataset.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' not found.",
        )

    return calculate_dataset_analytics(dataset, db, reference_time=reference_time)

