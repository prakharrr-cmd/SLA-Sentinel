import React from 'react';
import {
  LayoutDashboard,
  ListChecks,
  Activity,
  TrendingUp,
  BarChart3,
  UsersRound,
  BrainCircuit,
  Radio,
  SlidersHorizontal,
  RotateCcw,
  LogOut,
  ShieldAlert
} from 'lucide-react';

export default function Sidebar({
  user,
  onLogout,
  onResetData,
  activeTab,
  setActiveTab,
  activeDataset,
  kpis
}) {
  const operationsNavigation = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { 
      id: 'triage', 
      label: 'Tasks & Queue', 
      icon: ListChecks,
      badge: kpis?.highRiskTickets > 0 ? `${kpis.highRiskTickets}` : null,
      badgeType: 'warning'
    },
    { id: 'actions', label: 'Action Tracker', icon: Activity },
    { id: 'bottlenecks', label: 'Surge & Patterns', icon: TrendingUp },
    { id: 'scorecard', label: 'Analytics & Impact', icon: BarChart3 },
    { id: 'squads', label: 'Team Squads', icon: UsersRound },
    { id: 'explainability', label: 'Decision Logic', icon: BrainCircuit },
  ];

  const governanceNavigation = [
    { id: 'simulation', label: 'Live Simulator', icon: Radio },
    { id: 'config', label: 'SLA Policy & Config', icon: SlidersHorizontal },
  ];

  return (
    <aside className="w-full md:w-64 shrink-0 bg-white rounded-3xl md:rounded-[28px] border border-[#E2EAE5] shadow-xs p-4 md:py-6 md:px-3.5 flex flex-col justify-between select-none md:h-full md:sticky md:top-0 overflow-y-auto">
      <div className="space-y-6">
        
        {/* Brand Header */}
        <div 
          className="flex items-center space-x-3 px-2 py-1 cursor-pointer transition-opacity duration-150 hover:opacity-90" 
          onClick={() => setActiveTab('dashboard')}
          title="SLA Sentinel Operations Intelligence"
        >
          <div className="w-8 h-8 rounded-lg bg-[#145C43] text-white flex items-center justify-center shadow-xs">
            <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-sm font-bold tracking-tight text-[#172B28]">SLA Sentinel</span>
            </div>
            <div className="text-[10px] text-[#667873] font-mono leading-none mt-0.5">Decision Engine · v1.0</div>
          </div>
        </div>

        {/* OPERATIONS Section */}
        <div>
          <div className="text-[10px] font-semibold text-[#8A9B96] tracking-wider uppercase px-2.5 mb-1.5">
            Operations
          </div>
          <nav className="space-y-1">
            {operationsNavigation.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer group ${
                    isActive
                      ? 'bg-[#E6F0EA] text-[#145C43] font-bold shadow-2xs translate-x-0.5'
                      : 'text-[#667873] hover:text-[#172B28] hover:bg-[#F4F7F5] hover:translate-x-1'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {isActive ? (
                      <span className="w-1.5 h-4.5 rounded-full bg-[#145C43] shrink-0 -ml-0.5 animate-in fade-in zoom-in-75 duration-150" />
                    ) : null}
                    <Icon className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${isActive ? 'text-[#145C43]' : 'text-[#8A9B96]'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 group-hover:scale-105 transition-transform">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* GOVERNANCE & LIVE TEST Section */}
        <div>
          <div className="text-[10px] font-semibold text-[#8A9B96] tracking-wider uppercase px-2.5 mb-1.5">
            Governance &amp; Live Test
          </div>
          <nav className="space-y-1">
            {governanceNavigation.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer group ${
                    isActive
                      ? 'bg-[#E6F0EA] text-[#145C43] font-bold shadow-2xs translate-x-0.5'
                      : 'text-[#667873] hover:text-[#172B28] hover:bg-[#F4F7F5] hover:translate-x-1'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {isActive ? (
                      <span className="w-1.5 h-4.5 rounded-full bg-[#145C43] shrink-0 -ml-0.5 animate-in fade-in zoom-in-75 duration-150" />
                    ) : null}
                    <Icon className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${isActive ? 'text-[#145C43]' : 'text-[#8A9B96]'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* DATASET MANAGEMENT Section */}
        {onResetData && (
          <div>
            <div className="text-[10px] font-semibold text-[#8A9B96] tracking-wider uppercase px-2.5 mb-1.5">
              Dataset Management
            </div>
            <nav className="space-y-1">
              <button
                onClick={onResetData}
                className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-[#667873] hover:text-[#145C43] hover:bg-[#F4F7F5] hover:translate-x-1 transition-all duration-150 cursor-pointer group"
                title="Reset active dataset state back to canonical demo benchmark"
              >
                <RotateCcw className="w-4 h-4 shrink-0 text-[#8A9B96] group-hover:text-[#145C43] group-hover:-rotate-180 transition-transform duration-500" />
                <span className="truncate font-semibold">Reset Demo Baseline</span>
              </button>
            </nav>
          </div>
        )}

      </div>

      {/* User Session Footer */}
      <div className="pt-4 border-t border-[#E2EAE5] mt-6">
        <div className="p-2.5 rounded-2xl bg-[#F4F7F5] border border-[#E2EAE5] hover:border-[#145C43]/30 hover:bg-white hover:shadow-2xs transition-all duration-150 flex items-center justify-between group">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#DCE9E1] text-[#145C43] font-bold text-xs flex items-center justify-center shrink-0 font-mono group-hover:scale-105 transition-transform">
              {user?.avatar || 'PS'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#172B28] truncate">{user?.name || 'Prakhar Singh'}</div>
              <div className="text-[10px] text-[#667873] truncate">{user?.role || 'Operations Manager'}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-[#8A9B96] hover:text-rose-600 hover:bg-rose-50 hover:scale-110 active:scale-95 transition-all duration-150 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
