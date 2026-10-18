import { JobTelemetry, CacheRecord, CacheAuditResult } from '../types/index.js';
import { GITHUB_RUNNER_RATES } from './cost_calculator.js';

/**
 * Patterns matching caching steps in GitHub Actions.
 */
const CACHE_STEP_PATTERNS = [
  /cache/i,
  /restore/i,
  /save.*cache/i,
  /setup-node/i,
  /setup-python/i,
  /setup-go/i,
  /rust-cache/i,
  /gradle-build-action/i,
];

/**
 * Parses step telemetry and logs to extract cache hits, misses, and wasted runner minutes.
 */
export function auditCacheTelemetry(jobs: JobTelemetry[], rawLogsMap?: Map<string | number, string>): CacheAuditResult {
  const records: CacheRecord[] = [];
  let wastedDurationMs = 0;
  let estimatedSavingsUsd = 0;

  for (const job of jobs) {
    const jobLog = rawLogsMap?.get(job.id) || '';

    for (const step of job.steps) {
      const isCacheStep = CACHE_STEP_PATTERNS.some(p => p.test(step.name));

      if (isCacheStep) {
        // Inspect step conclusion and logs for hit vs miss
        let hit = false;
        let saved = /save|post.*cache/i.test(step.name);
        let cacheKey = 'actions-cache-key';

        // Check logs if available
        if (jobLog) {
          if (jobLog.includes('Cache restored from key') || jobLog.includes('Cache hit occurred')) {
            hit = true;
          } else if (jobLog.includes('Cache not found for input keys') || jobLog.includes('Cache miss')) {
            hit = false;
          }
          const keyMatch = jobLog.match(/key:?\s+([a-zA-Z0-9_\-.:]+)/i);
          if (keyMatch) {
            cacheKey = keyMatch[1];
          }
        } else {
          // Heuristic from step name / duration:
          // In standard workflows, a cache restore step that takes > 45s is typically downloading
          // or re-generating rather than an instant local SSD hit (< 5s)
          const lowerName = step.name.toLowerCase();
          if (lowerName.includes('hit') || (lowerName.includes('restore') && step.durationMs < 15000 && step.conclusion === 'success')) {
            hit = true;
          } else {
            hit = false;
          }
        }

        records.push({
          jobId: job.id,
          stepName: step.name,
          cacheKey,
          hit,
          saved,
          durationMs: step.durationMs,
        });

        // If it was a cache miss on a restore step, the subsequent build/install step
        // generally incurs significant penalties (e.g. 90-180 seconds of package downloading)
        if (!hit && !saved) {
          // Find following dependency install step if present
          const installStep = job.steps.find(s =>
            s.number > step.number &&
            /install|deps|build|compile|download/i.test(s.name)
          );
          const penaltyMs = installStep ? Math.round(installStep.durationMs * 0.7) : Math.max(step.durationMs, 45000);
          wastedDurationMs += penaltyMs;

          const runnerRate = GITHUB_RUNNER_RATES[job.runnerOs] || GITHUB_RUNNER_RATES.ubuntu;
          const wastedMinutes = Math.ceil(penaltyMs / 60000);
          estimatedSavingsUsd += wastedMinutes * runnerRate;
        }
      }
    }
  }

  const totalCacheSteps = records.length;
  const cacheHits = records.filter(r => r.hit).length;
  const cacheMisses = totalCacheSteps - cacheHits;
  const hitRatio = totalCacheSteps > 0 ? Number((cacheHits / totalCacheSteps).toFixed(2)) : 1.0;

  return {
    totalCacheSteps,
    cacheHits,
    cacheMisses,
    hitRatio,
    wastedDurationMs,
    estimatedSavingsUsd: Number(estimatedSavingsUsd.toFixed(4)),
    records,
  };
}
