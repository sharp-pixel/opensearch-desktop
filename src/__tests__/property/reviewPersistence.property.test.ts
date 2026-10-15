// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, expect, it, vi } from 'vitest';
import { saveConnectionAsync, loadConnectionsAsync, deleteConnectionAsync, STORAGE_KEYS } from '../../services/persistence';
import { executeFederated } from '../../services/federatedExecutor';

const connection = { id: 'a', name: 'A', endpoint: 'https://cluster.example', authType: 'basic' as const, credentials: { username: 'user', password: 'secret' } };
afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('R16 migrates all legacy credentials exactly once without recursive reads', async () => {
  const legacy = [connection, { ...connection, id: 'b', name: 'B' }];
  localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(legacy));
  const result = await loadConnectionsAsync();
  expect(result.filter(c => c.id !== 'local-docker')).toEqual(expect.arrayContaining(legacy));
  expect(localStorage.getItem(STORAGE_KEYS.CONNECTIONS)).toBeNull();
  expect(localStorage.getItem(STORAGE_KEYS.CONNECTIONS_ENCRYPTED)).not.toContain('secret');
  expect(await loadConnectionsAsync()).toEqual(result);
});

it('R19 keeps legacy connections usable when migration fails and allows retry', async () => {
  const legacy = JSON.stringify([connection]);
  localStorage.setItem(STORAGE_KEYS.CONNECTIONS, legacy);
  const storage = localStorage;
  vi.stubGlobal('localStorage', {
    getItem: storage.getItem.bind(storage),
    removeItem: storage.removeItem.bind(storage),
    setItem: (key: string, value: string) => {
      if (key === STORAGE_KEYS.CONNECTIONS_ENCRYPTED) throw new DOMException('Full', 'QuotaExceededError');
      storage.setItem(key, value);
    },
    clear: storage.clear.bind(storage),
  });
  expect(await loadConnectionsAsync()).toEqual(expect.arrayContaining([connection]));
  await expect(saveConnectionAsync({ ...connection, id: 'new' })).rejects.toThrow('Full');
  expect(localStorage.getItem(STORAGE_KEYS.CONNECTIONS)).toBe(legacy);
  vi.unstubAllGlobals();
  expect(await loadConnectionsAsync()).toEqual(expect.arrayContaining([connection]));
});

it('R17 serializes concurrent save, save and delete transactions', async () => {
  await saveConnectionAsync(connection);
  await Promise.all([
    saveConnectionAsync({ ...connection, id: 'b' }),
    saveConnectionAsync({ ...connection, id: 'c' }),
    deleteConnectionAsync('a'),
  ]);
  const result = await loadConnectionsAsync();
  expect(result.some(c => c.id === 'a')).toBe(false);
  expect(result.filter(c => ['b', 'c'].includes(c.id))).toHaveLength(2);
});

it('R18 aborts timed-out browser requests and releases all deadline timers', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  vi.stubGlobal('fetch', vi.fn((_: string, options: RequestInit) => new Promise((_, reject) => {
    signal = options.signal!;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })));
  const pending = executeFederated('source=logs', { id: 'g', name: 'G', connectionIds: ['a'] }, [connection], { timeout: 25 });
  await vi.advanceTimersByTimeAsync(25);
  const result = await pending;
  expect(signal?.aborted).toBe(true);
  expect(result.failedClusters).toBe(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('R18 releases timeout timers immediately after a successful request', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"schema":[],"datarows":[]}')));
  const result = await executeFederated('source=logs', { id: 'g', name: 'G', connectionIds: ['a'] }, [connection], { timeout: 10000 });
  expect(result.success).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
