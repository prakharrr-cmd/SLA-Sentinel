import React, { useState, useMemo } from 'react';
import {
  Database,
  FileUp,
  Zap,
  ArrowUpRight,
  ArrowRight,
  UsersRound,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

export default function ExecutiveGreeting({
  user,
  kpis,
  onRunAutoOptimizer,
  onOpenCsvModal,
  onOpenDatasetSelector,
  tickets = [],
  teams = [],
  datasetAnalytics,
  datasetRisks = [],
  datasetDecisions = [],
  datasetActions = [],
  activeDataset,
  isLoading = false,
  selectedSlaTarget = 'resolution_deadline',
  onSelectSlaTarget,
  onSelectTicket,
  onNavigateToTriage,
  onNavigateToSquads,
  onNavigateToActions,
}) {
  const atRiskCount = kpis?.highRiskTickets ?? 0;
  const breachedCount = kpis?.slaBreached ?? 0;
  const queueCount = kpis?.totalTickets ?? (datasetAnalytics?.ticket_distribution?.active_tickets_count ?? tickets.length);
  const overloadedCount = kpis?.overloadedTeams ?? 0;
  const hasAssignedTeams = kpis?.hasAssignedTeams ?? teams.some((t) => t.activeTickets > 0);

  // Active SLA metric selection
  const [internalSlaTarget, setInternalSlaTarget] = useState(selectedSlaTarget);
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);

  const activeSlaTarget = onSelectSlaTarget ? selectedSlaTarget : internalSlaTarget;
  const handleTargetChange = (target) => {
    if (onSelectSlaTarget) {
      onSelectSlaTarget(target);
    } else {
      setInternalSlaTarget(target);
    }
  };

  // SLA Performance Data derived strictly from backend analytics
  const slaTargetData = datasetAnalytics?.sla_performance?.[
    activeSlaTarget === 'response_deadline' ? 'response_sla' : 'resolution_sla'
  ];

  const hasDeadlines = (slaTargetData?.eligible_count || 0) > 0 || (slaTargetData?.coverage_rate || 0) > 0;

  // Real compliance calculation without fake fallbacks
  const compliancePercent = useMemo(() => {
    if (!hasDeadlines || !slaTargetData) return null;
    if (slaTargetData.historical_attainment_rate != null) {
      return Math.round(slaTargetData.historical_attainment_rate * 100);
    }
    const evaluatedActive = (slaTargetData.within_target_count || 0) + (slaTargetData.at_risk_count || 0) + (slaTargetData.breached_count || 0);
    if (evaluatedActive > 0) {
      return Math.round(((slaTargetData.within_target_count || 0) / evaluatedActive) * 100);
    }
    return 0;
  }, [hasDeadlines, slaTargetData]);

  // Real Incident Stream from currently selected dataset
  const incidentList = useMemo(() => {
    if (tickets && tickets.length > 0) {
      return tickets.slice(0, 5);
    }
    return [];
  }, [tickets]);

  // Squad List derived strictly from selected dataset workloads
  const squadList = useMemo(() => {
    if (!hasAssignedTeams) return [];
    return teams.filter((t) => t.activeTickets > 0 || t.isOverloaded).slice(0, 4);
  }, [teams, hasAssignedTeams]);

  // Daily Workload Analytics derived strictly from dataset ticket timestamps
  const dailyWorkload = useMemo(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    tickets.forEach((t) => {
      if (t.createdAt) {
        const d = new Date(t.createdAt);
        if (!isNaN(d.getTime())) {
          counts[d.getUTCDay()] += 1;
        }
      }
    });

    const maxCount = Math.max(...counts, 1);
    const peakIndex = counts.indexOf(Math.max(...counts));
    const hasTimestamps = counts.some((c) => c > 0);

    return dayLetters.map((letter, idx) => {
      const count = counts[idx];
      const pct = hasTimestamps ? Math.round((count / maxCount) * 100) : 0;
      const isPeak = hasTimestamps && idx === peakIndex && count > 0;
      return {
        day: letter,
        name: dayNames[idx],
        count,
        pct,
        isPeak,
        badge: isPeak ? `${count}` : null,
        height: count > 0 ? (pct >= 85 ? 'h-32' : pct >= 65 ? 'h-28' : pct >= 40 ? 'h-24' : pct >= 20 ? 'h-18' : 'h-14') : 'h-10',
        color: isPeak ? 'bg-[#103D30]' : pct >= 50 ? 'bg-[#145C43]' : 'bg-[#22C55E]',
        hatched: count === 0,
      };
    });
  }, [tickets]);

  // Evidence-based AI alerts derived strictly from dataset analytics
  const alerts = useMemo(() => {
    const items = [];

    // Alert 1: Squad / Capacity / Risk Alert
    if (overloadedCount > 0) {
      const topOverloaded = teams.find((t) => t.isOverloaded) || teams[0];
      items.push({
        type: 'danger',
        title: 'Urgent Rebalance Needed',
        badge: `${topOverloaded?.name?.split('—')[0] || topOverloaded?.id} • ${topOverloaded?.activeTickets} active`,
        description: `${topOverloaded?.name || topOverloaded?.id} has ${topOverloaded?.activeTickets} active tickets exceeding capacity (${topOverloaded?.maxCapacity} limit) — rebalance workload to avoid SLA failures.`,
      });
    } else if (atRiskCount > 0) {
      items.push({
        type: 'warning',
        title: 'Breach Risk Warning',
        badge: `${atRiskCount} At-Risk`,
        description: `${atRiskCount} active incidents are operating past 80% of their contractual SLA window and risk imminent breach.`,
      });
    } else if (!hasAssignedTeams && queueCount > 0) {
      items.push({
        type: 'info',
        title: 'Unassigned Squad Backlog',
        badge: `${queueCount} Unassigned`,
        description: `Source dataset contains ${queueCount} tickets without squad routing tags. Route tickets in Triage to distribute workload.`,
      });
    } else {
      items.push({
        type: 'success',
        title: 'Queue Operations Balanced',
        badge: 'Nominal',
        description: 'All active incidents are progressing safely within contractual SLA target boundaries.',
      });
    }

    // Alert 2: Category Concentration / Data Quality Alert
    const topCategory = datasetAnalytics?.trends_and_bottlenecks?.category_workload?.[0];
    if (topCategory && topCategory.active_count > 0) {
      const catPct = Math.round((topCategory.active_count / Math.max(queueCount, 1)) * 100);
      items.push({
        type: 'neutral',
        title: 'Volume Concentration',
        badge: topCategory.key,
        description: `${topCategory.key} accounts for ${topCategory.active_count} active tickets (${catPct}% of active queue).`,
      });
    } else if (slaTargetData?.missing_deadline_count > 0) {
      items.push({
        type: 'warning',
        title: 'SLA Coverage Notice',
        badge: `${slaTargetData.missing_deadline_count} Missing`,
        description: `${slaTargetData.missing_deadline_count} tickets lack configured ${activeSlaTarget === 'response_deadline' ? 'response' : 'resolution'} deadlines in source data.`,
      });
    } else {
      items.push({
        type: 'neutral',
        title: 'Category Distribution',
        badge: 'Balanced',
        description: 'Workload evenly distributed across active operational incident domains.',
      });
    }

    return items;
  }, [overloadedCount, atRiskCount, hasAssignedTeams, queueCount, teams, datasetAnalytics, slaTargetData, activeSlaTarget]);

  return (
    <div className="space-y-6">
      {/* TOP HEADER: Operations Dashboard + Clean Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#172B28] flex items-center space-x-2">
            <span>Operations Dashboard</span>
            {activeDataset?.name && (
              <span className="text-xs font-mono font-normal text-[#145C43] bg-[#E7F0EA] px-2.5 py-0.5 rounded-full border border-[#B8D0C1]/50">
                {activeDataset.name}
              </span>
            )}
          </h1>
          <p className="text-xs text-[#687A74] mt-1">
            Continuous SLA risk monitoring, operational performance and evidence-based workload optimization.
          </p>
        </div>

        {/* Top Right Action Pills */}
        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          {onOpenDatasetSelector && (
            <button
              onClick={onOpenDatasetSelector}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F4F7F5] text-[#172B28] text-xs font-semibold border border-[#E2EAE5] transition-all duration-150 cursor-pointer flex items-center space-x-1.5 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:scale-95"
            >
              <Database className="w-3.5 h-3.5 text-[#687A74]" />
              <span>Datasets</span>
            </button>
          )}

          {onOpenCsvModal && (
            <button
              onClick={onOpenCsvModal}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F4F7F5] text-[#172B28] text-xs font-semibold border border-[#E2EAE5] transition-all duration-150 cursor-pointer flex items-center space-x-1.5 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:scale-95"
            >
              <FileUp className="w-3.5 h-3.5 text-[#687A74]" />
              <span>Ingest Data</span>
            </button>
          )}

          <button
            onClick={onRunAutoOptimizer}
            className="px-4 py-1.5 rounded-full bg-[#145C43] hover:bg-[#103D30] text-white text-xs font-bold transition-all duration-150 flex items-center space-x-1.5 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-95 group"
          >
            <Zap className="w-3.5 h-3.5 text-[#DCE9E1] group-hover:rotate-12 transition-transform duration-200" />
            <span>Review &amp; Optimize</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION A — 4 BALANCED KPI CARDS (ON A SHARED HORIZONTAL BASELINE)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: At-Risk Incidents */}
        <div
          onClick={onNavigateToTriage}
          className="bg-gradient-to-br from-[#145C43] to-[#0D382A] text-white rounded-2xl p-5 shadow-2xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group cursor-pointer relative overflow-hidden"
          title="Click to view all at-risk incidents in queue"
        >
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-emerald-400/10 blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-medium text-emerald-100">At-Risk Incidents</span>
            <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-white transition-all duration-200 group-hover:scale-110 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-white/25">
              <ArrowUpRight className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="my-3 relative z-10">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white group-hover:scale-102 transition-transform origin-left">
              {atRiskCount}
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-emerald-100/90 relative z-10">
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold text-[10px] font-mono group-hover:bg-white/30 transition-colors">
              SLA
            </span>
            <span className="truncate">
              {hasDeadlines ? 'Predicted breach risk' : 'Deadlines unconfigured (Unscorable)'}
            </span>
          </div>
        </div>

        {/* Card 2: SLA Breached */}
        <div
          onClick={onNavigateToTriage}
          className="bg-white rounded-2xl border border-[#E2EAE5] p-5 shadow-2xs hover:shadow-lg hover:-translate-y-1 hover:border-[#DC465C]/40 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
          title="Click to view breached incidents"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#687A74]">SLA Breached</span>
            <div className="w-6 h-6 rounded-full bg-[#F4F7F5] border border-[#E2EAE5] flex items-center justify-center text-[#687A74] group-hover:text-rose-600 group-hover:border-rose-200 group-hover:bg-rose-50 group-hover:scale-110 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-[#DC465C] group-hover:scale-102 transition-transform origin-left">
              {breachedCount}
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-[#687A74]">
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold text-[10px] font-mono border border-rose-200 group-hover:bg-rose-100 transition-colors">
              Critical
            </span>
            <span className="truncate">
              {breachedCount > 0 ? 'Overdue past deadline' : 'Zero active breaches'}
            </span>
          </div>
        </div>

        {/* Card 3: Active Queue */}
        <div
          onClick={onNavigateToTriage}
          className="bg-white rounded-2xl border border-[#E2EAE5] p-5 shadow-2xs hover:shadow-lg hover:-translate-y-1 hover:border-[#145C43]/40 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
          title="Click to view all active pipeline tickets"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#687A74]">Active Queue</span>
            <div className="w-6 h-6 rounded-full bg-[#F4F7F5] border border-[#E2EAE5] flex items-center justify-center text-[#687A74] group-hover:text-[#145C43] group-hover:border-[#145C43]/30 group-hover:bg-[#E7F0EA] group-hover:scale-110 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-[#172B28] group-hover:scale-102 transition-transform origin-left">
              {queueCount.toLocaleString()}
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-[#687A74]">
            <span className="px-2 py-0.5 rounded-full bg-[#F4F7F5] text-[#172B28] font-semibold text-[10px] font-mono border border-[#E2EAE5] group-hover:bg-[#E7F0EA] group-hover:text-[#145C43] transition-colors">
              Pipeline
            </span>
            <span className="truncate">Total tickets in active queue</span>
          </div>
        </div>

        {/* Card 4: Overloaded Squads */}
        <div
          onClick={onNavigateToSquads}
          className="bg-white rounded-2xl border border-[#E2EAE5] p-5 shadow-2xs hover:shadow-lg hover:-translate-y-1 hover:border-[#E59A32]/40 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
          title="Click to view squad dispatch and capacity"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#687A74]">Overloaded Squads</span>
            <div className="w-6 h-6 rounded-full bg-[#F4F7F5] border border-[#E2EAE5] flex items-center justify-center text-[#687A74] group-hover:text-amber-600 group-hover:border-amber-200 group-hover:bg-amber-50 group-hover:scale-110 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-[#172B28] group-hover:scale-102 transition-transform origin-left">
              {!hasAssignedTeams ? (
                <span className="text-2xl font-mono text-[#8A9B96]">N/A</span>
              ) : (
                <>
                  {overloadedCount}
                  <span className="text-lg font-normal text-[#687A74]"> / {teams.length}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-[#687A74]">
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold text-[10px] font-mono border border-amber-200 group-hover:bg-amber-100 transition-colors">
              {!hasAssignedTeams ? 'Unassigned' : overloadedCount > 0 ? 'Rebalance Needed' : 'Capacity Nominal'}
            </span>
            <span className="truncate">
              {!hasAssignedTeams ? 'Squads unassigned in source' : overloadedCount > 0 ? 'Operating above limit' : 'All squads within limit'}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION B — OPERATIONAL OVERVIEW (3-COLUMN BALANCED GRID)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: Workload Velocity (Weekly Volume Bar Chart) */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#172B28] uppercase tracking-wider">Workload Analytics</h3>
              <span className="text-[10px] font-mono text-[#687A74] bg-[#F4F7F5] px-2 py-0.5 rounded-full border border-[#E2EAE5]">
                Weekly
              </span>
            </div>
            <p className="text-xs text-[#687A74] mt-1">
              Weekly incoming ticket volume distribution
            </p>
          </div>

          {/* Styled Bar Chart with Dynamic Hover Tooltip */}
          <div className="pt-4 pb-2 px-1 relative">
            {hoveredBarIndex !== null && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#172B28] text-white text-[10px] font-mono py-1 px-2.5 rounded-lg shadow-md z-30 pointer-events-none animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap flex items-center space-x-1.5">
                <span className="font-bold text-emerald-300">{dailyWorkload[hoveredBarIndex].name}:</span>
                <span>{dailyWorkload[hoveredBarIndex].count.toLocaleString()} tickets ({dailyWorkload[hoveredBarIndex].pct}% of peak)</span>
              </div>
            )}

            <div className="flex items-end justify-between gap-2.5 h-36">
              {dailyWorkload.map((item, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredBarIndex(idx)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                  className="flex-1 flex flex-col items-center gap-2 relative group cursor-pointer"
                >
                  {/* Floating Peak Badge */}
                  {item.badge && hoveredBarIndex === null && (
                    <div className="absolute -top-7 px-2 py-0.5 rounded-full bg-[#172B28] text-white text-[10px] font-mono font-bold shadow-xs whitespace-nowrap animate-bounce duration-1000">
                      {item.badge}
                    </div>
                  )}

                  {/* Bar Capsule */}
                  {item.hatched ? (
                    <div
                      className={`w-full ${item.height} rounded-full border border-[#E2EAE5] transition-all duration-200 group-hover:border-[#145C43] group-hover:scale-y-105 origin-bottom`}
                      style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #F4F7F5, #F4F7F5 3px, #E2EAE5 3px, #E2EAE5 6px)',
                      }}
                    />
                  ) : (
                    <div
                      className={`w-full ${item.height} rounded-full ${item.color} transition-all duration-200 group-hover:scale-y-105 group-hover:brightness-110 shadow-2xs origin-bottom`}
                    />
                  )}

                  {/* Day Label */}
                  <span
                    className={`text-[11px] font-semibold transition-colors duration-150 ${
                      idx === hoveredBarIndex ? 'text-[#145C43] font-bold scale-110' : item.hatched ? 'text-[#8A9B96]' : 'text-[#172B28]'
                    }`}
                  >
                    {item.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Operational Insights / AI Alerts */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 shadow-2xs flex flex-col justify-between space-y-3.5 hover:shadow-xs transition-shadow">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#172B28] uppercase tracking-wider">AI Alert</h3>
              <span className="text-[10px] font-mono text-[#145C43] bg-[#E7F0EA] px-2 py-0.5 rounded-full font-bold border border-[#B8D0C1]/50">
                Active Intelligence
              </span>
            </div>
            <p className="text-xs text-[#687A74] mt-1">
              Evidence-based workload imbalance and category lag warnings.
            </p>
          </div>

          <div className="space-y-3">
            {alerts.map((al, idx) => {
              const isDanger = al.type === 'danger';
              const isWarning = al.type === 'warning';
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border text-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-2xs cursor-pointer group ${
                    isDanger
                      ? 'bg-rose-50/70 border-rose-200/70 text-rose-800 hover:bg-rose-50'
                      : isWarning
                      ? 'bg-amber-50/70 border-amber-200/70 text-amber-800 hover:bg-amber-50'
                      : 'bg-[#F4F7F5] border-[#E2EAE5] text-[#172B28] hover:bg-white hover:border-[#145C43]/40'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {isDanger ? (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                        </span>
                      ) : (
                        <Activity className="w-3.5 h-3.5 text-[#145C43] group-hover:scale-110 transition-transform" />
                      )}
                      <span>{al.title}</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${
                        isDanger
                          ? 'text-rose-700 bg-white/80 group-hover:bg-white'
                          : isWarning
                          ? 'text-amber-700 bg-white/80 group-hover:bg-white'
                          : 'text-[#687A74] bg-white border border-[#E2EAE5] group-hover:border-[#145C43]/20'
                      }`}
                    >
                      {al.badge}
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed text-[#687A74]">
                    {al.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Full-width Optimizer Trigger Button */}
          <button
            onClick={onRunAutoOptimizer}
            className="w-full py-2.5 rounded-xl bg-[#145C43] hover:bg-[#103D30] text-white text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-98 flex items-center justify-center space-x-2 group"
          >
            <Zap className="w-3.5 h-3.5 text-[#DCE9E1] group-hover:rotate-12 transition-transform duration-200" />
            <span>Review &amp; Optimize</span>
          </button>
        </div>

        {/* Column 3: Priority Incident Stream */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-shadow">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#E2EAE5]">
              <h3 className="text-xs font-bold text-[#172B28] uppercase tracking-wider">Live Incident Stream</h3>
              {onNavigateToTriage && (
                <button
                  onClick={onNavigateToTriage}
                  className="px-2.5 py-1 rounded-full text-xs text-[#145C43] hover:bg-[#E7F0EA] font-semibold cursor-pointer border border-[#E2EAE5] hover:border-[#145C43]/30 transition-all active:scale-95 flex items-center space-x-1"
                >
                  <span>View All ({queueCount.toLocaleString()})</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-[#E2EAE5]/60 mt-1">
              {incidentList.length > 0 ? (
                incidentList.map((inc) => {
                  const hasRisk = inc.riskScore != null;
                  const isHigh = inc.riskScore >= 80;
                  return (
                    <div
                      key={inc.id}
                      onClick={() => onSelectTicket && onSelectTicket(inc)}
                      className="py-2.5 flex items-center justify-between gap-3 hover:bg-[#F4F7F5] -mx-2 px-2.5 rounded-xl cursor-pointer transition-all duration-150 hover:translate-x-1 group"
                      title="Click to view explainability and dispatch actions"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          {isHigh && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60"></span>
                          )}
                          <span
                            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                              isHigh ? 'bg-rose-500' : hasRisk ? 'bg-amber-500' : 'bg-slate-400'
                            }`}
                          />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#172B28] truncate group-hover:text-[#145C43] transition-colors">
                            {inc.problem || inc.title || `Incident ${inc.id}`}
                          </div>
                          <div className="text-[10px] text-[#687A74] font-mono mt-0.5">
                            {inc.category} • <strong className="text-[#172B28] group-hover:text-[#145C43] transition-colors">{inc.id}</strong>
                            {' • '}
                            {hasRisk ? (
                              <span className={isHigh ? 'text-rose-600 font-bold' : 'text-[#687A74]'}>
                                Risk {inc.riskScore}/100
                              </span>
                            ) : (
                              <span className="text-[#8A9B96] italic">Unscorable (No deadline)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-[#8A9B96] opacity-0 group-hover:opacity-100 group-hover:text-[#145C43] group-hover:translate-x-1 transition-all duration-150 shrink-0" />
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-[#8A9B96] font-mono">
                  No incidents in current dataset queue.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION C — SECONDARY OPERATIONAL PANELS
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. Squad Workload Panel */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2EAE5]">
            <div>
              <h3 className="text-xs font-bold text-[#172B28] uppercase tracking-wider">Squad Workload</h3>
              <p className="text-[11px] text-[#687A74] mt-0.5">Capacity utilization across active operational teams</p>
            </div>
            {onNavigateToSquads && (
              <button
                onClick={onNavigateToSquads}
                className="text-xs text-[#145C43] hover:underline font-semibold cursor-pointer flex items-center space-x-1 group"
              >
                <span>View Squads</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {hasAssignedTeams && squadList.length > 0 ? (
              squadList.map((sq) => {
                const utilPct = Math.min(100, Math.round((sq.activeTickets / sq.maxCapacity) * 100));
                const isOverloaded = sq.activeTickets >= sq.maxCapacity || utilPct >= 85;

                return (
                  <div
                    key={sq.id}
                    onClick={onNavigateToSquads}
                    className="p-2.5 rounded-xl border border-[#E2EAE5] hover:border-[#145C43]/40 hover:bg-[#F4F7F5] hover:-translate-y-0.5 hover:shadow-2xs transition-all duration-150 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className="w-5 h-5 rounded-md bg-[#DCE9E1] text-[#145C43] flex items-center justify-center text-[10px] font-bold shrink-0 group-hover:scale-105 transition-transform">
                          <UsersRound className="w-3 h-3" />
                        </div>
                        <span className="font-semibold text-[#172B28] truncate group-hover:text-[#145C43] transition-colors">
                          {sq.name.split('—')[0]}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-[#687A74]">
                        <strong className={isOverloaded ? 'text-rose-600 font-bold' : 'text-[#172B28]'}>
                          {sq.activeTickets}
                        </strong>{' '}
                        / {sq.maxCapacity} ({utilPct}%)
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-[#E2EAE5] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          isOverloaded ? 'bg-[#DC465C]' : utilPct >= 65 ? 'bg-[#E59A32]' : 'bg-[#145C43]'
                        }`}
                        style={{ width: `${utilPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-[#E2EAE5] text-[#687A74] flex items-center justify-center mx-auto">
                  <UsersRound className="w-4 h-4" />
                </div>
                <div className="text-xs font-semibold text-[#172B28]">
                  Unassigned Incident Backlog ({queueCount.toLocaleString()} tickets)
                </div>
                <p className="text-[11px] text-[#687A74] leading-relaxed">
                  Source dataset does not contain squad assignment tags. Use Tasks &amp; Queue to route tickets to operational teams.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 2. SLA Performance Panel */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2EAE5]">
            <div>
              <h3 className="text-xs font-bold text-[#172B28] uppercase tracking-wider">SLA Performance</h3>
              <p className="text-[11px] text-[#687A74] mt-0.5">Empirical compliance vs target boundaries</p>
            </div>

            {/* Segmented SLA Switcher */}
            <div className="flex items-center p-0.5 bg-[#F4F7F5] border border-[#E2EAE5] rounded-lg text-[10px]">
              <button
                onClick={() => handleTargetChange('resolution_deadline')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all duration-150 cursor-pointer ${
                  activeSlaTarget === 'resolution_deadline'
                    ? 'bg-white text-[#145C43] shadow-2xs border border-[#E2EAE5] scale-102 font-bold'
                    : 'text-[#687A74] hover:text-[#172B28] hover:bg-white/60'
                }`}
              >
                Resolution
              </button>
              <button
                onClick={() => handleTargetChange('response_deadline')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all duration-150 cursor-pointer ${
                  activeSlaTarget === 'response_deadline'
                    ? 'bg-white text-[#145C43] shadow-2xs border border-[#E2EAE5] scale-102 font-bold'
                    : 'text-[#687A74] hover:text-[#172B28] hover:bg-white/60'
                }`}
              >
                Response
              </button>
            </div>
          </div>

          {/* Semicircle Compliance Visualizer */}
          <div
            className="flex flex-col items-center justify-center py-2 group cursor-pointer"
            title={`Active Target: ${activeSlaTarget === 'response_deadline' ? 'Response SLA' : 'Resolution SLA'}`}
          >
            <div className="relative w-48 h-28 flex items-end justify-center group-hover:scale-105 transition-transform duration-300">
              <svg className="w-48 h-28 overflow-visible" viewBox="0 0 200 115">
                <path
                  d="M 25 105 A 75 75 0 0 1 175 105"
                  fill="none"
                  stroke="#E2EAE5"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {hasDeadlines && compliancePercent != null && (
                  <path
                    d="M 25 105 A 75 75 0 0 1 175 105"
                    fill="none"
                    stroke="#145C43"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray="235.6"
                    strokeDashoffset={235.6 * (1 - Math.min(Math.max(compliancePercent, 0), 100) / 100)}
                    className="transition-all duration-1000 ease-out"
                  />
                )}
              </svg>
              <div className="absolute inset-x-0 bottom-1 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-extrabold font-mono text-[#172B28] tracking-tight group-hover:text-[#145C43] transition-colors">
                  {hasDeadlines && compliancePercent != null ? `${compliancePercent}%` : 'N/A'}
                </span>
                <span className="text-[11px] font-semibold text-[#687A74] mt-0.5">
                  {hasDeadlines ? 'SLA Compliant' : 'No SLA Deadlines'}
                </span>
              </div>
            </div>

            {/* Semantic SLA Status Badges */}
            <div className="flex items-center justify-center space-x-3 mt-4 text-[10px] text-[#687A74] font-mono">
              <div className="flex items-center space-x-1.5 hover:text-[#145C43] transition-colors">
                <span className="w-2 h-2 rounded-full bg-[#145C43]" />
                <span>Compliant ({slaTargetData?.historical_met_sla_count || slaTargetData?.within_target_count || 0})</span>
              </div>
              <div className="flex items-center space-x-1.5 hover:text-[#DC465C] transition-colors">
                <span className="w-2 h-2 rounded-full bg-[#DC465C]" />
                <span>Breached ({breachedCount})</span>
              </div>
              <div className="flex items-center space-x-1.5 hover:text-[#172B28] transition-colors">
                <span className="w-2 h-2 rounded-full bg-[#687A74]" />
                <span>Active ({queueCount.toLocaleString()})</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Recent Operational Activity */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2EAE5]">
            <div>
              <h3 className="text-xs font-bold text-[#172B28] uppercase tracking-wider">Recent Activity</h3>
              <p className="text-[11px] text-[#687A74] mt-0.5">Manager decisions, shifts and audit logs</p>
            </div>
            {onNavigateToActions && (
              <button
                onClick={onNavigateToActions}
                className="text-xs text-[#145C43] hover:underline font-semibold cursor-pointer flex items-center space-x-1 group"
              >
                <span>Action Tracker</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* Activity 1: Dataset Status */}
            <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] text-xs hover:bg-white hover:border-[#145C43]/30 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group">
              <div className="w-6 h-6 rounded-lg bg-[#E7F0EA] text-[#145C43] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[#172B28] group-hover:text-[#145C43] transition-colors">
                  {activeDataset?.name || 'Dataset'} Active
                </div>
                <div className="text-[11px] text-[#687A74] mt-0.5">
                  {activeDataset?.total_rows || queueCount} records validated and staged in workspace.
                </div>
                <div className="text-[9px] font-mono text-[#8A9B96] mt-1">Staged • Verified Engine</div>
              </div>
            </div>

            {/* Activity 2: Latest Manager Decision */}
            {datasetDecisions.length > 0 ? (
              <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] text-xs hover:bg-white hover:border-[#145C43]/30 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group">
                <div className="w-6 h-6 rounded-lg bg-[#DCE9E1] text-[#145C43] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[#172B28] group-hover:text-[#145C43] transition-colors">
                    Decision: {datasetDecisions[0].decision_type?.toUpperCase()}
                  </div>
                  <div className="text-[11px] text-[#687A74] mt-0.5 truncate">
                    {datasetDecisions[0].reason || `Applied to ticket ${datasetDecisions[0].source_ticket_id}`}
                  </div>
                  <div className="text-[9px] font-mono text-[#8A9B96] mt-1">
                    Ticket {datasetDecisions[0].source_ticket_id} • Operations Lead
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] text-xs hover:bg-white hover:border-[#145C43]/30 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group">
                <div className="w-6 h-6 rounded-lg bg-slate-100 text-[#687A74] flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[#172B28]">No Manager Decisions Yet</div>
                  <div className="text-[11px] text-[#687A74] mt-0.5">
                    Click 'Review &amp; Optimize' to review and approve actions for this dataset.
                  </div>
                  <div className="text-[9px] font-mono text-[#8A9B96] mt-1">Awaiting Interventions</div>
                </div>
              </div>
            )}

            {/* Activity 3: Latest Tracked Action or Queue Health */}
            {datasetActions.length > 0 ? (
              <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] text-xs hover:bg-white hover:border-[#145C43]/30 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[#172B28] group-hover:text-[#145C43] transition-colors">
                    Action: {datasetActions[0].action_type?.toUpperCase()}
                  </div>
                  <div className="text-[11px] text-[#687A74] mt-0.5">
                    Status: <strong className="text-[#145C43]">{datasetActions[0].status}</strong> • Ticket {datasetActions[0].source_ticket_id}
                  </div>
                  <div className="text-[9px] font-mono text-[#8A9B96] mt-1">Lifecycle Engine</div>
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] text-xs hover:bg-white hover:border-[#145C43]/30 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group">
                <div className="w-6 h-6 rounded-lg bg-[#DCE9E1] text-[#145C43] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[#172B28] group-hover:text-[#145C43] transition-colors">
                    Continuous Monitoring Active
                  </div>
                  <div className="text-[11px] text-[#687A74] mt-0.5">
                    Automated SLA risk calculations active across {queueCount.toLocaleString()} incidents.
                  </div>
                  <div className="text-[9px] font-mono text-[#8A9B96] mt-1">Live Engine State</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
