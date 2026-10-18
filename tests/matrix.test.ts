import { describe, it, expect } from 'vitest';
import { expandMatrix } from '../src/evaluator/matrix.js';

describe('Matrix Expansion Engine', () => {
  it('computes Cartesian product of matrix dimensions', () => {
    const config = {
      os: ['ubuntu-latest', 'macos-latest'],
      node: [18, 20],
    };

    const result = expandMatrix(config, 5);
    expect(result.totalJobs).toBe(4);
    expect(result.dimensions).toEqual(['os', 'node']);
    expect(result.variations.some(v => v.variables.os === 'ubuntu-latest' && v.variables.node === 18)).toBe(true);
    expect(result.variations.some(v => v.variables.os === 'macos-latest' && v.variables.node === 20)).toBe(true);
  });

  it('filters combinations using exclude directives', () => {
    const config = {
      os: ['ubuntu-latest', 'windows-latest'],
      node: [18, 20],
      exclude: [
        { os: 'windows-latest', node: 18 },
      ],
    };

    const result = expandMatrix(config, 5);
    expect(result.totalJobs).toBe(3);
    const hasWindows18 = result.variations.some(v => v.variables.os === 'windows-latest' && v.variables.node === 18);
    expect(hasWindows18).toBe(false);
  });

  it('enriches and appends combinations using include directives', () => {
    const config = {
      os: ['ubuntu-latest'],
      node: [20],
      include: [
        { os: 'ubuntu-latest', node: 20, experimental: true },
        { os: 'macos-14', node: 22, arch: 'arm64' },
      ],
    };

    const result = expandMatrix(config, 5);
    // 1 enriched combination + 1 novel combination = 2 jobs
    expect(result.totalJobs).toBe(2);
    const enriched = result.variations.find(v => v.variables.os === 'ubuntu-latest');
    expect(enriched?.variables.experimental).toBe(true);

    const novel = result.variations.find(v => v.variables.os === 'macos-14');
    expect(novel).toBeDefined();
    expect(novel?.variables.arch).toBe('arm64');
  });

  it('computes estimated billable minutes and runner costs', () => {
    const config = {
      os: ['ubuntu-latest', 'macos-latest'],
    };

    const result = expandMatrix(config, 10);
    expect(result.totalEstimatedBillableMinutes).toBeGreaterThan(0);
    expect(result.totalEstimatedCostUsd).toBeGreaterThan(0);
  });
});
