import React from 'react';
import { AI_PATTERN_INSIGHTS, HOURLY_WORKLOAD_FORECAST } from '../data/mockData';

export default function BottleneckForecastView() {
  return (
    <div className="space-y-8">
      
      {/* View Header */}
      <div className="pb-3 border-b border-[#2D4A53]">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 bg-[#132E35] border border-[#2D4A53] text-[#AFB3B7]">
            PILLARS 1 & 2
          </span>
          <span className="text-xs text-[#69818D]">Pattern Detection & Predictive Forecasting</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-[#AFB3B7] mt-1">
          Workload Surge Forecasting & AI Pattern Identification
        </h2>
        <p className="text-xs text-[#69818D] mt-1 max-w-3xl">
          Uses AI/ML time-series forecasting to predict impending queue surges and NLP pattern summarization to identify recurring performance bottlenecks.
        </p>
      </div>

      {/* 1. Workload Surge Forecasting (Sharp edges, #132E35) */}
      <div className="bg-[#132E35] border border-[#2D4A53] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#AFB3B7]">
              Hourly Workload Surge Forecast vs Squad Capacity
            </h3>
            <p className="text-xs text-[#69818D]">
              Machine learning forecast of ticket volume spikes against total concurrent squad bandwidth
            </p>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 self-start sm:self-auto font-mono">
            ⚡ PREDICTED SURGE: 13:00 - 15:00
          </span>
        </div>

        {/* Forecast Bars */}
        <div className="space-y-4">
          {HOURLY_WORKLOAD_FORECAST.map(slot => {
            const isAnomaly = slot.incomingTickets > slot.squadCapacity;
            const pct = Math.round((slot.incomingTickets / 140) * 100);
            const capPct = Math.round((slot.squadCapacity / 140) * 100);

            return (
              <div key={slot.hour} className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-[#AFB3B7] w-16">
                    {slot.hour}
                  </span>
                  <div className="flex items-center space-x-3">
                    <span className="text-[#69818D]">
                      Forecast: <strong className="text-[#AFB3B7]">{slot.incomingTickets} tickets</strong> (Capacity: {slot.squadCapacity})
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 ${
                      isAnomaly
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : slot.anomalyStatus === 'Warning'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-[#0D1F23] text-[#69818D] border border-[#2D4A53]'
                    }`}>
                      {slot.anomalyStatus}
                    </span>
                  </div>
                </div>

                {/* Comparative Visual Bar (Sharp) */}
                <div className="relative h-2.5 w-full bg-[#0D1F23] overflow-hidden border border-[#2D4A53]">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full transition-all ${
                      isAnomaly ? 'bg-rose-500' : slot.incomingTickets >= 75 ? 'bg-amber-500' : 'bg-[#2D4A53]'
                    }`}
                  ></div>
                  {/* Capacity Marker Line */}
                  <div
                    style={{ left: `${capPct}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-[#AFB3B7] z-10"
                    title={`Squad Capacity Limit: ${slot.squadCapacity}`}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-[#2D4A53] flex items-center justify-between text-xs text-[#69818D]">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-[#AFB3B7] inline-block"></span>
            <span>Vertical line represents squad capacity limit (75 concurrent tickets)</span>
          </div>
          <span className="text-rose-400 font-semibold font-mono">50-ticket deficit predicted at 13:00</span>
        </div>
      </div>

      {/* 2. NLP / LLM Pattern Summarizer (Sharp, #132E35) */}
      <div className="bg-[#132E35] border border-[#2D4A53] p-6 shadow-xs">
        <div className="mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#AFB3B7]">
            NLP & LLM Pattern Summarizer (Root Cause Detection)
          </h3>
          <p className="text-xs text-[#69818D]">
            Natural language summaries explaining recurring operational gaps and root causes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AI_PATTERN_INSIGHTS.map((insight, idx) => (
            <div
              key={idx}
              className="p-5 bg-[#0D1F23] border border-[#2D4A53] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#AFB3B7]">
                    {insight.category}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {insight.frequency}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[#AFB3B7] mb-2">
                  {insight.title}
                </h4>
                <p className="text-xs text-[#69818D] leading-relaxed mb-4">
                  {insight.summary}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#2D4A53]">
                {insight.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono px-1.5 py-0.5 bg-[#132E35] text-[#AFB3B7] border border-[#2D4A53]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
