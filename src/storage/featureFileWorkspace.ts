// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { getDraftStore, type WorkspaceDraft } from './drafts';
import { documentFiles } from '../platform/runtime';
import type { DocumentFileAccess } from '../platform/contracts';
import { loadRecentDocumentFiles, saveRecentDocumentFiles, rememberDocumentFile } from '../services/recentDocumentFiles';
import type { FileDraft, FileWorkspaceModel } from './fileWorkspaceModel';

export interface FeatureFileSettings<T> {
  initial: WorkspaceDraft;
  label: string;
  empty: T;
  extract(record: WorkspaceDraft): T;
  reflect(record: WorkspaceDraft, content: T, model: FileWorkspaceModel<T>): WorkspaceDraft;
  parse(text: string): T;
  serialize(value: T): string;
  legacy?(record: WorkspaceDraft): FileDraft<T>[];
}
export function createFeatureFileWorkspace<T>(settings: FeatureFileSettings<T>, files: DocumentFileAccess = documentFiles) {
  const owner = getDraftStore(settings.initial);
  const kind = settings.initial.id;
  const initialRecord = owner.getSnapshot().record;
  const makeDraft = (content: T, name = `Untitled ${settings.label}`): FileDraft<T> => ({ id: crypto.randomUUID(), name, content, updatedAt: Date.now() });
  const first = makeDraft(settings.extract(initialRecord));
  let model = initialRecord.content.fileWorkspace as FileWorkspaceModel<T> | undefined
    ?? { version: 1, activeId: first.id, documents: [first, ...(settings.legacy?.(initialRecord) ?? [])] };
  let state = { ...owner.getSnapshot(), active: model.documents.find(item => item.id === model.activeId) ?? null, documents: model.documents,
    recentFiles: loadRecentDocumentFiles(kind), fileBusy: false, fileError: null as string | null, fileNotice: null as string | null };
  const listeners = new Set<() => void>();
  function publish(update: Partial<typeof state> = {}) { state = { ...state, ...update }; listeners.forEach(listener => listener()); }
  owner.subscribe(() => publish(owner.getSnapshot()));
  function commit(next: FileWorkspaceModel<T>) {
    model = next;
    const active = model.documents.find(item => item.id === model.activeId) ?? null;
    // Keep the legacy fields in sync for migration and existing consumers.
    owner.update(settings.reflect(owner.getSnapshot().record, active?.content ?? settings.empty, model));
    publish({ active, documents: model.documents });
  }
  function remember(path: string, name: string) {
    const recentFiles = rememberDocumentFile(state.recentFiles, { path, name });
    publish({ recentFiles });
    try { saveRecentDocumentFiles(kind, recentFiles); }
    catch { publish({ fileNotice: 'File saved or opened, but recent-file history could not be stored.' }); }
  }
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unable to access the file.';
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    retrySave: owner.flush,
    update(change: Partial<T> | ((previous: T) => T)) {
      const previous = state.active;
      if (!previous) return;
      const content = typeof change === 'function' ? change(previous.content) : { ...previous.content, ...change };
      const next = { ...previous, content, updatedAt: Date.now(), ...(previous.file ? { file: { ...previous.file, dirty: true } } : {}) };
      commit({ ...model, documents: model.documents.map(item => item.id === next.id ? next : item) });
      publish({ fileNotice: null });
    },
    newDocument() {
      if (state.fileBusy) return;
      const next = makeDraft(settings.empty);
      commit({ ...model, activeId: next.id, documents: [...model.documents, next] });
      publish({ fileError: null, fileNotice: null });
    },
    selectId(id: string) {
      if (state.fileBusy || !model.documents.some(item => item.id === id)) return;
      commit({ ...model, activeId: id }); publish({ fileError: null, fileNotice: null });
    },
    removeDraft(id: string) {
      if (state.fileBusy) return;
      const documents = model.documents.filter(item => item.id !== id);
      commit({ ...model, documents, activeId: model.activeId === id ? documents[0]?.id ?? null : model.activeId });
    },
    forgetRecentFile(path: string) {
      const recentFiles = state.recentFiles.filter(item => item.path !== path);
      try { saveRecentDocumentFiles(kind, recentFiles); publish({ recentFiles }); }
      catch (error) { publish({ fileError: errorMessage(error) }); }
    },
    async openFile(path?: string): Promise<string | null> {
      if (state.fileBusy) return null;
      publish({ fileBusy: true, fileError: null, fileNotice: null });
      try {
        const existing = path ? model.documents.find(item => item.file?.path === path) : undefined;
        if (existing?.file?.dirty) {
          commit({ ...model, activeId: existing.id });
          publish({ fileNotice: 'Recovered unsaved changes. Save As keeps the current file intact.' });
          return path!;
        }
        const file = path ? await files.read(path) : await files.open({ title: `Open ${settings.label}` });
        if (!file) return null;
        const recovery = file.path ? model.documents.find(item => item.file?.path === file.path && item.file.dirty) : undefined;
        if (recovery) {
          commit({ ...model, activeId: recovery.id });
          publish({ fileNotice: 'Recovered unsaved changes. Save As keeps the current file intact.' });
        } else {
          const content = settings.parse(file.content.replace(/^\uFEFF/, ''));
          const previous = file.path ? model.documents.find(item => item.file?.path === file.path) : undefined;
          const next = { ...makeDraft(content, file.name), id: previous?.id ?? crypto.randomUUID(), file: {
            path: file.path, name: file.name, revision: file.revision, dirty: false,
          } };
          commit({ ...model, activeId: next.id, documents: [...model.documents.filter(item => item.id !== next.id), next] });
        }
        if (file.path) remember(file.path, file.name);
        return file.path ?? '';
      } catch (error) { publish({ fileError: errorMessage(error) }); return null; }
      finally { publish({ fileBusy: false }); }
    },
    async saveFile(saveAs = false): Promise<boolean> {
      if (state.fileBusy || !state.active) return false;
      const original = state.active;
      publish({ fileBusy: true, fileError: null, fileNotice: null });
      try {
        const content = settings.serialize(original.content);
        const file = await files.save({ title: `Save ${settings.label} as`,
          suggestedName: original.file?.name ?? `${kind}.json`, content,
          ...(!saveAs && original.file?.path ? { path: original.file.path, expectedRevision: original.file.revision } : {}),
        });
        if (!file) return false;
        const current = model.documents.find(item => item.id === original.id);
        if (current) {
          const next = { ...current, file: { path: file.path, name: file.name, revision: file.revision, dirty: current.content !== original.content } };
          commit({ ...model, documents: model.documents.map(item => item.id === next.id ? next : item) });
        }
        if (file.path) remember(file.path, file.name);
        else publish({ fileNotice: 'Download started. Your draft remains available here.' });
        return true;
      } catch (error) { publish({ fileError: errorMessage(error) }); return false; }
      finally { publish({ fileBusy: false }); }
    },
  };
}
export type FeatureFileWorkspace<T> = ReturnType<typeof createFeatureFileWorkspace<T>>;
const owners = new WeakMap<ReturnType<typeof getDraftStore>, unknown>();
export function getFeatureFileWorkspace<T>(settings: FeatureFileSettings<T>): FeatureFileWorkspace<T> {
  const owner = getDraftStore(settings.initial);
  if (!owners.has(owner)) owners.set(owner, createFeatureFileWorkspace(settings));
  return owners.get(owner) as FeatureFileWorkspace<T>;
}
