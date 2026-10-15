// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DocumentToolbar } from '../../components/Files/DocumentToolbar';
import { PreferencesMenu } from '../../components/Layout/PreferencesMenu';
import { ThemeProvider } from '../../context/ThemeContext';
import { initializePlatform } from '../../platform/runtime';
import { createBrowserAdapter } from '../../platform/adapters/browser';
import { setLanguage } from '../../i18n';
import type { NativeMenuAction, NativeMenuState } from '../../platform/contracts';

const { createApplicationMenu } = createRequire(import.meta.url)('../../../electron/menu.cjs');
let container: HTMLDivElement;
let root: Root;
let handlers: Set<(action: NativeMenuAction) => void>;
let update: ReturnType<typeof vi.fn<(state: NativeMenuState) => Promise<void>>>;
let commands: Record<'onNew' | 'onOpen' | 'onHome' | 'onSave' | 'onSaveAs', ReturnType<typeof vi.fn<() => void>>>;
const browser = () => createBrowserAdapter(vi.fn(), false);
const latest = () => update.mock.calls[update.mock.calls.length - 1]![0];
const dispatch = (action: NativeMenuAction) => act(async () => { handlers.forEach(handler => handler(action)); });
async function render(overrides: Partial<React.ComponentProps<typeof DocumentToolbar>> = {}) {
  await act(async () => root.render(React.createElement(StrictMode, null, React.createElement(ThemeProvider, null,
    React.createElement(DocumentToolbar, { busy: false, hasDocument: true, showFiles: false, title: 'Current document', ...commands, ...overrides }),
    React.createElement(PreferencesMenu)))));
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  setLanguage('en');
  handlers = new Set(); update = vi.fn().mockResolvedValue(undefined);
  initializePlatform({ ...browser(), kind: 'tauri', menu: {
    listen: async handler => { handlers.add(handler); return () => { handlers.delete(handler); }; }, update,
  } });
  commands = { onNew: vi.fn(), onOpen: vi.fn(), onHome: vi.fn(), onSave: vi.fn(), onSaveAs: vi.fn() };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove(); initializePlatform(browser()); setLanguage('en'); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

it('moves desktop actions out of the toolbar and routes each menu command exactly once in StrictMode', async () => {
  await render();
  expect(container.querySelectorAll('button')).toHaveLength(0);
  expect(container.textContent).toBe('Current document');
  for (const [action, command] of [['new', 'onNew'], ['open', 'onOpen'], ['recent', 'onHome'], ['save', 'onSave'], ['save-as', 'onSaveAs']] as const) {
    await dispatch(action); expect(commands[command]).toHaveBeenCalledTimes(1);
  }
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true })));
  expect(commands.onSave).toHaveBeenCalledTimes(1);
});

it('uses current workspace callbacks and disables Save for the files screen, missing documents and busy operations', async () => {
  await render();
  const save = vi.fn(); await render({ onSave: save }); await dispatch('save');
  expect(save).toHaveBeenCalledTimes(1); expect(commands.onSave).not.toHaveBeenCalled();
  for (const props of [{ showFiles: true }, { hasDocument: false }, { busy: true }]) {
    await render(props);
    expect(latest().enabled.save).toBe(false); expect(latest().enabled['save-as']).toBe(false);
    await dispatch('save'); await dispatch('save-as');
    expect(commands.onSave).not.toHaveBeenCalled(); expect(commands.onSaveAs).not.toHaveBeenCalled();
  }
  await dispatch('new'); await dispatch('open'); await dispatch('recent');
  expect(commands.onNew).not.toHaveBeenCalled(); expect(commands.onOpen).not.toHaveBeenCalled(); expect(commands.onHome).not.toHaveBeenCalled();
});

it('opens Preferences from the native menu and blocks file commands while the dialog is open', async () => {
  await render(); await dispatch('preferences');
  expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Preferences');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(latest().enabled.new).toBe(false);
  await dispatch('new'); await dispatch('open'); await dispatch('save');
  expect(commands.onNew).not.toHaveBeenCalled(); expect(commands.onOpen).not.toHaveBeenCalled(); expect(commands.onSave).not.toHaveBeenCalled();
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(latest().enabled.save).toBe(true);
});

it('updates native labels when the app language changes and releases listeners on unmount', async () => {
  await render(); await act(async () => setLanguage('ja'));
  expect(latest().labels.file).toBe('ファイル'); expect(latest().labels.preferences).toBe('環境設定…');
  await act(async () => root.render(null));
  expect(handlers.size).toBe(0); expect(latest().enabled).toEqual({});
});

it('keeps browser controls and keyboard shortcuts available', async () => {
  initializePlatform(browser()); await render();
  expect(Array.from(container.querySelectorAll('button')).map(button => button.textContent)).toEqual([
    'Recent files', 'New', 'Open…', 'Save', 'Save As…', 'Preferences',
  ]);
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true })));
  expect(commands.onSaveAs).toHaveBeenCalledTimes(1); expect(update).not.toHaveBeenCalled();
});

it('keeps file actions accessible if native menu setup fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  update.mockRejectedValue(new Error('Menu unavailable')); await render();
  expect(Array.from(container.querySelectorAll('button')).map(button => button.textContent)).toContain('Save');
  expect(Array.from(container.querySelectorAll('button')).map(button => button.textContent)).toContain('Preferences');
});

it.each(['darwin', 'win32', 'linux'])('builds an Electron menu with native shortcuts and platform placement on %s', platform => {
  const items = new Map<string, any>();
  let template: any[] = [];
  const Menu = { buildFromTemplate: vi.fn((value: any[]) => {
    template = value;
    const visit = (nodes: any[]) => nodes.forEach(node => { if (node.id) items.set(node.id, node); if (node.submenu) visit(node.submenu); });
    visit(value); return { getMenuItemById: (id: string) => items.get(id) };
  }), setApplicationMenu: vi.fn() };
  const send = vi.fn();
  const menu = createApplicationMenu({ Menu, app: { name: 'Workbench' }, getWindow: () => ({ isDestroyed: () => false, webContents: { send } }), platform });
  expect(items.get('save').enabled).toBe(false);
  menu.update({ labels: { save: '保存' }, enabled: { save: true } });
  expect(items.get('save')).toMatchObject({ label: '保存', enabled: true, accelerator: 'CmdOrCtrl+S' });
  expect(items.get('save-as').accelerator).toBe('CmdOrCtrl+Shift+S');
  expect(items.get('preferences').accelerator).toBe('CmdOrCtrl+,');
  expect((platform === 'darwin' ? template[0] : items.get('edit')).submenu).toContain(items.get('preferences'));
  items.get('save').click(); expect(send).toHaveBeenCalledWith('menu:action', 'save');
  menu.update({}); expect(items.get('save').enabled).toBe(false);
});
