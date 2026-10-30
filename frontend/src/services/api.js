/**
 * SLA Sentinel Frontend API Service
 * Handles live backend integration for dataset intake, analytics, and risk scoring.
 */

import { INITIAL_TEAMS, INITIAL_TICKETS } from '../data/mockData';

export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000',
  CURRENT_DATASET_ID: null,
};

let inMemoryTickets = [...INITIAL_TICKETS];
let inMemoryTeams = [...INITIAL_TEAMS];

export const opsApi = {
  /**
   * Preview a support ticket dataset via file upload or raw CSV text.
   */
  async previewDataset({ file, csvText, sheetName }) {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    } else if (csvText) {
      formData.append('csv_text', csvText);
    } else {
      throw new Error('Please select a file or enter CSV text.');
    }

    if (sheetName) {
      formData.append('sheet_name', sheetName);
    }

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/datasets/preview`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Preview failed with status ${res.status}`);
    }

    return await res.json();
  },

  /**
   * Commit a previewed dataset with confirmed column mappings.
   */
  async importDataset({ uploadId, csvText, mapping, datasetName, selectedSlaTarget = 'resolution_deadline' }) {
    const payload = {
      upload_id: uploadId || null,
      csv_text: csvText || null,
      mapping,
      dataset_name: datasetName || null,
      selected_sla_target: selectedSlaTarget,
    };

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/datasets/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Import failed with status ${res.status}`);
    }

    const data = await res.json();
    API_CONFIG.CURRENT_DATASET_ID = data.dataset_id;
    return data;
  },

  /**
   * Upload CSV with auto-mapping preview + import.
   */
  async uploadCsv(csvContent) {
    const preview = await this.previewDataset({ csvText: csvContent });
    const importResult = await this.importDataset({
      uploadId: preview.upload_id,
      mapping: preview.suggested_mappings,
      datasetName: preview.source_name || 'Uploaded Operations Dataset',
    });

    return {
      dataset_id: importResult.dataset_id,
      accepted_rows: importResult.accepted_rows,
      rejected_rows: importResult.rejected_rows,
      total_rows: importResult.total_rows,
      status: importResult.status,
    };
  },

  /**
   * List all ingested datasets.
   */
  async getDatasets() {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/datasets`);
    if (!res.ok) {
      throw new Error('Failed to retrieve datasets.');
    }
    return await res.json();
  },

  /**
   * Retrieve dataset details.
   */
  async getDatasetById(datasetId) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/datasets/${datasetId}`);
    if (!res.ok) {
      throw new Error(`Failed to load dataset ${datasetId}.`);
    }
    return await res.json();
  },

  /**
   * Retrieve normalized tickets for an imported dataset.
   */
  async getDatasetTickets(datasetId, { page = 1, pageSize = 100, status } = {}) {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (status) params.append('status', status);

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/datasets/${datasetId}/tickets?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load dataset tickets: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Retrieve dataset-scoped operational analytics and performance metrics.
   */
  async getDatasetAnalytics(datasetId, { referenceTime } = {}) {
    const params = new URLSearchParams();
    if (referenceTime) {
      params.append('reference_time', referenceTime);
    }
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/analytics/${datasetId}${query}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to load analytics for dataset ${datasetId}.`);
    }
    return await res.json();
  },

  /**
   * Retrieve dataset-scoped ranked SLA risk records.
   */
  async getDatasetRisks(datasetId, { target = 'resolution', status, priority, riskLevel, page = 1, pageSize = 50, referenceTime } = {}) {
    const params = new URLSearchParams({
      target,
      page: String(page),
      page_size: String(pageSize),
    });
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);
    if (riskLevel) params.append('risk_level', riskLevel);
    if (referenceTime) params.append('reference_time', referenceTime);

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/risks/${datasetId}?${params.toString()}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to load SLA risks for dataset ${datasetId}.`);
    }
    return await res.json();
  },

  /**
   * Retrieve dataset-scoped evidence-based operational recommendations.
   */
  async getDatasetRecommendations(datasetId, { target = 'resolution', recommendationType, riskCategory, evidenceStrength, page = 1, pageSize = 50, referenceTime } = {}) {
    const params = new URLSearchParams({
      target,
      page: String(page),
      page_size: String(pageSize),
    });
    if (recommendationType) params.append('recommendation_type', recommendationType);
    if (riskCategory) params.append('risk_category', riskCategory);
    if (evidenceStrength) params.append('evidence_strength', evidenceStrength);
    if (referenceTime) params.append('reference_time', referenceTime);

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/recommendations/${datasetId}?${params.toString()}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to load recommendations for dataset ${datasetId}.`);
    }
    return await res.json();
  },

  /**
   * Record a manager decision (approve, reject, modify) with recommendation snapshot.
   */
  async recordDecision({
    datasetId,
    recommendationId,
    sourceTicketId,
    decisionType,
    reason,
    managerAction,
    managerId = 'unauthenticated_operator',
    originalRecommendation,
    idempotencyKey,
  }) {
    const payload = {
      dataset_id: datasetId,
      recommendation_id: recommendationId,
      source_ticket_id: sourceTicketId,
      decision_type: decisionType,
      reason: reason || null,
      manager_action: managerAction || null,
      manager_id: managerId,
      original_recommendation: originalRecommendation || null,
      idempotency_key: idempotencyKey || null,
    };

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Decision failed with status ${res.status}`);
    }
    return await res.json();
  },

  /**
   * Retrieve single manager decision by ID.
   */
  async getDecision(decisionId) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/decisions/${decisionId}`);
    if (!res.ok) {
      throw new Error(`Failed to load decision ${decisionId}.`);
    }
    return await res.json();
  },

  /**
   * Retrieve audit decision history for a recommendation.
   */
  async getRecommendationDecisions(recommendationId) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/recommendations/${encodeURIComponent(recommendationId)}/decisions`);
    if (!res.ok) {
      throw new Error(`Failed to load decision history for recommendation.`);
    }
    return await res.json();
  },

  /**
   * Retrieve paginated decisions for a dataset.
   */
  async getDatasetDecisions(datasetId, { isEffectiveOnly, decisionType, sourceTicketId, page = 1, pageSize = 50 } = {}) {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (isEffectiveOnly !== undefined && isEffectiveOnly !== null) params.append('is_effective_only', String(isEffectiveOnly));
    if (decisionType) params.append('decision_type', decisionType);
    if (sourceTicketId) params.append('source_ticket_id', sourceTicketId);

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/datasets/${datasetId}/decisions?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load dataset decisions.`);
    }
    return await res.json();
  },

  /**
   * Create an operational action from an approved manager decision.
   */
  async createAction({ datasetId, decisionId, actorId = 'unauthenticated_operator', notes }) {
    const payload = {
      dataset_id: datasetId,
      decision_id: decisionId,
      actor_id: actorId,
      notes: notes || null,
    };

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to create action for decision ${decisionId}`);
    }
    return await res.json();
  },

  /**
   * Retrieve single action by ID.
   */
  async getAction(actionId) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/actions/${actionId}`);
    if (!res.ok) {
      throw new Error(`Failed to load action ${actionId}.`);
    }
    return await res.json();
  },

  /**
   * Retrieve tracked actions for a dataset.
   */
  async getDatasetActions(datasetId, { status, sourceTicketId, page = 1, pageSize = 50 } = {}) {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (status) params.append('status', status);
    if (sourceTicketId) params.append('source_ticket_id', sourceTicketId);

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/datasets/${datasetId}/actions?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load dataset actions.`);
    }
    return await res.json();
  },

  /**
   * Transition action status (in_progress, completed, failed, cancelled).
   */
  async updateActionStatus(actionId, { newStatus, reason, actorId = 'unauthenticated_operator' }) {
    const payload = {
      new_status: newStatus,
      reason: reason || null,
      actor_id: actorId,
    };

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/actions/${actionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to update action status to ${newStatus}`);
    }
    return await res.json();
  },

  /**
   * Retrieve append-only status transition history for an action.
   */
  async getActionHistory(actionId) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/actions/${actionId}/history`);
    if (!res.ok) {
      throw new Error(`Failed to load history for action ${actionId}.`);
    }
    return await res.json();
  },

  /**
   * Retrieve outcome evaluation metrics and baseline vs post-action cohorts for a dataset.
   */
  async getDatasetEvaluation(datasetId, { referenceTime, saveSnapshot = true } = {}) {
    const params = new URLSearchParams();
    if (referenceTime) params.append('reference_time', referenceTime);
    if (saveSnapshot !== undefined && saveSnapshot !== null) params.append('save_snapshot', String(saveSnapshot));

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/evaluations/${datasetId}?${params.toString()}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to load evaluation for dataset ${datasetId}`);
    }
    return await res.json();
  },

  /**
   * Retrieve evaluation for an individual action against its observed ticket outcome.
   */
  async getActionEvaluation(datasetId, actionId, { referenceTime } = {}) {
    const params = new URLSearchParams();
    if (referenceTime) params.append('reference_time', referenceTime);

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/evaluations/${datasetId}/actions/${actionId}?${params.toString()}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to load evaluation for action ${actionId}`);
    }
    return await res.json();
  },

  /**
   * Retrieve squads / teams from live backend or local initial fallback.
   */
  async getTeams() {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/teams`);
      if (res.ok) {
        const liveTeams = await res.json();
        if (Array.isArray(liveTeams) && liveTeams.length > 0) {
          return liveTeams.map(lt => ({
            id: lt.id,
            name: lt.name,
            skills: lt.skill_tags || [],
            activeTickets: 0,
            maxCapacity: 10,
            lead: 'Assigned Lead',
          }));
        }
      }
    } catch (e) {
      // Fall through to initial teams
    }
    return inMemoryTeams;
  },

  /**
   * Reassign a ticket to a squad.
   */
  async reassignTicket(ticketId, targetTeamId) {
    const ticket = inMemoryTickets.find(t => t.id === ticketId);
    if (ticket) {
      ticket.assignedTeamId = targetTeamId;
    }
    return { success: true, ticketId, targetTeamId };
  },

  /**
   * Escalate ticket.
   */
  async escalateTicket(ticketId) {
    const ticket = inMemoryTickets.find(t => t.id === ticketId);
    if (ticket) {
      ticket.status = 'Escalated';
      ticket.riskScore = Math.min(99, ticket.riskScore + 10);
      ticket.riskLevel = 'High';
    }
    return { success: true, ticketId };
  },

  /**
   * Baseline demo KPIs.
   */
  async getKpis() {
    const total = inMemoryTickets.length;
    const highRisk = inMemoryTickets.filter(t => t.riskLevel === 'High' && t.status !== 'Resolved').length;
    const breached = inMemoryTickets.filter(t => t.deadlineHoursLeft <= 0 && t.status !== 'Resolved').length;
    const overloaded = inMemoryTeams.filter(t => t.activeTickets / t.maxCapacity >= 0.8).length;

    return {
      totalTickets: total,
      highRiskTickets: highRisk,
      slaBreached: breached,
      overloadedTeams: overloaded,
      avgPendingTimeHours: 4.2,
      riskDistribution: {
        high: highRisk,
        medium: inMemoryTickets.filter(t => t.riskLevel === 'Medium').length,
        low: inMemoryTickets.filter(t => t.riskLevel === 'Low').length,
      },
    };
  },

  /**
   * Baseline demo tickets list.
   */
  async getTickets(filters = {}) {
    let result = [...inMemoryTickets];
    if (filters.category && filters.category !== 'All') {
      result = result.filter(t => t.category === filters.category);
    }
    if (filters.team && filters.team !== 'All') {
      result = result.filter(t => t.assignedTeamId === filters.team);
    }
    if (filters.riskLevel && filters.riskLevel !== 'All') {
      result = result.filter(t => t.riskLevel === filters.riskLevel);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(t =>
        t.id.toLowerCase().includes(q) ||
        (t.problem && t.problem.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }
    return result;
  },

  /**
   * Reset demo data.
   */
  resetMockData() {
    inMemoryTickets = [...INITIAL_TICKETS];
    inMemoryTeams = [...INITIAL_TEAMS];
    API_CONFIG.CURRENT_DATASET_ID = null;
  },

  /**
   * Live Simulation APIs
   */
  async getSimulationStatus() {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/status`);
    if (!res.ok) throw new Error('Failed to fetch simulation status');
    return await res.json();
  },

  async startSimulation() {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/start`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to start simulation');
    return await res.json();
  },

  async pauseSimulation() {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/pause`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to pause simulation');
    return await res.json();
  },

  async resumeSimulation() {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/resume`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to resume simulation');
    return await res.json();
  },

  async stopSimulation() {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/stop`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to stop simulation');
    return await res.json();
  },

  async stepSimulation() {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/step`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to step simulation');
    return await res.json();
  },

  async setSimulationSpeed(speed, intervalSeconds) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed, interval_seconds: intervalSeconds }),
    });
    if (!res.ok) throw new Error('Failed to adjust simulation speed');
    return await res.json();
  },

  async resetSimulation() {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/reset`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset simulation');
    return await res.json();
  },

  async getSimulationEvents(limit = 30) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/events?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to retrieve simulation events');
    return await res.json();
  },

  /**
   * Business Configuration APIs
   */
  async getConfigSummary() {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/config/summary`);
    if (!res.ok) throw new Error('Failed to retrieve configuration summary');
    return await res.json();
  },

  async updateSLAPolicy(policyId, targetHours, description) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/config/sla-policy/${policyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_hours: targetHours, description }),
    });
    if (!res.ok) throw new Error('Failed to update SLA policy');
    return await res.json();
  },

  async updateTeamCapacity(teamId, maxActiveTickets) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/config/team-capacity/${teamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_active_tickets: maxActiveTickets, warning_threshold: 0.8, critical_threshold: 1.0 }),
    });
    if (!res.ok) throw new Error('Failed to update team capacity');
    return await res.json();
  },
};

