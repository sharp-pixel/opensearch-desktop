// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { execute } from '../../services/queryExecutor';
import { executeFederated } from '../../services/federatedExecutor';
import { AppProvider } from '../../app/AppProviders';
import { useNotebook, useTracking } from '../../features/notebook/ui/NotebookContext';
import { encryptData, decryptData } from '../../utils/crypto';
import { signRequest } from '../../utils/sigv4';
import { applyGrok } from '../../services/processors/grok';
import type { HttpMethod } from '../../types/cell';

const connection = { id: 'a', name: 'A', endpoint: 'https://cluster.example', authType: 'none' as const, credentials: null };
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  sessionStorage.clear();
});
const cell = (method: HttpMethod, endpoint: string, body: string) => ({ id: 'x', type: 'query' as const, method, endpoint, body, createdAt: 0, updatedAt: 0 });

it.each(['GET', 'HEAD'] as const)('R08 rejects unsupported %s bodies instead of discarding filters', async (method) => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const result = await execute(connection, cell(method, '/logs/_search', '{"query":{"match_none":{}}}'));
  expect(result.success).toBe(false);
  expect(JSON.stringify(result.body)).toContain('POST');
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(['/_bulk', '/logs/_bulk?refresh=true', '/_msearch', '/_msearch/template'])('R09 sends newline-terminated NDJSON to %s', async (endpoint) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  const body = '{}\n{"query":{"match_all":{}}}';
  expect((await execute(connection, cell('POST', endpoint, body))).success).toBe(true);
  expect(fetchMock.mock.calls[0]![1].body).toBe(body + '\n');
  expect(fetchMock.mock.calls[0]![1].headers['Content-Type']).toBe('application/x-ndjson');
});

it('R09 rejects a malformed NDJSON line before sending', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const result = await execute(connection, cell('POST', '/_bulk', '{}\ninvalid'));
  expect(result.success).toBe(false);
  expect(JSON.stringify(result.body)).toContain('2');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('R08 preserves DELETE request bodies', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  await execute(connection, cell('DELETE', '/_search/scroll', '{"scroll_id":"abc"}'));
  expect(fetchMock.mock.calls[0]![1].body).toBe('{"scroll_id":"abc"}');
});

it('R07 aligns reordered, missing, additional and conflicting columns across clusters', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ schema: [{ name: 'name', type: 'string' }, { name: 'count', type: 'long' }], datarows: [['alpha', 1]] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ schema: [{ name: 'count', type: 'string' }, { name: 'extra', type: 'boolean' }, { name: 'name', type: 'string' }], datarows: [['2', false, 'beta']] }))));
  const result = await executeFederated('source=logs', { id: 'g', name: 'g', connectionIds: ['a', 'b'] }, [connection, { ...connection, id: 'b', name: 'B' }]);
  expect(result.consolidatedSchema.map(c => c.name)).toEqual(['name', 'count', 'extra']);
  expect(result.consolidatedRows.map(r => r.data)).toEqual([['alpha', 1, null], ['beta', '2', false]]);
  expect(result.consolidatedSchema[1]!.type).toBe('unknown');
});

it('R11 concurrent first encryption uses a single persisted key', async () => {
  const values = await Promise.all(['first', 'second', 'third'].map(encryptData));
  expect(await Promise.all(values.map(decryptData))).toEqual(['first', 'second', 'third']);
});

it('R12 new notebooks start with empty tracking and permissions', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let notebook!: ReturnType<typeof useNotebook>;
  let tracking!: ReturnType<typeof useTracking>;
  function Probe() {
    const n = useNotebook(); const t = useTracking();
    useEffect(() => { notebook = n; tracking = t; }, [n, t]);
    return null;
  }
  root = createRoot(document.createElement('div'));
  await act(async () => root!.render(React.createElement(AppProvider, null, React.createElement(Probe))));
  await act(async () => notebook.createNewNotebook('one'));
  await act(async () => tracking.trackOperation({ method: 'DELETE', endpoint: '/logs', indexPatterns: ['logs'], timestamp: 0, cellId: 'one' }));
  expect(tracking.operations).toHaveLength(1);
  await act(async () => notebook.createNewNotebook('two'));
  expect(tracking.operations).toEqual([]);
  expect(tracking.permissions).toEqual([]);
});

it.each([
  ['q=status:200', 'q=status%3A200'],
  ['q=a=b', 'q=a%3Db'],
  ['z=1&A=2&a=3', 'a=3&z=1&A=2'],
  ['q=z&q=a', 'q=a&q=z'],
  ['q=+', 'q=%2B'],
])('R13 signs equivalent query encodings identically: %s', async (left, right) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  const credentials = { accessKeyId: 'test', secretAccessKey: 'test', region: 'us-east-1', service: 'es' as const };
  const a = await signRequest('GET', `https://cluster.example/_search?${left}`, credentials);
  const b = await signRequest('GET', `https://cluster.example/_search?${right}`, credentials);
  expect(a.Authorization).toBe(b.Authorization);
});

it('R14 nested and raw regex captures retain their correct field names', () => {
  const result = applyGrok({ message: 'hello 42 end' }, { match: { message: ['%{PAIR:pair} %{WORD:last}'] }, pattern_definitions: { PAIR: '(hello) %{NUMBER:number}' } });
  expect(result).toMatchObject({ pair: 'hello 42', number: '42', last: 'end' });
});

it('R14 extracts nested fields from built-in Apache patterns', () => {
  const result = applyGrok({ message: '127.0.0.1 - bob [10/Oct/2000:13:55:36 -0700] "GET /index HTTP/1.0" 200 123' }, { match: { message: ['%{COMMONAPACHELOG}'] } });
  expect(result).toMatchObject({ clientip: '127.0.0.1', auth: 'bob', verb: 'GET', request: '/index', httpversion: '1.0', response: '200', bytes: '123' });
});
