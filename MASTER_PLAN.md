# PipeLens: Master Implementation Plan

> **GitHub Actions CI/CD Bottleneck Profiler, Matrix Simulator & Workflow Security Linter**
>
> Deep-dive observability and cost-reduction studio for GitHub Actions CI/CD pipelines. Analyzes historical workflow runs to pinpoint duration bottlenecks, computes topological critical path DAGs, detects cache invalidation leaks, scans for supply-chain security vulnerabilities, and evaluates matrix expressions locally before committing.

---

## 1. Project Overview & Architecture

Modern software teams rely heavily on GitHub Actions for Continuous Integration (CI) and Continuous Deployment (CD). However, development velocity and budgets are often impaired by:
1. **Prolonged PR feedback cycles**: Developers waiting 15 to 30 minutes for CI checks due to hidden sequential bottlenecks and unoptimized dependency installations.
2. **Cache misses and wasted billable minutes**: Incorrect cache keys in `actions/cache`, pnpm stores, Cargo caches, or Docker layers resulting in redundant compiles and wasted billable runner minutes.
3. **Supply-chain security risks**: Workflows using mutable git tags (such as `uses: actions/checkout@v4` instead of pinned commit SHAs) or introducing script injection sinks through unescaped context expressions (`run: echo "${{ github.event.issue.title }}"`).
4. **Tedious expression debugging**: Guessing how complex GitHub Actions expressions (`fromJSON()`, matrix combinations, ternary conditions) evaluate by pushing commits and waiting for CI to fail.

**PipeLens** provides a complete observability, linting, and local evaluation studio:
- **Historical CI Gantt Waterfall**: Pulls telemetry from the GitHub Actions REST API to render job and step execution waterfalls, automatically identifying the critical path.
- **Critical Path DAG Engine**: Calculates early/late schedules, float slack, and highlights parallelization opportunities for independent serial jobs.
- **Cache Hit and Bottleneck Analyzer**: Audits build logs to compute cache hit ratios and calculates exact dollar and minute savings from caching optimizations.
- **Supply-Chain Security Linter**: Scans `.github/workflows/*.yml` for unpinned actions, script injection sinks, wildcard `GITHUB_TOKEN` permissions (`permissions: write-all`), and token leaks.
- **Automated Safe YAML Fixer**: Rewrites workflow files to replace mutable action tags with immutable commit SHAs and least-privilege permission blocks.
- **Local Matrix and Expression Evaluator**: Simulates workflow matrix expansion and context variable resolution locally without deploying runners.
- **Interactive Web Studio and CLI**: Provides both a rich visual dashboard and an automated CI check (`pipelens audit --fail-on-sec`).

```
+-----------------------------------------------------------------------------------+
|                                     PIPELENS                                      |
+-----------------------------------------+-----------------------------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                                                   |
+-------v-------------------------+                 +-----------------------v-------+
|    GitHub Telemetry Ingestion   |                 |    Workflow Security Linter   |
|  * Workflow Run History & Steps |                 |  * Commit SHA Pinning Auditor |
|  * Queue Wait Times             |                 |  * Script Injection Detector  |
|  * Runner OS & Matrix Metrics   |                 |  * Minimal Permissions Check  |
+-------+-------------------------+                 +-----------------------+-------+
        |                                                                   |
        +---------------------------------+---------------------------------+
                                          |
                        +-----------------v-----------------+
                        |   Critical Path & Cache Engine    |
                        |  * Critical Path DAG Computation  |
                        |  * Cache Hit vs Miss Diagnostics  |
                        |  * Parallelization Recommendations|
                        |  * Billable Cost & CO2 Estimation |
                        +-----------------+-----------------+
                                          |
                        +-----------------v-----------------+
                        |   Local Expression & Matrix Sim   |
                        |  * Context Resolution (github.*)  |
                        |  * Matrix Fan-Out Calculation     |
                        |  * fromJSON() & Built-in Parser   |
                        +-----------------+-----------------+
                                          |
                        +-----------------v-----------------+
                        |   Interactive Web Studio & CLI    |
                        |  * Gantt Timeline Waterfall       |
                        |  * DAG Dependency Visualizer      |
                        |  * 1-Click Secure YAML Diff & Fix |
                        |  * CI Gating & SARIF / PR Report  |
                        +-----------------------------------+
```

---

## 2. Directory Structure

```
pipelens/
├── bin/
│   └── pipelens.js               # CLI executable shim
├── src/
│   ├── api/
│   │   ├── github_client.ts      # Octokit wrapper for workflow runs, jobs, logs
│   │   ├── cache_telemetry.ts    # Cache hit/miss log telemetry parser
│   │   └── sample_data.ts        # Built-in real-world telemetry fixtures for offline mode
│   ├── analyzer/
│   │   ├── critical_path.ts      # DAG builder and topological critical path solver
│   │   ├── cache_auditor.ts      # Cache miss and invalidation cost analyzer
│   │   └── cost_calculator.ts    # GitHub Actions billing formula and CO2 calculator
│   ├── linter/
│   │   ├── types.ts              # Diagnostic rules and finding interfaces
│   │   ├── ast_parser.ts         # YAML parser with CST and node mapping
│   │   ├── sha_pinning.ts        # Mutable tag vs 40-char SHA auditor
│   │   ├── script_injection.ts   # Context expression sanitization scanner
│   │   ├── permissions.ts        # GITHUB_TOKEN least-privilege checker
│   │   ├── secret_leak.ts        # Hardcoded credentials and insecure secrets scanner
│   │   ├── sarif_exporter.ts     # SARIF v2.1.0 output generator
│   │   └── fixer.ts              # Automated YAML safe patch generator
│   ├── evaluator/
│   │   ├── context.ts            # Mock context builder (github, env, inputs, vars)
│   │   ├── expression.ts         # GitHub Actions expression tokenizer and AST evaluator
│   │   └── matrix.ts             # Combinatorial matrix expansion with include/exclude
│   ├── server/
│   │   ├── app.ts                # Express API server for web studio
│   │   └── routes.ts             # Endpoints for profile, lint, simulate, fix
│   ├── types/
│   │   └── index.ts              # Shared domain models
│   ├── cli.ts                    # Commander CLI entry point (audit, profile, sim, serve, fix)
│   └── index.ts                  # Public library exports
├── web/
│   ├── index.html                # Single page app entry
│   ├── package.json              # Web UI dependencies (React 19, Chart.js, Tailwind)
│   ├── vite.config.ts            # Vite bundler configuration
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx            # Navigation and repository selector
│   │   │   ├── GanttWaterfall.tsx    # Interactive Gantt chart of jobs and steps
│   │   │   ├── DagVisualizer.tsx     # SVG dependency graph with critical path highlight
│   │   │   ├── CriticalPathBadge.tsx # Bottleneck summary and parallelization advice
│   │   │   ├── SecurityAuditList.tsx # Categorized vulnerabilities with 1-click diff fix
│   │   │   ├── MatrixPreview.tsx     # Simulated matrix execution table
│   │   │   ├── CostMetricsCard.tsx   # Billable minutes and savings breakdown
│   │   │   └── YamlDiffViewer.tsx    # Secure patch preview modal
│   │   ├── hooks/
│   │   │   └── useWorkflowData.ts    # API communication hook
│   │   ├── App.tsx                   # Main studio view
│   │   └── main.tsx                  # React 19 root
├── examples/
│   ├── workflows/
│   │   ├── secure_ci.yml         # Compliant reference workflow
│   │   ├── insecure_ci.yml       # Test workflow with intentional security flaws
│   │   └── matrix_build.yml      # Complex matrix with include/exclude
│   └── fixtures/
│       └── sample_run.json       # Real GitHub Actions run telemetry export
├── tests/
│   ├── critical_path.test.ts     # DAG and critical path unit tests
│   ├── linter.test.ts            # Security rules and AST tests
│   ├── expression.test.ts        # Expression evaluation unit tests
│   ├── matrix.test.ts            # Matrix expansion tests
│   └── cost_calculator.test.ts   # Billing calculations tests
├── docs/
│   ├── ARCHITECTURE.md           # Engineering deep-dive
│   ├── RULES.md                  # Security linter specifications
│   └── images/                   # UI screenshots and animated demo GIF
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Implementation Roadmap & Task Breakdown

### Task 1: Repository Foundation & Core Types
- Initialize root `package.json`, TypeScript configuration (`tsconfig.json`), ESLint, and test runner.
- Install production dependencies:
  - `@octokit/rest`: GitHub API client
  - `yaml`: YAML parser and CST manipulation
  - `commander`: CLI command handling
  - `chalk`: Terminal coloring and diagnostics
  - `express`: Local web studio backend
  - `cors`: Cross-origin request support
- Define shared interfaces in `src/types/index.ts`:
  - `WorkflowRun`, `Job`, `Step`, `QueueMetrics`
  - `DagNode`, `DagEdge`, `CriticalPathResult`
  - `SecurityFinding`, `RuleSeverity`, `YamlFix`
  - `MatrixConfig`, `MatrixVariation`, `ContextState`
  - `CostEstimate`, `RunnerTier`

### Task 2: Critical Path DAG Engine & Cache Cost Analyzer
- Implement `src/analyzer/critical_path.ts`:
  - Build adjacency list from job `needs:` dependencies.
  - Compute topological sorting.
  - Calculate early start, early finish, late start, late finish, and slack (float) time.
  - Trace critical path (jobs where `slack === 0`).
  - Detect parallelization opportunities: identify sequential chains that lack explicit dependencies.
  - Calculate wall-clock reduction potential.
- Implement `src/analyzer/cost_calculator.ts`:
  - Implement GitHub Actions pricing model:
    - Linux standard: $0.008 / min
    - Windows standard: $0.016 / min
    - macOS standard: $0.064 / min
  - Per-job rounding up to the nearest billable minute.
  - Estimate carbon footprint based on runner duration.
- Implement `src/analyzer/cache_auditor.ts`:
  - Parse build logs for cache action inputs, cache hits, cache misses, and cache save steps.
  - Compute hit ratio and wasted runner minutes on cache re-downloads.

### Task 3: Supply-Chain Security & Permission Linter
- Implement AST-based YAML analysis in `src/linter/`:
  - `ast_parser.ts`: Parse workflow YAML, extract jobs, steps, environment blocks, and permissions with line and column numbers.
  - `sha_pinning.ts`: Detect unpinned action tags (`uses: actions/checkout@v4`). Require full 40-hex commit SHA with descriptive comment (`uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`).
  - `script_injection.ts`: Scan inline `run:` scripts for unescaped context interpolations (`github.event.issue.title`, `github.head_ref`, etc.). Recommend safe environment variables.
  - `permissions.ts`: Detect missing top-level and job-level permissions, flag `permissions: write-all`, and suggest minimal read-only permissions.
  - `secret_leak.ts`: Check for raw secrets or plaintext tokens in environment variables or command arguments.
  - `sarif_exporter.ts`: Convert diagnostic findings into standardized SARIF v2.1.0 format.
  - `fixer.ts`: Automated safe patch generator that outputs unified diffs and can apply fixes directly to workflow files.

### Task 4: Local Matrix & Expression Evaluator
- Implement `src/evaluator/expression.ts`:
  - Custom recursive descent parser and evaluator for GitHub Actions expression syntax `${{ ... }}`.
  - Support property navigation (`github.event.pull_request.head.sha`), index access (`matrix.target[0]`).
  - Support boolean, numeric, and string literals.
  - Support operators: `!`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`.
  - Implement standard functions:
    - `contains(search, item)`
    - `startsWith(searchString, searchValue)`
    - `endsWith(searchString, searchValue)`
    - `format(string, ...args)`
    - `join(array, separator)`
    - `toJSON(value)`
    - `fromJSON(value)`
    - `always()`, `success()`, `failure()`, `cancelled()`
- Implement `src/evaluator/matrix.ts`:
  - Generate Cartesian product of arbitrary dimensions.
  - Apply `include:` rules (merging extra variables or appending novel combinations).
  - Apply `exclude:` rules (filtering out forbidden combinations).
  - Calculate total matrix job count and estimated aggregate cost.

### Task 5: GitHub API Client & Offline Telemetry Ingestion
- Implement `src/api/github_client.ts`:
  - Authenticated and unauthenticated workflow run queries via `@octokit/rest`.
  - Fetch job timings, step execution states, and runner specifications.
  - Ingest raw workflow run files locally for offline profiling without network access.
  - Provide realistic sample telemetry in `src/api/sample_data.ts` for immediate demonstration.

### Task 6: Web Studio (React 19 + Chart.js + Tailwind)
- Scaffold modern React 19 web application in `web/`:
  - Setup Vite, Tailwind CSS, Heroicons, and Chart.js.
  - Implement `GanttWaterfall.tsx`: Visual timeline chart mapping jobs and steps, queue latency, and status.
  - Implement `DagVisualizer.tsx`: Interactive SVG rendering of the workflow DAG with color-coded critical path and dependency edges.
  - Implement `SecurityAuditList.tsx`: Interactive findings list with severity filters and unified diff viewer modal.
  - Implement `MatrixPreview.tsx`: Interactive matrix calculator showing fan-out configurations and estimated billable minutes.
  - Implement `CostMetricsCard.tsx`: Metric cards showing total wall-clock time, billable minutes, dollar cost, and carbon estimate.

### Task 7: Local Server & CLI Commands
- Implement `src/server/app.ts`:
  - Express API serving static web assets and REST endpoints (`/api/profile`, `/api/lint`, `/api/simulate`, `/api/fix`).
- Implement CLI in `src/cli.ts`:
  - `pipelens audit [path]`: Lint workflows with options `--fail-on-sec`, `--format json|sarif|text|markdown`.
  - `pipelens profile <owner/repo> [run-id]`: Fetch and analyze historical runs, print critical path, Gantt timeline, and cost savings in terminal.
  - `pipelens simulate <workflow.yml>`: Simulate matrix combinations and context expressions locally.
  - `pipelens fix [path]`: Automatically rewrite workflows with pinned SHAs and least privilege permissions.
  - `pipelens serve [--port 3840]`: Launch web studio.

### Task 8: Test Suite & Verification
- Unit and integration tests covering:
  - Critical path calculation with multi-branch DAGs.
  - Security linter rules (positive and negative test cases).
  - Expression evaluator functions and operator precedence.
  - Matrix Cartesian generation with complex includes and excludes.
  - Billing calculation accuracy.
- End-to-end CLI runs verifying exit codes and output formatting.

### Task 9: Visual Assets & Documentation (Humanizer Compliant)
- Generate real screenshots of CLI output, Gantt waterfall, DAG visualizer, and security audit.
- Create animated demo GIF in `docs/images/pipelens_demo.gif`.
- Write factual, humanized documentation:
  - `README.md` with features, installation, quickstart, CLI options, architecture, and visual assets.
  - `docs/ARCHITECTURE.md` with DAG topological algorithms and expression evaluator specification.
  - `docs/RULES.md` with detailed supply-chain security guidelines.
- Execute Phase 2 of MTLG Portfolio Sync (status LIVE, demoUrl, screenshots, broadcast).
