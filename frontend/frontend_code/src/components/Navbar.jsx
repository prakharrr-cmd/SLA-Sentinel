import React, { useState } from 'react';

export default function Navbar({
  user,
  onLogout,
  theme,
  setTheme,
  onOpenUpload,
  onResetData,
  onRunAutoOptimizer,
  isLiveBackend,
  setIsLiveBackend,
  activeTab,
  setActiveTab
}) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const tabs = [
    { id: 'triage', label: '🎯 Triage & Recommendations' },
    { id: 'bottlenecks', label: '🔮 Bottlenecks & Patterns' },
    { id: 'squads', label: '👥 Squad Dispatch & Allocation' },
    { id: 'explainability', label: '🔍 Explainable Decisions' },
    { id: 'scorecard', label: '📊 Baseline vs Solution Impact' }
  ];

  return (
    <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Header Row */}
        <div className="h-16 flex items-center justify-between">
          
          {/* Logo & Product Identity */}
          <div className="flex items-center space-x-3.5">
            <div className="h-9 w-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-base shadow-xs">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-base text-slate-900 dark:text-white tracking-tight">
                  SLA-Sentinel
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  AI Operations Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Predictive Bottleneck Prevention & Decision Engine
              </p>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            
            {/* 1-Click Auto Optimizer Algorithm Trigger */}
            <button
              onClick={onRunAutoOptimizer}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
              title="Runs optimization algorithm to balance overloaded squads"
            >
              <span>⚡ Auto-Optimize Workload</span>
            </button>

            {/* Backend Data Source Mode */}
            <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-medium border border-slate-200/60 dark:border-slate-700/60">
              <button
                onClick={() => setIsLiveBackend(false)}
                className={`px-2 py-1 rounded-md transition ${
                  !isLiveBackend
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Demo Data
              </button>
              <button
                onClick={() => setIsLiveBackend(true)}
                className={`px-2 py-1 rounded-md transition flex items-center space-x-1.5 ${
                  isLiveBackend
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
                title="Connect to FastAPI on port 8000"
              >
                <span>FastAPI</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isLiveBackend ? 'bg-[#2D4A53] animate-pulse' : 'bg-slate-400'}`}></span>
              </button>
            </div>

            {/* Upload CSV */}
            <button
              onClick={onOpenUpload}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="hidden sm:inline">Import CSV</span>
            </button>

            {/* Reset Data */}
            <button
              onClick={onResetData}
              title="Reset simulation to initial state"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Manager Avatar & Dropdown */}
            <div className="relative pl-2 border-l border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center space-x-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-semibold text-xs shadow-xs">
                  {user?.avatar || 'PS'}
                </div>
                <div className="hidden xl:block text-left">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                    {user?.name || 'Prakhar Singh'}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                    {user?.role || 'Operations Manager'}
                  </div>
                </div>
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 text-xs">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="font-semibold text-slate-900 dark:text-white">{user?.name}</div>
                    <div className="text-slate-400 text-[11px] truncate">{user?.email}</div>
                    <div className="text-[10px] text-indigo-500 mt-1 font-medium">{user?.role}</div>
                  </div>
                  <div className="pt-1">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 5 Core Pillars Workflow Navigation Tabs */}
        <div className="flex space-x-1 border-t border-slate-100 dark:border-slate-800/80 -mb-px overflow-x-auto">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3.5 text-xs font-medium border-b-2 whitespace-nowrap transition flex items-center space-x-2 cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
}
