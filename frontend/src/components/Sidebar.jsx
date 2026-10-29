import React from 'react';

export default function Sidebar({
  user,
  onLogout,
  onResetData,
  activeTab,
  setActiveTab
}) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '✦', badge: null },
    { id: 'triage', label: 'Tasks & Queue', icon: '🎯', badge: '7' },
    { id: 'bottlenecks', label: 'Surge Forecast', icon: '🔮', badge: null },
    { id: 'scorecard', label: 'Analytics & Impact', icon: '📊', badge: null },
    { id: 'squads', label: 'Team Squads', icon: '👥', badge: null }
  ];

  return (
    <aside className="w-full md:w-56 flex-shrink-0 flex flex-col justify-between select-none border-b md:border-b-0 md:border-r border-slate-100 p-5 md:py-7 md:pl-6 md:pr-0">
      <div className="space-y-6">
        
        {/* Brand Logo with SLA-Sentinel */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-10 h-10 rounded-2xl bg-[#132E35] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth="2.5" />
              <circle cx="12" cy="12" r="4" strokeWidth="2.5" />
            </svg>
          </div>
          <div>
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">SLA-Sentinel</span>
            <div className="text-[10px] text-slate-400 font-mono">DEV-103 Engine</div>
          </div>
        </div>

        {/* MENU Section */}
        <div>
          <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-3 mb-2">
            Menu
          </div>
          <nav className="space-y-1">
            {menuItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-[#132E35] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-[#0D1F23] text-emerald-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* GENERAL Section (Cleaned up: No Import CSV, No Decision Evidence) */}
        <div>
          <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-3 mb-2">
            Controls
          </div>
          <nav className="space-y-1">
            {onResetData && (
              <button
                onClick={onResetData}
                className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition cursor-pointer"
              >
                <span>↺</span>
                <span>Reset Baseline</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </nav>
        </div>

      </div>

      {/* Clean Manager Identity Badge (Replaces mobile dispatcher card) */}
      <div className="mt-8 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#132E35] flex items-center justify-center font-bold text-xs">
          {user?.avatar || 'PS'}
        </div>
        <div className="truncate text-left">
          <div className="text-xs font-bold text-slate-800 truncate">{user?.name || 'Prakhar Singh'}</div>
          <div className="text-[10px] text-emerald-600 font-mono">● Engine Online</div>
        </div>
      </div>
    </aside>
  );
}
