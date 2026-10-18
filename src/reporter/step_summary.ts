import { AnalysisSummary } from '../types/index.js';
import { exportDagToMermaid } from '../analyzer/dag_exporter.js';

/**
 * Generates a GitHub Actions Step Summary in standard Markdown format
 * for direct appending to $GITHUB_STEP_SUMMARY.
 */
export function generateStepSummary(analysis: AnalysisSummary): string {
  const { run, criticalPath, cost, cache, securityFindings } = analysis;

  const durationSec = Math.round(run.totalDurationMs / 1000);
  const durationMin = (run.totalDurationMs / 60000).toFixed(1);
  const cpDurationMin = (criticalPath.criticalPathDurationMs / 60000).toFixed(1);
  const gainMin = (criticalPath.parallelizationGainMs / 60000).toFixed(1);

  const lines: string[] = [
    `# ⚡ PipeLens CI/CD Observability & Security Summary`,
    '',
    `> **Workflow Run**: [${run.name}](${run.htmlUrl}) • **Status**: ${run.conclusion === 'success' ? '✅ Succeeded' : '⚠️ ' + run.status} • **Wall-Clock Time**: ${durationMin}m (${durationSec}s)`,
    '',
    '### 📊 Performance & Resource Metrics',
    '',
    '| Metric | Value | Details |',
    '| :--- | :--- | :--- |',
    `| **Topological Critical Path** | \`${criticalPath.criticalPath.join(' ➔ ')}\` | **${cpDurationMin} mins** (${Math.round(criticalPath.criticalPathDurationMs / 1000)}s) |`,
    `| **Parallelization Gain** | **${gainMin} mins** saved | Concurrency vs serial execution |`,
    `| **Billable Runner Time** | **${cost.totalBillableMinutes} mins** | 🐧 ${cost.linuxMinutes}m Linux • 🍏 ${cost.macosMinutes}m macOS • 🪟 ${cost.windowsMinutes}m Windows |`,
    `| **Estimated Cost** | **$${cost.totalCostUsd.toFixed(4)} USD** | Potential savings: ~$${cost.potentialSavingsUsd.toFixed(4)} |`,
    `| **Cache Hit Ratio** | **${Math.round(cache.hitRatio * 100)}%** | ${cache.cacheHits} hits / ${cache.totalCacheSteps} steps |`,
    `| **Carbon Footprint** | **${cost.estimatedCo2Grams} g CO₂eq** | Cloud runner estimate |`,
    '',
  ];

  // Mermaid Diagram
  lines.push('### 🕸️ Critical Path Dependency DAG');
  lines.push('');
  lines.push('```mermaid');
  lines.push(exportDagToMermaid(criticalPath));
  lines.push('```');
  lines.push('');

  // Security Findings
  lines.push('### 🛡️ Supply-Chain & Workflow Security Findings');
  lines.push('');

  if (securityFindings.length === 0) {
    lines.push('✅ **Zero security vulnerabilities detected.** All actions are pinned to commit SHAs and explicit permissions are declared.');
    lines.push('');
  } else {
    lines.push(`Found **${securityFindings.length}** diagnostic finding(s):`);
    lines.push('');
    lines.push('| Severity | Rule | File & Line | Message | Suggested Fix |');
    lines.push('| :---: | :--- | :--- | :--- | :--- |');

    for (const f of securityFindings) {
      const emoji = f.severity === 'critical' ? '🔴 CRITICAL' : f.severity === 'high' ? '🟣 HIGH' : f.severity === 'medium' ? '🟡 MEDIUM' : '🔵 LOW';
      lines.push(`| ${emoji} | \`${f.ruleId}\` | \`${f.file}:${f.line}\` | ${f.message} | \`${f.suggestedFix || '-'}\` |`);
    }
    lines.push('');
  }

  // Bottlenecks
  if (criticalPath.bottlenecks.length > 0) {
    lines.push('### ⚠️ Bottleneck & Optimization Advice');
    lines.push('');
    for (const b of criticalPath.bottlenecks) {
      lines.push(`- **[${b.severity.toUpperCase()}] ${b.jobName}**: ${b.reason}`);
      lines.push(`  - *Recommendation*: ${b.recommendation}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated automatically by [PipeLens](https://github.com/alexandrmotologa/pipelens).*');

  return lines.join('\n');
}
