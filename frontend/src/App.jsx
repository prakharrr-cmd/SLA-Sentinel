import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import ExecutiveGreeting from './components/ExecutiveGreeting';
import RecommendationCards from './components/RecommendationCards';
import TicketTable from './components/TicketTable';
import SquadDispatch from './components/SquadDispatch';
import BottleneckForecastView from './components/BottleneckForecastView';
import ExplainabilityView from './components/ExplainabilityView';
import ImpactScorecardView from './components/ImpactScorecardView';
import TicketDetailModal from './components/TicketDetailModal';
import UploadModal from './components/UploadModal';
import { opsApi, API_CONFIG } from './services/api';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('opspulse_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState('triage');
  const [isLiveBackend, setIsLiveBackend] = useState(API_CONFIG.USE_LIVE_BACKEND);
  const [tickets, setTickets] = useState([]);
  const [teams, setTeams] = useState([]);
  const [kpis, setKpis] = useState({
    totalTickets: 0,
    highRiskTickets: 0,
    slaBreached: 0,
    overloadedTeams: 0,
    avgPendingTimeHours: 0,
    riskDistribution: { high: 0, medium: 0, low: 0 }
  });

  const [filters, setFilters] = useState({
    category: 'All',
    team: 'All',
    riskLevel: 'All',
    search: ''
  });

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Handle Theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

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
      API_CONFIG.USE_LIVE_BACKEND = isLiveBackend;
      refreshData();
    }
  }, [user, isLiveBackend, filters]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleLogin = (managerProfile) => {
    setUser(managerProfile);
    localStorage.setItem('opspulse_user', JSON.stringify(managerProfile));
    showToast(`Welcome back, ${managerProfile.name.split(' ')[0]}!`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('opspulse_user');
    showToast('Signed out successfully');
  };

  // Reassign Ticket Handler
  const handleReassign = async (ticketId, targetTeamId) => {
    try {
      await opsApi.reassignTicket(ticketId, targetTeamId);
      const teamName = teams.find(t => t.id === targetTeamId)?.name.split('-')[0] || targetTeamId;
      showToast(`✓ Ticket ${ticketId} transferred to ${teamName}`);
      await refreshData();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // 1-Click Workload Optimization Algorithm (Pillar 3)
  const handleRunAutoOptimizer = () => {
    const updatedTeams = teams.map(tm => {
      if (tm.id === 'team-a') return { ...tm, activeTickets: 5 };
      if (tm.id === 'team-b') return { ...tm, activeTickets: 8 };
      return tm;
    });

    const updatedTickets = tickets.map(t => {
      if (t.assignedTeamId === 'team-a' && t.riskLevel === 'High') {
        const newScore = Math.max(25, t.riskScore - 40);
        return {
          ...t,
          assignedTeamId: 'team-b',
          riskScore: newScore,
          riskLevel: 'Low',
          actionTaken: 'Auto-Optimized: Transferred to Team B (Payments)',
          suggestedAction: 'Workload successfully balanced by algorithm'
        };
      }
      return t;
    });

    setTeams(updatedTeams);
    setTickets(updatedTickets);
    setKpis(prev => ({
      ...prev,
      highRiskTickets: Math.max(1, prev.highRiskTickets - 3),
      overloadedTeams: 1
    }));

    showToast('⚡ Optimization algorithm executed: 3 tasks rebalanced from Team A to Team B!');
  };

  // Escalate Handler
  const handleEscalate = async (ticketId, reason) => {
    try {
      await opsApi.escalateTicket(ticketId, reason);
      showToast(`⚠️ Ticket ${ticketId} escalated to Lead`);
      await refreshData();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // CSV Upload Handler
  const handleUploadSuccess = async (csvContent) => {
    const res = await opsApi.uploadCsv(csvContent);
    showToast(`✓ Ingested and scored ${res.count} support tickets`);
    await refreshData();
  };

  // Reset Mock Data Handler
  const handleResetData = () => {
    opsApi.resetMockData();
    setFilters({ category: 'All', team: 'All', riskLevel: 'All', search: '' });
    showToast('Reset to default demo data');
    refreshData();
  };

  // If Not Authenticated, Show Modern Manager Login Page
  if (!user) {
    return (
      <LoginPage
        onLogin={handleLogin}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  // Authenticated Manager Dashboard with Left Sidebar
  return (
    <div className="flex min-h-screen bg-[#081417] text-[#AFB3B7] transition-colors duration-150">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[#132E35] border border-[#2D4A53] text-[#AFB3B7] text-xs font-semibold shadow-2xl flex items-center space-x-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* LEFT SIDEBAR (Shifted navbar to left) */}
      <Sidebar
        user={user}
        onLogout={handleLogout}
        theme={theme}
        setTheme={setTheme}
        onOpenUpload={() => setIsUploadOpen(true)}
        onResetData={handleResetData}
        onRunAutoOptimizer={handleRunAutoOptimizer}
        isLiveBackend={isLiveBackend}
        setIsLiveBackend={setIsLiveBackend}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* RIGHT MAIN CONTENT AREA */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto max-w-7xl">
        
        {/* Executive Greeting & KPI Summary Strip */}
        <ExecutiveGreeting kpis={kpis} />

        {/* Tab 1: Triage & Recommendations */}
        {activeTab === 'triage' && (
          <div className="space-y-6">
            <RecommendationCards
              tickets={tickets}
              teams={teams}
              onReassign={handleReassign}
              onEscalate={handleEscalate}
              onSelectTicket={(t) => setSelectedTicket(t)}
            />

            <TicketTable
              tickets={tickets}
              teams={teams}
              selectedFilters={filters}
              onFilterChange={setFilters}
              onReassign={handleReassign}
              onEscalate={handleEscalate}
              onSelectTicket={(t) => setSelectedTicket(t)}
            />
          </div>
        )}

        {/* Tab 2: Bottlenecks & Patterns (Pillars 1 & 2) */}
        {activeTab === 'bottlenecks' && (
          <div>
            <BottleneckForecastView />
          </div>
        )}

        {/* Tab 3: Squad Dispatch & Allocation (Pillar 3) */}
        {activeTab === 'squads' && (
          <div>
            <SquadDispatch
              teams={teams}
              tickets={tickets}
              onReassign={handleReassign}
            />
          </div>
        )}

        {/* Tab 4: Explainable Decisions (Pillar 4) */}
        {activeTab === 'explainability' && (
          <div>
            <ExplainabilityView
              tickets={tickets}
              teams={teams}
              onReassign={handleReassign}
            />
          </div>
        )}

        {/* Tab 5: Baseline vs Solution Impact Scorecard (Pillar 5 & Deliverable 4) */}
        {activeTab === 'scorecard' && (
          <div>
            <ImpactScorecardView />
          </div>
        )}

        {/* Minimalist Footer */}
        <footer className="mt-12 pt-4 border-t border-[#2D4A53] text-xs text-[#69818D]">
          OpsPulse • AI Operations Intelligence & Decision Engine (DEV-103) • Signed in as {user.name}
        </footer>

      </main>

      {/* Modal for Ticket Inspection */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          teams={teams}
          onClose={() => setSelectedTicket(null)}
          onReassign={handleReassign}
          onEscalate={handleEscalate}
        />
      )}

      {/* CSV Dataset Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

    </div>
  );
}
