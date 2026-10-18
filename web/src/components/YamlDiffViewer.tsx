import React, { useState } from 'react';
import { YamlFix } from '../types.js';

interface YamlDiffViewerProps {
  fix: YamlFix | null;
  onClose: () => void;
}

export const YamlDiffViewer: React.FC<YamlDiffViewerProps> = ({ fix, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!fix) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fix.fixedYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span className="text-emerald-400">🛡️</span>
              <span>Automated Hardening Fix</span>
            </h3>
            <p className="text-xs text-slate-400">{fix.description} ({fix.file})</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Unified Diff View */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs bg-slate-950 text-slate-300 space-y-0.5">
          {fix.diff.split('\n').map((line, idx) => {
            const isAdd = line.startsWith('+');
            const isRem = line.startsWith('-');
            const isHdr = line.startsWith('@') || line.startsWith('---') || line.startsWith('+++');

            return (
              <div
                key={idx}
                className={`px-2 py-0.5 rounded-sm whitespace-pre-wrap ${
                  isAdd
                    ? 'bg-emerald-950/60 text-emerald-300 font-semibold'
                    : isRem
                    ? 'bg-rose-950/60 text-rose-300 line-through opacity-80'
                    : isHdr
                    ? 'text-sky-400 font-bold bg-slate-900/60'
                    : 'text-slate-400'
                }`}
              >
                {line}
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Replaces mutable tags with full commit SHAs and declares least-privilege permissions.
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center space-x-1.5 shadow"
            >
              {copied ? <span>✓ Copied to Clipboard</span> : <span>Copy Hardened YAML</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
