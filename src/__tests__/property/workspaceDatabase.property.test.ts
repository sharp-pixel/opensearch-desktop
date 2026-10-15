// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { IDBFactory } from 'fake-indexeddb';
import { expect, it } from 'vitest';
import { openWorkspaceDatabase, migrateLegacyWorkspace } from '../../storage/workspaceDatabase';
import type { StoredNotebook } from '../../services/persistence';
const record: StoredNotebook = { notebook: { id: 'a', name: 'A', cells: [{ id: 'cell', type: 'query', method: 'GET', endpoint: '/_search', body: '', lastResult: { success: true, statusCode: 200, body: { hits: [1, 2] }, duration: 1, executedAt: 1 }, createdAt: 1, updatedAt: 1 }], createdAt: 1, updatedAt: 1, connectionId: null }, tracking: { operations: [], permissions: [] } };

it('round-trips a legacy document with outputs and preserves the recovery copy', async () => {
  const db = await openWorkspaceDatabase(new IDBFactory());
  const original = JSON.stringify([record]);
  const storage = { getItem: (key: string) => key === 'opensearch-notebook:notebooks' ? original : null } as Storage;
  try {
    await migrateLegacyWorkspace(db, storage);
    expect(await db.load('notebook')).toEqual([record]);
    expect(await db.migrationComplete()).toBe(true);
    expect(storage.getItem('opensearch-notebook:notebooks')).toBe(original);
    await migrateLegacyWorkspace(db, storage);
    expect(await db.load('notebook')).toHaveLength(1);
  } finally { db.close(); }
});

it('rejects concurrent edits and deletes from an outdated window without data loss', async () => {
  const factory = new IDBFactory();
  const first = await openWorkspaceDatabase(factory); const second = await openWorkspaceDatabase(factory);
  try {
    await first.save('notebook', record); await second.load('notebook');
    await first.save('notebook', { ...record, notebook: { ...record.notebook, name: 'Committed' } });
    await expect(second.save('notebook', { ...record, notebook: { ...record.notebook, name: 'Stale' } })).rejects.toThrow('another window');
    await expect(second.remove('notebook', 'a')).rejects.toThrow('another window');
    expect((await first.load('notebook'))[0]?.notebook.name).toBe('Committed');
  } finally { first.close(); second.close(); }
});

it('preserves malformed legacy input and never marks an invalid migration complete', async () => {
  const db = await openWorkspaceDatabase(new IDBFactory());
  try {
    await expect(migrateLegacyWorkspace(db, { getItem: () => '[{"notebook":{}}]' } as unknown as Storage)).rejects.toThrow('Invalid notebook');
    expect(await db.migrationComplete()).toBeUndefined();
    expect(await db.load('notebook')).toEqual([]);
  } finally { db.close(); }
});

it('resumes a partial migration and removes outputs transactionally with their document', async () => {
  const factory = new IDBFactory();
  const first = await openWorkspaceDatabase(factory);
  await first.save('notebook', record); first.close();
  const db = await openWorkspaceDatabase(factory);
  try {
    await migrateLegacyWorkspace(db, { getItem: key => key === 'opensearch-notebook:notebooks' ? JSON.stringify([record]) : null } as Storage);
    await db.remove('notebook', 'a');
    expect(await db.load('notebook')).toEqual([]);
    await db.save('notebook', record);
    expect(await db.load('notebook')).toEqual([record]);
  } finally { db.close(); }
});

it('does not scan or deserialize unrelated saved outputs when loading other document kinds', async () => {
  const { IDBObjectStore } = await import('fake-indexeddb');
  const { vi } = await import('vitest');
  const db = await openWorkspaceDatabase(new IDBFactory());
  try {
    await db.save('notebook', record);
    await db.save('clusterGroup', { id: 'group', name: 'Group', connectionIds: [] });
    const scan = vi.spyOn(IDBObjectStore.prototype, 'getAll');
    const get = vi.spyOn(IDBObjectStore.prototype, 'get');
    try {
      await db.load('clusterGroup');
      expect(scan.mock.contexts.every(store => (store as { name: string }).name === 'documents')).toBe(true);
      expect(get).not.toHaveBeenCalled();
      expect(await db.load('notebook')).toEqual([record]);
      expect(get.mock.contexts.filter(store => (store as { name: string }).name === 'outputs')).toHaveLength(1);
    } finally { scan.mockRestore(); get.mockRestore(); }
  } finally { db.close(); }
});

it('opens metadata without reading results, hydrates only one document, and protects unloaded outputs from writes', async () => {
  const { IDBObjectStore } = await import('fake-indexeddb');
  const { vi } = await import('vitest');
  const factory = new IDBFactory();
  const db = await openWorkspaceDatabase(factory);
  const other = { ...record, notebook: { ...record.notebook, id: 'b', name: 'B' } };
  try {
    await db.save('notebook', record); await db.save('notebook', other);
    const get = vi.spyOn(IDBObjectStore.prototype, 'get');
    try {
      const metadata = await db.load('notebook', { includeOutputs: false });
      expect(get).not.toHaveBeenCalled();
      expect(metadata[0]!.notebook.cells[0]).not.toHaveProperty('lastResult');
      await expect(db.save('notebook', metadata[0]!)).rejects.toThrow('Load saved results');
      expect(await db.loadOutputs('notebook', 'a')).toEqual(record);
      expect(get.mock.contexts.filter(store => (store as { name: string }).name === 'outputs')).toHaveLength(1);
      expect(db.hasUnloadedOutputs('notebook', 'b')).toBe(true);
      // Ordinary edits after hydration retain the result; another document's output is untouched.
      await db.save('notebook', { ...record, notebook: { ...record.notebook, name: 'Renamed' } });
      expect(await db.loadOutputs('notebook', 'b')).toEqual(other);
    } finally { get.mockRestore(); }
  } finally { db.close(); }
});

it('rejects stale lazy loads without accepting another window’s revision', async () => {
  const factory = new IDBFactory();
  const first = await openWorkspaceDatabase(factory); const second = await openWorkspaceDatabase(factory);
  try {
    await first.save('notebook', record);
    const [metadata] = await second.load('notebook', { includeOutputs: false });
    await first.save('notebook', { ...record, notebook: { ...record.notebook, name: 'Changed elsewhere' } });
    await expect(second.loadOutputs('notebook', 'a')).rejects.toThrow('another window');
    expect(second.hasUnloadedOutputs('notebook', 'a')).toBe(true);
    await expect(second.save('notebook', metadata!)).rejects.toThrow('Load saved results');
    await expect(second.remove('notebook', 'a')).rejects.toThrow('another window');
  } finally { first.close(); second.close(); }
});

it('reports a missing result only when opened and preserves the document for recovery', async () => {
  const factory = new IDBFactory(); const db = await openWorkspaceDatabase(factory);
  const open = factory.open('opensearch-workbench-v1');
  const raw = await new Promise<IDBDatabase>((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
  try {
    await db.save('notebook', record);
    const transaction = raw.transaction('outputs', 'readwrite');
    transaction.objectStore('outputs').clear();
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    expect(await db.load('notebook', { includeOutputs: false })).toHaveLength(1);
    await expect(db.loadOutputs('notebook', 'a')).rejects.toThrow('saved result is missing');
    expect(db.hasUnloadedOutputs('notebook', 'a')).toBe(true);
    expect((await db.load('notebook', { includeOutputs: false }))[0]!.notebook.id).toBe('a');
  } finally { raw.close(); db.close(); }
});
