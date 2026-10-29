import React from 'react';

export default function RecommendationCards({ tickets, teams, onOpenTransferModal, onEscalate, onSelectTicket }) {
  const actionableTickets = tickets.filter(
    t => (t.actionType === 'Reassign' || t.actionType === 'Escalate') && !t.actionTaken
  ).slice(0, 2);

  if (actionableTickets.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 mb-6 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#132E35] flex items-center justify-center font-bold text-sm">
            ✓
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm">Operations Balanced</div>
            <div className="text-slate-500">All urgent tasks have been reallocated. Squad capacities are balanced.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-bold text-slate-900">
            Prescriptive Interventions Pending Review
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
            {actionableTickets.length} pending
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionableTickets.map(ticket => {
          const isReassign = ticket.actionType === 'Reassign';
          const isEscalate = ticket.actionType === 'Escalate';
          const currentTeam = teams.find(tm => tm.id === ticket.assignedTeamId);

          return (
            <div
              key={ticket.id}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between hover:border-slate-200 transition text-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800">
                      {ticket.id}
                    </span>
                    <span className="text-slate-500">• {ticket.category}</span>
                  </div>
                  <span className="font-semibold text-rose-600">
                    {ticket.deadlineHoursLeft > 0 ? `${ticket.deadlineHoursLeft}h until breach` : 'Past Deadline'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mb-2">
                  {ticket.problem}
                </h3>

                <div className="bg-slate-50 rounded-2xl p-3.5 text-xs text-slate-600 mb-3 leading-relaxed border border-slate-100">
                  {isReassign && (
                    <>
                      <strong className="text-slate-800">{currentTeam?.name.split('—')[0]}</strong> is carrying {currentTeam?.activeTickets} tickets ({Math.round(((currentTeam?.activeTickets || 0) / (currentTeam?.maxCapacity || 1)) * 100)}% capacity). Reassigning avoids SLA breach.
                    </>
                  )}
                  {isEscalate && (
                    <>
                      {ticket.flagReason || 'Critical incident requiring immediate manager escalation.'}
                    </>
                  )}
                  <div className="text-[11px] text-emerald-700 font-semibold mt-2 pt-1.5 border-t border-slate-200/80">
                    Estimated Impact: {ticket.impactEstimate}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                {isReassign && (
                  <button
                    onClick={() => onOpenTransferModal(ticket)}
                    className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-[#132E35] hover:bg-[#0D1F23] text-white shadow-xs transition cursor-pointer"
                  >
                    Transfer to Squad →
                  </button>
                )}

                {isEscalate && (
                  <button
                    onClick={() => onEscalate(ticket.id)}
                    className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
                  >
                    Escalate to Lead
                  </button>
                )}

                <button
                  onClick={() => onSelectTicket(ticket)}
                  className="py-2 px-3 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Evidence
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
