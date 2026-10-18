import {
  JobTelemetry,
  CriticalPathResult,
  DagNode,
  DagEdge,
  BottleneckFinding
} from '../types/index.js';

/**
 * Computes the Critical Path Method (CPM) Directed Acyclic Graph (DAG)
 * and detects execution bottlenecks across workflow jobs.
 */
export function computeCriticalPath(jobs: JobTelemetry[]): CriticalPathResult {
  if (jobs.length === 0) {
    return {
      nodes: [],
      edges: [],
      criticalPath: [],
      criticalPathDurationMs: 0,
      totalJobWallClockMs: 0,
      cumulativeJobDurationMs: 0,
      parallelizationGainMs: 0,
      bottlenecks: [],
    };
  }

  const jobMap = new Map<string, JobTelemetry>();
  const idToNameMap = new Map<string, string>();

  for (const job of jobs) {
    const key = String(job.id);
    jobMap.set(key, job);
    // Also index by name to resolve `needs: ["job-name"]`
    jobMap.set(job.name, job);
    idToNameMap.set(key, job.name);
  }

  // Build adjacency list: node -> outgoing successors, and incoming predecessors
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  const uniqueJobKeys = jobs.map(j => String(j.id));

  for (const key of uniqueJobKeys) {
    successors.set(key, []);
    predecessors.set(key, []);
  }

  // Resolve edges from `needs`
  const edges: DagEdge[] = [];
  for (const job of jobs) {
    const toKey = String(job.id);
    for (const need of job.needs || []) {
      const parentJob = jobMap.get(need);
      if (parentJob) {
        const fromKey = String(parentJob.id);
        if (fromKey !== toKey) {
          successors.get(fromKey)?.push(toKey);
          predecessors.get(toKey)?.push(fromKey);
          edges.push({ from: fromKey, to: toKey, isCritical: false });
        }
      }
    }
  }

  // Topological sorting via Kahn's algorithm
  const inDegree = new Map<string, number>();
  for (const key of uniqueJobKeys) {
    inDegree.set(key, predecessors.get(key)?.length || 0);
  }

  const queue: string[] = [];
  for (const [key, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(key);
    }
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    topoOrder.push(u);

    for (const v of successors.get(u) || []) {
      const currentDeg = (inDegree.get(v) || 1) - 1;
      inDegree.set(v, currentDeg);
      if (currentDeg === 0) {
        queue.push(v);
      }
    }
  }

  // If cycle detected or detached nodes exist, fallback to original order
  const orderedKeys = topoOrder.length === uniqueJobKeys.length ? topoOrder : uniqueJobKeys;

  // Forward Pass: calculate Early Start (ES) and Early Finish (EF)
  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  for (const key of orderedKeys) {
    const job = jobMap.get(key)!;
    const duration = Math.max(job.durationMs, 0);

    const parents = predecessors.get(key) || [];
    let maxEarlyStart = 0;
    for (const p of parents) {
      const parentEf = ef.get(p) || 0;
      if (parentEf > maxEarlyStart) {
        maxEarlyStart = parentEf;
      }
    }

    es.set(key, maxEarlyStart);
    ef.set(key, maxEarlyStart + duration);
  }

  // Total project duration is the maximum Early Finish across all terminal jobs
  let projectDuration = 0;
  for (const finishTime of ef.values()) {
    if (finishTime > projectDuration) {
      projectDuration = finishTime;
    }
  }

  // Backward Pass: calculate Late Finish (LF) and Late Start (LS)
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();

  // Reverse topological order
  const reversedKeys = [...orderedKeys].reverse();

  for (const key of reversedKeys) {
    const job = jobMap.get(key)!;
    const duration = Math.max(job.durationMs, 0);
    const children = successors.get(key) || [];

    let minLateFinish = projectDuration;
    if (children.length > 0) {
      minLateFinish = Number.POSITIVE_INFINITY;
      for (const c of children) {
        const childLs = ls.get(c) ?? projectDuration;
        if (childLs < minLateFinish) {
          minLateFinish = childLs;
        }
      }
    }

    lf.set(key, minLateFinish);
    ls.set(key, minLateFinish - duration);
  }

  // Slack calculation and Critical Path identification
  // A node is critical if slack (LF - EF) is approximately zero (tolerance: 100ms)
  const criticalJobKeys = new Set<string>();
  const nodes: DagNode[] = [];
  let cumulativeDurationMs = 0;

  for (const key of uniqueJobKeys) {
    const job = jobMap.get(key)!;
    const duration = Math.max(job.durationMs, 0);
    cumulativeDurationMs += duration;

    const earlyStart = es.get(key) || 0;
    const earlyFinish = ef.get(key) || duration;
    const lateFinish = lf.get(key) || projectDuration;
    const lateStart = ls.get(key) || 0;

    const slack = Math.max(0, lateFinish - earlyFinish);
    const isCritical = slack <= 100; // 100ms tolerance for timing jitters

    if (isCritical) {
      criticalJobKeys.add(key);
    }

    nodes.push({
      id: key,
      name: job.name,
      durationMs: duration,
      earlyStartMs: earlyStart,
      earlyFinishMs: earlyFinish,
      lateStartMs: lateStart,
      lateFinishMs: lateFinish,
      slackMs: slack,
      isCritical,
      inDegree: predecessors.get(key)?.length || 0,
      outDegree: successors.get(key)?.length || 0,
    });
  }

  // Mark critical edges
  for (const edge of edges) {
    if (criticalJobKeys.has(edge.from) && criticalJobKeys.has(edge.to)) {
      // Must also ensure edge.to depends directly on finish time of edge.from
      const fromEf = ef.get(edge.from) || 0;
      const toEs = es.get(edge.to) || 0;
      if (Math.abs(toEs - fromEf) <= 100) {
        edge.isCritical = true;
      }
    }
  }

  // Reconstruct sorted critical path chain from root to sink
  const criticalPathSequence: string[] = [];
  let currentCritical = nodes
    .filter(n => n.isCritical && n.inDegree === 0)
    .sort((a, b) => b.durationMs - a.durationMs)[0];

  while (currentCritical) {
    criticalPathSequence.push(currentCritical.name);
    const currentId = currentCritical.id;
    const nextEdges = edges.filter(e => e.from === currentId && e.isCritical);
    if (nextEdges.length > 0) {
      const nextId = nextEdges[0].to;
      currentCritical = nodes.find(n => n.id === nextId)!;
    } else {
      break;
    }
  }

  // If graph was completely disconnected, pick longest node as critical sequence
  if (criticalPathSequence.length === 0 && nodes.length > 0) {
    const longestNode = [...nodes].sort((a, b) => b.durationMs - a.durationMs)[0];
    criticalPathSequence.push(longestNode.name);
  }

  // Detect bottlenecks and optimization opportunities
  const bottlenecks: BottleneckFinding[] = [];

  for (const node of nodes) {
    const job = jobMap.get(node.id)!;

    // Check queue wait time
    if (job.queueDurationMs > 45000) {
      bottlenecks.push({
        jobId: node.id,
        jobName: node.name,
        type: 'long_queue',
        severity: job.queueDurationMs > 120000 ? 'high' : 'medium',
        reason: `Runner queue delay of ${Math.round(job.queueDurationMs / 1000)}s before execution began.`,
        recommendation: 'Check runner pool saturation or consider self-hosted / larger GitHub-hosted runner concurrency.',
        potentialTimeSavedMs: job.queueDurationMs,
      });
    }

    // Check critical path duration
    if (node.isCritical && node.durationMs > 180000) {
      bottlenecks.push({
        jobId: node.id,
        jobName: node.name,
        type: 'critical_path_blocker',
        severity: node.durationMs > 600000 ? 'high' : 'medium',
        reason: `Job is on the critical path and ran for ${Math.round(node.durationMs / 1000)}s, blocking total pipeline completion.`,
        recommendation: 'Decompose heavy test suites, split matrix targets, or utilize granular caching for dependencies.',
        potentialTimeSavedMs: Math.round(node.durationMs * 0.4),
      });
    }

    // Check sequential chain with high slack
    if (node.inDegree === 1 && node.outDegree === 1 && node.slackMs > 60000) {
      bottlenecks.push({
        jobId: node.id,
        jobName: node.name,
        type: 'sequential_chain',
        severity: 'low',
        reason: `Job has ${Math.round(node.slackMs / 1000)}s of slack time, running inside a strict serial pipeline.`,
        recommendation: 'Evaluate if this job can start earlier in parallel without waiting for upstream stages.',
        potentialTimeSavedMs: node.slackMs,
      });
    }
  }

  const parallelizationGainMs = Math.max(0, cumulativeDurationMs - projectDuration);

  return {
    nodes,
    edges,
    criticalPath: criticalPathSequence,
    criticalPathDurationMs: projectDuration,
    totalJobWallClockMs: projectDuration,
    cumulativeJobDurationMs: cumulativeDurationMs,
    parallelizationGainMs,
    bottlenecks,
  };
}
