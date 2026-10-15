// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Parse JSON Processor
 * Parses JSON strings into structured data
 */

import { getNestedValue, setNestedValue, deleteNestedValue, deepClone, evaluateCondition } from './utils';
import { addEventTags } from './eventMetadata';

export interface ParseJsonConfig {
  /** Source field containing JSON string (default: "message") */
  source?: string;
  /** Destination field for parsed data (null/undefined for root) */
  destination?: string | null;
  /** JSON pointer to specific field to parse */
  pointer?: string;
  /** Depth limit for nested parsing (0 = unlimited) */
  depth?: number;
  /** Overwrite existing destination */
  overwrite_if_destination_exists?: boolean;
  /** Delete source field after parsing */
  delete_source?: boolean;
  /** Conditional expression */
  when?: string;
  parse_when?: string;
  tags_on_failure?: string[];
}

/**
 * Get value at JSON pointer path
 */
function getValueAtPointer(obj: unknown, pointer: string): unknown {
  const path = pointer.replace(/^\//, '').replace(/\/$/, '');
  let current = obj;
  for (const token of path.split('/')) {
    const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === null || typeof current !== 'object' ||
        !Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// Upstream converts maps only. Arrays and their contents retain their types.
function limitDepth(obj: Record<string, unknown>, currentDepth: number, maxDepth: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isMap = value !== null && typeof value === 'object' && !Array.isArray(value);
    const converted = isMap
      ? currentDepth === maxDepth ? JSON.stringify(value) : limitDepth(value as Record<string, unknown>, currentDepth + 1, maxDepth)
      : value;
    Object.defineProperty(result, key, { value: converted, enumerable: true, writable: true, configurable: true });
  }
  return result;
}

/**
 * Apply parse_json processor to an event
 */
export function applyParseJson(
  event: Record<string, unknown>,
  config: ParseJsonConfig
): Record<string, unknown> {
  const result = deepClone(event);
  if (config.parse_when && !evaluateCondition(result, config.parse_when)) return result;
  
  const source = config.source || 'message';
  const destination = config.destination;
  const depth = config.depth || 0;
  
  // Get source value
  const sourceValue = getNestedValue(result, source);
  if (sourceValue == null) {
    if (config.pointer !== undefined) addEventTags(result, config.tags_on_failure);
    return result;
  }
  if (typeof sourceValue !== 'string') {
    return result;
  }
  
  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(sourceValue);
  } catch {
    // Invalid JSON - return unchanged
    addEventTags(result, config.tags_on_failure);
    return result;
  }
  // Upstream Optional.of(null) fails parsing and passes the event through.
  if (parsed === null) {
    addEventTags(result, config.tags_on_failure);
    return result;
  }
  
  // Depth conversion happens before pointer extraction in Data Prepper.
  if (depth > 0 && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    parsed = limitDepth(parsed as Record<string, unknown>, 1, depth);
  }

  if (config.pointer !== undefined) {
    const pointedValue = getValueAtPointer(parsed, config.pointer);
    if (pointedValue !== undefined) {
      const trimmed = config.pointer.replace(/^\//, '').replace(/\/$/, '');
      const parts = trimmed.split('/');
      const last = parts[parts.length - 1] ?? '';
      const end = /^\d+$/.test(last) && parts.length > 1 ? parts.slice(-2).join('/') : last;
      const root = destination === null || destination === undefined;
      const key = (root && getNestedValue(result, end) !== undefined ? trimmed : end).replace(/\//g, '.');
      parsed = { [key]: pointedValue };
    }
  }

  // Write to destination
  let finalResult = result;
  if (destination === null || destination === undefined) {
    // Non-object values cannot be written to root; the event passes through.
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      addEventTags(result, config.tags_on_failure);
      return result;
    }
    if (config.delete_source) finalResult = deleteNestedValue(finalResult, source);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (config.overwrite_if_destination_exists !== false || getNestedValue(finalResult, key) === undefined) {
          finalResult = setNestedValue(finalResult, key, value);
        }
      }
    }
  } else {
    if (config.overwrite_if_destination_exists !== false || getNestedValue(finalResult, destination) === undefined) {
      finalResult = setNestedValue(finalResult, destination, parsed);
    }
  }
  
  // Delete source if configured
  if (config.delete_source && destination !== null && destination !== undefined) {
    finalResult = deleteNestedValue(finalResult, source);
  }
  
  return finalResult;
}
