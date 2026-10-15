// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Add Entries Processor Implementation
 */

import type { AddEntriesConfig, AddEntry } from '../../types/dataPrepper';
import { getNestedValue, setNestedValue, evaluateCondition, evaluateExpression, deepClone } from './utils';
import { formatExpressionValue } from './expression';
import { getEventMetadata, inheritEventMetadata, detachEventMetadata } from './eventMetadata';

/**
 * Apply add_entries processor to an event
 */
export function applyAddEntries(
  event: Record<string, unknown>,
  config: AddEntriesConfig
): Record<string, unknown> {
  let result = deepClone(event);

  if (!config.entries || !Array.isArray(config.entries)) {
    return result;
  }

  for (const entry of config.entries) {
    const { overwrite_if_key_exists = false } = entry;
    if (entry.add_when && !evaluateCondition(result, entry.add_when)) continue;

    if (entry.metadata_key !== undefined) {
      const metadata = getEventMetadata(result);
      const key = entry.metadata_key;
      const exists = Object.prototype.hasOwnProperty.call(metadata.attributes, key);
      if (exists && !overwrite_if_key_exists && !entry.append_if_key_exists) continue;
      let value = retrieveValue(result, entry);
      if (exists && entry.append_if_key_exists && !overwrite_if_key_exists) value = appendValue(metadata.attributes[key], value);
      Object.defineProperty(metadata.attributes, key, { value: deepClone(value), enumerable: true, configurable: true, writable: true });
      continue;
    }

    if (entry.key === undefined) continue;

    // Dynamic keys always resolve against the root, including inside lists.
    const key = formatString(result, entry.key, true);
    if (!key.length || key.length > 2048 || /[^A-Za-z0-9._~@/\[\] $()-]/.test(key)) {
      throw new Error('Invalid resolved add_entries key for local simulation');
    }
    // Retain the simulator's field-path safety checks for literal list keys too.
    getNestedValue({}, key);

    if (entry.iterate_on !== undefined) {
      const items = getNestedValue(result, entry.iterate_on);
      if (!Array.isArray(items) || !items.length) continue;
      if (items.some(item => item === null || typeof item !== 'object' || Array.isArray(item))) continue;
      if (entry.add_to_element_when && !entry.evaluate_when_on_element &&
          !evaluateCondition(result, entry.add_to_element_when)) continue;
      const updated = items.map(item => {
        const context = inheritEventMetadata(deepClone(item as Record<string, unknown>), result);
        if (entry.add_to_element_when && entry.evaluate_when_on_element &&
            !evaluateCondition(context, entry.add_to_element_when)) return context;
        const valueContext = entry.disable_root_keys === false ? result : context;
        let valueToSet = retrieveValue(valueContext, entry);
        // Upstream checks the raw map key even when flatten_key is false.
        const exists = Object.prototype.hasOwnProperty.call(context, key);
        if (exists && !overwrite_if_key_exists) {
          if (!entry.append_if_key_exists) return context;
          const current = entry.flatten_key === false ? getNestedValue(context, key) ?? null : context[key];
          valueToSet = appendValue(current, valueToSet);
        }
        if (entry.flatten_key === false) return setNestedValue(context, key, valueToSet);
        const updatedItem = deepClone(context);
        Object.defineProperty(updatedItem, key, {
          value: deepClone(valueToSet), enumerable: true, writable: true, configurable: true,
        });
        return updatedItem;
      });
      result = setNestedValue(result, entry.iterate_on, updated.map(detachEventMetadata));
      continue;
    }

    // Check if key exists and we shouldn't overwrite
    const existingValue = getNestedValue(result, key);
    if (existingValue !== undefined && !overwrite_if_key_exists && !entry.append_if_key_exists) {
      continue;
    }

    let valueToSet = retrieveValue(result, entry);

    if (existingValue !== undefined && entry.append_if_key_exists && !overwrite_if_key_exists) {
      valueToSet = appendValue(existingValue, valueToSet);
    }

    result = setNestedValue(result, key, valueToSet);
  }

  return result;
}

function appendValue(current: unknown, value: unknown): unknown[] {
  return [...(Array.isArray(current) ? current : [current]), value];
}

function retrieveValue(event: Record<string, unknown>, entry: AddEntry): unknown {
  if (entry.value_expression !== undefined) return evaluateExpression(event, entry.value_expression) ?? null;
  if (entry.format !== undefined) return formatString(event, entry.format);
  return deepClone(entry.value);
}

/**
 * Format a string with field substitutions
 * Replaces ${field} with the field value
 */
function formatString(event: Record<string, unknown>, format: string, dynamicKey = false): string {
  if (/\$\{[^}]*$/.test(format)) throw new Error('Malformed add_entries format');
  return format.replace(/\$\{([^}]+)\}/g, (_, fieldPath) => {
    // Key formats can evaluate expressions upstream; value formats read paths.
    let value = getNestedValue(event, fieldPath);
    if (dynamicKey && value == null) {
      value = evaluateExpression(event, fieldPath);
    }
    return value == null ? '' : formatExpressionValue(value);
  });
}
