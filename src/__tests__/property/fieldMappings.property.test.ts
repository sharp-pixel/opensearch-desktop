// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, expect, it, vi } from 'vitest';
import type { ConnectionConfig } from '../../types/connection';
import { createFieldSource, fetchMappingFields, mappingTargetForEndpoint, mappingTargetForPPL, parseMappingFields } from '../../services/fieldMappings';

const connection = (): ConnectionConfig => ({ id: 'cluster', name: 'Cluster', endpoint: 'https://example.test', authType: 'none', credentials: null });
const mapping = {
  logs: { mappings: { properties: {
    message: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    user: { properties: { name: { type: 'keyword' } } },
    events: { type: 'nested', properties: { code: { type: 'integer' } } },
    status: { type: 'integer' }, alias: { type: 'alias', path: 'message' },
  } } },
  'logs-2': { mappings: { properties: { status: { type: 'keyword' }, message: { type: 'text' } } } },
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('flattens nested/object properties, multi-fields and aliases, retaining conflicting types', () => {
  const fields = parseMappingFields(mapping);
  expect(fields.find(field => field.name === 'message.keyword')).toMatchObject({ types: ['keyword'] });
  expect(fields.find(field => field.name === 'user.name')).toMatchObject({ types: ['keyword'] });
  expect(fields.find(field => field.name === 'events')).toMatchObject({ types: ['nested'] });
  expect(fields.find(field => field.name === 'events.code')).toMatchObject({ types: ['integer'] });
  expect(fields.find(field => field.name === 'status')).toEqual({ name: 'status', types: ['integer', 'keyword'], indices: ['logs', 'logs-2'] });
  expect(fields.filter(field => field.name === 'message')).toHaveLength(1);
  expect(parseMappingFields({ error: 'forbidden', status: 403 })).toEqual([]);
});

it.each([
  ['/logs-*/_search?size=10', 'logs-*'], ['/logs,metrics/_count', 'logs,metrics'],
  ['/_search', '*'], ['/logs/_validate/query', 'logs'], ['/logs/_explain/123', 'logs'],
  ['/logs/_doc', null], ['/logs%2F_secret/_search', null], ['/{index}/_search', null],
])('resolves DSL mapping target %s', (input, expected) => expect(mappingTargetForEndpoint(input)).toBe(expected));

it.each([
  ['source=logs-* | fields message', 'logs-*'], ['explain source=`logs-2026.01` | where x=1', 'logs-2026.01'],
  ['search source=logs, `metrics-*` | stats count()', 'logs,metrics-*'],
  ['// source=fake\nsource=real | fields a', 'real'], ['source=`unfinished | fields a', null],
  ['source=logs,', null], ['eval text="source=secret"', null], ['source=logs/_search | fields a', null],
])('resolves the leading PPL mapping source %s', (input, expected) => expect(mappingTargetForPPL(input)).toBe(expected));

it('uses authenticated read-only mapping requests and deduplicates in-flight work', async () => {
  let finish!: (value: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal('fetch', fetch);
  const config = { ...connection(), authType: 'basic' as const, credentials: { username: 'test', password: 'fixture' } };
  const first = fetchMappingFields(config, 'logs-*,metrics');
  const second = fetchMappingFields(config, 'logs-*,metrics');
  expect(first).toBe(second);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]).toMatchObject(['https://example.test/logs-*,metrics/_mapping', { method: 'GET', headers: { Authorization: 'Basic ' + btoa('test:fixture') } }]);
  finish(response(mapping));
  expect((await first).some(field => field.name === 'message.keyword')).toBe(true);
  await fetchMappingFields(config, 'logs-*,metrics');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('refreshes after expiry and isolates credential/connection edits', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const fetch = vi.fn().mockImplementation(async () => response(mapping));
  vi.stubGlobal('fetch', fetch);
  const config = connection();
  await fetchMappingFields(config, 'logs');
  await fetchMappingFields({ ...config, endpoint: 'https://second.test' }, 'logs');
  expect(fetch).toHaveBeenCalledTimes(2);
  vi.setSystemTime(60_001);
  await fetchMappingFields(config, 'logs');
  expect(fetch).toHaveBeenCalledTimes(3);
});

it('returns no fields on permission failure, backs off, and recovers', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const fetch = vi.fn().mockResolvedValueOnce(response({ error: 'forbidden' }, 403)).mockImplementation(async () => response(mapping));
  vi.stubGlobal('fetch', fetch);
  const config = connection();
  expect(await fetchMappingFields(config, 'logs')).toEqual([]);
  expect(await fetchMappingFields(config, 'logs')).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.setSystemTime(5001);
  expect((await fetchMappingFields(config, 'logs')).length).toBeGreaterThan(0);
});

it('combines selected investigation clusters and tolerates a failed cluster', async () => {
  const fetch = vi.fn().mockImplementation(async (url: string) => url.includes('second.test') ? response({ metrics: { mappings: { properties: { cpu: { type: 'float' } } } } }) : response(mapping));
  vi.stubGlobal('fetch', fetch);
  const configs = [connection(), { ...connection(), endpoint: 'https://second.test' }];
  const source = createFieldSource(() => configs, mappingTargetForPPL);
  const fields = await source('source=logs | fields ');
  expect(fields.map(field => field.name)).toContain('cpu');
  expect(fields.map(field => field.name)).toContain('message.keyword');
  const partialConfigs: ConnectionConfig[] = [configs[0]!, { ...connection(), authType: 'basic', credentials: null }];
  const withFailure = createFieldSource(() => partialConfigs, mappingTargetForPPL);
  expect((await withFailure('source=logs | fields ')).map(field => field.name)).toContain('message');
});

it('discards late fields after an endpoint or selected connection changes', async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  let configs = [connection()];
  let endpoint = '/logs/_search';
  const source = createFieldSource(() => configs, () => mappingTargetForEndpoint(endpoint));
  const pending = source('');
  endpoint = '/metrics/_search';
  finish(response(mapping));
  expect(await pending).toEqual([]);
  endpoint = '/logs/_search';
  const second = source('');
  configs = [];
  expect(await second).toEqual([]);
});
