# PipeLens Engineering Architecture

PipeLens provides observability, cost modeling, and static security analysis for GitHub Actions CI/CD workflows. This document details the underlying algorithms and execution lifecycle.

---

## 1. Critical Path Method (CPM) DAG Solver

A workflow run is modeled as a Directed Acyclic Graph $G = (V, E)$, where:
- Vertices $V = \{J_1, J_2, \dots, J_n\}$ represent jobs with duration $D(J_i) \ge 0$.
- Directed edges $E = \{(J_i, J_k)\}$ represent dependencies specified via `needs: [J_i]`.

### Topological Scheduling Algorithm

1. **Topological Sort**:
   Using Kahn's algorithm, incoming degrees are tracked and vertices are sorted into a linear execution sequence.

2. **Forward Pass (Early Schedule)**:
   For each job $J_k$ in topological order:
   $$ES(J_k) = \max_{P \in \text{parents}(J_k)} EF(P)$$
   $$EF(J_k) = ES(J_k) + D(J_k)$$
   For root jobs without dependencies, $ES(J_k) = 0$.

3. **Project Duration**:
   $$T = \max_{J \in V} EF(J)$$

4. **Backward Pass (Late Schedule)**:
   For each job $J_k$ in reverse topological order:
   $$LF(J_k) = \min_{S \in \text{children}(J_k)} LS(S)$$
   $$LS(J_k) = LF(J_k) - D(J_k)$$
   For terminal jobs with no successors, $LF(J_k) = T$.

5. **Total Float (Slack)**:
   $$\text{Slack}(J_k) = LF(J_k) - EF(J_k) = LS(J_k) - ES(J_k)$$
   Jobs with $\text{Slack}(J_k) \le 100\text{ms}$ constitute the **Critical Path**. Any delay in these jobs increases overall pipeline duration by the exact same amount.

---

## 2. GitHub Actions Billing Model

GitHub Actions calculates billable minutes using strict per-job round-up rules:
- Duration in minutes: $M = \lceil \frac{\text{Duration in ms}}{60000} \rceil$
- Every job consumes a minimum of 1 billable minute.

Operating system multiplier rates:
- **Linux Standard**: $0.008 per billable minute (1x)
- **Windows Standard**: $0.016 per billable minute (2x)
- **macOS Standard**: $0.064 per billable minute (8x to 10x)

Total cost formula:
$$\text{Cost} = \sum_{j \in \text{Jobs}} \lceil \frac{D(j)}{60000} \rceil \times \text{Rate}(\text{OS}_j)$$

---

## 3. Cache Miss & Invalidation Detection

When actions like `actions/cache` or `actions/setup-node` execute:
- A local SSD hit completes in under 5 seconds.
- A cache miss forces a network download and secondary compilation, often adding 60 to 180 seconds to subsequent steps (`npm ci`, `cargo build`).
- PipeLens identifies cache steps from job logs and step duration profiles, reporting the wasted runner minutes and associated dollar loss.

---

## 4. Expression Tokenizer & Evaluator

GitHub Actions supports inline expressions formatted as `${{ <expression> }}`.

PipeLens implements a recursive descent parser for expressions:
- **Literals**: Single-quoted strings with `''` escaping, numbers, booleans, and `null`.
- **Operators**: `!`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`.
- **String & Array Functions**: `contains()`, `startsWith()`, `endsWith()`, `format()`, `join()`, `toJSON()`, `fromJSON()`.
- **Context Symbols**: Resolves objects from `github.*`, `env.*`, `vars.*`, `job.*`, `steps.*`, `runner.*`, and `matrix.*`.
- **Evaluation Safety**: Implemented in pure TypeScript without invoking `eval()` or JavaScript Function constructors.
