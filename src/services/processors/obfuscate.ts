// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Obfuscate Processor
 * Obfuscates field values to protect sensitive data
 */

import { getNestedValue, setNestedValue, deepClone } from './utils';
import { addEventTags } from './eventMetadata';

/** Predefined common patterns */
const COMMON_PATTERNS: Record<string, string> = {
  EMAIL_ADDRESS: '[A-Za-z0-9+_.-]+@([\\w-]+\\.)+[\\w-]{2,4}',
  IP_ADDRESS_V4: '((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}',
  BASE_NUMBER: '[0-9]*\\.?[0-9]+',
  CREDIT_CARD_NUMBER: '(\\d[ -]*?){13,16}',
  US_PHONE_NUMBER: '\\+?\\d?[\\s-]?(\\(\\d{3}\\)|\\d{3})[\\s-]?\\d{3}[\\s-]?\\d{4}',
  US_SSN_NUMBER: '[0-9]{3}-[0-9]{2}-[0-9]{4}',
};

export interface MaskActionConfig {
  /** Character to use for masking (default: *) */
  mask_character?: string;
  /** Length of mask string (default: 3) */
  mask_character_length?: number;
}

export interface ObfuscateConfig {
  /** Source key to obfuscate */
  source: string;
  /** Target key for obfuscated value (if not set, overwrites source) */
  target?: string;
  /** Regex patterns to match for partial obfuscation */
  patterns?: string[];
  /** Obfuscation action configuration */
  action?: {
    mask?: MaskActionConfig;
  };
  /** Only match whole words */
  single_word_only?: boolean;
  tags_on_match_failure?: string[];
  /** Conditional expression */
  when?: string;
}

/**
 * Resolve a pattern string - handles %{PATTERN_NAME} syntax
 */
function resolvePattern(pattern: string): string {
  const commonPatternMatch = pattern.match(/^%\{([A-Z_0-9]+)\}$/);
  if (commonPatternMatch) {
    const patternName = commonPatternMatch[1];
    if (patternName && patternName in COMMON_PATTERNS) {
      return COMMON_PATTERNS[patternName]!;
    }
    throw new Error(`Unknown predefined pattern: ${patternName}`);
  }
  return pattern;
}

/**
 * Create mask string based on action config
 */
function createMask(actionConfig?: { mask?: MaskActionConfig }): string {
  const maskChar = actionConfig?.mask?.mask_character ?? '*';
  const maskLength = actionConfig?.mask?.mask_character_length ?? 3;
  return maskChar.repeat(maskLength);
}

/**
 * Apply obfuscation to a string value
 */
function obfuscateString(
  value: string,
  patterns: RegExp[],
  mask: string
): string {
  if (patterns.length === 0) {
    // No patterns - replace entire value
    return mask;
  }
  
  let result = value;
  for (const pattern of patterns) {
    result = result.replace(pattern, mask);
  }
  return result;
}

/**
 * Apply obfuscate processor to an event
 */
export function applyObfuscate(
  event: Record<string, unknown>,
  config: ObfuscateConfig
): Record<string, unknown> {
  const result = deepClone(event);
  
  // Get source value
  const sourceValue = getNestedValue(result, config.source);
  if (sourceValue === undefined || typeof sourceValue !== 'string') {
    return result; // Nothing to obfuscate
  }
  
  // Build regex patterns
  const patterns: RegExp[] = [];
  if (config.patterns && config.patterns.length > 0) {
    for (const rawPattern of config.patterns) {
      let pattern = resolvePattern(rawPattern);

      // Invalid patterns propagate instead of falling back to masking everything.
      if (config.single_word_only) {
        pattern = `\\b${pattern}\\b`;
      }

      patterns.push(new RegExp(pattern, 'g'));
    }
  }
  
  // Create mask
  const mask = createMask(config.action);
  
  // Apply obfuscation
  const obfuscated = obfuscateString(sourceValue, patterns, mask);
  if (obfuscated === sourceValue) addEventTags(result, config.tags_on_match_failure);
  
  // Set result
  const targetKey = config.target || config.source;
  return setNestedValue(result, targetKey, obfuscated);
}
