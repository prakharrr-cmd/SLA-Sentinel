import React, { useState } from 'react';

export default function SquadDispatch({ teams, tickets, onReassign }) {
  const [selectedSquad, setSelectedSquad] = useState(teams[0]?.id || 'team-a');

  const activeSquadObj = teams.find(t => t.id === selectedSquad);
  const squadTickets = tickets.filter(t => t.assignedTeamId === selectedSquad);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Squad Bandwidth & Capacity Allocation</h2>
        <p className="text-xs text-slate-400 mb-5">Click a squad card to view active tasks and balance workload</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {teams.map(team => {
            const util = Math.round((team.activeTickets / team.maxCapacity) * 100);
            const isOverloaded = util >= 80;
            const isSelected = selectedSquad === team.id;

            return (
              <div
                key={team.id}
                onClick={() => setSelectedSquad(team.id)}
                className={`rounded-2xl p-5 border transition cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50/50 border-[#134E39] shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-900">{team.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isOverloaded ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-[#134E39] border border-emerald-200'
                  }`}>
                    {isOverloaded ? 'OVERLOADED' : 'AVAILABLE'}
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Load</span>
                    <span className="font-bold text-slate-800 font-mono">{util}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div style={{ width: `${Math.min(100, util)}%` }} className={`h-full rounded-full ${isOverloaded ? 'bg-rose-500' : 'bg-[#134E39]'}`}></div>
                  </div>
                  <div className="text-[10px] text-slate-400">{team.activeTickets} of {team.maxCapacity} slots filled</div>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  Lead: <strong className="text-slate-800">{team.lead}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Squad Queue */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-1">Active Tasks in {activeSquadObj?.name}</h3>
        <p className="text-xs text-slate-400 mb-4">Click Transfer to balance with available squads</p>
        
        <div className="divide-y divide-slate-100">
          {squadTickets.map(t => (
            <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-xs text-slate-900">{t.id}</span>
                  <span className="text-xs text-slate-500">• {t.category}</span>
                </div>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">{t.problem}</div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-mono">{t.deadlineHoursLeft}h left</span>
                <button
                  onClick={() => onReassign(t.id, selectedSquad === 'team-b' ? 'team-a' : 'team-b')}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#134E39] hover:bg-[#0E3A2B] text-white transition cursor-pointer"
                >
                  Transfer Task
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
