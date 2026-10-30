import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function TicketTable({
  tickets = [],
  teams = [],
  onSelectTicket,
  onOpenTransferModal,
  onEscalate,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const filteredTickets = tickets.filter((t) => {
    // Risk filter
    if (filter === 'High' && t.riskLevel !== 'High') return false;
    if (filter === 'Medium' && t.riskLevel !== 'Medium') return false;
    if (filter === 'Breached' && t.deadlineHoursLeft > 0) return false;
    if (filter === 'Resolved' && t.status !== 'Resolved' && t.status !== 'Closed') return false;

    // Status filter
    if (statusFilter === 'Active' && (t.status === 'Resolved' || t.status === 'Closed')) return false;
    if (statusFilter === 'Historical' && (t.status !== 'Resolved' && t.status !== 'Closed')) return false;

    // Search query
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.id && t.id.toLowerCase().includes(q)) ||
      (t.problem && t.problem.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredTickets.length / pageSize) || 1;
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="bg-white rounded-xl border border-[#E2EAE5] shadow-xs overflow-hidden">
      {/* Table Header & Operational Filters */}
      <div className="p-5 border-b border-[#E2EAE5] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#172B28]">Operational Triage Queue</h2>
          <p className="text-xs text-[#667873] mt-0.5">
            {filteredTickets.length} incidents ranked by deterministic SLA risk score
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8A9B96] absolute left-2.5 top-2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search tickets..."
              className="pl-8 pr-3 py-1.5 border border-[#E2EAE5] rounded-lg text-xs text-[#172B28] bg-[#F4F7F5] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
            />
          </div>

          {/* Active / Historical Segment */}
          <div className="flex rounded-lg bg-[#F1F4F2] p-0.5 border border-[#E2EAE5]">
            {['All', 'Active', 'Historical'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition ${
                  statusFilter === st
                    ? 'bg-white text-[#172B28] shadow-2xs font-semibold'
                    : 'text-[#667873] hover:text-[#172B28]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Risk Filter Buttons */}
          <div className="flex items-center space-x-1 overflow-x-auto">
            {['All', 'High', 'Medium', 'Breached', 'Resolved'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setFilter(cat);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition ${
                  filter === cat
                    ? 'bg-[#DCE9E1]/80 text-[#145C43] font-semibold'
                    : 'text-[#667873] hover:text-[#172B28] hover:bg-[#F4F7F5]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E2EAE5] bg-[#F4F7F5] text-[#667873] font-medium text-[11px] uppercase tracking-wider">
              <th className="py-3 px-5">ID</th>
              <th className="py-3 px-5">Problem &amp; Category</th>
              <th className="py-3 px-5">Status</th>
              <th className="py-3 px-5">Priority</th>
              <th className="py-3 px-5">SLA Countdown</th>
              <th className="py-3 px-5">Risk Rating</th>
              <th className="py-3 px-5">Assigned Squad</th>
              <th className="py-3 px-5 text-right">Intervention</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2EAE5]">
            {paginatedTickets.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#667873] text-xs">
                  No matching tickets found in this operational queue view.
                </td>
              </tr>
            ) : (
              paginatedTickets.map((ticket) => {
                const team = teams.find((t) => t.id === ticket.assignedTeamId);
                const isOverdue = ticket.deadlineHoursLeft <= 0;
                const isResolved = ticket.status === 'Resolved' || ticket.status === 'Closed';

                return (
                  <tr 
                    key={ticket.id} 
                    onClick={() => onSelectTicket && onSelectTicket(ticket)}
                    className="hover:bg-[#F4F7F5] cursor-pointer transition-colors duration-150"
                  >
                    <td className="py-3 px-5 font-mono font-semibold text-[#145C43]">
                      <span className="hover:underline">
                        {ticket.id}
                      </span>
                    </td>

                    <td className="py-3 px-5 max-w-sm">
                      <div className="font-medium text-[#172B28] truncate">{ticket.problem}</div>
                      <div className="text-[11px] text-[#667873] mt-0.5">
                        {ticket.category || 'General'}
                        {ticket.pendingHours > 0 && ` • Pending ${ticket.pendingHours}h`}
                      </div>
                    </td>

                    <td className="py-3 px-5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        isResolved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        ticket.status === 'In Progress' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                        'bg-slate-50 text-[#667873] border border-slate-200'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>

                    <td className="py-3 px-5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        ticket.priority === 'Critical' ? 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold' :
                        ticket.priority === 'High' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-slate-50 text-[#667873]'
                      }`}>
                        {ticket.priority || 'Normal'}
                      </span>
                    </td>

                    <td className="py-3 px-5 whitespace-nowrap font-mono">
                      <div className={`font-medium ${isResolved ? 'text-emerald-700' : isOverdue ? 'text-rose-700 font-semibold' : 'text-[#172B28]'}`}>
                        {isResolved ? 'Resolved' : isOverdue ? 'Breached (Overdue)' : `${ticket.deadlineHoursLeft}h left`}
                      </div>
                    </td>

                    <td className="py-3 px-5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        ticket.riskLevel === 'High' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        ticket.riskLevel === 'Medium' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {ticket.riskScore}/100
                      </span>
                    </td>

                    <td className="py-3 px-5 whitespace-nowrap">
                      <div className="font-medium text-[#172B28]">
                        {team ? team.name.split('—')[0] : ticket.assignedTeamId || 'Unassigned'}
                      </div>
                      <div className="text-[11px] text-[#667873] mt-0.5 font-mono">
                        Load: {team ? `${team.activeTickets || 0}/${team.maxCapacity || 10}` : '—'}
                      </div>
                    </td>

                    <td className="py-3 px-5 text-right whitespace-nowrap space-x-1.5">
                      {onOpenTransferModal && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenTransferModal(ticket); }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#145C43] hover:bg-[#103D30] text-white transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:scale-95"
                        >
                          Transfer
                        </button>
                      )}
                      {onSelectTicket && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectTicket(ticket); }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-[#E2EAE5] text-[#172B28] hover:bg-[#F4F7F5] hover:border-[#145C43]/30 transition-all duration-150 cursor-pointer shadow-2xs hover:-translate-y-0.5 active:scale-95"
                        >
                          Evidence
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3.5 border-t border-[#E2EAE5] bg-[#F4F7F5] flex items-center justify-between text-xs text-[#667873]">
          <div className="font-mono text-[11px]">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredTickets.length)} of {filteredTickets.length} incidents
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 border border-[#E2EAE5] rounded-md bg-white hover:bg-[#F4F7F5] disabled:opacity-40 cursor-pointer font-medium text-[#172B28]"
            >
              <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />Previous
            </button>
            <span className="font-medium text-[#172B28] font-mono text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 border border-[#E2EAE5] rounded-md bg-white hover:bg-[#F4F7F5] disabled:opacity-40 cursor-pointer font-medium text-[#172B28]"
            >
              Next<ChevronRight className="w-3.5 h-3.5 inline ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
