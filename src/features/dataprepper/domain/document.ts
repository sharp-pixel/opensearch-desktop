// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { SourceFormat } from '../../../types/dataPrepper';

export interface PipelineDocument { sourceData: string; sourceFormat: SourceFormat; pipelineConfig: string }

export function isPipelineDocument(value: unknown): value is PipelineDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Record<string, unknown>;
  return typeof document.sourceData === 'string' && typeof document.pipelineConfig === 'string'
    && (document.sourceFormat === 'json' || document.sourceFormat === 'jsonl' || document.sourceFormat === 'csv');
}

/** Validate the whole candidate before publishing any imported field. Legacy partial exports remain usable. */
export function importPipelineDocument(json: string, current: PipelineDocument): PipelineDocument {
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid pipeline document');
  const fields = ['sourceData', 'sourceFormat', 'pipelineConfig'] as const;
  if (!fields.some(key => Object.prototype.hasOwnProperty.call(value, key))) throw new Error('No pipeline fields found');
  const candidate = { ...current };
  for (const key of fields) if (Object.prototype.hasOwnProperty.call(value, key)) Object.assign(candidate, { [key]: (value as Record<string, unknown>)[key] });
  if (!isPipelineDocument(candidate)) throw new Error('Invalid pipeline fields');
  return candidate;
}
