import React, { useState, useEffect, useMemo } from 'react';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import ExecutiveGreeting from './components/ExecutiveGreeting';
import RecommendationCards from './components/RecommendationCards';
import TicketTable from './components/TicketTable';
import SquadDispatch from './components/SquadDispatch';
import BottleneckForecastView from './components/BottleneckForecastView';
import ImpactScorecardView from './components/ImpactScorecardView';
import TicketDetailModal from './components/TicketDetailModal';
import { opsApi } from './services/api';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sla_sentinel_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [tickets, setTickets] = useState([]);
  const [teams, setTeams] = useState([]);
  const [kpis, setKpis] = useState({
    totalTickets: 7,
    highRiskTickets: 5,
    slaBreached: 1,
    overloadedTeams: 2,
    avgPendingTimeHours: 4.6
  });

  const [filters, setFilters] = useState({
    category: 'All',
    team: 'All',
    riskLevel: 'All',
    search: ''
  });

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [transferModalTicket, setTransferModalTicket] = useState(null);
  const [optimizerModalOpen, setOptimizerModalOpen] = useState(false);
  const [optimizerDismissedIds, setOptimizerDismissedIds] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  // Assign New Ticket Modal state
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [newProblem, setNewProblem] = useState('');
  const [newCategory, setNewCategory] = useState('Payments');
  const [newPriority, setNewPriority] = useState('High');
  const [newDeadlineHours, setNewDeadlineHours] = useState(2.0);
  const [newSelectedTeamId, setNewSelectedTeamId] = useState('');

  // Load Data
  const refreshData = async () => {
    try {
      const [fetchedKpis, fetchedTeams, fetchedTickets] = await Promise.all([
        opsApi.getKpis(),
        opsApi.getTeams(),
        opsApi.getTickets(filters)
      ]);
      setKpis(fetchedKpis);
      setTeams(fetchedTeams);
      setTickets(fetchedTickets);
    } catch (e) {
      console.error('Data loading error:', e);
    }
  };

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, filters]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleLogin = (managerProfile) => {
    setUser(managerProfile);
    localStorage.setItem('sla_sentinel_user', JSON.stringify(managerProfile));
    showToast(`Welcome back, ${managerProfile.name.split(' ')[0]}!`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sla_sentinel_user');
    showToast('Signed out successfully');
  };

  const handleReassign = async (ticketId, targetTeamId) => {
    try {
      await opsApi.reassignTicket(ticketId, targetTeamId);
      const targetTeam = teams.find(t => t.id === targetTeamId);
      showToast(`✓ Ticket ${ticketId} reassigned to ${targetTeam?.name.split('—')[0] || targetTeamId}`);
      await refreshData();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleEscalate = async (ticketId) => {
    try {
      await opsApi.escalateTicket(ticketId);
      showToast(`⚠️ Ticket ${ticketId} escalated to Lead`);
      await refreshData();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Open Auto-Optimizer dialog (does not mutate state automatically)
  const handleOpenAutoOptimizer = () => {
    setOptimizerModalOpen(true);
  };

  const handleResetData = () => {
    opsApi.resetMockData();
    setFilters({ category: 'All', team: 'All', riskLevel: 'All', search: '' });
    setOptimizerDismissedIds([]);
    setTransferModalTicket(null);
    setOptimizerModalOpen(false);
    showToast('Reset to default demo data');
    refreshData();
  };

  // AI Recommendation Engine for new ticket assignment
  const getRecommendedSquad = (category, teamsList) => {
    const catLower = (category || '').toLowerCase();
    let matchingSquads = teamsList.filter(tm => 
      (tm.skills || []).some(s => s.toLowerCase().includes(catLower) || catLower.includes(s.toLowerCase()))
    );
    if (matchingSquads.length === 0) {
      matchingSquads = [...teamsList];
    }
    matchingSquads.sort((a, b) => {
      const aSlots = a.maxCapacity - a.activeTickets;
      const bSlots = b.maxCapacity - b.activeTickets;
      if (bSlots !== aSlots) return bSlots - aSlots;
      return (a.activeTickets / a.maxCapacity) - (b.activeTickets / b.maxCapacity);
    });
    const best = matchingSquads[0] || teamsList[0];
    const hasSkill = best?.skills?.some(s => s.toLowerCase().includes(catLower) || catLower.includes(s.toLowerCase()));
    return {
      squad: best,
      reason: hasSkill
        ? `'${best.name}' matches '${category}' skills with ${best.maxCapacity - best.activeTickets} open slots (${Math.round(best.activeTickets / best.maxCapacity * 100)}% load). Best candidate to protect SLA.`
        : `'${best.name}' has lowest concurrent workload (${Math.round(best.activeTickets / best.maxCapacity * 100)}% load) with ${best.maxCapacity - best.activeTickets} open slots.`
    };
  };

  const handleCreateTicketSubmit = (e) => {
    e.preventDefault();
    if (!newProblem.trim()) return;

    const rec = getRecommendedSquad(newCategory, teams);
    const chosenSquadId = newSelectedTeamId || rec.squad?.id || 'team-b';
    const targetSquad = teams.find(t => t.id === chosenSquadId) || teams[0];

    let baseRisk = 30;
    if (newPriority === 'Critical') baseRisk = 75;
    else if (newPriority === 'High') baseRisk = 55;
    else if (newPriority === 'Medium') baseRisk = 35;
    else baseRisk = 15;

    if (newDeadlineHours <= 1.0) baseRisk += 20;
    else if (newDeadlineHours <= 2.0) baseRisk += 10;

    const squadUtil = (targetSquad?.activeTickets || 0) / (targetSquad?.maxCapacity || 10);
    if (squadUtil >= 0.8) baseRisk += 15;
    else baseRisk -= 5;

    const finalRisk = Math.min(99, Math.max(15, baseRisk));
    const nextId = `T${100 + tickets.length + 1}`;

    const newTicket = {
      id: nextId,
      problem: newProblem.trim(),
      category: newCategory,
      priority: newPriority,
      pendingHours: 0.1,
      deadlineHoursLeft: parseFloat(newDeadlineHours),
      assignedTeamId: chosenSquadId,
      status: 'Pending',
      riskScore: finalRisk,
      riskLevel: finalRisk >= 75 ? 'High' : finalRisk >= 40 ? 'Medium' : 'Low',
      weights: { deadlinePressure: 40, squadCongestion: 35, categoryMttrLag: 15 },
      evidence: [
        `Ingested ticket with ${newDeadlineHours}h initial SLA deadline window`,
        `Assigned to ${targetSquad.name} (${targetSquad.activeTickets + 1}/${targetSquad.maxCapacity} load)`,
        `Evaluated initial risk score: ${finalRisk}/100 (${newPriority} priority)`
      ],
      suggestedAction: `Assigned to ${targetSquad.name}`,
      actionType: 'Monitor',
      actionTaken: null,
      impactEstimate: 'SLA monitored in live queue'
    };

    setTeams(prev => prev.map(tm => tm.id === chosenSquadId ? { ...tm, activeTickets: tm.activeTickets + 1 } : tm));
    setTickets(prev => [newTicket, ...prev]);

    setNewProblem('');
    setNewCategory('Payments');
    setNewPriority('High');
    setNewDeadlineHours(2.0);
    setNewSelectedTeamId('');
    setNewTicketModalOpen(false);

    showToast(`✓ Ticket ${nextId} created & assigned to ${targetSquad.name.split('—')[0]} (SLA Protected)`);
  };

  // Optimizer recommendations
  const optimizerSuggestions = useMemo(() => {
    return [
      {
        ticket: tickets.find(t => t.id === 'T101') || tickets[0],
        fromTeamId: 'team-a',
        toTeamId: 'team-b',
        reason: 'Alleviates Team A (90% load); target Team B has 6 available slots and matching Payment skillset.',
        applied: tickets.find(t => t.id === 'T101')?.assignedTeamId === 'team-b'
      },
      {
        ticket: tickets.find(t => t.id === 'T106') || tickets[1],
        fromTeamId: 'team-a',
        toTeamId: 'team-b',
        reason: 'Prevents UPI transaction queue buildup before 1.2h SLA breach; shifts load to Team B.',
        applied: tickets.find(t => t.id === 'T106')?.assignedTeamId === 'team-b'
      },
      {
        ticket: tickets.find(t => t.id === 'T108') || tickets[2],
        fromTeamId: 'team-a',
        toTeamId: 'team-b',
        reason: '30-minute regulatory compliance deadline remaining; Team B has capacity to resolve immediately.',
        applied: tickets.find(t => t.id === 'T108')?.assignedTeamId === 'team-b'
      }
    ].filter(item => Boolean(item.ticket));
  }, [tickets, teams]);

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="bg-[#F2F4F7] min-h-screen p-3 md:p-6 lg:p-8 flex items-start justify-center font-sans antialiased text-slate-800">
      <div className="w-full max-w-[1520px] bg-white rounded-[28px] md:rounded-[36px] shadow-2xl border border-slate-200/80 flex flex-col md:flex-row gap-6 lg:gap-8 relative overflow-hidden" style={{ minHeight: '94vh' }}>
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-8 right-8 z-50 px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs font-semibold shadow-2xl flex items-center space-x-2 animate-bounce">
            <span className="text-[#AFB3B7]">✦</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Clean Sidebar */}
        <Sidebar
          user={user}
          onLogout={handleLogout}
          onResetData={handleResetData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Dynamic Content Panel per Tab */}
        <main className="flex-1 p-5 md:py-7 md:pr-7 md:pl-0 overflow-y-auto space-y-6">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <ExecutiveGreeting
                user={user}
                kpis={kpis}
                onRunAutoOptimizer={handleOpenAutoOptimizer}
                onOpenNewTicketModal={() => setNewTicketModalOpen(true)}
              />

              <RecommendationCards
                tickets={tickets}
                teams={teams}
                onOpenTransferModal={(t) => setTransferModalTicket(t)}
                onEscalate={handleEscalate}
                onSelectTicket={(t) => setSelectedTicket(t)}
              />
            </div>
          )}

          {/* TAB 2: TASKS & QUEUE */}
          {activeTab === 'triage' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Operational Triage Queue</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Real-time incident stream, predictive risk ratings, and squad reassignments</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setNewTicketModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 transition cursor-pointer flex items-center space-x-1.5"
                  >
                    <span>+</span>
                    <span>Assign New Ticket</span>
                  </button>
                  <button
                    onClick={handleOpenAutoOptimizer}
                    className="px-4 py-2 rounded-xl bg-[#132E35] hover:bg-[#0D1F23] text-white text-xs font-bold transition cursor-pointer"
                  >
                    ⚡ Auto-Optimize Queue
                  </button>
                </div>
              </div>

              <TicketTable
                tickets={tickets}
                teams={teams}
                onOpenTransferModal={(t) => setTransferModalTicket(t)}
                onEscalate={handleEscalate}
                onSelectTicket={(t) => setSelectedTicket(t)}
              />
            </div>
          )}

          {/* TAB 3: SURGE FORECAST */}
          {activeTab === 'bottlenecks' && (
            <div>
              <BottleneckForecastView />
            </div>
          )}

          {/* TAB 4: SQUAD DISPATCH */}
          {activeTab === 'squads' && (
            <div>
              <SquadDispatch
                teams={teams}
                tickets={tickets}
                onOpenTransferModal={(t) => setTransferModalTicket(t)}
              />
            </div>
          )}

          {/* TAB 5: SCORECARD */}
          {activeTab === 'scorecard' && (
            <div>
              <ImpactScorecardView />
            </div>
          )}

        </main>

        {/* Explainability / Detail Modal */}
        {selectedTicket && (
          <TicketDetailModal
            ticket={selectedTicket}
            teams={teams}
            onClose={() => setSelectedTicket(null)}
            onReassign={(ticketId, teamId) => {
              handleReassign(ticketId, teamId);
            }}
            onEscalate={handleEscalate}
          />
        )}

        {/* Assign New Ticket Modal with AI Recommendation */}
        {newTicketModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-xs space-y-4 animate-fade-in max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-[#132E35]/10 text-[#132E35] border border-[#2D4A53]/30">
                      + INGEST INCIDENT
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">AI Dispatch Assist</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">Assign New Ticket to Squad</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Enter ticket details. Our engine recommends the squad best suited by skills &amp; headroom.
                  </p>
                </div>
                <button
                  onClick={() => setNewTicketModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTicketSubmit} className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Problem Title / Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UPI checkout timeout on HDFC gateway"
                    value={newProblem}
                    onChange={e => setNewProblem(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#132E35] focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={e => {
                        setNewCategory(e.target.value);
                        setNewSelectedTeamId('');
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#132E35] focus:bg-white"
                    >
                      <option value="Payments">Payments</option>
                      <option value="Billing">Billing</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Authentication">Authentication</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                    <select
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#132E35] focus:bg-white"
                    >
                      <option value="Critical">Critical (Immediate)</option>
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    SLA Deadline (Hours Remaining): <strong className="text-slate-900">{newDeadlineHours}h</strong>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={newDeadlineHours}
                    onChange={e => setNewDeadlineHours(parseFloat(e.target.value))}
                    className="w-full accent-[#132E35]"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>30m (Urgent)</span>
                    <span>4.0h (Standard)</span>
                    <span>24h</span>
                  </div>
                </div>

                {/* AI Recommendation Banner */}
                {(() => {
                  const rec = getRecommendedSquad(newCategory, teams);
                  return (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-[#2D4A53]/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[#132E35] text-sm">✦</span>
                          <span className="font-bold text-slate-900 text-xs">AI Recommended Squad</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#132E35] text-white">
                          Best Skill Match
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-800 mt-1">
                        {rec.squad?.name}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {rec.reason}
                      </p>
                    </div>
                  );
                })()}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assign Target Squad (Auto-selected or Override)</label>
                  <select
                    value={newSelectedTeamId || getRecommendedSquad(newCategory, teams).squad?.id || ''}
                    onChange={e => setNewSelectedTeamId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#132E35] focus:bg-white"
                  >
                    {teams.map(tm => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name} — {tm.activeTickets}/{tm.maxCapacity} active ({tm.maxCapacity - tm.activeTickets} open)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setNewTicketModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#132E35] hover:bg-[#0D1F23] cursor-pointer shadow-sm"
                  >
                    Confirm &amp; Assign Ticket →
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Universal Squad Selector Transfer Modal */}
        {transferModalTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-xs space-y-5 animate-fade-in">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-[#132E35]/10 text-[#132E35] border border-[#2D4A53]/30">
                      {transferModalTicket.id}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {transferModalTicket.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">{transferModalTicket.problem}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Currently with: <strong className="text-slate-800">{teams.find(t => t.id === transferModalTicket.assignedTeamId)?.name}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setTransferModalTicket(null)}
                  className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Select Destination Squad
                </div>
                <div className="space-y-2.5">
                  {teams.map(tm => {
                    const isCurrent = tm.id === transferModalTicket.assignedTeamId;
                    const isFull = tm.activeTickets >= tm.maxCapacity;

                    return (
                      <div
                        key={tm.id}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                          isCurrent
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : isFull
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-[#132E35]'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="text-2xl">{tm.avatar || '👥'}</div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-xs">{tm.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                  Current Squad
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Lead: {tm.lead} • Load: <strong className={isFull ? 'text-rose-600' : 'text-slate-700'}>{tm.activeTickets}/{tm.maxCapacity}</strong> ({Math.round((tm.activeTickets / tm.maxCapacity) * 100)}%)
                            </div>
                          </div>
                        </div>

                        <div>
                          {isCurrent ? (
                            <span className="text-[11px] text-slate-400 font-medium px-3 py-1.5">Assigned</span>
                          ) : (
                            <button
                              onClick={() => {
                                handleReassign(transferModalTicket.id, tm.id);
                                setTransferModalTicket(null);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                isFull
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-[#132E35] hover:bg-[#0D1F23] text-white shadow-xs'
                              }`}
                            >
                              {isFull ? 'Transfer (Overload)' : 'Transfer Here →'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end border-t border-slate-100">
                <button
                  onClick={() => setTransferModalTicket(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Auto-Optimizer Review Dialog */}
        {optimizerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-xs space-y-5 animate-fade-in max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#132E35]/10 text-[#132E35] border border-[#2D4A53]/30 font-bold text-xs">
                      ⚡ AI Auto-Optimizer
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      Human-in-the-Loop Review
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">Recommended Workload Rebalances</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Review each proposed change individually before approving.
                  </p>
                </div>
                <button
                  onClick={() => setOptimizerModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto space-y-3.5 pr-1 flex-1">
                {optimizerSuggestions.map(item => {
                  const isApplied = item.applied;
                  const isSkipped = optimizerDismissedIds.includes(item.ticket.id);
                  const sourceSquad = teams.find(t => t.id === item.fromTeamId);
                  const targetSquad = teams.find(t => t.id === item.toTeamId);

                  return (
                    <div
                      key={item.ticket.id}
                      className={`p-4 rounded-2xl border transition ${
                        isApplied
                          ? 'bg-slate-50 border-[#2D4A53]/40'
                          : isSkipped
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 hover:border-[#132E35] shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                              {item.ticket.id}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {item.ticket.category}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.ticket.riskLevel === 'High' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-600'
                            }`}>
                              Risk {item.ticket.riskScore}/100
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 text-xs mb-1">{item.ticket.problem}</div>
                          
                          <div className="flex items-center space-x-2 text-[11px] text-slate-600 mt-1">
                            <span>From: <strong>{sourceSquad?.name.split('—')[0] || item.fromTeamId}</strong></span>
                            <span>→</span>
                            <span className="text-[#132E35] font-semibold">To: <strong>{targetSquad?.name.split('—')[0] || item.toTeamId}</strong></span>
                          </div>

                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                            💡 {item.reason}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-center">
                          {isApplied ? (
                            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#132E35] bg-[#132E35]/10 border border-[#2D4A53]/30 px-3 py-1.5 rounded-xl">
                              <span>✓ Applied</span>
                              <button
                                onClick={() => handleReassign(item.ticket.id, item.fromTeamId)}
                                className="text-[10px] underline ml-1 text-slate-500 hover:text-slate-800"
                              >
                                Undo
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => setOptimizerDismissedIds(prev => [...prev, item.ticket.id])}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                              >
                                ✕ Decline
                              </button>
                              <button
                                onClick={() => {
                                  handleReassign(item.ticket.id, item.toTeamId);
                                }}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[#132E35] hover:bg-[#0D1F23] cursor-pointer shadow-2xs"
                              >
                                ✓ Approve &amp; Transfer
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
                  Pending: <strong className="text-slate-800">{optimizerSuggestions.filter(s => !s.applied && !optimizerDismissedIds.includes(s.ticket.id)).length} changes</strong>
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setOptimizerModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Close Plan
                  </button>
                  {optimizerSuggestions.filter(s => !s.applied && !optimizerDismissedIds.includes(s.ticket.id)).length > 0 && (
                    <button
                      onClick={() => {
                        const remaining = optimizerSuggestions.filter(s => !s.applied && !optimizerDismissedIds.includes(s.ticket.id));
                        remaining.forEach(r => handleReassign(r.ticket.id, r.toTeamId));
                        showToast(`⚡ Approved and applied ${remaining.length} suggested reassignments!`);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#132E35] hover:bg-[#0D1F23] cursor-pointer shadow-sm"
                    >
                      Approve All Remaining
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
