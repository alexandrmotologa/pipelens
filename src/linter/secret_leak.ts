import { LintRule, ParsedWorkflowDoc } from './types.js';
import { SecurityFinding } from '../types/index.js';

const SECRET_PATTERNS = [
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Personal Access Token (classic)' },
  { pattern: /github_pat_[a-zA-Z0-9_]{82}/, name: 'GitHub Fine-Grained Token' },
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key ID' },
  { pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/, name: 'Slack API Token' },
  { pattern: /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH|PGP)?\s*PRIVATE\s+KEY-----/, name: 'Private Key Block' },
  { pattern: /(?:api[_-]?key|secret[_-]?token|auth[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i, name: 'Hardcoded API Token' },
];

export const secretLeakRule: LintRule = {
  id: 'PL-SEC-005',
  title: 'Hardcoded Secret or Token Leak',
  category: 'secrets',
  severity: 'critical',
  description: 'Hardcoded credentials, API keys, or tokens in workflow files are visible in repository history and can be compromised.',
  check: (doc: ParsedWorkflowDoc): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const lines = doc.rawContent.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];

      // Ignore lines that reference secrets context e.g. ${{ secrets.XYZ }}
      if (lineText.includes('secrets.') || lineText.includes('github.token')) {
        continue;
      }

      for (const { pattern, name } of SECRET_PATTERNS) {
        if (pattern.test(lineText)) {
          findings.push({
            ruleId: 'PL-SEC-005',
            title: `Hardcoded ${name}`,
            severity: 'critical',
            category: 'secrets',
            message: `Detected potential ${name} in workflow file. Use GitHub Secrets instead (\${{ secrets.SECRET_NAME }}).`,
            file: doc.filePath,
            line: i + 1,
            column: 1,
            snippet: lineText.trim(),
            suggestedFix: 'Store the secret in GitHub Actions Secrets and reference via ${{ secrets.SECRET_NAME }}.',
            autoFixable: false,
          });
          break;
        }
      }
    }

    return findings;
  },
};
