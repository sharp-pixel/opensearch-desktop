// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Truncate Processor
 * Truncates string values at the beginning, end, or both sides
 */

import { getNestedValue, setNestedValue, deepClone, evaluateCondition } from './utils';

export interface TruncateEntry {
  /** List of source keys to truncate. If not specified, truncates all string values */
  source_keys?: string[];
  /** Starting index for truncation (default: 0) */
  start_at?: number;
  /** Length of string after truncation */
  length?: number;
  /** Recursively truncate nested map values */
  recursive?: boolean;
  /** Conditional expression for this entry */
  truncate_when?: string;
}

export interface TruncateConfig {
  /** List of truncation entries */
  entries: TruncateEntry[];
  /** Conditional expression */
  when?: string;
}

/**
 * Truncate a string value based on start_at and length
 */
function truncateString(value: string, startAt: number, length?: number): string {
  if (startAt > value.length) throw new RangeError('start_at exceeds string length');
  if (length === undefined || startAt + length >= value.length) {
    return value.substring(startAt);
  }
  return value.substring(startAt, startAt + length);
}

/**
 * Truncate a value (string, array of strings, or recursively a map)
 */
function truncateValue(
  value: unknown,
  startAt: number,
  length: number | undefined,
  recurse: boolean
): unknown {
  if (typeof value === 'string') {
    return truncateString(value, startAt, length);
  }

  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') {
        return truncateString(item, startAt, length);
      }
      return item;
    });
  }

  if (recurse && value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = truncateValue(val, startAt, length, recurse);
    }
    return result;
  }

  return value;
}

/**
 * Apply truncate processor to an event
 */
export function applyTruncate(
  event: Record<string, unknown>,
  config: TruncateConfig
): Record<string, unknown> {
  let result = deepClone(event);

  try {
    for (const entry of config.entries) {
      if (entry.truncate_when && !evaluateCondition(result, entry.truncate_when)) continue;
      const startAt = entry.start_at ?? 0;
      const length = entry.length;
      const recurse = entry.recursive ?? false;

      // Validate config - at least one of start_at or length must be specified
      if (entry.start_at === undefined && entry.length === undefined) {
        continue; // Skip invalid entry
      }

      if (entry.source_keys === undefined) {
        // Truncate all string values in the event
        for (const [key, value] of Object.entries(result)) {
          const truncated = truncateValue(value, startAt, length, recurse);
          result[key] = truncated;
        }
      } else {
        // Truncate specific keys
        for (const sourceKey of entry.source_keys) {
          const value = getNestedValue(result, sourceKey);
          if (value === undefined) {
            continue;
          }

          const truncated = truncateValue(value, startAt, length, recurse);
          result = setNestedValue(result, sourceKey, truncated);
        }
      }
    }
  } catch (error) {
    // Like Data Prepper, retain work already performed and stop this processor.
    if (!(error instanceof RangeError)) throw error;
  }

  return result;
}
