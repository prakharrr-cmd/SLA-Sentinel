import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('prakhar@opspulse.ai');
  const [password, setPassword] = useState('••••••••••••');
  const [role, setRole] = useState('Senior Operations Manager');

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-3xl p-8 md:p-10 shadow-2xl border border-slate-100">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-[#134E39] text-white flex items-center justify-center font-bold text-lg shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <span className="text-xl font-extrabold text-slate-900 tracking-tight">OpsPulse</span>
          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-[#134E39] border border-emerald-200">DEV-103</span>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manager Sign In</h1>
        <p className="text-xs text-slate-500 mt-1">Access the AI operations intelligence decision engine and squad dispatch queue.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onLogin({ name: 'Prakhar Singh', email, role, avatar: 'PS' }); }} className="space-y-4 text-xs">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-[#134E39] focus:bg-white transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-[#134E39] focus:bg-white transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Manager Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-[#134E39] focus:bg-white transition">
            <option value="Senior Operations Manager">Senior Operations Manager (Full Dispatch Authority)</option>
            <option value="Squad Lead">Squad Lead (Workload Balancing)</option>
          </select>
        </div>
        <button type="submit" className="w-full py-3 px-4 text-xs font-bold text-white bg-[#134E39] hover:bg-[#0E3A2B] rounded-xl shadow-md transition cursor-pointer">
          Sign In to OpsPulse Dashboard →
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Instant Demo Logins</span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button type="button" onClick={() => onLogin({ name: 'Prakhar Singh', role: 'Senior Operations Manager', email: 'prakhar@opspulse.ai', avatar: 'PS' })} className="text-left p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 transition cursor-pointer">
            <div className="font-semibold text-slate-900">Prakhar Singh</div>
            <div className="text-[10px] text-slate-500">Ops Manager</div>
          </button>
          <button type="button" onClick={() => onLogin({ name: 'Ansh Aditya', role: 'API Lead', email: 'ansh@opspulse.ai', avatar: 'AA' })} className="text-left p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 transition cursor-pointer">
            <div className="font-semibold text-slate-900">Ansh Aditya</div>
            <div className="text-[10px] text-slate-500">Backend Lead</div>
          </button>
        </div>
      </div>
    </div>
  );
}
