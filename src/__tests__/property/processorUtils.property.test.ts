// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Processor Utils
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getEventMetadata, peekEventMetadata, attachEventMetadata, getMetadataAttribute } from '../../services/processors/eventMetadata';
import {
  getNestedValue,
  setNestedValue,
  deleteNestedValue,
  normalizePath,
  deepClone,
  interpolateString,
  interpolateValue,
  evaluateCondition,
} from '../../services/processors/utils';

describe('Processor Utils Property Tests', () => {
  describe('normalizePath', () => {
    it('Property: normalizes optional leading slash', () => {
      fc.assert(
        fc.property(
          fc.array(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/), { minLength: 1, maxLength: 5 }),
          (parts) => {
            const slashPath = '/' + parts.join('/');
            expect(normalizePath(slashPath)).toBe(parts.join('/'));
          }
        )
      );
    });

    it('Property: preserves dot notation paths', () => {
      fc.assert(
        fc.property(
          fc.array(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/), { minLength: 1, maxLength: 5 }),
          (parts) => {
            const dotPath = parts.join('.');
            expect(normalizePath(dotPath)).toBe(dotPath);
          }
        )
      );
    });
  });

  describe('deepClone', () => {
    it('preserves independent metadata without adding it to body JSON', () => {
      const event = { body: 'value' };
      const metadata = getEventMetadata(event);
      metadata.attributes.nested = { values: [1] };
      metadata.tags.push('original');
      const copied = deepClone(event);
      const copiedMetadata = getEventMetadata(copied);
      (copiedMetadata.attributes.nested as { values: number[] }).values.push(2);
      copiedMetadata.tags.push('copy');
      expect(peekEventMetadata(event)).toEqual({ attributes: { nested: { values: [1] } }, tags: ['original'] });
      expect(JSON.stringify(copied)).toBe('{"body":"value"}');
      expect(Object.keys(copied)).toEqual(['body']);
    });

    it('metadata lookup accepts an optional leading slash without inheriting prototype values', () => {
      const event = attachEventMetadata({}, { attributes: { nested: { value: 1 } }, tags: [] });
      expect(getMetadataAttribute(event, '/nested/value')).toBe(1);
      expect(getMetadataAttribute(event, '/constructor')).toBeNull();
    });
    it('Property: clones primitives unchanged', () => {
      expect(deepClone('test')).toBe('test');
      expect(deepClone(42)).toBe(42);
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
    });

    it('Property: clones arrays deeply', () => {
      const arr = [1, 2, 3, 4, 5];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
    });

    it('Property: clones objects deeply', () => {
      const obj = { a: 1, b: 'test', c: true };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('Property: clones nested objects deeply', () => {
      const nested = { a: { b: { c: 1 } }, d: [1, 2, { e: 3 }] };
      const cloned = deepClone(nested);
      expect(cloned).toEqual(nested);
      expect(cloned).not.toBe(nested);
      expect(cloned.a).not.toBe(nested.a);
      expect(cloned.d).not.toBe(nested.d);
    });
  });

  describe('getNestedValue', () => {
    it('Property: retrieves top-level values', () => {
      const obj = { myKey: 42 };
      expect(getNestedValue(obj, 'myKey')).toBe(42);
    });

    it('Property: retrieves nested values with slash notation', () => {
      const obj = { a: { b: { c: 42 } } };
      expect(getNestedValue(obj, 'a/b/c')).toBe(42);
      expect(getNestedValue(obj, 'a/b')).toEqual({ c: 42 });
    });

    it('Property: retrieves nested values with slash notation', () => {
      const obj = { a: { b: { c: 42 } } };
      expect(getNestedValue(obj, '/a/b/c')).toBe(42);
    });

    it('Property: returns undefined for non-existent paths', () => {
      const obj = { other: 'value' };
      expect(getNestedValue(obj, 'nonexistent')).toBeUndefined();
      expect(getNestedValue(obj, 'a/b/c')).toBeUndefined();
    });

    it('Property: returns undefined when traversing non-objects', () => {
      const obj = { a: 'string' };
      expect(getNestedValue(obj, 'a/b')).toBeUndefined();
    });

    it('Property: returns undefined for null values in path', () => {
      const obj = { a: null };
      expect(getNestedValue(obj, 'a/b')).toBeUndefined();
    });
  });

  describe('setNestedValue', () => {
    it('Property: sets top-level values', () => {
      const obj = {};
      const result = setNestedValue(obj, 'key', 42);
      expect(result.key).toBe(42);
      expect(obj).toEqual({}); // Original unchanged
    });

    it('Property: sets nested values creating intermediate objects', () => {
      const obj = {};
      const result = setNestedValue(obj, 'a/b/c', 42);
      expect(result).toEqual({ a: { b: { c: 42 } } });
    });

    it('Property: sets nested values with slash notation', () => {
      const obj = {};
      const result = setNestedValue(obj, '/a/b/c', 42);
      expect(result).toEqual({ a: { b: { c: 42 } } });
    });

    it('Property: overwrites existing values', () => {
      const obj = { a: { b: 1 } };
      const result = setNestedValue(obj, 'a/b', 2) as { a: { b: number } };
      expect(result.a.b).toBe(2);
    });

    it('Property: preserves other keys', () => {
      const obj = { a: 1, b: 2 };
      const result = setNestedValue(obj, 'c', 3);
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });
  });

  describe('deleteNestedValue', () => {
    it('Property: deletes top-level values', () => {
      const obj = { a: 1, b: 2 };
      const result = deleteNestedValue(obj, 'a');
      expect(result).toEqual({ b: 2 });
      expect(obj).toEqual({ a: 1, b: 2 }); // Original unchanged
    });

    it('Property: deletes nested values', () => {
      const obj = { a: { b: { c: 1, d: 2 } } };
      const result = deleteNestedValue(obj, 'a/b/c');
      expect(result).toEqual({ a: { b: { d: 2 } } });
    });

    it('Property: handles non-existent paths gracefully', () => {
      const obj = { a: 1 };
      const result = deleteNestedValue(obj, 'b/c/d');
      expect(result).toEqual({ a: 1 });
    });

    it('Property: handles non-object intermediate values', () => {
      const obj = { a: 'string' };
      const result = deleteNestedValue(obj, 'a/b');
      expect(result).toEqual({ a: 'string' });
    });
  });

  describe('interpolateString', () => {
    it('Property: replaces ${field} with field values', () => {
      const event = { name: 'John', age: 30 };
      expect(interpolateString(event, 'Hello ${name}')).toBe('Hello John');
      expect(interpolateString(event, '${name} is ${age}')).toBe('John is 30');
    });

    it('Property: handles nested field references', () => {
      const event = { user: { name: 'John' } };
      expect(interpolateString(event, 'Hello ${/user/name}')).toBe('Hello John');
    });

    it('Property: preserves unmatched patterns', () => {
      const event = { name: 'John' };
      expect(interpolateString(event, 'Hello ${unknown}')).toBe('Hello ${unknown}');
    });

    it('Property: handles null/undefined values', () => {
      const event = { name: null };
      expect(interpolateString(event, 'Hello ${name}')).toBe('Hello ${name}');
    });
  });

  describe('interpolateValue', () => {
    it('Property: returns non-string values unchanged', () => {
      fc.assert(
        fc.property(fc.integer(), (value) => {
          expect(interpolateValue({}, value)).toBe(value);
        })
      );
    });

    it('Property: returns strings without ${} unchanged', () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[a-zA-Z0-9 ]*$/), (str) => {
          expect(interpolateValue({}, str)).toBe(str);
        })
      );
    });

    it('Property: preserves type for single field reference', () => {
      const event = { count: 42, flag: true, items: [1, 2, 3] };
      expect(interpolateValue(event, '${count}')).toBe(42);
      expect(interpolateValue(event, '${flag}')).toBe(true);
      expect(interpolateValue(event, '${items}')).toEqual([1, 2, 3]);
    });

    it('Property: returns string for multiple references', () => {
      const event = { a: 1, b: 2 };
      expect(interpolateValue(event, '${a} and ${b}')).toBe('1 and 2');
    });
  });

  describe('evaluateCondition', () => {
    it('Property: evaluates equality comparisons', () => {
      const event = { status: 'active', count: 5 };
      expect(evaluateCondition(event, 'status == "active"')).toBe(true);
      expect(evaluateCondition(event, 'status == "inactive"')).toBe(false);
      expect(evaluateCondition(event, 'count == 5')).toBe(true);
    });

    it('Property: evaluates inequality comparisons', () => {
      const event = { status: 'active', count: 5 };
      expect(evaluateCondition(event, 'status != "inactive"')).toBe(true);
      expect(evaluateCondition(event, 'count != 10')).toBe(true);
    });

    it('Property: evaluates numeric comparisons', () => {
      const event = { count: 5 };
      expect(evaluateCondition(event, 'count > 3')).toBe(true);
      expect(evaluateCondition(event, 'count < 10')).toBe(true);
      expect(evaluateCondition(event, 'count >= 5')).toBe(true);
      expect(evaluateCondition(event, 'count <= 5')).toBe(true);
      expect(evaluateCondition(event, 'count > 10')).toBe(false);
    });

    it('Property: evaluates logical AND', () => {
      const event = { a: 1, b: 2 };
      expect(evaluateCondition(event, 'a == 1 and b == 2')).toBe(true);
      expect(evaluateCondition(event, 'a == 1 and b == 3')).toBe(false);
    });

    it('Property: evaluates logical OR', () => {
      const event = { a: 1, b: 2 };
      expect(evaluateCondition(event, 'a == 1 or b == 3')).toBe(true);
      expect(evaluateCondition(event, 'a == 2 or b == 3')).toBe(false);
    });

    it('Property: evaluates logical NOT', () => {
      const event = { a: 1 };
      expect(evaluateCondition(event, 'not a == 2')).toBe(true);
      expect(evaluateCondition(event, 'not a == 1')).toBe(false);
    });

    it('Property: evaluates field existence', () => {
      const event = { exists: 'value' };
      expect(evaluateCondition(event, 'exists')).toBe(true);
      expect(evaluateCondition(event, 'missing')).toBe(false);
      expect(evaluateCondition(event, '/exists')).toBe(true);
    });

    it('Property: handles boolean literals', () => {
      const event = { flag: true };
      expect(evaluateCondition(event, 'flag == true')).toBe(true);
      expect(evaluateCondition(event, 'flag == false')).toBe(false);
    });

    it('Property: handles null literal', () => {
      const event = { value: null };
      expect(evaluateCondition(event, 'value == null')).toBe(true);
    });

    it('Property: handles single-quoted strings', () => {
      const event = { name: 'test' };
      expect(evaluateCondition(event, "name == 'test'")).toBe(true);
    });

    it('Property: reports unsupported conditions', () => {
      expect(() => evaluateCondition({}, '!@#$%')).toThrow('Unsupported condition');
    });

    it('Property: numeric comparisons return false for non-numbers', () => {
      const event = { a: 'string', b: 5 };
      expect(evaluateCondition(event, 'a > 3')).toBe(false);
      expect(evaluateCondition(event, 'a < 10')).toBe(false);
    });
  });
});
