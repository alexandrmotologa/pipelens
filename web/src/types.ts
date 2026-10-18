export type RunnerOsType = 'ubuntu' | 'windows' | 'macos' | 'self-hosted' | 'unknown';

export interface StepTelemetry {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
}

export interface JobTelemetry {
  id: number | string;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  queueDurationMs: number;
  runnerName: string | null;
  runnerOs: RunnerOsType;
  steps: StepTelemetry[];
  needs: string[];
}

export interface WorkflowRunTelemetry {
  id: number | string;
  name: string;
  workflowName: string;
  repository: string;
  event: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  totalDurationMs: number;
  jobs: JobTelemetry[];
}

export interface DagNode {
  id: string;
  name: string;
  durationMs: number;
  earlyStartMs: number;
  earlyFinishMs: number;
  lateStartMs: number;
  lateFinishMs: number;
  slackMs: number;
  isCritical: boolean;
  inDegree: number;
  outDegree: number;
}

export interface DagEdge {
  from: string;
  to: string;
  isCritical: boolean;
}

export interface BottleneckFinding {
  jobId: string;
  jobName: string;
  type: 'critical_path_blocker' | 'long_queue' | 'sequential_chain' | 'cache_miss';
  severity: 'high' | 'medium' | 'low';
  reason: string;
  recommendation: string;
  potentialTimeSavedMs: number;
}

export interface CriticalPathResult {
  nodes: DagNode[];
  edges: DagEdge[];
  criticalPath: string[];
  criticalPathDurationMs: number;
  totalJobWallClockMs: number;
  cumulativeJobDurationMs: number;
  parallelizationGainMs: number;
  bottlenecks: BottleneckFinding[];
}

export interface CacheRecord {
  jobId: number | string;
  stepName: string;
  cacheKey: string;
  hit: boolean;
  saved: boolean;
  durationMs: number;
}

export interface CacheAuditResult {
  totalCacheSteps: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatio: number;
  wastedDurationMs: number;
  estimatedSavingsUsd: number;
  records: CacheRecord[];
}

export interface CostEstimate {
  totalBillableMinutes: number;
  linuxMinutes: number;
  windowsMinutes: number;
  macosMinutes: number;
  totalCostUsd: number;
  estimatedCo2Grams: number;
  potentialSavingsUsd: number;
}

export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RuleCategory = 'supply-chain' | 'script-injection' | 'least-privilege' | 'secrets' | 'performance';

export interface SecurityFinding {
  ruleId: string;
  title: string;
  severity: RuleSeverity;
  category: RuleCategory;
  message: string;
  file: string;
  line: number;
  column: number;
  snippet?: string;
  suggestedFix?: string;
  autoFixable: boolean;
}

export interface YamlFix {
  file: string;
  description: string;
  originalYaml: string;
  fixedYaml: string;
  diff: string;
}

export interface MatrixVariation {
  id: string;
  name: string;
  variables: Record<string, any>;
  runnerOs: RunnerOsType;
  estimatedMinutes: number;
}

export interface MatrixSimulationResult {
  totalJobs: number;
  dimensions: string[];
  variations: MatrixVariation[];
  totalEstimatedCostUsd: number;
  totalEstimatedBillableMinutes: number;
}

export interface ProfileData {
  run: WorkflowRunTelemetry;
  criticalPath: CriticalPathResult;
  cost: CostEstimate;
  cache: CacheAuditResult;
}
