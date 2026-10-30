import React, { useState, useEffect } from 'react';
import { Check, X, Edit3, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import { opsApi } from '../services/api';

export default function RecommendationCards({
  datasetId,
  selectedSlaTarget = 'resolution_deadline',
  teams = [],
  onActionCreated,
  onToast,
  // Demo mode fallbacks
  demoTickets = [],
  onDemoApprove,
  onDemoReject,
  onDemoSelectTicket,
}) {
  const [recommendations, setRecommendations] = useState([]);
  const [decisionsMap, setDecisionsMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals / Prompts
  const [rejectPrompt, setRejectPrompt] = useState(null); // rec item
  const [rejectReason, setRejectReason] = useState('');

  const [modifyPrompt, setModifyPrompt] = useState(null); // rec item
  const [modifiedTeamId, setModifiedTeamId] = useState('');
  const [modifiedInstructions, setModifiedInstructions] = useState('');
  const [modifyReason, setModifyReason] = useState('');

  const [historyModalRec, setHistoryModalRec] = useState(null); // { rec, historyEntries }
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchLiveRecommendations = async () => {
    if (!datasetId) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const targetParam = selectedSlaTarget === 'response_deadline' ? 'response' : 'resolution';
      const [recsRes, decisionsRes] = await Promise.all([
        opsApi.getDatasetRecommendations(datasetId, {
          target: targetParam,
          page: 1,
          pageSize: 50,
        }),
        opsApi.getDatasetDecisions(datasetId, { page: 1, pageSize: 100 }),
      ]);

      setRecommendations(recsRes.items || []);

      // Build decisions lookup map
      const dMap = {};
      (decisionsRes.items || []).forEach((dec) => {
        if (!dMap[dec.recommendation_id]) {
          dMap[dec.recommendation_id] = dec;
        }
      });
      setDecisionsMap(dMap);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to fetch recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveRecommendations();
  }, [datasetId, selectedSlaTarget]);

  // Handle Approve Recommendation
  const handleApprove = async (rec) => {
    try {
      await opsApi.recordDecision({
        recommendationId: rec.id,
        decisionType: 'approved',
        reason: 'Manager verified deterministic SLA risk calculation and accepted proposed prescriptive action.',
        managerId: 'operations_manager',
      });
      if (onToast) onToast(`Recommendation for ${rec.ticket_id} approved`);
      await fetchLiveRecommendations();
      if (onActionCreated) onActionCreated();
    } catch (err) {
      if (onToast) onToast(`Error recording decision: ${err.message}`);
    }
  };

  // Handle Reject Prompt
  const handleConfirmReject = async () => {
    if (!rejectPrompt || !rejectReason.trim()) return;

    try {
      await opsApi.recordDecision({
        recommendationId: rejectPrompt.id,
        decisionType: 'rejected',
        reason: rejectReason.trim(),
        managerId: 'operations_manager',
      });
      if (onToast) onToast(`Recommendation for ${rejectPrompt.ticket_id} rejected with recorded rationale`);
      setRejectPrompt(null);
      setRejectReason('');
      await fetchLiveRecommendations();
      if (onActionCreated) onActionCreated();
    } catch (err) {
      if (onToast) onToast(`Error recording rejection: ${err.message}`);
    }
  };

  // Handle Modify Prompt
  const handleConfirmModify = async () => {
    if (!modifyPrompt || !modifyReason.trim()) return;

    try {
      const managerAction = {};
      if (modifiedTeamId) managerAction.suggested_team_id = modifiedTeamId;
      if (modifiedInstructions.trim()) managerAction.instructions = modifiedInstructions.trim();

      await opsApi.recordDecision({
        recommendationId: modifyPrompt.id,
        decisionType: 'modified',
        reason: modifyReason.trim(),
        managerId: 'operations_manager',
        managerAction: Object.keys(managerAction).length > 0 ? managerAction : undefined,
      });

      if (onToast) onToast(`Recommendation for ${modifyPrompt.ticket_id} modified and action scheduled`);
      setModifyPrompt(null);
      setModifiedTeamId('');
      setModifiedInstructions('');
      setModifyReason('');
      await fetchLiveRecommendations();
      if (onActionCreated) onActionCreated();
    } catch (err) {
      if (onToast) onToast(`Error recording modified decision: ${err.message}`);
    }
  };

  // Handle View History
  const handleOpenHistory = async (rec) => {
    setHistoryLoading(true);
    setHistoryModalRec({ rec, historyEntries: [] });
    try {
      const history = await opsApi.getRecommendationDecisions(rec.id);
      setHistoryModalRec({ rec, historyEntries: history });
    } catch (err) {
      if (onToast) onToast(`Failed to load history: ${err.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Helper formatting badges
  const getStrengthBadge = (strength) => {
    switch (strength) {
      case 'High':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-[#667873] border-slate-200';
    }
  };

  const getRiskBadge = (category) => {
    switch (category) {
      case 'Critical Risk':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
      case 'High Risk':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Medium Risk':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-50 text-[#667873] border-slate-200';
    }
  };

  // ==========================================
  // RENDER LIVE DATASET RECOMMENDATIONS
  // ==========================================
  if (datasetId) {
    if (isLoading) {
      return (
        <div className="bg-white rounded-xl border border-[#E2EAE5] p-6 mb-6 text-center text-xs text-[#667873] font-mono shadow-xs">
          Evaluating SLA risk evidence &amp; generating prescriptive recommendations...
        </div>
      );
    }

    if (errorMsg) {
      return (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 mb-6 text-xs">
          <strong>Recommendation Engine Notice:</strong> {errorMsg}
        </div>
      );
    }

    if (recommendations.length === 0) {
      return (
        <div className="bg-white rounded-xl border border-[#E2EAE5] p-5 mb-6 flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 bg-[#DCE9E1] text-[#145C43] rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[#145C43]" />
            </div>
            <div>
              <div className="font-semibold text-[#172B28] text-xs">Queue Operations Balanced</div>
              <div className="text-[#667873] text-[11px] mt-0.5">
                No impending SLA breaches require immediate managerial intervention under current squad workload.
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#172B28]">
              Prescriptive Interventions Pending Review
            </h2>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {recommendations.length} pending
            </span>
          </div>
          <span className="text-[11px] text-[#667873] font-mono">
            Target Policy: <strong className="text-[#172B28]">{selectedSlaTarget === 'response_deadline' ? 'Response SLA' : 'Resolution SLA'}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.slice(0, 4).map((rec) => {
            const existingDecision = decisionsMap[rec.id];
            const isApproved = existingDecision?.decision_type === 'approved';
            const isRejected = existingDecision?.decision_type === 'rejected';
            const isModified = existingDecision?.decision_type === 'modified';

            return (
              <div
                key={rec.id}
                className="bg-white rounded-xl border border-[#E2EAE5] p-5 flex flex-col justify-between text-xs space-y-3.5 shadow-xs transition hover:border-[#145C43]/40"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-semibold text-xs text-[#172B28] px-2 py-0.5 rounded bg-[#F4F7F5] border border-[#E2EAE5]">
                        {rec.ticket_id}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getRiskBadge(rec.risk_category)}`}>
                        {rec.risk_category} ({Math.round(rec.risk_score)}/100)
                      </span>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getStrengthBadge(rec.evidence_strength)}`}>
                      Evidence: {rec.evidence_strength}
                    </span>
                  </div>

                  {/* Recommendation Type & Proposed Action */}
                  <div className="mt-2.5">
                    <div className="text-[10px] uppercase font-semibold text-[#667873]">
                      Type: {rec.recommendation_type.replace(/_/g, ' ')}
                    </div>
                    <h3 className="text-sm font-semibold text-[#172B28] mt-0.5 leading-snug">
                      {rec.proposed_action}
                    </h3>
                  </div>

                  {/* Reason & Evidence Box */}
                  <div className="bg-[#F4F7F5] rounded-lg border border-[#E2EAE5] p-3 text-xs text-[#172B28] mt-3 space-y-2">
                    <p className="leading-relaxed text-[#172B28]">
                      {rec.reason}
                    </p>

                    {rec.evidence_factors && rec.evidence_factors.length > 0 && (
                      <div className="pt-2 border-t border-[#E2EAE5] space-y-1">
                        <div className="text-[10px] uppercase font-semibold text-[#667873]">
                          Supporting Evidence Factors:
                        </div>
                        <ul className="list-disc list-inside text-[11px] text-[#667873] space-y-0.5">
                          {rec.evidence_factors.map((f, idx) => (
                            <li key={idx}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Data Limitations */}
                    {rec.limitations && rec.limitations.length > 0 && (
                      <div className="pt-2 border-t border-[#E2EAE5] text-[10px] text-amber-800 font-mono">
                        <span className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> Notice:</span> {rec.limitations.join('; ')}
                      </div>
                    )}
                  </div>

                  {/* Decision Badge if already recorded */}
                  {existingDecision && (
                    <div className={`mt-3 p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      isApproved ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' :
                      isRejected ? 'bg-rose-50/80 border-rose-200 text-rose-900' :
                      'bg-sky-50/80 border-sky-200 text-sky-900'
                    }`}>
                      <div>
                        <strong className="uppercase font-semibold">Decision: {existingDecision.decision_type}</strong>
                        <div className="text-[11px] text-[#667873] mt-0.5">Reason: {existingDecision.reason || 'None specified'}</div>
                        {isModified && existingDecision.manager_action && (
                          <div className="text-[11px] mt-1 pt-1 border-t border-sky-200 text-sky-800">
                            Modified Action: Squad {existingDecision.manager_action.suggested_team_id || 'N/A'}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-[#667873] font-mono">
                        {new Date(existingDecision.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Controls */}
                <div className="pt-3 border-t border-[#E2EAE5] flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenHistory(rec)}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-[#667873] hover:text-[#172B28] border border-[#E2EAE5] bg-white hover:bg-[#F4F7F5] transition cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 inline mr-1" />Audit Trail
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setRejectPrompt(rec)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 inline mr-1" />Reject
                    </button>

                    <button
                      onClick={() => {
                        setModifyPrompt(rec);
                        setModifiedTeamId(rec.suggested_team_id || '');
                        setModifiedInstructions('');
                        setModifyReason('');
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-[#F4F7F5] text-[#172B28] border border-[#E2EAE5] transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 inline mr-1" />Modify
                    </button>

                    <button
                      onClick={() => handleApprove(rec)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#145C43] hover:bg-[#103D30] text-white transition cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 inline mr-1" />Approve
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* REJECT PROMPT MODAL */}
        {rejectPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-[#E2EAE5] max-w-md w-full p-6 shadow-xl text-xs space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-[#E2EAE5] pb-3">
                <span className="font-semibold text-sm text-[#172B28]">Reject Recommendation</span>
                <button onClick={() => setRejectPrompt(null)} className="text-[#667873] hover:text-[#172B28] p-1 text-base cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[#667873] leading-relaxed">
                Provide an operational rationale for rejecting the prescriptive recommendation for ticket <strong className="text-[#172B28] font-mono">{rejectPrompt.ticket_id}</strong>:
              </p>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Incident already resolved out of band; or target squad capacity committed..."
                className="w-full bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-3 text-xs text-[#172B28] focus:outline-none focus:ring-1 focus:ring-rose-600 focus:bg-white transition"
              />
              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2EAE5]">
                <button
                  onClick={() => setRejectPrompt(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#667873] hover:bg-[#F4F7F5] border border-[#E2EAE5] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={!rejectReason.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-rose-700 hover:bg-rose-800 text-white transition cursor-pointer disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODIFY PROMPT MODAL */}
        {modifyPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-[#E2EAE5] max-w-lg w-full p-6 shadow-xl text-xs space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-[#E2EAE5] pb-3">
                <div>
                  <h3 className="font-semibold text-sm text-[#172B28]">Modify Recommendation &amp; Schedule Action</h3>
                  <p className="text-[11px] text-[#667873] mt-0.5">Customize the operational assignment before execution</p>
                </div>
                <button onClick={() => setModifyPrompt(null)} className="text-[#667873] hover:text-[#172B28] p-1 text-base cursor-pointer"><X className="w-4 h-4" /></button>
              </div>

              <div className="bg-[#F4F7F5] rounded-xl border border-[#E2EAE5] p-3 text-xs text-[#172B28]">
                <div className="text-[10px] text-[#667873] font-mono uppercase font-semibold">Original Recommendation:</div>
                <div className="font-medium mt-0.5 text-[#172B28]">{modifyPrompt.proposed_action}</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172B28] mb-1.5">
                  Select Alternative Squad (Optional)
                </label>
                <select
                  value={modifiedTeamId}
                  onChange={(e) => setModifiedTeamId(e.target.value)}
                  className="w-full bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-2.5 text-xs text-[#172B28] focus:outline-none focus:ring-1 focus:ring-[#145C43] focus:bg-white transition"
                >
                  <option value="">Keep Proposed Squad</option>
                  {teams.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.name} ({tm.activeTickets || 0}/{tm.maxCapacity || 10} active tickets)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172B28] mb-1.5">
                  Custom Execution Directives
                </label>
                <input
                  type="text"
                  value={modifiedInstructions}
                  onChange={(e) => setModifiedInstructions(e.target.value)}
                  placeholder="e.g., Pair with senior domain engineer for rapid resolution..."
                  className="w-full bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-2.5 text-xs text-[#172B28] focus:outline-none focus:ring-1 focus:ring-[#145C43] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172B28] mb-1.5">
                  Mandatory Modification Reason *
                </label>
                <textarea
                  rows={2}
                  value={modifyReason}
                  onChange={(e) => setModifyReason(e.target.value)}
                  placeholder="Explain why the recommendation was customized..."
                  className="w-full bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-2.5 text-xs text-[#172B28] focus:outline-none focus:ring-1 focus:ring-[#145C43] focus:bg-white transition"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2EAE5]">
                <button
                  onClick={() => setModifyPrompt(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#667873] hover:bg-[#F4F7F5] border border-[#E2EAE5] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmModify}
                  disabled={!modifyReason.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-[#145C43] hover:bg-[#103D30] text-white transition cursor-pointer disabled:opacity-50"
                >
                  Save Modified Action
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AUDIT TRAIL MODAL */}
        {historyModalRec && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-[#E2EAE5] max-w-lg w-full p-6 shadow-xl text-xs space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-[#E2EAE5] pb-3">
                <div>
                  <h3 className="font-semibold text-sm text-[#172B28]">Decision Audit Trail</h3>
                  <div className="text-[11px] text-[#667873] font-mono mt-0.5">Ticket {historyModalRec.rec.ticket_id}</div>
                </div>
                <button onClick={() => setHistoryModalRec(null)} className="text-[#667873] hover:text-[#172B28] p-1 text-base cursor-pointer"><X className="w-4 h-4" /></button>
              </div>

              {historyLoading ? (
                <div className="p-6 text-center text-[#667873] font-mono">Loading decision history...</div>
              ) : historyModalRec.historyEntries.length === 0 ? (
                <div className="p-6 text-center text-[#667873]">No prior decisions recorded for this recommendation.</div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {historyModalRec.historyEntries.map((dec) => (
                    <div key={dec.id} className="p-3 bg-[#F4F7F5] rounded-xl border border-[#E2EAE5] text-xs">
                      <div className="flex justify-between items-center text-[10px] text-[#667873]">
                        <span className="uppercase font-semibold text-[#145C43]">{dec.decision_type}</span>
                        <span className="font-mono">{new Date(dec.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-[#172B28] mt-1 font-medium">{dec.reason || 'None specified'}</div>
                      <div className="text-[10px] text-[#667873] font-mono mt-0.5">Actor: {dec.manager_id}</div>
                      {dec.manager_action && (
                        <div className="text-[11px] text-[#145C43] mt-1 pt-1 border-t border-[#E2EAE5] font-mono">
                          Action: {JSON.stringify(dec.manager_action)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-[#E2EAE5]">
                <button
                  onClick={() => setHistoryModalRec(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#172B28] bg-[#F4F7F5] hover:bg-[#E2EAE5] border border-[#E2EAE5] transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // DEMO MODE FALLBACK
  // ==========================================
  const actionableDemo = (demoTickets || []).filter(
    (t) => (t.actionType === 'Reassign' || t.actionType === 'Escalate') && !t.actionTaken
  ).slice(0, 2);

  if (actionableDemo.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E2EAE5] p-5 mb-6 flex items-center justify-between text-xs shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 bg-[#DCE9E1] text-[#145C43] rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-[#145C43]" />
          </div>
          <div>
            <div className="font-semibold text-[#172B28] text-xs">Operations Balanced (Demo Benchmark)</div>
            <div className="text-[#667873] text-[11px]">All urgent tasks have been reallocated. Squad capacities are balanced.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center space-x-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#172B28]">
            Demo Prescriptive Interventions Pending Review
          </h2>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {actionableDemo.length} pending
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionableDemo.map((ticket) => {
          const isReassign = ticket.actionType === 'Reassign';
          const isEscalate = ticket.actionType === 'Escalate';
          const currentTeam = teams.find((tm) => tm.id === ticket.assignedTeamId);

          return (
            <div
              key={ticket.id}
              className="bg-white rounded-xl border border-[#E2EAE5] p-5 flex flex-col justify-between text-xs space-y-3 shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-semibold text-xs text-[#172B28] px-2 py-0.5 rounded bg-[#F4F7F5] border border-[#E2EAE5]">
                      {ticket.id}
                    </span>
                    <span className="text-[#667873] text-[11px]">• {ticket.category}</span>
                  </div>
                  <span className="font-mono text-xs font-medium text-rose-700">
                    {ticket.deadlineHoursLeft > 0 ? `${ticket.deadlineHoursLeft}h until breach` : 'Past Deadline'}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-[#172B28] mb-2">{ticket.problem}</h3>

                <div className="bg-[#F4F7F5] rounded-lg border border-[#E2EAE5] p-3 text-xs text-[#172B28] leading-relaxed">
                  {isReassign && (
                    <>
                      <strong className="text-[#172B28]">{currentTeam?.name.split('—')[0]}</strong> is carrying {currentTeam?.activeTickets} tickets ({Math.round(((currentTeam?.activeTickets || 0) / (currentTeam?.maxCapacity || 1)) * 100)}% capacity). Reassigning avoids SLA breach.
                    </>
                  )}
                  {isEscalate && (
                    <>{ticket.flagReason || 'Critical incident requiring immediate manager escalation.'}</>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2EAE5] flex items-center justify-end space-x-2">
                {onDemoReject && (
                  <button
                    onClick={() => onDemoReject(ticket, 'Demo rejection')}
                    className="py-1.5 px-3 text-xs rounded-lg text-rose-700 border border-rose-200 bg-white hover:bg-rose-50 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 inline mr-1" />Reject
                  </button>
                )}
                {onDemoApprove && (
                  <button
                    onClick={() => onDemoApprove(ticket)}
                    className="py-1.5 px-3.5 text-xs font-medium rounded-lg bg-[#145C43] hover:bg-[#103D30] text-white transition cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 inline mr-1" />Approve
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
