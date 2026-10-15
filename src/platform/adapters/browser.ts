// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { BrowserFetch, PlatformAdapter } from '../contracts';

export function createBrowserAdapter(fetch: BrowserFetch, development: boolean): PlatformAdapter {
  return {
    kind: 'browser', fetch,
    async openExternal(url) { window.open(url, '_blank', 'noopener,noreferrer'); },
    native: {
      aws: { getProfiles: async () => [], getProfileCredentials: async () => null, refreshProfiles: async () => [] },
      safeStorage: { isAvailable: async () => false, encrypt: async () => null, decrypt: async () => null, delete: async () => {} },
    },
    async grpc(request, signal) {
      if (!development) throw new Error('Native gRPC requires the desktop app or the local development server.');
      const response = await fetch('/__grpc', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Workbench-Grpc': '1' },
        body: JSON.stringify({ ...request, requestId: crypto.randomUUID() }), signal,
      });
      if (!response.ok) throw new Error('The local gRPC bridge rejected the request. Check the endpoint and restart the development server.');
      return response.json();
    },
  };
}
