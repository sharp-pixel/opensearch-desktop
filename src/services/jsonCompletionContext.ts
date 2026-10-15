// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/** Tolerant JSON cursor scanner: containers retain their own key/value state. */
interface Frame {
  kind: 'object' | 'array';
  path: string[];
  state: 'key' | 'colon' | 'value' | 'after';
  key?: string;
}
export function jsonCompletionContext(text: string, offset: number) {
  const end = Math.max(0, Math.min(offset, text.length));
  const stack: Frame[] = [];
  let stringStart: number | undefined;
  let stringEnd: number | undefined;
  let stringIsKey = false;
  let inComment = false;
  for (let i = 0; i < end; i++) {
    const frame = stack[stack.length - 1];
    const ch = text[i];
    if (/\s/.test(ch || '')) continue;
    stringStart = undefined;
    stringEnd = undefined;
    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      const block = text[i + 1] === '*';
      const close = text.indexOf(block ? '*/' : '\n', i + 2);
      const after = close < 0 ? end : close + (block ? 2 : 1);
      inComment = close < 0 || after > end;
      i = Math.min(after, end) - 1;
      continue;
    }
    if (ch === '"') {
      const start = i;
      const isKey = frame?.kind === 'object' && frame.state === 'key';
      i++;
      while (i < end) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === '"') break;
        i++;
      }
      stringStart = start;
      stringIsKey = isKey;
      if (i < end) {
        stringEnd = i + 1;
        if (frame) {
          if (isKey) {
            try { frame.key = JSON.parse(text.slice(start, i + 1)); } catch { frame.key = text.slice(start + 1, i); }
            frame.state = 'colon';
          } else frame.state = 'after';
        }
      }
      continue;
    }
    if (ch === '{' || ch === '[') {
      const path = frame ? [...frame.path, ...(frame.kind === 'object' && frame.key !== undefined ? [frame.key] : [])] : [];
      if (frame) frame.state = 'after';
      stack.push({ kind: ch === '{' ? 'object' : 'array', path, state: ch === '{' ? 'key' : 'value' });
    } else if (ch === '}' || ch === ']') stack.pop();
    else if (frame && ch === ':') frame.state = 'value';
    else if (frame && ch === ',') { frame.state = frame.kind === 'object' ? 'key' : 'value'; frame.key = undefined; }
    else if (frame) {
      // Skip primitive values without interpreting punctuation inside them as keys.
      while (i + 1 < end && !/[\s,}\]]/.test(text[i + 1]!)) i++;
      frame.state = 'after';
    }
  }
  const frame = stack[stack.length - 1];
  return {
    path: frame?.path ?? [],
    parentKey: frame?.path[frame.path.length - 1],
    key: frame?.key,
    isValue: !inComment && (frame?.state === 'value' || (stringStart !== undefined && !stringIsKey)),
    isProperty: !inComment && frame?.kind === 'object' && (frame.state === 'key' || frame.state === 'colon'),
    stringStart,
    stringEnd,
  };
}

/** Replace the whole JSON string token, including auto-inserted closing quotes. */
export function jsonCompletionRange(text: string, offset: number) {
  const context = jsonCompletionContext(text, offset);
  const start = context.stringStart ?? offset;
  let end = context.stringEnd ?? offset;
  if (context.stringStart !== undefined && context.stringEnd === undefined) {
    for (let i = offset; i < text.length; i++) {
      if (text[i] === '\\') { i++; continue; }
      if (text[i] === '"') { end = i + 1; break; }
      if (text[i] === '\n' || text[i] === '\r') break;
    }
  }
  return { start, end, hasColon: /^\s*:/.test(text.slice(end)) };
}
