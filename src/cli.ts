#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { lintWorkflowFiles, lintWorkflowContent } from './linter/index.js';
import { exportToSarif } from './linter/sarif_exporter.js';
import { generateSafeFix } from './linter/fixer.js';
import { fetchWorkflowRunTelemetry, fetchRecentWorkflowRuns } from './api/github_client.js';
import { computeCriticalPath } from './analyzer/critical_path.js';
import { calculateRunCost } from './analyzer/cost_calculator.js';
import { auditCacheTelemetry } from './analyzer/cache_auditor.js';
import { expandMatrix } from './evaluator/matrix.js';
import { createServer } from './server/app.js';
import { SecurityFinding } from './types/index.js';
import { compareWorkflowRuns } from './analyzer/diff_engine.js';
import { exportDagToMermaid, exportDagToSvg } from './analyzer/dag_exporter.js';
import { generateStepSummary } from './reporter/step_summary.js';
import { generateSafeFixAsync } from './linter/fixer.js';
import { SAMPLE_WORKFLOW_RUN } from './api/sample_data.js';

const program = new Command();

program
  .name('pipelens')
  .description('GitHub Actions CI/CD bottleneck profiler, critical path DAG analyzer, supply-chain security linter, and local matrix simulator.')
  .version('1.0.0');

// AUDIT COMMAND
program
  .command('audit')
  .description('Scan workflow files for supply-chain security vulnerabilities, script injections, and unpinned actions.')
  .argument('[paths...]', 'Files or directories to audit (defaults to .github/workflows)', ['.github/workflows'])
  .option('--fail-on-sec', 'Exit with code 1 if critical or high severity findings are found', false)
  .option('--format <format>', 'Output format: table, json, sarif, or markdown', 'table')
  .option('-o, --output <file>', 'Write output to file')
  .action((paths: string[], options) => {
    console.log(chalk.bold.cyan('\n🔍 PipeLens Security & Supply-Chain Linter\n'));

    const findings = lintWorkflowFiles(paths);

    let outputText = '';

    if (options.format === 'json') {
      outputText = JSON.stringify(findings, null, 2);
    } else if (options.format === 'sarif') {
      outputText = exportToSarif(findings);
    } else if (options.format === 'markdown') {
      const lines = [
        '# PipeLens Security Audit Report',
        '',
        `Total findings: **${findings.length}**`,
        '',
        '| Rule | Severity | File | Line | Message |',
        '| --- | --- | --- | --- | --- |',
      ];
      for (const f of findings) {
        lines.push(`| \`${f.ruleId}\` | **${f.severity.toUpperCase()}** | \`${f.file}\` | ${f.line} | ${f.message} |`);
      }
      outputText = lines.join('\n');
    } else {
      // Table / terminal format
      if (findings.length === 0) {
        console.log(chalk.green('✓ All audited workflow files passed security inspection. Zero vulnerabilities found.\n'));
        return;
      }

      console.log(chalk.yellow(`Found ${findings.length} diagnostic finding(s):\n`));

      for (const f of findings) {
        const badge = f.severity === 'critical'
          ? chalk.bgRed.white.bold(' CRITICAL ')
          : f.severity === 'high'
          ? chalk.bgMagenta.white.bold(' HIGH ')
          : f.severity === 'medium'
          ? chalk.bgYellow.black.bold(' MEDIUM ')
          : chalk.bgBlue.white.bold(' LOW ');

        console.log(`${badge} ${chalk.bold(f.title)} ${chalk.dim(`(${f.ruleId})`)}`);
        console.log(`  ${chalk.dim('Location:')} ${f.file}:${f.line}:${f.column}`);
        console.log(`  ${chalk.dim('Issue:')}    ${f.message}`);
        if (f.suggestedFix) {
          console.log(`  ${chalk.green('Fix:')}      ${f.suggestedFix}`);
        }
        console.log();
      }
    }

    if (options.output) {
      fs.writeFileSync(options.output, outputText, 'utf8');
      console.log(chalk.green(`Report written to ${options.output}`));
    } else if (options.format !== 'table') {
      console.log(outputText);
    }

    const hasBlockers = findings.some(f => f.severity === 'critical' || f.severity === 'high');
    if (options.failOnSec && hasBlockers) {
      console.error(chalk.red.bold('✖ Gating failure: Critical or high severity findings detected (--fail-on-sec enforced).\n'));
      process.exit(1);
    }
  });

// PROFILE COMMAND
program
  .command('profile')
  .description('Profile historical workflow run telemetry to calculate critical path DAG, cache hit ratios, and runner costs.')
  .argument('[repo]', 'Target repository in format owner/repo (or "sample" for offline demo)', 'sample')
  .argument('[run-id]', 'Workflow run ID (or "latest")', 'latest')
  .option('--token <token>', 'GitHub Personal Access Token')
  .option('--max-duration <minutes>', 'Threshold in minutes to warn on excessive critical path length')
  .action(async (repo: string, runId: string, options) => {
    try {
      console.log(chalk.bold.cyan('\n⚡ PipeLens CI/CD Critical Path & Bottleneck Profiler\n'));
      console.log(chalk.dim(`Ingesting run telemetry for ${repo}...`));

      const [owner, repoName] = repo === 'sample' ? ['sample', 'sample'] : repo.split('/');
      const run = await fetchWorkflowRunTelemetry(owner, repoName, runId, options.token);

      const criticalPath = computeCriticalPath(run.jobs);
      const cost = calculateRunCost(run.jobs);
      const cache = auditCacheTelemetry(run.jobs);

      console.log(chalk.bold(`\nWorkflow: ${chalk.green(run.name)}`));
      console.log(`Run URL:   ${chalk.underline.blue(run.htmlUrl)}`);
      console.log(`Status:    ${run.status === 'completed' && run.conclusion === 'success' ? chalk.green('✓ Succeeded') : chalk.yellow(run.status)}`);
      console.log(`Duration:  ${Math.round(run.totalDurationMs / 1000)}s (Total wall-clock: ${(run.totalDurationMs / 60000).toFixed(1)}m)\n`);

      // Critical Path Display
      console.log(chalk.bold.magenta('🎯 Critical Path DAG:'));
      console.log(`  Path:     ${chalk.bold.yellow(criticalPath.criticalPath.join(' ➔ '))}`);
      console.log(`  Duration: ${chalk.bold((criticalPath.criticalPathDurationMs / 60000).toFixed(1))} minutes (${Math.round(criticalPath.criticalPathDurationMs / 1000)}s)`);
      console.log(`  Parallelization Gain: ${chalk.cyan((criticalPath.parallelizationGainMs / 60000).toFixed(1))} minutes saved vs serial execution\n`);

      // Cost & Billing
      console.log(chalk.bold.green('💰 Runner Billing & Resource Impact:'));
      console.log(`  Total Billable Minutes: ${chalk.bold(cost.totalBillableMinutes)} mins`);
      console.log(`  Estimated Cost:         ${chalk.bold(`$${cost.totalCostUsd.toFixed(4)}`)} USD`);
      console.log(`  Estimated Carbon:       ${cost.estimatedCo2Grams} g CO2eq`);
      console.log(`  Optimization Potential: ${chalk.bold.green(`$${cost.potentialSavingsUsd.toFixed(4)}`)} USD\n`);

      // Cache Audit
      console.log(chalk.bold.blue('📦 Cache Diagnostics:'));
      console.log(`  Hit Ratio:      ${Math.round(cache.hitRatio * 100)}% (${cache.cacheHits} hits / ${cache.totalCacheSteps} steps)`);
      if (cache.wastedDurationMs > 0) {
        console.log(`  Wasted Duration: ${chalk.red(Math.round(cache.wastedDurationMs / 1000) + 's')} from cache misses`);
      }
      console.log();

      // Bottlenecks
      if (criticalPath.bottlenecks.length > 0) {
        console.log(chalk.bold.red('⚠️ Bottlenecks & Optimization Advice:'));
        for (const b of criticalPath.bottlenecks) {
          console.log(`  • [${b.severity.toUpperCase()}] ${chalk.bold(b.jobName)}: ${b.reason}`);
          console.log(`    ${chalk.dim('Recommendation:')} ${b.recommendation}`);
        }
        console.log();
      }

      if (options.maxDuration) {
        const maxMins = parseFloat(options.maxDuration);
        const criticalMins = criticalPath.criticalPathDurationMs / 60000;
        if (criticalMins > maxMins) {
          console.error(chalk.red.bold(`✖ Duration Threshold Exceeded: Critical path (${criticalMins.toFixed(1)}m) > ${maxMins}m limit.\n`));
          process.exit(1);
        }
      }
    } catch (err: any) {
      console.error(chalk.red(`Error profiling workflow: ${err.message}`));
      process.exit(1);
    }
  });

// SIMULATE COMMAND
program
  .command('simulate')
  .description('Simulate workflow matrix expansion and calculate fan-out jobs locally.')
  .argument('<workflow-file>', 'Path to GitHub Actions workflow YAML')
  .action((workflowFile: string) => {
    try {
      console.log(chalk.bold.cyan(`\n🧪 PipeLens Matrix Simulator: ${workflowFile}\n`));
      if (!fs.existsSync(workflowFile)) {
        console.error(chalk.red(`File not found: ${workflowFile}`));
        process.exit(1);
      }

      const content = fs.readFileSync(workflowFile, 'utf8');
      const doc = YAML.parse(content);

      let foundMatrix = false;
      const jobs = doc.jobs || {};

      for (const [jobId, job] of Object.entries<any>(jobs)) {
        if (job.strategy && job.strategy.matrix) {
          foundMatrix = true;
          console.log(chalk.bold.yellow(`Job: ${job.name || jobId}`));
          const result = expandMatrix(job.strategy.matrix);

          console.log(`  Total Fan-out Jobs:   ${chalk.bold.green(result.totalJobs)}`);
          console.log(`  Dimensions:           ${result.dimensions.join(', ')}`);
          console.log(`  Est. Billable Mins:   ${result.totalEstimatedBillableMinutes} mins`);
          console.log(`  Est. Aggregate Cost:  $${result.totalEstimatedCostUsd.toFixed(4)} USD\n`);

          console.log('  Variations:');
          for (const v of result.variations) {
            console.log(`    • ${chalk.bold(v.name)} [${v.runnerOs}] ~${v.estimatedMinutes}m`);
          }
          console.log();
        }
      }

      if (!foundMatrix) {
        console.log(chalk.dim('No jobs with strategy.matrix found in this workflow.'));
      }
    } catch (err: any) {
      console.error(chalk.red(`Error simulating matrix: ${err.message}`));
      process.exit(1);
    }
  });

// FIX COMMAND
program
  .command('fix')
  .description('Automatically harden workflows by pinning commit SHAs and declaring least-privilege permissions.')
  .argument('[paths...]', 'Workflow files to fix', ['.github/workflows'])
  .option('--dry-run', 'Show diff without writing changes to disk', false)
  .action((paths: string[], options) => {
    console.log(chalk.bold.cyan('\n🛠️ PipeLens Automated Safe Hardening\n'));

    const filesToProcess: string[] = [];
    for (const p of paths) {
      if (!fs.existsSync(p)) continue;
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        const ymls = fs.readdirSync(p)
          .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
          .map(f => path.join(p, f));
        filesToProcess.push(...ymls);
      } else {
        filesToProcess.push(p);
      }
    }

    let fixedCount = 0;
    for (const file of filesToProcess) {
      const content = fs.readFileSync(file, 'utf8');
      const findings = lintWorkflowContent(content, file);
      const fix = generateSafeFix(content, file, findings);

      if (fix) {
        fixedCount++;
        console.log(chalk.bold.green(`✓ Fix generated for ${file}:`));
        console.log(chalk.dim(fix.diff));
        console.log();

        if (!options.dryRun) {
          fs.writeFileSync(file, fix.fixedYaml, 'utf8');
          console.log(chalk.green(`Applied changes to ${file}\n`));
        }
      }
    }

    if (fixedCount === 0) {
      console.log(chalk.green('All workflow files are already fully hardened. No changes required.\n'));
    } else if (options.dryRun) {
      console.log(chalk.yellow(`Dry-run mode: ${fixedCount} file(s) would be modified.\n`));
    }
  });

// DIFF COMMAND
program
  .command('diff')
  .description('Compare two workflow runs to detect duration regressions, step deltas, and cost changes.')
  .argument('[repo]', 'Target repository (or "sample" for demo comparison)', 'sample')
  .argument('[baseRunId]', 'Baseline workflow run ID', 'baseline')
  .argument('[targetRunId]', 'Target workflow run ID', 'target')
  .option('--token <token>', 'GitHub Personal Access Token')
  .action(async (repo: string, baseRunId: string, targetRunId: string, options) => {
    try {
      console.log(chalk.bold.cyan('\n📊 PipeLens Run-to-Run Regression & Diff Analyzer\n'));

      let baseRun: import('./types/index.js').WorkflowRunTelemetry = SAMPLE_WORKFLOW_RUN;
      let targetRun: import('./types/index.js').WorkflowRunTelemetry = {
        ...SAMPLE_WORKFLOW_RUN,
        id: 89410300,
        name: 'CI / Test & Build Suite #143 (PR #45)',
        totalDurationMs: 630000, // 10m 30s (slower regression demo)
        jobs: SAMPLE_WORKFLOW_RUN.jobs.map(j => ({
          ...j,
          durationMs: j.name === 'unit-tests' ? 330000 : j.durationMs,
        })),
      };

      if (repo !== 'sample' && repo !== 'demo') {
        const [owner, repoName] = repo.split('/');
        if (!owner || !repoName) {
          console.error(chalk.red('Invalid repository format. Expected "owner/repo"'));
          process.exit(1);
        }

        let effectiveBaseId = baseRunId;
        let effectiveTargetId = targetRunId;

        if (baseRunId === 'baseline' || targetRunId === 'target' || !baseRunId || !targetRunId) {
          const recents = await fetchRecentWorkflowRuns(owner, repoName, 2, options.token);
          if (recents.length < 2) {
            throw new Error(`Repository ${owner}/${repoName} requires at least 2 completed workflow runs to perform diff comparison.`);
          }
          effectiveTargetId = String(recents[0].id);
          effectiveBaseId = String(recents[1].id);
        }

        baseRun = await fetchWorkflowRunTelemetry(owner, repoName, effectiveBaseId, options.token);
        targetRun = await fetchWorkflowRunTelemetry(owner, repoName, effectiveTargetId, options.token);
      }

      const diff = compareWorkflowRuns(baseRun, targetRun);

      console.log(`Baseline Run: ${chalk.bold(diff.baselineName)} (${diff.baselineRunId})`);
      console.log(`Target Run:   ${chalk.bold(diff.targetName)} (${diff.targetRunId})\n`);

      const wallClockDeltaSec = Math.round(diff.wallClockDeltaMs / 1000);
      const isWallSlower = diff.wallClockDeltaMs > 0;
      const wallColor = isWallSlower ? chalk.red : chalk.green;
      console.log(`Wall-Clock Time:  ${wallColor((isWallSlower ? '+' : '') + wallClockDeltaSec + 's')} (${wallColor((isWallSlower ? '+' : '') + diff.wallClockDeltaPercent + '%')})`);

      const cpDeltaSec = Math.round(diff.criticalPathDeltaMs / 1000);
      const isCpSlower = diff.criticalPathDeltaMs > 0;
      const cpColor = isCpSlower ? chalk.red : chalk.green;
      console.log(`Critical Path:    ${cpColor((isCpSlower ? '+' : '') + cpDeltaSec + 's')}`);
      console.log(`Billable Minutes: ${diff.billableMinutesDelta > 0 ? chalk.red('+' + diff.billableMinutesDelta) : chalk.green(diff.billableMinutesDelta)} mins`);
      console.log(`Cost Delta:       ${diff.costDeltaUsd > 0 ? chalk.red('+$' + diff.costDeltaUsd.toFixed(4)) : chalk.green('-$' + Math.abs(diff.costDeltaUsd).toFixed(4))} USD\n`);

      // Job Deltas
      console.log(chalk.bold('Job Execution Breakdown:'));
      for (const j of diff.jobDeltas) {
        const sign = j.deltaMs > 0 ? '+' : '';
        const durDeltaSec = Math.round(j.deltaMs / 1000);
        const col = j.status === 'slower' ? chalk.red : j.status === 'faster' ? chalk.green : chalk.dim;
        console.log(`  • ${chalk.bold(j.name)}: ${col(sign + durDeltaSec + 's')} (${Math.round(j.targetDurationMs / 1000)}s total)`);
      }
      console.log();

      if (diff.regressions.length > 0) {
        console.log(chalk.bold.red('⚠️ Performance Regressions Detected:'));
        for (const r of diff.regressions) {
          console.log(`  • ${chalk.yellow(r)}`);
        }
        console.log();
      }

      if (diff.improvements.length > 0) {
        console.log(chalk.bold.green('✓ Performance Improvements:'));
        for (const imp of diff.improvements) {
          console.log(`  • ${chalk.green(imp)}`);
        }
        console.log();
      }
    } catch (err: any) {
      console.error(chalk.red(`Error comparing runs: ${err.message}`));
      process.exit(1);
    }
  });

// EXPORT-DAG COMMAND
program
  .command('export-dag')
  .description('Export workflow dependency DAG as Mermaid syntax or a standalone SVG vector diagram.')
  .argument('[target]', 'YAML workflow file or repository (defaults to sample)', 'sample')
  .option('-f, --format <format>', 'Export format: mermaid or svg', 'mermaid')
  .option('-o, --output <file>', 'Save output to file')
  .action(async (target: string, options) => {
    try {
      let jobs = SAMPLE_WORKFLOW_RUN.jobs;

      if (target.endsWith('.yml') || target.endsWith('.yaml')) {
        const content = fs.readFileSync(target, 'utf8');
        const doc = YAML.parse(content);
        const parsedJobs: any[] = [];
        for (const [id, j] of Object.entries<any>(doc.jobs || {})) {
          parsedJobs.push({
            id,
            name: j.name || id,
            status: 'completed',
            conclusion: 'success',
            startedAt: null,
            completedAt: null,
            durationMs: 60000,
            queueDurationMs: 0,
            runnerName: null,
            runnerOs: 'ubuntu',
            steps: [],
            needs: Array.isArray(j.needs) ? j.needs : j.needs ? [j.needs] : [],
          });
        }
        jobs = parsedJobs;
      } else if (target !== 'sample' && target.includes('/')) {
        const [owner, repo] = target.split('/');
        const run = await fetchWorkflowRunTelemetry(owner, repo);
        jobs = run.jobs;
      }

      const criticalPath = computeCriticalPath(jobs);
      const output = options.format.toLowerCase() === 'svg'
        ? exportDagToSvg(criticalPath)
        : exportDagToMermaid(criticalPath);

      if (options.output) {
        fs.writeFileSync(options.output, output, 'utf8');
        console.log(chalk.green(`Exported DAG diagram to ${options.output}`));
      } else {
        console.log(output);
      }
    } catch (err: any) {
      console.error(chalk.red(`Error exporting DAG: ${err.message}`));
      process.exit(1);
    }
  });

// SUMMARY COMMAND
program
  .command('summary')
  .description('Generate GitHub Step Summary markdown with metrics and embedded Mermaid diagram.')
  .argument('[repo]', 'Repository (or "sample")', 'sample')
  .argument('[run-id]', 'Workflow run ID', 'latest')
  .option('--token <token>', 'GitHub Personal Access Token')
  .option('-o, --output <file>', 'Write output to file (default stdout for $GITHUB_STEP_SUMMARY)')
  .action(async (repo: string, runId: string, options) => {
    try {
      let run = SAMPLE_WORKFLOW_RUN;
      if (repo !== 'sample' && repo.includes('/')) {
        const [owner, repoName] = repo.split('/');
        run = await fetchWorkflowRunTelemetry(owner, repoName, runId, options.token);
      }

      const criticalPath = computeCriticalPath(run.jobs);
      const cost = calculateRunCost(run.jobs);
      const cache = auditCacheTelemetry(run.jobs);
      const securityFindings = lintWorkflowFiles(['.github/workflows']);

      const summaryMarkdown = generateStepSummary({
        run,
        criticalPath,
        cost,
        cache,
        securityFindings,
      });

      if (options.output) {
        fs.writeFileSync(options.output, summaryMarkdown, 'utf8');
        console.log(chalk.green(`Summary written to ${options.output}`));
      } else {
        console.log(summaryMarkdown);
      }
    } catch (err: any) {
      console.error(chalk.red(`Error generating summary: ${err.message}`));
      process.exit(1);
    }
  });

// SERVE COMMAND
program
  .command('serve')
  .description('Launch the interactive PipeLens Web Studio and API server.')
  .option('-p, --port <number>', 'Port to listen on', '3840')
  .action((options) => {
    const port = parseInt(options.port, 10);
    const app = createServer();
    app.listen(port, () => {
      console.log(chalk.bold.cyan('\n🚀 PipeLens Web Studio is running!'));
      console.log(`Local Studio:  ${chalk.bold.green(`http://localhost:${port}`)}`);
      console.log(`API Health:    ${chalk.dim(`http://localhost:${port}/api/health`)}`);
      console.log(`REST Profile:  ${chalk.dim(`http://localhost:${port}/api/profile?repo=sample`)}\n`);
    });
  });

program.parse(process.argv);
