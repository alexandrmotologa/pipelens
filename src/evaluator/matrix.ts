import {
  MatrixVariation,
  MatrixSimulationResult,
  RunnerOsType,
} from '../types/index.js';
import { GITHUB_RUNNER_RATES } from '../analyzer/cost_calculator.js';

interface RawMatrixConfig {
  include?: Record<string, any>[];
  exclude?: Record<string, any>[];
  [key: string]: any;
}

/**
 * Detects the runner operating system type from matrix variables.
 */
function inferRunnerOs(variables: Record<string, any>): RunnerOsType {
  const osVal = String(variables.os || variables['runs-on'] || variables.runner || '').toLowerCase();
  if (osVal.includes('win')) return 'windows';
  if (osVal.includes('mac') || osVal.includes('apple') || osVal.includes('darwin')) return 'macos';
  if (osVal.includes('self-hosted')) return 'self-hosted';
  if (osVal.includes('ubuntu') || osVal.includes('linux')) return 'ubuntu';
  return 'ubuntu';
}

/**
 * Computes the Cartesian product of multidimensional array options.
 */
function cartesianProduct(entries: [string, any[]][]): Record<string, any>[] {
  if (entries.length === 0) return [{}];

  const [key, values] = entries[0];
  const rest = entries.slice(1);
  const restProduct = cartesianProduct(rest);

  const results: Record<string, any>[] = [];
  for (const val of values) {
    for (const item of restProduct) {
      results.push({ [key]: val, ...item });
    }
  }

  return results;
}

/**
 * Expands GitHub Actions strategy.matrix into individual job variations,
 * applying `include` and `exclude` directives.
 */
export function expandMatrix(matrixConfig: RawMatrixConfig, baseDurationMinutes: number = 5): MatrixSimulationResult {
  const dimensionKeys = Object.keys(matrixConfig).filter(k => k !== 'include' && k !== 'exclude');
  const dimensionEntries: [string, any[]][] = [];

  for (const key of dimensionKeys) {
    const val = matrixConfig[key];
    if (Array.isArray(val)) {
      dimensionEntries.push([key, val]);
    } else if (val !== undefined && val !== null) {
      dimensionEntries.push([key, [val]]);
    }
  }

  let combinations = cartesianProduct(dimensionEntries);

  // Apply exclude filters
  if (Array.isArray(matrixConfig.exclude)) {
    combinations = combinations.filter(combo => {
      // Check if combo matches any exclude rule
      for (const rule of matrixConfig.exclude!) {
        const matchesAllRuleKeys = Object.entries(rule).every(
          ([ruleKey, ruleVal]) => String(combo[ruleKey]) === String(ruleVal)
        );
        if (matchesAllRuleKeys) {
          return false; // Exclude this combination
        }
      }
      return true;
    });
  }

  // Apply include additions and enrichments
  if (Array.isArray(matrixConfig.include)) {
    for (const inc of matrixConfig.include) {
      // Find if inc matches an existing combination
      const matchingIndex = combinations.findIndex(combo =>
        dimensionKeys.every(k => inc[k] === undefined || String(combo[k]) === String(inc[k]))
      );

      if (matchingIndex !== -1 && dimensionKeys.length > 0) {
        // Enrich existing combination
        combinations[matchingIndex] = { ...combinations[matchingIndex], ...inc };
      } else {
        // Append new combination
        combinations.push({ ...inc });
      }
    }
  }

  const variations: MatrixVariation[] = combinations.map((vars, index) => {
    const runnerOs = inferRunnerOs(vars);
    // macOS typically runs slower or has heavier tooling; adjust baseline estimate
    const durationMultiplier = runnerOs === 'macos' ? 1.4 : runnerOs === 'windows' ? 1.2 : 1.0;
    const estimatedMinutes = Math.max(1, Math.round(baseDurationMinutes * durationMultiplier));

    const titleParts = Object.entries(vars).map(([k, v]) => `${k}: ${v}`);
    const name = titleParts.length > 0 ? `(${titleParts.join(', ')})` : `Job #${index + 1}`;

    return {
      id: `matrix-job-${index + 1}`,
      name,
      variables: vars,
      runnerOs,
      estimatedMinutes,
    };
  });

  let totalEstimatedCostUsd = 0;
  let totalEstimatedBillableMinutes = 0;

  for (const v of variations) {
    const rate = GITHUB_RUNNER_RATES[v.runnerOs] || GITHUB_RUNNER_RATES.ubuntu;
    totalEstimatedBillableMinutes += v.estimatedMinutes;
    totalEstimatedCostUsd += v.estimatedMinutes * rate;
  }

  return {
    totalJobs: variations.length,
    dimensions: dimensionKeys,
    variations,
    totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(4)),
    totalEstimatedBillableMinutes,
  };
}
