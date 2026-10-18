import { Octokit } from '@octokit/rest';
import YAML from 'yaml';
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
 * Fetches recent completed workflow runs for a repository.
 */
export async function fetchRecentWorkflowRuns(
  owner: string,
  repo: string,
  count: number = 2,
  token?: string
): Promise<Array<{ id: number; name: string; runNumber: number; createdAt: string }>> {
  if (owner === 'sample' || owner === 'demo') {
    return [
      { id: 89410294, name: 'CI / Test & Build Suite #142', runNumber: 142, createdAt: new Date().toISOString() },
      { id: 89410300, name: 'CI / Test & Build Suite #143 (PR #45)', runNumber: 143, createdAt: new Date().toISOString() },
    ];
  }

  const octokit = createOctokitClient(token);
  const response = await octokit.rest.actions.listWorkflowRunsForRepo({
    owner,
    repo,
    per_page: Math.max(count, 5),
    status: 'completed',
  });

  return response.data.workflow_runs.slice(0, count).map(r => ({
    id: r.id,
    name: r.display_title || r.name || `Run #${r.run_number}`,
    runNumber: r.run_number,
    createdAt: r.created_at,
  }));
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
  if (owner === 'sample' || owner === 'demo') {
    return SAMPLE_WORKFLOW_RUN;
  }

  const octokit = createOctokitClient(token);

  try {
    let targetRunId: number;

    if (!runId || runId === 'latest' || runId === 'baseline' || runId === 'target') {
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

    // 2. Attempt to fetch workflow YAML to extract exact `needs` DAG dependencies
    const jobNeedsMap = new Map<string, string[]>();
    if (run.path) {
      try {
        const fileContent = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: run.path,
          ref: run.head_sha,
        });

        if ('content' in fileContent.data && fileContent.data.content) {
          const yamlStr = Buffer.from(fileContent.data.content, 'base64').toString('utf8');
          const parsed = YAML.parse(yamlStr);
          if (parsed && typeof parsed === 'object' && parsed.jobs) {
            for (const [jobKey, jobDef] of Object.entries<any>(parsed.jobs)) {
              if (jobDef && typeof jobDef === 'object') {
                let needsList: string[] = [];
                if (jobDef.needs) {
                  needsList = Array.isArray(jobDef.needs) ? jobDef.needs : [String(jobDef.needs)];
                }
                jobNeedsMap.set(jobKey, needsList);
                if (jobDef.name) {
                  jobNeedsMap.set(String(jobDef.name), needsList);
                }
              }
            }
          }
        }
      } catch {
        // Repository content may be inaccessible or deleted; continue with telemetry data
      }
    }

    // 3. Fetch jobs
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

      // Match explicit needs from YAML mapping
      let needs: string[] = jobNeedsMap.get(job.name) || [];
      if (needs.length === 0) {
        // Strip matrix suffix e.g. "test (ubuntu-latest, 20)" -> "test"
        const baseName = job.name.split(' (')[0].trim();
        needs = jobNeedsMap.get(baseName) || [];
      }

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
        needs,
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
    throw new Error(`Failed to fetch GitHub Actions telemetry for ${owner}/${repo}: ${error.message}`);
  }
}
