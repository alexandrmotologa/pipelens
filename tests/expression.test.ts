import { describe, it, expect } from 'vitest';
import { evaluateExpression, interpolateString } from '../src/evaluator/expression.js';
import { createDefaultContext } from '../src/evaluator/context.js';

describe('GitHub Actions Expression Evaluator', () => {
  const context = createDefaultContext({
    github: {
      ref: 'refs/heads/main',
      actor: 'octocat',
      event_name: 'push',
    },
    env: {
      NODE_ENV: 'production',
      DEBUG: 'false',
    },
    matrix: {
      node: 20,
      os: 'ubuntu-latest',
    },
  });

  it('evaluates boolean and comparison expressions', () => {
    expect(evaluateExpression("github.ref == 'refs/heads/main'", context)).toBe(true);
    expect(evaluateExpression("github.actor == 'octocat'", context)).toBe(true);
    expect(evaluateExpression("matrix.node >= 18", context)).toBe(true);
    expect(evaluateExpression("matrix.node < 16", context)).toBe(false);
  });

  it('evaluates built-in functions: contains, startsWith, endsWith', () => {
    expect(evaluateExpression("contains(github.ref, 'main')", context)).toBe(true);
    expect(evaluateExpression("startsWith(github.ref, 'refs/heads/')", context)).toBe(true);
    expect(evaluateExpression("endsWith(github.ref, 'main')", context)).toBe(true);
    expect(evaluateExpression("contains(github.ref, 'feature')", context)).toBe(false);
  });

  it('evaluates logical operators &&, ||, !', () => {
    expect(evaluateExpression("contains(github.ref, 'main') && matrix.node == 20", context)).toBe(true);
    expect(evaluateExpression("matrix.node == 18 || matrix.node == 20", context)).toBe(true);
    expect(evaluateExpression("!contains(github.ref, 'feature')", context)).toBe(true);
  });

  it('evaluates format() and join()', () => {
    expect(evaluateExpression("format('Hello {0}, version {1}', 'World', 2)", context)).toBe('Hello World, version 2');
    expect(evaluateExpression("join(fromJSON('[\"a\",\"b\",\"c\"]'), '-')", context)).toBe('a-b-c');
  });

  it('evaluates fromJSON() and toJSON()', () => {
    const parsed = evaluateExpression("fromJSON('{\"foo\":\"bar\"}')", context);
    expect(parsed).toEqual({ foo: 'bar' });
  });

  it('interpolates expressions inside strings', () => {
    const template = "Running node ${{ matrix.node }} on ${{ matrix.os }} for ${{ github.actor }}";
    const result = interpolateString(template, context);
    expect(result).toBe("Running node 20 on ubuntu-latest for octocat");
  });
});
