import { EvaluationContext } from '../types/index.js';

/**
 * Creates a default standard evaluation context simulating a typical GitHub Actions runner environment.
 */
export function createDefaultContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  const defaultGithub = {
    action: 'run',
    actor: 'octocat',
    base_ref: 'main',
    event_name: 'pull_request',
    head_ref: 'feature/pipeline-optimization',
    ref: 'refs/pull/42/merge',
    repository: 'alexandrmotologa/pipelens',
    repository_owner: 'alexandrmotologa',
    run_id: 102938475,
    run_number: 14,
    sha: '9f837fc976e1593b4a2e896898b82ff633a652e9',
    workflow: 'Continuous Integration',
    workspace: '/home/runner/work/pipelens/pipelens',
    event: {
      action: 'opened',
      number: 42,
      pull_request: {
        number: 42,
        title: 'Optimize CI DAG and Pin Dependencies',
        body: 'Improves pipeline wall-clock time by parallelizing lint and test stages.',
        draft: false,
        head: {
          ref: 'feature/pipeline-optimization',
          sha: '9f837fc976e1593b4a2e896898b82ff633a652e9',
        },
        base: {
          ref: 'main',
          sha: 'b45c276a1d82f348e7e1b99a03780371fa796df1',
        },
      },
      repository: {
        name: 'pipelens',
        full_name: 'alexandrmotologa/pipelens',
        private: false,
        default_branch: 'main',
      },
      sender: {
        login: 'octocat',
        type: 'User',
      },
    },
  };

  const defaultRunner = {
    os: 'Linux',
    arch: 'X64',
    name: 'GitHub Actions 4',
    temp: '/home/runner/work/_temp',
    tool_cache: '/opt/hostedtoolcache',
  };

  const defaultEnv = {
    CI: 'true',
    GITHUB_ACTIONS: 'true',
  };

  return {
    github: { ...defaultGithub, ...(overrides.github || {}) },
    runner: { ...defaultRunner, ...(overrides.runner || {}) },
    env: { ...defaultEnv, ...(overrides.env || {}) },
    vars: overrides.vars || {},
    job: overrides.job || { status: 'success' },
    steps: overrides.steps || {},
    matrix: overrides.matrix || {},
    inputs: overrides.inputs || {},
  };
}
