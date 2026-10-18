import fs from 'node:fs';
import path from 'node:path';
import { SecurityFinding } from '../types/index.js';
import { parseWorkflowYaml } from './ast_parser.js';
import { shaPinningRule } from './sha_pinning.js';
import { scriptInjectionRule } from './script_injection.js';
import { permissionsRule } from './permissions.js';
import { secretLeakRule } from './secret_leak.js';
import { LintRule } from './types.js';

export const ALL_RULES: LintRule[] = [
  shaPinningRule,
  scriptInjectionRule,
  permissionsRule,
  secretLeakRule,
];

/**
 * Lints workflow YAML content.
 */
export function lintWorkflowContent(content: string, filePath: string = 'workflow.yml'): SecurityFinding[] {
  const doc = parseWorkflowYaml(content, filePath);
  const findings: SecurityFinding[] = [];

  for (const rule of ALL_RULES) {
    const ruleFindings = rule.check(doc);
    findings.push(...ruleFindings);
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Lints one or more workflow files on disk.
 */
export function lintWorkflowFiles(paths: string[]): SecurityFinding[] {
  const allFindings: SecurityFinding[] = [];

  for (const targetPath of paths) {
    if (!fs.existsSync(targetPath)) continue;

    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      const files = fs.readdirSync(targetPath)
        .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
        .map(f => path.join(targetPath, f));
      allFindings.push(...lintWorkflowFiles(files));
    } else if (targetPath.endsWith('.yml') || targetPath.endsWith('.yaml')) {
      const content = fs.readFileSync(targetPath, 'utf8');
      allFindings.push(...lintWorkflowContent(content, targetPath));
    }
  }

  return allFindings;
}

export * from './types.js';
export * from './ast_parser.js';
export * from './sha_pinning.js';
export * from './script_injection.js';
export * from './permissions.js';
export * from './secret_leak.js';
export * from './sarif_exporter.js';
export * from './fixer.js';
