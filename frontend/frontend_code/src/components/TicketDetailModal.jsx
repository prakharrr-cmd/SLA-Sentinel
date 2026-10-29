import React from 'react';

export default function TicketDetailModal({ ticket, teams, onClose, onReassign, onEscalate }) {
  if (!ticket) return null;

  const currentTeam = teams.find(t => t.id === ticket.assignedTeamId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-[#132E35] border border-[#2D4A53] max-w-lg w-full p-6 shadow-2xl text-xs">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#2D4A53]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-[#0D1F23] border border-[#2D4A53] text-[#AFB3B7]">
                {ticket.id}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 ${
                ticket.priority === 'Critical'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {ticket.priority} Priority
              </span>
              <span className="text-[#69818D]">• {ticket.category}</span>
            </div>
            <h2 className="text-base font-bold text-[#AFB3B7] mt-1.5">
              {ticket.problem}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-[#69818D] hover:text-[#AFB3B7] cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Risk Assessment Box */}
        <div className="py-4 space-y-3">
          <div className="p-3.5 bg-[#0D1F23] border border-[#2D4A53]">
            <div className="font-bold text-[#AFB3B7] mb-1 flex items-center justify-between">
              <span>Decision Explanation</span>
              <span className="text-rose-400 font-mono">{ticket.riskScore}/100 Risk</span>
            </div>
            <p className="text-[#69818D] leading-relaxed">
              {ticket.flagReason}
            </p>
          </div>

          {/* Key Parameters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border border-[#2D4A53] bg-[#0D1F23]">
              <span className="text-[10px] uppercase font-bold text-[#69818D]">Current Squad</span>
              <div className="font-semibold text-[#AFB3B7] mt-0.5">{currentTeam?.name}</div>
              <div className="text-[10px] text-[#69818D] mt-0.5 font-mono">{currentTeam?.activeTickets} / {currentTeam?.maxCapacity} active</div>
            </div>

            <div className="p-3 border border-[#2D4A53] bg-[#0D1F23]">
              <span className="text-[10px] uppercase font-bold text-[#69818D]">SLA Countdown</span>
              <div className={`font-semibold mt-0.5 ${ticket.deadlineHoursLeft <= 0 ? 'text-rose-400 font-mono' : 'text-[#AFB3B7] font-mono'}`}>
                {ticket.deadlineHoursLeft <= 0 ? 'Breached (Overdue)' : `${ticket.deadlineHoursLeft} hours remaining`}
              </div>
              <div className="text-[10px] text-[#69818D] mt-0.5">Pending {ticket.pendingHours}h</div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-3 border-t border-[#2D4A53] flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#69818D] hover:text-[#AFB3B7] bg-[#0D1F23] border border-[#2D4A53] cursor-pointer"
          >
            Close
          </button>

          <button
            onClick={() => {
              onEscalate(ticket.id, 'Manager Escalation');
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border border-rose-500/50 cursor-pointer"
          >
            Escalate to Lead
          </button>

          <button
            onClick={() => {
              onReassign(ticket.id, 'team-b');
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#2D4A53] hover:bg-[#395d68] text-[#AFB3B7] border border-[#5A636A] cursor-pointer"
          >
            Transfer to Team B (Available)
          </button>
        </div>

      </div>
    </div>
  );
}
