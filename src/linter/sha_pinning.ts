import { LintRule, ParsedWorkflowDoc } from './types.js';
import { SecurityFinding } from '../types/index.js';

// 40-character hex SHA regex
const FULL_COMMIT_SHA_REGEX = /^[a-f0-9]{40}$/i;

// Curated verified commit SHAs for popular actions
export const KNOWN_ACTION_SHAS: Record<string, { sha: string; versionComment: string }> = {
  'actions/checkout@v4': { sha: '11bd71901bbe5b1630ceea73d27597364c9af683', versionComment: 'v4.2.2' },
  'actions/checkout@v3': { sha: 'f43a0e5ff2bd294095638e18286ca9a3d1956744', versionComment: 'v3.6.0' },
  'actions/setup-node@v4': { sha: '1e60f671b99f2d1a33847e47d9f72844d184853b', versionComment: 'v4.0.3' },
  'actions/setup-node@v3': { sha: 'e33196f7422957bea03ed53f6fbb155025ffc7b8', versionComment: 'v3.8.2' },
  'actions/setup-python@v5': { sha: '0a5c61591373683505ea898e09a3ea4f39ef2b9c', versionComment: 'v5.0.0' },
  'actions/setup-python@v4': { sha: '75f3110429a8c05be0e1bf360334e4cced2b63fa', versionComment: 'v4.7.1' },
  'actions/cache@v4': { sha: '0c45773b623bea8c8e75f6c82b208c3cf94ea4f9', versionComment: 'v4.0.2' },
  'actions/cache@v3': { sha: '88522ab9f39a2ea568f7027eddc7d8d8bc9d59c8', versionComment: 'v3.3.1' },
  'actions/upload-artifact@v4': { sha: '6f51ac03b9356f520e9adb1b1b78027ac8147571', versionComment: 'v4.5.0' },
  'actions/download-artifact@v4': { sha: 'fa0a91b85d4f404e444e00e005971372dc801d16', versionComment: 'v4.1.8' },
  'github/codeql-action/init@v3': { sha: '662472033e021d55d94146f66f6058822b0b39fd', versionComment: 'v3.27.0' },
  'docker/setup-buildx-action@v3': { sha: 'c47758b77c9736f4b2ef4073d4d51994fabfe349', versionComment: 'v3.7.1' },
  'docker/login-action@v3': { sha: '9780b0c442fbb1117ed29e0efdff1e18412f7567', versionComment: 'v3.3.0' },
};

export const shaPinningRule: LintRule = {
  id: 'PL-SEC-001',
  title: 'Unpinned Action Reference',
  category: 'supply-chain',
  severity: 'high',
  description: 'Actions referenced by mutable git tags or branches can be tampered with. Pin actions to an immutable full 40-character commit SHA.',
  check: (doc: ParsedWorkflowDoc): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];

    for (const job of doc.jobs) {
      for (const step of job.steps) {
        if (!step.uses) continue;

        // Ignore local and docker actions
        if (step.uses.startsWith('./') || step.uses.startsWith('../') || step.uses.startsWith('docker://')) {
          continue;
        }

        const atIndex = step.uses.lastIndexOf('@');
        if (atIndex === -1) {
          findings.push({
            ruleId: 'PL-SEC-001',
            title: 'Unversioned Action Reference',
            severity: 'critical',
            category: 'supply-chain',
            message: `Action "${step.uses}" has no version or SHA tag specified.`,
            file: doc.filePath,
            line: step.location.line,
            column: step.location.column,
            snippet: step.rawYaml,
            suggestedFix: `Pin to a verified commit SHA: ${step.uses}@<commit-sha>`,
            autoFixable: false,
          });
          continue;
        }

        const actionPath = step.uses.substring(0, atIndex);
        const ref = step.uses.substring(atIndex + 1);

        if (!FULL_COMMIT_SHA_REGEX.test(ref)) {
          const known = KNOWN_ACTION_SHAS[step.uses];
          const suggestedSha = known ? `${actionPath}@${known.sha} # ${known.versionComment}` : `${actionPath}@<commit-sha> # ${ref}`;

          findings.push({
            ruleId: 'PL-SEC-001',
            title: 'Unpinned Action Reference',
            severity: 'high',
            category: 'supply-chain',
            message: `Action "${actionPath}" is pinned to mutable ref "${ref}" instead of a 40-character commit SHA.`,
            file: doc.filePath,
            line: step.location.line,
            column: step.location.column,
            snippet: `uses: ${step.uses}`,
            suggestedFix: `uses: ${suggestedSha}`,
            autoFixable: true,
          });
        }
      }
    }

    return findings;
  },
};
