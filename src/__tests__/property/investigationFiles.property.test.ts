// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInvestigationStore, type InvestigationRepository, type InvestigationStore } from '../../features/investigation/state/store';
import { newInvestigation, newPPLCell } from '../../features/investigation/domain/document';
import { exportInvestigation, importInvestigation } from '../../services/investigationIO';
import type { DocumentFileAccess } from '../../platform/contracts';
import type { Investigation, ClusterGroup, FederatedPPLResult } from '../../types/investigation';
const result: FederatedPPLResult = { success: true, clusterResults: [], consolidatedSchema: [], consolidatedRows: [], totalRows: 0, successfulClusters: 1, failedClusters: 0, totalDuration: 1, executedAt: 1 };
const portable = { ...newInvestigation('portable', 'Logs', 'group', 1), cells: [{ ...newPPLCell('cell', 1), query: 'source=logs', lastResult: result, viewMode: 'table' as const }] };
const group = { id: 'group', name: 'Clusters', connectionIds: ['a', 'b'] };
const file = (name = 'Logs') => ({ path: '/project/logs.json', name: 'logs.json', revision: 'disk', content: exportInvestigation({ ...portable, name }, group) });
let stores: InvestigationStore[];
beforeEach(() => { localStorage.clear(); stores = []; });
afterEach(() => { stores.forEach(store => store.dispose()); localStorage.clear(); });
function setup(records: Investigation[] = [], extra: Partial<InvestigationRepository> = {}) {
  const saved = new Map(records.map(item => [item.id, item]));
  const savedGroups = new Map<string, ClusterGroup>();
  const repo: InvestigationRepository = { loadAllInvestigations: () => [...saved.values()], loadAllClusterGroups: () => [...savedGroups.values()],
    saveInvestigation: value => { saved.set(value.id, structuredClone(value)); }, saveClusterGroup: value => { savedGroups.set(value.id, structuredClone(value)); },
    deleteInvestigation: id => { saved.delete(id); }, ...extra };
  const files: DocumentFileAccess = { open: vi.fn().mockResolvedValue(file()), read: vi.fn().mockResolvedValue(file()),
    save: vi.fn().mockImplementation(request => Promise.resolve({ ...file(), path: request.path ?? '/project/copy.json', revision: 'written', content: request.content })) };
  const store = createInvestigationStore(repo, files); stores.push(store);
  return { store, files, saved, savedGroups, repo };
}
it('round-trips cells, saved results and cluster references while excluding file locations and credentials', () => {
  const content = exportInvestigation({ ...portable, file: { path: '/private/file.json', name: 'file.json', revision: 'secret', dirty: true } },
    { ...group, credentials: { password: 'password' }, endpoint: 'https://private' } as ClusterGroup);
  expect(content).not.toContain('/private'); expect(content).not.toContain('password'); expect(content).not.toContain('https://private');
  expect(importInvestigation(content)).toEqual({ investigation: portable, clusterGroup: group });
});
it('opens a separate document and group when portable IDs collide with existing recovery documents', async () => {
  const { store, savedGroups } = setup([portable]);
  await store.openFile(); await store.saveCurrentInvestigation();
  expect(store.getSnapshot().investigations).toHaveLength(2);
  const opened = store.getSnapshot().activeInvestigation!;
  expect(opened.id).not.toBe(portable.id);
  expect(opened.clusterGroupId).not.toBe(group.id);
  expect(savedGroups.get(opened.clusterGroupId)?.connectionIds).toEqual(['a', 'b']);
  expect(store.getDocument(portable.id)).toEqual(portable);
  expect(opened.file).toMatchObject({ path: '/project/logs.json', dirty: false });
});
it('saves to its file with conflict protection and Save As selects a new location', async () => {
  const { store, files } = setup();
  await store.openFile();
  store.updateCell('cell', { query: 'source=changed' });
  expect(store.getSnapshot().activeInvestigation?.file?.dirty).toBe(true);
  await store.saveFile();
  expect(files.save).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/project/logs.json', expectedRevision: 'disk' }));
  expect(importInvestigation(vi.mocked(files.save).mock.calls[0]![0].content).investigation.cells[0]).toMatchObject({ query: 'source=changed', lastResult: result });
  await store.saveFile(true);
  expect(vi.mocked(files.save).mock.calls[1]![0].path).toBeUndefined();
  expect(store.getSnapshot().activeInvestigation?.file).toMatchObject({ path: '/project/copy.json', dirty: false });
});
it('dirty reopen selects recovery; clean reopen reloads disk changes without duplicating documents', async () => {
  const { store, files } = setup();
  await store.openFile();
  vi.mocked(files.read).mockResolvedValue(file('Changed on disk'));
  await store.openFile('/project/logs.json');
  expect(store.getSnapshot().activeInvestigation?.name).toBe('Changed on disk');
  expect(store.getSnapshot().investigations).toHaveLength(1);
  store.updateCell('cell', { query: 'source=recovered' }); store.createNewInvestigation('Other');
  await store.openFile('/project/logs.json');
  expect(files.read).toHaveBeenCalledOnce();
  expect(store.getSnapshot().activeInvestigation?.cells[0]).toMatchObject({ query: 'source=recovered' });
});
it('preserves file bindings after restart, and forgetting recent history never deletes documents', async () => {
  const { store, files, repo, saved } = setup();
  await store.openFile(); store.updateClusterGroup(['new']); await store.saveCurrentInvestigation();
  const id = store.getSnapshot().activeInvestigation!.id;
  expect(saved.get(id)?.file?.dirty).toBe(true);
  const restored = createInvestigationStore(repo, files); stores.push(restored);
  expect(restored.getSnapshot().recentFiles).toHaveLength(1);
  restored.forgetRecentFile('/project/logs.json');
  expect(restored.getDocument(id)?.file?.dirty).toBe(true);
  expect(restored.getSnapshot().recentFiles).toEqual([]);
});
it('external conflict errors and cancelled or invalid opens leave recovery untouched', async () => {
  const { store, files } = setup();
  await store.openFile(); store.updateCell('cell', { query: 'source=dirty' });
  const original = store.getSnapshot().activeInvestigation;
  vi.mocked(files.save).mockRejectedValue('File changed on disk. Use Save As.');
  expect(await store.saveFile()).toBe(false);
  expect(store.getSnapshot().fileError).toContain('File changed on disk');
  vi.mocked(files.open).mockResolvedValue({ ...file(), path: '/other.json', content: '{"policy":{}}' });
  expect(await store.openFile()).toBeNull();
  expect(store.getSnapshot().activeInvestigation).toBe(original);
  vi.mocked(files.open).mockResolvedValue(null);
  expect(await store.openFile()).toBeNull();
  expect(store.getSnapshot().activeInvestigation).toBe(original);
});
it('a pending save remains associated with its originating document and later result changes remain dirty', async () => {
  const { store, files } = setup();
  await store.openFile(); const id = store.getSnapshot().activeInvestigation!.id;
  let finish!: () => void;
  vi.mocked(files.save).mockImplementation(request => new Promise(resolve => { finish = () => resolve({ ...file(), content: request.content, revision: 'written' }); }));
  const saving = store.saveFile();
  store.updateCell('cell', { query: 'source=while-saving' });
  const next = store.createNewInvestigation('Next');
  finish(); await saving;
  expect(store.getSnapshot().activeInvestigation?.id).toBe(next.id);
  expect(store.getDocument(id)?.file).toMatchObject({ revision: 'written', dirty: true });
});
it('loads lazy results before reopening a clean file and saving never erases another recovery document', async () => {
  const old = { ...portable, cells: [{ ...newPPLCell('cell', 1), query: 'old' }], file: { path: '/project/logs.json', name: 'logs.json', revision: 'disk', dirty: false } };
  const loadOutputs = vi.fn().mockResolvedValue({ ...old, cells: portable.cells });
  const { store } = setup([old], { unloadedIds: new Set([old.id]), loadOutputs });
  await store.openFile('/project/logs.json');
  expect(loadOutputs).toHaveBeenCalledWith(old.id);
  expect(store.getSnapshot().activeInvestigation?.cells[0]).toMatchObject({ lastResult: result });
  await store.saveFile();
});
it('rejects unsupported versions, duplicate cell IDs, and invalid cluster references before import', () => {
  const value = JSON.parse(file().content);
  for (const bad of [{ ...value, version: '2.0.0' }, { ...value, clusterGroup: { connectionIds: [42] } },
    { ...value, investigation: { ...portable, cells: [portable.cells[0], portable.cells[0]] } }]) {
    expect(() => importInvestigation(JSON.stringify(bad))).toThrow();
  }
});
it('rejects malformed saved results and chart settings rather than opening a broken editor', () => {
  const value = JSON.parse(file().content);
  for (const updates of [{ lastResult: {} }, { lastResult: { ...result, consolidatedRows: [null] } }, { viewMode: 'unknown' }, { chartConfig: { type: 'pie' } }]) {
    expect(() => importInvestigation(JSON.stringify({ ...value, investigation: { ...portable, cells: [{ ...portable.cells[0], ...updates }] } }))).toThrow();
  }
});
it('editing a shared cluster selection keeps another unloaded document and its outputs intact', async () => {
  const { store } = setup([portable, { ...portable, id: 'other' }], { unloadedIds: new Set(['other']) });
  store.selectId('portable');
  store.setClusterGroup(group);
  expect(store.getSnapshot().clusterGroup?.id).not.toBe(group.id);
  expect(store.getDocument('other')?.clusterGroupId).toBe(group.id);
});
