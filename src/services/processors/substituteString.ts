// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Substitute String Processor
 * Replaces text in fields using regex patterns
 */

import { getNestedValue, setNestedValue, deepClone, evaluateCondition } from './utils';

export interface SubstituteStringEntry {
  /** Source field to modify */
  source: string;
  /** Regex pattern to match */
  from: string;
  /** Replacement string */
  to: string;
  /** Conditional expression for this entry */
  substitute_when?: string;
}

export interface SubstituteStringConfig {
  /** List of substitution entries */
  entries: SubstituteStringEntry[];
  /** Conditional expression */
  when?: string;
}

/**
 * Apply substitute_string processor to an event
 */
export function applySubstituteString(
  event: Record<string, unknown>,
  config: SubstituteStringConfig
): Record<string, unknown> {
  let result = deepClone(event);
  
  for (const entry of config.entries) {
    if (entry.substitute_when && !evaluateCondition(result, entry.substitute_when)) continue;
    // Get source value
    const sourceValue = getNestedValue(result, entry.source);
    if (sourceValue === undefined || typeof sourceValue !== 'string') {
      continue;
    }
    
    // Create regex pattern
    let pattern: RegExp;
    try {
      pattern = new RegExp(entry.from, 'g');
    } catch {
      // Invalid regex - skip this entry
      continue;
    }
    
    // Perform substitution
    const newValue = sourceValue.replace(pattern, (...args: unknown[]) => {
      const groups = typeof args[args.length - 1] === 'object' ? args[args.length - 1] as Record<string, string> : undefined;
      const captures = args.slice(0, args.length - (groups ? 3 : 2)) as (string | undefined)[];
      let replacement = '';
      for (let i = 0; i < entry.to.length; i++) {
        const char = entry.to[i];
        if (char === '\\') {
          if (++i === entry.to.length) throw new Error('Invalid Java replacement escape');
          replacement += entry.to[i];
        } else if (char === '$') {
          if (entry.to[i + 1] === '{') {
            const end = entry.to.indexOf('}', i + 2);
            const name = entry.to.slice(i + 2, end);
            if (end === -1 || !groups || !Object.prototype.hasOwnProperty.call(groups, name)) {
              throw new Error('Unknown replacement capture group');
            }
            replacement += groups[name] ?? '';
            i = end;
          } else {
            const digit = entry.to[++i];
            if (!digit || !/\d/.test(digit)) throw new Error('Invalid Java replacement capture');
            let group = Number(digit);
            if (group >= captures.length) throw new Error('Unknown replacement capture group');
            while (i + 1 < entry.to.length && /\d/.test(entry.to[i + 1]!)) {
              const candidate = group * 10 + Number(entry.to[i + 1]);
              if (candidate >= captures.length) break;
              group = candidate;
              i++;
            }
            replacement += captures[group] ?? '';
          }
        } else replacement += char;
      }
      return replacement;
    });
    
    // Update the field
    result = setNestedValue(result, entry.source, newValue);
  }
  
  return result;
}
