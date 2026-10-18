import React from 'react';

interface NavbarProps {
  activeTab: 'profiler' | 'dag' | 'linter' | 'matrix';
  setActiveTab: (tab: 'profiler' | 'dag' | 'linter' | 'matrix') => void;
  repo: string;
  setRepo: (repo: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  repo,
  setRepo,
  onAnalyze,
  isLoading,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-inner">
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18" strokeDasharray="2 2" />
                <path d="m9 15 6-6" />
                <circle cx="15" cy="9" r="2" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">PipeLens</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-medium">v1.0.0</span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">GitHub Actions Bottleneck Profiler & Security Studio</p>
            </div>
          </div>

          {/* Repo Input & Controls */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo or 'sample'"
                className="w-48 sm:w-64 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={onAnalyze}
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 shadow-sm"
            >
              {isLoading ? (
                <span>Profiling...</span>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Profile Run</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 sm:space-x-4 border-t border-slate-800/60 overflow-x-auto py-1">
          <button
            onClick={() => setActiveTab('profiler')}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'profiler'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            ⏱️ Gantt Waterfall & Timings
          </button>
          <button
            onClick={() => setActiveTab('dag')}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'dag'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            🕸️ Critical Path DAG
          </button>
          <button
            onClick={() => setActiveTab('linter')}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'linter'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            🛡️ Security & Supply-Chain Linter
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            🧪 Matrix Simulator & Expressions
          </button>
        </div>
      </div>
    </header>
  );
};
