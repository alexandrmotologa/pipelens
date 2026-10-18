import React, { useState } from 'react';
import { CriticalPathResult } from '../types.js';

interface DagVisualizerProps {
  criticalPath: CriticalPathResult;
}

export const DagVisualizer: React.FC<DagVisualizerProps> = ({ criticalPath }) => {
  const { nodes, edges } = criticalPath;
  const [copiedMermaid, setCopiedMermaid] = useState(false);

  const handleCopyMermaid = async () => {
    try {
      const res = await fetch('/api/export-dag?format=mermaid');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedMermaid(true);
      setTimeout(() => setCopiedMermaid(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownloadSvg = async () => {
    try {
      const res = await fetch('/api/export-dag?format=svg');
      const svgText = await res.text();
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pipelens_dag.svg';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback
    }
  };

  if (nodes.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        No DAG nodes to display.
      </div>
    );
  }

  // Calculate topological levels for layout
  // Level = max(parent level + 1), roots at level 0
  const nodeLevels = new Map<string, number>();
  for (const node of nodes) {
    if (node.inDegree === 0) {
      nodeLevels.set(node.id, 0);
    }
  }

  // Iteratively compute levels
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;
    for (const edge of edges) {
      const fromLevel = nodeLevels.get(edge.from) ?? 0;
      const toLevel = nodeLevels.get(edge.to) ?? 0;
      if (fromLevel + 1 > toLevel) {
        nodeLevels.set(edge.to, fromLevel + 1);
        changed = true;
      }
    }
  }

  // Group nodes by level
  const levelsMap = new Map<number, typeof nodes>();
  for (const node of nodes) {
    const lvl = nodeLevels.get(node.id) ?? 0;
    if (!levelsMap.has(lvl)) {
      levelsMap.set(lvl, []);
    }
    levelsMap.get(lvl)!.push(node);
  }

  const sortedLevels = Array.from(levelsMap.keys()).sort((a, b) => a - b);

  // Layout parameters
  const colWidth = 260;
  const rowHeight = 110;
  const paddingX = 40;
  const paddingY = 40;

  const nodePositions = new Map<string, { x: number; y: number }>();

  sortedLevels.forEach((level) => {
    const nodesInLevel = levelsMap.get(level)!;
    nodesInLevel.forEach((node, rowIndex) => {
      const x = paddingX + level * colWidth;
      const y = paddingY + rowIndex * rowHeight;
      nodePositions.set(node.id, { x, y });
    });
  });

  const maxLevel = Math.max(...sortedLevels, 0);
  const maxNodesInAnyLevel = Math.max(...Array.from(levelsMap.values()).map(v => v.length), 1);

  const svgWidth = Math.max(800, paddingX * 2 + (maxLevel + 1) * colWidth);
  const svgHeight = Math.max(380, paddingY * 2 + maxNodesInAnyLevel * rowHeight);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center">
            <span className="mr-2">🕸️</span> Workflow Dependency DAG
          </h3>
          <p className="text-xs text-slate-400">Directed Acyclic Graph layout with topological Critical Path highlighting.</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyMermaid}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center space-x-1"
          >
            <span>{copiedMermaid ? '✓ Copied Mermaid' : '📋 Copy Mermaid'}</span>
          </button>
          <button
            onClick={handleDownloadSvg}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center space-x-1"
          >
            <span>💾 Download SVG</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="min-w-full">
          <defs>
            {/* Marker for normal edges */}
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
            </marker>
            {/* Marker for critical edges */}
            <marker
              id="arrow-critical"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Render Edges */}
          {edges.map((edge, idx) => {
            const fromPos = nodePositions.get(edge.from);
            const toPos = nodePositions.get(edge.to);
            if (!fromPos || !toPos) return null;

            const startX = fromPos.x + 200; // Node width is 200
            const startY = fromPos.y + 35;  // Node center Y
            const endX = toPos.x;
            const endY = toPos.y + 35;

            // Curved cubic bezier path
            const midX = (startX + endX) / 2;
            const d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

            return (
              <path
                key={idx}
                d={d}
                fill="none"
                stroke={edge.isCritical ? '#f59e0b' : '#334155'}
                strokeWidth={edge.isCritical ? 2.5 : 1.5}
                markerEnd={edge.isCritical ? 'url(#arrow-critical)' : 'url(#arrow)'}
                className={edge.isCritical ? 'filter drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]' : ''}
              />
            );
          })}

          {/* Render Nodes */}
          {nodes.map(node => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;

            const isCritical = node.isCritical;

            return (
              <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
                {/* Node Box */}
                <rect
                  width="200"
                  height="70"
                  rx="8"
                  className={
                    isCritical
                      ? 'fill-slate-900 stroke-amber-500 stroke-2 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                      : 'fill-slate-900 stroke-slate-700 stroke-1'
                  }
                />

                {/* Status indicator bar */}
                <rect
                  x="0"
                  y="0"
                  width="4"
                  height="70"
                  rx="2"
                  className={isCritical ? 'fill-amber-400' : 'fill-emerald-500'}
                />

                {/* Job Name */}
                <text
                  x="14"
                  y="26"
                  className={`text-xs font-bold ${isCritical ? 'fill-amber-300' : 'fill-slate-100'}`}
                >
                  {node.name.length > 20 ? node.name.substring(0, 18) + '...' : node.name}
                </text>

                {/* Duration & Float Slack */}
                <text x="14" y="46" className="text-[11px] fill-slate-400 font-mono">
                  Duration: {Math.round(node.durationMs / 1000)}s
                </text>

                <text x="14" y="60" className={`text-[10px] ${isCritical ? 'fill-amber-400 font-bold' : 'fill-slate-500'}`}>
                  {isCritical ? '● Critical (Slack: 0s)' : `Slack: ${Math.round(node.slackMs / 1000)}s`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
