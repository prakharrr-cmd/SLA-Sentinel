import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { opsApi } from '../services/api';

export default function BusinessConfigView({ showToast }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingPolicyId, setEditingPolicyId] = useState(null);
  const [editingHours, setEditingHours] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await opsApi.getConfigSummary();
      setConfig(res);
    } catch (e) {
      if (showToast) showToast(`Failed to load business config: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSavePolicy = async (policyId) => {
    const hours = parseFloat(editingHours);
    if (isNaN(hours) || hours <= 0) {
      if (showToast) showToast('Please enter a valid positive number for SLA hours.');
      return;
    }

    try {
      setSavingPolicy(true);
      await opsApi.updateSLAPolicy(policyId, hours);
      if (showToast) showToast('SLA policy updated successfully');
      setEditingPolicyId(null);
      await fetchConfig();
    } catch (e) {
      if (showToast) showToast(`Error saving policy: ${e.message}`);
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleUpdateCapacity = async (teamId, newCap) => {
    const cap = parseInt(newCap, 10);
    if (isNaN(cap) || cap <= 0) return;

    try {
      await opsApi.updateTeamCapacity(teamId, cap);
      if (showToast) showToast(`Team ${teamId} capacity updated to ${cap}`);
      await fetchConfig();
    } catch (e) {
      if (showToast) showToast(`Error updating capacity: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-[#DCE9E1]/70 border border-[#145C43]/20 text-[#145C43]">
                GOVERNANCE &amp; AUDITABILITY
              </span>
              <span className="text-xs text-[#667873] font-mono">Policy Matrix</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#172B28] mt-1">
              Business Configuration &amp; Operational Baselines
            </h2>
            <p className="text-xs text-[#667873] mt-1 max-w-2xl leading-relaxed">
              Define the explicit organizational policies and thresholds used by SLA Sentinel's analytical models, risk ranking algorithms, and evidence-based recommendation engine.
            </p>
          </div>

          <button
            onClick={fetchConfig}
            className="px-4 py-2 rounded-xl bg-[#F4F7F5] hover:bg-white text-[#172B28] border border-[#E2EAE5] text-xs font-mono font-bold transition cursor-pointer self-start md:self-auto shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 inline mr-1" />Reload Policies
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[#667873] font-mono text-xs">
          Loading business configuration...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* SLA Policies Table */}
          <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2EAE5]">
              <div>
                <h3 className="text-xs font-extrabold text-[#172B28] uppercase tracking-wider">
                  SLA Target Durations
                </h3>
                <p className="text-[11px] text-[#667873]">
                  Target response and resolution deadlines per priority tier.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold text-[#667873]">
                {config?.sla_policies?.length || 0} active rules
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2EAE5] text-[10px] uppercase font-bold text-[#667873]">
                    <th className="pb-2">Target Type</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2">Target (Hours)</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2EAE5] font-mono">
                  {config?.sla_policies?.map((policy) => {
                    const isEditing = editingPolicyId === policy.id;
                    return (
                      <tr key={policy.id} className="hover:bg-[#F4F7F5] transition">
                        <td className="py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            policy.target_type === 'response_deadline'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-emerald-50 text-[#145C43] border border-emerald-200'
                          }`}>
                            {policy.target_type === 'response_deadline' ? 'Response' : 'Resolution'}
                          </span>
                        </td>
                        <td className="py-2.5 font-bold text-[#172B28]">{policy.priority}</td>
                        <td className="py-2.5">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.5"
                              value={editingHours}
                              onChange={(e) => setEditingHours(e.target.value)}
                              className="w-20 px-2 py-1 rounded-lg border border-[#E2EAE5] text-xs font-bold font-mono focus:outline-hidden focus:ring-1 focus:ring-[#145C43]"
                            />
                          ) : (
                            <span className="font-bold text-[#172B28]">{policy.target_hours}h</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-sans">
                          {isEditing ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                disabled={savingPolicy}
                                onClick={() => handleSavePolicy(policy.id)}
                                className="px-2 py-1 rounded-lg bg-[#145C43] hover:bg-[#103D30] text-white text-[10px] font-bold cursor-pointer transition shadow-2xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingPolicyId(null)}
                                className="px-2 py-1 rounded-lg bg-[#F4F7F5] hover:bg-white text-[#667873] text-[10px] font-bold border border-[#E2EAE5] cursor-pointer transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingPolicyId(policy.id);
                                setEditingHours(String(policy.target_hours));
                              }}
                              className="text-[11px] font-bold text-[#145C43] hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Team Capacity Limits */}
          <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2EAE5]">
              <div>
                <h3 className="text-xs font-extrabold text-[#172B28] uppercase tracking-wider">
                  Operational Squad Limits
                </h3>
                <p className="text-[11px] text-[#667873]">
                  Maximum active concurrent ticket capacity before overload alert is triggered.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold text-[#667873]">
                {config?.team_capacities?.length || 0} squads
              </span>
            </div>

            <div className="space-y-3">
              {config?.team_capacities?.map((tc) => (
                <div
                  key={tc.team_id}
                  className="p-3.5 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-[#172B28] font-mono">{tc.team_id.toUpperCase()}</div>
                    <div className="text-[11px] text-[#667873]">
                      Warn at {(tc.warning_threshold * 100).toFixed(0)}% • Critical at {(tc.critical_threshold * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono text-[#667873]">Max Active:</span>
                    <select
                      value={tc.max_active_tickets}
                      onChange={(e) => handleUpdateCapacity(tc.team_id, e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#E2EAE5] text-xs font-bold font-mono cursor-pointer text-[#172B28]"
                    >
                      {[5, 8, 10, 12, 15, 20, 25, 30].map((num) => (
                        <option key={num} value={num}>
                          {num} tickets
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Weighting Multipliers */}
          <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs space-y-3">
            <h3 className="text-xs font-extrabold text-[#172B28] uppercase tracking-wider">
              Priority Risk Multipliers
            </h3>
            <p className="text-[11px] text-[#667873]">
              Quantifiable weights applied during SLA risk scoring calculation.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {config?.priority_weights?.map((pw) => (
                <div key={pw.priority} className="p-3 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] text-center">
                  <div className="text-[10px] uppercase font-bold text-[#667873] font-mono">{pw.priority}</div>
                  <div className="text-base font-extrabold font-mono text-[#145C43] mt-0.5">
                    {pw.weight_multiplier}x
                  </div>
                  <div className="text-[10px] text-[#667873] mt-0.5">SLA Weight</div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Thresholds */}
          <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs space-y-3">
            <h3 className="text-xs font-extrabold text-[#172B28] uppercase tracking-wider">
              Composite Risk Score Tiers
            </h3>
            <p className="text-[11px] text-[#667873]">
              Score brackets mapped to operational urgency levels.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {config?.risk_thresholds?.map((rt) => (
                <div key={rt.level} className="p-3 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] text-center">
                  <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                    rt.level === 'High' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    rt.level === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-emerald-50 text-[#145C43] border border-emerald-200'
                  }`}>
                    {rt.level}
                  </span>
                  <div className="text-sm font-extrabold font-mono text-[#172B28] mt-2">
                    {rt.min_score} – {rt.max_score}
                  </div>
                  <div className="text-[10px] text-[#667873] mt-0.5">Risk Points</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
