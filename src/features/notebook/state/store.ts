// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { appReducer, initialState, type AppAction, type AppState } from '../domain/state';
import { newCell, newNotebook } from '../domain/create';
import type { CellType } from '../../../types/cell';
import type { StoredNotebook } from '../../../services/persistence';
import * as persistence from '../../../services/persistence';
import { createRunCoordinator } from '../../../execution/runs';
import { createSaveCoordinator, type SaveState } from '../../../storage/saveCoordinator';
import { createResultCache } from '../../../storage/resultCache';
import { documentFiles } from '../../../platform/runtime';
import type { DocumentFile, DocumentFileAccess } from '../../../platform/contracts';
import { importNotebook, isValidationResult, exportNotebook } from '../../../services/notebookIO';
import { loadRecentNotebookFiles, saveRecentNotebookFiles, rememberNotebookFile, type RecentNotebookFile } from '../../../services/recentNotebookFiles';

export interface NotebookRepository {
  unloadedIds?: ReadonlySet<string>;
  loadOutputs?(id: string): Promise<StoredNotebook>;
  releaseOutputs?(record: StoredNotebook): StoredNotebook;
  loadAll(): StoredNotebook[];
  save(record: StoredNotebook): void | Promise<void>;
  remove(id: string): void | Promise<void>;
  activeId(): string | null;
  select(id: string | null): void;
}
let repository: NotebookRepository = {
  loadAll: persistence.loadAllNotebooks, save: persistence.saveStoredNotebook,
  remove: persistence.deleteNotebook, activeId: persistence.loadActiveNotebookId, select: persistence.saveActiveNotebookId,
};
export function configureNotebookRepository(value: NotebookRepository) { repository = value; }
export type NotebookSnapshot = AppState & { saveState: SaveState; saveError: string | null; loadingNotebookId: string | null; loadError: string | null;
  recentFiles: RecentNotebookFile[]; fileBusy: boolean; fileError: string | null };

/** Owns all loaded documents, including those with requests running in the background. */
export function createNotebookStore(repo = repository, files: DocumentFileAccess = documentFiles) {
  const runs = createRunCoordinator();
  const documents = new Map(repo.loadAll().map(record => [record.notebook.id, record]));
  const listeners = new Set<() => void>();
  const executing = new Map<string, Set<string>>();
  const unloaded = new Set(repo.unloadedIds);
  const pending = new Map<string, Promise<StoredNotebook>>();
  let selection = 0;
  let disposed = false;
  let failedSelection: string | null = null;
  const initialId = repo.activeId();
  const active = initialId && !unloaded.has(initialId) ? documents.get(initialId) : undefined;
  let state: NotebookSnapshot = { ...initialState, activeNotebook: active?.notebook ?? null,
    tracking: active?.tracking ?? { operations: [], permissions: [] },
    ui: { ...initialState.ui, selectedCellId: active?.notebook.cells[0]?.id ?? null, executingCellIds: new Set() },
    saveState: 'saved', saveError: null, loadingNotebookId: initialId && unloaded.has(initialId) ? initialId : null, loadError: null,
    recentFiles: loadRecentNotebookFiles(), fileBusy: false, fileError: null };
  function metadata() {
    return [...documents.values()].map(({ notebook: n, file }) => ({ id: n.id, name: n.name,
      createdAt: n.createdAt, updatedAt: n.updatedAt, cellCount: n.cells.length, ...(file ? { file } : {}) }));
  }
  state.notebooks = metadata();
  function publish(update: Partial<NotebookSnapshot>) { state = { ...state, ...update }; listeners.forEach(listener => listener()); }
  const saves = createSaveCoordinator<StoredNotebook>((_id, record) => repo.save(record), (saveState, saveError) => {
    if (state.saveState !== saveState || state.saveError !== saveError) publish({ saveState, saveError });
    queueMicrotask(() => cache.trim());
  });
  const cache = createResultCache(id => !!repo.releaseOutputs && !!repo.loadOutputs && !disposed
    && !state.fileBusy
    && id !== state.activeNotebook?.id && id !== state.loadingNotebookId && !pending.has(id)
    && !saves.isBusy(id) && !runs.hasDocument(id), id => {
    const record = documents.get(id);
    if (!record) return;
    documents.set(id, repo.releaseOutputs!(record)); unloaded.add(id);
  });
  for (const [id, record] of documents) if (record.notebook.cells.some(cell => 'lastResult' in cell && cell.lastResult !== undefined)) cache.touch(id);
  function dispatch(action: AppAction, documentId = state.activeNotebook?.id) {
    if (documentId && action.type === 'DELETE_CELL') runs.cancelDocument(documentId, action.payload);
    if (documentId && action.type === 'CONVERT_CELL') runs.cancelDocument(documentId, action.payload.cellId);
    const record = documentId ? documents.get(documentId) : undefined;
    if (documentId && (!record || unloaded.has(documentId))) return; // Deleted documents cannot be resurrected by late completions.
    const isActive = documentId === state.activeNotebook?.id;
    const input = isActive ? state : { ...state, activeNotebook: record?.notebook ?? null,
      tracking: record?.tracking ?? { operations: [], permissions: [] },
      ui: { ...state.ui, executingCellIds: executing.get(documentId!) ?? new Set<string>() } };
    const next = appReducer(input, action, Date.now());
    if (next === input) return;
    if (next.activeNotebook && record && (next.activeNotebook !== record.notebook || next.tracking !== record.tracking)) {
      const stored: StoredNotebook = { ...record, notebook: next.activeNotebook, tracking: next.tracking,
        ...(record.file ? { file: { ...record.file, dirty: true } } : {}) };
      documents.set(next.activeNotebook.id, stored);
      if (stored.notebook.cells.some(cell => 'lastResult' in cell && cell.lastResult !== undefined)) cache.touch(stored.notebook.id);
      saves.schedule(next.activeNotebook.id, stored, state.settings.autoSaveInterval);
    }
    if (documentId) executing.set(documentId, next.ui.executingCellIds);
    publish(isActive ? { ...next, notebooks: next.activeNotebook !== input.activeNotebook ? metadata() : state.notebooks,
      saveState: state.saveState, saveError: state.saveError } : { notebooks: metadata() });
    queueMicrotask(() => cache.trim());
  }
  function activate(id: string | null) {
    const record = id ? documents.get(id) : undefined;
    if (id && !record) return;
    try { repo.select(id); } catch (error) { publish({ saveState: 'error', saveError: String(error) }); }
    publish({ activeNotebook: record?.notebook ?? null, tracking: record?.tracking ?? { operations: [], permissions: [] },
      loadingNotebookId: null, loadError: null,
      ui: { ...state.ui, selectedCellId: record?.notebook.cells[0]?.id ?? null, executingCellIds: executing.get(id ?? '') ?? new Set() } });
    if (record?.notebook.cells.some(cell => 'lastResult' in cell && cell.lastResult !== undefined)) cache.touch(record.notebook.id);
    cache.trim();
  }
  function select(id: string | null): void | Promise<void> {
    const token = ++selection;
    failedSelection = null;
    void saves.flush();
    publish({ loadingNotebookId: null, loadError: null });
    if (!id || !unloaded.has(id)) { activate(id); return; }
    const original = documents.get(id);
    if (!original) return;
    publish({ loadingNotebookId: id });
    let loading = pending.get(id);
    if (!loading) {
      loading = Promise.resolve().then(() => {
        if (!repo.loadOutputs) throw new Error('Saved results cannot be loaded by this repository.');
        return repo.loadOutputs(id);
      });
      pending.set(id, loading);
    }
    return loading.then(record => {
      if (disposed || documents.get(id) !== original) return;
      documents.set(id, record); unloaded.delete(id);
      if (record.notebook.cells.some(cell => 'lastResult' in cell && cell.lastResult !== undefined)) cache.touch(id);
      if (selection === token) activate(id);
    }).catch(error => {
      if (disposed || selection !== token) return;
      failedSelection = id;
      publish({ loadingNotebookId: null, loadError: error instanceof Error ? error.message : 'Unable to load saved results' });
    }).finally(() => {
      if (pending.get(id) === loading) pending.delete(id);
      // A newer selection may have shared this request and found the cached record.
      if (!disposed && selection === token && state.loadingNotebookId === id && !unloaded.has(id)) activate(id);
      cache.trim();
    });
  }
  function remember(file: DocumentFile) {
    if (!file.path) return;
    const recentFiles = rememberNotebookFile(state.recentFiles, { path: file.path, name: file.name });
    try { saveRecentNotebookFiles(recentFiles); }
    catch { publish({ fileError: 'The file is ready, but Recent files could not be saved.' }); }
    publish({ recentFiles });
  }
  async function fileOperation<T>(operation: () => Promise<T>): Promise<T | null> {
    if (state.fileBusy) return null;
    publish({ fileBusy: true, fileError: null });
    try { return await operation(); }
    catch (error) { publish({ fileError: error instanceof Error ? error.message : typeof error === 'string' ? error : 'File operation failed.' }); return null; }
    finally { publish({ fileBusy: false }); cache.trim(); }
  }
  return {
    getSnapshot: () => state,
    getDocument: (id: string) => documents.get(id)?.notebook,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispatch, select, runs,
    dismissFileError: () => publish({ fileError: null }),
    forgetRecentFile(path: string) {
      const recentFiles = state.recentFiles.filter(file => file.path !== path);
      try { saveRecentNotebookFiles(recentFiles); publish({ recentFiles }); }
      catch { publish({ fileError: 'Unable to remove this item from Recent files.' }); }
    },
    openFile(path?: string) {
      return fileOperation(async () => {
        const existing = path ? [...documents.values()].find(record => record.file?.path === path) : undefined;
        // Reopening a dirty document selects its recovery draft without replacing pending edits.
        if (existing && (existing.file?.dirty || runs.hasDocument(existing.notebook.id))) {
          await select(existing.notebook.id);
          remember({ path: path!, name: existing.file!.name, content: '', revision: existing.file!.revision });
          return existing.notebook;
        }
        const file = path ? await files.read(path) : await files.open();
        if (!file) return null;
        const parsed = importNotebook(file.content);
        if (isValidationResult(parsed)) throw new Error(parsed.errors.join(', '));
        const current = file.path ? [...documents.values()].find(record => record.file?.path === file.path) : undefined;
        if (current && (current.file?.dirty || runs.hasDocument(current.notebook.id))) {
          await select(current.notebook.id); remember(file); return current.notebook;
        }
        if (current && unloaded.has(current.notebook.id)) {
          await select(current.notebook.id);
          if (unloaded.has(current.notebook.id)) throw new Error('Load the recovered notebook before reopening its file.');
        }
        const notebook = { ...parsed.notebook, id: current?.notebook.id ?? (documents.has(parsed.notebook.id) ? crypto.randomUUID() : parsed.notebook.id) };
        const record: StoredNotebook = { notebook, tracking: parsed.tracking,
          file: { path: file.path, name: file.name, revision: file.revision, dirty: false } };
        documents.set(notebook.id, record);
        saves.schedule(notebook.id, record, 0);
        if (notebook.cells.some(cell => 'lastResult' in cell && cell.lastResult !== undefined)) cache.touch(notebook.id);
        await select(notebook.id);
        publish({ notebooks: metadata() });
        remember(file);
        return notebook;
      });
    },
    saveFile(saveAs = false) {
      const id = state.activeNotebook?.id;
      return fileOperation(async () => {
        const snapshot = id ? documents.get(id) : undefined;
        if (!snapshot || unloaded.has(id!)) return null;
        const content = exportNotebook(snapshot.notebook, snapshot.tracking);
        const file = await files.save({ content,
          suggestedName: snapshot.file?.name ?? `${snapshot.notebook.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Notebook'}.notebook.json`,
          ...(!saveAs && snapshot.file?.path ? { path: snapshot.file.path, expectedRevision: snapshot.file.revision } : {}) });
        if (!file) return null;
        const current = documents.get(id!);
        if (!current) return file;
        const dirty = current.notebook !== snapshot.notebook || current.tracking !== snapshot.tracking;
        const record: StoredNotebook = { ...current, file: { path: file.path, name: file.name, revision: file.revision, dirty } };
        documents.set(id!, record);
        saves.schedule(id!, record, 0);
        publish({ notebooks: metadata() });
        remember(file);
        return file;
      });
    },
    cancelAllRuns() {
      runs.dispose(); executing.clear();
      publish({ ui: { ...state.ui, executingCellIds: new Set() } });
    },
    resume() {
      disposed = false;
      const id = state.loadingNotebookId ?? failedSelection ?? (!state.activeNotebook ? initialId : null);
      if (id && unloaded.has(id)) void select(id);
    },
    retryLoad: () => failedSelection ? select(failedSelection) : undefined,
    flush: saves.flush,
    dispose() { disposed = true; selection++; runs.dispose(); saves.dispose(); },
    create(name: string) {
      const now = Date.now();
      const notebook = newNotebook(name, crypto.randomUUID(), now);
      notebook.cells = [newCell('query', crypto.randomUUID(), now)];
      const record = { notebook, tracking: { operations: [], permissions: [] } };
      documents.set(notebook.id, record);
      saves.schedule(notebook.id, record, 0);
      select(notebook.id);
      publish({ notebooks: metadata() });
      return notebook;
    },
    async remove(id: string) {
      // Delete storage first: failures preserve the document and its pending edits.
      saves.pause(id);
      try { await saves.wait(id); await repo.remove(id); }
      catch (error) { saves.resume(id); throw error; }
      runs.cancelDocument(id);
      saves.remove(id); documents.delete(id); executing.delete(id); unloaded.delete(id);
      cache.remove(id);
      if (state.loadingNotebookId === id || failedSelection === id) {
        selection++; failedSelection = null; publish({ loadingNotebookId: null, loadError: null });
      }
      if (state.activeNotebook?.id === id) select(null);
      publish({ notebooks: metadata() });
    },
    addCell(type: CellType, afterCellId?: string) {
      if (!state.activeNotebook) return null;
      const cell = newCell(type, crypto.randomUUID(), Date.now());
      dispatch({ type: 'ADD_CELL', payload: { cell, afterCellId } });
      return cell;
    },
  };
}
export type NotebookStore = ReturnType<typeof createNotebookStore>;
