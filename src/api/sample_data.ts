import { WorkflowRunTelemetry } from '../types/index.js';

export const SAMPLE_WORKFLOW_RUN: WorkflowRunTelemetry = {
  id: 89410294,
  name: 'CI / Test & Build Suite #142',
  workflowName: 'ci.yml',
  repository: 'alexandrmotologa/pipelens',
  event: 'pull_request',
  status: 'completed',
  conclusion: 'success',
  htmlUrl: 'https://github.com/alexandrmotologa/pipelens/actions/runs/89410294',
  createdAt: '2026-10-18T10:00:00.000Z',
  updatedAt: '2026-10-18T10:08:45.000Z',
  startedAt: '2026-10-18T10:00:15.000Z',
  completedAt: '2026-10-18T10:08:45.000Z',
  totalDurationMs: 510000, // 8m 30s
  jobs: [
    {
      id: 101,
      name: 'lint-and-typecheck',
      status: 'completed',
      conclusion: 'success',
      startedAt: '2026-10-18T10:00:20.000Z',
      completedAt: '2026-10-18T10:01:50.000Z',
      durationMs: 90000, // 1m 30s
      queueDurationMs: 5000,
      runnerName: 'GitHub Actions 1',
      runnerOs: 'ubuntu',
      needs: [],
      steps: [
        { name: 'Set up job', status: 'completed', conclusion: 'success', number: 1, startedAt: '2026-10-18T10:00:20.000Z', completedAt: '2026-10-18T10:00:24.000Z', durationMs: 4000 },
        { name: 'Checkout repository', status: 'completed', conclusion: 'success', number: 2, startedAt: '2026-10-18T10:00:24.000Z', completedAt: '2026-10-18T10:00:30.000Z', durationMs: 6000 },
        { name: 'Setup Node.js 22', status: 'completed', conclusion: 'success', number: 3, startedAt: '2026-10-18T10:00:30.000Z', completedAt: '2026-10-18T10:00:38.000Z', durationMs: 8000 },
        { name: 'Restore npm cache', status: 'completed', conclusion: 'success', number: 4, startedAt: '2026-10-18T10:00:38.000Z', completedAt: '2026-10-18T10:00:41.000Z', durationMs: 3000 },
        { name: 'Install dependencies', status: 'completed', conclusion: 'success', number: 5, startedAt: '2026-10-18T10:00:41.000Z', completedAt: '2026-10-18T10:01:05.000Z', durationMs: 24000 },
        { name: 'Run ESLint & TypeScript validation', status: 'completed', conclusion: 'success', number: 6, startedAt: '2026-10-18T10:01:05.000Z', completedAt: '2026-10-18T10:01:50.000Z', durationMs: 45000 },
      ],
    },
    {
      id: 102,
      name: 'unit-tests',
      status: 'completed',
      conclusion: 'success',
      startedAt: '2026-10-18T10:01:55.000Z',
      completedAt: '2026-10-18T10:05:25.000Z',
      durationMs: 210000, // 3m 30s
      queueDurationMs: 60000, // Runner delay
      runnerName: 'GitHub Actions 2',
      runnerOs: 'ubuntu',
      needs: ['lint-and-typecheck'],
      steps: [
        { name: 'Set up job', status: 'completed', conclusion: 'success', number: 1, startedAt: '2026-10-18T10:01:55.000Z', completedAt: '2026-10-18T10:01:58.000Z', durationMs: 3000 },
        { name: 'Checkout repository', status: 'completed', conclusion: 'success', number: 2, startedAt: '2026-10-18T10:01:58.000Z', completedAt: '2026-10-18T10:02:04.000Z', durationMs: 6000 },
        { name: 'Setup Node.js 22', status: 'completed', conclusion: 'success', number: 3, startedAt: '2026-10-18T10:02:04.000Z', completedAt: '2026-10-18T10:02:10.000Z', durationMs: 6000 },
        { name: 'Restore npm cache', status: 'completed', conclusion: 'success', number: 4, startedAt: '2026-10-18T10:02:10.000Z', completedAt: '2026-10-18T10:02:55.000Z', durationMs: 45000 }, // Cache miss penalty
        { name: 'Install dependencies', status: 'completed', conclusion: 'success', number: 5, startedAt: '2026-10-18T10:02:55.000Z', completedAt: '2026-10-18T10:03:55.000Z', durationMs: 60000 },
        { name: 'Execute Vitest suite', status: 'completed', conclusion: 'success', number: 6, startedAt: '2026-10-18T10:03:55.000Z', completedAt: '2026-10-18T10:05:25.000Z', durationMs: 90000 },
      ],
    },
    {
      id: 103,
      name: 'e2e-matrix (ubuntu-latest)',
      status: 'completed',
      conclusion: 'success',
      startedAt: '2026-10-18T10:05:30.000Z',
      completedAt: '2026-10-18T10:08:30.000Z',
      durationMs: 180000, // 3m 00s
      queueDurationMs: 15000,
      runnerName: 'GitHub Actions 3',
      runnerOs: 'ubuntu',
      needs: ['unit-tests'],
      steps: [
        { name: 'Set up job', status: 'completed', conclusion: 'success', number: 1, startedAt: '2026-10-18T10:05:30.000Z', completedAt: '2026-10-18T10:05:33.000Z', durationMs: 3000 },
        { name: 'Checkout repository', status: 'completed', conclusion: 'success', number: 2, startedAt: '2026-10-18T10:05:33.000Z', completedAt: '2026-10-18T10:05:39.000Z', durationMs: 6000 },
        { name: 'Install Playwright browsers', status: 'completed', conclusion: 'success', number: 3, startedAt: '2026-10-18T10:05:39.000Z', completedAt: '2026-10-18T10:06:39.000Z', durationMs: 60000 },
        { name: 'Run E2E tests', status: 'completed', conclusion: 'success', number: 4, startedAt: '2026-10-18T10:06:39.000Z', completedAt: '2026-10-18T10:08:30.000Z', durationMs: 111000 },
      ],
    },
    {
      id: 104,
      name: 'e2e-matrix (macos-14)',
      status: 'completed',
      conclusion: 'success',
      startedAt: '2026-10-18T10:05:30.000Z',
      completedAt: '2026-10-18T10:08:45.000Z',
      durationMs: 195000, // 3m 15s (macOS critical node)
      queueDurationMs: 40000,
      runnerName: 'GitHub Actions macOS M1',
      runnerOs: 'macos',
      needs: ['unit-tests'],
      steps: [
        { name: 'Set up job', status: 'completed', conclusion: 'success', number: 1, startedAt: '2026-10-18T10:05:30.000Z', completedAt: '2026-10-18T10:05:35.000Z', durationMs: 5000 },
        { name: 'Checkout repository', status: 'completed', conclusion: 'success', number: 2, startedAt: '2026-10-18T10:05:35.000Z', completedAt: '2026-10-18T10:05:43.000Z', durationMs: 8000 },
        { name: 'Install Playwright browsers', status: 'completed', conclusion: 'success', number: 3, startedAt: '2026-10-18T10:05:43.000Z', completedAt: '2026-10-18T10:06:55.000Z', durationMs: 72000 },
        { name: 'Run E2E tests', status: 'completed', conclusion: 'success', number: 4, startedAt: '2026-10-18T10:06:55.000Z', completedAt: '2026-10-18T10:08:45.000Z', durationMs: 110000 },
      ],
    },
    {
      id: 105,
      name: 'security-audit',
      status: 'completed',
      conclusion: 'success',
      startedAt: '2026-10-18T10:00:20.000Z',
      completedAt: '2026-10-18T10:01:10.000Z',
      durationMs: 50000, // 50s
      queueDurationMs: 4000,
      runnerName: 'GitHub Actions 4',
      runnerOs: 'ubuntu',
      needs: [], // Runs in parallel with lint-and-typecheck!
      steps: [
        { name: 'Set up job', status: 'completed', conclusion: 'success', number: 1, startedAt: '2026-10-18T10:00:20.000Z', completedAt: '2026-10-18T10:00:23.000Z', durationMs: 3000 },
        { name: 'Checkout repository', status: 'completed', conclusion: 'success', number: 2, startedAt: '2026-10-18T10:00:23.000Z', completedAt: '2026-10-18T10:00:29.000Z', durationMs: 6000 },
        { name: 'Run npm audit', status: 'completed', conclusion: 'success', number: 3, startedAt: '2026-10-18T10:00:29.000Z', completedAt: '2026-10-18T10:01:10.000Z', durationMs: 41000 },
      ],
    },
  ],
};
