import YAML, { LineCounter, isMap, isSeq, isPair, isScalar } from 'yaml';
import { ParsedWorkflowDoc, ParsedJobNode, ParsedStepNode, WorkflowLocation } from './types.js';

/**
 * Parses GitHub Actions workflow YAML and builds an AST representation
 * with accurate 1-indexed line and column positions.
 */
export function parseWorkflowYaml(content: string, filePath: string = 'workflow.yml'): ParsedWorkflowDoc {
  const lineCounter = new LineCounter();
  const doc = YAML.parseDocument(content, {
    lineCounter,
    keepSourceTokens: true,
  });

  const getLocation = (offset?: number): WorkflowLocation => {
    if (offset === undefined || offset === null || offset < 0) {
      return { line: 1, column: 1 };
    }
    const pos = lineCounter.linePos(offset);
    return {
      line: pos.line,
      column: pos.col,
    };
  };

  const parsedJobs: ParsedJobNode[] = [];
  let rootPermissions: any = undefined;
  let workflowName: string | undefined = undefined;
  let workflowOn: any = undefined;

  const contents = doc.contents;
  if (isMap(contents)) {
    for (const pair of contents.items) {
      const keyStr = String(pair.key);

      if (keyStr === 'name' && isScalar(pair.value)) {
        workflowName = String(pair.value.value);
      }

      if (keyStr === 'on') {
        workflowOn = pair.value ? (pair.value as any).toJSON() : undefined;
      }

      if (keyStr === 'permissions') {
        rootPermissions = pair.value ? (pair.value as any).toJSON() : undefined;
      }

      if (keyStr === 'jobs' && isMap(pair.value)) {
        for (const jobPair of pair.value.items) {
          const jobId = String(jobPair.key);
          const jobNode = jobPair.value;

          if (isMap(jobNode)) {
            let jobName: string | undefined;
            let runsOn: string | string[] | undefined;
            let needs: string[] = [];
            let jobPermissions: any = undefined;
            const steps: ParsedStepNode[] = [];

            const jobLoc = getLocation(jobPair.key?.range?.[0]);

            for (const item of jobNode.items) {
              const itemKey = String(item.key);

              if (itemKey === 'name' && isScalar(item.value)) {
                jobName = String(item.value.value);
              } else if (itemKey === 'runs-on') {
                runsOn = item.value ? (item.value as any).toJSON() : undefined;
              } else if (itemKey === 'needs') {
                if (isScalar(item.value)) {
                  needs = [String(item.value.value)];
                } else if (isSeq(item.value)) {
                  needs = item.value.items.map(i => String((i as any).value ?? i));
                }
              } else if (itemKey === 'permissions') {
                jobPermissions = item.value ? (item.value as any).toJSON() : undefined;
              } else if (itemKey === 'steps' && isSeq(item.value)) {
                for (const stepItem of item.value.items) {
                  if (isMap(stepItem)) {
                    let stepName: string | undefined;
                    let uses: string | undefined;
                    let run: string | undefined;
                    let env: Record<string, string> | undefined;
                    let stepWith: Record<string, any> | undefined;

                    const stepLoc = getLocation(stepItem.range?.[0]);

                    for (const stepProp of stepItem.items) {
                      const propKey = String(stepProp.key);
                      if (propKey === 'name' && isScalar(stepProp.value)) {
                        stepName = String(stepProp.value.value);
                      } else if (propKey === 'uses' && isScalar(stepProp.value)) {
                        uses = String(stepProp.value.value);
                      } else if (propKey === 'run') {
                        if (isScalar(stepProp.value)) {
                          run = String(stepProp.value.value);
                        } else if (stepProp.value && (stepProp.value as any).range) {
                          const valRange = (stepProp.value as any).range;
                          run = content.slice(valRange[0], valRange[2]).trim();
                        } else if (stepProp.value) {
                          run = String(stepProp.value);
                        }
                      } else if (propKey === 'env' && isMap(stepProp.value)) {
                        env = (stepProp.value as any).toJSON();
                      } else if (propKey === 'with' && isMap(stepProp.value)) {
                        stepWith = (stepProp.value as any).toJSON();
                      }
                    }

                    // Extract raw text for snippet
                    const startOffset = stepItem.range?.[0] ?? 0;
                    const endOffset = stepItem.range?.[2] ?? startOffset;
                    const rawYaml = content.slice(startOffset, endOffset).trim();

                    steps.push({
                      name: stepName,
                      uses,
                      run,
                      env,
                      with: stepWith,
                      location: stepLoc,
                      rawYaml,
                    });
                  }
                }
              }
            }

            parsedJobs.push({
              id: jobId,
              name: jobName,
              runsOn,
              needs,
              permissions: jobPermissions,
              steps,
              location: jobLoc,
            });
          }
        }
      }
    }
  }

  return {
    filePath,
    rawContent: content,
    name: workflowName,
    on: workflowOn,
    permissions: rootPermissions,
    jobs: parsedJobs,
    lineCounter: getLocation,
  };
}
