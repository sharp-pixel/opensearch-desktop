// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { describe, expect, it, vi } from 'vitest';
import type * as Monaco from 'monaco-editor';
import { jsonEditorCompletionProvider, pplEditorCompletionProvider, registerScopedCompletions } from '../../services/editorCompletions';
import { parseJsonContext, getQueryDslSuggestions } from '../../services/autocompleteProvider';
import { getCompletions } from '../../services/ismAutocomplete';
import { getPPLSuggestions, parsePPLContext } from '../../services/pplAutocomplete';

const kinds = { Field: 1, Property: 2, Value: 3, Folder: 4, Function: 5, Keyword: 6 };
const monaco = { languages: { CompletionItemKind: kinds } } as unknown as typeof Monaco;
function fixture(marked: string) {
  const offset = marked.indexOf('§');
  const text = marked.replace('§', '');
  const getPositionAt = (index: number) => {
    const lines = text.slice(0, index).split('\n');
    return { lineNumber: lines.length, column: lines[lines.length - 1]!.length + 1 };
  };
  const getOffsetAt = (position: Monaco.IPosition) => text.split('\n').slice(0, position.lineNumber - 1).reduce((n, line) => n + line.length + 1, 0) + position.column - 1;
  const model = { getValue: () => text, getOffsetAt, getPositionAt } as Monaco.editor.ITextModel;
  return { text, offset, model, position: getPositionAt(offset) as Monaco.Position };
}
async function suggestions(provider: Monaco.languages.CompletionItemProvider, input: ReturnType<typeof fixture>) {
  return (await provider.provideCompletionItems(input.model, input.position, {} as Monaco.languages.CompletionContext, {} as Monaco.CancellationToken))?.suggestions ?? [];
}
function apply(input: ReturnType<typeof fixture>, item: Monaco.languages.CompletionItem) {
  const range = item.range as Monaco.IRange;
  const start = input.model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
  const end = input.model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
  return input.text.slice(0, start) + item.insertText + input.text.slice(end);
}
const labels = (items: Monaco.languages.CompletionItem[]) => items.map(item => item.label);

describe('Completion review regressions', () => {
  it('A01 scopes providers to the requesting editor and disposes on unmount', async () => {
    const first = fixture('source=§');
    const other = fixture('source=§');
    const providers: Monaco.languages.CompletionItemProvider[] = [];
    const dispose = vi.fn();
    let onDispose!: () => void;
    const api = { languages: { ...monaco.languages, registerCompletionItemProvider: (_: string, provider: Monaco.languages.CompletionItemProvider) => { providers.push(provider); return { dispose }; } } } as unknown as typeof Monaco;
    const editor = { getModel: () => first.model, onDidDispose: (callback: () => void) => { onDispose = callback; return { dispose: vi.fn() }; } } as unknown as Monaco.editor.IStandaloneCodeEditor;
    let indices = ['first-cluster'];
    registerScopedCompletions(api, editor, 'ppl', pplEditorCompletionProvider(api, () => indices));
    expect(labels(await suggestions(providers[0]!, first))).toContain('first-cluster');
    expect(await suggestions(providers[0]!, other)).toEqual([]);
    indices = ['new-cluster'];
    expect(labels(await suggestions(providers[0]!, first))).toContain('new-cluster');
    expect(labels(await suggestions(providers[0]!, first))).not.toContain('first-cluster');
    onDispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it.each([
    ['{"query":{"bool":{"must":[{}, {§}]}}}', 'match'],
    ['{"query":{"bool":{"must":[{}]},§}}', 'match'],
    ['{"query":{"bool":{"must":[{}]}},§}', 'size'],
    ['{"query":{"range":{"price":{§}}}}', 'gte'],
  ])('A02 restores JSON context after array elements: %s', async (text, expected) => {
    const input = fixture(text);
    expect(labels(await suggestions(jsonEditorCompletionProvider(monaco, 'dsl'), input))).toContain(expected);
  });

  it('A02 handles an escaped backslash before a string terminator', () => {
    const prefix = '{"query":{"term":{"path":' + JSON.stringify('C:\\') + '}},';
    expect(parseJsonContext(prefix, prefix.length).path).toEqual([]);
    expect(getQueryDslSuggestions(parseJsonContext(prefix, prefix.length)).some(s => s.field === 'size')).toBe(true);
  });

  it.each(['{"query":{"bo§ol":{}}}', '{"query":{"§":{}}}'])('A03 replaces the complete quoted DSL key: %s', async text => {
    const input = fixture(text);
    const items = await suggestions(jsonEditorCompletionProvider(monaco, 'dsl'), input);
    const item = items.find(item => item.label === 'bool')!;
    expect(item.filterText).toBe(JSON.stringify('bool'));
    expect(JSON.parse(apply(input, item))).toEqual({ query: { bool: {} } });
  });

  it('A03 does not suggest DSL property names inside scalar values', async () => {
    expect(await suggestions(jsonEditorCompletionProvider(monaco, 'dsl'), fixture('{"size": §}'))).toEqual([]);
    expect(await suggestions(jsonEditorCompletionProvider(monaco, 'dsl'), fixture('{"query":{"match":{"message":"§"}}}'))).toEqual([]);
  });

  it.each([
    ['{"policy":{§}}', 'default_state', 'rollover'],
    ['{"policy":{"default_state":"hot","states":[{§}]}}', 'actions', 'hot'],
    ['{"policy":{"default_state":"hot","states":[{"name":"hot","actions":[{§}]}]}}', 'rollover', 'state_name'],
    ['{"policy":{"states":[{"actions":[],"transitions":[{§}]}]}}', 'state_name', 'rollover'],
    ['{"policy":{"states":[{"actions":[],"transitions":[{"state_name":"cold","conditions":{§}}]}]}}', 'min_index_age', 'rollover'],
    ['{"policy":{"states":[{"actions":[{"replica_count":{§}}]}]}}', 'number_of_replicas', 'rollover'],
  ])('A04 offers ISM completions for the current container: %s', async (text, expected, absent) => {
    const items = await suggestions(jsonEditorCompletionProvider(monaco, 'ism'), fixture(text));
    expect(labels(items)).toContain(expected);
    expect(labels(items)).not.toContain(absent);
  });

  it('A04 completes state references from later definitions in an incomplete policy', async () => {
    const input = fixture('{"policy":{"default_state":"co§","states":[{"name":"hot"},{"name":"cold"}]}}');
    const items = await suggestions(jsonEditorCompletionProvider(monaco, 'ism'), input);
    expect(labels(items)).toEqual(['hot', 'cold']);
    expect(JSON.parse(apply(input, items.find(item => item.label === 'cold')!)).policy.default_state).toBe('cold');
  });

  it('A04 inserts an action without duplicate quotes and preserves existing values', async () => {
    const input = fixture('{"policy":{"states":[{"actions":[{"roll§"}]}]}}');
    const items = await suggestions(jsonEditorCompletionProvider(monaco, 'ism'), input);
    expect(JSON.parse(apply(input, items.find(item => item.label === 'rollover')!)).policy.states[0].actions[0]).toHaveProperty('rollover');
    const existing = fixture('{"policy":{"def§ault_state":"hot"}}');
    const existingItems = await suggestions(jsonEditorCompletionProvider(monaco, 'ism'), existing);
    expect(JSON.parse(apply(existing, existingItems.find(item => item.label === 'default_state')!)).policy.default_state).toBe('hot');
    expect(getCompletions(null, { line: 1, column: 1 }, '{"policy":{"description":"')).toEqual([]);
  });

  it.each(['source=logs-20§25', 'source=`logs-20§25`'])('A05 replaces the entire PPL index token: %s', async text => {
    const input = fixture(text);
    const items = await suggestions(pplEditorCompletionProvider(monaco, () => ['logs-2026']), input);
    const inserted = apply(input, items.find(item => item.label === 'logs-2026')!);
    expect(inserted).toBe(text.includes('`') ? 'source=`logs-2026`' : 'source=logs-2026');
  });

  it('A05 ignores quoted pipes, parentheses and comments', () => {
    const text = 'source=logs | where message="a | (b" ';
    expect(parsePPLContext(text, text.length).position).toBe('in_where');
    for (const prefix of ['source=logs | where message="', 'source=logs // fields ', "source=logs | eval message='a | "]) {
      expect(getPPLSuggestions(prefix, prefix.length)).toEqual([]);
    }
    expect(getPPLSuggestions('explain ', 8).map(s => s.label)).toEqual(['source']);
    expect(getPPLSuggestions('source=logs-', 12).map(s => s.label)).toContain('logs-*');
  });
  it.each([
    '{"query":{"bool":{"must":[{"match":{"message":{§}}}]}}}',
    '{"query":{"match":{§}}}',
    '{"aggs":{§}}',
    '{"aggs":{"by_status":{"terms":{§}}}}',
  ])('A06 does not offer unrelated DSL fields in user-defined or unsupported objects: %s', async text => {
    expect(await suggestions(jsonEditorCompletionProvider(monaco, 'dsl'), fixture(text))).toEqual([]);
  });

  it('A06 offers aggregation types inside a named aggregation', async () => {
    expect(labels(await suggestions(jsonEditorCompletionProvider(monaco, 'dsl'), fixture('{"aggs":{"by_status":{§}}}')))).toContain('terms');
  });

  it('A07 does not throw for an incomplete or unknown ISM action name', async () => {
    const key = JSON.stringify('bad"action');
    const input = fixture('{"policy":{"states":[{"actions":[{' + key + ':{§}}]}]}}');
    expect(await suggestions(jsonEditorCompletionProvider(monaco, 'ism'), input)).toEqual([]);
  });

  it.each(['// } ] "fake": {\n', '/* } ] "fake": { */'])('A07 ignores JSON comments when determining completion context: %s', async comment => {
    const input = fixture('{"query":{' + comment + '§}}');
    expect(labels(await suggestions(jsonEditorCompletionProvider(monaco, 'dsl'), input))).toContain('bool');
  });

  it('A07 suppresses manual completion inside a JSON comment', async () => {
    for (const comment of ['// comment §\n', '/* comment § */']) {
      expect(await suggestions(jsonEditorCompletionProvider(monaco, 'dsl'), fixture('{"query":{' + comment + '}}'))).toEqual([]);
    }
  });

});


describe('Live mapped field completions', () => {
  const fields = [
    { name: 'user.name', types: ['keyword'], indices: ['logs'] },
    { name: 'message.keyword', types: ['keyword'], indices: ['logs'] },
    { name: 'events', types: ['nested'], indices: ['logs'] },
    { name: 'display name', types: ['text'], indices: ['logs'] },
  ];
  it.each([
    '{"query":{"match":{"us§":"Jane"}}}',
    '{"query":{"range":{"us§":{"gte":1}}}}',
    '{"query":{"exists":{"field":"us§"}}}',
    '{"sort":[{"us§":"asc"}]}',
    '{"aggs":{"users":{"terms":{"field":"us§"}}}}',
    '{"_source":["us§"]}',
    '{"query":{"multi_match":{"fields":["us§"]}}}',
    '{"highlight":{"fields":{"us§":{}}}}',
  ])('completes a mapped field in DSL: %s', async text => {
    const input = fixture(text);
    const source = vi.fn().mockResolvedValue(fields);
    const items = await suggestions(jsonEditorCompletionProvider(monaco, 'dsl', source), input);
    const item = items.find(item => item.label === 'user.name')!;
    expect(item.detail).toBe('keyword');
    expect(item.documentation).toContain('logs');
    expect(() => JSON.parse(apply(input, item))).not.toThrow();
    expect(apply(input, item)).toContain('"user.name"');
    expect(source).toHaveBeenCalledOnce();
  });

  it('suggests only nested mappings for a nested query path', async () => {
    const items = await suggestions(jsonEditorCompletionProvider(monaco, 'dsl', async () => fields), fixture('{"query":{"nested":{"path":"§"}}}'));
    expect(labels(items)).toEqual(['events']);
  });

  it.each(['{"query":{"match":{"message":"§"}}}', '{"size":§}', '{"aggs":{"x":{"terms":{§}}}}', '{"query":{§}}'])('does not fetch metadata outside a DSL field position: %s', async text => {
    const source = vi.fn().mockResolvedValue(fields);
    await suggestions(jsonEditorCompletionProvider(monaco, 'dsl', source), fixture(text));
    expect(source).not.toHaveBeenCalled();
  });

  it.each(['source=logs | fields us§', 'source=logs | where us§', 'source=logs | stats count(us§)', 'source=logs | sort us§'])('suggests and quotes mapped PPL fields: %s', async text => {
    const input = fixture(text);
    const items = await suggestions(pplEditorCompletionProvider(monaco, () => [], async () => fields), input);
    const item = items.find(item => item.label === 'user.name')!;
    expect(item.kind).toBe(kinds.Field);
    expect(item.detail).toBe('keyword');
    expect(apply(input, item)).toContain('`user.name`');
  });

  it('preserves one pair of backticks for fields with spaces', async () => {
    const input = fixture('source=logs | fields `display na§me`');
    const items = await suggestions(pplEditorCompletionProvider(monaco, () => [], async () => fields), input);
    expect(apply(input, items.find(item => item.label === 'display name')!)).toBe('source=logs | fields `display name`');
  });

  it('skips mapping requests in PPL source clauses and literal strings', async () => {
    for (const text of ['source=lo§', 'source=logs | where message="us§"']) {
      const source = vi.fn().mockResolvedValue(fields);
      await suggestions(pplEditorCompletionProvider(monaco, () => ['logs'], source), fixture(text));
      expect(source).not.toHaveBeenCalled();
    }
  });

  it('keeps PPL command suggestions available when mappings fail', async () => {
    const source = vi.fn().mockRejectedValue(new Error('Offline'));
    const items = await suggestions(pplEditorCompletionProvider(monaco, () => [], source), fixture('source=logs | stats §'));
    expect(labels(items)).toContain('count');
  });

  it('discards a delayed mapping response when the editor text changes', async () => {
    let finish!: (value: typeof fields) => void;
    const source = () => new Promise<typeof fields>(resolve => { finish = resolve; });
    const input = fixture('source=logs | fields §');
    const pending = suggestions(pplEditorCompletionProvider(monaco, () => [], source), input);
    input.model.getValue = () => 'source=metrics | fields ';
    finish(fields);
    expect(await pending).toEqual([]);
  });
});
