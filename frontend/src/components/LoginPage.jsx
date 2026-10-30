import React, { useState } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';

export const USERS_DB = [
  {
    userId: 'prakhar',
    email: 'prakhar@opspulse.ai',
    password: 'password123',
    name: 'Prakhar Singh',
    role: 'Operations Manager',
    avatar: 'PS',
    badge: 'Operations Lead'
  },
  {
    userId: 'ansh',
    email: 'ansh@opspulse.ai',
    password: 'password123',
    name: 'Ansh Aditya',
    role: 'Backend Systems Lead',
    avatar: 'AA',
    badge: 'System Architect'
  },
  {
    userId: 'somya',
    email: 'somya@opspulse.ai',
    password: 'password123',
    name: 'Somya Purohit',
    role: 'Machine Learning Lead',
    avatar: 'SP',
    badge: 'ML Engineer'
  }
];

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('prakhar@opspulse.ai');
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
        setError('Work Email or User ID not found in operations registry.');
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
    }, 200);
  };

  const autofill = (email, pw) => {
    setUsername(email);
    setPassword(pw);
    setError('');
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-[#F4F7F5] p-4 font-sans text-[#172B28]">
      <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-[#E2EAE5] max-w-[420px] w-full space-y-6">
        
        {/* Brand Header */}
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#145C43] text-white flex items-center justify-center shadow-xs">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth="2.2" />
              <circle cx="12" cy="12" r="4" strokeWidth="2.2" />
            </svg>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold tracking-tight text-[#172B28]">SLA Sentinel</span>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#DCE9E1]/60 text-[#145C43] border border-[#145C43]/20">
              DEV-103
            </span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-xl font-semibold text-[#172B28] tracking-tight">Manager Sign In</h1>
          <p className="text-xs text-[#667873] mt-1 leading-relaxed">
            Operations intelligence and prescriptive SLA decision engine.
          </p>
        </div>

        {/* Validation Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#172B28] mb-1.5 text-xs">Work Email or User ID</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              required
              placeholder="prakhar@opspulse.ai"
              className="w-full bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl px-3.5 py-2.5 text-xs text-[#172B28] focus:outline-none focus:border-[#145C43] focus:ring-1 focus:ring-[#145C43] focus:bg-white transition"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-medium text-[#172B28] text-xs">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-[#667873] hover:text-[#145C43] cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              required
              placeholder="••••••••"
              className="w-full bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl px-3.5 py-2.5 text-xs text-[#172B28] focus:outline-none focus:border-[#145C43] focus:ring-1 focus:ring-[#145C43] focus:bg-white transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 font-medium text-white bg-[#145C43] hover:bg-[#103D30] rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center space-x-2 text-xs mt-2 disabled:opacity-50"
          >
            {isLoading ? <span>Verifying credentials...</span> : <span>Sign In <ArrowRight className="w-3.5 h-3.5 inline ml-1.5" /></span>}
          </button>
        </form>

        {/* Quick Demo Logins Section */}
        <div className="pt-4 border-t border-[#E2EAE5]">
          <span className="text-[10px] font-semibold text-[#667873] uppercase tracking-wider block mb-2.5">
            Quick Demo Accounts
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => autofill('prakhar@opspulse.ai', 'password123')}
              className="text-left p-3 rounded-xl bg-white hover:bg-[#F4F7F5] border border-[#E2EAE5] hover:border-[#145C43] transition cursor-pointer group"
            >
              <div className="font-medium text-[#172B28] text-xs group-hover:text-[#145C43] transition">Prakhar Singh</div>
              <div className="text-[10px] text-[#667873] mt-0.5">Operations Manager</div>
            </button>
            <button
              type="button"
              onClick={() => autofill('ansh@opspulse.ai', 'password123')}
              className="text-left p-3 rounded-xl bg-white hover:bg-[#F4F7F5] border border-[#E2EAE5] hover:border-[#145C43] transition cursor-pointer group"
            >
              <div className="font-medium text-[#172B28] text-xs group-hover:text-[#145C43] transition">Ansh Aditya</div>
              <div className="text-[10px] text-[#667873] mt-0.5">Backend Lead</div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
