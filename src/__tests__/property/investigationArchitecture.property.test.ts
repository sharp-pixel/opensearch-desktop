// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, expect, it, vi } from 'vitest';
import { createInvestigationStore } from '../../features/investigation/state/store';
import { executeInvestigationCell } from '../../features/investigation/application/executeCell';
import { loadInvestigation } from '../../services/investigationPersistence';
import type { FederatedPPLResult } from '../../types/investigation';
const result: FederatedPPLResult = { success: true, clusterResults: [], consolidatedSchema: [], consolidatedRows: [], totalRows: 0, successfulClusters: 1, failedClusters: 0, totalDuration: 1, executedAt: 1 };
afterEach(() => { localStorage.clear(); vi.useRealTimers(); });

it('preserves an investigation result across selection changes and persists it to its owner', async () => {
  const store = createInvestigationStore();
  try {
    const first = store.createNewInvestigation('First');
    store.addCell('ppl'); store.updateClusterGroup(['a']);
    const cellId = store.getSnapshot().activeInvestigation!.cells[0]!.id;
    store.updateCell(cellId, { query: 'source=logs' });
    let resolve!: (value: FederatedPPLResult) => void;
    const execute = vi.fn(() => new Promise<FederatedPPLResult>(r => { resolve = r; }));
    const pending = executeInvestigationCell(store, cellId, [], execute);
    const second = store.createNewInvestigation('Second');
    resolve(result); await pending; await store.saveCurrentInvestigation();
    expect(store.getSnapshot().activeInvestigation?.id).toBe(second.id);
    expect(loadInvestigation(first.id)?.cells[0]).toMatchObject({ lastResult: result });
    store.selectId(first.id);
    expect(store.getSnapshot().executingCellIds.size).toBe(0);
    expect(store.getSnapshot().clusterGroup?.connectionIds).toEqual(['a']);
  } finally { store.dispose(); }
});

it('deleting an investigation cancels its run and rejects a late result', async () => {
  const store = createInvestigationStore();
  try {
    const first = store.createNewInvestigation('First'); store.addCell('ppl'); store.updateClusterGroup(['a']);
    const cellId = store.getSnapshot().activeInvestigation!.cells[0]!.id;
    store.updateCell(cellId, { query: 'source=logs' });
    let resolve!: (value: FederatedPPLResult) => void;
    let signal: AbortSignal | undefined;
    const execute = vi.fn((_query, _group, _connections, options) => {
      signal = options?.signal;
      return new Promise<FederatedPPLResult>(r => { resolve = r; });
    });
    const pending = executeInvestigationCell(store, cellId, [], execute);
    await store.deleteInvestigation(first.id);
    expect(signal?.aborted).toBe(true);
    resolve(result); await pending; await store.saveCurrentInvestigation();
    expect(loadInvestigation(first.id)).toBeNull();
    expect(store.getDocument(first.id)).toBeUndefined();
  } finally { store.dispose(); }
});

it('isolates concurrent cell progress and superseded run callbacks', async () => {
  const store = createInvestigationStore();
  const calls: { options: Parameters<typeof import('../../services/federatedExecutor').executeFederated>[3]; finish(value: FederatedPPLResult): void }[] = [];
  const execute = vi.fn((_query, _group, _connections, options) => new Promise<FederatedPPLResult>(finish => calls.push({ options, finish })));
  try {
    store.createNewInvestigation('Parallel'); store.addCell('ppl'); store.addCell('ppl'); store.updateClusterGroup(['a']);
    const [first, second] = store.getSnapshot().activeInvestigation!.cells;
    store.updateCell(first!.id, { query: 'source=first' }); store.updateCell(second!.id, { query: 'source=second' });
    const one = executeInvestigationCell(store, first!.id, [], execute);
    const two = executeInvestigationCell(store, second!.id, [], execute);
    calls[0]!.options?.onClusterStatus?.({ connectionId: 'a', connectionName: 'A', status: 'executing' });
    calls[1]!.options?.onClusterStatus?.({ connectionId: 'a', connectionName: 'A', status: 'error', lastError: 'second failed' });
    expect(store.getSnapshot().cellClusterStatuses.get(first!.id)?.get('a')?.status).toBe('executing');
    expect(store.getSnapshot().cellClusterStatuses.get(second!.id)?.get('a')?.lastError).toBe('second failed');
    expect(store.getSnapshot().clusterStatuses.get('a')?.status).toBe('executing');
    const replacement = executeInvestigationCell(store, first!.id, [], execute);
    calls[0]!.options?.onClusterStatus?.({ connectionId: 'a', connectionName: 'A', status: 'success' });
    expect(store.getSnapshot().cellClusterStatuses.has(first!.id)).toBe(false);
    expect(store.getSnapshot().cellClusterStatuses.get(second!.id)?.get('a')?.status).toBe('error');
    calls.forEach(call => call.finish(result)); await Promise.all([one, two, replacement]);
    store.deleteCell(second!.id);
    expect(store.getSnapshot().cellClusterStatuses.has(second!.id)).toBe(false);
  } finally { await store.saveCurrentInvestigation(); store.dispose(); }
});

it('persists investigation renames through the same document save coordinator', async () => {
  const store = createInvestigationStore();
  try {
    const document = store.createNewInvestigation('Before');
    store.setInvestigation({ ...document, name: 'After' });
    await store.saveCurrentInvestigation();
    expect(loadInvestigation(document.id)?.name).toBe('After');
  } finally { store.dispose(); }
});
