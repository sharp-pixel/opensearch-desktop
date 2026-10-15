// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { ConnectionConfig } from '../types/connection';
import { execute } from './queryExecutor';

export interface MappedField {
  name: string;
  types: string[];
  indices: string[];
}
export type FieldSource = (text: string) => Promise<MappedField[]>;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** Merge wildcard-index and multi-cluster mappings, retaining type conflicts. */
export function mergeMappedFields(groups: MappedField[][]): MappedField[] {
  const fields = new Map<string, MappedField>();
  for (const group of groups) for (const field of group) {
    const previous = fields.get(field.name);
    fields.set(field.name, {
      name: field.name,
      types: [...new Set([...(previous?.types ?? []), ...field.types])].sort(),
      indices: [...new Set([...(previous?.indices ?? []), ...field.indices])].sort(),
    });
  }
  return [...fields.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function parseMappingFields(response: unknown): MappedField[] {
  const fields: MappedField[] = [];
  function visit(properties: unknown, prefix: string, index: string) {
    for (const [key, value] of Object.entries(record(properties) ?? {})) {
      const definition = record(value);
      if (!definition) continue;
      const name = prefix ? `${prefix}.${key}` : key;
      const type = typeof definition.type === 'string' ? definition.type : definition.properties ? 'object' : 'unknown';
      fields.push({ name, types: [type], indices: [index] });
      visit(definition.properties, name, index);
      visit(definition.fields, name, index);
    }
  }
  for (const [index, value] of Object.entries(record(response) ?? {})) {
    const mappings = record(record(value)?.mappings);
    visit(mappings?.properties, '', index);
  }
  return mergeMappedFields([fields]);
}

function normalizeTarget(value: string): string | null {
  const names = value.split(',').map(name => name.trim());
  if (names.some(name => !name || name === '.' || name === '..' || name.includes('\0') || /[\s/\\{}<>]/.test(name))) return null;
  return names.join(',');
}

/** Search bodies with no index target use the cluster's visible index mappings. */
export function mappingTargetForEndpoint(endpoint: string): string | null {
  const path = endpoint.trim().split('?')[0]!.replace(/^\//, '').replace(/\/$/, '');
  if (['_search', '_count', '_validate/query'].includes(path)) return '*';
  const match = path.match(/^([^/]+)\/(?:_search|_count|_validate\/query|_explain\/[^/]+|_update_by_query|_delete_by_query)$/);
  if (!match) return null;
  try { return normalizeTarget(decodeURIComponent(match[1]!)); } catch { return null; }
}

/** Read only the leading source clause, never source-like text in string values. */
export function mappingTargetForPPL(query: string): string | null {
  const input = query.replace(/^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '');
  const prefix = input.match(/^(?:(?:explain|search)\s+)*source\s*=\s*/i);
  if (!prefix) return null;
  let remaining = input.slice(prefix[0].length);
  const names: string[] = [];
  while (remaining) {
    const match = remaining.match(/^(?:`([^`]+)`|([^\s,|`]+))/);
    if (!match) return null;
    names.push(match[1] ?? match[2]!);
    remaining = remaining.slice(match[0].length).trimStart();
    if (!remaining.startsWith(',')) break;
    remaining = remaining.slice(1).trimStart();
    if (!remaining) return null;
  }
  return normalizeTarget(names.join(','));
}

type CacheEntry = { expires: number; fields: Promise<MappedField[]> };
// Object identity isolates credentials and endpoint edits without storing secrets in keys.
const cache = new WeakMap<ConnectionConfig, Map<string, CacheEntry>>();
const CACHE_TTL = 60_000;
const ERROR_TTL = 5_000;

export function fetchMappingFields(connection: ConnectionConfig, target: string): Promise<MappedField[]> {
  const normalized = normalizeTarget(target);
  if (!normalized) return Promise.resolve([]);
  let entries = cache.get(connection);
  if (!entries) { entries = new Map(); cache.set(connection, entries); }
  const existing = entries.get(normalized);
  if (existing && existing.expires > Date.now()) return existing.fields;
  // Bound per-connection memory while retaining in-flight request deduplication.
  if (entries.size >= 20) entries.delete(entries.keys().next().value!);
  const entry: CacheEntry = { expires: Infinity, fields: Promise.resolve([]) };
  entry.fields = (async () => {
    try {
      const result = await execute(connection, {
        id: 'field-completion', type: 'query', method: 'GET',
        endpoint: '/' + normalized.split(',').map(encodeURIComponent).join(',') + '/_mapping',
        body: '', createdAt: 0, updatedAt: 0,
      }, { timeout: 5000 });
      entry.expires = Date.now() + (result.success ? CACHE_TTL : ERROR_TTL);
      return result.success ? parseMappingFields(result.body) : [];
    } catch {
      entry.expires = Date.now() + ERROR_TTL;
      return [];
    }
  })();
  entries.set(normalized, entry);
  return entry.fields;
}

/** Suppress responses for a connection/endpoint that changed during the request. */
export function createFieldSource(
  getConnections: () => ConnectionConfig[],
  getTarget: (text: string) => string | null,
): FieldSource {
  return async text => {
    const connections = getConnections();
    const target = getTarget(text);
    if (!target || !connections.length) return [];
    const groups = await Promise.all(connections.map(connection => fetchMappingFields(connection, target)));
    const current = getConnections();
    if (getTarget(text) !== target || current.length !== connections.length || current.some((connection, i) => connection !== connections[i])) return [];
    return mergeMappedFields(groups);
  };
}
