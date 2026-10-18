import React, { useState, useEffect } from 'react';
import { MatrixSimulationResult } from '../types.js';

const DEFAULT_MATRIX = {
  os: ['ubuntu-latest', 'macos-latest', 'windows-latest'],
  node: [18, 20, 22],
  exclude: [
    { os: 'windows-latest', node: 18 },
  ],
  include: [
    { os: 'ubuntu-latest', node: 22, experimental: true },
  ],
};

export const MatrixPreview: React.FC = () => {
  const [matrixJson, setMatrixJson] = useState(JSON.stringify(DEFAULT_MATRIX, null, 2));
  const [simulation, setSimulation] = useState<MatrixSimulationResult | null>(null);
  const [baseDuration, setBaseDuration] = useState(5);
  const [exprInput, setExprInput] = useState("contains(github.ref, 'main') && matrix.node >= 20");
  const [exprResult, setExprResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = async () => {
    try {
      setLoading(true);
      const parsedMatrix = JSON.parse(matrixJson);
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matrix: parsedMatrix,
          baseDurationMinutes: baseDuration,
          expression: exprInput,
          context: {
            github: { ref: 'refs/heads/main', actor: 'octocat' },
            matrix: { node: 20, os: 'ubuntu-latest' },
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSimulation(data.matrix);
        setExprResult(data.expressionResult);
      }
    } catch {
      // JSON parse or network error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSimulation();
  }, [baseDuration]);

  return (
    <div className="space-y-6">
      {/* Matrix Simulator Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center">
              <span className="mr-2">🧪</span> Matrix Fan-Out & Cost Predictor
            </h3>
            <p className="text-xs text-slate-400">Evaluate Cartesian matrix combinations, include/exclude directives, and runner bills locally.</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400">
              <span>Avg Job Duration:</span>
              <input
                type="number"
                min="1"
                max="60"
                value={baseDuration}
                onChange={(e) => setBaseDuration(parseInt(e.target.value) || 5)}
                className="w-14 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-center font-mono"
              />
              <span>min</span>
            </div>
            <button
              onClick={runSimulation}
              disabled={loading}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow"
            >
              {loading ? 'Simulating...' : 'Recalculate Matrix'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Editor Input Left Column */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">strategy.matrix JSON Config:</label>
            <textarea
              value={matrixJson}
              onChange={(e) => setMatrixJson(e.target.value)}
              rows={12}
              className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Table / Summary Right Column */}
          <div className="lg:col-span-2">
            {simulation && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block">Total Fan-Out Jobs</span>
                    <span className="text-xl font-bold text-white">{simulation.totalJobs}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block">Billable Minutes</span>
                    <span className="text-xl font-bold text-emerald-400">{simulation.totalEstimatedBillableMinutes}m</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block">Estimated Cost</span>
                    <span className="text-xl font-bold text-amber-400">${simulation.totalEstimatedCostUsd.toFixed(4)}</span>
                  </div>
                </div>

                <div className="border border-slate-800 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Combination</th>
                        <th className="px-3 py-2 text-left">Runner OS</th>
                        <th className="px-3 py-2 text-right">Est. Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                      {simulation.variations.map((v, i) => (
                        <tr key={v.id} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-500 font-mono">{i + 1}</td>
                          <td className="px-3 py-2 text-slate-200 font-medium">{v.name}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              v.runnerOs === 'macos' ? 'bg-sky-500/20 text-sky-300' :
                              v.runnerOs === 'windows' ? 'bg-blue-500/20 text-blue-300' :
                              'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {v.runnerOs}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400 font-mono">~{v.estimatedMinutes}m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expression Evaluator Playground Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="pb-3 border-b border-slate-800 mb-3">
          <h3 className="text-base font-bold text-white flex items-center">
            <span className="mr-2">⚡</span> Expression Evaluator Playground
          </h3>
          <p className="text-xs text-slate-400">Test and evaluate GitHub Actions expressions like <code className="text-emerald-400">fromJSON()</code>, <code className="text-emerald-400">contains()</code>, and ternary operators locally.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={exprInput}
              onChange={(e) => setExprInput(e.target.value)}
              placeholder="e.g. contains(github.ref, 'main') && matrix.node >= 20"
              className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={runSimulation}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Evaluate
          </button>
        </div>

        {exprResult !== null && (
          <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs flex items-center justify-between">
            <span className="text-slate-400">Result:</span>
            <span className={`font-bold ${
              exprResult === true ? 'text-emerald-400' :
              exprResult === false ? 'text-rose-400' :
              'text-amber-300'
            }`}>
              {typeof exprResult === 'object' ? JSON.stringify(exprResult) : String(exprResult)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
