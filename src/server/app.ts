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

  // Generate automated safe fix
  app.post('/api/fix', (req: Request, res: Response): void => {
    try {
      const { yaml, filePath = '.github/workflows/workflow.yml' } = req.body;
      if (!yaml) {
        res.status(400).json({ error: 'Missing "yaml" field in request body' });
        return;
      }

      const findings = lintWorkflowContent(yaml, filePath);
      const fix = generateSafeFix(yaml, filePath, findings);

      res.json({ fix, findingsCount: findings.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate safe fix' });
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
