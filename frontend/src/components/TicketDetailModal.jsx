import React from 'react';
import { X } from 'lucide-react';

export default function TicketDetailModal({ ticket, teams = [], onClose, onReassign, onEscalate }) {
  if (!ticket) return null;

  const currentTeam = teams.find((t) => t.id === ticket.assignedTeamId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-[#E2EAE5] max-w-lg w-full p-6 shadow-xl text-xs space-y-4 animate-fade-in">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#E2EAE5]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#F4F7F5] border border-[#E2EAE5] text-[#172B28]">
                {ticket.id}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                ticket.priority === 'Critical'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {ticket.priority || 'Normal'} Priority
              </span>
              <span className="text-[#667873]">• {ticket.category || 'General'}</span>
            </div>
            <h2 className="text-base font-semibold text-[#172B28] mt-2 leading-snug">
              {ticket.problem}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-[#667873] hover:text-[#172B28] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Risk & Explanation Box */}
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5]">
            <div className="font-medium text-[#172B28] mb-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#667873]">Decision Explanation &amp; Risk Rating</span>
              <span className="text-rose-700 font-mono font-semibold text-xs">{ticket.riskScore}/100 Risk</span>
            </div>
            <p className="text-[#172B28] leading-relaxed">
              {ticket.flagReason || 'Deterministic risk calculated from SLA deadline countdown and current squad workload.'}
            </p>

            {ticket.evidence && Array.isArray(ticket.evidence) && ticket.evidence.length > 1 && (
              <div className="mt-3 pt-2.5 border-t border-[#E2EAE5] text-xs text-[#667873] space-y-1">
                <div className="text-[10px] uppercase font-semibold text-[#667873]">Evidence Factors:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[#172B28]">
                  {ticket.evidence.map((ev, idx) => (
                    <li key={idx}>{ev}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Key Parameters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-[#E2EAE5] bg-[#F4F7F5]">
              <span className="text-[10px] uppercase font-semibold text-[#667873]">Current Squad</span>
              <div className="font-medium text-[#172B28] mt-1">
                {currentTeam?.name || ticket.assignedTeamId || 'Unassigned'}
              </div>
              <div className="text-[11px] text-[#667873] mt-0.5 font-mono">
                {currentTeam ? `${currentTeam.activeTickets} / ${currentTeam.maxCapacity} active load` : 'No squad assigned'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E2EAE5] bg-[#F4F7F5]">
              <span className="text-[10px] uppercase font-semibold text-[#667873]">SLA Countdown</span>
              <div className={`font-mono font-medium mt-1 ${ticket.deadlineHoursLeft <= 0 ? 'text-rose-700 font-semibold' : 'text-[#172B28]'}`}>
                {ticket.deadlineHoursLeft <= 0 ? 'Breached (Overdue)' : `${ticket.deadlineHoursLeft} hours remaining`}
              </div>
              <div className="text-[11px] text-[#667873] mt-0.5">
                Current Status: {ticket.status || 'Active'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-3 border-t border-[#E2EAE5] flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#667873] hover:bg-[#F4F7F5] border border-[#E2EAE5] transition cursor-pointer"
          >
            Close
          </button>

          {onEscalate && (
            <button
              onClick={() => {
                onEscalate(ticket.id, 'Manager Escalation');
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
            >
              Escalate to Lead
            </button>
          )}

          {onReassign && (
            <button
              onClick={() => {
                onReassign(ticket);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-[#145C43] hover:bg-[#103D30] text-white transition cursor-pointer shadow-xs"
            >
              Transfer Squad →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
