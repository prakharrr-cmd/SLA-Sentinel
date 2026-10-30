import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Bell,
  ShieldCheck,
  AlertTriangle,
  Database,
  FileUp,
  RotateCcw,
  Zap,
  X,
  Users,
  Check,
  Loader2,
  LogOut,
  Clock,
  ArrowRight
} from 'lucide-react';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import ExecutiveGreeting from './components/ExecutiveGreeting';
import RecommendationCards from './components/RecommendationCards';
import TicketTable from './components/TicketTable';
import SquadDispatch from './components/SquadDispatch';
import BottleneckForecastView from './components/BottleneckForecastView';
import ImpactScorecardView from './components/ImpactScorecardView';
import TicketDetailModal from './components/TicketDetailModal';
import UploadModal from './components/UploadModal';
import DatasetSelectorModal from './components/DatasetSelectorModal';
import ActionTrackerView from './components/ActionTrackerView';
import ExplainabilityView from './components/ExplainabilityView';
import SimulationControlView from './components/SimulationControlView';
import BusinessConfigView from './components/BusinessConfigView';
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

  // Canonical dataset state
  const [selectedDatasetId, setSelectedDatasetId] = useState('demo-dataset-sla-sentinel');
  const [selectedSlaTarget, setSelectedSlaTarget] = useState('resolution_deadline');
  const [activeDataset, setActiveDataset] = useState(null);
  const [datasetAnalytics, setDatasetAnalytics] = useState(null);
  const [datasetRisks, setDatasetRisks] = useState([]);
  const [datasetDecisions, setDatasetDecisions] = useState([]);
  const [datasetActions, setDatasetActions] = useState([]);
  const [datasetError, setDatasetError] = useState('');
  const [isDatasetLoading, setIsDatasetLoading] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDatasetSelectorOpen, setIsDatasetSelectorOpen] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [transferModalTicket, setTransferModalTicket] = useState(null);
  const [optimizerModalOpen, setOptimizerModalOpen] = useState(false);
  const [optimizerDismissedIds, setOptimizerDismissedIds] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  // Top Bar Dropdowns & Popover States
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState([]);

  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load Data
  const refreshData = async () => {
    try {
      if (selectedDatasetId) {
        setIsDatasetLoading(true);
        setDatasetError('');

        // Clear stale dataset data to preserve dataset isolation while loading
        setDatasetAnalytics(null);
        setTickets([]);
        setDatasetRisks([]);
        setDatasetDecisions([]);
        setDatasetActions([]);

        const targetParam = selectedSlaTarget === 'response_deadline' ? 'response' : 'resolution';

        const [
          fetchedAnalytics,
          fetchedDataset,
          fetchedRisksRes,
          fetchedTicketsRes,
          fetchedDecisionsRes,
          fetchedActionsRes,
          fetchedTeams,
        ] = await Promise.all([
          opsApi.getDatasetAnalytics(selectedDatasetId).catch(() => null),
          opsApi.getDatasetById(selectedDatasetId).catch(() => null),
          opsApi.getDatasetRisks(selectedDatasetId, { target: targetParam, pageSize: 100 }).catch(() => null),
          opsApi.getDatasetTickets(selectedDatasetId, { page: 1, pageSize: 100 }).catch(() => null),
          opsApi.getDatasetDecisions(selectedDatasetId, { page: 1, pageSize: 10 }).catch(() => null),
          opsApi.getDatasetActions(selectedDatasetId, { page: 1, pageSize: 10 }).catch(() => null),
          opsApi.getTeams().catch(() => []),
        ]);

        if (fetchedDataset) setActiveDataset(fetchedDataset);
        if (fetchedDecisionsRes?.items) setDatasetDecisions(fetchedDecisionsRes.items);
        if (fetchedActionsRes?.items) setDatasetActions(fetchedActionsRes.items);

        // Process team workloads dynamically from dataset analytics
        const teamWorkloadList = fetchedAnalytics?.trends_and_bottlenecks?.team_workload || [];
        const teamWorkloadMap = {};
        teamWorkloadList.forEach((item) => {
          teamWorkloadMap[item.key] = item;
        });

        const dynamicTeams = (fetchedTeams && fetchedTeams.length > 0)
          ? fetchedTeams.map((tm) => {
              const workload = teamWorkloadMap[tm.id];
              const activeCount = workload ? workload.active_count : 0;
              const maxCap = tm.max_capacity || tm.maxCapacity || 20;
              return {
                ...tm,
                activeTickets: activeCount,
                maxCapacity: maxCap,
                isOverloaded: activeCount > maxCap,
              };
            })
          : teamWorkloadList.map((item) => ({
              id: item.key,
              name: `Squad ${item.key}`,
              activeTickets: item.active_count,
              maxCapacity: 20,
              isOverloaded: item.active_count > 20,
            }));

        const hasAssignedTeams = dynamicTeams.some((t) => t.activeTickets > 0);
        setTeams(dynamicTeams);

        // Process KPIs dynamically without mock fallbacks
        if (fetchedAnalytics) {
          setDatasetAnalytics(fetchedAnalytics);
          const slaMetrics = fetchedAnalytics.sla_performance?.[selectedSlaTarget === 'response_deadline' ? 'response_sla' : 'resolution_sla'] || {};
          const ticketDist = fetchedAnalytics.ticket_distribution || {};
          const summary = fetchedAnalytics.dataset_summary || {};

          const activeQueueCount = ticketDist.active_tickets_count != null
            ? ticketDist.active_tickets_count
            : (summary.total_imported_tickets || 0);

          const atRiskCount = slaMetrics.at_risk_count != null ? slaMetrics.at_risk_count : 0;
          const breachedCount = slaMetrics.breached_count != null ? slaMetrics.breached_count : 0;
          const overloadedSquadsCount = hasAssignedTeams
            ? dynamicTeams.filter((t) => t.isOverloaded).length
            : 0;

          setKpis({
            totalTickets: activeQueueCount,
            highRiskTickets: atRiskCount,
            slaBreached: breachedCount,
            overloadedTeams: overloadedSquadsCount,
            avgPendingTimeHours: slaMetrics.median_time_hours || 0,
            hasAssignedTeams,
          });
        }

        // Process Tickets with real risk scores
        const risksItems = fetchedRisksRes?.items || [];
        setDatasetRisks(risksItems);

        const ticketsLookup = {};
        (fetchedTicketsRes?.items || []).forEach((t) => {
          ticketsLookup[t.source_ticket_id || t.id] = t;
        });

        if (risksItems.length > 0) {
          setTickets(risksItems.map((r) => {
            const rawTicket = ticketsLookup[r.ticket_id] || {};
            return {
              id: r.ticket_id,
              problem: r.title || rawTicket.title || rawTicket.problem || `Incident ${r.ticket_id}`,
              category: r.category || rawTicket.category || 'General',
              priority: r.priority || rawTicket.priority || 'Normal',
              assignedTeamId: r.assigned_team_id || rawTicket.assigned_team_id || null,
              status: r.status || rawTicket.status || 'Open',
              riskScore: r.risk_score != null ? Math.round(r.risk_score) : null,
              riskLevel: r.risk_category || r.current_sla_state || 'Normal',
              currentSlaState: r.current_sla_state,
              applicableDeadline: r.applicable_deadline,
              createdAt: r.created_at || rawTicket.created_at,
              deadlineHoursLeft: r.ratio != null ? Math.max(0, ((1 - r.ratio) * 10).toFixed(1)) : null,
              pendingHours: r.percent_elapsed != null ? ((r.percent_elapsed / 100) * 10).toFixed(1) : null,
              flagReason: r.evidence || 'Dataset imported incident',
            };
          }));
        } else if (fetchedTicketsRes?.items?.length) {
          setTickets(fetchedTicketsRes.items.map((t) => ({
            id: t.source_ticket_id || t.id,
            problem: t.title || t.subject || t.problem || `Incident ${t.source_ticket_id || t.id}`,
            category: t.category || 'General',
            priority: t.priority || 'Normal',
            assignedTeamId: t.assigned_team_id || null,
            status: t.status || 'Open',
            riskScore: null,
            riskLevel: 'Normal',
            currentSlaState: 'Within Target',
            applicableDeadline: t.resolution_deadline,
            createdAt: t.created_at,
            deadlineHoursLeft: null,
            pendingHours: null,
            flagReason: 'Dataset imported incident',
          })));
        } else {
          setTickets([]);
        }
      } else {
        const [fetchedKpis, fetchedTeams, fetchedTickets] = await Promise.all([
          opsApi.getKpis(),
          opsApi.getTeams(),
          opsApi.getTickets(filters),
        ]);
        setKpis(fetchedKpis);
        setTeams(fetchedTeams);
        setTickets(fetchedTickets);
      }
    } catch (e) {
      console.error('Data loading error:', e);
      setDatasetError(e.message);
    } finally {
      setIsDatasetLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, filters, selectedDatasetId, selectedSlaTarget]);

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
      showToast(`Ticket ${ticketId} reassigned to ${targetTeam?.name.split('—')[0] || targetTeamId}`);
      await refreshData();
    } catch (err) {
      showToast(`Error reassigning: ${err.message}`);
    }
  };

  const handleEscalate = async (ticketId) => {
    try {
      await opsApi.escalateTicket(ticketId);
      showToast(`Incident ${ticketId} escalated with priority override`);
      await refreshData();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleResetData = () => {
    opsApi.resetMockData();
    setSelectedDatasetId('demo-dataset-sla-sentinel');
    refreshData();
    showToast('Operational environment reset to verified baseline');
  };

  const handleSelectDataset = (dsId) => {
    setSelectedDatasetId(dsId);
    setIsDatasetSelectorOpen(false);
    showToast(`Switched to dataset: ${dsId}`);
  };

  const handleClearDataset = () => {
    setSelectedDatasetId(null);
    setActiveDataset(null);
    setDatasetAnalytics(null);
    showToast('Switched to Demo Benchmark mode');
  };

  const handleOpenAutoOptimizer = () => {
    setOptimizerModalOpen(true);
  };

  const handleApplyOptimizerItem = async (item) => {
    await handleReassign(item.ticket.id, item.toTeamId);
    showToast(`Optimization applied: Shifted ${item.ticket.id} to alleviative squad`);
  };

  const handleDismissOptimizerItem = (item) => {
    setOptimizerDismissedIds(prev => [...prev, item.ticket.id]);
  };

  // Demo decision handlers for recommendation cards
  const handleApproveRecommendation = async (rec) => {
    if (rec.suggested_team_id) {
      await handleReassign(rec.ticket_id, rec.suggested_team_id);
    }
  };

  const handleRejectRecommendation = async (rec, reason) => {
    showToast(`Recommendation rejected for ${rec.ticket_id}: ${reason}`);
  };

  // Search results memo
  const searchResults = useMemo(() => {
    const q = (filters.search || '').trim().toLowerCase();
    if (!q) return [];
    return tickets.filter(t => 
      (t.id && t.id.toLowerCase().includes(q)) ||
      (t.problem && t.problem.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [filters.search, tickets]);

  // Operational Notifications list
  const notificationsList = useMemo(() => [
    {
      id: 'notif-1',
      title: 'Critical SLA Breach Warning',
      message: 'Incident T103 exceeded 90% SLA threshold — imminent breach risk.',
      time: '8 min ago',
      type: 'critical',
      ticketId: 'T103'
    },
    {
      id: 'notif-2',
      title: 'Squad Overload Alert',
      message: 'Team Alpha is currently operating at 90% capacity limit.',
      time: '24 min ago',
      type: 'warning'
    },
    {
      id: 'notif-3',
      title: 'Prescriptive Rebalance Generated',
      message: '3 candidate tickets recommended for transfer to protect SLAs.',
      time: '1 hr ago',
      type: 'action'
    },
    {
      id: 'notif-4',
      title: 'Dataset Validation Verified',
      message: `Canonical benchmark verified for ${selectedDatasetId || 'Active Dataset'}.`,
      time: '2 hr ago',
      type: 'info'
    }
  ], [selectedDatasetId]);

  const unreadCount = Math.max(0, notificationsList.length - readNotifIds.length);

  // Optimizer suggestions
  const optimizerSuggestions = useMemo(() => {
    return [
      {
        ticket: tickets.find(t => t.id === 'T101') || tickets[0],
        fromTeamId: 'team-a',
        toTeamId: 'team-b',
        reason: 'Alleviates Team A (90% load); target Team B has available slots and matching Payment skillset.',
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
        reason: 'Regulatory compliance deadline remaining; Team B has capacity to resolve immediately.',
        applied: tickets.find(t => t.id === 'T108')?.assignedTeamId === 'team-b'
      }
    ].filter(item => Boolean(item.ticket));
  }, [tickets, teams]);

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="bg-[#F4F7F5] min-h-screen md:h-screen md:overflow-hidden p-3 md:p-5 lg:p-6 flex items-start justify-center font-sans antialiased text-[#172B28]">
      <div className="w-full max-w-[1580px] md:h-full flex flex-col md:flex-row gap-5 lg:gap-6 items-stretch relative">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-8 right-8 z-50 px-5 py-3 rounded-xl bg-[#172B28] text-white text-xs font-semibold shadow-2xl border border-[#145C43] flex items-center space-x-2 animate-bounce">
            <ShieldCheck className="w-4 h-4 text-[#DCE9E1]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Clean Static Sidebar Card */}
        <Sidebar
          user={user}
          onLogout={handleLogout}
          onResetData={handleResetData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeDataset={activeDataset}
          kpis={kpis}
        />

        {/* Standalone Dashboard & Main Content Card */}
        <main className="flex-1 min-w-0 bg-white rounded-3xl md:rounded-[28px] border border-[#E2EAE5] shadow-xs p-5 md:p-7 lg:p-8 md:h-full overflow-y-auto space-y-6">
          
          {/* Top Bar with Search & Profile Actions */}
          <div className="flex items-center justify-between gap-4 pb-1 relative z-20">
            
            {/* Functional Search Bar */}
            <div ref={searchRef} className="relative flex-1 max-w-sm sm:max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A9B96]">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={filters.search}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setFilters(f => ({ ...f, search: e.target.value }));
                  setSearchFocused(true);
                }}
                placeholder="Search ticket, category, squad..."
                className="w-full pl-10 pr-9 py-2 rounded-full bg-[#F4F7F5] border border-[#E2EAE5] text-xs text-[#172B28] placeholder-[#687A74] focus:outline-hidden focus:ring-2 focus:ring-[#145C43]/20 focus:border-[#145C43] focus:bg-white transition-all duration-150 shadow-2xs hover:border-[#145C43]/40"
              />
              {filters.search ? (
                <button
                  onClick={() => {
                    setFilters(f => ({ ...f, search: '' }));
                    setSearchFocused(false);
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#687A74] hover:text-[#172B28] cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#8A9B96] text-[10px] font-mono">
                  ⌘K
                </span>
              )}

              {/* Floating Interactive Search Results Dropdown */}
              {searchFocused && (
                <div className="absolute left-0 top-11 w-full sm:w-[460px] bg-white rounded-2xl shadow-xl border border-[#E2EAE5] z-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 text-[#172B28]">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2EAE5]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#687A74]">
                      {filters.search ? `Matches for "${filters.search}"` : 'Quick Incident Filters'}
                    </span>
                    <span className="text-[10px] text-[#8A9B96] font-mono">
                      {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
                    </span>
                  </div>

                  {/* Matching Incidents */}
                  {searchResults.length > 0 ? (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {searchResults.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => {
                            setSelectedTicket(t);
                            setSearchFocused(false);
                          }}
                          className="p-2.5 rounded-xl hover:bg-[#F4F7F5] border border-transparent hover:border-[#E2EAE5] cursor-pointer transition-all duration-150 flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-[#172B28] group-hover:text-[#145C43] transition-colors">{t.id}</span>
                              <span className="text-[#8A9B96]">•</span>
                              <span className="text-xs font-semibold text-[#172B28] truncate">{t.problem}</span>
                            </div>
                            <div className="text-[10px] text-[#687A74] mt-0.5 font-mono">
                              {t.category} • SLA: {t.deadlineHoursLeft}h remaining
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            t.riskScore >= 90 ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            t.riskScore >= 75 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-[#E7F0EA] text-[#145C43] border border-[#145C43]/20'
                          }`}>
                            {t.riskScore}/100 Risk
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : filters.search ? (
                    <div className="py-6 text-center text-xs text-[#687A74]">
                      No active incidents match "<strong className="text-[#172B28]">{filters.search}</strong>"
                    </div>
                  ) : null}

                  {/* Suggested Quick Filter Chips */}
                  <div className="pt-2 border-t border-[#E2EAE5]">
                    <div className="text-[10px] font-bold text-[#8A9B96] uppercase tracking-wider mb-2">Fast Filter by Category</div>
                    <div className="flex flex-wrap gap-1.5">
                      {['Payments', 'Infrastructure', 'Billing', 'Cards', 'Disputes', 'Core Banking'].map((tag) => (
                        <button
                          key={tag}
                          onClick={() => {
                            setFilters(f => ({ ...f, search: tag }));
                            setSearchFocused(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#F4F7F5] hover:bg-[#E7F0EA] hover:text-[#145C43] text-[#687A74] text-[11px] font-medium border border-[#E2EAE5] transition-colors cursor-pointer"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Top Right Action Icons */}
            <div className="flex items-center space-x-3">
              
              {/* Functional Notifications Button */}
              <div ref={notifRef} className="relative">
                <button
                  onClick={() => setNotificationsOpen(prev => !prev)}
                  className={`relative w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-150 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 ${
                    notificationsOpen
                      ? 'bg-[#145C43] text-white border-[#145C43]'
                      : 'bg-white hover:bg-[#F4F7F5] text-[#687A74] hover:text-[#172B28] border-[#E2EAE5]'
                  }`}
                  title="Operational Notifications"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#DC465C] text-white text-[9px] font-mono font-bold flex items-center justify-center ring-2 ring-white animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Floating Notifications Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 top-11 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#E2EAE5] z-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 text-[#172B28]">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E2EAE5]">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#172B28]">Operational Alerts</span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => setReadNotifIds(notificationsList.map(n => n.id))}
                          className="text-[11px] text-[#145C43] hover:underline font-semibold cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto divide-y divide-[#E2EAE5]/60">
                      {notificationsList.map((notif) => {
                        const isRead = readNotifIds.includes(notif.id);
                        return (
                          <div
                            key={notif.id}
                            onClick={() => {
                              if (!isRead) setReadNotifIds(prev => [...prev, notif.id]);
                              if (notif.ticketId) {
                                const found = tickets.find(t => t.id === notif.ticketId);
                                if (found) setSelectedTicket(found);
                              }
                              setNotificationsOpen(false);
                            }}
                            className={`pt-2.5 first:pt-0 p-2 rounded-xl transition-all duration-150 cursor-pointer flex items-start space-x-3 ${
                              isRead ? 'opacity-65 hover:opacity-100 hover:bg-[#F4F7F5]' : 'bg-[#F4F7F5]/70 hover:bg-[#F4F7F5]'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              notif.type === 'critical' ? 'bg-[#DC465C] ring-4 ring-rose-100' :
                              notif.type === 'warning' ? 'bg-[#E59A32] ring-4 ring-amber-100' :
                              notif.type === 'action' ? 'bg-[#145C43] ring-4 ring-emerald-100' :
                              'bg-[#507DAA] ring-4 ring-blue-100'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold text-[#172B28] truncate">{notif.title}</div>
                                <span className="text-[10px] text-[#8A9B96] font-mono shrink-0">{notif.time}</span>
                              </div>
                              <p className="text-[11px] text-[#687A74] mt-0.5 leading-snug">{notif.message}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-[#E2EAE5] flex items-center justify-between text-[10px] text-[#8A9B96]">
                      <span>SLA Prescriptive Engine</span>
                      <button
                        onClick={() => {
                          setActiveTab('actions');
                          setNotificationsOpen(false);
                        }}
                        className="text-[#145C43] font-semibold hover:underline cursor-pointer flex items-center space-x-1"
                      >
                        <span>Action Tracker</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Functional Profile Avatar Button */}
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(prev => !prev)}
                  className="flex items-center space-x-2.5 pl-1 p-0.5 rounded-full hover:bg-[#F4F7F5] border border-transparent hover:border-[#E2EAE5] transition-all duration-150 cursor-pointer hover:scale-102 active:scale-98"
                  title="Manager Profile & Workspace"
                >
                  <div className="w-8 h-8 rounded-full bg-[#DCE9E1] border border-[#145C43]/20 text-[#145C43] flex items-center justify-center font-bold text-xs shadow-2xs font-mono">
                    {user?.avatar || 'AA'}
                  </div>
                  <div className="hidden sm:block text-left pr-1.5">
                    <div className="text-xs font-bold text-[#172B28] leading-tight">{user?.name || 'Ansh Aditya'}</div>
                    <div className="text-[10px] text-[#687A74] font-medium leading-none mt-0.5">{user?.email || 'ansh@sla-sentinel.internal'}</div>
                  </div>
                </button>

                {/* Floating Profile Dropdown */}
                {profileOpen && (
                  <div className="absolute right-0 top-11 w-72 bg-white rounded-2xl shadow-xl border border-[#E2EAE5] z-50 p-4 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150 text-[#172B28]">
                    <div className="flex items-center space-x-3 pb-3 border-b border-[#E2EAE5]">
                      <div className="w-10 h-10 rounded-xl bg-[#DCE9E1] text-[#145C43] font-bold text-sm flex items-center justify-center font-mono shrink-0 shadow-2xs">
                        {user?.avatar || 'AA'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#172B28] truncate">{user?.name || 'Ansh Aditya'}</div>
                        <div className="text-[10px] text-[#687A74] truncate font-mono">{user?.email || 'ansh@sla-sentinel.internal'}</div>
                        <div className="text-[10px] font-semibold text-[#145C43] mt-0.5 bg-[#E7F0EA] px-2 py-0.2 rounded-full inline-block">
                          {user?.role || 'Operations Manager'}
                        </div>
                      </div>
                    </div>

                    {/* Switch Persona */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A9B96]">Switch Demo Persona</div>
                      
                      <button
                        onClick={() => {
                          const newProfile = {
                            name: 'Ansh Aditya',
                            role: 'Backend Lead',
                            email: 'ansh@sla-sentinel.internal',
                            avatar: 'AA'
                          };
                          setUser(newProfile);
                          localStorage.setItem('sla_sentinel_user', JSON.stringify(newProfile));
                          showToast('Switched persona to Ansh Aditya');
                          setProfileOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer border ${
                          user?.name?.includes('Ansh')
                            ? 'bg-[#E7F0EA] text-[#145C43] border-[#145C43]/20 font-bold'
                            : 'bg-[#F4F7F5] text-[#172B28] border-[#E2EAE5] hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">Ansh Aditya</div>
                          <div className="text-[10px] text-[#687A74]">Backend Lead</div>
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-[#145C43] font-bold border border-[#E2EAE5]">AA</span>
                      </button>

                      <button
                        onClick={() => {
                          const newProfile = {
                            name: 'Prakhar Singh',
                            role: 'Operations Manager',
                            email: 'prakhar@opspulse.ai',
                            avatar: 'PS'
                          };
                          setUser(newProfile);
                          localStorage.setItem('sla_sentinel_user', JSON.stringify(newProfile));
                          showToast('Switched persona to Prakhar Singh');
                          setProfileOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer border ${
                          user?.name?.includes('Prakhar')
                            ? 'bg-[#E7F0EA] text-[#145C43] border-[#145C43]/20 font-bold'
                            : 'bg-[#F4F7F5] text-[#172B28] border-[#E2EAE5] hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">Prakhar Singh</div>
                          <div className="text-[10px] text-[#687A74]">Operations Manager</div>
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-[#145C43] font-bold border border-[#E2EAE5]">PS</span>
                      </button>
                    </div>

                    {/* Operational Workspace Info */}
                    <div className="p-2.5 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] text-[11px] text-[#687A74] space-y-1 font-mono">
                      <div className="flex justify-between">
                        <span>Dataset:</span>
                        <strong className="text-[#172B28] truncate max-w-[130px]">{selectedDatasetId || 'Demo Baseline'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Target:</span>
                        <strong className="text-[#145C43]">{selectedSlaTarget === 'response_deadline' ? 'Response SLA' : 'Resolution SLA'}</strong>
                      </div>
                    </div>

                    {/* Sign Out Action */}
                    <div className="pt-1 border-t border-[#E2EAE5]">
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          handleLogout();
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 border border-rose-200"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Dataset Scope & SLA Mode Banner */}
          {selectedDatasetId ? (
            <div className="bg-white border border-[#E2EAE5] rounded-2xl p-4 text-[#172B28] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#DCE9E1]/70 border border-[#145C43]/20 flex items-center justify-center text-xs font-mono font-bold text-[#145C43]">
                  LIVE
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-extrabold text-[#172B28] tracking-wide">
                      Dataset: {datasetAnalytics?.dataset_summary?.dataset_name || selectedDatasetId}
                    </span>
                    {(activeDataset?.is_simulated || selectedDatasetId === 'demo-dataset-sla-sentinel' || activeDataset?.validation_summary?.is_simulated) ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                        SIMULATED DATA
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-[#145C43] border border-emerald-200 font-bold">
                        CSV REAL DATA
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F4F7F5] border border-[#E2EAE5] text-[#667873]">
                      {datasetAnalytics?.dataset_summary?.total_imported_tickets || 0} tickets
                    </span>
                  </div>
                  <div className="text-[11px] text-[#667873] flex items-center space-x-2 mt-0.5 font-mono">
                    <span>Target: <strong className="text-[#172B28]">{selectedSlaTarget === 'response_deadline' ? 'Response SLA' : 'Resolution SLA'}</strong></span>
                    <span>•</span>
                    <span>Coverage: <strong className="text-[#145C43]">{Math.round((datasetAnalytics?.sla_performance?.[selectedSlaTarget === 'response_deadline' ? 'response_sla' : 'resolution_sla']?.coverage_rate || 0) * 100)}%</strong></span>
                    {datasetAnalytics?.data_quality_report?.warnings?.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-amber-700 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" />{datasetAnalytics.data_quality_report.warnings.length} quality notices</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* SLA Target Switcher & Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl p-1 flex items-center text-xs">
                  <button
                    onClick={() => setSelectedSlaTarget('resolution_deadline')}
                    className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                      selectedSlaTarget === 'resolution_deadline' ? 'bg-white text-[#145C43] font-bold shadow-2xs border border-[#E2EAE5]' : 'text-[#667873] hover:text-[#172B28]'
                    }`}
                  >
                    Resolution SLA
                  </button>
                  <button
                    onClick={() => setSelectedSlaTarget('response_deadline')}
                    className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                      selectedSlaTarget === 'response_deadline' ? 'bg-white text-[#145C43] font-bold shadow-2xs border border-[#E2EAE5]' : 'text-[#667873] hover:text-[#172B28]'
                    }`}
                  >
                    Response SLA
                  </button>
                </div>

                <button
                  onClick={() => setIsDatasetSelectorOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#F4F7F5] hover:bg-white text-[#172B28] border border-[#E2EAE5] text-xs font-semibold transition cursor-pointer flex items-center space-x-1 shadow-2xs"
                >
                  <Database className="w-3.5 h-3.5 text-[#667873]" />
                  <span>Switch</span>
                </button>

                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#145C43] hover:bg-[#103D30] text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
                >
                  <FileUp className="w-3.5 h-3.5 inline mr-1" />Ingest
                </button>

                <button
                  onClick={handleClearDataset}
                  className="px-3 py-1.5 rounded-xl bg-[#F4F7F5] hover:bg-white text-[#667873] hover:text-[#172B28] border border-[#E2EAE5] text-xs font-medium transition cursor-pointer shadow-2xs"
                  title="Return to default baseline demo data"
                >
                  Demo Mode
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E2EAE5] rounded-2xl p-3.5 text-[#172B28] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] flex items-center justify-center text-xs font-mono font-bold text-[#667873]">
                  DEMO
                </div>
                <div>
                  <div className="text-xs font-bold text-[#172B28]">
                    Demo Benchmark Mode (Simulated Baseline)
                  </div>
                  <div className="text-[11px] text-[#667873]">
                    Operating on synthetic demo incidents. Switch to an ingested dataset or upload CSV/XLSX for live empirical intelligence.
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsDatasetSelectorOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#F4F7F5] text-[#172B28] text-xs font-bold border border-[#E2EAE5] shadow-2xs transition cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-[#667873] inline mr-1" />Select Dataset
                </button>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#145C43] hover:bg-[#103D30] text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                >
                  <FileUp className="w-3.5 h-3.5 text-white inline mr-1" />Ingest CSV/XLSX
                </button>
              </div>
            </div>
          )}

          {/* Dataset Error Alert */}
          {datasetError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-700 flex items-center justify-between shadow-2xs">
              <div>
                <strong>Dataset Error:</strong> {datasetError}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={refreshData}
                  className="underline font-bold hover:text-rose-900 cursor-pointer"
                >
                  Retry
                </button>
                <button
                  onClick={handleClearDataset}
                  className="underline font-bold text-[#667873] hover:text-[#172B28] cursor-pointer"
                >
                  Switch to Demo Mode
                </button>
              </div>
            </div>
          )}

          {/* Dataset Loading State */}
          {isDatasetLoading && (
            <div className="bg-white border border-[#E2EAE5] rounded-2xl p-3 text-xs text-[#667873] flex items-center space-x-2 animate-pulse shadow-2xs">
              <Loader2 className="w-4 h-4 text-[#145C43] animate-spin shrink-0" />
              <span>Evaluating dataset SLA performance metrics and calculating deterministic risk rankings...</span>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <ExecutiveGreeting
                user={user}
                kpis={kpis}
                onRunAutoOptimizer={handleOpenAutoOptimizer}
                onOpenCsvModal={() => setIsUploadOpen(true)}
                onOpenDatasetSelector={() => setIsDatasetSelectorOpen(true)}
                tickets={tickets}
                teams={teams}
                datasetAnalytics={datasetAnalytics}
                datasetRisks={datasetRisks}
                datasetDecisions={datasetDecisions}
                datasetActions={datasetActions}
                activeDataset={activeDataset}
                isLoading={isDatasetLoading}
                selectedSlaTarget={selectedSlaTarget}
                onSelectSlaTarget={setSelectedSlaTarget}
                onSelectTicket={(t) => setSelectedTicket(t)}
                onNavigateToTriage={() => setActiveTab('triage')}
                onNavigateToSquads={() => setActiveTab('squads')}
                onNavigateToActions={() => setActiveTab('actions')}
              />

              <RecommendationCards
                datasetId={selectedDatasetId}
                selectedSlaTarget={selectedSlaTarget}
                teams={teams}
                onActionCreated={refreshData}
                onToast={showToast}
                demoTickets={tickets}
                onDemoApprove={handleApproveRecommendation}
                onDemoReject={handleRejectRecommendation}
                onDemoSelectTicket={(t) => setSelectedTicket(t)}
              />
            </div>
          )}

          {/* TAB 2: TASKS & QUEUE */}
          {activeTab === 'triage' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-[#172B28] tracking-tight">Operational Triage Queue</h1>
                  <p className="text-xs text-[#667873] mt-0.5">Real-time incident stream, predictive risk ratings, and squad reassignments</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleOpenAutoOptimizer}
                    className="px-4 py-2 rounded-xl bg-[#145C43] hover:bg-[#103D30] text-white text-xs font-bold shadow-2xs transition-all duration-150 cursor-pointer flex items-center space-x-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#DCE9E1]" />
                    <span>Auto-Optimize Queue</span>
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

          {/* TAB 3: ACTION TRACKER */}
          {activeTab === 'actions' && (
            <div>
              <ActionTrackerView
                datasetId={selectedDatasetId}
                onToast={showToast}
              />
            </div>
          )}

          {/* TAB 4: SURGE FORECAST */}
          {activeTab === 'bottlenecks' && (
            <div>
              <BottleneckForecastView />
            </div>
          )}

          {/* TAB 5: SQUAD DISPATCH */}
          {activeTab === 'squads' && (
            <div>
              <SquadDispatch
                teams={teams}
                tickets={tickets}
                onOpenTransferModal={(t) => setTransferModalTicket(t)}
              />
            </div>
          )}

          {/* TAB 6: SCORECARD */}
          {activeTab === 'scorecard' && (
            <div>
              <ImpactScorecardView
                datasetId={selectedDatasetId}
                selectedSlaTarget={selectedSlaTarget}
              />
            </div>
          )}

          {/* TAB 7: EXPLAINABILITY & DECISION LOGIC */}
          {activeTab === 'explainability' && (
            <div>
              <ExplainabilityView
                tickets={tickets}
                teams={teams}
                onReassign={handleReassign}
              />
            </div>
          )}

          {/* TAB 8: LIVE SIMULATOR */}
          {activeTab === 'simulation' && (
            <div>
              <SimulationControlView
                activeDatasetId={selectedDatasetId}
                onRefreshData={refreshData}
                showToast={showToast}
              />
            </div>
          )}

          {/* TAB 9: BUSINESS CONFIGURATION */}
          {activeTab === 'config' && (
            <div>
              <BusinessConfigView
                showToast={showToast}
              />
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

        {/* Universal Squad Selector Transfer Modal */}
        {transferModalTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#E2EAE5] text-xs space-y-5 animate-fade-in text-[#172B28]">
              <div className="flex justify-between items-start pb-3 border-b border-[#E2EAE5]">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-[#DCE9E1]/70 text-[#145C43] border border-[#145C43]/20">
                      {transferModalTicket.id}
                    </span>
                    <span className="text-xs font-semibold text-[#667873]">
                      {transferModalTicket.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#172B28] mt-2">{transferModalTicket.problem}</h3>
                  <p className="text-[11px] text-[#667873] mt-0.5">
                    Currently with: <strong className="text-[#172B28]">{teams.find(t => t.id === transferModalTicket.assignedTeamId)?.name}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setTransferModalTicket(null)}
                  className="text-[#667873] hover:text-[#172B28] cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <div className="text-[11px] font-bold text-[#667873] uppercase tracking-wider mb-2.5">
                  Select Destination Squad
                </div>
                <div className="space-y-2.5">
                  {teams.map(tm => {
                    const isCurrent = tm.id === transferModalTicket.assignedTeamId;
                    const isFull = tm.activeTickets >= tm.maxCapacity;

                    return (
                      <div
                        key={tm.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                          isCurrent
                            ? 'bg-[#F4F7F5] border-[#E2EAE5] opacity-60'
                            : isFull
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'bg-white hover:bg-[#F4F7F5] border-[#E2EAE5] hover:border-[#145C43]'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-[#DCE9E1] text-[#145C43] flex items-center justify-center font-bold text-xs"><Users className="w-4 h-4" /></div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-[#172B28] text-xs">{tm.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#E2EAE5] text-[#667873]">
                                  Current Squad
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#667873] mt-0.5 font-mono">
                              Lead: {tm.lead} • Load: <strong className={isFull ? 'text-rose-600' : 'text-[#172B28]'}>{tm.activeTickets}/{tm.maxCapacity}</strong> ({Math.round((tm.activeTickets / tm.maxCapacity) * 100)}%)
                            </div>
                          </div>
                        </div>

                        <div>
                          {isCurrent ? (
                            <span className="text-[11px] text-[#667873] font-medium px-3 py-1.5">Assigned</span>
                          ) : (
                            <button
                              onClick={() => {
                                handleReassign(transferModalTicket.id, tm.id);
                                setTransferModalTicket(null);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
                                isFull
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-[#145C43] hover:bg-[#103D30] text-white'
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
            </div>
          </div>
        )}

        {/* Auto-Optimizer Recommendations Modal */}
        {optimizerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-[#E2EAE5] text-xs space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto text-[#172B28]">
              <div className="flex justify-between items-start pb-3 border-b border-[#E2EAE5]">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-md bg-[#DCE9E1]/70 text-[#145C43] border border-[#145C43]/20 font-bold text-xs font-mono">
                      <Zap className="w-3 h-3 text-[#145C43] inline mr-1" />WORKLOAD OPTIMIZER
                    </span>
                    <span className="text-[10px] font-semibold text-[#667873]">Algorithmic Balancing</span>
                  </div>
                  <h3 className="text-base font-bold text-[#172B28] mt-2">Workload Rebalancing Recommendations</h3>
                  <p className="text-[11px] text-[#667873] mt-0.5">
                    SLA Sentinel analyzes team loads, impending breach times, and skill tags to suggest reassignments that protect service level guarantees.
                  </p>
                </div>
                <button
                  onClick={() => setOptimizerModalOpen(false)}
                  className="text-[#667873] hover:text-[#172B28] cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {optimizerSuggestions
                  .filter(item => !optimizerDismissedIds.includes(item.ticket.id))
                  .map((item, idx) => {
                    const fromSquad = teams.find(t => t.id === item.fromTeamId);
                    const targetSquad = teams.find(t => t.id === item.toTeamId);

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition ${
                          item.applied
                            ? 'bg-[#DCE9E1]/40 border-[#145C43]/30'
                            : 'bg-white border-[#E2EAE5] hover:border-[#145C43] shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-[#172B28] text-xs">{item.ticket.id}</span>
                              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                {item.ticket.riskScore}/100 Risk
                              </span>
                              <span className="text-[#667873]">•</span>
                              <span className="text-xs font-semibold text-[#172B28]">{item.ticket.problem}</span>
                            </div>

                            <div className="text-[11px] text-[#667873] mt-2 flex items-center space-x-2 font-mono">
                              <span>From: {fromSquad?.name.split('—')[0] || item.fromTeamId}</span>
                              <span>→</span>
                              <span className="text-[#145C43] font-bold">To: {targetSquad?.name.split('—')[0] || item.toTeamId}</span>
                            </div>

                            <div className="text-[11px] text-[#667873] mt-1 italic">
                              "{item.reason}"
                            </div>
                          </div>

                          <div className="flex flex-col items-end space-y-1.5 shrink-0">
                            {item.applied ? (
                              <div className="flex items-center space-x-1.5 text-xs font-bold text-[#145C43] bg-[#DCE9E1]/70 border border-[#145C43]/30 px-3 py-1.5 rounded-xl">
                                <Check className="w-3.5 h-3.5 text-[#145C43]" />
                                <span>Applied</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleDismissOptimizerItem(item)}
                                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#667873] hover:bg-[#F4F7F5] transition cursor-pointer border border-[#E2EAE5]"
                                >
                                  Dismiss
                                </button>
                                <button
                                  onClick={() => handleApplyOptimizerItem(item)}
                                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[#145C43] hover:bg-[#103D30] cursor-pointer shadow-2xs transition"
                                >
                                  Reassign Now →
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex justify-end pt-3 border-t border-[#E2EAE5]">
                <button
                  onClick={() => setOptimizerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#145C43] hover:bg-[#103D30] cursor-pointer shadow-2xs transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Dataset Modal */}
        {isUploadOpen && (
          <UploadModal
            isOpen={isUploadOpen}
            onClose={() => setIsUploadOpen(false)}
            onDatasetImported={(importResult) => {
              setSelectedDatasetId(importResult.dataset_id);
              setIsUploadOpen(false);
              refreshData();
              showToast(`Dataset ${importResult.dataset_id} imported successfully`);
            }}
          />
        )}

        {/* Dataset Selector Modal */}
        {isDatasetSelectorOpen && (
          <DatasetSelectorModal
            isOpen={isDatasetSelectorOpen}
            onClose={() => setIsDatasetSelectorOpen(false)}
            currentDatasetId={selectedDatasetId}
            onSelectDataset={handleSelectDataset}
            onClearToDemo={handleClearDataset}
            onOpenUploadModal={() => {
              setIsDatasetSelectorOpen(false);
              setIsUploadOpen(true);
            }}
          />
        )}

      </div>
    </div>
  );
}
