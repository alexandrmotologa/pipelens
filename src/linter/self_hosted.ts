import { LintRule, ParsedWorkflowDoc } from './types.js';
import { SecurityFinding } from '../types/index.js';

const PUBLIC_EXPOSURE_TRIGGERS = [
  'pull_request',
  'pull_request_target',
  'issues',
  'issue_comment',
  'discussion',
  'fork',
];

function isPubliclyTriggerable(on: any): boolean {
  if (!on) return false;
  if (typeof on === 'string') return PUBLIC_EXPOSURE_TRIGGERS.includes(on);
  if (Array.isArray(on)) return on.some(t => PUBLIC_EXPOSURE_TRIGGERS.includes(t));
  if (typeof on === 'object') {
    return Object.keys(on).some(k => PUBLIC_EXPOSURE_TRIGGERS.includes(k));
  }
  return false;
}

export const selfHostedRunnerRule: LintRule = {
  id: 'PL-SEC-007',
  title: 'Self-Hosted Runner on Pull Request Trigger',
  category: 'least-privilege',
  severity: 'high',
  description: 'Using self-hosted runners on workflows triggered by pull requests from forks allows external contributors to run arbitrary code on your internal network infrastructure.',
  check: (doc: ParsedWorkflowDoc): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];

    if (!isPubliclyTriggerable(doc.on)) {
      return findings;
    }

    for (const job of doc.jobs) {
      const runsOn = job.runsOn;
      let isSelfHosted = false;

      if (typeof runsOn === 'string' && runsOn.toLowerCase().includes('self-hosted')) {
        isSelfHosted = true;
      } else if (Array.isArray(runsOn) && runsOn.some(r => String(r).toLowerCase().includes('self-hosted'))) {
        isSelfHosted = true;
      }

      if (isSelfHosted) {
        findings.push({
          ruleId: 'PL-SEC-007',
          title: 'Dangerous Self-Hosted Runner on Public PR Trigger',
          severity: 'high',
          category: 'least-privilege',
          message: `Job "${job.name || job.id}" executes on a self-hosted runner while listening to external pull request events. This risks host compromise and lateral network movement.`,
          file: doc.filePath,
          line: job.location.line,
          column: job.location.column,
          snippet: `runs-on: ${JSON.stringify(runsOn)}`,
          suggestedFix: 'Switch to GitHub-hosted runners (e.g. ubuntu-latest) or gate execution behind an environment approval.',
          autoFixable: false,
        });
      }
    }

    return findings;
  },
};
