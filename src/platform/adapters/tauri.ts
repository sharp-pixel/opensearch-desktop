// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { PlatformAdapter, TauriInternals, NativeCapabilities, TauriWindowAPI, TauriEventAPI, NativeMenuAction } from '../contracts';
import type { GrpcTransportResponse } from '../../types/grpc';
import { invokeCancelable } from '../cancellation';
import { isLocalHttps, createResponseFromResult } from './http';

export function createTauriAdapter(api: TauriInternals, browser: PlatformAdapter, windows?: TauriWindowAPI, events?: TauriEventAPI): PlatformAdapter {
  const invoke: TauriInternals['invoke'] = (command, args) => api.invoke(command, args);
  const native: NativeCapabilities = {
    aws: {
      getProfiles: () => invoke('get_aws_profiles'), getProfileCredentials: profileName => invoke('get_aws_profile_credentials', { profileName }),
      refreshProfiles: () => invoke('refresh_aws_profiles'),
    },
    safeStorage: {
      isAvailable: () => invoke('safe_storage_is_available'),
      encrypt: (plaintext, reference) => invoke('safe_storage_encrypt', { plaintext, reference }),
      decrypt: encryptedBase64 => invoke('safe_storage_decrypt', { encryptedBase64 }), delete: reference => invoke('safe_storage_delete', { reference }),
    },
  };
  return {
    kind: 'tauri', native,
    openExternal: url => invoke('plugin:shell|open', { path: url }),
    menu: events ? {
      listen: handler => events.listen<NativeMenuAction>('workbench-menu', event => handler(event.payload)),
      update: state => invoke('update_menu', { state }),
    } : undefined,
    updates: {
      status: () => invoke('updater_status'),
      check: () => invoke('updater_check'),
      download: () => invoke('updater_download'),
      install: () => invoke('updater_install'),
      restart: () => invoke('updater_restart'),
    },
    files: {
      open: options => invoke('document_open', options ? { options } : undefined),
      read: path => invoke('document_read', { path }),
      save: request => invoke('document_save', { request }),
    },
    async onCloseRequested(handler) {
      if (!windows) throw new Error('Desktop close protection is unavailable');
      return windows.getCurrentWindow().onCloseRequested(async event => {
        try { if (!await handler()) event.preventDefault(); }
        catch { event.preventDefault(); }
      });
    },
    async fetch(url, options) {
      if (!isLocalHttps(url)) return browser.fetch(url, options);
      const requestId = crypto.randomUUID();
      const result = await invokeCancelable(() => invoke<{
        status: number; status_text: string; body: unknown; headers?: Record<string, string>; error?: string;
      }>('fetch_proxy', { url, options: { method: options?.method, headers: Object.fromEntries(new Headers(options?.headers)), body: options?.body, requestId } }),
      () => invoke('cancel_request', { requestId }), options?.signal);
      return createResponseFromResult({ ...result, statusText: result.status_text }, options?.method);
    },
    grpc(request, signal) {
      const requestId = crypto.randomUUID();
      return invokeCancelable(() => invoke<GrpcTransportResponse>('grpc_execute', { request: { ...request, requestId } }),
        () => invoke('cancel_request', { requestId }), signal);
    },
  };
}
