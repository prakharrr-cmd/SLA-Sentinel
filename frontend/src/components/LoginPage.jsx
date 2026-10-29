import React, { useState } from 'react';

export const USERS_DB = [
  {
    userId: 'prakhar',
    email: 'prakhar@sla-sentinel.internal',
    password: 'password123',
    name: 'Prakhar Singh',
    role: 'Senior Operations Manager',
    avatar: 'PS',
    badge: 'Operations Lead'
  },
  {
    userId: 'ansh',
    email: 'ansh@sla-sentinel.internal',
    password: 'password123',
    name: 'Ansh Aditya',
    role: 'Backend & Database Lead',
    avatar: 'AA',
    badge: 'API Architect'
  },
  {
    userId: 'somya',
    email: 'somya@sla-sentinel.internal',
    password: 'password123',
    name: 'Somya Purohit',
    role: 'AI & Machine Learning Lead',
    avatar: 'SP',
    badge: 'ML Engineer'
  },
  {
    userId: 'sanskriti',
    email: 'sanskriti@sla-sentinel.internal',
    password: 'password123',
    name: 'Sanskriti Rawat',
    role: 'Presentation & QA Lead',
    avatar: 'SR',
    badge: 'Product QA'
  }
];

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('prakhar');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const cleanUser = (username || '').trim().toLowerCase();
      const matched = USERS_DB.find(u => 
        u.userId.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanUser
      );

      if (!matched) {
        setError('User ID or Email not found in the operations database.');
        setIsLoading(false);
        return;
      }

      if (matched.password !== password) {
        setError('Incorrect password. Please verify your credentials.');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      onLogin(matched);
    }, 250);
  };

  const autofill = (uId, pw) => {
    setUsername(uId);
    setPassword(pw);
    setError('');
  };

  return (
    <div className="w-full max-w-md mx-auto my-auto py-12 px-4">
      <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 animate-fade-in">
        {/* Brand Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-[#132E35] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth="2.5" />
              <circle cx="12" cy="12" r="4" strokeWidth="2.5" />
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">SLA-Sentinel</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#132E35]/10 text-[#132E35] border border-[#2D4A53]/30">DEV-103</span>
            </div>
            <div className="text-[11px] text-slate-400">Operations Intelligence &amp; Decision Engine</div>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Manager Sign In</h1>
          <p className="text-xs text-slate-500 mt-1">Authenticate using your assigned manager ID to access live queues and prescriptive dispatch.</p>
        </div>

        {/* Validation Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2 animate-shake">
            <span className="text-rose-500 font-bold text-sm">⚠️</span>
            <span className="leading-tight">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">User ID or Work Email</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              required
              placeholder="e.g. prakhar or prakhar@sla-sentinel.internal"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#132E35] focus:bg-white transition text-xs text-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                required
                placeholder="Enter password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:border-[#132E35] focus:bg-white transition text-xs text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 font-bold text-white bg-[#132E35] hover:bg-[#0D1F23] rounded-xl shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center space-x-2"
          >
            {isLoading ? <span>Verifying credentials...</span> : <span>Sign In to SLA-Sentinel →</span>}
          </button>
        </form>

        {/* Database Quick Authenticate helper */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Verified Accounts in Database (Click to Fill)
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => autofill('prakhar', 'password123')}
              className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-[#2D4A53] transition cursor-pointer"
            >
              <div className="font-semibold text-slate-800 text-[11px]">Prakhar Singh</div>
              <div className="text-[10px] text-slate-400">ID: prakhar</div>
            </button>
            <button
              type="button"
              onClick={() => autofill('ansh', 'password123')}
              className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-[#2D4A53] transition cursor-pointer"
            >
              <div className="font-semibold text-slate-800 text-[11px]">Ansh Aditya</div>
              <div className="text-[10px] text-slate-400">ID: ansh</div>
            </button>
            <button
              type="button"
              onClick={() => autofill('somya', 'password123')}
              className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-[#2D4A53] transition cursor-pointer"
            >
              <div className="font-semibold text-slate-800 text-[11px]">Somya Purohit</div>
              <div className="text-[10px] text-slate-400">ID: somya</div>
            </button>
            <button
              type="button"
              onClick={() => autofill('sanskriti', 'password123')}
              className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-[#2D4A53] transition cursor-pointer"
            >
              <div className="font-semibold text-slate-800 text-[11px]">Sanskriti Rawat</div>
              <div className="text-[10px] text-slate-400">ID: sanskriti</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
