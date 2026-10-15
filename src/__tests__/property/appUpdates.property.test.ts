// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AUTOMATIC_UPDATES_KEY, createUpdateStore } from '../../updates/store';
import { registerUpdateRestartGuard, prepareUpdateRestart, cancelUpdateRestart } from '../../updates/restartGuard';
import { createTauriAdapter } from '../../platform/adapters/tauri';
import { createBrowserAdapter } from '../../platform/adapters/browser';
import type { AppUpdateStatus } from '../../updates/contracts';

function fixture() {
  let native: AppUpdateStatus = { info: { version: '0.0.1', supported: true, configured: true, reason: null }, phase: 'idle', release: null, downloadedBytes: 0, totalBytes: null };
  const access = {
    status: vi.fn(async (): Promise<AppUpdateStatus> => native),
    check: vi.fn(async (): Promise<AppUpdateStatus> => native = { ...native, phase: 'available', release: { version: '0.0.2', notes: 'Release notes' } }),
    download: vi.fn(async (): Promise<AppUpdateStatus> => native = { ...native, phase: 'downloaded', downloadedBytes: 100, totalBytes: 100 }),
    install: vi.fn(async (): Promise<AppUpdateStatus> => native = { ...native, phase: 'installed' }),
    restart: vi.fn(async () => {}),
  };
  const save = vi.fn(async () => true); const cancel = vi.fn();
  return { access, save, cancel, store: createUpdateStore(access, save, cancel), setNative: (value: Partial<AppUpdateStatus>) => { native = { ...native, ...value }; } };
}
beforeEach(() => localStorage.clear());
afterEach(() => { localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('checks once across repeated view mounts, downloads separately, and saves before installing or restarting', async () => {
  const { store, access, save } = fixture();
  await Promise.all([store.initialize(), store.initialize()]);
  expect(access.check).toHaveBeenCalledOnce(); expect(store.getSnapshot().native?.phase).toBe('available');
  expect(access.download).not.toHaveBeenCalled();
  await store.download(); expect(store.getSnapshot().native?.phase).toBe('downloaded');
  expect(access.install).not.toHaveBeenCalled();
  await store.restart();
  expect(save.mock.invocationCallOrder[0]).toBeLessThan(access.install.mock.invocationCallOrder[0]!);
  expect(access.install.mock.invocationCallOrder[0]).toBeLessThan(access.restart.mock.invocationCallOrder[0]!);
  expect(store.getSnapshot().native?.phase).toBe('installed');
});
it('does not install or restart when recovery saving fails', async () => {
  const { store, access, save, cancel } = fixture();
  await store.initialize(); await store.download(); save.mockResolvedValue(false);
  await store.restart();
  expect(access.install).not.toHaveBeenCalled(); expect(access.restart).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce(); expect(store.getSnapshot().restarting).toBe(false);
  expect(store.getSnapshot().error).toContain('could not be saved');
  expect(store.getSnapshot().native?.phase).toBe('downloaded');
});
it('releases the save overlay on installation failure and keeps the verified update available for retry', async () => {
  const { store, access, cancel } = fixture();
  await store.initialize(); await store.download(); access.install.mockRejectedValueOnce(new Error('Permission denied'));
  await store.restart();
  expect(access.restart).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledOnce();
  expect(store.getSnapshot().error).toBe('Permission denied');
  await store.restart(); expect(access.restart).toHaveBeenCalledOnce(); expect(store.getSnapshot().error).toBeNull();
});
it('retries restarting an installed update without installing it again', async () => {
  const { store, access } = fixture();
  await store.initialize(); await store.download(); access.restart.mockRejectedValueOnce(new Error('Restart failed'));
  await store.restart(); expect(store.getSnapshot().native?.phase).toBe('installed');
  await store.restart(); expect(access.install).toHaveBeenCalledOnce(); expect(access.restart).toHaveBeenCalledTimes(2);
});
it('shows up-to-date state and supports manual checks when automatic checks are disabled', async () => {
  localStorage.setItem(AUTOMATIC_UPDATES_KEY, 'false');
  const { store, access } = fixture();
  await store.initialize(); expect(access.check).not.toHaveBeenCalled();
  access.check.mockImplementation(access.status);
  await store.check(); expect(store.getSnapshot().checked).toBe(true); expect(store.getSnapshot().native?.release).toBeNull();
  store.setAutomaticChecks(true); expect(localStorage.getItem(AUTOMATIC_UPDATES_KEY)).toBe('true');
});
it('does not contact a release server for an unsupported or unconfigured build', async () => {
  for (const disabled of [{ supported: false, configured: true }, { supported: true, configured: false }]) {
    const { store, access, setNative } = fixture();
    setNative({ info: { ...disabled, version: '0.0.1', reason: 'Unavailable' } });
    await store.initialize(); await store.check(); await store.download(); await store.restart();
    expect(access.check).not.toHaveBeenCalled(); expect(access.download).not.toHaveBeenCalled(); expect(access.restart).not.toHaveBeenCalled();
  }
});
it('allows initialization to be retried after the native host is temporarily unavailable', async () => {
  const { store, access } = fixture();
  access.status.mockRejectedValueOnce(new Error('Host unavailable')).mockRejectedValueOnce(new Error('Host unavailable'));
  await store.initialize();
  expect(store.getSnapshot().native).toBeNull(); expect(store.getSnapshot().error).toBe('Host unavailable');
  await store.initialize();
  expect(store.getSnapshot().native?.phase).toBe('available'); expect(store.getSnapshot().error).toBeNull();
  expect(access.check).toHaveBeenCalledOnce();
});
it('serializes repeated requests and polls progress without applying stale replies after completion', async () => {
  vi.useFakeTimers();
  const { store, access } = fixture(); await store.initialize();
  let complete!: (value: AppUpdateStatus) => void;
  access.download.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const download = store.download(); await Promise.resolve(); await store.download();
  const count = access.status.mock.calls.length;
  await vi.advanceTimersByTimeAsync(300); expect(access.status.mock.calls.length).toBeGreaterThan(count);
  complete({ ...store.getSnapshot().native!, phase: 'downloaded' }); await download;
  const final = access.status.mock.calls.length; await vi.advanceTimersByTimeAsync(1000);
  expect(access.download).toHaveBeenCalledOnce(); expect(access.status).toHaveBeenCalledTimes(final);
  expect(store.getSnapshot().busy).toBe(false); expect(store.getSnapshot().native?.phase).toBe('downloaded');
});
it('uses the lifecycle guard and removes it safely when the lifecycle unmounts', async () => {
  const save = vi.fn(async () => true); const cancel = vi.fn();
  const unregister = registerUpdateRestartGuard(save, cancel);
  expect(await prepareUpdateRestart()).toBe(true); cancelUpdateRestart(); expect(cancel).toHaveBeenCalledOnce();
  unregister(); expect(await prepareUpdateRestart()).toBe(false);
});
it('keeps updater IPC inside the Tauri platform adapter', async () => {
  const invoke = vi.fn().mockResolvedValue({});
  const adapter = createTauriAdapter({ invoke }, createBrowserAdapter(vi.fn(), false));
  await adapter.updates!.status(); await adapter.updates!.check(); await adapter.updates!.download(); await adapter.updates!.install(); await adapter.updates!.restart();
  expect(invoke.mock.calls.map(call => call[0])).toEqual(['updater_status', 'updater_check', 'updater_download', 'updater_install', 'updater_restart']);
});
