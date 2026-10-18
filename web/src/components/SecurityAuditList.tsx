import React, { useState } from 'react';
import { SecurityFinding, YamlFix } from '../types.js';
import { YamlDiffViewer } from './YamlDiffViewer.js';

interface SecurityAuditListProps {
  findings: SecurityFinding[];
  onLintYaml: (yaml: string) => Promise<void>;
  onFixYaml: (yaml: string) => Promise<YamlFix | null>;
}

const SAMPLE_INSECURE_YAML = `name: Insecure CI Pipeline

on:
  issues:
    types: [opened]

permissions: write-all

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Process Issue Title
        run: echo "Processing issue: \${{ github.event.issue.title }}"
      - name: Notify Slack
        env:
          SLACK_TOKEN: "xoxb-1234567890-abcdefghij"
        run: echo "Connecting with $SLACK_TOKEN"
`;

export const SecurityAuditList: React.FC<SecurityAuditListProps> = ({
  findings,
  onLintYaml,
  onFixYaml,
}) => {
  const [yamlInput, setYamlInput] = useState(SAMPLE_INSECURE_YAML);
  const [activeSeverity, setActiveSeverity] = useState<string>('all');
  const [activeFix, setActiveFix] = useState<YamlFix | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  const handleRunAudit = async () => {
    setIsAuditing(true);
    try {
      await onLintYaml(yamlInput);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRunFix = async () => {
    const fix = await onFixYaml(yamlInput);
    if (fix) {
      setActiveFix(fix);
      setYamlInput(fix.fixedYaml);
    }
  };

  const filteredFindings = findings.filter(f =>
    activeSeverity === 'all' ? true : f.severity === activeSeverity
  );

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  const mediumCount = findings.filter(f => f.severity === 'medium').length;

  return (
    <div className="space-y-6">
      {/* Interactive YAML Editor & Scanner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-3 gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center">
              <span className="mr-2">🔍</span> Live Workflow YAML Security Scanner
            </h3>
            <p className="text-xs text-slate-400">Paste your GitHub Actions workflow below to audit supply-chain risks and script injections.</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRunFix}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 shadow"
            >
              <span>🛠️ 1-Click Auto Fix & Diff</span>
            </button>
            <button
              onClick={handleRunAudit}
              disabled={isAuditing}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 shadow"
            >
              {isAuditing ? <span>Auditing...</span> : <span>Run Security Audit</span>}
            </button>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={yamlInput}
            onChange={(e) => setYamlInput(e.target.value)}
            rows={10}
            className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="Paste workflow YAML..."
          />
        </div>
      </div>

      {/* Severity Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSeverity('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSeverity === 'all' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Findings ({findings.length})
          </button>
          <button
            onClick={() => setActiveSeverity('critical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
              activeSeverity === 'critical' ? 'bg-rose-950/80 text-rose-300 border border-rose-700' : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Critical ({criticalCount})</span>
          </button>
          <button
            onClick={() => setActiveSeverity('high')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
              activeSeverity === 'high' ? 'bg-purple-950/80 text-purple-300 border border-purple-700' : 'text-slate-400 hover:text-purple-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span>High ({highCount})</span>
          </button>
          <button
            onClick={() => setActiveSeverity('medium')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
              activeSeverity === 'medium' ? 'bg-amber-950/80 text-amber-300 border border-amber-700' : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Medium ({mediumCount})</span>
          </button>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {filteredFindings.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            ✓ No security findings match the active filter.
          </div>
        ) : (
          filteredFindings.map((finding, idx) => (
            <div
              key={idx}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                      finding.severity === 'critical'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : finding.severity === 'high'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : finding.severity === 'medium'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    }`}
                  >
                    {finding.severity}
                  </span>
                  <span className="font-bold text-sm text-white">{finding.title}</span>
                  <span className="text-xs text-slate-500 font-mono">({finding.ruleId})</span>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  {finding.file}:{finding.line}:{finding.column}
                </div>
              </div>

              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                {finding.message}
              </p>

              {finding.suggestedFix && (
                <div className="mt-2.5 p-2 bg-slate-950/70 border border-slate-800 rounded text-xs">
                  <span className="text-emerald-400 font-semibold mr-1.5">Recommended Fix:</span>
                  <code className="text-slate-200">{finding.suggestedFix}</code>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Diff Viewer Modal */}
      {activeFix && (
        <YamlDiffViewer fix={activeFix} onClose={() => setActiveFix(null)} />
      )}
    </div>
  );
};
