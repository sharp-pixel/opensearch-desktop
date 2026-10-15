// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RecentNotebookFiles } from '../../features/notebook/ui/RecentNotebookFiles';
import { NotebookFileTitle } from '../../features/notebook/ui/NotebookFileTitle';
import { useNotebook } from '../../features/notebook/ui/NotebookContext';
import { newNotebook } from '../../features/notebook/domain/create';

const current = vi.hoisted(() => ({ value: {} as ReturnType<typeof useNotebook> }));
vi.mock('../../features/notebook/ui/NotebookContext', () => ({ useNotebook: () => current.value }));
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: { surface: '#fff', text: '#111', primary: '#005eb8', border: '#ddd', textMuted: '#555', textSecondary: '#333', error: '#b00' } }) }));
vi.mock('../../platform/runtime', async importOriginal => ({ ...await importOriginal<typeof import('../../platform/runtime')>(), isDesktopApp: () => true }));
let container: HTMLDivElement;
let root: Root;
const onOpen = vi.fn(); const onNew = vi.fn(); const onLocate = vi.fn(); const onResume = vi.fn();

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  onOpen.mockClear(); onNew.mockClear(); onLocate.mockClear(); onResume.mockClear();
  current.value = {
    notebooks: [
      { id: 'legacy', name: 'Old notebook', createdAt: 1, updatedAt: 1, cellCount: 2 },
      { id: 'recovered', name: 'Edited file', createdAt: 1, updatedAt: 2, cellCount: 1,
        file: { path: '/project/edited.json', name: 'edited.json', revision: 'disk', dirty: true } },
    ],
    recentFiles: [{ path: '/project/search.json', name: 'search.json', openedAt: 10 }],
    fileBusy: false, forgetRecentFile: vi.fn(), deleteNotebook: vi.fn().mockResolvedValue(undefined),
    activeNotebook: newNotebook('Search', 'active', 1), activeFile: { path: '/project/search.json', name: 'search.json', revision: 'disk', dirty: true },
    renameNotebook: vi.fn(),
  } as unknown as ReturnType<typeof useNotebook>;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function renderHome() { await act(async () => root.render(React.createElement(RecentNotebookFiles, { onOpen, onNew, onLocate, onResume }))); }
const button = (text: string) => Array.from(document.querySelectorAll('button')).find(item => item.textContent?.trim() === text)!;

it('shows file locations and preserves legacy notebooks and recovered changes as separate sections', async () => {
  await renderHome();
  expect(container.textContent).toContain('Recent files');
  expect(container.textContent).toContain('/project/search.json');
  expect(container.textContent).toContain('Unsaved notebooks');
  expect(container.textContent).toContain('Old notebook');
  expect(container.textContent).toContain('Recovered changes');
  expect(container.textContent).toContain('/project/edited.json');
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Locate search.json"]')!.click());
  expect(onLocate).toHaveBeenCalledWith('/project/search.json');
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Remove search.json from recent files"]')!.click());
  expect(current.value.forgetRecentFile).toHaveBeenCalledWith('/project/search.json');
  expect(current.value.deleteNotebook).not.toHaveBeenCalled();
});

it('requires confirmation to discard recovery data and clearly states that the file remains untouched', async () => {
  await renderHome();
  await act(async () => button('Discard draft').click());
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('The file on disk will remain unchanged.');
  expect(current.value.deleteNotebook).not.toHaveBeenCalled();
  const confirm = Array.from(dialog.querySelectorAll('button')).find(item => item.textContent === 'Discard draft')!;
  await act(async () => confirm.click());
  expect(current.value.deleteNotebook).toHaveBeenCalledWith('recovered');
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('disables file and recovery actions while a native operation is pending', async () => {
  current.value = { ...current.value, fileBusy: true };
  await renderHome();
  expect(Array.from(container.querySelectorAll('button')).every(item => item.disabled)).toBe(true);
});

it('shows the filename with a dirty indicator and supports renaming through an accessible dialog', async () => {
  await act(async () => root.render(React.createElement(NotebookFileTitle)));
  const title = button('search.json *');
  expect(title.title).toBe('/project/search.json');
  title.focus();
  await act(async () => title.click());
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async () => button('Rename').click());
  expect(current.value.renameNotebook).toHaveBeenCalledWith('Search');
  expect(document.activeElement).toBe(title);
});
