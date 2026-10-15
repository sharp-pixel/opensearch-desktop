// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { AppUpdateAccess } from '../updates/contracts';
import { t } from '../i18n';
import type { ElectronAPI, TauriInternals, TauriWindowAPI, TauriEventAPI, PlatformAdapter, NativeCapabilities } from './contracts';
import type { GrpcTransportRequest, GrpcTransportResponse } from '../types/grpc';
import { createBrowserAdapter } from './adapters/browser';
import { createElectronAdapter } from './adapters/electron';
import { createTauriAdapter } from './adapters/tauri';
import { browserDocumentFiles } from './browserDocumentFiles';
import type { DocumentFileAccess } from './contracts';

declare global {
  interface Window { electronAPI?: ElectronAPI; __TAURI_INTERNALS__?: TauriInternals; __TAURI__?: { window: TauriWindowAPI; event?: TauriEventAPI } }
}
let configured: PlatformAdapter | undefined;

/** Bootstrap selects one host; tests and standalone consumers may inject a complete adapter. */
export function initializePlatform(adapter = detectPlatform()): void { configured = adapter; }
function detectPlatform(): PlatformAdapter {
  const browser = createBrowserAdapter((url, options) => fetch(url, options), import.meta.env.DEV);
  if (typeof window === 'undefined') return browser;
  if (window.electronAPI?.isElectron) return createElectronAdapter(window.electronAPI, browser);
  if (window.__TAURI_INTERNALS__) return createTauriAdapter(window.__TAURI_INTERNALS__, browser, window.__TAURI__?.window, window.__TAURI__?.event);
  return browser;
}
function platform() { return configured ?? detectPlatform(); }
export function getNativeMenu() { return platform().menu; }
export async function openExternal(url: string): Promise<void> {
  if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error('Only HTTP and HTTPS links can be opened.');
  await platform().openExternal(url);
}
export const documentFiles: DocumentFileAccess = {
  open: options => trackFileOperation(() => fileAccess().open({ ...options, title: t(options?.title ?? 'Open notebook') })),
  read: path => trackFileOperation(() => fileAccess().read(path)),
  save: request => trackFileOperation(() => fileAccess().save({ ...request, title: t(request.title ?? 'Save notebook as') })),
};
let pendingFileOperations = 0;
export function hasPendingDocumentFileOperations() { return pendingFileOperations > 0; }
async function trackFileOperation<T>(operation: () => Promise<T>): Promise<T> {
  pendingFileOperations++;
  try { return await operation(); } finally { pendingFileOperations--; }
}
function fileAccess(): DocumentFileAccess {
  const adapter = platform();
  if (adapter.files) return adapter.files;
  if (adapter.kind === 'browser') return browserDocumentFiles;
  throw new Error('File dialogs are unavailable. Restart with the latest desktop build.');
}
export function isElectron(): boolean { return platform().kind === 'electron'; }
export function isTauri(): boolean { return platform().kind === 'tauri'; }
export function isDesktopApp(): boolean { return platform().kind !== 'browser'; }
export function isMacOS(): boolean { return typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac'); }
export function needsTrafficLightPadding(): boolean { return isDesktopApp() && isMacOS(); }
export function getElectronAPI(): ElectronAPI | undefined { return typeof window === 'undefined' ? undefined : window.electronAPI; }

/** Compatibility facade; host-specific commands live only in the adapter modules. */
export const nativeAPI: NativeCapabilities = {
  aws: {
    getProfiles: () => platform().native.aws.getProfiles(),
    getProfileCredentials: name => platform().native.aws.getProfileCredentials(name),
    refreshProfiles: () => platform().native.aws.refreshProfiles(),
  },
  safeStorage: {
    isAvailable: () => platform().native.safeStorage.isAvailable(),
    encrypt: (value, reference) => platform().native.safeStorage.encrypt(value, reference),
    decrypt: value => platform().native.safeStorage.decrypt(value),
    delete: reference => platform().native.safeStorage.delete(reference),
  },

};
export function secureFetch(url: string, options?: RequestInit): Promise<Response> { return platform().fetch(url, options); }
export function onDesktopCloseRequested(handler: () => Promise<boolean>): Promise<() => void> {
  const adapter = platform();
  if (adapter.kind === 'browser') return Promise.resolve(() => {});
  if (!adapter.onCloseRequested) return Promise.reject(new Error('Desktop close protection is unavailable'));
  return adapter.onCloseRequested(handler);
}
export async function executeGrpcTransport(request: GrpcTransportRequest, signal?: AbortSignal): Promise<GrpcTransportResponse> {
  const response = await platform().grpc(request, signal);
  if (!response || !Number.isInteger(response.code) || response.code < 0 || response.code > 16 ||
      (response.payload != null && typeof response.payload !== 'string') ||
      (response.error != null && typeof response.error !== 'string')) throw new Error('Invalid gRPC transport response');
  return response;
}

/** Updates are a host capability: web and Electron builds cannot replace Tauri bundles. */
export const appUpdates: AppUpdateAccess = {
  status: async () => platform().updates?.status() ?? {
    info: { version: '', supported: false, configured: false, reason: 'In-app updates are available in the Tauri AppImage and macOS app.' },
    phase: 'idle', release: null, downloadedBytes: 0, totalBytes: null,
  },
  check: () => updateAccess().check(),
  download: () => updateAccess().download(),
  install: () => updateAccess().install(),
  restart: () => updateAccess().restart(),
};
function updateAccess(): AppUpdateAccess {
  const updates = platform().updates;
  if (!updates) throw new Error('In-app updates are available in the Tauri AppImage and macOS app.');
  return updates;
}
