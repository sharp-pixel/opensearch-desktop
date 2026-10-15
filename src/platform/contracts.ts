// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { AppUpdateAccess } from '../updates/contracts';
import type { GrpcTransportRequest, GrpcTransportResponse } from '../types/grpc';
import type { AwsProfile, AwsProfileCredentials } from '../types/connection';

export interface DocumentFile {
  path: string | null;
  name: string;
  content: string;
  revision: string;
}
export interface SaveDocumentRequest {
  title?: string;
  path?: string;
  suggestedName: string;
  content: string;
  expectedRevision?: string;
}
export interface OpenDocumentOptions { title?: string }
export interface DocumentFileBinding { path: string | null; name: string; revision: string; dirty: boolean }
export interface DocumentFileAccess {
  open(options?: OpenDocumentOptions): Promise<DocumentFile | null>;
  read(path: string): Promise<DocumentFile>;
  save(request: SaveDocumentRequest): Promise<DocumentFile | null>;
}

export interface ElectronAPI {
  menu?: NativeMenuAccess;
  files?: DocumentFileAccess;
  onCloseRequested?: (handler: () => Promise<boolean>) => Promise<() => void>;
  cancelRequest?: (requestId: string) => Promise<void>;
  grpc?: { execute: (request: GrpcTransportRequest & { requestId?: string }) => Promise<GrpcTransportResponse> };
  platform: string;
  isElectron: boolean;
  aws: {
    getProfiles: () => Promise<AwsProfile[]>;
    getProfileCredentials: (profileName: string) => Promise<AwsProfileCredentials | null>;
    refreshProfiles: () => Promise<AwsProfile[]>;
  };
  safeStorage: {
    isAvailable: () => Promise<boolean>;
    encrypt: (plaintext: string) => Promise<string | null>;
    decrypt: (encryptedBase64: string) => Promise<string | null>;
  };
  fetch: (url: string, options?: RequestInit & { requestId?: string }) => Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    body: unknown;
    headers?: Record<string, string>;
    error?: string;
  }>;
}

/**
 * Tauri API - uses @tauri-apps/api invoke
 */
export interface TauriInternals {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}
export interface TauriWindowAPI {
  getCurrentWindow(): {
    onCloseRequested(handler: (event: { preventDefault(): void }) => Promise<void>): Promise<() => void>;
  };
}

export type NativeMenuAction = 'new' | 'open' | 'recent' | 'save' | 'save-as' | 'preferences';
export interface NativeMenuState {
  labels: Record<string, string>;
  enabled: Partial<Record<NativeMenuAction, boolean>>;
}
export interface NativeMenuAccess {
  listen(handler: (action: NativeMenuAction) => void): Promise<() => void>;
  update(state: NativeMenuState): Promise<void>;
}
export interface TauriEventAPI {
  listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<() => void>;
}

export type HostKind = 'browser' | 'electron' | 'tauri';
export interface NativeCapabilities {
  aws: ElectronAPI['aws'];
  safeStorage: Omit<ElectronAPI['safeStorage'], 'encrypt'> & {
    encrypt(plaintext: string, reference?: string): Promise<string | null>;
    delete(reference: string): Promise<void>;
  };
}
export interface PlatformAdapter {
  menu?: NativeMenuAccess;
  updates?: AppUpdateAccess;
  files?: DocumentFileAccess;
  kind: HostKind;
  native: NativeCapabilities;
  openExternal(url: string): Promise<void>;
  fetch(url: string, options?: RequestInit): Promise<Response>;
  grpc(request: GrpcTransportRequest, signal?: AbortSignal): Promise<GrpcTransportResponse>;
  onCloseRequested?(handler: () => Promise<boolean>): Promise<() => void>;
}
export type BrowserFetch = (url: string, options?: RequestInit) => Promise<Response>;
