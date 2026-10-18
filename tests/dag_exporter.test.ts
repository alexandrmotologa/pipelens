import { describe, it, expect } from 'vitest';
import { exportDagToMermaid, exportDagToSvg } from '../src/analyzer/dag_exporter.js';
import { SAMPLE_WORKFLOW_RUN } from '../src/api/sample_data.js';

describe('DAG Exporters', () => {
  it('exports valid GitHub-flavored Mermaid syntax', () => {
    const mermaid = exportDagToMermaid(SAMPLE_WORKFLOW_RUN.jobs);
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('classDef critical');
    expect(mermaid).toContain('unit-tests');
    expect(mermaid).toContain('linkStyle');
  });

  it('exports valid standalone SVG vector diagram', () => {
    const svg = exportDagToSvg(SAMPLE_WORKFLOW_RUN.jobs);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0');
    expect(svg).toContain('Critical (Slack: 0s)');
    expect(svg).toContain('</svg>');
  });
});
