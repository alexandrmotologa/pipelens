import React, { useState, useEffect } from 'react';
import { RunComparisonResult } from '../types.js';

interface RunDiffViewerProps {
  repo: string;
}

export const RunDiffViewer: React.FC<RunDiffViewerProps> = ({ repo }) => {
  const [diffData, setDiffData] = useState<RunComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiff = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/diff?repo=${encodeURIComponent(repo)}`);
      if (!res.ok) throw new Error('Failed to fetch run comparison');
      const data: RunComparisonResult = await res.json();
      setDiffData(data);
    } catch (err: any) {
      setError(err.message || 'Error loading diff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiff();
  }, [repo]);

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        Computing performance deltas and regression analysis...
      </div>
    );
  }

  if (error || !diffData) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        {error || 'No comparison data available.'}
      </div>
    );
  }

  const isSlower = diffData.wallClockDeltaMs > 0;
  const deltaSec = Math.round(diffData.wallClockDeltaMs / 1000);
  const cpDeltaSec = Math.round(diffData.criticalPathDeltaMs / 1000);

  return (
    <div className="space-y-6">
      {/* Run Header Comparison */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 mb-4 gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center">
              <span className="mr-2">⚖️</span> Run-to-Run Regression & Delta Analyzer
            </h3>
            <p className="text-xs text-slate-400">Compare pipeline execution times, critical path shifts, and runner costs between two runs.</p>
          </div>
          <button
            onClick={fetchDiff}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors border border-slate-700"
          >
            ↻ Refresh Diff
          </button>
        </div>

        {/* Base vs Target Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
          <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold block mb-1">Baseline Run</span>
            <div className="font-bold text-slate-200 text-sm truncate">{diffData.baselineName}</div>
            <div className="text-slate-400 mt-1 font-mono">ID: {diffData.baselineRunId}</div>
          </div>
          <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold block mb-1">Target Run (Current)</span>
            <div className="font-bold text-slate-200 text-sm truncate">{diffData.targetName}</div>
            <div className="text-slate-400 mt-1 font-mono">ID: {diffData.targetRunId}</div>
          </div>
        </div>

        {/* Delta Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={`p-3 rounded-lg border ${
            isSlower ? 'bg-rose-950/20 border-rose-500/30 text-rose-300' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
          }`}>
            <span className="text-slate-400 text-xs block">Wall-Clock Delta</span>
            <span className="text-xl font-bold tracking-tight">
              {isSlower ? `+${deltaSec}s` : `${deltaSec}s`}
            </span>
            <span className="text-[11px] block mt-0.5 opacity-80">
              ({diffData.wallClockDeltaPercent > 0 ? '+' : ''}{diffData.wallClockDeltaPercent}%)
            </span>
          </div>

          <div className={`p-3 rounded-lg border ${
            diffData.criticalPathDeltaMs > 0 ? 'bg-amber-950/20 border-amber-500/30 text-amber-300' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
          }`}>
            <span className="text-slate-400 text-xs block">Critical Path Delta</span>
            <span className="text-xl font-bold tracking-tight">
              {diffData.criticalPathDeltaMs > 0 ? `+${cpDeltaSec}s` : `${cpDeltaSec}s`}
            </span>
            <span className="text-[11px] block mt-0.5 opacity-80">
              {diffData.criticalPathChanged ? 'Path diverged' : 'Path unchanged'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-slate-200">
            <span className="text-slate-400 text-xs block">Billable Minutes Delta</span>
            <span className="text-xl font-bold tracking-tight">
              {diffData.billableMinutesDelta > 0 ? `+${diffData.billableMinutesDelta}m` : `${diffData.billableMinutesDelta}m`}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Rounded up per job</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-slate-200">
            <span className="text-slate-400 text-xs block">Cost Delta (USD)</span>
            <span className="text-xl font-bold tracking-tight">
              {diffData.costDeltaUsd > 0 ? `+$${diffData.costDeltaUsd.toFixed(4)}` : `-$${Math.abs(diffData.costDeltaUsd).toFixed(4)}`}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">GitHub runner rates</span>
          </div>
        </div>
      </div>

      {/* Regressions and Improvements */}
      {(diffData.regressions.length > 0 || diffData.improvements.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {diffData.regressions.length > 0 && (
            <div className="bg-slate-900/60 border border-rose-500/30 rounded-xl p-4">
              <span className="text-rose-400 font-bold text-xs uppercase tracking-wider block mb-2 flex items-center">
                <span className="mr-1.5">⚠️</span> Regressions Detected ({diffData.regressions.length})
              </span>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {diffData.regressions.map((r, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <span className="text-rose-400">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diffData.improvements.length > 0 && (
            <div className="bg-slate-900/60 border border-emerald-500/30 rounded-xl p-4">
              <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider block mb-2 flex items-center">
                <span className="mr-1.5">✓</span> Performance Improvements ({diffData.improvements.length})
              </span>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {diffData.improvements.map((imp, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <span className="text-emerald-400">•</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Job-by-Job Delta Breakdown */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h4 className="text-sm font-bold text-white mb-3">Job-by-Job Duration Comparison</h4>
        <div className="space-y-3">
          {diffData.jobDeltas.map(job => {
            const bSec = Math.round(job.baselineDurationMs / 1000);
            const tSec = Math.round(job.targetDurationMs / 1000);
            const dSec = Math.round(job.deltaMs / 1000);

            return (
              <div key={job.name} className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-200">{job.name}</span>
                  <span className={`font-mono font-bold ${
                    job.status === 'slower' ? 'text-rose-400' :
                    job.status === 'faster' ? 'text-emerald-400' :
                    'text-slate-400'
                  }`}>
                    {dSec > 0 ? `+${dSec}s` : `${dSec}s`} ({tSec}s total)
                  </span>
                </div>

                {/* Progress Comparison */}
                <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                  <span className="w-16">Base: {bSec}s</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${job.status === 'slower' ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Math.max(5, (job.targetDurationMs / Math.max(job.baselineDurationMs, job.targetDurationMs, 1000)) * 100))}%` }}
                    ></div>
                  </div>
                  <span className="w-16 text-right">Target: {tSec}s</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
