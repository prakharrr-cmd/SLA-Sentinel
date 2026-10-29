import React, { useState } from 'react';
import { PERFORMANCE_SCORECARD } from '../data/mockData';

export default function ImpactScorecardView() {
  const [viewMode, setViewMode] = useState('comparison');
  const { baseline, proposed, improvements } = PERFORMANCE_SCORECARD;

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 border-b border-[#2D4A53]">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 bg-[#132E35] border border-[#2D4A53] text-[#AFB3B7]">
              PILLAR 5 • DELIVERABLE 4
            </span>
            <span className="text-xs text-[#69818D]">Measurable Performance Benchmark</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#AFB3B7] mt-1">
            Baseline vs. AI Decision Engine Scorecard
          </h2>
          <p className="text-xs text-[#69818D] mt-1 max-w-2xl">
            Direct comparison proving measurable gains across turnaround time, team productivity, and customer service quality.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-[#132E35] p-1 text-xs font-medium border border-[#2D4A53]">
          <button
            onClick={() => setViewMode('comparison')}
            className={`px-3 py-1.5 transition cursor-pointer ${
              viewMode === 'comparison'
                ? 'bg-[#2D4A53] text-[#AFB3B7] font-semibold'
                : 'text-[#69818D] hover:text-[#AFB3B7]'
            }`}
          >
            Side-by-Side
          </button>
          <button
            onClick={() => setViewMode('baseline')}
            className={`px-3 py-1.5 transition cursor-pointer ${
              viewMode === 'baseline'
                ? 'bg-[#2D4A53] text-[#AFB3B7] font-semibold'
                : 'text-[#69818D] hover:text-[#AFB3B7]'
            }`}
          >
            Baseline Only
          </button>
          <button
            onClick={() => setViewMode('proposed')}
            className={`px-3 py-1.5 transition cursor-pointer ${
              viewMode === 'proposed'
                ? 'bg-[#2D4A53] text-[#AFB3B7] font-semibold'
                : 'text-[#69818D] hover:text-[#AFB3B7]'
            }`}
          >
            AI Engine Only
          </button>
        </div>
      </div>

      {/* 5 Core Measurable Impact Metrics (Sharp cards, #132E35) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Metric 1 */}
        <div className="bg-[#132E35] border border-[#2D4A53] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#69818D] uppercase tracking-wider">
              1. Service Level Compliance
            </span>
            <div className="flex items-baseline space-x-3 mt-3">
              {(viewMode === 'comparison' || viewMode === 'baseline') && (
                <span className={`text-xl font-bold font-mono ${viewMode === 'comparison' ? 'line-through text-[#69818D]' : 'text-[#AFB3B7]'}`}>
                  {baseline.slaComplianceRate}
                </span>
              )}
              {viewMode === 'comparison' && <span className="text-[#69818D]">→</span>}
              {(viewMode === 'comparison' || viewMode === 'proposed') && (
                <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                  {proposed.slaComplianceRate}
                </span>
              )}
            </div>
            <p className="text-xs text-[#69818D] mt-2">
              Percentage of 1,000 daily tickets resolved within customer SLA threshold.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2D4A53] text-xs font-bold text-emerald-400 font-mono">
            {improvements.slaGain} net SLA improvement
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#132E35] border border-[#2D4A53] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#69818D] uppercase tracking-wider">
              2. Mean Turnaround Time (MTTR)
            </span>
            <div className="flex items-baseline space-x-3 mt-3">
              {(viewMode === 'comparison' || viewMode === 'baseline') && (
                <span className={`text-xl font-bold font-mono ${viewMode === 'comparison' ? 'line-through text-[#69818D]' : 'text-[#AFB3B7]'}`}>
                  {baseline.avgTurnaroundHours}
                </span>
              )}
              {viewMode === 'comparison' && <span className="text-[#69818D]">→</span>}
              {(viewMode === 'comparison' || viewMode === 'proposed') && (
                <span className="text-3xl font-extrabold text-[#AFB3B7] font-mono">
                  {proposed.avgTurnaroundHours}
                </span>
              )}
            </div>
            <p className="text-xs text-[#69818D] mt-2">
              Average hours to diagnose, assign, and resolve an incoming support issue.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2D4A53] text-xs font-bold text-[#AFB3B7] font-mono">
            {improvements.timeReduction} faster resolution cycle
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#132E35] border border-[#2D4A53] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#69818D] uppercase tracking-wider">
              3. Squad Overload Duration
            </span>
            <div className="flex items-baseline space-x-3 mt-3">
              {(viewMode === 'comparison' || viewMode === 'baseline') && (
                <span className={`text-xl font-bold font-mono ${viewMode === 'comparison' ? 'line-through text-[#69818D]' : 'text-[#AFB3B7]'}`}>
                  {baseline.overloadedSquadHours}
                </span>
              )}
              {viewMode === 'comparison' && <span className="text-[#69818D]">→</span>}
              {(viewMode === 'comparison' || viewMode === 'proposed') && (
                <span className="text-3xl font-extrabold text-cyan-400 font-mono">
                  {proposed.overloadedSquadHours}
                </span>
              )}
            </div>
            <p className="text-xs text-[#69818D] mt-2">
              Hours squads operate above 80% concurrent capacity limit.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2D4A53] text-xs font-bold text-cyan-400 font-mono">
            {improvements.burnoutReduction} burnout reduction
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#132E35] border border-[#2D4A53] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#69818D] uppercase tracking-wider">
              4. Monthly SLA Violations
            </span>
            <div className="flex items-baseline space-x-3 mt-3">
              {(viewMode === 'comparison' || viewMode === 'baseline') && (
                <span className={`text-xl font-bold font-mono text-rose-400 ${viewMode === 'comparison' ? 'line-through' : ''}`}>
                  {baseline.monthlyBreaches}
                </span>
              )}
              {viewMode === 'comparison' && <span className="text-[#69818D]">→</span>}
              {(viewMode === 'comparison' || viewMode === 'proposed') && (
                <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                  {proposed.monthlyBreaches}
                </span>
              )}
            </div>
            <p className="text-xs text-[#69818D] mt-2">
              Total customer incidents exceeding contractual resolution deadlines.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2D4A53] text-xs font-bold text-emerald-400 font-mono">
            {improvements.breachReduction} fewer contractual breaches
          </div>
        </div>

        {/* Metric 5 */}
        <div className="bg-[#132E35] border border-[#2D4A53] p-6 shadow-xs flex flex-col justify-between md:col-span-2">
          <div>
            <span className="text-[10px] font-bold text-[#69818D] uppercase tracking-wider">
              5. Overall Operational Productivity Index
            </span>
            <div className="flex items-baseline space-x-3 mt-3">
              {(viewMode === 'comparison' || viewMode === 'baseline') && (
                <span className={`text-xl font-bold font-mono ${viewMode === 'comparison' ? 'line-through text-[#69818D]' : 'text-[#AFB3B7]'}`}>
                  {baseline.productivityIndex}
                </span>
              )}
              {viewMode === 'comparison' && <span className="text-[#69818D]">→</span>}
              {(viewMode === 'comparison' || viewMode === 'proposed') && (
                <span className="text-3xl font-extrabold text-[#AFB3B7] font-mono">
                  {proposed.productivityIndex}
                </span>
              )}
            </div>
            <p className="text-xs text-[#69818D] mt-2">
              Composite efficiency score evaluating throughput, squad balance, and mean response latency.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2D4A53] text-xs font-bold text-[#AFB3B7] font-mono">
            {improvements.productivityGain} operational throughput boost
          </div>
        </div>

      </div>

    </div>
  );
}
