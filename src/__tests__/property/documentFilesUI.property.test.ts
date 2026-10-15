// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { configureDraftRepository, flushDrafts } from '../../storage/drafts';
import { createFeatureFileWorkspace } from '../../storage/featureFileWorkspace';
import { pipelineFileSettings, policyFileSettings } from '../../services/featureFileSettings';
import { DocumentFileActions, DocumentFilesHome, useDocumentFileView, type FileDraftItem, type FileViewActions, type FileViewState } from '../../components/Files/DocumentFiles';
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: { surface: '#fff', text: '#111', primary: '#005eb8', border: '#ddd', textMuted: '#555', textSecondary: '#333', error: '#b00' } }) }));
vi.mock('../../platform/runtime', async importOriginal => ({ ...await importOriginal<typeof import('../../platform/runtime')>(), isDesktopApp: () => true }));
let container: HTMLDivElement; let root: Root; let actions: FileViewActions; let state: FileViewState;
const draft = { id: 'draft', name: 'Recovered document', updatedAt: 2, file: { path: '/project/logs.json', name: 'logs.json', revision: 'disk', dirty: true } };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  actions = { newDocument: vi.fn(), selectId: vi.fn(), removeDraft: vi.fn(), forgetRecentFile: vi.fn(),
    openFile: vi.fn().mockResolvedValue('/project/located.json'), saveFile: vi.fn().mockResolvedValue(true) };
  state = { fileBusy: false, fileError: null, fileNotice: null, recentFiles: [{ path: '/project/logs.json', name: 'logs.json', openedAt: 10 }] };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); await flushDrafts(); container.remove(); vi.unstubAllGlobals(); });
function Fixture() {
  const view = useDocumentFileView(actions);
  return React.createElement(React.Fragment, null,
    React.createElement(DocumentFileActions, { actions, state, active: draft, view }),
    view.showFiles ? React.createElement(DocumentFilesHome, { label: 'Investigation', actions, state, drafts: [draft, { id: 'legacy', name: 'Legacy', updatedAt: 1 }], view }) : React.createElement('p', null, 'Editor'));
}
const button = (label: string) => Array.from(document.querySelectorAll('button')).find(item => item.textContent === label)!;
const render = () => act(async () => root.render(React.createElement(Fixture)));
it('shows separate recent paths, recovery changes and unsaved documents; Remove never discards recovery', async () => {
  await render();
  expect(container.textContent).toContain('Recovered changes'); expect(container.textContent).toContain('Unsaved documents'); expect(container.textContent).toContain('/project/logs.json');
  await act(async () => button('Remove').click());
  expect(actions.forgetRecentFile).toHaveBeenCalledWith('/project/logs.json'); expect(actions.removeDraft).not.toHaveBeenCalled();
});
it('Locate replaces the history location only after successfully opening a different path', async () => {
  await render(); await act(async () => button('Locate…').click());
  expect(actions.forgetRecentFile).toHaveBeenCalledWith('/project/logs.json'); expect(container.textContent).toContain('Editor');
});
it.each([null, '/project/logs.json'])('Locate preserves history on cancellation or the same chosen path (%s)', async path => {
  vi.mocked(actions.openFile).mockResolvedValue(path);
  await render(); await act(async () => button('Locate…').click());
  expect(actions.forgetRecentFile).not.toHaveBeenCalled();
});
it('confirms draft discard and explains that the disk file remains unchanged', async () => {
  await render(); await act(async () => button('Discard draft').click());
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('The file on disk will remain unchanged.'); expect(actions.removeDraft).not.toHaveBeenCalled();
  await act(async () => Array.from(dialog.querySelectorAll('button')).find(item => item.textContent === 'Discard draft')!.click());
  expect(actions.removeDraft).toHaveBeenCalledWith('draft');
});
it('disables file controls and shortcuts during a pending native operation', async () => {
  state.fileBusy = true; await render();
  expect(Array.from(container.querySelectorAll('button')).every(button => button.disabled)).toBe(true);
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true })));
  expect(actions.saveFile).not.toHaveBeenCalled();
});
it('uses Ctrl/Cmd+S and Shift+S for Save and Save As, and restores the filename dirty indicator', async () => {
  await render(); await act(async () => button('New').click()); expect(container.textContent).toContain('logs.json *');
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true })));
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true })));
  expect(actions.saveFile).toHaveBeenNthCalledWith(1); expect(actions.saveFile).toHaveBeenNthCalledWith(2, true);
});
it.each(['Data Prepper', 'ISM'])('can discard the last %s draft through the confirmation dialog without creating another', async label => {
  configureDraftRepository([], async () => {});
  const access = { open: vi.fn().mockResolvedValue(null), read: vi.fn(), save: vi.fn() };
  const workspace = label === 'Data Prepper'
    ? createFeatureFileWorkspace(pipelineFileSettings({ sourceData: '{}', sourceFormat: 'json', pipelineConfig: 'logs: {}' }), access)
    : createFeatureFileWorkspace(policyFileSettings('{"policy":{"states":[]}}'), access);
  function RealDraftFixture() {
    const snapshot = useSyncExternalStore<FileViewState & { active: FileDraftItem | null; documents: FileDraftItem[] }>(workspace.subscribe, workspace.getSnapshot);
    const view = useDocumentFileView(workspace);
    return React.createElement(React.Fragment, null,
      React.createElement(DocumentFileActions, { actions: workspace, state: snapshot, active: snapshot.active, view }),
      React.createElement(DocumentFilesHome, { label, actions: workspace, state: snapshot, drafts: snapshot.documents, view }));
  }
  await act(async () => root.render(React.createElement(RealDraftFixture)));
  await act(async () => button('Discard draft').click());
  const dialog = document.querySelector('[role="dialog"]')!;
  await act(async () => Array.from(dialog.querySelectorAll('button')).find(item => item.textContent === 'Discard draft')!.click());
  expect(workspace.getSnapshot().documents).toEqual([]);
  expect(button('Save').disabled).toBe(true);
  expect(button('Save As…').disabled).toBe(true);
  expect(button('New').disabled).toBe(false);
  expect(button('Open…').disabled).toBe(false);
  expect(container.textContent).not.toContain('Untitled');
  expect(container.textContent).not.toContain('Unsaved documents');
  await act(async () => button('New').click());
  expect(workspace.getSnapshot().documents).toHaveLength(1);
  expect(button('Save').disabled).toBe(false);
});
it('ignores Save shortcuts on the recent-files screen instead of saving a hidden document', async () => {
  await render();
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true })));
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true })));
  expect(actions.saveFile).not.toHaveBeenCalled();
  expect(button('Save').disabled).toBe(true);
  expect(button('Save As…').disabled).toBe(true);
});
