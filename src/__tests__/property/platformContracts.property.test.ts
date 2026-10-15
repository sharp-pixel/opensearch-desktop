// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
import { secureFetch } from '../../platform/runtime';
import { getAwsProfiles, isAwsProfileSupportAvailable } from '../../utils/awsProfiles';
import { requestScope } from '../../platform/cancellation';
const require = createRequire(import.meta.url);
const { createHttpProxy } = require('../../../electron/http.cjs');
const { cancelRequest } = require('../../../shared/node/requests.cjs');
afterEach(() => { delete window.electronAPI; delete window.__TAURI_INTERNALS__; vi.useRealTimers(); });

it('forwards cancellation through Electron IPC and rejects without waiting for a native reply', async () => {
  const cancel = vi.fn().mockResolvedValue(undefined);
  const fetch = vi.fn(() => new Promise(() => {}));
  window.electronAPI = { isElectron: true, fetch, cancelRequest: cancel } as any;
  const controller = new AbortController();
  const pending = secureFetch('https://localhost:9200', { signal: controller.signal });
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await rejected;
  expect(cancel).toHaveBeenCalledWith((fetch.mock.calls as any)[0][1].requestId);
  expect((fetch.mock.calls as any)[0][1]).not.toHaveProperty('signal');
});

it('Tauri cancellation and AWS profiles use the same host boundary', async () => {
  const profiles = [{ name: 'default', hasCredentials: true, region: 'eu-west-1' }];
  const invoke = vi.fn((command: string) => command === 'fetch_proxy' ? new Promise(() => {}) : Promise.resolve(command === 'get_aws_profiles' ? profiles : undefined));
  window.__TAURI_INTERNALS__ = { invoke: invoke as any };
  expect(isAwsProfileSupportAvailable()).toBe(true);
  expect(await getAwsProfiles()).toEqual(profiles);
  const controller = new AbortController();
  const pending = secureFetch('https://localhost:9200', { signal: controller.signal });
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await rejected;
  expect(invoke).toHaveBeenCalledWith('cancel_request', { requestId: expect.any(String) });
});

it('native HTTP cancellation aborts transport and releases its registration', async () => {
  const fetch = vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const proxy = createHttpProxy(fetch);
  const result = proxy('https://localhost:9200', { requestId: 'native-cancel' });
  cancelRequest('native-cancel');
  expect(await result).toMatchObject({ status: 0, error: 'Aborted' });
  const success = createHttpProxy(async () => new Response('ok'));
  expect(await success('https://localhost:9200', { requestId: 'native-cancel' })).toMatchObject({ status: 200, body: 'ok' });
});

it('deadlines release timers and parent listeners on disposal', () => {
  vi.useFakeTimers();
  const parent = new AbortController();
  const remove = vi.spyOn(parent.signal, 'removeEventListener');
  const scope = requestScope(10, parent.signal);
  vi.advanceTimersByTime(10);
  expect(scope.signal.aborted).toBe(true);
  scope.dispose();
  expect(vi.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalled();
});
