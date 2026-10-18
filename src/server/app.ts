import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fetchWorkflowRunTelemetry } from '../api/github_client.js';
import { computeCriticalPath } from '../analyzer/critical_path.js';
import { calculateRunCost } from '../analyzer/cost_calculator.js';
import { auditCacheTelemetry } from '../analyzer/cache_auditor.js';
import { lintWorkflowContent } from '../linter/index.js';
import { generateSafeFix } from '../linter/fixer.js';
import { exportToSarif } from '../linter/sarif_exporter.js';
import { evaluateExpression, interpolateString } from '../evaluator/expression.js';
import { createDefaultContext } from '../evaluator/context.js';
import { expandMatrix } from '../evaluator/matrix.js';
import { SAMPLE_WORKFLOW_RUN } from '../api/sample_data.js';
import { compareWorkflowRuns } from '../analyzer/diff_engine.js';
import { exportDagToMermaid, exportDagToSvg } from '../analyzer/dag_exporter.js';
import { generateStepSummary } from '../reporter/step_summary.js';
import { generateSafeFixAsync } from '../linter/fixer.js';

export function createServer(staticDir?: string) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'pipelens', version: '1.0.0' });
  });

  // Profile a workflow run
  app.get('/api/profile', async (req: Request, res: Response): Promise<void> => {
    try {
      const repo = String(req.query.repo || 'sample');
      const runId = req.query.runId ? String(req.query.runId) : undefined;
      const token = req.query.token ? String(req.query.token) : undefined;

      let runTelemetry;
      if (repo === 'sample' || repo === 'demo') {
        runTelemetry = SAMPLE_WORKFLOW_RUN;
      } else {
        const [owner, repoName] = repo.split('/');
        if (!owner || !repoName) {
          res.status(400).json({ error: 'Invalid repository format. Expected "owner/repo"' });
          return;
        }
        runTelemetry = await fetchWorkflowRunTelemetry(owner, repoName, runId, token);
      }

      const criticalPath = computeCriticalPath(runTelemetry.jobs);
      const cost = calculateRunCost(runTelemetry.jobs);
      const cache = auditCacheTelemetry(runTelemetry.jobs);

      res.json({
        run: runTelemetry,
        criticalPath,
        cost,
        cache,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error during profiling' });
    }
  });

  // Lint workflow YAML
  app.post('/api/lint', (req: Request, res: Response): void => {
    try {
      const { yaml, filePath = '.github/workflows/workflow.yml' } = req.body;
      if (!yaml) {
        res.status(400).json({ error: 'Missing "yaml" field in request body' });
        return;
      }

      const findings = lintWorkflowContent(yaml, filePath);
      const sarif = exportToSarif(findings);

      res.json({
        findings,
        totalFindings: findings.length,
        criticalCount: findings.filter(f => f.severity === 'critical').length,
        highCount: findings.filter(f => f.severity === 'high').length,
        mediumCount: findings.filter(f => f.severity === 'medium').length,
        sarif: JSON.parse(sarif),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to lint workflow YAML' });
    }
  });

  // Generate automated safe fix (with dynamic SHA resolution)
  app.post('/api/fix', async (req: Request, res: Response): Promise<void> => {
    try {
      const { yaml, filePath = '.github/workflows/workflow.yml', token } = req.body;
      if (!yaml) {
        res.status(400).json({ error: 'Missing "yaml" field in request body' });
        return;
      }

      const findings = lintWorkflowContent(yaml, filePath);
      const fix = await generateSafeFixAsync(yaml, filePath, findings, token);

      res.json({ fix, findingsCount: findings.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate safe fix' });
    }
  });

  // Run-to-Run Diff comparison
  app.get('/api/diff', async (req: Request, res: Response): Promise<void> => {
    try {
      const repo = String(req.query.repo || 'sample');
      const baseRunId = req.query.base ? String(req.query.base) : undefined;
      const targetRunId = req.query.target ? String(req.query.target) : undefined;
      const token = req.query.token ? String(req.query.token) : undefined;

      let baseRun = SAMPLE_WORKFLOW_RUN;
      let targetRun = SAMPLE_WORKFLOW_RUN;

      if (repo !== 'sample' && repo !== 'demo') {
        const [owner, repoName] = repo.split('/');
        if (owner && repoName) {
          if (baseRunId) {
            baseRun = await fetchWorkflowRunTelemetry(owner, repoName, baseRunId, token);
          }
          if (targetRunId) {
            targetRun = await fetchWorkflowRunTelemetry(owner, repoName, targetRunId, token);
          }
        }
      } else {
        // Synthesize an optimized target run for demo comparison
        targetRun = {
          ...SAMPLE_WORKFLOW_RUN,
          id: 89410300,
          name: 'CI / Test & Build Suite #143 (Optimized)',
          totalDurationMs: 380000, // 6m 20s (faster!)
          jobs: SAMPLE_WORKFLOW_RUN.jobs.map(j => ({
            ...j,
            durationMs: j.name === 'unit-tests' ? 140000 : j.durationMs, // cache hit!
            steps: j.steps.map(s => s.name.includes('Restore npm cache') ? { ...s, durationMs: 3000, conclusion: 'success' } : s),
          })),
        };
      }

      const comparison = compareWorkflowRuns(baseRun, targetRun);
      res.json(comparison);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to compare runs' });
    }
  });

  // Export DAG as Mermaid or SVG
  app.get('/api/export-dag', async (req: Request, res: Response): Promise<void> => {
    try {
      const repo = String(req.query.repo || 'sample');
      const format = String(req.query.format || 'mermaid').toLowerCase();
      const runId = req.query.runId ? String(req.query.runId) : undefined;
      const token = req.query.token ? String(req.query.token) : undefined;

      let run = SAMPLE_WORKFLOW_RUN;
      if (repo !== 'sample' && repo !== 'demo') {
        const [owner, repoName] = repo.split('/');
        if (owner && repoName) {
          run = await fetchWorkflowRunTelemetry(owner, repoName, runId, token);
        }
      }

      const criticalPath = computeCriticalPath(run.jobs);

      if (format === 'svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(exportDagToSvg(criticalPath));
      } else {
        res.setHeader('Content-Type', 'text/plain');
        res.send(exportDagToMermaid(criticalPath));
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to export DAG' });
    }
  });

  // Step Summary Markdown
  app.get('/api/summary', async (req: Request, res: Response): Promise<void> => {
    try {
      const repo = String(req.query.repo || 'sample');
      const runId = req.query.runId ? String(req.query.runId) : undefined;
      const token = req.query.token ? String(req.query.token) : undefined;

      let run = SAMPLE_WORKFLOW_RUN;
      if (repo !== 'sample' && repo !== 'demo') {
        const [owner, repoName] = repo.split('/');
        if (owner && repoName) {
          run = await fetchWorkflowRunTelemetry(owner, repoName, runId, token);
        }
      }

      const criticalPath = computeCriticalPath(run.jobs);
      const cost = calculateRunCost(run.jobs);
      const cache = auditCacheTelemetry(run.jobs);
      const securityFindings = lintWorkflowContent(
        fs.existsSync('examples/workflows/secure_ci.yml')
          ? fs.readFileSync('examples/workflows/secure_ci.yml', 'utf8')
          : 'name: CI\njobs: {}'
      );

      const markdown = generateStepSummary({
        run,
        criticalPath,
        cost,
        cache,
        securityFindings,
      });

      res.setHeader('Content-Type', 'text/markdown');
      res.send(markdown);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate step summary' });
    }
  });

  // Simulate matrix expansion or evaluate expressions
  app.post('/api/simulate', (req: Request, res: Response): void => {
    try {
      const { matrix, expression, template, context = {}, baseDurationMinutes = 5 } = req.body;
      const evalContext = createDefaultContext(context);

      const response: Record<string, any> = {};

      if (matrix) {
        response.matrix = expandMatrix(matrix, baseDurationMinutes);
      }

      if (expression) {
        response.expressionResult = evaluateExpression(expression, evalContext);
      }

      if (template) {
        response.interpolatedTemplate = interpolateString(template, evalContext);
      }

      res.json(response);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to evaluate simulation' });
    }
  });

  // Static web assets serving
  const resolvedStaticDir = staticDir || path.resolve(process.cwd(), 'web', 'dist');
  if (fs.existsSync(resolvedStaticDir)) {
    app.use(express.static(resolvedStaticDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(resolvedStaticDir, 'index.html'));
    });
  }

  return app;
}
