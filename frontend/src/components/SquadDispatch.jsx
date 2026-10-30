import React, { useState } from 'react';

export default function SquadDispatch({ teams, tickets, onOpenTransferModal }) {
  const [selectedSquad, setSelectedSquad] = useState(teams[0]?.id || 'team-a');

  const activeSquadObj = teams.find(t => t.id === selectedSquad);
  const squadTickets = tickets.filter(t => t.assignedTeamId === selectedSquad);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-[#E2EAE5] shadow-2xs">
        <h2 className="text-lg font-bold text-[#172B28] mb-1">Squad Bandwidth &amp; Capacity Allocation</h2>
        <p className="text-xs text-[#667873] mb-5">Click a squad card to view active tasks and balance workload</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {teams.map(team => {
            const util = Math.round((team.activeTickets / team.maxCapacity) * 100);
            const isOverloaded = util >= 80;
            const isSelected = selectedSquad === team.id;

            return (
              <div
                key={team.id}
                onClick={() => setSelectedSquad(team.id)}
                className={`rounded-xl p-5 border transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#DCE9E1]/30 border-[#145C43] shadow-2xs'
                    : 'bg-white border-[#E2EAE5] hover:border-[#145C43]/40 hover:bg-[#F4F7F5]'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-[#172B28]">{team.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isOverloaded ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-[#145C43] border border-emerald-200'
                  }`}>
                    {isOverloaded ? 'OVERLOADED' : 'AVAILABLE'}
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-xs text-[#667873]">
                    <span>Load</span>
                    <span className="font-bold text-[#172B28] font-mono">{util}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#E2EAE5] rounded-full overflow-hidden">
                    <div style={{ width: `${Math.min(100, util)}%` }} className={`h-full rounded-full ${isOverloaded ? 'bg-rose-600' : 'bg-[#145C43]'}`}></div>
                  </div>
                  <div className="text-[10px] text-[#667873]">{team.activeTickets} of {team.maxCapacity} slots filled</div>
                </div>
                <div className="pt-2 border-t border-[#E2EAE5] text-[11px] text-[#667873]">
                  Lead: <strong className="text-[#172B28]">{team.lead}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Squad Queue */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2EAE5] shadow-2xs">
        <h3 className="text-sm font-bold text-[#172B28] mb-1">Active Tasks in {activeSquadObj?.name}</h3>
        <p className="text-xs text-[#667873] mb-4">Click Transfer Task to select any available squad</p>
        
        <div className="divide-y divide-[#E2EAE5]">
          {squadTickets.map(t => (
            <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-xs text-[#172B28]">{t.id}</span>
                  <span className="text-xs text-[#667873]">• {t.category}</span>
                </div>
                <div className="text-xs font-semibold text-[#172B28] mt-0.5">{t.problem}</div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-[#667873] font-mono">{t.deadlineHoursLeft}h left</span>
                <button
                  onClick={() => onOpenTransferModal(t)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#145C43] hover:bg-[#103D30] text-white transition cursor-pointer shadow-2xs"
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
