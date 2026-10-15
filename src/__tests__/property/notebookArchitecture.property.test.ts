// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, expect, it, vi } from 'vitest';
import { createNotebookStore, type NotebookRepository } from '../../features/notebook/state/store';
import { executeNotebookCell } from '../../features/notebook/application/executeCell';
import { execute, executePPL } from '../../services/queryExecutor';
import { executeGrpc } from '../../services/grpcExecutor';
import type { QueryResult } from '../../types/cell';
import type { StoredNotebook } from '../../services/persistence';

const connection = { id: 'cluster', name: 'Cluster', endpoint: 'https://example.test', authType: 'none' as const, credentials: null };
function setup() {
  const saved = new Map<string, StoredNotebook>();
  const repository: NotebookRepository = { loadAll: () => [], activeId: () => null, select: () => {},
    save: vi.fn(record => { saved.set(record.notebook.id, structuredClone(record)); }), remove: id => { saved.delete(id); } };
  return { store: createNotebookStore(repository), repository, saved };
}
const result = (value: string): QueryResult => ({ success: true, statusCode: 200, body: { value }, duration: 1, executedAt: 1 });
function pending() { let resolve!: (value: QueryResult) => void; return { promise: new Promise<QueryResult>(r => { resolve = r; }), resolve: (value: QueryResult) => resolve(value) }; }
afterEach(() => vi.useRealTimers());

it('writes completion and tracking to the originating notebook after selection changes', async () => {
  const { store, saved } = setup();
  try {
    const a = store.create('A'); const cellId = a.cells[0]!.id;
    store.dispatch({ type: 'UPDATE_CELL', payload: { cellId, updates: { endpoint: '/logs/_search' } } });
    const delayed = pending();
    const running = executeNotebookCell(store, cellId, connection, false, { execute: () => delayed.promise, executePPL, executeGrpc });
    const b = store.create('B');
    delayed.resolve(result('A')); await running; await store.flush();
    expect(store.getSnapshot().activeNotebook?.id).toBe(b.id);
    expect(store.getSnapshot().tracking.operations).toEqual([]);
    expect(saved.get(a.id)?.notebook.cells[0]).toMatchObject({ lastResult: result('A') });
    expect(saved.get(a.id)?.tracking.operations).toHaveLength(1);
    store.select(a.id);
    expect(store.getSnapshot().tracking.operations).toHaveLength(1);
    expect(store.getSnapshot().ui.executingCellIds.size).toBe(0);
  } finally { store.dispose(); }
});

it('rejects old completions and keeps the newest run busy until it finishes', async () => {
  const { store } = setup();
  try {
    const cellId = store.create('A').cells[0]!.id;
    const first = pending(); const second = pending();
    const client = vi.fn<typeof execute>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const one = executeNotebookCell(store, cellId, connection, false, { execute: client, executePPL, executeGrpc });
    const two = executeNotebookCell(store, cellId, connection, false, { execute: client, executePPL, executeGrpc });
    expect(client.mock.calls[0]?.[2]?.signal?.aborted).toBe(true);
    first.resolve(result('old')); await one;
    expect(store.getSnapshot().ui.executingCellIds.has(cellId)).toBe(true);
    second.resolve(result('new')); await two;
    expect(store.getSnapshot().activeNotebook?.cells[0]).toMatchObject({ lastResult: result('new') });
    expect(store.getSnapshot().ui.executingCellIds.size).toBe(0);
  } finally { store.dispose(); }
});

it('does not resurrect a deleted document when a canceled transport completes late', async () => {
  const { store, saved } = setup();
  try {
    const document = store.create('A'); const delayed = pending();
    const running = executeNotebookCell(store, document.cells[0]!.id, connection, false, { execute: () => delayed.promise, executePPL, executeGrpc });
    await store.remove(document.id); delayed.resolve(result('late')); await running; await store.flush();
    expect(store.getDocument(document.id)).toBeUndefined();
    expect(saved.has(document.id)).toBe(false);
  } finally { store.dispose(); }
});

it('coalesces edits into one write and flushes the correct snapshot before switching', async () => {
  vi.useFakeTimers();
  const { store, repository, saved } = setup();
  try {
    const a = store.create('A'); const b = store.create('B'); store.select(a.id); await store.flush();
    vi.mocked(repository.save).mockClear();
    for (const body of ['a', 'ab', 'abc']) store.dispatch({ type: 'UPDATE_CELL', payload: { cellId: a.cells[0]!.id, updates: { body } } });
    expect(repository.save).not.toHaveBeenCalled();
    store.select(b.id); await store.flush();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(saved.get(a.id)?.notebook.cells[0]).toMatchObject({ body: 'abc' });
    vi.runAllTimers(); expect(repository.save).toHaveBeenCalledTimes(1);
  } finally { store.dispose(); }
});

it('preserves cell identity, beginning insertion, and order invariants', () => {
  const { store } = setup();
  try {
    const original = store.create('A').cells[0]!;
    store.dispatch({ type: 'UPDATE_CELL', payload: { cellId: original.id, updates: { id: 'bad', type: 'markdown', createdAt: 0 } } });
    expect(store.getSnapshot().activeNotebook?.cells[0]).toMatchObject({ id: original.id, type: original.type, createdAt: original.createdAt });
    const added = store.addCell('ppl', '__BEGINNING__')!;
    const before = store.getSnapshot().activeNotebook;
    expect(before?.cells[0]?.id).toBe(added.id);
    store.dispatch({ type: 'REORDER_CELLS', payload: [original.id, original.id] });
    expect(store.getSnapshot().activeNotebook).toBe(before);
  } finally { store.dispose(); }
});

it('retains unsaved edits and exposes errors until a successful retry', async () => {
  const { store, repository, saved } = setup();
  try {
    const document = store.create('A'); await store.flush();
    const save = repository.save;
    repository.save = () => { throw new Error('Storage full'); };
    store.dispatch({ type: 'RENAME_NOTEBOOK', payload: 'Unsaved' });
    expect(await store.flush()).toBe(false);
    expect(store.getSnapshot().saveError).toBe('Storage full');
    expect(store.getSnapshot().activeNotebook?.name).toBe('Unsaved');
    repository.save = save;
    expect(await store.flush()).toBe(true);
    expect(saved.get(document.id)?.notebook.name).toBe('Unsaved');
  } finally { store.dispose(); }
});
