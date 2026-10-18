import { Octokit } from '@octokit/rest';
import { WorkflowRunTelemetry, JobTelemetry, StepTelemetry, RunnerOsType } from '../types/index.js';
import { SAMPLE_WORKFLOW_RUN } from './sample_data.js';

/**
 * Creates an Octokit instance with optional authentication token.
 */
export function createOctokitClient(token?: string): Octokit {
  const authToken = token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return new Octokit({
    auth: authToken,
    userAgent: 'PipeLens/1.0.0 (https://github.com/alexandrmotologa/pipelens)',
  });
}

/**
 * Determines runner operating system from labels or runner name.
 */
function inferRunnerOsFromLabels(labels: string[] = [], runnerName: string | null = null): RunnerOsType {
  const combined = [...labels, runnerName || ''].join(' ').toLowerCase();
  if (combined.includes('win')) return 'windows';
  if (combined.includes('mac') || combined.includes('darwin')) return 'macos';
  if (combined.includes('self-hosted')) return 'self-hosted';
  if (combined.includes('ubuntu') || combined.includes('linux')) return 'ubuntu';
  return 'ubuntu';
}

/**
 * Fetches workflow run telemetry from the GitHub REST API.
 */
export async function fetchWorkflowRunTelemetry(
  owner: string,
  repo: string,
  runId?: number | string,
  token?: string
): Promise<WorkflowRunTelemetry> {
  const octokit = createOctokitClient(token);

  try {
    let targetRunId: number;

    if (!runId || runId === 'latest') {
      const runsResponse = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 5,
        status: 'completed',
      });

      if (runsResponse.data.workflow_runs.length === 0) {
        throw new Error(`No completed workflow runs found for ${owner}/${repo}`);
      }

      targetRunId = runsResponse.data.workflow_runs[0].id;
    } else {
      targetRunId = Number(runId);
    }

    // 1. Fetch run details
    const runResponse = await octokit.rest.actions.getWorkflowRun({
      owner,
      repo,
      run_id: targetRunId,
    });
    const run = runResponse.data;

    // 2. Fetch jobs
    const jobsResponse = await octokit.rest.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: targetRunId,
      per_page: 100,
    });

    const runCreatedAtMs = new Date(run.created_at).getTime();
    const runStartedAtMs = run.run_started_at ? new Date(run.run_started_at).getTime() : runCreatedAtMs;
    const runCompletedAtMs = run.updated_at ? new Date(run.updated_at).getTime() : Date.now();

    const jobs: JobTelemetry[] = jobsResponse.data.jobs.map(job => {
      const jobStartedMs = job.started_at ? new Date(job.started_at).getTime() : runStartedAtMs;
      const jobCompletedMs = job.completed_at ? new Date(job.completed_at).getTime() : jobStartedMs;
      const durationMs = Math.max(0, jobCompletedMs - jobStartedMs);
      const queueDurationMs = Math.max(0, jobStartedMs - runCreatedAtMs);

      const steps: StepTelemetry[] = (job.steps || []).map(step => {
        const stepStartedMs = step.started_at ? new Date(step.started_at).getTime() : jobStartedMs;
        const stepCompletedMs = step.completed_at ? new Date(step.completed_at).getTime() : stepStartedMs;
        return {
          name: step.name,
          status: step.status,
          conclusion: step.conclusion,
          number: step.number,
          startedAt: step.started_at || null,
          completedAt: step.completed_at || null,
          durationMs: Math.max(0, stepCompletedMs - stepStartedMs),
        };
      });

      // Extract explicit needs if present in job or infer from name
      return {
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        startedAt: job.started_at || null,
        completedAt: job.completed_at || null,
        durationMs,
        queueDurationMs,
        runnerName: job.runner_name,
        runnerOs: inferRunnerOsFromLabels(job.labels, job.runner_name),
        steps,
        needs: [], // GitHub jobs API doesn't expose `needs` directly, parsed from workflow YAML or reconstructed
      };
    });

    return {
      id: run.id,
      name: run.display_title || run.name || `Run #${run.run_number}`,
      workflowName: run.path || 'workflow.yml',
      repository: `${owner}/${repo}`,
      event: run.event,
      status: run.status || 'completed',
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      startedAt: run.run_started_at || run.created_at,
      completedAt: run.updated_at,
      totalDurationMs: Math.max(0, runCompletedAtMs - runStartedAtMs),
      jobs,
    };
  } catch (error: any) {
    // If running in development or offline mode, fall back to sample fixture
    if (owner === 'demo' || owner === 'sample' || !token) {
      return SAMPLE_WORKFLOW_RUN;
    }
    throw new Error(`Failed to fetch GitHub Actions telemetry for ${owner}/${repo}: ${error.message}`);
  }
}
