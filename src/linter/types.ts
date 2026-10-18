import { SecurityFinding, RuleSeverity, RuleCategory } from '../types/index.js';

export interface WorkflowLocation {
  line: number;
  column: number;
}

export interface ParsedStepNode {
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, any>;
  location: WorkflowLocation;
  rawYaml: string;
}

export interface ParsedJobNode {
  id: string;
  name?: string;
  runsOn?: string | string[];
  needs?: string[];
  permissions?: any;
  steps: ParsedStepNode[];
  location: WorkflowLocation;
}

export interface ParsedWorkflowDoc {
  filePath: string;
  rawContent: string;
  name?: string;
  permissions?: any;
  jobs: ParsedJobNode[];
  lineCounter: (offset: number) => WorkflowLocation;
}

export interface LintRule {
  id: string;
  title: string;
  category: RuleCategory;
  severity: RuleSeverity;
  description: string;
  check: (doc: ParsedWorkflowDoc) => SecurityFinding[];
}
