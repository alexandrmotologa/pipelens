import { describe, it, expect } from 'vitest';
import { calculateJobCost, calculateRunCost } from '../src/analyzer/cost_calculator.js';
import { JobTelemetry } from '../src/types/index.js';

describe('Cost Calculator & Billing Rules', () => {
  it('rounds up partial minutes to nearest whole minute', () => {
    const job: JobTelemetry = {
      id: 1,
      name: 'test',
      status: 'completed',
      conclusion: 'success',
      startedAt: null,
      completedAt: null,
      durationMs: 65000, // 1m 5s -> rounds to 2 billable minutes
      queueDurationMs: 0,
      runnerName: 'runner',
      runnerOs: 'ubuntu',
      steps: [],
      needs: [],
    };

    const cost = calculateJobCost(job);
    expect(cost.billableMinutes).toBe(2);
    expect(cost.costUsd).toBe(Number((2 * 0.008).toFixed(4)));
  });

  it('applies runner OS rate multipliers', () => {
    const macJob: JobTelemetry = {
      id: 2,
      name: 'mac-test',
      status: 'completed',
      conclusion: 'success',
      startedAt: null,
      completedAt: null,
      durationMs: 60000, // 1 min
      queueDurationMs: 0,
      runnerName: 'mac-runner',
      runnerOs: 'macos',
      steps: [],
      needs: [],
    };

    const cost = calculateJobCost(macJob);
    expect(cost.billableMinutes).toBe(1);
    expect(cost.costUsd).toBe(0.064); // macOS rate
  });

  it('aggregates total workflow run costs and carbon footprint', () => {
    const jobs: JobTelemetry[] = [
      {
        id: 1,
        name: 'linux-job',
        status: 'completed',
        conclusion: 'success',
        startedAt: null,
        completedAt: null,
        durationMs: 120000, // 2 mins
        queueDurationMs: 0,
        runnerName: 'runner',
        runnerOs: 'ubuntu',
        steps: [],
        needs: [],
      },
      {
        id: 2,
        name: 'windows-job',
        status: 'completed',
        conclusion: 'success',
        startedAt: null,
        completedAt: null,
        durationMs: 60000, // 1 min
        queueDurationMs: 0,
        runnerName: 'win-runner',
        runnerOs: 'windows',
        steps: [],
        needs: [],
      },
    ];

    const runCost = calculateRunCost(jobs);
    expect(runCost.totalBillableMinutes).toBe(3);
    expect(runCost.linuxMinutes).toBe(2);
    expect(runCost.windowsMinutes).toBe(1);
    expect(runCost.totalCostUsd).toBe(Number((2 * 0.008 + 1 * 0.016).toFixed(4)));
    expect(runCost.estimatedCo2Grams).toBeGreaterThan(0);
  });
});
