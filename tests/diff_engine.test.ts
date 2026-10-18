import { describe, it, expect } from 'vitest';
import { compareWorkflowRuns } from '../src/analyzer/diff_engine.js';
import { WorkflowRunTelemetry } from '../src/types/index.js';
import { SAMPLE_WORKFLOW_RUN } from '../src/api/sample_data.js';

describe('Run-to-Run Diff & Regression Engine', () => {
  it('detects wall-clock duration changes and step deltas', () => {
    const targetRun: WorkflowRunTelemetry = {
      ...SAMPLE_WORKFLOW_RUN,
      id: 999,
      name: 'PR #45 Test',
      totalDurationMs: 650000, // slowed down
      jobs: SAMPLE_WORKFLOW_RUN.jobs.map(j => ({
        ...j,
        durationMs: j.name === 'unit-tests' ? 300000 : j.durationMs, // +90s
        steps: j.steps.map(s => s.name === 'Execute Vitest suite' ? { ...s, durationMs: 180000 } : s),
      })),
    };

    const diff = compareWorkflowRuns(SAMPLE_WORKFLOW_RUN, targetRun);

    expect(diff.wallClockDeltaMs).toBe(140000);
    expect(diff.wallClockDeltaPercent).toBeGreaterThan(0);
    expect(diff.regressions.length).toBeGreaterThan(0);

    const unitJob = diff.jobDeltas.find(j => j.name === 'unit-tests');
    expect(unitJob?.status).toBe('slower');
    expect(unitJob?.deltaMs).toBe(90000);
  });

  it('detects improvements when pipeline is optimized', () => {
    const optimizedRun: WorkflowRunTelemetry = {
      ...SAMPLE_WORKFLOW_RUN,
      id: 1000,
      name: 'Optimized Main',
      totalDurationMs: 350000, // faster
      jobs: SAMPLE_WORKFLOW_RUN.jobs.map(j => ({
        ...j,
        durationMs: Math.round(j.durationMs * 0.7),
      })),
    };

    const diff = compareWorkflowRuns(SAMPLE_WORKFLOW_RUN, optimizedRun);
    expect(diff.wallClockDeltaMs).toBeLessThan(0);
    expect(diff.improvements.length).toBeGreaterThan(0);
    expect(diff.costDeltaUsd).toBeLessThan(0);
  });
});
