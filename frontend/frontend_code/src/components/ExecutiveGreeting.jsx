import React from 'react';

export default function ExecutiveGreeting({
  user,
  kpis,
  onRunAutoOptimizer,
  onOpenNewTicketModal,
  onOpenCsvModal
}) {
  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Plan, prioritize, and protect service level agreements with ease.</p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          {onOpenCsvModal && (
            <button
              onClick={onOpenCsvModal}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <span>📂</span>
              <span>Import CSV</span>
            </button>
          )}
          {onOpenNewTicketModal && (
            <button
              onClick={onOpenNewTicketModal}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <span>+</span>
              <span>Assign Ticket</span>
            </button>
          )}
          <button
            onClick={onRunAutoOptimizer}
            className="px-4 py-2.5 rounded-2xl bg-[#132E35] hover:bg-[#0D1F23] text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
          >
            <span>⚡</span>
            <span>Review &amp; Optimize</span>
          </button>
        </div>
      </div>

      {/* 4 Donezo Metric Cards with DEV-103 Data & Brand Slate-Spruce Palette */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Primary Dark Hero (#132E35 to #0D1F23) */}
        <div className="bg-gradient-to-br from-[#132E35] to-[#0D1F23] rounded-3xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#AFB3B7]">Total At-Risk</span>
            <div className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs transition cursor-pointer">
              ↗
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl lg:text-4xl font-extrabold tracking-tight">{kpis?.highRiskTickets ?? 5}</div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-[#AFB3B7]">
            <span className="px-1.5 py-0.5 rounded-md bg-[#2D4A53] text-white font-semibold text-[10px]">Pillar 2</span>
            <span>Predicted SLA breach risk</span>
          </div>
        </div>

        {/* Card 2: SLA Breached */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">SLA Breached</span>
            <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 text-xs hover:bg-slate-50 transition cursor-pointer">
              ↗
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl lg:text-4xl font-extrabold text-rose-600 tracking-tight">{kpis?.slaBreached ?? 1}</div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
            <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[10px]">Critical</span>
            <span>Past deadline limit</span>
          </div>
        </div>

        {/* Card 3: Active Queue */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Queue</span>
            <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 text-xs hover:bg-slate-50 transition cursor-pointer">
              ↗
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">{kpis?.totalTickets ?? 7}</div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">Active</span>
            <span>Across 4 operation squads</span>
          </div>
        </div>

        {/* Card 4: Overloaded Squads */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Overloaded Squads</span>
            <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 text-xs hover:bg-slate-50 transition cursor-pointer">
              ↗
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
              {kpis?.overloadedTeams ?? 2}<span className="text-base font-normal text-slate-400"> / 4</span>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
            <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[10px]">
              {(kpis?.overloadedTeams ?? 2) > 0 ? 'Rebalance Advised' : 'Optimal'}
            </span>
            <span>Capacity limit &gt; 80%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
