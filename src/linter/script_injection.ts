import { LintRule, ParsedWorkflowDoc } from './types.js';
import { SecurityFinding } from '../types/index.js';

// Untrusted context fields that can be influenced by external actors
const UNTRUSTED_CONTEXT_PATTERNS = [
  /github\.event\.issue\.title/i,
  /github\.event\.issue\.body/i,
  /github\.event\.pull_request\.title/i,
  /github\.event\.pull_request\.body/i,
  /github\.event\.comment\.body/i,
  /github\.event\.review\.body/i,
  /github\.event\.review_comment\.body/i,
  /github\.event\.discussion\.title/i,
  /github\.event\.discussion\.body/i,
  /github\.event\.pages.*\.page_name/i,
  /github\.head_ref/i,
  /github\.event\.head_commit\.message/i,
  /github\.event\.head_commit\.author\.name/i,
  /github\.event\.head_commit\.author\.email/i,
  /github\.event\.commits.*\.message/i,
];

// Matches any ${{ ... }} block inside run:
const EXPRESSION_REGEX = /\$\{\{\s*([^}]+?)\s*\}\}/g;

export const scriptInjectionRule: LintRule = {
  id: 'PL-SEC-002',
  title: 'Potential Script Injection Vulnerability',
  category: 'script-injection',
  severity: 'critical',
  description: 'Direct interpolation of untrusted GitHub event contexts into inline run: scripts enables arbitrary code execution.',
  check: (doc: ParsedWorkflowDoc): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];

    for (const job of doc.jobs) {
      for (const step of job.steps) {
        if (!step.run) continue;

        let match: RegExpExecArray | null;
        EXPRESSION_REGEX.lastIndex = 0;

        while ((match = EXPRESSION_REGEX.exec(step.run)) !== null) {
          const expression = match[1];

          for (const pattern of UNTRUSTED_CONTEXT_PATTERNS) {
            if (pattern.test(expression)) {
              const varName = expression
                .replace(/github\.(event\.)?/i, '')
                .replace(/[^a-zA-Z0-9_]/g, '_')
                .toUpperCase();

              findings.push({
                ruleId: 'PL-SEC-002',
                title: 'Potential Script Injection Vulnerability',
                severity: 'critical',
                category: 'script-injection',
                message: `Context expression "${expression.trim()}" is directly evaluated inside an inline run script.`,
                file: doc.filePath,
                line: step.location.line,
                column: step.location.column,
                snippet: `run: ${step.run.length > 80 ? step.run.substring(0, 77) + '...' : step.run}`,
                suggestedFix: `Pass via env: ${varName}: \${{ ${expression.trim()} }} and reference "\$${varName}" in the shell script.`,
                autoFixable: false,
              });
              break;
            }
          }
        }
      }
    }

    return findings;
  },
};
