import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, StepForward, Square, RotateCcw, RefreshCw } from 'lucide-react';
import { opsApi } from '../services/api';

export default function SimulationControlView({ activeDatasetId, onRefreshData, showToast }) {
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState(1.0);

  const fetchStatusAndEvents = useCallback(async () => {
    try {
      const [statusRes, eventsRes] = await Promise.all([
        opsApi.getSimulationStatus().catch(() => null),
        opsApi.getSimulationEvents(25).catch(() => []),
      ]);
      if (statusRes) {
        setStatus(statusRes);
        setSelectedSpeed(statusRes.speed || 1.0);
      }
      if (Array.isArray(eventsRes)) {
        setEvents(eventsRes);
      }
    } catch (e) {
      console.error('Error fetching simulation state:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatusAndEvents();
    const interval = setInterval(fetchStatusAndEvents, 4000);
    return () => clearInterval(interval);
  }, [fetchStatusAndEvents]);

  const handleAction = async (actionFn, successMsg) => {
    try {
      setActionLoading(true);
      await actionFn();
      if (showToast) showToast(successMsg);
      await fetchStatusAndEvents();
      if (onRefreshData) onRefreshData();
    } catch (e) {
      if (showToast) showToast(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSpeedChange = async (newSpeed) => {
    setSelectedSpeed(newSpeed);
    await handleAction(
      () => opsApi.setSimulationSpeed(newSpeed),
      `Simulation speed updated to ${newSpeed}x`
    );
  };

  const isRunning = status?.status === 'running';
  const isPaused = status?.status === 'paused';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-[#DCE9E1]/70 border border-[#145C43]/20 text-[#145C43]">
                LOCAL SIMULATION ENVIRONMENT
              </span>
              <span className="text-xs text-[#667873] font-mono">Real-Time Event Stream</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#172B28] mt-1">
              Live Synthetic Incident Simulator
            </h2>
            <p className="text-xs text-[#667873] mt-1 max-w-2xl leading-relaxed">
              Drives realistic support ticket lifecycle events (incoming incidents, squad assignments, progressive deadline decay, and resolution transitions) directly into the local SQLite database.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center space-x-3 bg-[#F4F7F5] border border-[#E2EAE5] p-3 rounded-xl">
            <div className="text-center px-3 border-r border-[#E2EAE5]">
              <div className="text-[10px] font-mono uppercase text-[#667873]">Status</div>
              <div className="text-xs font-bold font-mono text-[#145C43]">
                {status?.status?.toUpperCase() || 'IDLE'}
              </div>
            </div>
            <div className="text-center px-3 border-r border-[#E2EAE5]">
              <div className="text-[10px] font-mono uppercase text-[#667873]">Events</div>
              <div className="text-xs font-bold font-mono text-[#172B28]">
                {status?.events_emitted ?? 0}
              </div>
            </div>
            <div className="text-center px-3">
              <div className="text-[10px] font-mono uppercase text-[#667873]">Target Dataset</div>
              <div className="text-[11px] font-bold font-mono text-[#172B28] truncate max-w-[120px]">
                {status?.dataset_id || 'demo-dataset'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Execution Controls */}
        <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs space-y-5">
          <div>
            <h3 className="text-xs font-extrabold text-[#172B28] uppercase tracking-wider mb-1">
              Simulation Playback
            </h3>
            <p className="text-[11px] text-[#667873]">
              Start, pause, step, or reset background event emission.
            </p>
          </div>

          {/* Status Badge */}
          <div className="p-3.5 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : isPaused ? 'bg-amber-400' : 'bg-slate-300'}`} />
              <span className="text-xs font-bold font-mono text-[#172B28]">
                State: {status?.status?.toUpperCase() || 'OFFLINE'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#667873]">
              {status?.last_event_at ? new Date(status.last_event_at).toLocaleTimeString() : 'No events yet'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            {!isRunning ? (
              <button
                disabled={actionLoading}
                onClick={() => handleAction(opsApi.startSimulation, 'Simulation started')}
                className="col-span-2 py-3 px-4 rounded-xl bg-[#145C43] hover:bg-[#103D30] text-white text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Simulation</span>
              </button>
            ) : (
              <button
                disabled={actionLoading}
                onClick={() => handleAction(opsApi.pauseSimulation, 'Simulation paused')}
                className="col-span-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-[#172B28] text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Simulation</span>
              </button>
            )}

            <button
              disabled={actionLoading}
              onClick={() => handleAction(opsApi.stepSimulation, 'Simulated single event step')}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-[#F4F7F5] text-[#172B28] text-xs font-bold border border-[#E2EAE5] transition flex items-center justify-center space-x-1 cursor-pointer"
            >
              <StepForward className="w-3.5 h-3.5" />
              <span>Step 1 Tick</span>
            </button>

            <button
              disabled={actionLoading}
              onClick={() => handleAction(opsApi.stopSimulation, 'Simulation stopped')}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold border border-[#E2EAE5] hover:border-rose-200 transition flex items-center justify-center space-x-1 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>

            <button
              disabled={actionLoading}
              onClick={() => handleAction(opsApi.resetSimulation, 'Simulation environment reset to baseline')}
              className="col-span-2 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition flex items-center justify-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Synthetic Environment</span>
            </button>
          </div>

          {/* Speed Controls */}
          <div className="pt-4 border-t border-[#E2EAE5]">
            <div className="text-[11px] font-bold text-[#667873] uppercase tracking-wider mb-2">
              Time Multiplier
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[0.5, 1.0, 2.0, 5.0].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                    selectedSpeed === s
                      ? 'bg-[#145C43] text-white border-[#145C43] shadow-2xs'
                      : 'bg-[#F4F7F5] text-[#667873] hover:text-[#172B28] border-[#E2EAE5]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Live Event Feed */}
        <div className="lg:col-span-2 bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E2EAE5] mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#DCE9E1]/70 text-[#145C43] border border-[#145C43]/20">
                  ACTIVITY LOG
                </span>
                <span className="text-xs font-bold text-[#172B28] tracking-wide">
                  Live Event Stream ({events.length} logged)
                </span>
              </div>
              <button
                onClick={fetchStatusAndEvents}
                className="text-xs text-[#667873] hover:text-[#172B28] font-mono transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 inline mr-1" />Refresh
              </button>
            </div>

            {/* Event List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {events.length === 0 ? (
                <div className="text-center py-12 text-[#667873] font-mono text-xs">
                  No simulation events generated yet. Click "Start Simulation" or "Step 1 Tick" to generate live incident activity.
                </div>
              ) : (
                events.map((ev, idx) => (
                  <div
                    key={ev.id || idx}
                    className="p-3 rounded-xl bg-[#F4F7F5] border border-[#E2EAE5] flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-[#172B28]">{ev.ticket_id || 'TICK'}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white text-[#667873] border border-[#E2EAE5]">
                          {ev.event_type}
                        </span>
                        {ev.team_id && (
                          <span className="text-[10px] font-mono font-semibold text-[#145C43]">
                            → {ev.team_id}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#667873] leading-snug">
                        {ev.details?.description || ev.description || JSON.stringify(ev.details || {})}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#667873] whitespace-nowrap">
                      {ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2EAE5] mt-4 text-[11px] text-[#667873] flex items-center justify-between">
            <span>● Synthetic updates directly reflect across Queue, Risk Scoring, and Recommendations.</span>
            <span className="font-mono">Engine: DEV-103</span>
          </div>
        </div>

      </div>
    </div>
  );
}
