"""API routes for persistent action tracking, lifecycle transitions, and status audit history."""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Dataset, ManagerDecision, TrackedAction, ActionStatusHistory
from backend.schemas import (
    ActionCreate,
    ActionResponse,
    ActionStatusUpdate,
    ActionStatusHistoryResponse,
    PaginatedActionsResponse,
)

router = APIRouter(tags=["Action Tracking"])

ALLOWED_TRANSITIONS = {
    "pending": {"in_progress", "cancelled"},
    "in_progress": {"completed", "failed", "cancelled"},
    "completed": set(),
    "failed": set(),
    "cancelled": set(),
}


@router.post(
    "/api/actions",
    response_model=ActionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a persistent operational action from an approved manager decision",
)
def create_action(
    payload: ActionCreate,
    db: Session = Depends(get_db),
) -> ActionResponse:
    """Create a tracked operational action from an approved or modified manager decision."""
    # 1. Validate dataset existence
    dataset = db.query(Dataset).filter(Dataset.id == payload.dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{payload.dataset_id}' not found.",
        )

    # 2. Validate decision existence
    decision = db.query(ManagerDecision).filter(ManagerDecision.id == payload.decision_id).first()
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manager decision '{payload.decision_id}' not found.",
        )

    # 3. Cross-dataset validation
    if decision.dataset_id != payload.dataset_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cross-dataset action reference rejected: decision '{decision.id}' belongs to dataset '{decision.dataset_id}', not '{payload.dataset_id}'.",
        )

    # 4. Reject creation for rejected or non-effective decisions
    if decision.decision_type == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create an executable action from a rejected decision ('{decision.id}').",
        )

    if not decision.is_effective:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create action from decision '{decision.id}' because it has been superseded by a later revision.",
        )

    # 5. Prevent duplicate action creation for the same decision
    existing_action = db.query(TrackedAction).filter(TrackedAction.decision_id == payload.decision_id).first()
    if existing_action:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An operational action ('{existing_action.id}') already exists for decision '{payload.decision_id}'.",
        )

    # 6. Resolve action payload
    if decision.decision_type == "modified":
        action_payload = decision.manager_action or {}
        action_type = (
            action_payload.get("action")
            or decision.original_recommendation_snapshot.get("recommendation_type")
            or "modified_action"
        )
    else:  # approved
        orig = decision.original_recommendation_snapshot or {}
        action_type = orig.get("recommendation_type") or "approved_action"
        action_payload = {
            "action_type": action_type,
            "proposed_action": orig.get("proposed_action"),
            "suggested_team_id": orig.get("suggested_team_id"),
            "sla_target": orig.get("sla_target"),
            "risk_score": orig.get("risk_score"),
            "approval_reason": decision.reason,
            "notes": payload.notes,
        }

    now = datetime.now(timezone.utc)
    action_id = f"act_{uuid.uuid4().hex[:12]}"

    action = TrackedAction(
        id=action_id,
        dataset_id=payload.dataset_id,
        decision_id=decision.id,
        recommendation_id=decision.recommendation_id,
        source_ticket_id=decision.source_ticket_id,
        action_type=action_type,
        action_payload=action_payload,
        current_status="pending",
        created_at=now,
        updated_at=now,
        completed_at=None,
        reason=payload.notes,
        actor_id=payload.actor_id or "unauthenticated_operator",
    )

    # Append initial history record
    initial_history = ActionStatusHistory(
        id=f"act_hist_{uuid.uuid4().hex[:12]}",
        action_id=action_id,
        previous_status=None,
        new_status="pending",
        change_timestamp=now,
        reason="Initial action creation from manager decision",
        actor_id=payload.actor_id or "unauthenticated_operator",
    )

    db.add(action)
    db.add(initial_history)
    db.commit()
    db.refresh(action)

    return action


@router.get(
    "/api/actions/{action_id}",
    response_model=ActionResponse,
    summary="Retrieve an operational action and its current status",
)
def get_action(
    action_id: str,
    db: Session = Depends(get_db),
) -> ActionResponse:
    """Retrieve detailed state and payload for a specific operational action."""
    action = db.query(TrackedAction).filter(TrackedAction.id == action_id).first()
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action '{action_id}' not found.",
        )
    return action


@router.get(
    "/api/datasets/{dataset_id}/actions",
    response_model=PaginatedActionsResponse,
    summary="Retrieve paginated operational actions for a dataset",
)
def get_dataset_actions(
    dataset_id: str,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status ('pending', 'in_progress', 'completed', 'failed', 'cancelled')."),
    source_ticket_id: Optional[str] = Query(None, description="Filter by source ticket ID."),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaginatedActionsResponse:
    """Retrieve all tracked actions for a dataset with filtering and pagination."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found.",
        )

    query = db.query(TrackedAction).filter(TrackedAction.dataset_id == dataset_id)

    if status_filter:
        query = query.filter(TrackedAction.current_status == status_filter.lower().strip())

    if source_ticket_id:
        query = query.filter(TrackedAction.source_ticket_id == source_ticket_id.strip())

    query = query.order_by(TrackedAction.created_at.desc())

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    safe_page = max(1, page)
    offset = (safe_page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    return PaginatedActionsResponse(
        dataset_id=dataset_id,
        total=total,
        page=safe_page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )


@router.patch(
    "/api/actions/{action_id}/status",
    response_model=ActionResponse,
    summary="Transition action status and append an immutable audit history record",
)
def update_action_status(
    action_id: str,
    payload: ActionStatusUpdate,
    db: Session = Depends(get_db),
) -> ActionResponse:
    """Transition action status following strict lifecycle rules."""
    action = db.query(TrackedAction).filter(TrackedAction.id == action_id).first()
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action '{action_id}' not found.",
        )

    target_status = payload.new_status.lower().strip()
    current_status = action.current_status.lower().strip()

    # 1. Validate status transition
    valid_targets = ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status not in valid_targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid status transition from '{current_status}' to '{target_status}'. "
                f"Allowed transitions from '{current_status}': {sorted(valid_targets) if valid_targets else 'None (terminal state)'}."
            ),
        )

    # 2. Reason validation for failed/cancelled
    reason_clean = (payload.reason or "").strip()
    if target_status in {"failed", "cancelled"} and not reason_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Reason is required when transitioning status to '{target_status}'.",
        )

    # 3. Apply state change
    now = datetime.now(timezone.utc)
    action.current_status = target_status
    action.updated_at = now

    if target_status == "completed":
        action.completed_at = now
    else:
        action.completed_at = None

    if reason_clean:
        action.reason = reason_clean

    if payload.actor_id:
        action.actor_id = payload.actor_id

    # 4. Append audit history record in same transaction
    history_entry = ActionStatusHistory(
        id=f"act_hist_{uuid.uuid4().hex[:12]}",
        action_id=action.id,
        previous_status=current_status,
        new_status=target_status,
        change_timestamp=now,
        reason=reason_clean or None,
        actor_id=payload.actor_id or "unauthenticated_operator",
    )

    db.add(action)
    db.add(history_entry)
    db.commit()
    db.refresh(action)

    return action


@router.get(
    "/api/actions/{action_id}/history",
    response_model=List[ActionStatusHistoryResponse],
    summary="Retrieve chronological status audit history for an operational action",
)
def get_action_history(
    action_id: str,
    db: Session = Depends(get_db),
) -> List[ActionStatusHistoryResponse]:
    """Retrieve append-only history of status transitions for an action in chronological order."""
    action = db.query(TrackedAction).filter(TrackedAction.id == action_id).first()
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action '{action_id}' not found.",
        )

    return (
        db.query(ActionStatusHistory)
        .filter(ActionStatusHistory.action_id == action_id)
        .order_by(ActionStatusHistory.change_timestamp.asc())
        .all()
    )

