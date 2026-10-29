import React from 'react';

export default function Sidebar({
  user,
  onLogout,
  onOpenUpload,
  onRunAutoOptimizer,
  activeTab,
  setActiveTab
}) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '✦', badge: null },
    { id: 'triage', label: 'Tasks & Queue', icon: '🎯', badge: '12+' },
    { id: 'bottlenecks', label: 'Surge Forecast', icon: '🔮', badge: null },
    { id: 'scorecard', label: 'Analytics & Impact', icon: '📊', badge: null },
    { id: 'squads', label: 'Team Squads', icon: '👥', badge: null }
  ];

  return (
    <aside className="w-full md:w-60 flex-shrink-0 flex flex-col justify-between select-none">
      <div className="space-y-6">
        
        {/* Brand Logo */}
        <div className="flex items-center space-x-3 px-2 py-1">
          <div className="w-10 h-10 rounded-2xl bg-[#134E39] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth="2.5" />
              <circle cx="12" cy="12" r="4" strokeWidth="2.5" />
            </svg>
          </div>
          <div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">OpsPulse</span>
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
                      ? 'bg-[#134E39] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-[#0E3A2B] text-emerald-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* GENERAL Section */}
        <div>
          <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-3 mb-2">
            General
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('explainability')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'explainability'
                  ? 'bg-[#134E39] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Decision Evidence</span>
            </button>

            <button
              onClick={onOpenUpload}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              <span>Import CSV</span>
            </button>

            <button
              onClick={onLogout}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              <span>Logout</span>
            </button>
          </nav>
        </div>

      </div>

      {/* Bottom Promo / Dispatcher Card */}
      <div className="mt-6 bg-[#0E3A2B] rounded-3xl p-5 text-white relative overflow-hidden shadow-lg">
        <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-xs mb-3">
          ✦
        </div>
        <h4 className="text-xs font-bold tracking-tight">AI Mobile Dispatcher</h4>
        <p className="text-[10px] text-emerald-200/70 mt-0.5 leading-relaxed">Real-time surge alerts & 1-click rebalancing on iOS/Android.</p>
        <button
          onClick={onRunAutoOptimizer}
          className="mt-3.5 w-full py-2 px-3 rounded-xl bg-[#1B8A5A] hover:bg-emerald-600 text-white text-[11px] font-bold transition shadow-xs cursor-pointer text-center"
        >
          Auto-Optimize
        </button>
      </div>
    </aside>
  );
}
