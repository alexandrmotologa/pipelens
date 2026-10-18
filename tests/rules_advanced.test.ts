import { describe, it, expect } from 'vitest';
import { lintWorkflowContent } from '../src/linter/index.js';

describe('Advanced Security Rules (PL-SEC-006 & PL-SEC-007)', () => {
  it('detects insecure pull_request_target checkout of untrusted PR head (PL-SEC-006)', () => {
    const yaml = `
name: PR Target Flow
on:
  pull_request_target:
    types: [opened]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - run: npm test
`;

    const findings = lintWorkflowContent(yaml, 'target.yml');
    expect(findings.some(f => f.ruleId === 'PL-SEC-006')).toBe(true);
    const finding = findings.find(f => f.ruleId === 'PL-SEC-006')!;
    expect(finding.severity).toBe('critical');
  });

  it('detects dangerous self-hosted runner on public PR triggers (PL-SEC-007)', () => {
    const yaml = `
name: Public PR
on: [pull_request]

jobs:
  test:
    runs-on: self-hosted
    steps:
      - run: echo "Running on internal cluster"
`;

    const findings = lintWorkflowContent(yaml, 'self_hosted.yml');
    expect(findings.some(f => f.ruleId === 'PL-SEC-007')).toBe(true);
    const finding = findings.find(f => f.ruleId === 'PL-SEC-007')!;
    expect(finding.severity).toBe('high');
  });
});
