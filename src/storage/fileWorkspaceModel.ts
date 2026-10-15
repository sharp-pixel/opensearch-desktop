// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { DocumentFileBinding } from '../platform/contracts';
export interface FileDraft<T> { id: string; name: string; content: T; updatedAt: number; file?: DocumentFileBinding }
export interface FileWorkspaceModel<T> { version: 1; activeId: string | null; documents: FileDraft<T>[] }
export function isFileBinding(value: unknown): value is DocumentFileBinding {
  if (!value || typeof value !== 'object') return false;
  const file = value as Record<string, unknown>;
  return (file.path === null || typeof file.path === 'string') && typeof file.name === 'string'
    && typeof file.revision === 'string' && typeof file.dirty === 'boolean';
}
export function isFileWorkspace<T>(value: unknown, valid: (content: unknown) => content is T): value is FileWorkspaceModel<T> {
  if (!value || typeof value !== 'object') return false;
  const model = value as FileWorkspaceModel<T>;
  return model.version === 1 && (model.activeId === null || typeof model.activeId === 'string') && Array.isArray(model.documents)
    && model.documents.every(item => item && typeof item.id === 'string' && typeof item.name === 'string'
      && Number.isFinite(item.updatedAt) && valid(item.content) && (item.file === undefined || isFileBinding(item.file)))
    && new Set(model.documents.map(item => item.id)).size === model.documents.length
    && (model.activeId === null ? model.documents.length === 0 : model.documents.some(item => item.id === model.activeId));
}
