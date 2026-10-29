import React from 'react';

export default function ExecutiveGreeting({
  user,
  kpis,
  onRunAutoOptimizer,
  onOpenUpload
}) {
  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Plan, prioritize, and accomplish your tasks with ease.</p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            onClick={onRunAutoOptimizer}
            className="px-4 py-2.5 rounded-2xl bg-[#134E39] hover:bg-[#0E3A2B] text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
          >
            <span>+</span>
            <span>⚡ Auto-Optimize</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200/90 shadow-2xs transition cursor-pointer"
          >
            Import Data
          </button>
        </div>
      </div>

      {/* 4 Donezo Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Primary Dark Green Hero */}
        <div className="bg-[#134E39] rounded-3xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-100">Total Projects</span>
            <div className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs transition cursor-pointer">
              ↗
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl lg:text-4xl font-extrabold tracking-tight">24</div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-emerald-200">
            <span className="px-1.5 py-0.5 rounded-md bg-white/15 text-white font-semibold text-[10px]">5 ↗</span>
            <span>Increased from last month</span>
          </div>
        </div>

        {/* Card 2: Ended Projects */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ended Projects</span>
            <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 text-xs hover:bg-slate-50 transition cursor-pointer">
              ↗
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">10</div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">6 ↗</span>
            <span>Increased from last month</span>
          </div>
        </div>

        {/* Card 3: Running Projects */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Running Projects</span>
            <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 text-xs hover:bg-slate-50 transition cursor-pointer">
              ↗
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">12</div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">2 ↗</span>
            <span>Increased from last month</span>
          </div>
        </div>

        {/* Card 4: Pending Project */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Project</span>
            <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 text-xs hover:bg-slate-50 transition cursor-pointer">
              ↗
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">2</div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-amber-700">
            <span className="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 font-semibold text-[10px]">On Discuss</span>
            <span>SLA monitor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
