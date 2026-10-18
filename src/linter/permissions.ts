import { LintRule, ParsedWorkflowDoc } from './types.js';
import { SecurityFinding } from '../types/index.js';

export const permissionsRule: LintRule = {
  id: 'PL-SEC-003',
  title: 'Least Privilege Permissions Check',
  category: 'least-privilege',
  severity: 'medium',
  description: 'Workflows should declare explicit least-privilege permissions to minimize blast radius in the event of compromised actions.',
  check: (doc: ParsedWorkflowDoc): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];

    // Check top-level permissions
    if (doc.permissions === undefined) {
      // Check if all individual jobs define permissions
      const jobsWithoutPermissions = doc.jobs.filter(j => j.permissions === undefined);

      if (jobsWithoutPermissions.length > 0) {
        findings.push({
          ruleId: 'PL-SEC-003',
          title: 'Missing Explicit Permissions',
          severity: 'medium',
          category: 'least-privilege',
          message: 'Workflow does not declare top-level permissions and jobs omit explicit permission blocks.',
          file: doc.filePath,
          line: 1,
          column: 1,
          snippet: 'permissions: ...',
          suggestedFix: 'Add "permissions: contents: read" at workflow root or job level.',
          autoFixable: true,
        });
      }
    } else if (doc.permissions === 'write-all') {
      findings.push({
        ruleId: 'PL-SEC-004',
        title: 'Overly Permissive GITHUB_TOKEN (write-all)',
        severity: 'high',
        category: 'least-privilege',
        message: 'Top-level permissions is set to "write-all", granting full write permissions across all scopes.',
        file: doc.filePath,
        line: 1,
        column: 1,
        snippet: 'permissions: write-all',
        suggestedFix: 'Specify only the required granular scopes (e.g. contents: read, pull-requests: write).',
        autoFixable: false,
      });
    }

    // Check individual jobs for write-all
    for (const job of doc.jobs) {
      if (job.permissions === 'write-all') {
        findings.push({
          ruleId: 'PL-SEC-004',
          title: 'Job-level write-all Permissions',
          severity: 'high',
          category: 'least-privilege',
          message: `Job "${job.name || job.id}" sets permissions: write-all.`,
          file: doc.filePath,
          line: job.location.line,
          column: job.location.column,
          snippet: `permissions: write-all`,
          suggestedFix: 'Replace write-all with scoped permissions like contents: read.',
          autoFixable: false,
        });
      }
    }

    return findings;
  },
};
