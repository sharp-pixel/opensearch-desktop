// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Key-Value Processor
 * Parses key-value pairs from strings into structured data
 */

import { getNestedValue, setNestedValue, deepClone, transformKeyName } from './utils';

export interface KeyValueConfig {
  /** Source field containing key-value data (default: "message") */
  source?: string;
  /** Destination field for parsed data (default: "parsed_message", null for root) */
  destination?: string | null;
  /** Characters that separate key-value pairs (default: "&") */
  field_split_characters?: string;
  /** Regex pattern for field delimiter */
  field_delimiter_regex?: string;
  /** Characters that separate keys from values (default: "=") */
  value_split_characters?: string;
  /** Regex pattern for key-value delimiter */
  key_value_delimiter_regex?: string;
  /** Keys to include (empty means all) */
  include_keys?: string[];
  /** Keys to exclude */
  exclude_keys?: string[];
  /** Default values for keys */
  default_values?: Record<string, unknown>;
  /** Value for non-matching entries */
  non_match_value?: unknown;
  /** Prefix to add to all keys */
  prefix?: string;
  /** Regex pattern for characters to delete from keys */
  delete_key_regex?: string;
  /** Regex pattern for characters to delete from values */
  delete_value_regex?: string;
  /** Transform key case: "lowercase", "uppercase", "capitalize", or "none" */
  transform_key?: 'lowercase' | 'uppercase' | 'capitalize' | 'none';
  /** Trim whitespace: "strict" or "lenient" */
  whitespace?: 'strict' | 'lenient';
  /** Skip duplicate values */
  skip_duplicate_values?: boolean;
  /** Remove brackets from values */
  remove_brackets?: boolean;
  /** Drop keys with no value */
  drop_keys_with_no_value?: boolean;
  /** Overwrite existing destination */
  overwrite_if_destination_exists?: boolean;
  destination_conflict_strategy?: 'skip' | 'overwrite' | 'merge_preserve_existing_keys' | 'merge_overwrite_existing_keys';
  /** Conditional expression */
  when?: string;
}

/**
 * Apply key-value processor to an event
 */
export function applyKeyValue(
  event: Record<string, unknown>,
  config: KeyValueConfig
): Record<string, unknown> {
  let result = deepClone(event);
  
  const source = config.source || 'message';
  const destination = config.destination === undefined ? 'parsed_message' : config.destination;
  const fieldDelimiter = config.field_delimiter_regex 
    ? new RegExp(config.field_delimiter_regex)
    : new RegExp(`[${escapeRegex(config.field_split_characters || '&')}]`);
  const kvDelimiter = config.key_value_delimiter_regex
    ? new RegExp(config.key_value_delimiter_regex)
    : new RegExp(`[${escapeRegex(config.value_split_characters || '=')}]`);
  
  // Get source value
  const sourceValue = getNestedValue(result, source);
  if (sourceValue === undefined || typeof sourceValue !== 'string') {
    return result;
  }
  
  // Split into key-value pairs
  const pairs = sourceValue.split(fieldDelimiter);
  const parsed: Record<string, unknown> = Object.create(null);
  
  const includeKeys = new Set(config.include_keys || []);
  const excludeKeys = new Set(config.exclude_keys || []);
  
  for (const pair of pairs) {
    const trimmedPair = config.whitespace === 'strict' ? pair.trim() : pair;
    if (!trimmedPair) continue;
    
    const parts = trimmedPair.split(kvDelimiter);
    let key = parts[0] || '';
    let value: unknown = parts.length > 1 ? parts.slice(1).join('=') : config.non_match_value;
    if (parts.length === 1 && (config.non_match_value === undefined || config.non_match_value === null)) continue;
    
    if (!key) continue;
    
    // Apply whitespace handling
    if (config.whitespace === 'strict') {
      key = key.trim();
      if (typeof value === 'string') {
        value = value.trim();
      }
    }
    
    // Apply delete_key_regex
    if (config.delete_key_regex) {
      key = key.replace(new RegExp(config.delete_key_regex, 'g'), '');
    }
    
    // Apply delete_value_regex
    if (config.delete_value_regex && typeof value === 'string') {
      value = value.replace(new RegExp(config.delete_value_regex, 'g'), '');
    }
    
    // Apply transform_key
    key = transformKeyName(key, config.transform_key);
    
    // Apply prefix
    if (config.prefix) {
      key = config.prefix + key;
    }
    
    // Apply remove_brackets
    if (config.remove_brackets && typeof value === 'string') {
      value = value.replace(/[\[\]()<>]/g, '');
    }
    
    // Check include/exclude keys
    if (includeKeys.size > 0 && !includeKeys.has(key)) continue;
    if (excludeKeys.has(key)) continue;
    
    // Check drop_keys_with_no_value
    if (config.drop_keys_with_no_value && (value === null || value === undefined)) {
      continue;
    }
    
    // Handle duplicate keys
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      const existing = parsed[key];
      if (config.skip_duplicate_values) {
        if (Array.isArray(existing)) {
          if (!existing.includes(value)) {
            existing.push(value);
          }
        } else if (existing !== value) {
          parsed[key] = [existing, value];
        }
      } else {
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          parsed[key] = [existing, value];
        }
      }
    } else {
      parsed[key] = value;
    }
  }
  
  // Apply default values
  if (config.default_values) {
    for (const [key, value] of Object.entries(config.default_values)) {
      if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
        parsed[key] = value;
      }
    }
  }
  
  // Write to destination
  const strategy = config.destination_conflict_strategy?.toLowerCase() ??
    (config.overwrite_if_destination_exists === false ? 'skip' : 'overwrite');
  const overwrite = strategy === 'overwrite' || strategy === 'merge_overwrite_existing_keys';
  const existing = destination ? getNestedValue(result, destination) : undefined;
  const merge = strategy.startsWith('merge_') && existing !== null && typeof existing === 'object' && !Array.isArray(existing);
  if (!destination || merge) {
    const prefix = destination ? `${destination}/` : '';
    for (const [key, value] of Object.entries(parsed)) {
      const path = prefix + key;
      if (overwrite || getNestedValue(result, path) === undefined) {
        result = setNestedValue(result, path, value);
      }
    }
  } else {
    if (overwrite || existing === undefined) {
      result = setNestedValue(result, destination, parsed);
    }
  }
  
  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
