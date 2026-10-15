// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../context/ThemeContext';
import { QueryCell } from '../../features/notebook/ui/cells/QueryCell';
import type { QueryCell as QueryCellType } from '../../types/cell';
import { initializePlatform, openExternal } from '../../platform/runtime';
import { createBrowserAdapter } from '../../platform/adapters/browser';
import { createTauriAdapter } from '../../platform/adapters/tauri';
import { createElectronAdapter } from '../../platform/adapters/electron';
import type { ElectronAPI } from '../../platform/contracts';
import { openApiDocumentation } from '../../services/apiDocumentation';
import { setLanguage } from '../../i18n';

vi.mock('../../editor/WorkbenchEditor', () => ({ WorkbenchEditor: () => null }));
let root: Root; let container: HTMLDivElement;
const browser = () => createBrowserAdapter(vi.fn(), false);
const invoke = vi.fn().mockResolvedValue(undefined);
const cell: QueryCellType = { id: 'query', type: 'query', method: 'GET', endpoint: '/_search', body: '', createdAt: 1, updatedAt: 1 };
const render = (endpoint: string) => act(async () => root.render(React.createElement(ThemeProvider, null,
  React.createElement(QueryCell, { cell: { ...cell, endpoint }, connection: null, isExecuting: false, onUpdate: vi.fn(), onRun: vi.fn() }))));
const clickDocumentation = () => act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="API Documentation"]')!.click());

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); setLanguage('en');
  invoke.mockReset().mockResolvedValue(undefined);
  initializePlatform(createTauriAdapter({ invoke }, browser()));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove();
  initializePlatform(browser()); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('opens the current query documentation through Tauri, including after changing endpoints', async () => {
  const popup = vi.spyOn(window, 'open');
  await render('/products/_search?size=10');
  await clickDocumentation();
  expect(invoke).toHaveBeenLastCalledWith('plugin:shell|open', { path: 'https://opensearch.org/docs/latest/api-reference/search/' });
  await render('_cluster/health');
  await clickDocumentation();
  expect(invoke).toHaveBeenLastCalledWith('plugin:shell|open', { path: 'https://opensearch.org/docs/latest/api-reference/cluster-api/cluster-health/' });
  expect(popup).not.toHaveBeenCalled();
});

it('shows an opening failure and lets the user retry', async () => {
  invoke.mockRejectedValueOnce('open denied');
  await render('/_search'); await clickDocumentation();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Unable to open API documentation');
  await clickDocumentation();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(invoke).toHaveBeenCalledTimes(2);
});

it('preserves browser and Electron navigation and the fallback for unmapped APIs', async () => {
  const popup = vi.spyOn(window, 'open').mockReturnValue(null);
  initializePlatform(browser());
  await openApiDocumentation('/_unknown', 'GET');
  expect(popup).toHaveBeenLastCalledWith('https://opensearch.org/docs/latest/api-reference/index/', '_blank', 'noopener,noreferrer');
  initializePlatform(createElectronAdapter({ aws: {}, safeStorage: {} } as ElectronAPI, browser()));
  await openApiDocumentation('/_search', 'POST');
  expect(popup).toHaveBeenLastCalledWith('https://opensearch.org/docs/latest/api-reference/search/', '_blank', 'noopener,noreferrer');
});

it('rejects non-web links before invoking the native shell', async () => {
  await expect(openExternal('file:///tmp/example')).rejects.toThrow('Only HTTP and HTTPS');
  await expect(openExternal('javascript:alert(1)')).rejects.toThrow('Only HTTP and HTTPS');
  expect(invoke).not.toHaveBeenCalled();
});
