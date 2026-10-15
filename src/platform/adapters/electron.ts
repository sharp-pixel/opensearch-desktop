// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { ElectronAPI, PlatformAdapter } from '../contracts';
import { invokeCancelable } from '../cancellation';
import { isLocalHttps, createResponseFromResult } from './http';

export function createElectronAdapter(api: ElectronAPI, browser: PlatformAdapter): PlatformAdapter {
  return {
    kind: 'electron',
    // Electron's navigation handler forwards new windows to the system browser.
    openExternal: url => browser.openExternal(url),
    menu: api.menu,
    files: api.files,
    onCloseRequested: api.onCloseRequested,
    native: { aws: api.aws, safeStorage: { ...api.safeStorage, delete: async () => {} } },
    async fetch(url, options) {
      if (!isLocalHttps(url)) return browser.fetch(url, options);
      const requestId = crypto.randomUUID();
      const proxyOptions = { ...options, headers: Object.fromEntries(new Headers(options?.headers)), requestId };
      delete proxyOptions.signal;
      const result = await invokeCancelable(() => api.fetch(url, proxyOptions),
        () => api.cancelRequest?.(requestId) ?? Promise.resolve(), options?.signal);
      return createResponseFromResult(result, options?.method);
    },
    async grpc(request, signal) {
      if (!api.grpc) return browser.grpc(request, signal);
      const requestId = crypto.randomUUID();
      return invokeCancelable(() => api.grpc!.execute({ ...request, requestId }),
        () => api.cancelRequest?.(requestId) ?? Promise.resolve(), signal);
    },
  };
}
