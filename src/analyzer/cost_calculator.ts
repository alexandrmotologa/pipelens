import { JobTelemetry, CostEstimate, RunnerOsType } from '../types/index.js';

// GitHub Actions standard pricing per minute (USD)
export const GITHUB_RUNNER_RATES: Record<RunnerOsType, number> = {
  ubuntu: 0.008,
  windows: 0.016,
  macos: 0.064,
  'self-hosted': 0.0,
  unknown: 0.008,
};

// Estimated grams of CO2eq per billable minute based on standard data center PUE and grid mix
const CO2_GRAMS_PER_MINUTE: Record<RunnerOsType, number> = {
  ubuntu: 0.28,
  windows: 0.35,
  macos: 0.42,
  'self-hosted': 0.25,
  unknown: 0.28,
};

/**
 * Calculates billable minutes and monetary costs according to GitHub's rounding rules.
 * Each job's execution time is rounded up to the nearest whole minute.
 */
export function calculateJobCost(job: JobTelemetry): {
  billableMinutes: number;
  costUsd: number;
  co2Grams: number;
} {
  const durationMinutes = Math.max(0, job.durationMs) / 60000;
  // GitHub Actions always rounds up to the next full minute
  const billableMinutes = Math.max(1, Math.ceil(durationMinutes));
  const rate = GITHUB_RUNNER_RATES[job.runnerOs] ?? GITHUB_RUNNER_RATES.ubuntu;
  const co2Rate = CO2_GRAMS_PER_MINUTE[job.runnerOs] ?? CO2_GRAMS_PER_MINUTE.ubuntu;

  const costUsd = Number((billableMinutes * rate).toFixed(4));
  const co2Grams = Number((billableMinutes * co2Rate).toFixed(2));

  return {
    billableMinutes,
    costUsd,
    co2Grams,
  };
}

/**
 * Calculates aggregate cost and environmental impact across all jobs in a workflow run.
 */
export function calculateRunCost(jobs: JobTelemetry[]): CostEstimate {
  let totalBillableMinutes = 0;
  let linuxMinutes = 0;
  let windowsMinutes = 0;
  let macosMinutes = 0;
  let totalCostUsd = 0;
  let totalCo2 = 0;

  for (const job of jobs) {
    const { billableMinutes, costUsd, co2Grams } = calculateJobCost(job);
    totalBillableMinutes += billableMinutes;
    totalCostUsd += costUsd;
    totalCo2 += co2Grams;

    switch (job.runnerOs) {
      case 'windows':
        windowsMinutes += billableMinutes;
        break;
      case 'macos':
        macosMinutes += billableMinutes;
        break;
      case 'ubuntu':
      default:
        linuxMinutes += billableMinutes;
        break;
    }
  }

  // Potential savings if jobs are optimized by 25% through caching and dependency pruning
  const potentialSavingsUsd = Number((totalCostUsd * 0.25).toFixed(4));

  return {
    totalBillableMinutes,
    linuxMinutes,
    windowsMinutes,
    macosMinutes,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    estimatedCo2Grams: Number(totalCo2.toFixed(2)),
    potentialSavingsUsd,
  };
}
