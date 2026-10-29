import React, { useState } from 'react';

export default function TicketTable({ tickets, teams, onSelectTicket, onReassign, onEscalate }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const filteredTickets = tickets.filter(t => {
    if (filter === 'High' && t.riskLevel !== 'High') return false;
    if (filter === 'Breached' && t.deadlineHoursLeft > 0) return false;
    if (filter === 'Payments' && t.category !== 'Payments') return false;
    if (filter === 'Infrastructure' && t.category !== 'Infrastructure') return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return t.id.toLowerCase().includes(q) || t.problem.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Operational Triage Queue</h2>
          <p className="text-xs text-slate-400">Real-time incident stream, SLA countdown, and squad balancing</p>
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
          {['All', 'High', 'Breached', 'Payments', 'Infrastructure'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition ${
                filter === cat
                  ? 'bg-[#134E39] text-white border-[#134E39]'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase text-[10px]">
              <th className="py-3.5 px-6">ID</th>
              <th className="py-3.5 px-6">Problem</th>
              <th className="py-3.5 px-6">Priority</th>
              <th className="py-3.5 px-6">SLA Countdown</th>
              <th className="py-3.5 px-6">Risk</th>
              <th className="py-3.5 px-6">Assigned Squad</th>
              <th className="py-3.5 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTickets.map(ticket => {
              const team = teams.find(t => t.id === ticket.assignedTeamId);
              const isOverdue = ticket.deadlineHoursLeft <= 0;

              return (
                <tr key={ticket.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 px-6 font-mono font-bold text-slate-900">
                    <button onClick={() => onSelectTicket(ticket)} className="hover:underline cursor-pointer">
                      {ticket.id}
                    </button>
                  </td>
                  <td className="py-4 px-6 max-w-sm">
                    <div className="font-semibold text-slate-900">{ticket.problem}</div>
                    <div className="text-[11px] text-slate-400">{ticket.category} • Pending {ticket.pendingHours}h</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      ticket.priority === 'Critical' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className={`font-semibold ${isOverdue ? 'text-rose-600 font-mono' : 'text-slate-800'}`}>
                      {isOverdue ? 'Breached (Overdue)' : `${ticket.deadlineHoursLeft}h remaining`}
                    </div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      ticket.riskLevel === 'High' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {ticket.riskScore}/100
                    </span>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="font-semibold text-slate-900">{team ? team.name.split('-')[0] : 'Unassigned'}</div>
                    <div className="text-[11px] text-slate-400">Lead: {team?.lead}</div>
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <button
                      onClick={() => onReassign(ticket.id, 'team-b')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#134E39] hover:bg-[#0E3A2B] text-white mr-1.5 transition cursor-pointer"
                    >
                      Transfer
                    </button>
                    <button
                      onClick={() => onSelectTicket(ticket)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Evidence
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
