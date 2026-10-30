import React, { useState, useEffect } from 'react';
import { ClipboardList, X, CheckCircle2 } from 'lucide-react';
import { opsApi } from '../services/api';

export default function ActionTrackerView({ datasetId, onToast }) {
  const [actions, setActions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedActionHistory, setSelectedActionHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Modal / reason prompt for failed/cancelled
  const [transitionPrompt, setTransitionPrompt] = useState(null); // { actionId, targetStatus }
  const [transitionReason, setTransitionReason] = useState('');

  const loadActions = async () => {
    if (!datasetId) {
      setActions([]);
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await opsApi.getDatasetActions(datasetId, {
        status: statusFilter === 'All' ? null : statusFilter,
        page: 1,
        pageSize: 100,
      });
      setActions(res.items || []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load actions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, [datasetId, statusFilter]);

  const handleTransition = async (actionId, targetStatus, reason = null) => {
    if ((targetStatus === 'failed' || targetStatus === 'cancelled') && !reason) {
      setTransitionPrompt({ actionId, targetStatus });
      setTransitionReason('');
      return;
    }

    try {
      await opsApi.updateActionStatus(actionId, {
        newStatus: targetStatus,
        reason: reason || null,
        actorId: 'operations_manager',
      });
      if (onToast) onToast(`Action ${actionId} transitioned to ${targetStatus}`);
      setTransitionPrompt(null);
      setTransitionReason('');
      loadActions();
    } catch (err) {
      if (onToast) onToast(`Error: ${err.message}`);
    }
  };

  const handleViewHistory = async (actionId) => {
    setHistoryLoading(true);
    try {
      const hist = await opsApi.getActionHistory(actionId);
      setSelectedActionHistory({ actionId, entries: hist });
    } catch (err) {
      if (onToast) onToast(`Failed to load history: ${err.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'in_progress':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'failed':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'cancelled':
        return 'bg-slate-50 text-[#667873] border-slate-200';
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  if (!datasetId) {
    return (
      <div className="bg-white rounded-xl border border-[#E2EAE5] p-8 text-center text-xs text-[#667873] shadow-xs">
        <ClipboardList className="w-8 h-8 mx-auto mb-2 text-[#145C43]" />
        <div className="font-semibold text-[#172B28] text-sm mb-1">No Active Dataset Selected</div>
        <p className="max-w-md mx-auto leading-relaxed">
          Select or upload an operations dataset to view and manage approved action lifecycles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs text-[#172B28]">
      {/* Header & Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2EAE5]">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 bg-[#DCE9E1]/70 text-[#145C43] rounded font-mono">
              TASK 5
            </span>
            <span className="text-xs text-[#667873]">Persistent Action Lifecycle &amp; Audit Trail</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-[#172B28] mt-1">
            Tracked Operational Actions
          </h2>
          <p className="text-xs text-[#667873] mt-0.5">
            Monitor execution status and trigger transitions for manager-approved prescriptive interventions.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto">
          {['All', 'pending', 'in_progress', 'completed', 'failed', 'cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#DCE9E1]/80 text-[#145C43] font-semibold'
                  : 'text-[#667873] hover:text-[#172B28] hover:bg-[#F4F7F5]'
              }`}
            >
              {st === 'All' ? 'All Statuses' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="p-4 bg-white rounded-xl border border-[#E2EAE5] text-[#667873] text-center font-mono">
          Loading tracked action records...
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-rose-800">
          <strong>Notice:</strong> {errorMsg}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !errorMsg && actions.length === 0 && (
        <div className="bg-white border border-[#E2EAE5] rounded-xl p-8 text-center text-[#667873] shadow-xs">
          <div className="w-8 h-8 rounded-full bg-[#DCE9E1] text-[#145C43] flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-4 h-4 text-[#145C43]" />
          </div>
          <div className="font-semibold text-[#172B28] text-sm mb-1">No Tracked Actions Found</div>
          <p className="text-xs text-[#667873] max-w-md mx-auto">
            {statusFilter !== 'All'
              ? `No actions currently match the '${statusFilter}' filter criteria.`
              : 'Approve prescriptive recommendations on the Dashboard to initiate actionable tracking workflows.'}
          </p>
        </div>
      )}

      {/* Actions Table */}
      {!isLoading && actions.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2EAE5] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2EAE5] bg-[#F4F7F5] text-[#667873] font-medium text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-5">Action ID</th>
                  <th className="py-3 px-5">Ticket ID</th>
                  <th className="py-3 px-5">Action Type</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Created At</th>
                  <th className="py-3 px-5">Reason / Notes</th>
                  <th className="py-3 px-5 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2EAE5]">
                {actions.map((act) => {
                  const isPending = act.current_status === 'pending';
                  const isInProgress = act.current_status === 'in_progress';
                  const isTerminal = act.current_status === 'completed' || act.current_status === 'failed' || act.current_status === 'cancelled';

                  return (
                    <tr key={act.id} className="hover:bg-[#F4F7F5]/60 transition">
                      <td className="py-3.5 px-5 font-mono text-xs font-semibold text-[#172B28]">
                        {act.id}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs font-semibold text-[#145C43]">
                        {act.source_ticket_id}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-[#172B28]">
                        <div>{act.action_type}</div>
                        <div className="text-[10px] text-[#667873] truncate max-w-xs mt-0.5">
                          {act.action_payload?.proposed_action || JSON.stringify(act.action_payload)}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadge(act.current_status)}`}>
                          {act.current_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-[#667873] whitespace-nowrap font-mono text-[11px]">
                        {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-5 text-[#172B28] max-w-xs truncate">
                        {act.reason || '—'}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap space-x-1.5">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleTransition(act.id, 'in_progress')}
                              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-md font-medium text-[11px] cursor-pointer transition"
                            >
                              Start
                            </button>
                            <button
                              onClick={() => handleTransition(act.id, 'cancelled')}
                              className="px-2 py-1 bg-white hover:bg-slate-50 text-[#667873] border border-[#E2EAE5] rounded-md text-[11px] cursor-pointer transition"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {isInProgress && (
                          <>
                            <button
                              onClick={() => handleTransition(act.id, 'completed')}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md font-medium text-[11px] cursor-pointer transition"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => handleTransition(act.id, 'failed')}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] cursor-pointer transition"
                            >
                              Fail
                            </button>
                            <button
                              onClick={() => handleTransition(act.id, 'cancelled')}
                              className="px-2 py-1 bg-white hover:bg-slate-50 text-[#667873] border border-[#E2EAE5] rounded-md text-[11px] cursor-pointer transition"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {isTerminal && (
                          <span className="text-[11px] text-[#94A3A8] italic mr-1">Terminal</span>
                        )}

                        <button
                          onClick={() => handleViewHistory(act.id)}
                          className="px-2 py-1 text-[#667873] hover:text-[#172B28] border border-[#E2EAE5] bg-white rounded-md text-[11px] cursor-pointer transition"
                          title="View Transition History"
                        >
                          Audit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reason Input Dialog for Failed/Cancelled */}
      {transitionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E2EAE5] rounded-2xl max-w-md w-full p-6 shadow-xl animate-fade-in">
            <h3 className="text-sm font-semibold text-[#172B28] mb-1">
              Confirm Action Status: {transitionPrompt.targetStatus.toUpperCase()}
            </h3>
            <p className="text-xs text-[#667873] mb-3 leading-relaxed">
              An operational justification is required when transitioning an action to {transitionPrompt.targetStatus}.
            </p>

            <textarea
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
              placeholder={`Provide the operational rationale for ${transitionPrompt.targetStatus}...`}
              className="w-full text-xs p-3 border border-[#E2EAE5] rounded-xl bg-[#F4F7F5] text-[#172B28] mb-4 h-24 focus:outline-none focus:ring-1 focus:ring-[#145C43] focus:bg-white transition"
            />

            <div className="flex space-x-2 justify-end">
              <button
                onClick={() => setTransitionPrompt(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#667873] hover:bg-[#F4F7F5] border border-[#E2EAE5] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTransition(transitionPrompt.actionId, transitionPrompt.targetStatus, transitionReason.trim())}
                disabled={!transitionReason.trim()}
                className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-[#145C43] hover:bg-[#103D30] disabled:opacity-50 transition cursor-pointer shadow-xs"
              >
                Confirm {transitionPrompt.targetStatus}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Audit History Modal */}
      {selectedActionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E2EAE5] rounded-2xl max-w-lg w-full p-6 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2EAE5] mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#172B28]">
                  Status Transition Audit History
                </h3>
                <span className="font-mono text-xs text-[#667873]">
                  {selectedActionHistory.actionId}
                </span>
              </div>
              <button
                onClick={() => setSelectedActionHistory(null)}
                className="text-[#667873] hover:text-[#172B28] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {selectedActionHistory.entries.map((entry, idx) => (
                <div key={entry.id} className="p-3 bg-[#F4F7F5] rounded-xl border border-[#E2EAE5] text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[#172B28]">
                      Step {idx + 1}: {entry.previous_status || 'initial'} → <strong className="text-[#145C43]">{entry.new_status}</strong>
                    </span>
                    <span className="text-[10px] text-[#667873] font-mono">
                      {new Date(entry.change_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[#667873] text-[11px]">{entry.reason || 'No additional note'}</div>
                  <div className="text-[10px] text-[#94A3A8] mt-1 font-mono">Actor: {entry.actor_id}</div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#E2EAE5] mt-4 text-right">
              <button
                onClick={() => setSelectedActionHistory(null)}
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
