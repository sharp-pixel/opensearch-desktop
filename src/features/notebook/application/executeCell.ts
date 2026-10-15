// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { cellInput, connectionInput } from '../../../execution/provenance';
import type { NotebookStore } from '../state/store';
import type { ConnectionConfig } from '../../../types/connection';
import { execute, executePPL, extractPPLIndex } from '../../../services/queryExecutor';
import { executeGrpc } from '../../../services/grpcExecutor';
import { grpcTrackedOperation } from '../../../services/grpcTracking';
import { extractIndexPatterns } from '../../../services/endpointParser';

const clients = { execute, executePPL, executeGrpc };
export async function executeNotebookCell(store: NotebookStore, cellId: string, connection: ConnectionConfig,
  profile = false, executor = clients) {
  if (connection.credentialError) throw new Error(connection.credentialError);
  const notebook = store.getSnapshot().activeNotebook;
  const source = notebook?.cells.find(cell => cell.id === cellId);
  if (!notebook || !source || source.type === 'markdown') return;
  const cell = structuredClone(source);
  const config = structuredClone(connection);
  const documentId = notebook.id;
  const run = store.runs.begin({ feature: 'notebook', documentId, cellId, connectionId: config.id, inputRevision: cell.updatedAt });
  const provenance = { runId: run.id, input: cellInput(cell), connection: connectionInput(config) };
  const options = { signal: run.signal };
  store.dispatch({ type: 'SET_CELL_EXECUTING', payload: { cellId, executing: true } }, documentId);
  try {
    if (cell.type === 'grpc') {
      const result = await executor.executeGrpc(config, cell, options);
      if (!run.isCurrent()) return;
      store.dispatch({ type: 'SET_GRPC_RESULT', payload: { cellId, result: { ...result, source: provenance } } }, documentId);
      if (result.success) store.dispatch({ type: 'TRACK_OPERATION', payload: grpcTrackedOperation(cell) }, documentId);
      return result;
    }
    if (cell.type === 'ppl') {
      const result = await executor.executePPL(config, cell.query, cellId, options);
      if (!run.isCurrent()) return;
      store.dispatch({ type: 'SET_PPL_RESULT', payload: { cellId, result: { ...result, source: provenance } } }, documentId);
      if (result.success) store.dispatch({ type: 'TRACK_OPERATION', payload: {
        method: 'POST', endpoint: '/_plugins/_ppl', indexPatterns: extractPPLIndex(cell.query) ? [extractPPLIndex(cell.query)!] : [], timestamp: Date.now(), cellId,
      } }, documentId);
      return result;
    }
    const request = { ...cell };
    if (profile) {
      const body: unknown = cell.body.trim() ? JSON.parse(cell.body) : {};
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Profiling requires a JSON object');
      request.body = JSON.stringify({ ...body, profile: true }, null, 2);
      const [path, query] = cell.endpoint.split('?');
      const params = new URLSearchParams(query); params.set('phase_took', 'true');
      request.endpoint = `${path}?${params}`;
    }
    const result = await executor.execute(config, request, options);
    if (!run.isCurrent()) return;
    store.dispatch({ type: 'SET_QUERY_RESULT', payload: { cellId, result: { ...result, source: provenance } } }, documentId);
    if ((result.success || result.statusCode > 0) && result.statusCode !== 405) store.dispatch({ type: 'TRACK_OPERATION', payload: {
      method: cell.method, endpoint: cell.endpoint, indexPatterns: extractIndexPatterns(cell.endpoint), timestamp: Date.now(), cellId,
    } }, documentId);
    return result;
  } finally {
    if (run.isCurrent()) store.dispatch({ type: 'SET_CELL_EXECUTING', payload: { cellId, executing: false } }, documentId);
    run.finish();
  }
}
