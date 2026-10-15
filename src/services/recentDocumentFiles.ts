// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { rememberNotebookFile, type RecentNotebookFile } from './recentNotebookFiles';
export type RecentDocumentFile = RecentNotebookFile;
export function loadRecentDocumentFiles(kind: string): RecentDocumentFile[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`workbench:recent-${kind}-files`) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is RecentDocumentFile => !!item && typeof item === 'object'
      && typeof item.path === 'string' && !!item.path && typeof item.name === 'string'
      && Number.isFinite(item.openedAt)).sort((a, b) => b.openedAt - a.openedAt).slice(0, 30) : [];
  } catch { return []; }
}
export function saveRecentDocumentFiles(kind: string, files: RecentDocumentFile[]) {
  localStorage.setItem(`workbench:recent-${kind}-files`, JSON.stringify(files));
}
export const rememberDocumentFile = rememberNotebookFile;
