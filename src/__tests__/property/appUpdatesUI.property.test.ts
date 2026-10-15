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
import { AppUpdatesPanel } from '../../components/Layout/AppUpdatesPanel';
import { setLanguage, t } from '../../i18n';
import type { UpdateState } from '../../updates/store';

const mocked = vi.hoisted(() => ({ state: null as UpdateState | null,
  check: vi.fn(), download: vi.fn(), restart: vi.fn(), initialize: vi.fn(), setAutomaticChecks: vi.fn() }));
vi.mock('../../updates/useAppUpdates', () => ({ useAppUpdates: () => mocked.state }));
vi.mock('../../updates/store', () => ({ updateStore: mocked }));
let root: Root; let container: HTMLDivElement;
const render = () => act(async () => root.render(React.createElement(ThemeProvider, null, React.createElement(AppUpdatesPanel))));
const button = (label: string) => Array.from(container.querySelectorAll('button')).find(item => item.textContent === t(label))!;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); setLanguage('en');
  mocked.state = { native: { info: { version: '1.0.0', supported: true, configured: true, reason: null }, phase: 'available',
    release: { version: '1.0.1', notes: '<img src=x onerror=alert(1)>\nRelease notes' }, downloadedBytes: 0, totalBytes: null },
    busy: false, restarting: false, automaticChecks: true, error: null, checked: true };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); setLanguage('en'); localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
it('renders release notes as text, routes explicit actions, and prevents actions during downloads', async () => {
  await render();
  expect(container.textContent).toContain('Version 1.0.1 is available.');
  expect(container.textContent).toContain('<img src=x onerror=alert(1)>'); expect(container.querySelector('img')).toBeNull();
  await act(async () => button('Download update').click()); expect(mocked.download).toHaveBeenCalledOnce();
  await act(async () => button('Check for updates').click()); expect(mocked.check).toHaveBeenCalledOnce();
  const checkbox = container.querySelector<HTMLInputElement>('input')!;
  await act(async () => checkbox.click()); expect(mocked.setAutomaticChecks).toHaveBeenCalledWith(false);
  mocked.state = { ...mocked.state!, busy: true, native: { ...mocked.state!.native!, phase: 'downloading', downloadedBytes: 25, totalBytes: 100 } };
  await render();
  expect(container.querySelector('progress')!.value).toBe(25); expect(button('Check for updates').disabled).toBe(true);
  expect(container.querySelectorAll('button')).toHaveLength(1);
});
it('offers installation only after download, supports restart retries, and follows Japanese preferences', async () => {
  mocked.state!.native!.phase = 'downloaded'; await render();
  await act(async () => button('Restart and install').click()); expect(mocked.restart).toHaveBeenCalledOnce();
  expect(container.querySelectorAll('button')).toHaveLength(1);
  mocked.state = { ...mocked.state!, native: { ...mocked.state!.native!, phase: 'installed' }, error: 'Restart failed' };
  await render();
  expect(button('Restart now')).toBeTruthy(); expect(container.querySelector('[role="alert"]')!.textContent).toBe('Restart failed');
  await act(async () => setLanguage('ja'));
  expect(container.querySelector('h3')!.textContent).toBe('アプリの更新'); expect(button('Restart now').textContent).toBe('今すぐ再起動');
});
it('explains unconfigured builds and allows retrying failed settings without a permanent loading message', async () => {
  mocked.state!.native!.info.configured = false; mocked.state!.native!.info.reason = 'Updates are not configured for this build.';
  await render(); expect(container.textContent).toContain('Updates are not configured for this build.'); expect(container.querySelector('button')).toBeNull();
  mocked.state = { ...mocked.state!, native: null, error: 'Host unavailable' }; await render();
  expect(container.textContent).not.toContain('Loading update settings');
  await act(async () => button('Retry update settings').click()); expect(mocked.initialize).toHaveBeenCalledOnce();
});
