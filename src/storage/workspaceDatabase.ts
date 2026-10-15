// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { isFileBinding } from './fileWorkspaceModel';
import { validateDraft, type WorkspaceDraft } from './drafts';
import type { StoredNotebook } from '../services/persistence';
import type { Investigation, ClusterGroup } from '../types/investigation';
import { validateNotebookJson } from '../services/notebookIO';

export interface WorkspaceValues {
  draft: WorkspaceDraft;
  notebook: StoredNotebook;
  investigation: Investigation;
  clusterGroup: ClusterGroup;
}
export type DocumentKind = keyof WorkspaceValues;
interface Envelope { key: string; kind: DocumentKind; version: 1; revision: number; value: unknown; outputs: string[] }
interface Output { key: string; value: unknown }
function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
}
function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Storage transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Storage transaction failed'));
  });
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function withoutOutputs(value: unknown): unknown {
  if (!object(value)) return value;
  if (object(value.notebook)) return { ...value, notebook: withoutOutputs(value.notebook) };
  if (Array.isArray(value.cells)) return { ...value, cells: value.cells.map(cell => {
    if (!object(cell)) return cell;
    const { lastResult: _result, ...document } = cell; return document;
  }) };
  return value;
}
function validate<K extends DocumentKind>(kind: K, value: unknown): asserts value is WorkspaceValues[K] {
  if (!object(value)) throw new Error(`Invalid ${kind} record`);
  if (kind === 'draft') { validateDraft(value); return; }
  if (kind === 'notebook') {
    if (value.file !== undefined && (!object(value.file)
      || !(value.file.path === null || typeof value.file.path === 'string')
      || typeof value.file.name !== 'string' || typeof value.file.revision !== 'string'
      || typeof value.file.dirty !== 'boolean')) throw new Error('Invalid notebook file association');
    const validation = validateNotebookJson(JSON.stringify({ version: '1.0.0', exportedAt: 0, ...(withoutOutputs(value) as object) }));
    if (!validation.valid) throw new Error(`Invalid notebook: ${validation.errors.join(', ')}`);
  } else if (kind === 'investigation') {
    if (value.file !== undefined && !isFileBinding(value.file)) throw new Error('Invalid investigation file association');
    if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.clusterGroupId !== 'string'
      || !Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt) || !Array.isArray(value.cells)
      || value.cells.some(cell => !object(cell) || typeof cell.id !== 'string'
        || !Number.isFinite(cell.createdAt) || !Number.isFinite(cell.updatedAt)
        || (cell.type === 'ppl' ? typeof cell.query !== 'string' : cell.type !== 'markdown' || typeof cell.content !== 'string'))) {
      throw new Error('Invalid investigation record');
    }
  } else if (typeof value.id !== 'string' || typeof value.name !== 'string' || !Array.isArray(value.connectionIds)
    || value.connectionIds.some(id => typeof id !== 'string')) throw new Error('Invalid cluster group record');
  const doc = kind === 'notebook' ? value.notebook : value;
  if (!object(doc) || typeof doc.id !== 'string' || !doc.id) throw new Error('Missing document identity');
  if (Array.isArray(doc.cells) && new Set(doc.cells.map(cell => cell.id)).size !== doc.cells.length) throw new Error('Duplicate cell identities');
}
function canonical(value: unknown) {
  return JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
function identity(kind: DocumentKind, value: WorkspaceValues[DocumentKind]) {
  return kind === 'notebook' ? (value as StoredNotebook).notebook.id : (value as Investigation | ClusterGroup | WorkspaceDraft).id;
}

/** Versioned documents and separately stored outputs committed in one transaction. */
export async function openWorkspaceDatabase(factory: IDBFactory = indexedDB, name = 'opensearch-workbench-v1') {
  const opening = factory.open(name, 1);
  opening.onupgradeneeded = () => {
    const db = opening.result;
    db.createObjectStore('documents', { keyPath: 'key' });
    db.createObjectStore('outputs', { keyPath: 'key' });
    db.createObjectStore('metadata');
  };
  const db = await request(opening);
  db.onversionchange = () => db.close();
  const revisions = new Map<string, number>();
  const outputReferences = new Map<string, unknown>();
  const unloaded = new Set<string>();
  async function read<K extends DocumentKind>(kind: K, includeOutputs: boolean, id?: string): Promise<WorkspaceValues[K][]> {
    const transaction = db.transaction(['documents', 'outputs'], 'readonly');
    const done = complete(transaction);
    const key = id === undefined ? undefined : JSON.stringify([kind, id]);
    const recordsRequest = key === undefined ? transaction.objectStore('documents').getAll() : transaction.objectStore('documents').get(key);
    // Only this document kind's referenced outputs are read. Loading groups or drafts
    // must not deserialize every large response in the workspace.
    const [{ records, outputs }] = await Promise.all([new Promise<{ records: Envelope[]; outputs: Output[] }>((resolve, reject) => {
      recordsRequest.onerror = () => reject(recordsRequest.error);
      recordsRequest.onsuccess = () => {
        try {
          const records = (key === undefined ? recordsRequest.result as Envelope[] : recordsRequest.result ? [recordsRequest.result as Envelope] : []).filter(record => record.kind === kind);
          if (key !== undefined) {
            if (!records.length) throw new Error('This document is no longer available. Reload the workspace.');
            if (records[0]!.revision !== revisions.get(key)) throw new Error('This document changed in another window. Reload before opening it.');
          }
          const keys = [...new Set(records.flatMap(record => {
            if (!Array.isArray(record.outputs) || record.outputs.some(key => typeof key !== 'string')) throw new Error('Invalid saved output references');
            return includeOutputs ? record.outputs : [];
          }))];
          const reads = keys.map(key => request(transaction.objectStore('outputs').get(key)) as Promise<Output | undefined>);
          void Promise.all(reads).then(outputs => resolve({ records, outputs: outputs.filter((output): output is Output => output !== undefined) }), reject);
        } catch (error) { reject(error); }
      };
    }), done]);
    const byKey = new Map(outputs.map(output => [output.key, output.value]));
    return records.map(record => {
      if (record.version !== 1 || !Number.isInteger(record.revision)) throw new Error('Unsupported workspace record version');
      const value = record.value;
      if (!object(value)) throw new Error('Invalid workspace record');
      const document = kind === 'notebook' ? value.notebook : value;
      if (object(document) && Array.isArray(document.cells)) for (const cell of document.cells) {
        const key = JSON.stringify([record.key, cell.id]);
        if (includeOutputs && record.outputs.includes(key)) {
          if (!byKey.has(key)) throw new Error('A saved result is missing; the document was preserved');
          cell.lastResult = byKey.get(key);
          outputReferences.set(key, cell.lastResult);
        }
      }
      validate(kind, value);
      if (record.key !== JSON.stringify([kind, identity(kind, value)])) throw new Error('Document identity mismatch');
      revisions.set(record.key, record.revision);
      if (includeOutputs || !record.outputs.length) unloaded.delete(record.key);
      else { unloaded.add(record.key); record.outputs.forEach(key => outputReferences.delete(key)); }
      return value;
    });
  }
  async function save<K extends DocumentKind>(kind: K, source: WorkspaceValues[K]) {
    validate(kind, source);
    const key = JSON.stringify([kind, identity(kind, source)]);
    if (unloaded.has(key)) throw new Error('Load saved results before editing this document.');
    const expected = revisions.get(key) ?? 0;
    const value = structuredClone(withoutOutputs(source));
    const original = kind === 'notebook' ? (source as StoredNotebook).notebook : source;
    const outputs: Output[] = [];
    if ('cells' in original) for (const cell of original.cells) {
      if ('lastResult' in cell && cell.lastResult !== undefined) outputs.push({ key: JSON.stringify([key, cell.id]), value: cell.lastResult });
    }
    const transaction = db.transaction(['documents', 'outputs'], 'readwrite');
    const done = complete(transaction);
    const removedOutputKeys: string[] = [];
    let conflict = false;
    const documents = transaction.objectStore('documents');
    const reading = documents.get(key);
    reading.onsuccess = () => {
      const previous = reading.result as Envelope | undefined;
      if ((previous?.revision ?? 0) !== expected) { conflict = true; transaction.abort(); return; }
      documents.put({ key, kind, version: 1, revision: expected + 1, value, outputs: outputs.map(output => output.key) } satisfies Envelope);
      const store = transaction.objectStore('outputs');
      for (const output of outputs) if (!previous?.outputs.includes(output.key) || outputReferences.get(output.key) !== output.value) store.put(output);
      for (const old of previous?.outputs ?? []) if (!outputs.some(output => output.key === old)) { store.delete(old); removedOutputKeys.push(old); }
    };
    try { await done; } catch (error) {
      if (conflict) throw new Error('This document changed in another window. Export your edits before reloading.', { cause: error });
      throw error;
    }
    revisions.set(key, expected + 1);
    removedOutputKeys.forEach(key => outputReferences.delete(key));
    outputs.forEach(output => outputReferences.set(output.key, output.value));
  }
  async function remove(kind: DocumentKind, id: string) {
    const key = JSON.stringify([kind, id]);
    const transaction = db.transaction(['documents', 'outputs'], 'readwrite');
    const done = complete(transaction);
    let conflict = false;
    const documents = transaction.objectStore('documents');
    const reading = documents.get(key);
    reading.onsuccess = () => {
      const previous = reading.result as Envelope | undefined;
      if (previous && previous.revision !== revisions.get(key)) { conflict = true; transaction.abort(); return; }
      for (const output of previous?.outputs ?? []) transaction.objectStore('outputs').delete(output);
      documents.delete(key);
    };
    try { await done; } catch (error) {
      if (conflict) throw new Error('This document changed in another window. Reload before deleting.', { cause: error });
      throw error;
    }
    revisions.delete(key); unloaded.delete(key);
    for (const output of outputReferences.keys()) if (JSON.parse(output)[0] === key) outputReferences.delete(output);
  }
  return {
    load: <K extends DocumentKind>(kind: K, options?: { includeOutputs?: boolean }) => read(kind, options?.includeOutputs ?? true),
    async loadOutputs<K extends DocumentKind>(kind: K, id: string): Promise<WorkspaceValues[K]> { return (await read(kind, true, id))[0]!; },
    hasUnloadedOutputs: (kind: DocumentKind, id: string) => unloaded.has(JSON.stringify([kind, id])),
    releaseOutputs<K extends DocumentKind>(kind: K, value: WorkspaceValues[K]): WorkspaceValues[K] {
      const key = JSON.stringify([kind, identity(kind, value)]);
      if (!revisions.has(key)) throw new Error('Only saved results may leave the memory cache');
      const document = kind === 'notebook' ? (value as StoredNotebook).notebook : value;
      if ('cells' in document && document.cells.some(cell => 'lastResult' in cell && cell.lastResult !== undefined)) {
        for (const output of outputReferences.keys()) if (JSON.parse(output)[0] === key) outputReferences.delete(output);
        unloaded.add(key);
      }
      return withoutOutputs(value) as WorkspaceValues[K];
    },
    save, remove, close: () => db.close(),
    async migrationComplete(key = 'legacy-migrated') { return request(db.transaction('metadata').objectStore('metadata').get(key)) as Promise<boolean | undefined>; },
    async finishMigration(key = 'legacy-migrated') { const transaction = db.transaction('metadata', 'readwrite'); const done = complete(transaction); transaction.objectStore('metadata').put(true, key); await done; },
  };
}
export type WorkspaceDatabase = Awaited<ReturnType<typeof openWorkspaceDatabase>>;

/** Copy, validate, and read back before marking migration complete. Keep legacy records. */
export async function migrateLegacyWorkspace(db: WorkspaceDatabase, storage: Storage) {
  if (await db.migrationComplete()) return;
  const keys = { notebook: 'opensearch-notebook:notebooks', investigation: 'opensearch-devtools:investigations', clusterGroup: 'opensearch-devtools:cluster-groups' } as const;
  for (const kind of Object.keys(keys) as (keyof typeof keys)[]) {
    const raw = storage.getItem(keys[kind]);
    const values: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(values)) throw new Error(`Invalid legacy ${kind} collection. Original data has been preserved.`);
    const existing = await db.load(kind);
    for (const value of values) {
      validate(kind, value);
      const previous = existing.find(record => identity(kind, record) === identity(kind, value));
      if (previous) {
        if (canonical(previous) !== canonical(value)) throw new Error('An interrupted migration has conflicting data. Original data has been preserved.');
      } else await db.save(kind, value);
    }
    const verified = await db.load(kind);
    for (const value of values) {
      validate(kind, value);
      const restored = verified.find(record => identity(kind, record) === identity(kind, value));
      if (canonical(restored) !== canonical(value)) throw new Error('Workspace migration verification failed. Original data has been preserved.');
    }
  }
  await db.finishMigration();
}
