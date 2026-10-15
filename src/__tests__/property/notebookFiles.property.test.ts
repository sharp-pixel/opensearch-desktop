// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotebookStore, type NotebookRepository, type NotebookStore } from '../../features/notebook/state/store';
import { exportNotebook } from '../../services/notebookIO';
import { newNotebook } from '../../features/notebook/domain/create';
import type { StoredNotebook } from '../../services/persistence';
import type { DocumentFile, DocumentFileAccess } from '../../platform/contracts';
import { rememberNotebookFile } from '../../services/recentNotebookFiles';
import { createTauriAdapter } from '../../platform/adapters/tauri';
import { createElectronAdapter } from '../../platform/adapters/electron';
import { createBrowserAdapter } from '../../platform/adapters/browser';
import type { ElectronAPI, TauriInternals } from '../../platform/contracts';

const file = (path = '/project/search.notebook.json', name = 'Search'): DocumentFile => ({
  path, name: path.split('/').pop()!, revision: 'original',
  content: exportNotebook(newNotebook(name, 'portable-id', 1), { operations: [], permissions: [] }),
});
let stores: NotebookStore[];
beforeEach(() => { localStorage.clear(); stores = []; });
afterEach(() => { stores.forEach(store => store.dispose()); vi.restoreAllMocks(); localStorage.clear(); });
function setup(records: StoredNotebook[] = []) {
  const saved = new Map(records.map(record => [record.notebook.id, record]));
  const repo: NotebookRepository = { loadAll: () => [...saved.values()], activeId: () => null, select: () => {},
    save: record => { saved.set(record.notebook.id, structuredClone(record)); }, remove: id => { saved.delete(id); } };
  const files: DocumentFileAccess = {
    open: vi.fn().mockResolvedValue(file()), read: vi.fn().mockImplementation(path => Promise.resolve(file(path))),
    save: vi.fn().mockImplementation(request => Promise.resolve({ path: request.path ?? '/project/saved.notebook.json',
      name: 'saved.notebook.json', content: request.content, revision: 'written' })),
  };
  const store = createNotebookStore(repo, files); stores.push(store);
  return { store, files, saved, repo };
}

describe('Notebook files and recovery drafts', () => {
  it('preserves existing internal notebooks and opens a separate file without replacing them', async () => {
    const legacy = { notebook: newNotebook('Existing notebook', 'portable-id', 1), tracking: { operations: [], permissions: [] } };
    const { store, saved } = setup([legacy]);
    const opened = await store.openFile();
    expect(opened?.id).not.toBe('portable-id');
    expect(store.getSnapshot().notebooks).toHaveLength(2);
    expect(store.getDocument('portable-id')).toEqual(legacy.notebook);
    expect(store.getSnapshot().notebooks.find(item => item.id === opened?.id)?.file).toMatchObject({ dirty: false, path: file().path });
    await store.flush();
    expect(saved.get(opened!.id)?.file?.revision).toBe('original');
    expect(store.getSnapshot().recentFiles[0]?.path).toBe(file().path);
  });

  it('uses Save As for a new document, then saves to the same path with a conflict revision', async () => {
    const { store, files, saved } = setup();
    const notebook = store.create('Logs');
    await store.saveFile();
    expect(files.save).toHaveBeenLastCalledWith(expect.objectContaining({ suggestedName: 'Logs.notebook.json' }));
    expect(vi.mocked(files.save).mock.calls[0]![0].path).toBeUndefined();
    store.dispatch({ type: 'RENAME_NOTEBOOK', payload: 'Updated logs' });
    expect(store.getSnapshot().notebooks[0]?.file?.dirty).toBe(true);
    await store.saveFile();
    expect(files.save).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/project/saved.notebook.json', expectedRevision: 'written' }));
    await store.flush();
    expect(saved.get(notebook.id)?.file?.dirty).toBe(false);
    const written = JSON.parse(vi.mocked(files.save).mock.calls[1]![0].content);
    expect(written.notebook.name).toBe('Updated logs');
    expect(written.file).toBeUndefined();
  });

  it('Save As chooses another location rather than overwriting the current one', async () => {
    const { store, files } = setup();
    await store.openFile();
    await store.saveFile(true);
    expect(vi.mocked(files.save).mock.calls[0]![0].path).toBeUndefined();
    expect(store.getSnapshot().recentFiles.map(item => item.path)).toEqual(['/project/saved.notebook.json', file().path]);
  });

  it('cancelling Open or Save As leaves the active document, binding, and history unchanged', async () => {
    const { store, files } = setup();
    const notebook = store.create('Draft');
    vi.mocked(files.open).mockResolvedValue(null);
    vi.mocked(files.save).mockResolvedValue(null);
    expect(await store.openFile()).toBeNull();
    expect(await store.saveFile()).toBeNull();
    expect(store.getSnapshot().activeNotebook?.id).toBe(notebook.id);
    expect(store.getSnapshot().notebooks[0]?.file).toBeUndefined();
    expect(store.getSnapshot().recentFiles).toEqual([]);
    expect(store.getSnapshot().fileError).toBeNull();
  });

  it('failed saves preserve dirty recovery data and report the error', async () => {
    const { store, files, saved } = setup();
    const opened = await store.openFile();
    store.dispatch({ type: 'RENAME_NOTEBOOK', payload: 'Pending changes' });
    // Tauri command errors are returned as strings rather than Error instances.
    vi.mocked(files.save).mockRejectedValue('File changed on disk. Use Save As.');
    expect(await store.saveFile()).toBeNull();
    expect(store.getSnapshot().fileError).toContain('File changed on disk');
    await store.flush();
    expect(saved.get(opened!.id)?.notebook.name).toBe('Pending changes');
    expect(saved.get(opened!.id)?.file).toMatchObject({ dirty: true, revision: 'original' });
    expect(store.getSnapshot().fileBusy).toBe(false);
  });

  it('invalid files and missing recent files retain current work and history', async () => {
    const { store, files } = setup();
    await store.openFile();
    const id = store.getSnapshot().activeNotebook?.id;
    vi.mocked(files.open).mockResolvedValue({ ...file(), content: '{invalid' });
    await store.openFile();
    expect(store.getSnapshot().activeNotebook?.id).toBe(id);
    expect(store.getSnapshot().fileError).toContain('Invalid JSON');
    vi.mocked(files.read).mockRejectedValue(new Error('File unavailable. Locate it again.'));
    await store.openFile(file().path!);
    expect(store.getSnapshot().fileError).toContain('Locate it again');
    expect(store.getSnapshot().recentFiles).toHaveLength(1);
  });

  it('reopening a dirty file selects its recovery draft and never overwrites it from disk', async () => {
    const { store, files } = setup();
    const opened = await store.openFile();
    store.dispatch({ type: 'RENAME_NOTEBOOK', payload: 'Recovered edit' });
    store.create('Another document');
    await store.openFile(file().path!);
    expect(store.getSnapshot().activeNotebook).toMatchObject({ id: opened!.id, name: 'Recovered edit' });
    expect(files.read).not.toHaveBeenCalled();
    expect(store.getSnapshot().notebooks).toHaveLength(2);
  });

  it('reopening a clean file reloads disk changes and retains its identity', async () => {
    const { store, files } = setup();
    const opened = await store.openFile();
    vi.mocked(files.read).mockResolvedValue(file(file().path!, 'Changed outside the app'));
    await store.openFile(file().path!);
    expect(store.getSnapshot().activeNotebook).toMatchObject({ id: opened!.id, name: 'Changed outside the app' });
    expect(store.getSnapshot().notebooks).toHaveLength(1);
  });

  it('keeps edits made during saving dirty and associates the saved path with the originating document', async () => {
    const { store, files } = setup();
    const a = store.create('A');
    let complete!: (value: DocumentFile) => void;
    vi.mocked(files.save).mockImplementation(request => new Promise(resolve => {
      complete = value => resolve({ ...value, content: request.content });
    }));
    const saving = store.saveFile();
    expect(store.getSnapshot().fileBusy).toBe(true);
    expect(await store.saveFile()).toBeNull();
    store.dispatch({ type: 'RENAME_NOTEBOOK', payload: 'A edited while saving' });
    const b = store.create('B');
    complete(file('/project/a.json'));
    await saving;
    expect(files.save).toHaveBeenCalledOnce();
    expect(store.getSnapshot().activeNotebook?.id).toBe(b.id);
    expect(store.getSnapshot().notebooks.find(item => item.id === a.id)?.file).toMatchObject({ path: '/project/a.json', dirty: true });
    expect(store.getSnapshot().notebooks.find(item => item.id === b.id)?.file).toBeUndefined();
  });

  it('preserves file bindings and recent files across a store restart; forgetting recent never deletes the draft', async () => {
    const { store, repo, files } = setup();
    const notebook = await store.openFile();
    store.dispatch({ type: 'RENAME_NOTEBOOK', payload: 'Recovered' });
    await store.flush();
    store.dispose();
    const restored = createNotebookStore(repo, files); stores.push(restored);
    expect(restored.getSnapshot().notebooks[0]?.file).toMatchObject({ dirty: true, path: file().path });
    expect(restored.getSnapshot().recentFiles).toHaveLength(1);
    restored.forgetRecentFile(file().path!);
    expect(restored.getSnapshot().recentFiles).toEqual([]);
    expect(restored.getDocument(notebook!.id)).toMatchObject({ name: 'Recovered' });
  });

  it('browser copies stay in unsaved work and never become filesystem recent entries', async () => {
    const { store, files } = setup();
    vi.mocked(files.open).mockResolvedValue({ ...file(), path: null });
    await store.openFile();
    vi.mocked(files.save).mockImplementation(request => Promise.resolve({ ...file(), path: null, content: request.content }));
    await store.saveFile();
    expect(store.getSnapshot().notebooks[0]?.file?.path).toBeNull();
    expect(store.getSnapshot().recentFiles).toEqual([]);
  });
});

it('recent history deduplicates paths and keeps the newest thirty entries', () => {
  let history = Array.from({ length: 35 }, (_, i) => ({ path: `/project/${i}.json`, name: `${i}.json`, openedAt: i }));
  history = rememberNotebookFile(history, { path: '/project/7.json', name: '7.json' }, 100);
  expect(history).toHaveLength(30);
  expect(history.filter(item => item.path === '/project/7.json')).toHaveLength(1);
  expect(history[0]?.openedAt).toBe(100);
});

it('routes file capabilities through the Tauri and Electron adapters', async () => {
  const invoke = vi.fn().mockResolvedValue(file());
  const browser = createBrowserAdapter(vi.fn(), false);
  const tauri = createTauriAdapter({ invoke } as TauriInternals, browser);
  await tauri.files!.open();
  expect(invoke).toHaveBeenLastCalledWith('document_open', undefined);
  await tauri.files!.read('/project/file.json');
  expect(invoke).toHaveBeenLastCalledWith('document_read', { path: '/project/file.json' });
  const request = { content: '{}', suggestedName: 'file.json' };
  await tauri.files!.save(request);
  expect(invoke).toHaveBeenLastCalledWith('document_save', { request });
  const files = { open: vi.fn(), read: vi.fn(), save: vi.fn() };
  expect(createElectronAdapter({ files } as unknown as ElectronAPI, browser).files).toBe(files);
});
