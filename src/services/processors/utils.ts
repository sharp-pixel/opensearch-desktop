// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { evaluateProcessorExpression, expressionTruth } from './expression';
import { peekEventMetadata, attachEventMetadata, getMetadataAttribute } from './eventMetadata';

/**
 * Utility functions for processor implementations
 */

function pathKeys(path: string): string[] {
  const keys = normalizePath(path).split('/').map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'));
  const safetyKeys = keys.flatMap(key => key.split('.'));
  if (safetyKeys.includes('__proto__') || safetyKeys.some((key, index) => key === 'constructor' && safetyKeys[index + 1] === 'prototype')) {
    throw new Error('Unsafe field path');
  }
  return keys;
}

/**
 * Get a value using Data Prepper slash paths. Dots are literal key characters.
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = pathKeys(path);
  
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
}

/**
 * Set a nested value using a Data Prepper slash path
 * Creates intermediate objects as needed
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = pathKeys(path);
  const result = deepClone(obj);
  
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key === undefined) continue;
    if (!Object.prototype.hasOwnProperty.call(current, key) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  
  const lastKey = keys[keys.length - 1];
  if (lastKey !== undefined) {
    current[lastKey] = deepClone(value);
  }
  
  return result;
}

/**
 * Delete a nested value using a Data Prepper slash path
 */
export function deleteNestedValue(
  obj: Record<string, unknown>,
  path: string
): Record<string, unknown> {
  const keys = pathKeys(path);
  const result = deepClone(obj);
  
  if (keys.length === 1 && keys[0] !== undefined) {
    delete result[keys[0]];
    return result;
  }
  
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key === undefined) return result;
    if (!Object.prototype.hasOwnProperty.call(current, key) || typeof current[key] !== 'object' || current[key] === null) {
      return result; // Path doesn't exist
    }
    current = current[key] as Record<string, unknown>;
  }
  
  const lastKey = keys[keys.length - 1];
  if (lastKey !== undefined) {
    delete current[lastKey];
  }
  
  return result;
}

/**
 * Normalize optional leading and trailing slashes without changing literal dots
 */
export function normalizePath(path: string): string {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }
  
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    Object.defineProperty(result, key, {
      value: deepClone(value), enumerable: true, configurable: true, writable: true,
    });
  }
  const metadata = peekEventMetadata(obj);
  if (metadata) attachEventMetadata(result, deepClone(metadata));
  return result as T;
}

/** Java Matcher.matches semantics for patterns supported by the local engine. */
export function matchesWholeKey(pattern: RegExp, key: string): boolean {
  const match = new RegExp(`^(?:${pattern.source})(?![\\s\\S])`).exec(key);
  return match !== null && match.index === 0 && match[0].length === key.length;
}

export function transformKeyName(key: string, transform?: string): string {
  if (transform === 'lowercase') return key.toLowerCase();
  if (transform === 'uppercase') return key.toUpperCase();
  if (transform === 'capitalize') return key.charAt(0).toUpperCase() + key.slice(1);
  return key;
}

/**
 * Interpolate string values containing ${field} patterns
 * Replaces ${field} or ${/field/path} with actual values from the event
 */
export function interpolateString(event: Record<string, unknown>, str: string): string {
  // Match ${...} patterns
  return str.replace(/\$\{([^}]+)\}/g, (match, fieldPath) => {
    const value = getNestedValue(event, fieldPath.trim());
    if (value === undefined || value === null) {
      return match; // Keep original if field not found
    }
    return String(value);
  });
}

/**
 * Interpolate a value - if it's a string with ${} patterns, interpolate them
 * Otherwise return the value as-is
 */
export function interpolateValue(event: Record<string, unknown>, value: unknown): unknown {
  if (typeof value === 'string' && value.includes('${')) {
    const interpolated = interpolateString(event, value);
    // If the entire string was a single ${field} reference, try to preserve the type
    const singleRefMatch = value.match(/^\$\{([^}]+)\}$/);
    if (singleRefMatch && singleRefMatch[1]) {
      const fieldValue = getNestedValue(event, singleRefMatch[1].trim());
      if (fieldValue !== undefined) {
        return fieldValue;
      }
    }
    return interpolated;
  }
  return value;
}

/** Evaluate the supported processing expression subset. */
export function evaluateExpression(event: Record<string, unknown>, expression: string): unknown {
  // Retained legacy value-expression form.
  const legacyReference = expression.match(/^\$\{([^}]+)\}$/);
  if (legacyReference) return getNestedValue(event, legacyReference[1]!) ?? null;
  return evaluateProcessorExpression(expression, path => getNestedValue(event, path), {
    getMetadata: key => getMetadataAttribute(event, key),
    hasTags: tags => tags.every(tag => peekEventMetadata(event)?.tags.includes(tag) ?? false),
  });
}

export function evaluateCondition(event: Record<string, unknown>, condition: string): boolean {
  try {
    return expressionTruth(evaluateExpression(event, condition));
  } catch (cause) {
    throw new Error(`Unsupported condition expression: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}
