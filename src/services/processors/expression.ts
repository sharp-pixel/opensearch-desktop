// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

// Processing expression subset derived from DataPrepperExpression.g4 and the
// upstream operators/functions. No JavaScript code evaluation is used.
type Token = { kind: 'number' | 'string' | 'field' | 'name' | 'operator'; text: string; value?: unknown };
type Node =
  | { kind: 'literal'; value: unknown }
  | { kind: 'field'; path: string }
  | { kind: 'function'; name: string; args: Node[] }
  | { kind: 'unary'; operator: string; operand: Node }
  | { kind: 'binary'; operator: string; left: Node; right: Node }
  | { kind: 'set'; values: unknown[] };

interface ExpressionMetadataContext {
  getMetadata: (key: string) => unknown;
  hasTags: (tags: string[]) => boolean;
}
type ReadField = ((path: string) => unknown) & { metadata?: ExpressionMetadataContext };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  let operandExpected = true;
  while (offset < expression.length) {
    const rest = expression.slice(offset);
    const space = rest.match(/^\s+/);
    if (space) { offset += space[0].length; continue; }
    const quote = rest.match(/^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
    if (quote) {
      const raw = quote[0];
      const value: string = raw.startsWith('"') ? JSON.parse(raw) : raw.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
      tokens.push(raw.startsWith('"') && value.startsWith('/') ? { kind: 'field', text: raw, value } : { kind: 'string', text: raw, value });
      offset += raw.length;
      operandExpected = false;
      continue;
    }
    const number = rest.match(/^\d+(?:\.\d+)?(?:[eE]-?\d+)?/);
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) throw new Error('Number is outside the local expression range');
      tokens.push({ kind: 'number', text: number[0], value });
      offset += number[0].length;
      operandExpected = false;
      continue;
    }
    if (operandExpected && rest.startsWith('/')) {
      const field = rest.match(/^\/[A-Za-z0-9_.~@\[\]-]+(?:\/[A-Za-z0-9_.~@\[\]-]+)*/);
      if (field) {
        tokens.push({ kind: 'field', text: field[0], value: field[0] });
        offset += field[0].length;
        operandExpected = false;
        continue;
      }
    }
    const name = rest.match(/^[A-Za-z_][A-Za-z0-9_.@-]*/);
    if (name) {
      tokens.push({ kind: 'name', text: name[0] });
      offset += name[0].length;
      operandExpected = ['and', 'or', 'not', 'in', 'typeof'].includes(name[0]);
      continue;
    }
    const operator = rest.match(/^(>=|<=|==|!=|=~|!~|&&|\|\||[!()+*/%<>,{}-])/);
    if (!operator) throw new Error('Unsupported expression syntax');
    tokens.push({ kind: 'operator', text: operator[0] });
    offset += operator[0].length;
    operandExpected = ![')', '}'].includes(operator[0]);
  }
  return tokens;
}

const precedence: Record<string, number> = {
  and: 1, or: 1, '||': 1, '&&': 2,
  '==': 3, '!=': 3, '=~': 4, '!~': 4,
  '<': 5, '<=': 5, '>': 5, '>=': 5,
  in: 6, 'not in': 6, typeof: 6,
  '+': 7, '-': 7, '*': 8, '/': 8, '%': 8,
};

function parse(expression: string): Node {
  const tokens = tokenize(expression);
  let index = 0;
  const peek = () => tokens[index]?.text;
  const take = (expected: string) => {
    if (tokens[index++]?.text !== expected) throw new Error(`Expected ${expected} in expression`);
  };
  const primary = (): Node => {
    const token = tokens[index++];
    if (!token) throw new Error('Incomplete expression');
    if (token.text === '(') {
      const node = binary(1);
      take(')');
      return node;
    }
    if (token.text === '-' || token.text === '!' || token.text === 'not') {
      return { kind: 'unary', operator: token.text, operand: binary(token.text === 'not' ? 3 : 9) };
    }
    if (token.text === '{') {
      const values: unknown[] = [];
      do {
        const member = tokens[index++];
        if (!member || !['number', 'string'].includes(member.kind) && !['true', 'false'].includes(member.text)) {
          throw new Error('Sets require nonempty literal members of one type');
        }
        values.push(member.kind === 'name' ? member.text === 'true' : member.value);
        if (peek() !== ',') break;
        index++;
      } while (index < tokens.length);
      take('}');
      if (values.some(value => typeof value !== typeof values[0])) throw new Error('Set members must have the same type');
      return { kind: 'set', values };
    }
    if (token.kind === 'field') return { kind: 'field', path: token.value as string };
    if (token.kind === 'number' || token.kind === 'string') return { kind: 'literal', value: token.value };
    if (token.kind !== 'name') throw new Error('Unsupported expression operand');
    if (peek() === '(') {
      index++;
      const args: Node[] = [];
      if (peek() !== ')') {
        do {
          args.push(binary(1));
          if (peek() !== ',') break;
          index++;
        } while (index < tokens.length);
      }
      take(')');
      return { kind: 'function', name: token.text, args };
    }
    if (token.text === 'true' || token.text === 'false' || token.text === 'null') {
      return { kind: 'literal', value: token.text === 'null' ? null : token.text === 'true' };
    }
    // Retained compatibility extension: bare field references.
    return { kind: 'field', path: token.text };
  };
  const binary = (minimum: number): Node => {
    let left = primary();
    while (peek()) {
      const operator = peek() === 'not' && tokens[index + 1]?.text === 'in' ? 'not in' : peek()!;
      const level = precedence[operator];
      if (level === undefined || level < minimum) break;
      index += operator === 'not in' ? 2 : 1;
      if (operator === 'typeof') {
        if (left.kind !== 'field') throw new Error('typeof requires a field reference');
        const type = tokens[index++];
        if (!type || !['string', 'boolean', 'map', 'array', 'integer', 'long', 'double', 'big_decimal'].includes(type.text)) {
          throw new Error('Unsupported typeof type');
        }
        left = { kind: 'binary', operator, left, right: { kind: 'literal', value: type.text } };
      } else {
        const right = binary(level + 1);
        if ((operator === 'in' || operator === 'not in') && right.kind !== 'set') {
          throw new Error('Membership requires a literal set');
        }
        left = { kind: 'binary', operator, left, right };
      }
    }
    return left;
  };
  const node = binary(1);
  if (index !== tokens.length) throw new Error('Unsupported expression syntax');
  return node;
}

export function formatExpressionValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(formatExpressionValue).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).map(([key, item]) => `${key}=${formatExpressionValue(item)}`).join(', ')}}`;
  }
  return String(value);
}

function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]));
}

// Presence checks remain a simulator extension for existing bare/path conditions.
export const expressionTruth = (value: unknown): boolean => typeof value === 'boolean' ? value : value != null;

function evaluate(node: Node, readField: ReadField): unknown {
  if (node.kind === 'literal') return node.value;
  if (node.kind === 'field') return readField(node.path) ?? null;
  if (node.kind === 'set') return new Set(node.values);
  if (node.kind === 'unary') {
    const value = evaluate(node.operand, readField);
    if (node.operator !== '-') return !expressionTruth(value);
    if (typeof value !== 'number') throw new Error('Unary minus requires a number');
    return -value;
  }
  if (node.kind === 'function') return evaluateFunction(node, readField);
  // The upstream parse-tree walker evaluates both sides of Boolean expressions.
  const left = evaluate(node.left, readField);
  const right = evaluate(node.right, readField);
  const operator = node.operator;
  if (operator === 'and' || operator === '&&') return expressionTruth(left) && expressionTruth(right);
  if (operator === 'or' || operator === '||') return expressionTruth(left) || expressionTruth(right);
  if (operator === '==') return equal(left, right);
  if (operator === '!=') return !equal(left, right);
  if (operator === 'in' || operator === 'not in') {
    if (!(right instanceof Set)) return false;
    const found = right.has(left);
    return operator === 'in' ? found : !found;
  }
  if (operator === 'typeof') {
    if (['integer', 'long', 'double', 'big_decimal'].includes(right as string)) {
      throw new Error('Numeric typeof requires Java numeric types unavailable in local simulation');
    }
    if (right === 'map') return left !== null && typeof left === 'object' && !Array.isArray(left);
    if (right === 'array') return Array.isArray(left);
    return typeof left === right;
  }
  if (operator === '=~' || operator === '!~') {
    if (typeof left !== 'string' || typeof right !== 'string') return false;
    let matched: boolean;
    try {
      // Validate before wrapping: an unmatched '[' could consume the wrapper.
      new RegExp(right);
      matched = new RegExp(`^(?:${right})(?![\\s\\S])`).test(left);
    } catch { return false; } // Upstream Boolean operators turn invalid regex into false.
    return operator === '=~' ? matched : !matched;
  }
  if (['<', '<=', '>', '>='].includes(operator)) {
    if (typeof left !== 'number' || typeof right !== 'number') return false;
    if (operator === '<') return left < right;
    if (operator === '<=') return left <= right;
    if (operator === '>') return left > right;
    return left >= right;
  }
  if (operator === '+' && typeof left === 'string' && typeof right === 'string') return left + right;
  if (typeof left !== 'number' || typeof right !== 'number') throw new Error('Arithmetic requires non-null numeric operands');
  if (operator === '%' && (!Number.isInteger(left) || !Number.isInteger(right))) throw new Error('Remainder requires integer operands');
  let result: number;
  if (operator === '+') result = left + right;
  else if (operator === '-') result = left - right;
  else if (operator === '*') result = left * right;
  else if (operator === '/') result = left / right;
  else result = left % right;
  if (!Number.isFinite(result)) throw new Error('Non-finite arithmetic result cannot be represented in a JSON event');
  return result;
}

function evaluateFunction(node: Extract<Node, { kind: 'function' }>, readField: ReadField): unknown {
  const { name, args } = node;
  if (!['length', 'contains', 'startsWith', 'join', 'getMetadata', 'hasTags'].includes(name)) throw new Error(`Unsupported expression function: ${name}`);
  if (name === 'getMetadata' || name === 'hasTags') {
    if (name === 'getMetadata' ? args.length !== 1 : args.length === 0) {
      throw new Error(`${name}() takes ${name === 'getMetadata' ? 'one argument' : 'at least one argument'}`);
    }
    const values = args.map(arg => {
      if (arg.kind === 'field') throw new Error(`${name}() requires string values, not field references`);
      const value = evaluate(arg, readField);
      if (typeof value !== 'string') throw new Error(`${name}() requires strings`);
      return value;
    });
    if (name === 'getMetadata') {
      const key = values[0]!.trim();
      return key ? readField.metadata?.getMetadata(key) ?? null : null;
    }
    if (values.some(value => value === '')) throw new Error('hasTags() requires nonempty strings');
    return readField.metadata?.hasTags(values) ?? false;
  }
  if (name === 'length') {
    if (args.length !== 1) throw new Error('length() takes one argument');
    const value = evaluate(args[0]!, readField);
    if (typeof value === 'string') return value.length;
    if (args[0]!.kind === 'field') {
      if (value == null) return null;
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'object') return Object.keys(value).length;
    }
    throw new Error('Unsupported argument type for length()');
  }
  if (name === 'contains' || name === 'startsWith') {
    if (args.length !== 2) throw new Error(`${name}() takes two arguments`);
    const values: string[] = [];
    for (const arg of args) {
      const value = evaluate(arg, readField);
      if (arg.kind === 'field' && value == null) return false;
      if (typeof value !== 'string') throw new Error(`${name}() requires strings`);
      values.push(value);
    }
    return name === 'contains' ? values[0]!.includes(values[1]!) : values[0]!.startsWith(values[1]!);
  }
  if (args.length !== 1 && args.length !== 2) throw new Error('join() takes one or two arguments');
  const source = args[args.length - 1]!;
  if (source.kind !== 'field') throw new Error('join() requires a field reference');
  const delimiter = args.length === 1 ? ',' : evaluate(args[0]!, readField);
  if (typeof delimiter !== 'string' || args.length === 2 && args[0]!.kind === 'field') throw new Error('join() delimiter must be a string value');
  const separator = delimiter.replace(/\\\\,/g, ',');
  const value = evaluate(source, readField);
  const joinList = (items: unknown[]) => {
    if (items.some(item => item == null)) throw new Error('join() cannot stringify null list elements');
    return items.map(formatExpressionValue).join(separator);
  };
  if (Array.isArray(value)) return joinList(value);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, item] of Object.entries(value)) {
      // Upstream retains a map value when joining that particular value fails.
      result[key] = Array.isArray(item) && item.every(member => member != null) ? joinList(item) : item;
    }
    return result;
  }
  throw new Error('join() source must be a list or map');
}

export function evaluateProcessorExpression(expression: string, readField: (path: string) => unknown, metadata?: ExpressionMetadataContext): unknown {
  const resolver: ReadField = Object.assign((path: string) => readField(path), { metadata });
  const value = evaluate(parse(expression), resolver);
  if (value instanceof Set) throw new Error('Set outputs are not simulated; use sets with in/not in');
  return value;
}
