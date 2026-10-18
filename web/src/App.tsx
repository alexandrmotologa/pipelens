import React, { useState, useEffect } from 'react';
import { ProfileData, SecurityFinding, YamlFix } from './types.js';
import { Navbar } from './components/Navbar.js';
import { CostMetricsCard } from './components/CostMetricsCard.js';
import { CriticalPathBadge } from './components/CriticalPathBadge.js';
import { GanttWaterfall } from './components/GanttWaterfall.js';
import { DagVisualizer } from './components/DagVisualizer.js';
import { SecurityAuditList } from './components/SecurityAuditList.js';
import { MatrixPreview } from './components/MatrixPreview.js';
import { RunDiffViewer } from './components/RunDiffViewer.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profiler' | 'dag' | 'diff' | 'linter' | 'matrix'>('profiler');
  const [repo, setRepo] = useState<string>('sample');
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (targetRepo: string = repo) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/profile?repo=${encodeURIComponent(targetRepo)}`);
      if (!res.ok) {
        throw new Error(`Profile query returned status ${res.status}`);
      }
      const data: ProfileData = await res.json();
      setProfileData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pipeline profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLintYaml = async (yaml: string) => {
    try {
      const res = await fetch('/api/lint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml, filePath: '.github/workflows/ci.yml' }),
      });
      if (res.ok) {
        const data = await res.json();
        setFindings(data.findings);
      }
    } catch (err: any) {
      console.error('Linting failed:', err);
    }
  };

  const handleFixYaml = async (yaml: string): Promise<YamlFix | null> => {
    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml, filePath: '.github/workflows/ci.yml' }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.fix;
      }
    } catch (err: any) {
      console.error('Fix failed:', err);
    }
    return null;
  };

  useEffect(() => {
    fetchProfile('sample');
    handleLintYaml(`name: Insecure CI Pipeline

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
`);
  }, []);

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        repo={repo}
        setRepo={setRepo}
        onAnalyze={() => fetchProfile(repo)}
        isLoading={isLoading}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold hover:text-white">✕</button>
          </div>
        )}

        {profileData && (
          <>
            {activeTab === 'profiler' && (
              <div>
                <CostMetricsCard cost={profileData.cost} run={profileData.run} />
                <CriticalPathBadge criticalPath={profileData.criticalPath} cache={profileData.cache} />
                <GanttWaterfall run={profileData.run} criticalPath={profileData.criticalPath} />
              </div>
            )}

            {activeTab === 'dag' && (
              <div>
                <CriticalPathBadge criticalPath={profileData.criticalPath} cache={profileData.cache} />
                <DagVisualizer criticalPath={profileData.criticalPath} />
              </div>
            )}
          </>
        )}

        {activeTab === 'diff' && (
          <RunDiffViewer repo={repo} />
        )}

        {activeTab === 'linter' && (
          <SecurityAuditList
            findings={findings}
            onLintYaml={handleLintYaml}
            onFixYaml={handleFixYaml}
          />
        )}

        {activeTab === 'matrix' && (
          <MatrixPreview />
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950/40 py-4 text-center text-xs text-slate-500">
        PipeLens © 2026 • GitHub Actions CI/CD Bottleneck Profiler & Security Studio
      </footer>
    </div>
  );
};
