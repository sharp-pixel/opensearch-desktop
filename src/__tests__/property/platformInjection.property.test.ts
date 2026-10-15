// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, expect, it, vi } from 'vitest';
import { createBrowserAdapter } from '../../platform/adapters/browser';

afterEach(() => { delete window.__TAURI_INTERNALS__; vi.resetModules(); });
it('keeps the bootstrap adapter fixed and allows explicit dependency injection', async () => {
  const runtime = await import('../../platform/runtime');
  const fetch = vi.fn().mockResolvedValue(new Response('test'));
  runtime.initializePlatform(createBrowserAdapter(fetch, false));
  // Late changes to globals cannot redirect an already initialized application's requests.
  window.__TAURI_INTERNALS__ = { invoke: vi.fn() };
  expect(runtime.isDesktopApp()).toBe(false);
  await runtime.secureFetch('https://localhost:9200');
  expect(fetch).toHaveBeenCalledWith('https://localhost:9200', undefined);
  expect(window.__TAURI_INTERNALS__.invoke).not.toHaveBeenCalled();
  await expect(runtime.executeGrpcTransport({} as never)).rejects.toThrow('Native gRPC requires');
});
