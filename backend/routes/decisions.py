"""API routes for persistent manager decisions and immutable audit trails."""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Dataset, ImportedTicket, ManagerDecision
from backend.schemas import DecisionCreate, DecisionResponse, PaginatedDecisionsResponse
from backend.engines.recommendations import generate_dataset_recommendations

router = APIRouter(tags=["Manager Decisions"])

VALID_DECISION_TYPES = {"approved", "rejected", "modified"}


@router.post(
    "/api/decisions",
    response_model=DecisionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an auditable manager decision for a recommendation",
)
def create_decision(
    payload: DecisionCreate,
    db: Session = Depends(get_db),
) -> DecisionResponse:
    """Record an approve, reject, or modify decision with immutable recommendation snapshot."""
    # 1. Validate dataset existence
    dataset = db.query(Dataset).filter(Dataset.id == payload.dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{payload.dataset_id}' not found.",
        )

    # 2. Validate ticket exists in this dataset
    ticket = (
        db.query(ImportedTicket)
        .filter(
            ImportedTicket.dataset_id == payload.dataset_id,
            ImportedTicket.source_ticket_id == payload.source_ticket_id,
        )
        .first()
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket '{payload.source_ticket_id}' not found in dataset '{payload.dataset_id}'.",
        )

    # 3. Validate cross-dataset reference
    rec_id = payload.recommendation_id.strip()
    if f":{payload.dataset_id}:" not in rec_id and not rec_id.startswith(f"{payload.dataset_id}:"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cross-dataset recommendation reference rejected: recommendation '{rec_id}' does not belong to dataset '{payload.dataset_id}'.",
        )

    # 4. Validate decision_type
    dec_type = payload.decision_type.lower().strip()
    if dec_type not in VALID_DECISION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid decision_type '{payload.decision_type}'. Must be one of: {sorted(VALID_DECISION_TYPES)}.",
        )

    # 5. Validate required reasons
    reason_clean = (payload.reason or "").strip()
    if dec_type in {"rejected", "modified"} and not reason_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Reason is required when decision_type is '{dec_type}'.",
        )

    # 6. Validate modified action
    if dec_type == "modified":
        if not payload.manager_action:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="manager_action is required when decision_type is 'modified'.",
            )

    # 7. Idempotency check
    if payload.idempotency_key:
        existing_idempotent = (
            db.query(ManagerDecision)
            .filter(
                ManagerDecision.dataset_id == payload.dataset_id,
                ManagerDecision.idempotency_key == payload.idempotency_key,
            )
            .first()
        )
        if existing_idempotent:
            return existing_idempotent

    # 8. Resolve original recommendation snapshot
    snapshot: Dict[str, Any] = payload.original_recommendation or {}
    if not snapshot:
        # Resolve target from recommendation_id
        target = "response_deadline" if "response_deadline" in rec_id else "resolution_deadline"
        recs = generate_dataset_recommendations(dataset, db, sla_target=target)
        found_rec = next((r for r in recs.items if r.ticket_id == payload.source_ticket_id), None)
        if found_rec:
            snapshot = found_rec.model_dump(mode="json")
        else:
            snapshot = {
                "id": rec_id,
                "dataset_id": payload.dataset_id,
                "ticket_id": payload.source_ticket_id,
                "recommendation_type": "review_assignment",
                "proposed_action": "Review ticket queue",
            }

    # 9. Handle revisions & previous effective decisions
    previous_decision = (
        db.query(ManagerDecision)
        .filter(
            ManagerDecision.dataset_id == payload.dataset_id,
            ManagerDecision.recommendation_id == rec_id,
            ManagerDecision.is_effective == True,
        )
        .first()
    )

    previous_id = None
    if previous_decision:
        previous_id = previous_decision.id
        previous_decision.is_effective = False
        db.add(previous_decision)

    # 10. Persist new decision record
    decision_id = f"dec_{uuid.uuid4().hex[:12]}"
    decision = ManagerDecision(
        id=decision_id,
        dataset_id=payload.dataset_id,
        recommendation_id=rec_id,
        source_ticket_id=payload.source_ticket_id,
        decision_type=dec_type,
        original_recommendation_snapshot=snapshot,
        manager_action=payload.manager_action,
        reason=reason_clean or None,
        manager_id=payload.manager_id or "unauthenticated_operator",
        created_at=datetime.now(timezone.utc),
        previous_decision_id=previous_id,
        is_effective=True,
        idempotency_key=payload.idempotency_key,
    )

    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision


@router.get(
    "/api/decisions/{decision_id}",
    response_model=DecisionResponse,
    summary="Retrieve a specific manager decision by ID",
)
def get_decision(
    decision_id: str,
    db: Session = Depends(get_db),
) -> DecisionResponse:
    """Retrieve decision details, manager reasoning, and immutable recommendation snapshot."""
    dec = db.query(ManagerDecision).filter(ManagerDecision.id == decision_id).first()
    if not dec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision '{decision_id}' not found.",
        )
    return dec


@router.get(
    "/api/recommendations/{recommendation_id:path}/decisions",
    response_model=List[DecisionResponse],
    summary="Retrieve audit decision history for a recommendation",
)
def get_recommendation_decisions(
    recommendation_id: str,
    db: Session = Depends(get_db),
) -> List[DecisionResponse]:
    """Retrieve append-only history of decisions for a specific recommendation, ordered chronologically."""
    return (
        db.query(ManagerDecision)
        .filter(ManagerDecision.recommendation_id == recommendation_id)
        .order_by(ManagerDecision.created_at.asc())
        .all()
    )


@router.get(
    "/api/datasets/{dataset_id}/decisions",
    response_model=PaginatedDecisionsResponse,
    summary="Retrieve paginated manager decisions for a dataset",
)
def get_dataset_decisions(
    dataset_id: str,
    is_effective_only: Optional[bool] = Query(None, description="If True, return only currently effective decisions."),
    decision_type: Optional[str] = Query(None, description="Filter by 'approved', 'rejected', or 'modified'."),
    source_ticket_id: Optional[str] = Query(None, description="Filter by ticket identifier."),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaginatedDecisionsResponse:
    """Retrieve audited manager decisions for a dataset with filtering and pagination."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found.",
        )

    query = db.query(ManagerDecision).filter(ManagerDecision.dataset_id == dataset_id)

    if is_effective_only is not None:
        query = query.filter(ManagerDecision.is_effective == is_effective_only)

    if decision_type:
        query = query.filter(ManagerDecision.decision_type == decision_type.lower().strip())

    if source_ticket_id:
        query = query.filter(ManagerDecision.source_ticket_id == source_ticket_id.strip())

    query = query.order_by(ManagerDecision.created_at.desc())

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    safe_page = max(1, page)
    offset = (safe_page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    return PaginatedDecisionsResponse(
        dataset_id=dataset_id,
        total=total,
        page=safe_page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )

