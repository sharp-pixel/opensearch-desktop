// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, expect, it, vi } from 'vitest';
import { createNotebookStore } from '../../features/notebook/state/store';
import { createInvestigationStore } from '../../features/investigation/state/store';
import { saveActiveInvestigationId } from '../../services/investigationPersistence';
import type { StoredNotebook } from '../../services/persistence';
import type { Investigation } from '../../types/investigation';

function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  return { promise: new Promise<T>((yes, no) => { resolve = yes; reject = no; }), resolve, reject };
}
function setup(kind: 'notebook' | 'investigation', initial: string | null = null) {
  const saves = vi.fn();
  if (kind === 'notebook') {
    const records: StoredNotebook[] = ['a', 'b'].map(id => ({ notebook: { id, name: id, connectionId: null, createdAt: 1, updatedAt: 1,
      cells: [{ id: `${id}-cell`, type: 'query', method: 'GET', endpoint: '/', body: '', createdAt: 1, updatedAt: 1 }] }, tracking: { operations: [], permissions: [] } }));
    const loaded = records.map(record => ({ ...record, notebook: { ...record.notebook, name: `Loaded ${record.notebook.id}` } }));
    const waits = new Map(records.map(record => [record.notebook.id, deferred<StoredNotebook>()]));
    const load = vi.fn((id: string) => waits.get(id)!.promise);
    const store = createNotebookStore({ loadAll: () => records, unloadedIds: new Set(['a', 'b']), loadOutputs: load,
      activeId: () => initial, select: () => {}, save: saves, remove: async () => {} });
    return { select: store.select, remove: store.remove, resume: store.resume, dispose: store.dispose,
      active: () => store.getSnapshot().activeNotebook?.id, error: () => store.getSnapshot().loadError,
      busy: () => store.getSnapshot().loadingNotebookId, retry: store.retryLoad,
      exists: (id: string) => !!store.getDocument(id), load, saves,
      finish: (id: string) => waits.get(id)!.resolve(loaded.find(record => record.notebook.id === id)!),
      fail: (id: string) => waits.get(id)!.reject(new Error('Read failed')),
      recover: (id: string) => { waits.set(id, deferred<StoredNotebook>()); },
      create: () => store.create('New').id,
    };
  }
  saveActiveInvestigationId(initial);
  const records: Investigation[] = ['a', 'b'].map(id => ({ id, name: id, clusterGroupId: '', createdAt: 1, updatedAt: 1,
    cells: [{ id: `${id}-cell`, type: 'ppl', query: 'source=logs', createdAt: 1, updatedAt: 1 }] }));
  const waits = new Map(records.map(record => [record.id, deferred<Investigation>()]));
  const load = vi.fn((id: string) => waits.get(id)!.promise);
  const store = createInvestigationStore({ loadAllInvestigations: () => records, loadAllClusterGroups: () => [],
    unloadedIds: new Set(['a', 'b']), loadOutputs: load, saveInvestigation: saves, saveClusterGroup: () => {}, deleteInvestigation: async () => {} });
  return { select: (id: string | null) => id ? store.selectId(id) : store.setInvestigation(null), remove: store.deleteInvestigation,
    resume: store.resume, dispose: store.dispose, active: () => store.getSnapshot().activeInvestigation?.id,
    error: () => store.getSnapshot().loadError, busy: () => store.getSnapshot().loadingInvestigationId, retry: store.retryLoad,
    exists: (id: string) => !!store.getDocument(id), load, saves,
    finish: (id: string) => waits.get(id)!.resolve({ ...records.find(record => record.id === id)!, name: `Loaded ${id}` }),
    fail: (id: string) => waits.get(id)!.reject(new Error('Read failed')),
    recover: (id: string) => { waits.set(id, deferred<Investigation>()); },
    create: () => store.createNewInvestigation('New').id,
  };
}
afterEach(() => localStorage.clear());
for (const kind of ['notebook', 'investigation'] as const) {
  it(`${kind}: opens only selected results, deduplicates reads, and keeps the latest selection`, async () => {
    const f = setup(kind);
    try {
      expect(f.load).not.toHaveBeenCalled();
      const a = f.select('a'); const b = f.select('b'); const aAgain = f.select('a');
      await Promise.resolve(); expect(f.load).toHaveBeenCalledTimes(2);
      f.finish('b'); await b; expect(f.active()).toBeUndefined();
      f.finish('a'); await Promise.all([a, aAgain]); expect(f.active()).toBe('a'); expect(f.busy()).toBeNull();
      await f.select('b'); expect(f.active()).toBe('b'); expect(f.load).toHaveBeenCalledTimes(2);
      expect(f.saves).not.toHaveBeenCalled();
    } finally { f.dispose(); }
  });
  it(`${kind}: retains the current document on read failure and supports retry`, async () => {
    const f = setup(kind);
    try {
      const current = f.create(); const opening = f.select('a'); await Promise.resolve();
      expect(f.active()).toBe(current); f.fail('a'); await opening;
      expect(f.active()).toBe(current); expect(f.error()).toBe('Read failed'); expect(f.busy()).toBeNull();
      f.recover('a'); const retry = f.retry(); await Promise.resolve(); f.finish('a'); await retry;
      expect(f.active()).toBe('a'); expect(f.error()).toBeNull();
    } finally { f.dispose(); }
  });
  it(`${kind}: never resurrects a document deleted while its results were loading`, async () => {
    const f = setup(kind);
    try {
      const opening = f.select('a'); await Promise.resolve(); await f.remove('a');
      f.finish('a'); await opening;
      expect(f.exists('a')).toBe(false); expect(f.active()).toBeUndefined(); expect(f.busy()).toBeNull();
    } finally { f.dispose(); }
  });
  it(`${kind}: survives effect cleanup and resume while the initial document loads`, async () => {
    const f = setup(kind, 'a');
    try {
      expect(f.load).not.toHaveBeenCalled(); f.resume(); f.dispose(); f.resume();
      const opening = f.select('a'); await Promise.resolve(); f.finish('a'); await opening;
      expect(f.active()).toBe('a'); expect(f.busy()).toBeNull(); expect(f.load).toHaveBeenCalledOnce();
    } finally { f.dispose(); }
  });
}
it('restores saved output after a real StrictMode provider remount without duplicate reads', async () => {
  const React = await import('react'); const { createRoot } = await import('react-dom/client');
  const { AppProvider } = await import('../../app/AppProviders');
  const { useNotebook } = await import('../../features/notebook/ui/NotebookContext');
  const { configureNotebookRepository } = await import('../../features/notebook/state/store');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const record: StoredNotebook = { notebook: { id: 'strict', name: 'Strict', cells: [{ id: 'cell', type: 'query', method: 'GET', endpoint: '/', body: '', createdAt: 1, updatedAt: 1 }], connectionId: null, createdAt: 1, updatedAt: 1 }, tracking: { operations: [], permissions: [] } };
  const loaded = structuredClone(record);
  Object.assign(loaded.notebook.cells[0]!, { lastResult: { success: true, statusCode: 200, body: { preserved: true }, duration: 1, executedAt: 1 } });
  const request = deferred<StoredNotebook>(); const load = vi.fn(() => request.promise);
  configureNotebookRepository({ loadAll: () => [record], unloadedIds: new Set(['strict']), loadOutputs: load,
    activeId: () => 'strict', select: () => {}, save: () => {}, remove: () => {} });
  let snapshot!: ReturnType<typeof useNotebook>;
  function Probe() { snapshot = useNotebook(); return null; }
  const root = createRoot(document.createElement('div'));
  try {
    await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(AppProvider, null, React.createElement(Probe)))));
    expect(snapshot.activeNotebook).toBeNull(); expect(snapshot.loadingNotebookId).toBe('strict');
    await React.act(async () => request.resolve(loaded));
    expect(snapshot.activeNotebook?.cells[0]).toMatchObject({ lastResult: { body: { preserved: true } } });
    expect(snapshot.loadingNotebookId).toBeNull(); expect(load).toHaveBeenCalledOnce();
  } finally { await React.act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
