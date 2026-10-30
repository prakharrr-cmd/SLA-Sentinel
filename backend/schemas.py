"""Pydantic schemas for request and response validation."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TeamBase(BaseModel):
    id: str
    name: str
    skill_tags: List[str] = Field(default_factory=list)


class TeamCreate(TeamBase):
    pass


class TeamResponse(TeamBase):
    model_config = ConfigDict(from_attributes=True)


class TicketBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: str
    status: str = "Open"
    priority: Optional[str] = "Medium"
    created_at: Optional[datetime] = None
    sla_time_limit: float = 24.0


class TicketCreate(TicketBase):
    id: str


class TicketResponse(TicketBase):
    id: str
    assigned_team_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SLARiskResponse(BaseModel):
    ticket_id: str
    ratio: float
    percent_elapsed: float
    risk_level: str
    is_high_risk: bool
    breached: Optional[bool] = None


class AssignTeamResponse(BaseModel):
    ticket_id: str
    team_id: str
    team_name: str
    open_tickets: int
    matched_by: str


# -------------------------------------------------------------
# Dataset Ingestion & Validation Pipeline Schemas
# -------------------------------------------------------------

class PreviewResponse(BaseModel):
    """Schema returned after preliminary file inspection and schema inference."""
    upload_id: str
    filename: str
    file_format: str
    detected_columns: List[str]
    headers: Optional[List[str]] = None
    inferred_types: Dict[str, str]
    suggested_mappings: Dict[str, Optional[str]]
    total_rows: int
    row_count: Optional[int] = None
    preview_rows: List[Dict[str, Any]]
    warnings: List[str]
    sheet_names: Optional[List[str]] = None
    selected_sheet: Optional[str] = None
    delimiter: Optional[str] = ","


class ValidationErrorItem(BaseModel):
    """Granular row-level rejection detail."""
    row: int
    field: str
    message: str
    raw_value: Optional[Any] = None


class ValidationWarningItem(BaseModel):
    """Granular row-level non-blocking warning detail."""
    row: int
    field: str
    message: str
    raw_value: Optional[Any] = None


class ImportRequest(BaseModel):
    """Request payload to commit a previewed or pasted dataset with confirmed column mappings."""
    upload_id: Optional[str] = None
    csv_text: Optional[str] = None
    mapping: Dict[str, Optional[str]] = Field(
        ...,
        description="Mapping from source column name to canonical field name.",
    )
    dataset_name: Optional[str] = None
    source_filename: Optional[str] = "uploaded_dataset.csv"
    selected_sla_target: Optional[str] = Field(
        default="resolution_deadline",
        description="Target SLA deadline: 'resolution_deadline' (default) or 'response_deadline'.",
    )


class ImportResponse(BaseModel):
    """Execution summary and data quality report returned following dataset persistence."""
    dataset_id: str
    status: str  # "completed", "partial", "failed"
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    warning_count: int
    detected_columns: List[str]
    applied_mapping: Dict[str, Optional[str]]
    validation_errors: List[ValidationErrorItem]
    validation_warnings: List[ValidationWarningItem]
    sample_records: List[Dict[str, Any]]
    message: str


class DatasetSummaryResponse(BaseModel):
    """Compact summary of an ingested dataset."""
    id: str
    name: Optional[str] = None
    source_filename: str
    file_format: str
    created_at: datetime
    snapshot_at: Optional[datetime] = None
    status: str
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    warning_count: int

    model_config = ConfigDict(from_attributes=True)


class DatasetDetailResponse(DatasetSummaryResponse):
    """Detailed dataset metadata including applied mappings and validation report."""
    applied_mapping: Dict[str, Optional[str]] = Field(default_factory=dict)
    validation_summary: Dict[str, Any] = Field(default_factory=dict)


class ImportedTicketResponse(BaseModel):
    """Canonical representation of an imported support ticket."""
    id: str
    dataset_id: str
    source_ticket_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: str
    priority: str
    created_at: datetime
    response_deadline: Optional[datetime] = None
    resolution_deadline: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolution_duration: Optional[float] = None
    response_duration: Optional[float] = None
    assigned_team_id: Optional[str] = None
    source_metrics: Optional[Dict[str, Any]] = None
    original_values: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedImportedTicketsResponse(BaseModel):
    """Paginated collection of tickets for a specific dataset."""
    dataset_id: str
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[ImportedTicketResponse]


# ---------------------------------------------------------
# Task 2: Dataset Analytics & SLA Risk Schemas
# ---------------------------------------------------------

class DatasetSummaryMetrics(BaseModel):
    """High-level summary of the dataset and eligibility for calculations."""
    dataset_id: str
    dataset_name: Optional[str] = None
    created_at: datetime
    snapshot_at: Optional[datetime] = None
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    invalid_rows: int
    warning_count: int
    total_imported_tickets: int
    scorable_resolution_tickets: int
    scorable_response_tickets: int


class TicketDistribution(BaseModel):
    """Distribution breakdowns across status, priority, and lifecycle state."""
    by_status: Dict[str, int] = Field(default_factory=dict)
    by_priority: Dict[str, int] = Field(default_factory=dict)
    active_tickets_count: int
    historical_tickets_count: int
    unrecognized_status_count: int = 0
    unrecognized_priority_count: int = 0


class SLAPerformanceTarget(BaseModel):
    """Performance metrics for an independent SLA target (response or resolution)."""
    target_type: str  # "response" or "resolution"
    eligible_count: int
    coverage_rate: float
    missing_deadline_count: int
    active_eligible_count: int
    breached_count: int
    at_risk_count: int
    within_target_count: int
    historical_eligible_count: int
    historical_met_sla_count: Optional[int] = None
    historical_breached_count: Optional[int] = None
    historical_unverifiable_count: Optional[int] = None
    historical_attainment_rate: Optional[float] = None
    limitations: List[str] = Field(default_factory=list)


class SLAPerformance(BaseModel):
    """Independent SLA evaluation across response and resolution targets."""
    reference_time: datetime
    response_sla: SLAPerformanceTarget
    resolution_sla: SLAPerformanceTarget


class BottleneckItem(BaseModel):
    """Identified bottleneck or workload concentration metric."""
    dimension: str  # "category", "priority", "team", or "overdue"
    key: str
    ticket_count: int
    active_count: int
    breached_count: int
    breach_rate: Optional[float] = None
    evidence: str


class TrendsAndBottlenecks(BaseModel):
    """Evidence-backed operational bottlenecks and timestamp-derived workload trends."""
    category_workload: List[BottleneckItem] = Field(default_factory=list)
    priority_workload: List[BottleneckItem] = Field(default_factory=list)
    team_workload: List[BottleneckItem] = Field(default_factory=list)
    identified_bottlenecks: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)


class DatasetAnalyticsResponse(BaseModel):
    """Complete dataset-scoped analytics response."""
    dataset_summary: DatasetSummaryMetrics
    ticket_distribution: TicketDistribution
    sla_performance: SLAPerformance
    trends_and_bottlenecks: TrendsAndBottlenecks


class TicketRiskRecord(BaseModel):
    """Individually scored and ranked SLA risk record."""
    dataset_id: str
    ticket_id: str
    title: Optional[str] = None
    status: str
    priority: str
    created_at: Optional[datetime] = None
    sla_target: str  # "resolution_deadline" or "response_deadline"
    applicable_deadline: Optional[datetime] = None
    current_sla_state: str  # "Breached", "High Risk", "Within Target", "Met SLA", "Breached in Past", "Unscorable"
    risk_score: Optional[float] = None
    risk_category: str  # "Critical Risk", "High Risk", "Medium Risk", "Low Risk", "Resolved", "Unscorable"
    ratio: Optional[float] = None
    percent_elapsed: Optional[float] = None
    evidence: str
    coverage_warnings: List[str] = Field(default_factory=list)
    assigned_team_id: Optional[str] = None


class PaginatedRisksResponse(BaseModel):
    """Paginated collection of ranked ticket risk records."""
    dataset_id: str
    sla_target: str
    reference_time: datetime
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[TicketRiskRecord]


# ---------------------------------------------------------
# Task 3: Evidence-Based Recommendations Schemas
# ---------------------------------------------------------

class RecommendationItem(BaseModel):
    """Structured, evidence-backed operational recommendation for a ticket."""
    id: str  # Stable dataset-scoped identifier: e.g. "rec:{dataset_id}:{ticket_id}:{sla_target}"
    recommendation_id: Optional[str] = None
    dataset_id: str
    ticket_id: str
    ticket_title: Optional[str] = None
    status: str
    priority: str
    category: Optional[str] = None
    assigned_team_id: Optional[str] = None
    sla_target: str  # "resolution_deadline" or "response_deadline"
    risk_score: Optional[float] = None
    risk_category: str
    recommendation_type: str  # "prioritize_ticket", "review_assignment", "reassign_ticket", "monitor_ticket", "insufficient_data"
    proposed_action: str
    suggested_team_id: Optional[str] = None
    reason: str
    evidence: List[str] = Field(default_factory=list)
    evidence_strength: str  # "high", "medium", "low", "insufficient_data"
    limitations: List[str] = Field(default_factory=list)
    status_review: str = "pending_review"


class PaginatedRecommendationsResponse(BaseModel):
    """Paginated collection of evidence-backed recommendations."""
    dataset_id: str
    sla_target: str
    reference_time: datetime
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[RecommendationItem]


# ---------------------------------------------------------
# Task 4: Persistent Manager Decisions & Audit Schemas
# ---------------------------------------------------------

class DecisionCreate(BaseModel):
    """Manager decision payload to approve, reject, or modify a recommendation."""
    dataset_id: str = Field(..., description="Dataset ID the recommendation belongs to.")
    recommendation_id: str = Field(..., description="Stable recommendation identifier.")
    source_ticket_id: str = Field(..., description="Source ticket identifier.")
    decision_type: str = Field(..., description="'approved', 'rejected', or 'modified'.")
    reason: Optional[str] = Field(None, description="Explanation for decision. Required for 'rejected' and 'modified'.")
    manager_action: Optional[Dict[str, Any]] = Field(None, description="Revised action payload for 'modified' decisions.")
    manager_id: Optional[str] = Field("unauthenticated_operator", description="Identifier of the manager making the decision.")
    original_recommendation: Optional[Dict[str, Any]] = Field(None, description="Optional snapshot of reviewed recommendation.")
    idempotency_key: Optional[str] = Field(None, description="Optional client idempotency key to prevent double submissions.")


class DecisionResponse(BaseModel):
    """Auditable manager decision record with recommendation snapshot."""
    id: str
    dataset_id: str
    recommendation_id: str
    source_ticket_id: str
    decision_type: str
    original_recommendation_snapshot: Dict[str, Any]
    manager_action: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    manager_id: str
    created_at: datetime
    previous_decision_id: Optional[str] = None
    is_effective: bool
    idempotency_key: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedDecisionsResponse(BaseModel):
    """Paginated collection of manager decisions for audit and review."""
    dataset_id: str
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[DecisionResponse]


# ---------------------------------------------------------
# Task 5: Persistent Action Tracking & Lifecycle Schemas
# ---------------------------------------------------------

class ActionCreate(BaseModel):
    """Payload to create an operational action from an approved manager decision."""
    dataset_id: str = Field(..., description="Dataset ID the action belongs to.")
    decision_id: str = Field(..., description="Approved/modified manager decision ID.")
    actor_id: Optional[str] = Field("unauthenticated_operator", description="Actor creating the action.")
    notes: Optional[str] = Field(None, description="Optional creation notes.")


class ActionStatusUpdate(BaseModel):
    """Payload to transition an action status."""
    new_status: str = Field(..., description="Target status ('in_progress', 'completed', 'failed', 'cancelled').")
    reason: Optional[str] = Field(None, description="Required for 'failed' or 'cancelled' status.")
    actor_id: Optional[str] = Field("unauthenticated_operator", description="Actor performing the update.")


class ActionStatusHistoryResponse(BaseModel):
    """Append-only status transition history record."""
    id: str
    action_id: str
    previous_status: Optional[str] = None
    new_status: str
    change_timestamp: datetime
    reason: Optional[str] = None
    actor_id: str

    model_config = ConfigDict(from_attributes=True)


class ActionResponse(BaseModel):
    """Persistent tracked operational action."""
    id: str
    dataset_id: str
    decision_id: str
    recommendation_id: str
    source_ticket_id: str
    action_type: str
    action_payload: Dict[str, Any]
    current_status: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    reason: Optional[str] = None
    actor_id: str

    model_config = ConfigDict(from_attributes=True)


class PaginatedActionsResponse(BaseModel):
    """Paginated collection of tracked actions for a dataset."""
    dataset_id: str
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[ActionResponse]


# ---------------------------------------------------------
# Task 6: Outcome Evaluation & Performance Measurement Schemas
# ---------------------------------------------------------

class ActionSummaryMetrics(BaseModel):
    """Metrics tracking approved action volumes and execution completion rates."""
    total_approved_actions: int
    pending_actions: int
    in_progress_actions: int
    completed_actions: int
    failed_actions: int
    cancelled_actions: int
    action_completion_rate: float


class SLAMetricCohort(BaseModel):
    """SLA performance metrics for a specific observational evaluation window."""
    window_name: str  # "baseline" or "post_action"
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    ticket_sample_size: int
    eligible_count: int
    met_sla_count: int
    breached_sla_count: int
    compliance_rate: Optional[float] = None
    breach_rate: Optional[float] = None
    avg_duration_hours: Optional[float] = None
    active_high_risk_count: int


class MetricComparisonItem(BaseModel):
    """Side-by-side comparison of an SLA metric between baseline and post-action."""
    metric_name: str
    baseline_value: Optional[float] = None
    post_action_value: Optional[float] = None
    absolute_difference: Optional[float] = None
    relative_percent_change: Optional[float] = None
    interpretation: str


class TargetEvaluation(BaseModel):
    """Observational evaluation for a specific SLA target (resolution or response)."""
    target_type: str  # "resolution" or "response"
    baseline: SLAMetricCohort
    post_action: SLAMetricCohort
    comparisons: List[MetricComparisonItem] = Field(default_factory=list)
    data_coverage_rate: float
    limitations: List[str] = Field(default_factory=list)


class DatasetEvaluationResponse(BaseModel):
    """Complete dataset-level outcome evaluation response."""
    evaluation_id: str
    dataset_id: str
    dataset_name: Optional[str] = None
    generated_at: datetime
    reference_time: datetime
    action_summary: ActionSummaryMetrics
    resolution_sla_evaluation: TargetEvaluation
    response_sla_evaluation: TargetEvaluation
    observational_disclaimer: str
    limitations: List[str] = Field(default_factory=list)


class ActionEvaluationResponse(BaseModel):
    """Action-specific outcome evaluation record."""
    dataset_id: str
    action_id: str
    decision_id: str
    recommendation_id: str
    source_ticket_id: str
    action_type: str
    current_status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    sla_target: str
    is_action_completed: bool
    ticket_outcome_observed: bool
    ticket_outcome_state: str
    evidence: str
    limitations: List[str] = Field(default_factory=list)





