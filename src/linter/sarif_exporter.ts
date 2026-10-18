import { SecurityFinding } from '../types/index.js';

/**
 * Converts PipeLens security findings into standard SARIF v2.1.0 JSON.
 */
export function exportToSarif(findings: SecurityFinding[]): string {
  const sarifLog = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'PipeLens',
            version: '1.0.0',
            informationUri: 'https://github.com/alexandrmotologa/pipelens',
            rules: [
              {
                id: 'PL-SEC-001',
                name: 'UnpinnedActionReference',
                shortDescription: { text: 'Pin actions to immutable commit SHAs' },
                defaultConfiguration: { level: 'error' },
              },
              {
                id: 'PL-SEC-002',
                name: 'ScriptInjectionVulnerability',
                shortDescription: { text: 'Untrusted context interpolation in run script' },
                defaultConfiguration: { level: 'error' },
              },
              {
                id: 'PL-SEC-003',
                name: 'MissingExplicitPermissions',
                shortDescription: { text: 'Missing explicit least-privilege permissions' },
                defaultConfiguration: { level: 'warning' },
              },
              {
                id: 'PL-SEC-004',
                name: 'WriteAllPermissions',
                shortDescription: { text: 'Overly permissive write-all permissions' },
                defaultConfiguration: { level: 'error' },
              },
              {
                id: 'PL-SEC-005',
                name: 'HardcodedSecretLeak',
                shortDescription: { text: 'Hardcoded secret or credential token' },
                defaultConfiguration: { level: 'error' },
              },
            ],
          },
        },
        results: findings.map(f => {
          const levelMap: Record<string, string> = {
            critical: 'error',
            high: 'error',
            medium: 'warning',
            low: 'note',
            info: 'note',
          };

          return {
            ruleId: f.ruleId,
            level: levelMap[f.severity] || 'warning',
            message: {
              text: f.message,
            },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: {
                    uri: f.file.replace(/\\/g, '/'),
                  },
                  region: {
                    startLine: f.line,
                    startColumn: f.column,
                  },
                },
              },
            ],
          };
        }),
      },
    ],
  };

  return JSON.stringify(sarifLog, null, 2);
}
