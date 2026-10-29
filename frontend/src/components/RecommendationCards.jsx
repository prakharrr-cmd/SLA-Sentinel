import React from 'react';

export default function RecommendationCards({ tickets, teams, onReassign, onEscalate, onSelectTicket }) {
  const actionableTickets = tickets.filter(
    t => (t.actionType === 'Reassign' || t.actionType === 'Escalate') && !t.actionTaken
  ).slice(0, 2);

  if (actionableTickets.length === 0) {
    return (
      <div className="bg-[#132E35] border border-emerald-500/40 p-4 mb-6 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold">
            ✓
          </div>
          <div>
            <div className="font-bold text-[#AFB3B7]">Operations Balanced</div>
            <div className="text-[#69818D]">All urgent tasks have been reallocated. Squad capacities are balanced.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#69818D]">
            Prescriptive Recommendations
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#132E35] border border-[#2D4A53] text-[#AFB3B7]">
            {actionableTickets.length} pending sign-off
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionableTickets.map(ticket => {
          const isReassign = ticket.actionType === 'Reassign';
          const isEscalate = ticket.actionType === 'Escalate';
          const currentTeam = teams.find(tm => tm.id === ticket.assignedTeamId);
          const targetTeam = teams.find(tm => tm.id === ticket.recommendedTeamId) || teams.find(tm => tm.id === 'team-b');

          return (
            <div
              key={ticket.id}
              className="bg-[#132E35] border border-[#2D4A53] p-5 flex flex-col justify-between hover:border-[#5A636A] transition text-xs"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold px-1.5 py-0.5 bg-[#0D1F23] border border-[#2D4A53] text-[#AFB3B7]">
                      {ticket.id}
                    </span>
                    <span className="text-[#69818D]">• {ticket.category}</span>
                  </div>
                  <span className="font-semibold text-rose-400 font-mono">
                    {ticket.deadlineHoursLeft > 0 ? `${ticket.deadlineHoursLeft}h until breach` : 'Past Deadline'}
                  </span>
                </div>

                {/* Problem summary */}
                <h3 className="text-sm font-semibold text-[#AFB3B7] line-clamp-1 mb-2">
                  {ticket.problem}
                </h3>

                {/* Plain English reasoning */}
                <div className="bg-[#0D1F23] border border-[#2D4A53] p-3 text-xs text-[#69818D] mb-3 leading-relaxed">
                  {isReassign && targetTeam && (
                    <>
                      <strong className="text-[#AFB3B7]">{currentTeam?.name.split('-')[0]}</strong> is carrying {currentTeam?.activeTickets} tickets ({Math.round((currentTeam?.activeTickets / currentTeam?.maxCapacity) * 100)}% capacity). Reassigning to <strong className="text-[#AFB3B7]">{targetTeam.name.split('-')[0]}</strong> ({targetTeam.activeTickets}/{targetTeam.maxCapacity} load) balances squad bandwidth and protects SLA.
                    </>
                  )}
                  {isEscalate && (
                    <>
                      {ticket.flagReason} Immediate manager escalation advised.
                    </>
                  )}
                  <div className="text-[11px] text-[#AFB3B7] font-semibold mt-2 pt-1 border-t border-[#2D4A53]">
                    Estimated Impact: {ticket.impactEstimate}
                  </div>
                </div>
              </div>

              {/* Action buttons (Sharp corners) */}
              <div className="flex items-center space-x-2 pt-2 border-t border-[#2D4A53]">
                {isReassign && targetTeam && (
                  <button
                    onClick={() => onReassign(ticket.id, targetTeam.id)}
                    className="flex-1 py-2 px-3 text-xs font-semibold uppercase tracking-wider bg-[#2D4A53] hover:bg-[#395d68] text-[#AFB3B7] border border-[#5A636A] shadow-xs transition active:translate-y-px cursor-pointer"
                  >
                    Transfer to {targetTeam.name.split('-')[0]}
                  </button>
                )}

                {isEscalate && (
                  <button
                    onClick={() => onEscalate(ticket.id, 'Manager Escalation')}
                    className="flex-1 py-2 px-3 text-xs font-semibold uppercase tracking-wider bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border border-rose-500/50 shadow-xs transition active:translate-y-px cursor-pointer"
                  >
                    Escalate to Lead
                  </button>
                )}

                <button
                  onClick={() => onSelectTicket(ticket)}
                  className="py-2 px-3 text-xs font-medium bg-[#0D1F23] hover:bg-[#193A43] text-[#69818D] hover:text-[#AFB3B7] border border-[#2D4A53] transition cursor-pointer"
                >
                  Inspect
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
