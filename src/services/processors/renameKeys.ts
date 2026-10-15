// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Rename Keys Processor Implementation
 */

import type { RenameKeysConfig } from '../../types/dataPrepper';
import { getNestedValue, setNestedValue, deleteNestedValue, evaluateCondition, deepClone, matchesWholeKey, transformKeyName } from './utils';

/**
 * Apply rename_keys processor to an event
 */
export function applyRenameKeys(
  event: Record<string, unknown>,
  config: RenameKeysConfig
): Record<string, unknown> {
  let result = deepClone(event);

  if (config.transform_key && config.transform_key !== 'none') {
    const transform = (map: Record<string, unknown>, prefix: string) => {
      for (const [key, value] of Object.entries(map)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          transform(value as Record<string, unknown>, `${prefix}${key}/`);
        }
        const path = `${prefix}${key}`;
        const updated = getNestedValue(result, path);
        result = deleteNestedValue(result, path);
        result = setNestedValue(result, `${prefix}${transformKeyName(key, config.transform_key)}`, updated);
      }
    };
    transform(deepClone(result), '');
    return result;
  }

  if (!config.entries || !Array.isArray(config.entries)) {
    return result;
  }

  for (const entry of config.entries) {
    const { from_key, to_key, overwrite_if_to_key_exists = false } = entry;
    if (entry.rename_when && !evaluateCondition(result, entry.rename_when)) continue;

    if (entry.from_key_regex !== undefined) {
      if (getNestedValue(result, to_key) !== undefined && !overwrite_if_to_key_exists) continue;
      const pattern = new RegExp(entry.from_key_regex);
      for (const [key, value] of Object.entries(result)) {
        if (!matchesWholeKey(pattern, key)) continue;
        result = setNestedValue(result, to_key, value);
        result = deleteNestedValue(result, key);
        if (!overwrite_if_to_key_exists) break;
      }
      continue;
    }

    if (from_key === undefined || from_key === to_key) continue;

    const fromValue = getNestedValue(result, from_key);
    if (fromValue === undefined) {
      continue; // Source key doesn't exist
    }

    const toValue = getNestedValue(result, to_key);
    if (toValue !== undefined && !overwrite_if_to_key_exists) {
      continue; // Target exists and we shouldn't overwrite
    }

    result = setNestedValue(result, to_key, fromValue);
    result = deleteNestedValue(result, from_key);
  }

  return result;
}
