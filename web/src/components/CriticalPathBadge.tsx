import React from 'react';
import { CriticalPathResult, CacheAuditResult } from '../types.js';

interface CriticalPathBadgeProps {
  criticalPath: CriticalPathResult;
  cache: CacheAuditResult;
}

export const CriticalPathBadge: React.FC<CriticalPathBadgeProps> = ({ criticalPath, cache }) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-amber-400 font-bold text-sm tracking-wide uppercase flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse mr-2"></span>
              Topological Critical Path
            </span>
            <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
              Zero Slack ({Math.round(criticalPath.criticalPathDurationMs / 1000)}s)
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {criticalPath.criticalPath.map((jobName, idx) => (
              <React.Fragment key={jobName}>
                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-xs font-semibold text-amber-200 shadow-sm">
                  {jobName}
                </span>
                {idx < criticalPath.criticalPath.length - 1 && (
                  <span className="text-slate-500 text-xs">➔</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Cache hit summary pill */}
        <div className="flex items-center space-x-3 bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-lg self-start md:self-auto">
          <div className="text-xs">
            <div className="text-slate-400">Cache Hit Ratio</div>
            <div className="font-bold text-sm text-white">
              {Math.round(cache.hitRatio * 100)}%
              <span className="text-xs text-slate-400 font-normal ml-1">({cache.cacheHits}/{cache.totalCacheSteps})</span>
            </div>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
            cache.hitRatio >= 0.8 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
            cache.hitRatio >= 0.5 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          }`}>
            {Math.round(cache.hitRatio * 100)}%
          </div>
        </div>
      </div>

      {/* Parallelization & Bottleneck Advice */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
          <span className="text-emerald-400 font-semibold block mb-1">⚡ Parallelization Advantage:</span>
          <p className="text-slate-300">
            Pipeline saves <span className="font-bold text-white">{(criticalPath.parallelizationGainMs / 60000).toFixed(1)} minutes</span> through concurrent branch execution compared to a sequential queue.
          </p>
        </div>

        {criticalPath.bottlenecks.length > 0 ? (
          <div className="bg-slate-950/60 p-3 rounded-lg border border-amber-500/20">
            <span className="text-amber-400 font-semibold block mb-1">⚠️ Bottleneck Finding:</span>
            <p className="text-slate-300">
              <span className="text-white font-medium">{criticalPath.bottlenecks[0].jobName}:</span> {criticalPath.bottlenecks[0].reason}
            </p>
          </div>
        ) : (
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            <span className="text-emerald-400 font-semibold block mb-1">✓ Balanced Workload:</span>
            <p className="text-slate-300">All parallel branches complete within reasonable variance of the critical path.</p>
          </div>
        )}
      </div>
    </div>
  );
};
