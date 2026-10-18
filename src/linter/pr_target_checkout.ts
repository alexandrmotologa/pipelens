import { LintRule, ParsedWorkflowDoc } from './types.js';
import { SecurityFinding } from '../types/index.js';

/**
 * Checks if workflow trigger includes pull_request_target.
 */
function hasPullRequestTarget(on: any): boolean {
  if (!on) return false;
  if (typeof on === 'string') return on === 'pull_request_target';
  if (Array.isArray(on)) return on.includes('pull_request_target');
  if (typeof on === 'object') return 'pull_request_target' in on;
  return false;
}

export const prTargetCheckoutRule: LintRule = {
  id: 'PL-SEC-006',
  title: 'Insecure pull_request_target Head Checkout',
  category: 'supply-chain',
  severity: 'critical',
  description: 'Checking out untrusted pull request code in a pull_request_target workflow grants attacker-controlled code access to repository secrets and write permissions.',
  check: (doc: ParsedWorkflowDoc): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];

    if (!hasPullRequestTarget(doc.on)) {
      return findings;
    }

    for (const job of doc.jobs) {
      for (const step of job.steps) {
        if (!step.uses || !step.uses.includes('actions/checkout')) {
          continue;
        }

        const refVal = step.with?.ref;
        if (typeof refVal === 'string') {
          const isUntrustedRef =
            refVal.includes('github.event.pull_request.head.sha') ||
            refVal.includes('github.event.pull_request.head.ref') ||
            refVal.includes('github.head_ref');

          if (isUntrustedRef) {
            findings.push({
              ruleId: 'PL-SEC-006',
              title: 'Insecure pull_request_target Head Checkout',
              severity: 'critical',
              category: 'supply-chain',
              message: 'Workflow uses pull_request_target and explicitly checks out untrusted PR head branch code. This exposes repository secrets and tokens to arbitrary code execution from forks.',
              file: doc.filePath,
              line: step.location.line,
              column: step.location.column,
              snippet: step.rawYaml,
              suggestedFix: 'Switch trigger to "pull_request" or checkout default branch instead of untrusted PR head.',
              autoFixable: false,
            });
          }
        }
      }
    }

    return findings;
  },
};
