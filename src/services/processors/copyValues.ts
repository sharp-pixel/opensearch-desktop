// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Copy Values Processor Implementation
 */

import type { CopyValuesConfig } from '../../types/dataPrepper';
import { getNestedValue, setNestedValue, evaluateCondition, deepClone } from './utils';

/**
 * Apply copy_values processor to an event
 */
export function applyCopyValues(
  event: Record<string, unknown>,
  config: CopyValuesConfig
): Record<string, unknown> {
  let result = deepClone(event);

  if (!config.entries || !Array.isArray(config.entries)) {
    return result;
  }

  if (config.from_list !== undefined && config.to_list !== undefined) {
    if (getNestedValue(result, config.to_list) !== undefined && !config.overwrite_if_to_list_exists) return result;
    const source = getNestedValue(result, config.from_list);
    if (!Array.isArray(source) || source.some(item => item === null || typeof item !== 'object' || Array.isArray(item))) return result;
    // List entries use literal map keys; predicates see the root event.
    const entries = config.entries.filter(entry => !entry.copy_when || evaluateCondition(result, entry.copy_when));
    const target = source.map(item => {
      const copied: Record<string, unknown> = Object.create(null);
      for (const entry of entries) {
        if (Object.prototype.hasOwnProperty.call(item, entry.from_key)) {
          copied[entry.to_key] = deepClone(item[entry.from_key]);
        }
      }
      return copied;
    });
    return setNestedValue(result, config.to_list, target);
  }

  for (const entry of config.entries) {
    const { from_key, to_key, overwrite_if_to_key_exists = false } = entry;
    if (entry.copy_when && !evaluateCondition(result, entry.copy_when)) continue;
    if (from_key === to_key) continue;

    const fromValue = getNestedValue(result, from_key);
    if (fromValue === undefined) {
      continue; // Source key doesn't exist
    }

    const toValue = getNestedValue(result, to_key);
    if (toValue !== undefined && !overwrite_if_to_key_exists) {
      continue; // Target exists and we shouldn't overwrite
    }

    // Deep clone the value to avoid reference issues
    const clonedValue = deepClone(fromValue);
    result = setNestedValue(result, to_key, clonedValue);
  }

  return result;
}
