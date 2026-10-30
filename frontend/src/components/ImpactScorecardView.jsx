import React, { useState, useEffect } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { opsApi } from '../services/api';
import { PERFORMANCE_SCORECARD } from '../data/mockData';

export default function ImpactScorecardView({ datasetId, selectedSlaTarget = 'resolution_deadline' }) {
  // Live Evaluation State
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTarget, setActiveTarget] = useState(
    selectedSlaTarget === 'response_deadline' ? 'response' : 'resolution'
  );

  // Mock scorecard view state for demo mode
  const [demoViewMode, setDemoViewMode] = useState('comparison');
  const { baseline, proposed, improvements } = PERFORMANCE_SCORECARD;

  useEffect(() => {
    if (!datasetId) {
      setEvaluation(null);
      return;
    }

    let isMounted = true;
    const fetchEval = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await opsApi.getDatasetEvaluation(datasetId);
        if (isMounted) {
          setEvaluation(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load outcome evaluation.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEval();
    return () => {
      isMounted = false;
    };
  }, [datasetId]);

  // When live dataset is active, render the real empirical evaluation scorecard
  if (datasetId) {
    const targetEval =
      activeTarget === 'response'
        ? evaluation?.response_sla_evaluation
        : evaluation?.resolution_sla_evaluation;

    const baseCohort = targetEval?.baseline;
    const postCohort = targetEval?.post_action;
    const comparisons = targetEval?.comparisons || [];
    const actionSummary = evaluation?.action_summary;
    const hasPostData = Boolean(postCohort && postCohort.ticket_sample_size > 0);

    const formatPct = (val) => {
      if (val === null || val === undefined) return 'N/A';
      return `${(val * 100).toFixed(1)}%`;
    };

    const formatHours = (val) => {
      if (val === null || val === undefined) return 'N/A';
      return `${val.toFixed(1)}h`;
    };

    const formatDiff = (val, isRate = false) => {
      if (val === null || val === undefined) return '—';
      const sign = val > 0 ? '+' : '';
      return isRate ? `${sign}${(val * 100).toFixed(1)}% pts` : `${sign}${val.toFixed(1)}h`;
    };

    const formatRelChange = (val) => {
      if (val === null || val === undefined) return '—';
      const sign = val > 0 ? '+' : '';
      return `${sign}${val.toFixed(1)}%`;
    };

    const formatDate = (isoStr) => {
      if (!isoStr) return 'Unbounded';
      return new Date(isoStr).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E2EAE5]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-[#DCE9E1]/70 border border-[#145C43]/20 text-[#145C43] rounded-md">
                TASK 6 • OUTCOME EVALUATION
              </span>
              <span className="text-xs text-[#667873]">Empirical SLA Performance Measurement</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[#172B28] mt-1">
              Observed SLA Performance &amp; Cohort Comparison
            </h2>
            <p className="text-xs text-[#667873] mt-1 max-w-2xl">
              Measures operational performance around completed actions by comparing pre-action baseline tickets with post-action tickets.
            </p>
          </div>

          {/* Target Toggle */}
          <div className="flex items-center bg-[#F4F7F5] p-1 text-xs font-medium border border-[#E2EAE5] rounded-xl">
            <button
              onClick={() => setActiveTarget('resolution')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                activeTarget === 'resolution'
                  ? 'bg-white text-[#145C43] font-bold shadow-2xs border border-[#E2EAE5]'
                  : 'text-[#667873] hover:text-[#172B28]'
              }`}
            >
              Resolution SLA
            </button>
            <button
              onClick={() => setActiveTarget('response')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                activeTarget === 'response'
                  ? 'bg-white text-[#145C43] font-bold shadow-2xs border border-[#E2EAE5]'
                  : 'text-[#667873] hover:text-[#172B28]'
              }`}
            >
              Response SLA
            </button>
          </div>
        </div>

        {/* Loading and Error states */}
        {loading && (
          <div className="p-8 text-center bg-white border border-[#E2EAE5] rounded-2xl text-xs font-mono text-[#667873] shadow-2xs animate-pulse">
            Calculating empirical evaluation metrics...
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs shadow-2xs">
            {error}
          </div>
        )}

        {evaluation && !loading && (
          <>
            {/* Action Execution Summary */}
            <div className="bg-white border border-[#E2EAE5] rounded-2xl p-5 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#667873] mb-3">
                Action Execution Summary (Dataset Scope)
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
                <div className="bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-3">
                  <div className="text-[10px] text-[#667873] uppercase font-mono">Approved</div>
                  <div className="text-base font-bold text-[#172B28] font-mono mt-0.5">
                    {actionSummary?.total_approved_actions ?? 0}
                  </div>
                </div>
                <div className="bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-3">
                  <div className="text-[10px] text-[#667873] uppercase font-mono">Pending</div>
                  <div className="text-base font-bold text-amber-600 font-mono mt-0.5">
                    {actionSummary?.pending_actions ?? 0}
                  </div>
                </div>
                <div className="bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-3">
                  <div className="text-[10px] text-[#667873] uppercase font-mono">In Progress</div>
                  <div className="text-base font-bold text-sky-600 font-mono mt-0.5">
                    {actionSummary?.in_progress_actions ?? 0}
                  </div>
                </div>
                <div className="bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-3">
                  <div className="text-[10px] text-[#667873] uppercase font-mono">Completed</div>
                  <div className="text-base font-bold text-emerald-600 font-mono mt-0.5">
                    {actionSummary?.completed_actions ?? 0}
                  </div>
                </div>
                <div className="bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-3">
                  <div className="text-[10px] text-[#667873] uppercase font-mono">Failed / Cancelled</div>
                  <div className="text-base font-bold text-rose-600 font-mono mt-0.5">
                    {(actionSummary?.failed_actions ?? 0) + (actionSummary?.cancelled_actions ?? 0)}
                  </div>
                </div>
                <div className="bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-3">
                  <div className="text-[10px] text-[#667873] uppercase font-mono">Completion Rate</div>
                  <div className="text-base font-bold text-[#172B28] font-mono mt-0.5">
                    {formatPct(actionSummary?.action_completion_rate)}
                  </div>
                </div>
              </div>
            </div>

            {/* Cohort Window Specs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-[#E2EAE5] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#172B28] uppercase font-mono">
                    Baseline Window (Pre-Action)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-[#F4F7F5] border border-[#E2EAE5] text-[#172B28] font-mono font-bold rounded-md">
                    N = {baseCohort?.ticket_sample_size ?? 0} tickets
                  </span>
                </div>
                <div className="text-xs text-[#667873] space-y-1 font-mono">
                  <div>Start: {formatDate(baseCohort?.window_start)}</div>
                  <div>End: {formatDate(baseCohort?.window_end)}</div>
                  <div>Eligible Tickets: {baseCohort?.eligible_count ?? 0}</div>
                </div>
              </div>

              <div className="bg-white border border-[#E2EAE5] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#145C43] uppercase font-mono">
                    Post-Action Window (Observed)
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 border font-mono font-bold rounded-md ${
                    hasPostData
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-[#F4F7F5] text-[#667873] border-[#E2EAE5]'
                  }`}>
                    N = {postCohort?.ticket_sample_size ?? 0} tickets
                  </span>
                </div>
                <div className="text-xs text-[#667873] space-y-1 font-mono">
                  <div>Start: {formatDate(postCohort?.window_start)}</div>
                  <div>End: {formatDate(postCohort?.window_end)}</div>
                  <div>Eligible Tickets: {postCohort?.eligible_count ?? 0}</div>
                </div>
              </div>
            </div>

            {/* Performance Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Compliance Rate Card */}
              <div className="bg-white border border-[#E2EAE5] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[#667873] uppercase tracking-wider">
                    SLA Compliance Rate
                  </div>
                  
                  {hasPostData ? (
                    <div className="flex items-baseline space-x-3 mt-3">
                      <span className="text-lg font-bold font-mono text-[#667873]">
                        {formatPct(baseCohort?.compliance_rate)}
                      </span>
                      <span className="text-[#667873]">→</span>
                      <span className="text-2xl font-extrabold text-emerald-600 font-mono">
                        {formatPct(postCohort?.compliance_rate)}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="text-2xl font-extrabold text-[#172B28] font-mono">
                        {formatPct(baseCohort?.compliance_rate)}
                      </div>
                      <div className="text-[10px] text-[#667873] font-mono mt-0.5">
                        Baseline Benchmark (N = {baseCohort?.ticket_sample_size ?? 0})
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-[#667873] mt-2">
                    Met: {baseCohort?.met_sla_count ?? 0} (base)
                    {hasPostData && ` vs ${postCohort?.met_sla_count ?? 0} (post)`}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2EAE5] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#667873]">{hasPostData ? 'Delta:' : 'Post-Action Status:'}</span>
                  {hasPostData ? (
                    <span className="font-bold text-emerald-600">
                      {formatDiff(comparisons.find(c => c.metric_name === 'SLA Compliance Rate')?.absolute_difference, true)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-[#667873] bg-[#F4F7F5] px-2 py-0.5 rounded border border-[#E2EAE5]">
                      Awaiting Cohort Completion
                    </span>
                  )}
                </div>
              </div>

              {/* Breach Rate Card */}
              <div className="bg-white border border-[#E2EAE5] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[#667873] uppercase tracking-wider">
                    SLA Breach Rate
                  </div>

                  {hasPostData ? (
                    <div className="flex items-baseline space-x-3 mt-3">
                      <span className="text-lg font-bold font-mono text-[#667873]">
                        {formatPct(baseCohort?.breach_rate)}
                      </span>
                      <span className="text-[#667873]">→</span>
                      <span className="text-2xl font-extrabold text-rose-600 font-mono">
                        {formatPct(postCohort?.breach_rate)}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="text-2xl font-extrabold text-[#172B28] font-mono">
                        {formatPct(baseCohort?.breach_rate)}
                      </div>
                      <div className="text-[10px] text-[#667873] font-mono mt-0.5">
                        Baseline Benchmark (N = {baseCohort?.ticket_sample_size ?? 0})
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-[#667873] mt-2">
                    Breached: {baseCohort?.breached_sla_count ?? 0} (base)
                    {hasPostData && ` vs ${postCohort?.breached_sla_count ?? 0} (post)`}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2EAE5] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#667873]">{hasPostData ? 'Delta:' : 'Post-Action Status:'}</span>
                  {hasPostData ? (
                    <span className="font-bold text-[#172B28]">
                      {formatDiff(comparisons.find(c => c.metric_name === 'SLA Breach Rate')?.absolute_difference, true)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-[#667873] bg-[#F4F7F5] px-2 py-0.5 rounded border border-[#E2EAE5]">
                      Awaiting Cohort Completion
                    </span>
                  )}
                </div>
              </div>

              {/* Turnaround / Duration Card */}
              <div className="bg-white border border-[#E2EAE5] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[#667873] uppercase tracking-wider">
                    Average Duration (Hours)
                  </div>

                  {hasPostData ? (
                    <div className="flex items-baseline space-x-3 mt-3">
                      <span className="text-lg font-bold font-mono text-[#667873]">
                        {formatHours(baseCohort?.avg_duration_hours)}
                      </span>
                      <span className="text-[#667873]">→</span>
                      <span className="text-2xl font-extrabold text-sky-600 font-mono">
                        {formatHours(postCohort?.avg_duration_hours)}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="text-2xl font-extrabold text-[#172B28] font-mono">
                        {formatHours(baseCohort?.avg_duration_hours)}
                      </div>
                      <div className="text-[10px] text-[#667873] font-mono mt-0.5">
                        Baseline Benchmark (N = {baseCohort?.ticket_sample_size ?? 0})
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-[#667873] mt-2">
                    Active High Risk: {baseCohort?.active_high_risk_count ?? 0} (base)
                    {hasPostData && ` vs ${postCohort?.active_high_risk_count ?? 0} (post)`}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2EAE5] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#667873]">{hasPostData ? 'Rel Change:' : 'Post-Action Status:'}</span>
                  {hasPostData ? (
                    <span className="font-bold text-[#172B28]">
                      {formatRelChange(comparisons.find(c => c.metric_name === 'Average Duration (Hours)')?.relative_percent_change)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-[#667873] bg-[#F4F7F5] px-2 py-0.5 rounded border border-[#E2EAE5]">
                      Awaiting Cohort Completion
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Informational Callout when awaiting post-action cohort */}
            {!hasPostData && (
              <div className="bg-[#F4F7F5] border border-[#E2EAE5] rounded-2xl p-4 text-xs text-[#667873] flex items-start space-x-3">
                <Info className="w-4 h-4 text-[#145C43] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#172B28] mb-0.5">Collection in Progress</div>
                  <div>
                    The baseline window reflects {baseCohort?.ticket_sample_size ?? 0} historical incidents. Post-action cohort tracking will compute delta comparisons once post-action tickets reach completion.
                  </div>
                </div>
              </div>
            )}

            {/* Observational Disclaimer Box */}
            <div className="bg-[#F4F7F5] border border-amber-200/80 rounded-2xl p-4 text-xs">
              <div className="flex items-center space-x-2 text-amber-700 font-bold mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="uppercase tracking-wider font-mono text-[10px]">Methodology &amp; Causality Notice</span>
              </div>
              <p className="text-[#172B28] leading-relaxed">
                {evaluation.observational_disclaimer}
              </p>
            </div>

            {/* Limitations Box */}
            {(evaluation.limitations?.length > 0 || targetEval?.limitations?.length > 0) && (
              <div className="bg-white border border-[#E2EAE5] rounded-2xl p-4 text-xs shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#667873] mb-2 font-mono">
                  Observed Data Limitations &amp; Quality Constraints
                </div>
                <ul className="list-disc list-inside space-y-1 text-[#667873] font-mono text-[11px]">
                  {evaluation.limitations?.map((lim, idx) => (
                    <li key={`dlim-${idx}`}>{lim}</li>
                  ))}
                  {targetEval?.limitations?.map((lim, idx) => (
                    <li key={`tlim-${idx}`}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Fallback demo scorecard when no live dataset is selected
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E2EAE5]">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-[#DCE9E1]/70 border border-[#145C43]/20 text-[#145C43] rounded-md">
              DEMO BENCHMARK
            </span>
            <span className="text-xs text-[#667873]">Reference Scorecard (Upload a dataset for live outcome evaluation)</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#172B28] mt-1">
            Baseline vs. AI Decision Engine Scorecard
          </h2>
          <p className="text-xs text-[#667873] mt-1 max-w-2xl">
            Direct comparison proving measurable gains across turnaround time, team productivity, and customer service quality.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-[#F4F7F5] p-1 text-xs font-medium border border-[#E2EAE5] rounded-xl">
          <button
            onClick={() => setDemoViewMode('comparison')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
              demoViewMode === 'comparison'
                ? 'bg-white text-[#145C43] font-bold shadow-2xs border border-[#E2EAE5]'
                : 'text-[#667873] hover:text-[#172B28]'
            }`}
          >
            Side-by-Side
          </button>
          <button
            onClick={() => setDemoViewMode('baseline')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
              demoViewMode === 'baseline'
                ? 'bg-white text-[#145C43] font-bold shadow-2xs border border-[#E2EAE5]'
                : 'text-[#667873] hover:text-[#172B28]'
            }`}
          >
            Baseline Only
          </button>
          <button
            onClick={() => setDemoViewMode('proposed')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
              demoViewMode === 'proposed'
                ? 'bg-white text-[#145C43] font-bold shadow-2xs border border-[#E2EAE5]'
                : 'text-[#667873] hover:text-[#172B28]'
            }`}
          >
            AI Engine Only
          </button>
        </div>
      </div>

      {/* 5 Core Measurable Impact Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Metric 1 */}
        <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#667873] uppercase tracking-wider">
              1. Service Level Compliance
            </span>
            <div className="flex items-baseline space-x-3 mt-3">
              {(demoViewMode === 'comparison' || demoViewMode === 'baseline') && (
                <span className="text-xl font-bold font-mono text-[#667873]">
                  {baseline.slaComplianceRate}
                </span>
              )}
              {demoViewMode === 'comparison' && <span className="text-[#667873]">→</span>}
              {(demoViewMode === 'comparison' || demoViewMode === 'proposed') && (
                <span className="text-3xl font-extrabold text-emerald-600 font-mono">
                  {proposed.slaComplianceRate}
                </span>
              )}
            </div>
            <p className="text-xs text-[#667873] mt-2">
              Percentage of 1,000 daily tickets resolved within customer SLA threshold.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E2EAE5] text-xs font-bold text-emerald-600 font-mono">
            {improvements.slaGain} net SLA improvement
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#667873] uppercase tracking-wider">
              2. Mean Turnaround Time (MTTR)
            </span>
            <div className="flex items-baseline space-x-3 mt-3">
              {(demoViewMode === 'comparison' || demoViewMode === 'baseline') && (
                <span className="text-xl font-bold font-mono text-[#667873]">
                  {baseline.avgTurnaroundHours}
                </span>
              )}
              {demoViewMode === 'comparison' && <span className="text-[#667873]">→</span>}
              {(demoViewMode === 'comparison' || demoViewMode === 'proposed') && (
                <span className="text-3xl font-extrabold text-[#172B28] font-mono">
                  {proposed.avgTurnaroundHours}
                </span>
              )}
            </div>
            <p className="text-xs text-[#667873] mt-2">
              Average hours to diagnose, assign, and resolve an incoming support issue.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E2EAE5] text-xs font-bold text-[#172B28] font-mono">
            {improvements.timeReduction} faster resolution cycle
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#667873] uppercase tracking-wider">
              3. Squad Overload Duration
            </span>
            <div className="flex items-baseline space-x-3 mt-3">
              {(demoViewMode === 'comparison' || demoViewMode === 'baseline') && (
                <span className="text-xl font-bold font-mono text-[#667873]">
                  {baseline.overloadedSquadHours}
                </span>
              )}
              {demoViewMode === 'comparison' && <span className="text-[#667873]">→</span>}
              {(demoViewMode === 'comparison' || demoViewMode === 'proposed') && (
                <span className="text-3xl font-extrabold text-sky-600 font-mono">
                  {proposed.overloadedSquadHours}
                </span>
              )}
            </div>
            <p className="text-xs text-[#667873] mt-2">
              Hours squads operate above 80% concurrent capacity limit.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E2EAE5] text-xs font-bold text-sky-600 font-mono">
            {improvements.burnoutReduction} burnout reduction
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#667873] uppercase tracking-wider">
              4. Monthly SLA Violations
            </span>
            <div className="flex items-baseline space-x-3 mt-3">
              {(demoViewMode === 'comparison' || demoViewMode === 'baseline') && (
                <span className="text-xl font-bold font-mono text-rose-600">
                  {baseline.monthlyBreaches}
                </span>
              )}
              {demoViewMode === 'comparison' && <span className="text-[#667873]">→</span>}
              {(demoViewMode === 'comparison' || demoViewMode === 'proposed') && (
                <span className="text-3xl font-extrabold text-emerald-600 font-mono">
                  {proposed.monthlyBreaches}
                </span>
              )}
            </div>
            <p className="text-xs text-[#667873] mt-2">
              Total customer incidents exceeding contractual resolution deadlines.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E2EAE5] text-xs font-bold text-emerald-600 font-mono">
            {improvements.breachReduction} fewer contractual breaches
          </div>
        </div>

        {/* Metric 5 */}
        <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs flex flex-col justify-between md:col-span-2">
          <div>
            <span className="text-[10px] font-bold text-[#667873] uppercase tracking-wider">
              5. Overall Operational Productivity Index
            </span>
            <div className="flex items-baseline space-x-3 mt-3">
              {(demoViewMode === 'comparison' || demoViewMode === 'baseline') && (
                <span className="text-xl font-bold font-mono text-[#667873]">
                  {baseline.productivityIndex}
                </span>
              )}
              {demoViewMode === 'comparison' && <span className="text-[#667873]">→</span>}
              {(demoViewMode === 'comparison' || demoViewMode === 'proposed') && (
                <span className="text-3xl font-extrabold text-[#172B28] font-mono">
                  {proposed.productivityIndex}
                </span>
              )}
            </div>
            <p className="text-xs text-[#667873] mt-2">
              Composite efficiency score evaluating throughput, squad balance, and mean response latency.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E2EAE5] text-xs font-bold text-[#145C43] font-mono">
            {improvements.productivityGain} operational throughput boost
          </div>
        </div>
      </div>
    </div>
  );
}
