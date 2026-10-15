// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Split String Processor
 * Splits a field into an array using a delimiter
 */

import { getNestedValue, setNestedValue, deepClone, evaluateCondition } from './utils';

export interface SplitStringEntry {
  /** Source field to split */
  source: string;
  /** Delimiter character */
  delimiter?: string;
  /** Delimiter regex pattern */
  delimiter_regex?: string;
  /** Conditional expression for this entry */
  split_when?: string;
}

export interface SplitStringConfig {
  /** List of split entries */
  entries: SplitStringEntry[];
  /** Conditional expression */
  when?: string;
}

/**
 * Apply split_string processor to an event
 */
export function applySplitString(
  event: Record<string, unknown>,
  config: SplitStringConfig
): Record<string, unknown> {
  let result = deepClone(event);
  
  for (const entry of config.entries) {
    if (entry.split_when && !evaluateCondition(result, entry.split_when)) continue;
    // Get source value
    const sourceValue = getNestedValue(result, entry.source);
    if (sourceValue === undefined || typeof sourceValue !== 'string') {
      continue;
    }
    
    // Determine delimiter pattern
    let pattern: RegExp;
    if (entry.delimiter_regex) {
      pattern = new RegExp(entry.delimiter_regex);
    } else if (entry.delimiter) {
      // Escape special regex characters for literal delimiter
      pattern = new RegExp(escapeRegex(entry.delimiter));
    } else {
      // Skip if no delimiter specified
      continue;
    }
    
    // Split the string
    // Java Pattern.split excludes capture groups and trailing empty strings.
    const splitValues: string[] = [];
    const matcher = new RegExp(pattern.source, 'g');
    let lastIndex = 0;
    let matched = false;
    for (const match of sourceValue.matchAll(matcher)) {
      if (match.index === 0 && match[0].length === 0) continue;
      splitValues.push(sourceValue.slice(lastIndex, match.index));
      lastIndex = match.index + match[0].length;
      matched = true;
    }
    splitValues.push(sourceValue.slice(lastIndex));
    if (matched) {
      while (splitValues[splitValues.length - 1] === '') splitValues.pop();
    }
    
    // Update the field with array
    result = setNestedValue(result, entry.source, splitValues);
  }
  
  return result;
}

/**
 * Escape special regex characters by prefixing with backslash
 */
function escapeRegex(str: string): string {
  const specialChars = /[.*+?^${}()|[\]\\]/g;
  return str.replace(specialChars, (match) => '\\' + match);
}
