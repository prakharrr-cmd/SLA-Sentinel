"""API routes for outcome evaluation and SLA performance measurement."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Dataset, TrackedAction
from backend.schemas import DatasetEvaluationResponse, ActionEvaluationResponse
from backend.analytics.evaluations import (
    calculate_dataset_evaluation,
    evaluate_action_outcome,
)

router = APIRouter(tags=["Outcome Evaluation"])


@router.get(
    "/api/evaluations/{dataset_id}",
    response_model=DatasetEvaluationResponse,
    summary="Evaluate observed SLA performance metrics and baseline vs. post-action cohort comparison",
)
def get_dataset_evaluation(
    dataset_id: str,
    reference_time: Optional[datetime] = Query(
        None,
        description="Optional reference timestamp for time-relative evaluations (ISO format).",
    ),
    save_snapshot: bool = Query(
        True,
        description="Whether to record or update an evaluation snapshot in the database.",
    ),
    db: Session = Depends(get_db),
) -> DatasetEvaluationResponse:
    """Evaluate SLA performance for a dataset, establishing empirical baseline and post-action cohorts."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found.",
        )

    return calculate_dataset_evaluation(
        dataset=dataset,
        db=db,
        reference_time=reference_time,
        save_snapshot=save_snapshot,
    )


@router.get(
    "/api/evaluations/{dataset_id}/actions/{action_id}",
    response_model=ActionEvaluationResponse,
    summary="Evaluate individual operational action status against observed ticket outcome",
)
def get_action_evaluation(
    dataset_id: str,
    action_id: str,
    reference_time: Optional[datetime] = Query(
        None,
        description="Optional reference timestamp for SLA status calculation.",
    ),
    db: Session = Depends(get_db),
) -> ActionEvaluationResponse:
    """Evaluate specific action execution state against the ticket's observed outcome."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found.",
        )

    action = db.query(TrackedAction).filter(TrackedAction.id == action_id).first()
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action '{action_id}' not found.",
        )

    if action.dataset_id != dataset_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Action '{action_id}' belongs to dataset '{action.dataset_id}', not '{dataset_id}'.",
        )

    try:
        return evaluate_action_outcome(
            dataset_id=dataset_id,
            action_id=action_id,
            db=db,
            reference_time=reference_time,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

