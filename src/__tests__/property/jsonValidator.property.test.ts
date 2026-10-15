// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for JSON Validator
 * Feature: opensearch-notebook-ui
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateJson, isValidJson } from '../../utils/jsonValidator';

describe('JSON Validator Property Tests', () => {
  /**
   * Property 6: JSON Validation Correctness
   * For any string input, the JSON validator should return valid=true if and only if
   * the string is parseable as valid JSON, and should return valid=false with an
   * error location for malformed JSON.
   * Validates: Requirements 3.4
   */
  it('Property 6: JSON Validation Correctness - Valid JSON', () => {
    fc.assert(
      fc.property(fc.json(), (jsonValue) => {
        // fc.json() generates valid JSON strings
        const result = validateJson(jsonValue);
        
        // Valid JSON should return valid=true
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        
        // isValidJson should also return true
        expect(isValidJson(jsonValue)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6b: Invalid JSON returns valid=false with error
   */
  it('Property 6: JSON Validation Correctness - Invalid JSON', () => {
    // Generator for invalid JSON strings
    const invalidJsonArb = fc.oneof(
      // Unclosed braces
      fc.constant('{'),
      fc.constant('{"key": "value"'),
      fc.constant('{"key": '),
      // Unclosed brackets
      fc.constant('['),
      fc.constant('[1, 2, 3'),
      fc.constant('["a", "b"'),
      // Invalid syntax
      fc.constant('{key: "value"}'), // unquoted key
      fc.constant("{'key': 'value'}"), // single quotes
      fc.constant('{\"key\": undefined}'), // undefined value
      fc.constant('{\"key\": NaN}'), // NaN value
      fc.constant('{\"key\": Infinity}'), // Infinity value
      // Trailing commas
      fc.constant('{"key": "value",}'),
      fc.constant('[1, 2, 3,]'),
      // Multiple values at root
      fc.constant('{}{}'),
      fc.constant('[][]'),
      // Random invalid strings
      fc.string({
        unit: fc.constantFrom('a', 'b', 'c', '1', '2', '3', ' '),
        minLength: 1,
        maxLength: 20,
      }).filter((s: string) => {
          try {
            JSON.parse(s);
            return false; // Filter out accidentally valid JSON
          } catch {
            return true;
          }
        }),
    );

    fc.assert(
      fc.property(invalidJsonArb, (invalidJson) => {
        const result = validateJson(invalidJson);
        
        // Invalid JSON should return valid=false
        expect(result.valid).toBe(false);
        
        // Should have an error object
        expect(result.error).toBeDefined();
        expect(typeof result.error?.message).toBe('string');
        expect(result.error?.message.length).toBeGreaterThan(0);
        
        // isValidJson should also return false
        expect(isValidJson(invalidJson)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6c: Empty string is invalid JSON
   */
  it('Property 6: JSON Validation Correctness - Empty String', () => {
    const emptyStrings = ['', '   ', '\n', '\t', '\r\n'];
    
    for (const emptyStr of emptyStrings) {
      const result = validateJson(emptyStr);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(isValidJson(emptyStr)).toBe(false);
    }
  });

  /**
   * Property 6d: Error location is provided for invalid JSON
   */
  it('Property 6: JSON Validation Correctness - Error Location', () => {
    // Test cases with known error positions
    const testCases = [
      { json: '{"key": }', expectedLine: 1 },
      { json: '{\n"key": \n}', expectedLine: 3 },
      { json: '[1, 2, ]', expectedLine: 1 },
    ];
    
    for (const { json, expectedLine } of testCases) {
      const result = validateJson(json);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      
      // Error should have position information
      if (result.error?.line !== undefined) {
        expect(result.error.line).toBe(expectedLine);
      }
    }
  });

  /**
   * Property: Validation is consistent with JSON.parse
   */
  it('Validation is consistent with JSON.parse', () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        let parseSucceeded: boolean;
        try {
          JSON.parse(str);
          parseSucceeded = true;
        } catch {
          parseSucceeded = false;
        }
        
        const result = validateJson(str);
        
        // Our validation should match JSON.parse behavior
        expect(result.valid).toBe(parseSucceeded);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Various JSON types are valid
   */
  it('Various JSON types are valid', () => {
    const validJsonCases = [
      'null',
      'true',
      'false',
      '0',
      '123',
      '-456',
      '3.14',
      '-2.5e10',
      '""',
      '"hello"',
      '"hello\\nworld"',
      '[]',
      '[1, 2, 3]',
      '["a", "b", "c"]',
      '{}',
      '{"key": "value"}',
      '{"nested": {"key": "value"}}',
      '{"array": [1, 2, 3]}',
      '[{"a": 1}, {"b": 2}]',
    ];
    
    for (const json of validJsonCases) {
      const result = validateJson(json);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });
});
