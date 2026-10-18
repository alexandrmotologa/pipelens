import { describe, it, expect } from 'vitest';
import { lintWorkflowContent, generateSafeFix, exportToSarif } from '../src/linter/index.js';

describe('Workflow Security Linter', () => {
  it('flags unpinned action tags (PL-SEC-001)', () => {
    const yaml = `
name: Test
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`;
    const findings = lintWorkflowContent(yaml, '.github/workflows/test.yml');
    expect(findings.some(f => f.ruleId === 'PL-SEC-001')).toBe(true);
    const finding = findings.find(f => f.ruleId === 'PL-SEC-001')!;
    expect(finding.severity).toBe('high');
    expect(finding.suggestedFix).toContain('actions/checkout@');
  });

  it('detects script injection risks in run: blocks (PL-SEC-002)', () => {
    const yaml = `
name: PR Test
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Title: \${{ github.event.issue.title }}"
`;
    const findings = lintWorkflowContent(yaml, '.github/workflows/pr.yml');
    expect(findings.some(f => f.ruleId === 'PL-SEC-002')).toBe(true);
    const finding = findings.find(f => f.ruleId === 'PL-SEC-002')!;
    expect(finding.severity).toBe('critical');
  });

  it('detects missing permissions (PL-SEC-003) and write-all permissions (PL-SEC-004)', () => {
    const missingPermsYaml = `
name: No Perms
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`;
    const findings1 = lintWorkflowContent(missingPermsYaml, 'missing.yml');
    expect(findings1.some(f => f.ruleId === 'PL-SEC-003')).toBe(true);

    const writeAllYaml = `
name: Write All
permissions: write-all
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`;
    const findings2 = lintWorkflowContent(writeAllYaml, 'write_all.yml');
    expect(findings2.some(f => f.ruleId === 'PL-SEC-004')).toBe(true);
  });

  it('generates safe automated fix for unpinned actions and missing permissions', () => {
    const unpinnedYaml = `name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`;
    const findings = lintWorkflowContent(unpinnedYaml, 'ci.yml');
    const fix = generateSafeFix(unpinnedYaml, 'ci.yml', findings);

    expect(fix).not.toBeNull();
    expect(fix?.fixedYaml).toContain('actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683');
    expect(fix?.fixedYaml).toContain('permissions:');
    expect(fix?.diff).toContain('+++ b/ci.yml');
  });

  it('exports findings in valid SARIF format', () => {
    const yaml = `
name: Insecure
permissions: write-all
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`;
    const findings = lintWorkflowContent(yaml, 'insecure.yml');
    const sarifJson = exportToSarif(findings);
    const parsed = JSON.parse(sarifJson);

    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs[0].results.length).toBeGreaterThanOrEqual(2);
  });
});
