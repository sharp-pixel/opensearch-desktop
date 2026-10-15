// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';
import { openWorkspaceDatabase } from '../../storage/workspaceDatabase';
import { createNotebookStore } from '../../features/notebook/state/store';
import { createInvestigationStore } from '../../features/investigation/state/store';
import type { StoredNotebook } from '../../services/persistence';
import type { Investigation } from '../../types/investigation';

const ids = ['a', 'b', 'c', 'd', 'e'];
const output = { success: true, statusCode: 200, body: { kept: true }, duration: 1, executedAt: 1 };
afterEach(() => localStorage.clear());

async function fixture(kind: 'notebook' | 'investigation') {
  const db = await openWorkspaceDatabase(new IDBFactory());
  if (kind === 'notebook') {
    for (const id of ids) await db.save('notebook', { notebook: { id, name: id, connectionId: null, createdAt: 1, updatedAt: 1,
      cells: [{ id: 'cell', type: 'query', method: 'GET', endpoint: '/', body: '', createdAt: 1, updatedAt: 1, lastResult: output }] },
      tracking: { operations: [], permissions: [] } });
    const records = await db.load('notebook', { includeOutputs: false });
    let failSave = false;
    const save = vi.fn((value: StoredNotebook) => failSave ? Promise.reject(new Error('Quota')) : db.save('notebook', value));
    const load = vi.fn((id: string) => db.loadOutputs('notebook', id));
    const store = createNotebookStore({ loadAll: () => records, unloadedIds: new Set(ids), loadOutputs: load,
      releaseOutputs: value => db.releaseOutputs('notebook', value), save, remove: id => db.remove('notebook', id), activeId: () => null, select: () => {} });
    return { db, load, select: store.select, document: store.getDocument, dispose: store.dispose, flush: store.flush, runs: store.runs,
      edit: () => store.dispatch({ type: 'UPDATE_CELL', payload: { cellId: 'cell', updates: { body: '{"edited":true}' } } }),
      fail: (value: boolean) => { failSave = value; },
      disk: () => db.load('notebook'), allOutputs: (values: unknown[]) => values.map(value => (value as StoredNotebook).notebook.cells[0]),
    };
  }
  for (const id of ids) await db.save('investigation', { id, name: id, clusterGroupId: '', createdAt: 1, updatedAt: 1,
    cells: [{ id: 'cell', type: 'ppl', query: 'source=logs', createdAt: 1, updatedAt: 1,
      lastResult: { success: true, clusterResults: [], consolidatedSchema: [], consolidatedRows: [], totalRows: 0, successfulClusters: 0, failedClusters: 0, totalDuration: 1, executedAt: 1 } }] });
  const records = await db.load('investigation', { includeOutputs: false });
  let failSave = false;
  const load = vi.fn((id: string) => db.loadOutputs('investigation', id));
  const store = createInvestigationStore({ loadAllInvestigations: () => records, loadAllClusterGroups: () => [],
    unloadedIds: new Set(ids), loadOutputs: load, releaseOutputs: value => db.releaseOutputs('investigation', value),
    saveInvestigation: (value: Investigation) => failSave ? Promise.reject(new Error('Quota')) : db.save('investigation', value),
    saveClusterGroup: () => {}, deleteInvestigation: id => db.remove('investigation', id) });
  return { db, load, select: store.selectId, document: store.getDocument, dispose: store.dispose, flush: store.saveCurrentInvestigation, runs: store.runs,
    edit: () => store.updateCell('cell', { query: 'source=edited' }), fail: (value: boolean) => { failSave = value; },
    disk: () => db.load('investigation'), allOutputs: (values: unknown[]) => values.map(value => (value as Investigation).cells[0]),
  };
}

for (const kind of ['notebook', 'investigation'] as const) {
  it(`${kind}: releases older inactive results from memory and reloads them without deleting disk results`, async () => {
    const f = await fixture(kind);
    try {
      for (const id of ['a', 'b', 'c', 'd']) await f.select(id);
      expect(f.document('a')?.cells[0]).not.toHaveProperty('lastResult');
      for (const id of ['b', 'c', 'd']) expect(f.document(id)?.cells[0]).toHaveProperty('lastResult');
      await f.select('a');
      expect(f.load.mock.calls.filter(([id]) => id === 'a')).toHaveLength(2);
      expect(f.document('a')?.cells[0]).toHaveProperty('lastResult');
      // Read back the persisted documents to verify that memory eviction never deletes results.
      const values = await f.disk();
      expect(f.allOutputs(values).every(cell => cell && 'lastResult' in cell)).toBe(true);
    } finally { f.dispose(); f.db.close(); }
  });

  it(`${kind}: pins failed saves and running documents until their work is safe to release`, async () => {
    const f = await fixture(kind);
    try {
      await f.select('a');
      const run = f.runs.begin({ feature: kind, documentId: 'a', cellId: 'cell', connectionId: 'test', inputRevision: 1 });
      await f.select('b'); f.fail(true); f.edit();
      expect(await f.flush()).toBe(false);
      for (const id of ['c', 'd', 'e']) await f.select(id);
      expect(f.document('a')?.cells[0]).toHaveProperty('lastResult');
      expect(f.document('b')?.cells[0]).toHaveProperty('lastResult');
      run.finish(); f.fail(false); expect(await f.flush()).toBe(true);
      await Promise.resolve();
      expect(f.document('a')?.cells[0]).not.toHaveProperty('lastResult');
      expect(f.document('b')?.cells[0]).not.toHaveProperty('lastResult');
      await f.select('b');
      expect(f.document('b')?.cells[0]).toHaveProperty('lastResult');
      expect(f.document('b')?.cells[0]).toMatchObject(kind === 'notebook' ? { body: '{"edited":true}' } : { query: 'source=edited' });
    } finally { f.dispose(); f.db.close(); }
  });
}
