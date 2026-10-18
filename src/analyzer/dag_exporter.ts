import { CriticalPathResult, JobTelemetry } from '../types/index.js';
import { computeCriticalPath } from './critical_path.js';

/**
 * Exports workflow DAG to GitHub-flavored Mermaid flowchart syntax.
 */
export function exportDagToMermaid(input: CriticalPathResult | JobTelemetry[]): string {
  const result: CriticalPathResult = Array.isArray(input) ? computeCriticalPath(input) : input;
  const lines: string[] = [
    'flowchart TD',
    '  %% PipeLens Generated Workflow DAG',
    '  classDef critical fill:#78350f,stroke:#f59e0b,stroke-width:2.5px,color:#fef3c7;',
    '  classDef normal fill:#0f172a,stroke:#334155,stroke-width:1px,color:#e2e8f0;',
    '',
  ];

  const sanitizeId = (id: string | number) => `node_${String(id).replace(/[^a-zA-Z0-9_]/g, '_')}`;

  // Declare nodes
  for (const node of result.nodes) {
    const sId = sanitizeId(node.id);
    const durSec = Math.round(node.durationMs / 1000);
    const label = `${node.name}\\n(${durSec}s)`;
    const cls = node.isCritical ? ':::critical' : ':::normal';
    lines.push(`  ${sId}["${label}"]${cls}`);
  }

  lines.push('');

  // Declare edges
  let edgeIndex = 0;
  const criticalEdgeIndices: number[] = [];

  for (const edge of result.edges) {
    const fromId = sanitizeId(edge.from);
    const toId = sanitizeId(edge.to);
    lines.push(`  ${fromId} --> ${toId}`);

    if (edge.isCritical) {
      criticalEdgeIndices.push(edgeIndex);
    }
    edgeIndex++;
  }

  if (criticalEdgeIndices.length > 0) {
    lines.push('');
    for (const idx of criticalEdgeIndices) {
      lines.push(`  linkStyle ${idx} stroke:#f59e0b,stroke-width:2.5px;`);
    }
  }

  return lines.join('\n');
}

/**
 * Exports workflow DAG to a standalone vector SVG diagram.
 */
export function exportDagToSvg(input: CriticalPathResult | JobTelemetry[]): string {
  const result: CriticalPathResult = Array.isArray(input) ? computeCriticalPath(input) : input;
  const { nodes, edges } = result;

  if (nodes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="20" y="50" fill="#94a3b8">Empty DAG</text></svg>`;
  }

  // Calculate topological levels
  const nodeLevels = new Map<string, number>();
  for (const node of nodes) {
    if (node.inDegree === 0) nodeLevels.set(node.id, 0);
  }

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;
    for (const edge of edges) {
      const fromLvl = nodeLevels.get(edge.from) ?? 0;
      const toLvl = nodeLevels.get(edge.to) ?? 0;
      if (fromLvl + 1 > toLvl) {
        nodeLevels.set(edge.to, fromLvl + 1);
        changed = true;
      }
    }
  }

  const levelsMap = new Map<number, typeof nodes>();
  for (const node of nodes) {
    const lvl = nodeLevels.get(node.id) ?? 0;
    if (!levelsMap.has(lvl)) levelsMap.set(lvl, []);
    levelsMap.get(lvl)!.push(node);
  }

  const sortedLevels = Array.from(levelsMap.keys()).sort((a, b) => a - b);
  const colWidth = 240;
  const rowHeight = 100;
  const paddingX = 40;
  const paddingY = 40;

  const nodePositions = new Map<string, { x: number; y: number }>();
  sortedLevels.forEach((level) => {
    const nodesInLevel = levelsMap.get(level)!;
    nodesInLevel.forEach((node, rowIndex) => {
      nodePositions.set(node.id, {
        x: paddingX + level * colWidth,
        y: paddingY + rowIndex * rowHeight,
      });
    });
  });

  const maxLevel = Math.max(...sortedLevels, 0);
  const maxNodesInAnyLevel = Math.max(...Array.from(levelsMap.values()).map(v => v.length), 1);
  const width = paddingX * 2 + (maxLevel + 1) * colWidth;
  const height = paddingY * 2 + maxNodesInAnyLevel * rowHeight;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color:#080d1a;font-family:sans-serif;">\n`;
  svgContent += `  <defs>\n`;
  svgContent += `    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
  svgContent += `      <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />\n`;
  svgContent += `    </marker>\n`;
  svgContent += `    <marker id="arrow-crit" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
  svgContent += `      <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />\n`;
  svgContent += `    </marker>\n`;
  svgContent += `  </defs>\n`;

  // Draw edges
  for (const edge of edges) {
    const from = nodePositions.get(edge.from);
    const to = nodePositions.get(edge.to);
    if (!from || !to) continue;

    const startX = from.x + 190;
    const startY = from.y + 35;
    const endX = to.x;
    const endY = to.y + 35;
    const midX = (startX + endX) / 2;

    const color = edge.isCritical ? '#f59e0b' : '#334155';
    const marker = edge.isCritical ? 'url(#arrow-crit)' : 'url(#arrow)';
    const strokeWidth = edge.isCritical ? '2.5' : '1.5';

    svgContent += `  <path d="M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" marker-end="${marker}" />\n`;
  }

  // Draw nodes
  for (const node of nodes) {
    const pos = nodePositions.get(node.id);
    if (!pos) continue;

    const isCrit = node.isCritical;
    const strokeColor = isCrit ? '#f59e0b' : '#334155';
    const strokeWidth = isCrit ? '2' : '1';
    const barColor = isCrit ? '#f59e0b' : '#10b981';
    const textColor = isCrit ? '#fef3c7' : '#f8fafc';

    svgContent += `  <g transform="translate(${pos.x}, ${pos.y})">\n`;
    svgContent += `    <rect width="190" height="70" rx="8" fill="#0f172a" stroke="${strokeColor}" stroke-width="${strokeWidth}" />\n`;
    svgContent += `    <rect x="0" y="0" width="4" height="70" rx="2" fill="${barColor}" />\n`;
    svgContent += `    <text x="14" y="26" fill="${textColor}" font-size="12" font-weight="bold">${node.name}</text>\n`;
    svgContent += `    <text x="14" y="46" fill="#94a3b8" font-size="11">Duration: ${Math.round(node.durationMs / 1000)}s</text>\n`;
    svgContent += `    <text x="14" y="60" fill="${isCrit ? '#f59e0b' : '#64748b'}" font-size="10">${isCrit ? '● Critical (Slack: 0s)' : 'Slack: ' + Math.round(node.slackMs / 1000) + 's'}</text>\n`;
    svgContent += `  </g>\n`;
  }

  svgContent += `</svg>`;
  return svgContent;
}
