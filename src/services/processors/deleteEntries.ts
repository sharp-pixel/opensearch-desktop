// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Delete Entries Processor Implementation
 */

import type { DeleteEntriesConfig, DeleteEntry } from '../../types/dataPrepper';
import { deepClone, getNestedValue, setNestedValue, deleteNestedValue, evaluateCondition, matchesWholeKey } from './utils';
import { inheritEventMetadata, detachEventMetadata } from './eventMetadata';

function deleteKeys(event: Record<string, unknown>, entry: DeleteEntry): Record<string, unknown> {
  let result = deepClone(event);
  for (const key of entry.with_keys ?? []) result = deleteNestedValue(result, key);
  const patterns = (entry.with_keys_regex ?? []).map(pattern => new RegExp(pattern));
  const excluded = new Set(entry.exclude_from_delete ?? []);
  for (const key of Object.keys(result)) {
    if (!excluded.has(key) && patterns.some(pattern => matchesWholeKey(pattern, key))) {
      result = deleteNestedValue(result, key);
    }
  }
  return result;
}

/**
 * Apply delete_entries processor to an event
 */
export function applyDeleteEntries(
  event: Record<string, unknown>,
  config: DeleteEntriesConfig
): Record<string, unknown> {
  let result = deepClone(event);
  const entries = config.entries ?? [config];
  for (const entry of entries) {
    if (entry.delete_when && !evaluateCondition(result, entry.delete_when)) continue;
    if (entry.iterate_on === undefined) {
      result = deleteKeys(result, entry);
      continue;
    }
    const items = getNestedValue(result, entry.iterate_on);
    if (!Array.isArray(items)) continue;
    if (items.some(item => item === null || typeof item !== 'object' || Array.isArray(item))) break;
    const updated = items.map(item => {
      const context = inheritEventMetadata(deepClone(item as Record<string, unknown>), result);
      if (entry.delete_from_element_when && !evaluateCondition(context, entry.delete_from_element_when)) return context;
      return deleteKeys(context, entry);
    });
    result = setNestedValue(result, entry.iterate_on, updated.map(detachEventMetadata));
  }

  return result;
}
