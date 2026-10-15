// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'installed';
export interface AppUpdateInfo {
  version: string;
  supported: boolean;
  configured: boolean;
  reason: string | null;
}
export interface AppUpdateRelease { version: string; notes: string | null }
export interface AppUpdateStatus {
  info: AppUpdateInfo;
  phase: UpdatePhase;
  release: AppUpdateRelease | null;
  downloadedBytes: number;
  totalBytes: number | null;
}
export interface AppUpdateAccess {
  status(): Promise<AppUpdateStatus>;
  check(): Promise<AppUpdateStatus>;
  download(): Promise<AppUpdateStatus>;
  install(): Promise<AppUpdateStatus>;
  restart(): Promise<void>;
}
