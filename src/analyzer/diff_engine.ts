import {
  WorkflowRunTelemetry,
  RunComparisonResult,
  JobDelta,
  StepDelta,
} from '../types/index.js';
import { computeCriticalPath } from './critical_path.js';
import { calculateRunCost } from './cost_calculator.js';
import { auditCacheTelemetry } from './cache_auditor.js';

/**
 * Compares two workflow runs to detect performance regressions,
 * step duration deltas, critical path shifts, and billing changes.
 */
export function compareWorkflowRuns(
  baseline: WorkflowRunTelemetry,
  target: WorkflowRunTelemetry
): RunComparisonResult {
  const baseCp = computeCriticalPath(baseline.jobs);
  const targetCp = computeCriticalPath(target.jobs);

  const baseCost = calculateRunCost(baseline.jobs);
  const targetCost = calculateRunCost(target.jobs);

  const baseCache = auditCacheTelemetry(baseline.jobs);
  const targetCache = auditCacheTelemetry(target.jobs);

  const wallClockDeltaMs = target.totalDurationMs - baseline.totalDurationMs;
  const wallClockDeltaPercent = baseline.totalDurationMs > 0
    ? Number(((wallClockDeltaMs / baseline.totalDurationMs) * 100).toFixed(1))
    : 0;

  const criticalPathDeltaMs = targetCp.criticalPathDurationMs - baseCp.criticalPathDurationMs;
  const criticalPathChanged = JSON.stringify(baseCp.criticalPath) !== JSON.stringify(targetCp.criticalPath);

  const costDeltaUsd = Number((targetCost.totalCostUsd - baseCost.totalCostUsd).toFixed(4));
  const billableMinutesDelta = targetCost.totalBillableMinutes - baseCost.totalBillableMinutes;
  const carbonDeltaGrams = Number((targetCost.estimatedCo2Grams - baseCost.estimatedCo2Grams).toFixed(2));
  const cacheHitRatioDelta = Number((targetCache.hitRatio - baseCache.hitRatio).toFixed(2));

  // Map jobs by name
  const baseJobsMap = new Map(baseline.jobs.map(j => [j.name, j]));
  const targetJobsMap = new Map(target.jobs.map(j => [j.name, j]));
  const allJobNames = Array.from(new Set([...baseJobsMap.keys(), ...targetJobsMap.keys()]));

  const jobDeltas: JobDelta[] = [];
  const regressions: string[] = [];
  const improvements: string[] = [];

  for (const name of allJobNames) {
    const bJob = baseJobsMap.get(name);
    const tJob = targetJobsMap.get(name);

    if (!bJob && tJob) {
      jobDeltas.push({
        name,
        status: 'added',
        baselineDurationMs: 0,
        targetDurationMs: tJob.durationMs,
        deltaMs: tJob.durationMs,
        stepDeltas: [],
      });
      regressions.push(`New job "${name}" added to pipeline (+${Math.round(tJob.durationMs / 1000)}s)`);
    } else if (bJob && !tJob) {
      jobDeltas.push({
        name,
        status: 'removed',
        baselineDurationMs: bJob.durationMs,
        targetDurationMs: 0,
        deltaMs: -bJob.durationMs,
        stepDeltas: [],
      });
      improvements.push(`Job "${name}" removed from pipeline (-${Math.round(bJob.durationMs / 1000)}s)`);
    } else if (bJob && tJob) {
      const deltaMs = tJob.durationMs - bJob.durationMs;
      const status = deltaMs > 5000 ? 'slower' : deltaMs < -5000 ? 'faster' : 'unchanged';

      // Step-by-step diff
      const stepDeltas: StepDelta[] = [];
      const bStepsMap = new Map(bJob.steps.map(s => [s.name, s]));
      for (const tStep of tJob.steps) {
        const bStep = bStepsMap.get(tStep.name);
        const bStepDur = bStep ? bStep.durationMs : 0;
        const sDelta = tStep.durationMs - bStepDur;
        stepDeltas.push({
          name: tStep.name,
          baselineDurationMs: bStepDur,
          targetDurationMs: tStep.durationMs,
          deltaMs: sDelta,
        });

        if (sDelta > 15000) {
          regressions.push(`Step "${tStep.name}" in "${name}" slowed down by ${Math.round(sDelta / 1000)}s`);
        } else if (sDelta < -15000) {
          improvements.push(`Step "${tStep.name}" in "${name}" sped up by ${Math.round(-sDelta / 1000)}s`);
        }
      }

      jobDeltas.push({
        name,
        status,
        baselineDurationMs: bJob.durationMs,
        targetDurationMs: tJob.durationMs,
        deltaMs,
        stepDeltas,
      });

      if (deltaMs > 30000) {
        regressions.push(`Job "${name}" slowed down by ${Math.round(deltaMs / 1000)}s`);
      } else if (deltaMs < -30000) {
        improvements.push(`Job "${name}" sped up by ${Math.round(-deltaMs / 1000)}s`);
      }
    }
  }

  if (criticalPathDeltaMs > 30000) {
    regressions.push(`Critical path duration increased by ${Math.round(criticalPathDeltaMs / 1000)}s (${(criticalPathDeltaMs / 60000).toFixed(1)}m)`);
  } else if (criticalPathDeltaMs < -30000) {
    improvements.push(`Critical path duration decreased by ${Math.round(-criticalPathDeltaMs / 1000)}s (${(-criticalPathDeltaMs / 60000).toFixed(1)}m)`);
  }

  if (cacheHitRatioDelta < -0.2) {
    regressions.push(`Cache hit ratio dropped by ${Math.round(Math.abs(cacheHitRatioDelta) * 100)}%`);
  } else if (cacheHitRatioDelta > 0.2) {
    improvements.push(`Cache hit ratio improved by ${Math.round(cacheHitRatioDelta * 100)}%`);
  }

  return {
    baselineRunId: baseline.id,
    targetRunId: target.id,
    baselineName: baseline.name,
    targetName: target.name,
    wallClockDeltaMs,
    wallClockDeltaPercent,
    criticalPathDeltaMs,
    criticalPathChanged,
    baselineCriticalPath: baseCp.criticalPath,
    targetCriticalPath: targetCp.criticalPath,
    costDeltaUsd,
    billableMinutesDelta,
    carbonDeltaGrams,
    cacheHitRatioDelta,
    jobDeltas,
    regressions,
    improvements,
  };
}
