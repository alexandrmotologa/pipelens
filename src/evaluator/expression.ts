import { EvaluationContext } from '../types/index.js';

type TokenType =
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'NULL'
  | 'IDENTIFIER'
  | 'NOT'
  | 'AND'
  | 'OR'
  | 'EQ'
  | 'NEQ'
  | 'LT'
  | 'LTE'
  | 'GT'
  | 'GTE'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'DOT'
  | 'EOF';

interface Token {
  type: TokenType;
  value: any;
}

/**
 * Tokenizes GitHub Actions expression syntax.
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const c = input[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue; }
    if (c === '[') { tokens.push({ type: 'LBRACKET', value: '[' }); i++; continue; }
    if (c === ']') { tokens.push({ type: 'RBRACKET', value: ']' }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'COMMA', value: ',' }); i++; continue; }
    if (c === '.') { tokens.push({ type: 'DOT', value: '.' }); i++; continue; }

    if (c === '!' && input[i + 1] !== '=') {
      tokens.push({ type: 'NOT', value: '!' });
      i++;
      continue;
    }

    if (c === '&' && input[i + 1] === '&') {
      tokens.push({ type: 'AND', value: '&&' });
      i += 2;
      continue;
    }

    if (c === '|' && input[i + 1] === '|') {
      tokens.push({ type: 'OR', value: '||' });
      i += 2;
      continue;
    }

    if (c === '=' && input[i + 1] === '=') {
      tokens.push({ type: 'EQ', value: '==' });
      i += 2;
      continue;
    }

    if (c === '!' && input[i + 1] === '=') {
      tokens.push({ type: 'NEQ', value: '!=' });
      i += 2;
      continue;
    }

    if (c === '<') {
      if (input[i + 1] === '=') {
        tokens.push({ type: 'LTE', value: '<=' });
        i += 2;
      } else {
        tokens.push({ type: 'LT', value: '<' });
        i++;
      }
      continue;
    }

    if (c === '>') {
      if (input[i + 1] === '=') {
        tokens.push({ type: 'GTE', value: '>=' });
        i += 2;
      } else {
        tokens.push({ type: 'GT', value: '>' });
        i++;
      }
      continue;
    }

    // String literal: 'single quoted' with '' escaping
    if (c === "'") {
      let str = '';
      i++; // skip opening quote
      while (i < input.length) {
        if (input[i] === "'") {
          if (input[i + 1] === "'") {
            str += "'";
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          str += input[i];
          i++;
        }
      }
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    // Number literal
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(input[i + 1] || ''))) {
      let numStr = c;
      i++;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(c)) {
      let ident = '';
      while (i < input.length && /[a-zA-Z0-9_\-]/.test(input[i])) {
        ident += input[i];
        i++;
      }

      if (ident === 'true') {
        tokens.push({ type: 'BOOLEAN', value: true });
      } else if (ident === 'false') {
        tokens.push({ type: 'BOOLEAN', value: false });
      } else if (ident === 'null') {
        tokens.push({ type: 'NULL', value: null });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: ident });
      }
      continue;
    }

    // Skip unrecognized characters
    i++;
  }

  tokens.push({ type: 'EOF', value: null });
  return tokens;
}

/**
 * Recursive descent AST parser and evaluator for GitHub Actions expressions.
 */
class Parser {
  private tokens: Token[];
  private current: number = 0;
  private context: EvaluationContext;

  constructor(tokens: Token[], context: EvaluationContext) {
    this.tokens = tokens;
    this.context = context;
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: null };
  }

  private advance(): Token {
    const t = this.peek();
    if (t.type !== 'EOF') {
      this.current++;
    }
    return t;
  }

  private match(...types: TokenType[]): boolean {
    const t = this.peek();
    if (types.includes(t.type)) {
      this.advance();
      return true;
    }
    return false;
  }

  public parseAndEvaluate(): any {
    const res = this.or();
    return res;
  }

  // Logical OR (||)
  private or(): any {
    let left = this.and();
    while (this.peek().type === 'OR') {
      this.advance();
      const right = this.and();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  // Logical AND (&&)
  private and(): any {
    let left = this.equality();
    while (this.peek().type === 'AND') {
      this.advance();
      const right = this.equality();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  // Equality (==, !=)
  private equality(): any {
    let left = this.relational();
    while (this.peek().type === 'EQ' || this.peek().type === 'NEQ') {
      const op = this.advance().type;
      const right = this.relational();
      if (op === 'EQ') {
        // GHA compares strings case-insensitively
        if (typeof left === 'string' && typeof right === 'string') {
          left = left.toLowerCase() === right.toLowerCase();
        } else {
          left = left == right;
        }
      } else {
        if (typeof left === 'string' && typeof right === 'string') {
          left = left.toLowerCase() !== right.toLowerCase();
        } else {
          left = left != right;
        }
      }
    }
    return left;
  }

  // Relational (<, <=, >, >=)
  private relational(): any {
    let left = this.unary();
    while (['LT', 'LTE', 'GT', 'GTE'].includes(this.peek().type)) {
      const op = this.advance().type;
      const right = this.unary();
      switch (op) {
        case 'LT': left = left < right; break;
        case 'LTE': left = left <= right; break;
        case 'GT': left = left > right; break;
        case 'GTE': left = left >= right; break;
      }
    }
    return left;
  }

  // Unary (!)
  private unary(): any {
    if (this.peek().type === 'NOT') {
      this.advance();
      return !this.unary();
    }
    return this.postfix();
  }

  // Member access and function calls
  private postfix(): any {
    let expr = this.primary();

    while (true) {
      if (this.peek().type === 'DOT') {
        this.advance();
        const prop = this.advance();
        if (expr && typeof expr === 'object') {
          expr = expr[prop.value];
        } else {
          expr = undefined;
        }
      } else if (this.peek().type === 'LBRACKET') {
        this.advance();
        const indexVal = this.or();
        if (this.peek().type === 'RBRACKET') {
          this.advance();
        }
        if (expr && typeof expr === 'object') {
          expr = expr[indexVal];
        } else {
          expr = undefined;
        }
      } else if (this.peek().type === 'LPAREN' && typeof expr === 'string') {
        // Function invocation where expr was the function name
        expr = this.evaluateFunction(expr);
      } else {
        break;
      }
    }

    return expr;
  }

  // Function evaluation
  private evaluateFunction(fnName: string): any {
    this.advance(); // consume LPAREN
    const args: any[] = [];

    if (this.peek().type !== 'RPAREN') {
      args.push(this.or());
      while (this.peek().type === 'COMMA') {
        this.advance();
        args.push(this.or());
      }
    }

    if (this.peek().type === 'RPAREN') {
      this.advance();
    }

    const lower = fnName.toLowerCase();

    switch (lower) {
      case 'contains': {
        const search = args[0];
        const item = args[1];
        if (Array.isArray(search)) {
          return search.some(v => String(v).toLowerCase() === String(item).toLowerCase());
        }
        if (typeof search === 'string') {
          return search.toLowerCase().includes(String(item).toLowerCase());
        }
        return false;
      }
      case 'startswith': {
        const searchStr = String(args[0] ?? '');
        const val = String(args[1] ?? '');
        return searchStr.toLowerCase().startsWith(val.toLowerCase());
      }
      case 'endswith': {
        const searchStr = String(args[0] ?? '');
        const val = String(args[1] ?? '');
        return searchStr.toLowerCase().endsWith(val.toLowerCase());
      }
      case 'format': {
        let fmt = String(args[0] ?? '');
        for (let i = 1; i < args.length; i++) {
          fmt = fmt.replace(new RegExp(`\\{${i - 1}\\}`, 'g'), String(args[i]));
        }
        return fmt;
      }
      case 'join': {
        const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
        const sep = args[1] !== undefined ? String(args[1]) : ',';
        return arr.join(sep);
      }
      case 'tojson': {
        return JSON.stringify(args[0], null, 2);
      }
      case 'fromjson': {
        try {
          return JSON.parse(args[0]);
        } catch {
          return null;
        }
      }
      case 'always':
        return true;
      case 'success':
        return this.context.job?.status !== 'failure' && this.context.job?.status !== 'cancelled';
      case 'failure':
        return this.context.job?.status === 'failure';
      case 'cancelled':
        return this.context.job?.status === 'cancelled';
      default:
        return null;
    }
  }

  // Primary literals and context symbols
  private primary(): any {
    const t = this.peek();

    if (t.type === 'STRING' || t.type === 'NUMBER' || t.type === 'BOOLEAN' || t.type === 'NULL') {
      this.advance();
      return t.value;
    }

    if (t.type === 'LPAREN') {
      this.advance();
      const val = this.or();
      if (this.peek().type === 'RPAREN') {
        this.advance();
      }
      return val;
    }

    if (t.type === 'IDENTIFIER') {
      const ident = this.advance().value;

      // Check if it is a built-in function called directly
      if (this.peek().type === 'LPAREN') {
        return this.evaluateFunction(ident);
      }

      // Context root symbol resolution
      const ctx = this.context as Record<string, any>;
      if (ident in ctx) {
        return ctx[ident];
      }

      // If identifier matches an env variable or step output directly
      if (ctx.env && ident in ctx.env) {
        return ctx.env[ident];
      }

      return undefined;
    }

    return undefined;
  }
}

/**
 * Evaluates a single GitHub Actions expression string (e.g. "contains(github.ref, 'main')")
 */
export function evaluateExpression(expression: string, context: EvaluationContext): any {
  // Strip outer ${{ ... }} if present
  let cleaned = expression.trim();
  if (cleaned.startsWith('${{') && cleaned.endsWith('}}')) {
    cleaned = cleaned.slice(3, -2).trim();
  }

  const tokens = tokenize(cleaned);
  const parser = new Parser(tokens, context);
  return parser.parseAndEvaluate();
}

/**
 * Replaces all ${{ ... }} occurrences in a template string with evaluated values.
 */
export function interpolateString(input: string, context: EvaluationContext): string {
  return input.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr) => {
    const val = evaluateExpression(expr, context);
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });
}
