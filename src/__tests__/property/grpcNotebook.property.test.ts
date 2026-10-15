// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, expect, it, vi } from 'vitest';
import { createNotebook, addCell, convertCellType, loadNotebook } from '../../services/notebookManager';
import { exportNotebook, importNotebook } from '../../services/notebookIO';
import { grpcTrackedOperation } from '../../services/grpcTracking';
import { executeGrpc } from '../../services/grpcExecutor';
import { saveConnection, loadConnectionsAsync } from '../../services/persistence';
import type { ConnectionConfig } from '../../types/connection';
import type { GrpcCell } from '../../types/cell';

const connection: ConnectionConfig = { id: 'grpc-test', name: 'gRPC cluster', endpoint: 'http://localhost:9200', grpcEndpoint: 'http://localhost:9400', authType: 'none', credentials: null };
const cell: GrpcCell = { id: 'grpc', type: 'grpc', method: 'Search', body: '{}', createdAt: 1, updatedAt: 1 };
afterEach(() => { localStorage.clear(); delete window.__TAURI_INTERNALS__; delete window.electronAPI; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('adds, persists, exports, imports, and converts gRPC cells', () => {
  const { notebook, cell: created } = addCell(createNotebook('gRPC'), 'grpc');
  expect(created).toMatchObject({ type: 'grpc', method: 'Search' });
  expect(loadNotebook(notebook.id)?.cells[0]).toEqual(created);
  expect(importNotebook(exportNotebook(notebook, { operations: [], permissions: [] }))).toMatchObject({ notebook });
  const markdown = convertCellType(notebook, created.id, 'markdown')!;
  expect(markdown.cells[0]).toMatchObject({ type: 'markdown', content: (created as GrpcCell).body });
  const converted = convertCellType(markdown, created.id, 'grpc')!;
  expect(converted.cells[0]).toMatchObject({ id: created.id, type: 'grpc', method: 'Search', body: (created as GrpcCell).body });
});

it('retains gRPC endpoints in encrypted connection storage', async () => {
  await saveConnection(connection);
  expect((await loadConnectionsAsync()).find(c => c.id === connection.id)).toEqual(connection);
});

it('uses the Electron bridge and displays native status codes', async () => {
  const execute = vi.fn().mockResolvedValue({ code: 0, payload: 'CAc=' }); // SearchResponse took=7
  vi.stubGlobal('electronAPI', undefined);
  window.electronAPI = { isElectron: true, grpc: { execute } } as unknown as NonNullable<Window['electronAPI']>;
  const result = await executeGrpc(connection, cell);
  expect(result).toMatchObject({ success: true, grpcStatus: 0, body: { took: '7' } });
  expect(execute).toHaveBeenCalledWith({ endpoint: connection.grpcEndpoint, method: 'Search', payload: '', authorization: undefined, requestId: expect.any(String) });
  delete window.electronAPI;
});

it('uses the Tauri bridge', async () => {
  const invoke = vi.fn().mockResolvedValue({ code: 14, payload: null, error: 'Unavailable' });
  window.__TAURI_INTERNALS__ = { invoke };
  expect(await executeGrpc(connection, cell)).toMatchObject({ success: false, grpcStatus: 14, body: { error: 'Unavailable' } });
  expect(invoke).toHaveBeenCalledWith('grpc_execute', { request: expect.objectContaining({ method: 'Search', payload: '' }) });
  delete window.__TAURI_INTERNALS__;
});

it('accepts the Tauri success response with a null error field', async () => {
  window.__TAURI_INTERNALS__ = { invoke: vi.fn().mockResolvedValue({ code: 0, payload: 'CAc=', error: null }) };
  expect(await executeGrpc(connection, cell)).toMatchObject({ success: true, grpcStatus: 0, body: { took: '7' } });
});

it.each([
  { code: 0, payload: 42 }, { code: '14', payload: null }, { code: 17 }, { code: -1 }, { code: 14, error: {} },
])('rejects a malformed native transport response: %j', async response => {
  window.__TAURI_INTERNALS__ = { invoke: vi.fn().mockResolvedValue(response) };
  expect(await executeGrpc(connection, cell)).toMatchObject({ success: false, grpcStatus: null,
    body: { error: 'Invalid gRPC transport response' } });
});

it('reports missing successful response bytes separately from a transport failure', async () => {
  window.__TAURI_INTERNALS__ = { invoke: vi.fn().mockResolvedValue({ code: 0, payload: null, error: null }) };
  expect(await executeGrpc(connection, cell)).toMatchObject({ success: false, grpcStatus: 0,
    body: { error: 'Missing Protobuf response.' } });
});

it('fails before sending for missing endpoint, IAM auth, or invalid Protobuf', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect(await executeGrpc({ ...connection, grpcEndpoint: undefined }, cell)).toMatchObject({ success: false, grpcStatus: null });
  expect(await executeGrpc({ ...connection, authType: 'sigv4' }, cell)).toMatchObject({ success: false, grpcStatus: null });
  expect(await executeGrpc(connection, { ...cell, body: '{"typo":true}' })).toMatchObject({ success: false, grpcStatus: null });
  expect(fetch).not.toHaveBeenCalled();
});

it('tracks search and bulk index scopes using equivalent permissions', () => {
  expect(grpcTrackedOperation({ ...cell, body: '{"index":["logs-*"]}' })).toMatchObject({ transport: 'grpc', endpoint: '/_search', indexPatterns: ['logs-*'] });
  expect(grpcTrackedOperation({ ...cell, method: 'Bulk', body: JSON.stringify({ index: 'default', bulk_request_body: [
    { operation_container: { index: { x_id: '1' } } },
    { operation_container: { delete: { x_index: 'other', x_id: '2' } } },
  ] }) })).toMatchObject({ transport: 'grpc', endpoint: '/_bulk', indexPatterns: ['default', 'other'] });
});
