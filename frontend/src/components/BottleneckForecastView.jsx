import React from 'react';
import { TrendingUp } from 'lucide-react';
import { AI_PATTERN_INSIGHTS, HOURLY_WORKLOAD_FORECAST } from '../data/mockData';

export default function BottleneckForecastView() {
  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div className="pb-4 border-b border-[#E2EAE5]">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-[#DCE9E1]/70 border border-[#145C43]/20 text-[#145C43] rounded-md">
            PILLARS 1 &amp; 2
          </span>
          <span className="text-xs text-[#667873]">Pattern Detection &amp; Predictive Forecasting</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-[#172B28] mt-1">
          Workload Surge Forecasting &amp; AI Pattern Identification
        </h2>
        <p className="text-xs text-[#667873] mt-1 max-w-3xl">
          Uses AI/ML time-series forecasting to predict impending queue surges and NLP pattern summarization to identify recurring performance bottlenecks.
        </p>
      </div>

      {/* 1. Workload Surge Forecasting */}
      <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#172B28]">
              Hourly Workload Surge Forecast vs Squad Capacity
            </h3>
            <p className="text-xs text-[#667873]">
              Machine learning forecast of ticket volume spikes against total concurrent squad bandwidth
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-md self-start sm:self-auto font-mono">
            <span className="inline-flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-rose-700" />PREDICTED SURGE: 13:00 - 15:00</span>
          </span>
        </div>

        {/* Forecast Bars */}
        <div className="space-y-4">
          {HOURLY_WORKLOAD_FORECAST.map(slot => {
            const isAnomaly = slot.incomingTickets > slot.squadCapacity;
            const pct = Math.round((slot.incomingTickets / 140) * 100);
            const capPct = Math.round((slot.squadCapacity / 140) * 100);

            return (
              <div key={slot.hour} className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-[#172B28] w-16">
                    {slot.hour}
                  </span>
                  <div className="flex items-center space-x-3">
                    <span className="text-[#667873]">
                      Forecast: <strong className="text-[#172B28] font-mono">{slot.incomingTickets} tickets</strong> (Capacity: {slot.squadCapacity})
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                      isAnomaly
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : slot.anomalyStatus === 'Warning'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-[#F4F7F5] text-[#667873] border border-[#E2EAE5]'
                    }`}>
                      {slot.anomalyStatus}
                    </span>
                  </div>
                </div>

                {/* Comparative Visual Bar */}
                <div className="relative h-2.5 w-full bg-[#F4F7F5] overflow-hidden border border-[#E2EAE5] rounded-full">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full transition-all rounded-full ${
                      isAnomaly ? 'bg-rose-500' : slot.incomingTickets >= 75 ? 'bg-amber-500' : 'bg-[#145C43]'
                    }`}
                  ></div>
                  {/* Capacity Marker Line */}
                  <div
                    style={{ left: `${capPct}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-[#172B28] z-10"
                    title={`Squad Capacity Limit: ${slot.squadCapacity}`}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-[#E2EAE5] flex items-center justify-between text-xs text-[#667873]">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-[#172B28] inline-block rounded-xs"></span>
            <span>Vertical line represents squad capacity limit (75 concurrent tickets)</span>
          </div>
          <span className="text-rose-600 font-semibold font-mono">50-ticket deficit predicted at 13:00</span>
        </div>
      </div>

      {/* 2. NLP / LLM Pattern Summarizer */}
      <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 shadow-2xs">
        <div className="mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#172B28]">
            NLP &amp; LLM Pattern Summarizer (Root Cause Detection)
          </h3>
          <p className="text-xs text-[#667873]">
            Natural language summaries explaining recurring operational gaps and root causes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AI_PATTERN_INSIGHTS.map((insight, idx) => (
            <div
              key={idx}
              className="p-5 bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#172B28]">
                    {insight.category}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {insight.frequency}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[#172B28] mb-2">
                  {insight.title}
                </h4>
                <p className="text-xs text-[#667873] leading-relaxed mb-4">
                  {insight.summary}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#E2EAE5]">
                {insight.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono px-2 py-0.5 bg-white text-[#172B28] border border-[#E2EAE5] rounded-md"
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
