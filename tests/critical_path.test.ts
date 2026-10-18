import { describe, it, expect } from 'vitest';
import { computeCriticalPath } from '../src/analyzer/critical_path.js';
import { JobTelemetry } from '../src/types/index.js';

describe('Critical Path DAG Analyzer', () => {
  it('identifies the critical path across sequential dependent jobs', () => {
    const jobs: JobTelemetry[] = [
      {
        id: 1,
        name: 'build',
        status: 'completed',
        conclusion: 'success',
        startedAt: null,
        completedAt: null,
        durationMs: 60000, // 1 min
        queueDurationMs: 1000,
        runnerName: 'runner-1',
        runnerOs: 'ubuntu',
        steps: [],
        needs: [],
      },
      {
        id: 2,
        name: 'test-unit',
        status: 'completed',
        conclusion: 'success',
        startedAt: null,
        completedAt: null,
        durationMs: 120000, // 2 mins
        queueDurationMs: 1000,
        runnerName: 'runner-2',
        runnerOs: 'ubuntu',
        steps: [],
        needs: ['build'],
      },
      {
        id: 3,
        name: 'test-lint',
        status: 'completed',
        conclusion: 'success',
        startedAt: null,
        completedAt: null,
        durationMs: 30000, // 30 sec (shorter branch, slack > 0)
        queueDurationMs: 1000,
        runnerName: 'runner-3',
        runnerOs: 'ubuntu',
        steps: [],
        needs: ['build'],
      },
      {
        id: 4,
        name: 'deploy',
        status: 'completed',
        conclusion: 'success',
        startedAt: null,
        completedAt: null,
        durationMs: 60000, // 1 min
        queueDurationMs: 1000,
        runnerName: 'runner-4',
        runnerOs: 'ubuntu',
        steps: [],
        needs: ['test-unit', 'test-lint'],
      },
    ];

    const result = computeCriticalPath(jobs);

    // Critical path must follow: build -> test-unit -> deploy (60s + 120s + 60s = 240s)
    expect(result.criticalPathDurationMs).toBe(240000);
    expect(result.criticalPath).toEqual(['build', 'test-unit', 'deploy']);

    // test-lint node must have slack = 90s (120s - 30s)
    const lintNode = result.nodes.find(n => n.name === 'test-lint');
    expect(lintNode).toBeDefined();
    expect(lintNode?.isCritical).toBe(false);
    expect(lintNode?.slackMs).toBe(90000);

    // Nodes on critical path must have isCritical: true
    const unitNode = result.nodes.find(n => n.name === 'test-unit');
    expect(unitNode?.isCritical).toBe(true);
    expect(unitNode?.slackMs).toBe(0);
  });

  it('handles empty jobs gracefully', () => {
    const result = computeCriticalPath([]);
    expect(result.criticalPath).toEqual([]);
    expect(result.criticalPathDurationMs).toBe(0);
  });
});
