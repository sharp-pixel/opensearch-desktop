// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

export interface RecentNotebookFile { path: string; name: string; openedAt: number }
const KEY = 'workbench:recent-notebook-files';
export function loadRecentNotebookFiles(): RecentNotebookFile[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is RecentNotebookFile => !!item && typeof item === 'object'
      && typeof item.path === 'string' && !!item.path && typeof item.name === 'string'
      && typeof item.openedAt === 'number' && Number.isFinite(item.openedAt)).sort((a, b) => b.openedAt - a.openedAt).slice(0, 30);
  } catch { return []; }
}
export function saveRecentNotebookFiles(files: RecentNotebookFile[]) { localStorage.setItem(KEY, JSON.stringify(files)); }
export function rememberNotebookFile(files: RecentNotebookFile[], file: { path: string; name: string }, now = Date.now()): RecentNotebookFile[] {
  return [{ ...file, openedAt: now }, ...files.filter(item => item.path !== file.path)].slice(0, 30);
}
