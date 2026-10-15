// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
import { createCloseRequest } from '../../app/closeRequest';
import { createTauriAdapter } from '../../platform/adapters/tauri';
import { createBrowserAdapter } from '../../platform/adapters/browser';
import type { TauriInternals, TauriWindowAPI } from '../../platform/contracts';
const require = createRequire(import.meta.url);
const { createWindowCloseGuard } = require('../../../electron/windowClose.cjs');
afterEach(() => vi.useRealTimers());

it('awaits saving once for repeated close requests and keeps failures open for retry', async () => {
  let resolve!: (value: boolean) => void;
  const write = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
  const report = vi.fn(); const guard = createCloseRequest(write, report);
  const first = guard.request(); expect(guard.request()).toBe(first);
  await Promise.resolve(); expect(write).toHaveBeenCalledOnce();
  resolve(false); expect(await first).toBe(false);
  expect(report).toHaveBeenLastCalledWith(false, expect.stringContaining('stayed open'));
  const retry = guard.request(); await Promise.resolve(); resolve(true);
  expect(await retry).toBe(true); guard.dispose();
});

it('does not close on a stalled write or after provider teardown', async () => {
  vi.useFakeTimers();
  let resolve!: (value: boolean) => void;
  const report = vi.fn(); const guard = createCloseRequest(() => new Promise<boolean>(done => { resolve = done; }), report, 100);
  const closing = guard.request(); await vi.advanceTimersByTimeAsync(100);
  expect(await closing).toBe(false); resolve(true);
  const retry = guard.request(); await Promise.resolve(); guard.dispose(); resolve(true);
  expect(await retry).toBe(false);
});

it('Tauri awaits the renderer and prevents closing after a failed save', async () => {
  let close!: (event: { preventDefault(): void }) => Promise<void>;
  const unlisten = vi.fn(); const windows: TauriWindowAPI = { getCurrentWindow: () => ({ onCloseRequested: async handler => { close = handler; return unlisten; } }) };
  const adapter = createTauriAdapter({ invoke: vi.fn() } as TauriInternals, createBrowserAdapter(vi.fn(), false), windows);
  let resolve!: (saved: boolean) => void;
  const remove = await adapter.onCloseRequested!(() => new Promise<boolean>(done => { resolve = done; }));
  const event = { preventDefault: vi.fn() }; const closing = close(event);
  expect(event.preventDefault).not.toHaveBeenCalled(); resolve(false); await closing;
  expect(event.preventDefault).toHaveBeenCalledOnce(); remove(); expect(unlisten).toHaveBeenCalledOnce();
});

it('Electron accepts only the current close reply and ignores stale watcher cleanup', () => {
  let close!: (event: { preventDefault(): void }) => void;
  const send = vi.fn(); const destroy = vi.fn();
  const guard = createWindowCloseGuard({ on: (_event: string, fn: typeof close) => { close = fn; }, webContents: { send }, destroy });
  guard.watch('old', true); guard.watch('current', true); guard.watch('old', false);
  const event = { preventDefault: vi.fn() }; close(event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(send.mock.calls[0]?.[1]).toBe('current');
  const id = send.mock.calls[0]?.[2];
  guard.complete('stale', true); expect(destroy).not.toHaveBeenCalled();
  guard.complete(id, false); expect(destroy).not.toHaveBeenCalled();
  close(event); const next = send.mock.calls[1]?.[2];
  guard.complete(id, true); expect(destroy).not.toHaveBeenCalled();
  guard.complete(next, true); expect(destroy).toHaveBeenCalledOnce();
});
