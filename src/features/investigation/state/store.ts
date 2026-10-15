// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { documentFiles } from '../../../platform/runtime';
import type { DocumentFileAccess } from '../../../platform/contracts';
import { exportInvestigation, importInvestigation } from '../../../services/investigationIO';
import { loadRecentDocumentFiles, saveRecentDocumentFiles, rememberDocumentFile } from '../../../services/recentDocumentFiles';
import * as domain from '../domain/document';
import type { Investigation, InvestigationCell, ClusterGroup, ClusterStatus, FederatedPPLResult } from '../../../types/investigation';
import * as legacy from '../../../services/investigationPersistence';

export interface InvestigationRepository {
  unloadedIds?: ReadonlySet<string>;
  loadOutputs?(id: string): Promise<Investigation>;
  releaseOutputs?(record: Investigation): Investigation;
  loadAllInvestigations: typeof legacy.loadAllInvestigations;
  loadAllClusterGroups: typeof legacy.loadAllClusterGroups;
  saveInvestigation(value: Investigation): void | Promise<void>;
  saveClusterGroup(value: ClusterGroup): void | Promise<void>;
  deleteInvestigation(id: string): void | Promise<void>;
}
let configured: InvestigationRepository = legacy;
export function configureInvestigationRepository(value: InvestigationRepository) { configured = value; }
import { createRunCoordinator } from '../../../execution/runs';
import { createSaveCoordinator, type SaveState } from '../../../storage/saveCoordinator';
import { createResultCache } from '../../../storage/resultCache';

export function createInvestigationStore(supplied = configured, files: DocumentFileAccess = documentFiles) {
  const repository = { ...legacy, ...supplied };
  const documents = new Map(repository.loadAllInvestigations().map(document => [document.id, document]));
  const groups = new Map(repository.loadAllClusterGroups().map(group => [group.id, group]));
  const listeners = new Set<() => void>();
  const runs = createRunCoordinator();
  const executing = new Map<string, Set<string>>();
  const statuses = new Map<string, Map<string, Map<string, ClusterStatus>>>();
  const unloaded = new Set(repository.unloadedIds);
  const pending = new Map<string, Promise<Investigation>>();
  let selection = 0;
  let disposed = false;
  let failedSelection: string | null = null;
  const initialId = repository.loadActiveInvestigationId();
  const active = initialId && !unloaded.has(initialId) ? documents.get(initialId) ?? null : null;
  let state = {
    activeInvestigation: active, clusterGroup: groups.get(active?.clusterGroupId ?? '') ?? null,
    executingCellIds: new Set<string>(), cellClusterStatuses: new Map<string, Map<string, ClusterStatus>>(),
    clusterStatuses: new Map<string, ClusterStatus>(),
    loadingInvestigationId: (initialId && unloaded.has(initialId) ? initialId : null) as string | null, loadError: null as string | null,
    recentFiles: loadRecentDocumentFiles('investigation'), fileBusy: false, fileError: null as string | null, fileNotice: null as string | null,
    investigations: [...documents.values()], saveState: 'saved' as SaveState, saveError: null as string | null,
  };
  function publish(update: Partial<typeof state>) { state = { ...state, ...update }; listeners.forEach(listener => listener()); }
  const saveStatuses = new Map<string, { saveState: SaveState; saveError: string | null }>();
  function reportSave(source: string, saveState: SaveState, saveError: string | null) {
    saveStatuses.set(source, { saveState, saveError });
    const values = [...saveStatuses.values()];
    const errors = values.flatMap(value => value.saveError ? [value.saveError] : []);
    publish({ saveState: errors.length ? 'error' : values.some(value => value.saveState === 'pending') ? 'pending' : 'saved',
      saveError: errors.length ? errors.join('; ') : null });
  }
  const saves = createSaveCoordinator<Investigation>((_id, value) => repository.saveInvestigation(value),
    (status, error) => {
      reportSave('documents', status, error);
      queueMicrotask(() => cache.trim());
    });
  const cache = createResultCache(id => !!repository.releaseOutputs && !!repository.loadOutputs && !disposed
    && id !== state.activeInvestigation?.id && id !== state.loadingInvestigationId && !pending.has(id)
    && !state.fileBusy && !saves.isBusy(id) && !runs.hasDocument(id), id => {
    const record = documents.get(id);
    if (!record) return;
    documents.set(id, repository.releaseOutputs!(record)); unloaded.add(id);
    publish({ investigations: [...documents.values()] });
  });
  for (const [id, record] of documents) if (record.cells.some(cell => 'lastResult' in cell && cell.lastResult !== undefined)) cache.touch(id);
  const groupSaves = createSaveCoordinator<ClusterGroup>((_id, group) => repository.saveClusterGroup(group),
    (status, error) => reportSave('groups', status, error));
  function update(document: Investigation) {
    if (unloaded.has(document.id)) throw new Error('Open the investigation before editing its saved results.');
    if (document.file) document = { ...document, file: { ...document.file, dirty: true } };
    documents.set(document.id, document);
    if (document.cells.some(cell => 'lastResult' in cell && cell.lastResult !== undefined)) cache.touch(document.id);
    saves.schedule(document.id, document, 500);
    publish({ investigations: [...documents.values()], ...(state.activeInvestigation?.id === document.id ? { activeInvestigation: document } : {}) });
  }
  function progress(documentId: string) {
    const cellClusterStatuses = statuses.get(documentId) ?? new Map<string, Map<string, ClusterStatus>>();
    const clusterStatuses = new Map<string, ClusterStatus>();
    const rank = { idle: 0, success: 1, error: 2, executing: 3 };
    for (const values of cellClusterStatuses.values()) for (const status of values.values()) {
      const previous = clusterStatuses.get(status.connectionId);
      if (!previous || rank[status.status] > rank[previous.status]) clusterStatuses.set(status.connectionId, status);
    }
    return { cellClusterStatuses, clusterStatuses };
  }
  function activate(document: Investigation | null) {
    if (document) documents.set(document.id, document);
    try { repository.saveActiveInvestigationId(document?.id ?? null); }
    catch (error) { publish({ saveState: 'error', saveError: String(error) }); }
    publish({ loadingInvestigationId: null, loadError: null, activeInvestigation: document, clusterGroup: groups.get(document?.clusterGroupId ?? '') ?? null,
      investigations: [...documents.values()], executingCellIds: executing.get(document?.id ?? '') ?? new Set(),
      ...progress(document?.id ?? '') });
    if (document?.cells.some(cell => 'lastResult' in cell && cell.lastResult !== undefined)) cache.touch(document.id);
    cache.trim();
  }
  function select(document: Investigation | null): void | Promise<void> {
    const token = ++selection;
    failedSelection = null;
    void saves.flush();
    publish({ loadingInvestigationId: null, loadError: null });
    if (!document || !unloaded.has(document.id)) { activate(document); return; }
    const id = document.id;
    publish({ loadingInvestigationId: id });
    let loading = pending.get(id);
    if (!loading) {
      loading = Promise.resolve().then(() => {
        if (!repository.loadOutputs) throw new Error('Saved results cannot be loaded by this repository.');
        return repository.loadOutputs(id);
      });
      pending.set(id, loading);
    }
    return loading.then(record => {
      if (disposed || documents.get(id) !== document) return;
      documents.set(id, record); unloaded.delete(id);
      if (record.cells.some(cell => 'lastResult' in cell && cell.lastResult !== undefined)) cache.touch(id);
      if (selection === token) activate(record);
    }).catch(error => {
      if (disposed || selection !== token) return;
      failedSelection = id;
      publish({ loadingInvestigationId: null, loadError: error instanceof Error ? error.message : 'Unable to load saved results' });
    }).finally(() => {
      if (pending.get(id) === loading) pending.delete(id);
      if (!disposed && selection === token && state.loadingInvestigationId === id && !unloaded.has(id)) activate(documents.get(id) ?? null);
      cache.trim();
    });
  }
  function updateCell(cellId: string, updates: Partial<InvestigationCell>, documentId = state.activeInvestigation?.id) {
    const document = documentId ? documents.get(documentId) : undefined;
    if (!document || !document.cells.some(cell => cell.id === cellId)) return;
    update(domain.updateCell(document, cellId, updates, Date.now()));
  }
  function setClusterGroup(group: ClusterGroup | null) {
    if (group) {
      // Editing one document's selection must not change another document or its lazy saved results.
      if ([...documents.values()].some(item => item.clusterGroupId === group!.id && item.id !== state.activeInvestigation?.id)) group = { ...group, id: crypto.randomUUID() };
      groups.set(group.id, group); groupSaves.schedule(group.id, group, 0);
    }
    const document = state.activeInvestigation;
    if (document) update({ ...document, clusterGroupId: group?.id ?? '', updatedAt: Date.now() });
    publish({ clusterGroup: group });
  }
  function remember(path: string, name: string) {
    const recentFiles = rememberDocumentFile(state.recentFiles, { path, name });
    publish({ recentFiles });
    try { saveRecentDocumentFiles('investigation', recentFiles); }
    catch { publish({ fileNotice: 'File saved or opened, but recent-file history could not be stored.' }); }
  }
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unable to access the file.';
  async function fileOperation<T>(operation: () => Promise<T>): Promise<T | null> {
    if (state.fileBusy) return null;
    publish({ fileBusy: true, fileError: null, fileNotice: null });
    try { return await operation(); }
    catch (error) { publish({ fileError: errorMessage(error) }); return null; }
    finally { publish({ fileBusy: false }); cache.trim(); }
  }
  return {
    async openFile(path?: string): Promise<string | null> {
      return fileOperation(async () => {
        const recovered = path ? [...documents.values()].find(item => item.file?.path === path && (item.file.dirty || runs.hasDocument(item.id))) : undefined;
        if (recovered) {
          await select(recovered);
          if (state.activeInvestigation?.id !== recovered.id) throw new Error(state.loadError ?? 'Unable to open recovered results.');
          publish({ fileNotice: 'Recovered unsaved changes. Save As keeps the current file intact.' });
          return path!;
        }
        const file = path ? await files.read(path) : await files.open({ title: 'Open investigation' });
        if (!file) return null;
        const previous = file.path ? [...documents.values()].find(item => item.file?.path === file.path) : undefined;
        if (previous?.file?.dirty || (previous && runs.hasDocument(previous.id))) {
          await select(previous!);
          if (state.activeInvestigation?.id !== previous!.id) throw new Error(state.loadError ?? 'Unable to open recovered results.');
          publish({ fileNotice: 'Recovered unsaved changes. Save As keeps the current file intact.' });
        } else {
          const parsed = importInvestigation(file.content);
          if (previous && unloaded.has(previous.id)) {
            await select(previous);
            if (unloaded.has(previous.id)) throw new Error(state.loadError ?? 'Unable to load saved results.');
          }
          const id = previous?.id ?? (documents.has(parsed.investigation.id) ? crypto.randomUUID() : parsed.investigation.id);
          const group = parsed.clusterGroup ? { ...parsed.clusterGroup, id: crypto.randomUUID() } : null;
          if (group) { groups.set(group.id, group); groupSaves.schedule(group.id, group, 0); }
          const document = { ...parsed.investigation, id, clusterGroupId: group?.id ?? '',
            file: { path: file.path, name: file.name, revision: file.revision, dirty: false } };
          documents.set(id, document); saves.schedule(id, document, 0);
          await select(document);
        }
        if (file.path) remember(file.path, file.name);
        return file.path ?? '';
      });
    },
    async saveFile(saveAs = false): Promise<boolean> {
      const original = state.activeInvestigation;
      if (!original || unloaded.has(original.id)) return false;
      const saved = await fileOperation(async () => {
        const group = groups.get(original.clusterGroupId) ?? null;
        const content = exportInvestigation(original, group);
        const file = await files.save({ title: 'Save investigation as', content,
          suggestedName: original.file?.name ?? `${original.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Investigation'}.investigation.json`,
          ...(!saveAs && original.file?.path ? { path: original.file.path, expectedRevision: original.file.revision } : {}),
        });
        if (!file) return false;
        const current = documents.get(original.id);
        if (current) {
          const document = { ...current, file: { path: file.path, name: file.name, revision: file.revision,
            dirty: current !== original || (groups.get(current.clusterGroupId) ?? null) !== group } };
          documents.set(document.id, document); saves.schedule(document.id, document, 0);
          publish({ investigations: [...documents.values()], ...(state.activeInvestigation?.id === document.id ? { activeInvestigation: document } : {}) });
        }
        if (file.path) remember(file.path, file.name);
        else publish({ fileNotice: 'Download started. Your draft remains available here.' });
        return true;
      });
      return saved ?? false;
    },
    forgetRecentFile(path: string) {
      const recentFiles = state.recentFiles.filter(item => item.path !== path);
      try { saveRecentDocumentFiles('investigation', recentFiles); publish({ recentFiles }); }
      catch (error) { publish({ fileError: errorMessage(error) }); }
    },
    getSnapshot: () => state,
    getDocument: (id: string) => documents.get(id),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    runs, updateCell, setClusterGroup,
    cancelAllRuns() {
      runs.dispose(); executing.clear(); statuses.clear();
      publish({ executingCellIds: new Set(), cellClusterStatuses: new Map(), clusterStatuses: new Map() });
    },
    resume() {
      disposed = false;
      const id = state.loadingInvestigationId ?? failedSelection ?? (!state.activeInvestigation ? initialId : null);
      if (id && unloaded.has(id)) void select(documents.get(id) ?? null);
    },
    retryLoad: () => failedSelection ? select(documents.get(failedSelection) ?? null) : undefined,
    setInvestigation(document: Investigation | null) { if (document) update({ ...document, updatedAt: Date.now() }); select(document ? documents.get(document.id)! : null); },
    selectId(id: string) { const document = documents.get(id); if (document) return select(document); },
    createNewInvestigation(name?: string) {
      const now = Date.now();
      const document = domain.newInvestigation(crypto.randomUUID(), name || `Investigation ${new Date(now).toLocaleDateString()}`, '', now);
      update(document); select(document); return document;
    },
    async saveCurrentInvestigation() { return (await Promise.all([groupSaves.flush(), saves.flush()])).every(Boolean); },
    async deleteInvestigation(id: string) {
      saves.pause(id);
      try { await saves.wait(id); await repository.deleteInvestigation(id); }
      catch (error) { saves.resume(id); throw error; }
      saves.remove(id); runs.cancelDocument(id); documents.delete(id);
      executing.delete(id); statuses.delete(id); unloaded.delete(id);
      cache.remove(id);
      if (state.loadingInvestigationId === id || failedSelection === id) {
        selection++; failedSelection = null; publish({ loadingInvestigationId: null, loadError: null });
      }
      if (state.activeInvestigation?.id === id) select(null);
      publish({ investigations: [...documents.values()] });
    },
    updateClusterGroup(connectionIds: string[]) {
      return setClusterGroup(domain.newClusterGroup(state.clusterGroup?.id ?? crypto.randomUUID(), state.clusterGroup?.name ?? 'Investigation clusters', connectionIds));
    },
    addCell(type: 'ppl' | 'markdown', afterCellId?: string) {
      if (!state.activeInvestigation) return;
      const cell = type === 'ppl' ? domain.newPPLCell(crypto.randomUUID(), Date.now()) : domain.newMarkdownCell(crypto.randomUUID(), Date.now());
      update(domain.addCell(state.activeInvestigation, cell, Date.now(), afterCellId));
    },
    deleteCell(cellId: string) {
      if (!state.activeInvestigation) return;
      runs.cancelDocument(state.activeInvestigation.id, cellId);
      const documentId = state.activeInvestigation.id;
      const values = new Map(statuses.get(documentId)); values.delete(cellId); statuses.set(documentId, values);
      const ids = new Set(executing.get(documentId)); ids.delete(cellId); executing.set(documentId, ids);
      update(domain.deleteCell(state.activeInvestigation, cellId, Date.now()));
      publish({ ...progress(documentId), executingCellIds: ids });
    },
    reorderCells(ids: string[]) {
      const document = state.activeInvestigation;
      if (!document || ids.length !== document.cells.length || new Set(ids).size !== ids.length || ids.some(id => !document.cells.some(cell => cell.id === id))) return;
      update(domain.reorderCells(document, ids, Date.now()));
    },
    setFederatedResult(cellId: string, result: FederatedPPLResult, documentId?: string) { updateCell(cellId, { lastResult: result }, documentId); },
    setCellExecuting(cellId: string, value: boolean, documentId = state.activeInvestigation?.id) {
      if (!documentId || !documents.has(documentId)) return;
      const ids = new Set(executing.get(documentId)); if (value) ids.add(cellId); else ids.delete(cellId);
      executing.set(documentId, ids);
      if (state.activeInvestigation?.id === documentId) publish({ executingCellIds: ids });
      queueMicrotask(() => cache.trim());
    },
    setClusterStatus(cellId: string, status: ClusterStatus, documentId = state.activeInvestigation?.id) {
      if (!documentId || !documents.get(documentId)?.cells.some(cell => cell.id === cellId)) return;
      const cells = new Map(statuses.get(documentId));
      const values = new Map(cells.get(cellId)); values.set(status.connectionId, status); cells.set(cellId, values); statuses.set(documentId, cells);
      if (state.activeInvestigation?.id === documentId) publish(progress(documentId));
    },
    clearClusterStatuses(cellId: string, documentId = state.activeInvestigation?.id) {
      if (!documentId) return;
      const cells = new Map(statuses.get(documentId)); cells.delete(cellId); statuses.set(documentId, cells);
      if (state.activeInvestigation?.id === documentId) publish(progress(documentId));
    },
    dispose() { disposed = true; selection++; runs.dispose(); groupSaves.dispose(); saves.dispose(); },
  };
}
export type InvestigationStore = ReturnType<typeof createInvestigationStore>;
