import React, { useState } from 'react';
import { WorkflowRunTelemetry, CriticalPathResult } from '../types.js';

interface GanttWaterfallProps {
  run: WorkflowRunTelemetry;
  criticalPath: CriticalPathResult;
}

export const GanttWaterfall: React.FC<GanttWaterfallProps> = ({ run, criticalPath }) => {
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string | number>>(new Set([run.jobs[0]?.id]));

  const toggleExpand = (jobId: string | number) => {
    setExpandedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const totalDuration = Math.max(run.totalDurationMs, 1000);
  const criticalJobNames = new Set(criticalPath.criticalPath);

  // Reference start time
  const runStartMs = run.startedAt ? new Date(run.startedAt).getTime() : 0;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 mb-4 gap-2">
        <div>
          <h3 className="text-base font-bold text-white flex items-center">
            <span className="mr-2">📊</span> Execution Gantt Waterfall
          </h3>
          <p className="text-xs text-slate-400">Click any job row to inspect individual step durations and queue delays.</p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500/80 inline-block"></span>
            <span className="text-slate-300">Success</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 border border-amber-300 inline-block"></span>
            <span className="text-amber-300 font-medium">Critical Path</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-slate-700/80 inline-block"></span>
            <span className="text-slate-400">Queue Latency</span>
          </div>
        </div>
      </div>

      {/* Time Axis Header */}
      <div className="relative h-6 border-b border-slate-800 mb-2 ml-48 sm:ml-64 text-[10px] text-slate-500">
        <span className="absolute left-0">0s</span>
        <span className="absolute left-1/4">{Math.round((totalDuration * 0.25) / 1000)}s</span>
        <span className="absolute left-1/2">{Math.round((totalDuration * 0.5) / 1000)}s</span>
        <span className="absolute left-3/4">{Math.round((totalDuration * 0.75) / 1000)}s</span>
        <span className="absolute right-0">{Math.round(totalDuration / 1000)}s</span>
      </div>

      {/* Waterfall Rows */}
      <div className="space-y-2">
        {run.jobs.map(job => {
          const isCritical = criticalJobNames.has(job.name);
          const isExpanded = expandedJobIds.has(job.id);

          const jobStartMs = job.startedAt ? new Date(job.startedAt).getTime() : runStartMs;
          const relativeOffsetMs = Math.max(0, jobStartMs - runStartMs);

          const offsetPercent = Math.min(95, (relativeOffsetMs / totalDuration) * 100);
          const durationPercent = Math.max(2, Math.min(100 - offsetPercent, (job.durationMs / totalDuration) * 100));

          return (
            <div key={job.id} className="border border-slate-800/80 rounded-lg bg-slate-950/40 overflow-hidden">
              {/* Job Row Header */}
              <div
                onClick={() => toggleExpand(job.id)}
                className="flex items-center p-2.5 hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                {/* Job Info Left Column */}
                <div className="w-48 sm:w-64 flex-shrink-0 pr-3">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500 text-xs">{isExpanded ? '▼' : '▶'}</span>
                    <span className={`text-xs font-semibold truncate ${isCritical ? 'text-amber-300' : 'text-slate-200'}`}>
                      {job.name}
                    </span>
                    {isCritical && (
                      <span className="text-[10px] px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded font-mono border border-amber-500/30">
                        CP
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                    <span>{job.runnerOs}</span>
                    <span>•</span>
                    <span>{Math.round(job.durationMs / 1000)}s</span>
                    {job.queueDurationMs > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400">queue: {Math.round(job.queueDurationMs / 1000)}s</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Timeline Bar Right Column */}
                <div className="flex-1 relative h-6 bg-slate-900/40 rounded overflow-hidden">
                  {/* Grid tick lines */}
                  <div className="absolute inset-0 flex justify-between pointer-events-none opacity-10">
                    <div className="border-r border-slate-400 h-full"></div>
                    <div className="border-r border-slate-400 h-full"></div>
                    <div className="border-r border-slate-400 h-full"></div>
                    <div className="border-r border-slate-400 h-full"></div>
                  </div>

                  {/* Execution Bar */}
                  <div
                    style={{ left: `${offsetPercent}%`, width: `${durationPercent}%` }}
                    className={`absolute top-1 bottom-1 rounded transition-all flex items-center justify-between px-2 text-[10px] font-medium text-white shadow ${
                      isCritical
                        ? 'bg-amber-600/90 border border-amber-400 shadow-amber-500/20'
                        : job.conclusion === 'success'
                        ? 'bg-emerald-600/80 border border-emerald-500/60'
                        : 'bg-rose-600/80 border border-rose-500/60'
                    }`}
                  >
                    <span className="truncate">{Math.round(job.durationMs / 1000)}s</span>
                  </div>
                </div>
              </div>

              {/* Expanded Step Breakdown */}
              {isExpanded && job.steps && job.steps.length > 0 && (
                <div className="border-t border-slate-800/80 bg-slate-950/80 p-3 pl-8 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 mb-2">Step Breakdown:</div>
                  {job.steps.map(step => {
                    const stepDurationSec = Math.round(step.durationMs / 1000);
                    const isLongStep = step.durationMs > 30000;

                    return (
                      <div key={step.number} className="flex items-center text-xs text-slate-300">
                        <div className="w-48 sm:w-60 truncate pr-2 flex items-center space-x-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${step.conclusion === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                          <span className="truncate" title={step.name}>{step.name}</span>
                        </div>
                        <div className="flex-1 flex items-center space-x-2">
                          <div className="w-24 sm:w-48 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${isLongStep ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${Math.min(100, Math.max(5, (step.durationMs / job.durationMs) * 100))}%` }}
                            ></div>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">{stepDurationSec}s</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
