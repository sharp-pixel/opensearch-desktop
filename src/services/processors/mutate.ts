// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Mutate Processor Implementation
 * Handles field mutations: rename, remove, add, convert, case changes, trim
 */

import type { MutateConfig } from '../../types/dataPrepper';
import { getNestedValue, setNestedValue, deleteNestedValue, deepClone } from './utils';

/**
 * Apply mutate processor to an event
 */
export function applyMutate(
  event: Record<string, unknown>,
  config: MutateConfig
): Record<string, unknown> {
  let result = deepClone(event);

  // Rename fields
  if (config.rename) {
    for (const [fromKey, toKey] of Object.entries(config.rename)) {
      const value = getNestedValue(result, fromKey);
      if (value !== undefined) {
        result = deleteNestedValue(result, fromKey);
        result = setNestedValue(result, toKey, value);
      }
    }
  }

  // Remove fields
  if (config.remove) {
    for (const key of config.remove) {
      result = deleteNestedValue(result, key);
    }
  }

  // Add fields
  if (config.add) {
    for (const [key, value] of Object.entries(config.add)) {
      result = setNestedValue(result, key, value);
    }
  }

  // Convert field types
  if (config.convert) {
    for (const [key, targetType] of Object.entries(config.convert)) {
      const value = getNestedValue(result, key);
      if (value !== undefined) {
        const converted = convertValue(value, targetType);
        if (converted !== undefined) {
          result = setNestedValue(result, key, converted);
        }
      }
    }
  }

  // Lowercase fields
  if (config.lowercase) {
    for (const key of config.lowercase) {
      const value = getNestedValue(result, key);
      if (typeof value === 'string') {
        result = setNestedValue(result, key, value.toLowerCase());
      }
    }
  }

  // Uppercase fields
  if (config.uppercase) {
    for (const key of config.uppercase) {
      const value = getNestedValue(result, key);
      if (typeof value === 'string') {
        result = setNestedValue(result, key, value.toUpperCase());
      }
    }
  }

  // Trim fields
  if (config.trim) {
    for (const key of config.trim) {
      const value = getNestedValue(result, key);
      if (typeof value === 'string') {
        result = setNestedValue(result, key, value.trim());
      }
    }
  }

  return result;
}

/**
 * Convert a value to the specified type
 */
function convertValue(
  value: unknown,
  targetType: 'integer' | 'float' | 'string' | 'boolean'
): unknown {
  switch (targetType) {
    case 'integer': {
      const num = Number(value);
      return isNaN(num) ? undefined : Math.floor(num);
    }
    case 'float': {
      const num = Number(value);
      return isNaN(num) ? undefined : num;
    }
    case 'string':
      return String(value);
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
      }
      if (typeof value === 'number') return value !== 0;
      return undefined;
    }
    default:
      return undefined;
  }
}
