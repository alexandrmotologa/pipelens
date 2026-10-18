import React from 'react';
import { CostEstimate, WorkflowRunTelemetry } from '../types.js';

interface CostMetricsCardProps {
  cost: CostEstimate;
  run: WorkflowRunTelemetry;
}

export const CostMetricsCard: React.FC<CostMetricsCardProps> = ({ cost, run }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Wall Clock Duration */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Wall-Clock Time</span>
          <span className="text-slate-500">Real End-to-End</span>
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">
          {(run.totalDurationMs / 60000).toFixed(1)} <span className="text-sm font-normal text-slate-400">mins</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center space-x-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>{Math.round(run.totalDurationMs / 1000)} seconds total</span>
        </div>
      </div>

      {/* Billable Minutes */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Billable Runner Time</span>
          <span className="text-slate-500">Rounded Up / Job</span>
        </div>
        <div className="text-2xl font-bold text-emerald-400 tracking-tight">
          {cost.totalBillableMinutes} <span className="text-sm font-normal text-slate-400">mins</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex space-x-2">
          <span>🐧 {cost.linuxMinutes}m Lin</span>
          <span>🪟 {cost.windowsMinutes}m Win</span>
          <span>🍏 {cost.macosMinutes}m Mac</span>
        </div>
      </div>

      {/* Estimated USD Cost */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Estimated Run Cost</span>
          <span className="text-slate-500">GitHub Rates</span>
        </div>
        <div className="text-2xl font-bold text-amber-400 tracking-tight">
          ${cost.totalCostUsd.toFixed(4)} <span className="text-xs font-normal text-slate-400">USD</span>
        </div>
        <div className="mt-2 text-xs text-emerald-400 flex items-center space-x-1">
          <span>↓ Savings potential: ~${cost.potentialSavingsUsd.toFixed(4)}</span>
        </div>
      </div>

      {/* Carbon Impact */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
          <span>Carbon Footprint</span>
          <span className="text-slate-500">Data Center Grid</span>
        </div>
        <div className="text-2xl font-bold text-sky-400 tracking-tight">
          {cost.estimatedCo2Grams} <span className="text-sm font-normal text-slate-400">g CO₂eq</span>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Based on standard 2-core cloud runner PUE
        </div>
      </div>
    </div>
  );
};
