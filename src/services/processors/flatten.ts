// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Flatten Processor
 * Transforms nested objects inside events into flattened structures
 */

import { getNestedValue, setNestedValue, deleteNestedValue, deepClone, evaluateCondition } from './utils';

export interface FlattenConfig {
  /** Source key to flatten. Empty string means root of event */
  source: string;
  /** Target key for flattened fields. Empty string means root of event */
  target: string;
  /** Remove source fields after flattening */
  remove_processed_fields?: boolean;
  remove_source_keys?: boolean;
  /** Remove list indices from keys (converts to lists) */
  remove_list_indices?: boolean;
  remove_list_elements?: boolean;
  flatten_separator?: string;
  flatten_when?: string;
  /** Remove brackets around indices (only when remove_list_indices is true) */
  remove_brackets?: boolean;
  /** Keys to exclude from flattening */
  exclude_keys?: string[];
  /** Conditional expression */
  when?: string;
}

/**
 * Flatten a nested object into a flat key-value map
 * Keys are joined with dots (e.g., "a.b.c")
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix: string = '',
  result: Record<string, unknown> = Object.create(null),
  separator: string = '.'
): Record<string, unknown> {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;
    
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively flatten nested objects
      if (Object.keys(value).length === 0) result[newKey] = {};
      else flattenObject(value as Record<string, unknown>, newKey, result, separator);
    } else if (Array.isArray(value)) {
      // Handle arrays - flatten with indices
      if (value.length === 0) result[newKey] = [];
      else flattenArray(value, newKey, result, separator);
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Flatten an array, adding indices to keys
 */
function flattenArray(
  arr: unknown[],
  prefix: string,
  result: Record<string, unknown>,
  separator: string
): void {
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const newKey = `${prefix}[${i}]`;
    
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      if (Object.keys(item).length === 0) result[newKey] = {};
      else flattenObject(item as Record<string, unknown>, newKey, result, separator);
    } else if (Array.isArray(item)) {
      if (item.length === 0) result[newKey] = [];
      else flattenArray(item, newKey, result, separator);
    } else {
      result[newKey] = item;
    }
  }
}

/**
 * Remove list indices from keys and merge values into arrays
 */
function removeListIndicesFromKeys(
  flatMap: Record<string, unknown>,
  removeBrackets: boolean
): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  
  for (const [key, value] of Object.entries(flatMap)) {
    // Replace [n] with [] or nothing
    const replacement = removeBrackets ? '' : '[]';
    const newKey = key.replace(/\[\d+\]/g, replacement);
    
    if (Object.prototype.hasOwnProperty.call(result, newKey)) {
      // Merge into array
      const existing = result[newKey];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[newKey] = [existing, value];
      }
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Apply flatten processor to an event
 */
export function applyFlatten(
  event: Record<string, unknown>,
  config: FlattenConfig
): Record<string, unknown> {
  let result = deepClone(event);
  if (config.flatten_when && !evaluateCondition(result, config.flatten_when)) return result;
  const source = config.source ?? '';
  const excluded = new Map<string, unknown>();
  for (const key of config.exclude_keys ?? []) {
    const path = source ? `${source}/${key}` : key;
    const value = getNestedValue(result, path);
    if (value !== undefined) {
      excluded.set(path, value);
      result = deleteNestedValue(result, path);
    }
  }
  
  // Get source object
  let sourceObj: Record<string, unknown>;
  if (source === '') {
    // Source is root
    sourceObj = { ...result };
  } else {
    const sourceValue = getNestedValue(result, source);
    if (sourceValue === undefined || typeof sourceValue !== 'object' || sourceValue === null) {
      return deepClone(event); // Nothing to flatten
    }
    sourceObj = sourceValue as Record<string, unknown>;
  }
  
  // Flatten the source object
  let flattened = flattenObject(sourceObj, '', Object.create(null), config.flatten_separator ?? '.');
  
  // Remove list indices if configured
  if (config.remove_list_elements ?? config.remove_list_indices) {
    flattened = removeListIndicesFromKeys(flattened, config.remove_brackets || false);
  }
  
  // Remove processed fields if configured
  if (config.remove_source_keys ?? config.remove_processed_fields) {
    for (const key of Object.keys(sourceObj)) {
      // Removing processed fields preserves the source object itself.
      result = deleteNestedValue(result, source ? `${source}/${key}` : key);
    }
  }
  
  // Put flattened result into target
  if (config.target === '' || config.target === undefined) {
    // Target is root - merge flattened keys into result
    for (const [key, value] of Object.entries(flattened)) {
      result = setNestedValue(result, key, value);
    }
  } else {
    result = setNestedValue(result, config.target, flattened);
  }
  for (const [path, value] of excluded) result = setNestedValue(result, path, value);
  
  return result;
}
