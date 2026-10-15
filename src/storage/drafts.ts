// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { createSaveCoordinator, type SaveState } from './saveCoordinator';
import { isPipelineDocument, type PipelineDocument } from '../features/dataprepper/domain/document';
import { isFileWorkspace, type FileWorkspaceModel } from './fileWorkspaceModel';
import type { SavedPolicy } from '../types/ism';

export type PipelineDraft = PipelineDocument & { fileWorkspace?: FileWorkspaceModel<PipelineDocument> };
export interface PolicyDraft { policyJson: string; recentPolicies: SavedPolicy[]; fileWorkspace?: FileWorkspaceModel<string> }
export type WorkspaceDraft = { id: 'dataprepper'; content: PipelineDraft } | { id: 'ism'; content: PolicyDraft };
let records: WorkspaceDraft[] = [];
let write: (record: WorkspaceDraft) => Promise<void> = async () => { throw new Error('Workspace storage has not opened'); };
export function configureDraftRepository(initial: WorkspaceDraft[], save: typeof write) {
  records = initial; write = save; stores.clear();
}
export function validateDraft(value: unknown): asserts value is WorkspaceDraft {
  if (!value || typeof value !== 'object' || !('id' in value) || !('content' in value)
    || !value.content || typeof value.content !== 'object') throw new Error('Invalid feature draft');
  const content = value.content;
  if (value.id === 'dataprepper' && isPipelineDocument(content)
    && (!('fileWorkspace' in content) || isFileWorkspace(content.fileWorkspace, isPipelineDocument))) return;
  if (value.id === 'ism' && 'policyJson' in content && typeof content.policyJson === 'string'
    && (!('fileWorkspace' in content) || isFileWorkspace(content.fileWorkspace, (item): item is string => typeof item === 'string'))
    && 'recentPolicies' in content && Array.isArray(content.recentPolicies)
    && content.recentPolicies.every(item => item && typeof item.id === 'string' && typeof item.name === 'string'
      && typeof item.policy === 'string' && Number.isFinite(item.timestamp))) return;
  throw new Error('Invalid feature draft');
}
function createDraftStore(initial: WorkspaceDraft) {
  let snapshot = { record: records.find(record => record.id === initial.id) ?? initial, saveState: 'saved' as SaveState, saveError: null as string | null };
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  const saves = createSaveCoordinator<WorkspaceDraft>(async (_id, record) => {
    await write(record); records = [...records.filter(item => item.id !== record.id), record];
  }, (saveState, saveError) => { snapshot = { ...snapshot, saveState, saveError }; publish(); });
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update(record: WorkspaceDraft) {
      validateDraft(record);
      snapshot = { ...snapshot, record }; saves.schedule(record.id, record, 400); publish();
    },
    flush: saves.flush,
  };
}
const stores = new Map<string, ReturnType<typeof createDraftStore>>();
export function getDraftStore(initial: WorkspaceDraft) {
  let store = stores.get(initial.id);
  if (!store) { store = createDraftStore(initial); stores.set(initial.id, store); }
  return store;
}
export function flushDrafts() { return Promise.all([...stores.values()].map(store => store.flush())); }
export function hasUnsavedDrafts() { return [...stores.values()].some(store => store.getSnapshot().saveState !== 'saved'); }
