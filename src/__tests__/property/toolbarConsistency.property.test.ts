// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { setLanguage, LANGUAGE_KEY } from '../../i18n';
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../context/ThemeContext';
import { Toolbar } from '../../features/notebook/ui/layout/Toolbar';
import { DataPrepperWorkbench } from '../../features/dataprepper/ui/DataPrepperWorkbench';
import { ISMPolicyAnalyzer } from '../../features/ism/ui/ISMPolicyAnalyzer';
import { InvestigationWorkspace } from '../../features/investigation/ui/InvestigationWorkspace';

const mock = vi.hoisted(() => ({ files: {
  newDocument: vi.fn(), openFile: vi.fn().mockResolvedValue('/project/file.json'), saveFile: vi.fn().mockResolvedValue(true),
  selectId: vi.fn(), removeDraft: vi.fn(), forgetRecentFile: vi.fn(),
}, onFeatureChange: vi.fn() }));
const document = { id: 'doc', name: 'Document', updatedAt: 1, cells: [], file: { path: '/project/file.json', name: 'file.json', revision: 'disk', dirty: false } };
const state = { active: document, documents: [document], recentFiles: [], fileBusy: false, fileError: null, fileNotice: null };
vi.mock('../../utils/platform', () => ({ needsTrafficLightPadding: () => false, isDesktopApp: () => false, isTauri: () => false }));
vi.mock('../../components/ConnectionSelector', () => ({ ConnectionSelector: () => null }));
vi.mock('../../connections/ConnectionProvider', () => ({ useConnections: () => ({ addConnection: vi.fn(), error: null }) }));
vi.mock('../../features/notebook/ui/NotebookContext', () => ({ useNotebook: () => ({ activeNotebook: document, activeFile: document.file, fileBusy: false, renameNotebook: vi.fn() }), useUI: () => ({ toggleSidebar: vi.fn(), sidebarOpen: false }) }));
vi.mock('../../features/dataprepper/ui/DataPrepperContext', () => ({ DataPrepperProvider: ({ children }: { children: React.ReactNode }) => children,
  useDataPrepper: () => ({ files: mock.files, fileState: state, sourceErrors: [], pipelineErrors: [], isProcessing: false, saveState: 'saved', retrySave: vi.fn() }) }));
vi.mock('../../features/ism/ui/ISMAnalyzerContext', () => ({ ISMAnalyzerProvider: ({ children }: { children: React.ReactNode }) => children,
  useISMAnalyzer: () => ({ files: mock.files, fileState: state, analysisResults: [], validationErrors: [], saveState: 'saved', retrySave: vi.fn(), activeTab: 'reference' }) }));
vi.mock('../../features/investigation/ui/InvestigationContext', () => ({ InvestigationProvider: ({ children }: { children: React.ReactNode }) => children,
  useInvestigation: () => ({ state: { ...state, activeInvestigation: document, investigations: [document], clusterGroup: null, saveState: 'saved' },
    ...mock.files, createNewInvestigation: mock.files.newDocument, deleteInvestigation: mock.files.removeDraft, saveCurrentInvestigation: vi.fn() }) }));
vi.mock('../../features/dataprepper/ui/SourceEditor', () => ({ SourceEditor: () => null }));
vi.mock('../../features/dataprepper/ui/ConfigEditor', () => ({ ConfigEditor: () => null }));
vi.mock('../../features/dataprepper/ui/OutputPanel', () => ({ OutputPanel: () => null }));
vi.mock('../../features/ism/ui/PolicyEditor', () => ({ PolicyEditor: () => null }));
vi.mock('../../features/ism/ui/ReferencePanel', () => ({ ReferencePanel: () => null }));
vi.mock('../../features/investigation/ui/InvestigationCellList', () => ({ InvestigationCellList: () => null }));
vi.mock('../../features/investigation/ui/ClusterSelector', () => ({ ClusterSelector: () => null }));
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  setLanguage('en'); vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = window.document.createElement('div'); window.document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); setLanguage('en'); localStorage.clear(); vi.unstubAllGlobals(); });
function NotebookFixture() {
  const [showFiles, setShowFiles] = useState(true);
  return React.createElement(Toolbar, { showFiles, onShowFiles: () => setShowFiles(true), onCreateNotebook: () => { mock.files.newDocument(); setShowFiles(false); },
    onOpenNotebook: () => { void mock.files.openFile(); setShowFiles(false); }, onSaveNotebook: () => { void mock.files.saveFile(); }, onSaveNotebookAs: () => { void mock.files.saveFile(true); }, onFeatureChange: mock.onFeatureChange });
}
it.each(['Notebook', 'Data Prepper', 'ISM', 'Investigation'])('%s keeps file controls in the same order and routes each action to the current view', async view => {
  const component = view === 'Notebook' ? React.createElement(NotebookFixture) : view === 'Data Prepper' ? React.createElement(DataPrepperWorkbench, { onFeatureChange: mock.onFeatureChange })
    : view === 'ISM' ? React.createElement(ISMPolicyAnalyzer, { onFeatureChange: mock.onFeatureChange }) : React.createElement(InvestigationWorkspace, { onFeatureChange: mock.onFeatureChange });
  await act(async () => root.render(React.createElement(ThemeProvider, null, component)));
  const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-label="File actions"] > button'));
  expect(buttons().map(item => item.textContent)).toEqual(['Recent files', 'New', 'Open…', 'Save', 'Save As…']);
  expect(buttons()[3]!.disabled).toBe(true); expect(buttons()[4]!.disabled).toBe(true);
  await act(async () => buttons()[1]!.click());
  expect(mock.files.newDocument).toHaveBeenCalledOnce();
  expect(buttons()[3]!.disabled).toBe(false);
  await act(async () => buttons()[3]!.click()); await act(async () => buttons()[4]!.click());
  expect(mock.files.saveFile).toHaveBeenNthCalledWith(1); expect(mock.files.saveFile).toHaveBeenNthCalledWith(2, true);
  await act(async () => buttons()[0]!.click()); expect(buttons()[3]!.disabled).toBe(true);
  await act(async () => buttons()[2]!.click()); expect(mock.files.openFile).toHaveBeenCalledOnce();
  const tab = container.querySelector<HTMLButtonElement>('[aria-label="Workbench features"] button')!;
  await act(async () => tab.click()); expect(mock.onFeatureChange).toHaveBeenCalledWith('notebook');
  expect(container.querySelector('[aria-label="Switch to dark mode"], [aria-label="Switch to light mode"]')).not.toBeNull();
});

it.each(['Notebook', 'Data Prepper', 'ISM', 'Investigation'])('%s switches languages in place and retains its document and actions', async view => {
  const component = view === 'Notebook' ? React.createElement(NotebookFixture) : view === 'Data Prepper' ? React.createElement(DataPrepperWorkbench, { onFeatureChange: mock.onFeatureChange })
    : view === 'ISM' ? React.createElement(ISMPolicyAnalyzer, { onFeatureChange: mock.onFeatureChange }) : React.createElement(InvestigationWorkspace, { onFeatureChange: mock.onFeatureChange });
  await act(async () => root.render(React.createElement(ThemeProvider, null, component)));
  const preferences = () => container.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!;
  await act(async () => preferences().click());
  const selector = window.document.querySelector<HTMLSelectElement>('[role="dialog"] select')!;
  await act(async () => { selector.value = 'ja'; selector.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe('ja');
  expect(window.document.querySelector('[role="dialog"] h2')!.textContent).toBe('環境設定');
  await act(async () => window.document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click());
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-label="ファイルの操作"] > button'));
  expect(buttons.map(item => item.textContent)).toEqual(['最近のファイル', '新規', '開く…', '保存', '名前を付けて保存…']);
  expect(container.querySelector('[aria-label="ワークベンチの機能"]')!.textContent).toContain('ノートブック');
  await act(async () => buttons[1]!.click());
  expect(mock.files.newDocument).toHaveBeenCalledOnce();
  expect(container.textContent).toContain('file.json');
  await act(async () => buttons[3]!.click());
  expect(mock.files.saveFile).toHaveBeenCalledOnce();
  await act(async () => preferences().click());
  const reopened = window.document.querySelector<HTMLSelectElement>('[role="dialog"] select')!;
  expect(reopened.value).toBe('ja');
  await act(async () => { reopened.value = 'en'; reopened.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => window.document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click());
  expect(container.querySelector('[aria-label="File actions"]')!.textContent).toContain('Save As…');
});
