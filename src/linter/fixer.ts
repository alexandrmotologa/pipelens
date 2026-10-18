import fs from 'node:fs';
import { YamlFix, SecurityFinding } from '../types/index.js';
import { KNOWN_ACTION_SHAS } from './sha_pinning.js';

/**
 * Generates a unified diff format representation between two texts.
 */
export function generateUnifiedDiff(filePath: string, original: string, modified: string): string {
  const origLines = original.split(/\r?\n/);
  const modLines = modified.split(/\r?\n/);

  const diffLines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -1,${origLines.length} +1,${modLines.length} @@`,
  ];

  const maxLen = Math.max(origLines.length, modLines.length);
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const m = modLines[i];

    if (o === undefined) {
      diffLines.push(`+ ${m}`);
    } else if (m === undefined) {
      diffLines.push(`- ${o}`);
    } else if (o !== m) {
      diffLines.push(`- ${o}`);
      diffLines.push(`+ ${m}`);
    } else {
      diffLines.push(`  ${o}`);
    }
  }

  return diffLines.join('\n');
}

/**
 * Creates safe automated fixes for common security findings.
 */
export function generateSafeFix(content: string, filePath: string, findings: SecurityFinding[]): YamlFix | null {
  let fixedContent = content;
  let modificationsCount = 0;

  // 1. Fix unpinned action references
  for (const [actionTag, { sha, versionComment }] of Object.entries(KNOWN_ACTION_SHAS)) {
    // Match uses: action@vX or uses: "action@vX"
    const regex = new RegExp(`(uses:\\s*['"]?)${actionTag.replace('/', '\\/')}(['"]?)`, 'g');
    if (regex.test(fixedContent)) {
      const actionName = actionTag.split('@')[0];
      const replacement = `$1${actionName}@${sha} # ${versionComment}$2`;
      fixedContent = fixedContent.replace(regex, replacement);
      modificationsCount++;
    }
  }

  // 2. Add top-level least-privilege permissions if missing
  const hasMissingPermissions = findings.some(f => f.ruleId === 'PL-SEC-003');
  if (hasMissingPermissions && !/^\s*permissions:/m.test(fixedContent)) {
    // Insert after "name:" or "on:" block
    const onIndex = fixedContent.search(/^on:/m);
    if (onIndex !== -1) {
      const beforeOn = fixedContent.substring(0, onIndex);
      const afterOn = fixedContent.substring(onIndex);
      fixedContent = `${beforeOn}permissions:\n  contents: read\n\n${afterOn}`;
      modificationsCount++;
    } else {
      fixedContent = `permissions:\n  contents: read\n\n${fixedContent}`;
      modificationsCount++;
    }
  }

  if (modificationsCount === 0 || fixedContent === content) {
    return null;
  }

  const diff = generateUnifiedDiff(filePath, content, fixedContent);

  return {
    file: filePath,
    description: `Applied ${modificationsCount} automated security hardening fix(es).`,
    originalYaml: content,
    fixedYaml: fixedContent,
    diff,
  };
}

/**
 * Applies automated fixes directly to files on disk.
 */
export function applyFileFixes(
  filePaths: string[],
  lintFn?: (content: string, path: string) => SecurityFinding[]
): YamlFix[] {
  const appliedFixes: YamlFix[] = [];

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const findings = lintFn ? lintFn(content, filePath) : [];
    const fix = generateSafeFix(content, filePath, findings);

    if (fix) {
      fs.writeFileSync(filePath, fix.fixedYaml, 'utf8');
      appliedFixes.push(fix);
    }
  }

  return appliedFixes;
}
