// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Truncate Processor
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyTruncate } from '../../services/processors/truncate';

describe('Truncate Processor Property Tests', () => {
  describe('Basic truncation', () => {
    it('Property: truncates string to specified length', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10 }),
          fc.integer({ min: 1, max: 5 }),
          (str, length) => {
            const event = { message: str };
            const result = applyTruncate(event, {
              entries: [{ source_keys: ['message'], length }],
            });
            expect((result.message as string).length).toBeLessThanOrEqual(length);
          }
        )
      );
    });

    it('Property: truncates from start_at position', () => {
      const event = { message: 'Hello World' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['message'], start_at: 6 }],
      });
      expect(result.message).toBe('World');
    });

    it('Property: truncates with both start_at and length', () => {
      const event = { message: 'Hello World' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['message'], start_at: 0, length: 5 }],
      });
      expect(result.message).toBe('Hello');
    });

    it('Property: handles start_at beyond string length', () => {
      const event = { message: 'Hi' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['message'], start_at: 10 }],
      });
      expect(result.message).toBe('Hi');
    });

    it('Property: handles length beyond remaining string', () => {
      const event = { message: 'Hello' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['message'], start_at: 2, length: 100 }],
      });
      expect(result.message).toBe('llo');
    });
  });

  describe('Source keys', () => {
    it('Property: truncates specific source keys', () => {
      const event = { a: 'Hello World', b: 'Goodbye World' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['a'], length: 5 }],
      });
      expect(result.a).toBe('Hello');
      expect(result.b).toBe('Goodbye World');
    });

    it('Property: truncates multiple source keys', () => {
      const event = { a: 'Hello World', b: 'Goodbye World' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['a', 'b'], length: 5 }],
      });
      expect(result.a).toBe('Hello');
      expect(result.b).toBe('Goodb');
    });

    it('Property: truncates nested source keys', () => {
      const event = { data: { message: 'Hello World' } };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['data/message'], length: 5 }],
      });
      expect((result.data as Record<string, unknown>).message).toBe('Hello');
    });

    it('Property: handles missing source keys', () => {
      const event = { a: 'Hello' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['missing'], length: 3 }],
      });
      expect(result).toEqual({ a: 'Hello' });
    });
  });

  describe('All fields truncation', () => {
    it('Property: truncates all string fields when no source_keys', () => {
      const event = { a: 'Hello World', b: 'Goodbye World', c: 123 };
      const result = applyTruncate(event, {
        entries: [{ length: 5 }],
      });
      expect(result.a).toBe('Hello');
      expect(result.b).toBe('Goodb');
      expect(result.c).toBe(123); // Non-string unchanged
    });

    it('Property: preserves all fields with empty source_keys array', () => {
      const event = { a: 'Hello World', b: 'Test' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: [], length: 3 }],
      });
      expect(result.a).toBe('Hello World');
      expect(result.b).toBe('Test');
    });
  });

  describe('Array handling', () => {
    it('Property: truncates strings in arrays', () => {
      const event = { items: ['Hello World', 'Goodbye World'] };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['items'], length: 5 }],
      });
      expect(result.items).toEqual(['Hello', 'Goodb']);
    });

    it('Property: preserves non-strings in arrays', () => {
      const event = { items: ['Hello', 123, 'World'] };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['items'], length: 3 }],
      });
      expect(result.items).toEqual(['Hel', 123, 'Wor']);
    });
  });

  describe('Recursive truncation', () => {
    it('Property: truncates nested objects recursively', () => {
      const event = { 
        data: { 
          name: 'Hello World',
          nested: { value: 'Goodbye World' }
        } 
      };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['data'], length: 5, recursive: true }],
      });
      const data = result.data as Record<string, unknown>;
      expect(data.name).toBe('Hello');
      expect((data.nested as Record<string, unknown>).value).toBe('Goodb');
    });

    it('Property: does not recurse when recursive=false', () => {
      const event = { 
        data: { 
          name: 'Hello World',
          nested: { value: 'Goodbye World' }
        } 
      };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['data'], length: 5, recursive: false }],
      });
      // Object is returned as-is since it's not a string
      expect(result.data).toEqual(event.data);
    });
  });

  describe('Multiple entries', () => {
    it('Property: applies multiple truncation entries', () => {
      const event = { a: 'Hello World', b: 'Goodbye World' };
      const result = applyTruncate(event, {
        entries: [
          { source_keys: ['a'], length: 5 },
          { source_keys: ['b'], start_at: 8 },
        ],
      });
      expect(result.a).toBe('Hello');
      expect(result.b).toBe('World');
    });
  });

  describe('Edge cases', () => {
    it('Property: skips entries without start_at or length', () => {
      const event = { message: 'Hello World' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['message'] }],
      });
      expect(result.message).toBe('Hello World');
    });

    it('Property: handles empty string', () => {
      const event = { message: '' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['message'], length: 5 }],
      });
      expect(result.message).toBe('');
    });

    it('Property: handles empty entries array', () => {
      const event = { message: 'Hello' };
      const result = applyTruncate(event, { entries: [] });
      expect(result).toEqual(event);
    });

    it('Property: handles non-string, non-array values', () => {
      const event = { num: 12345, bool: true, obj: { a: 1 } };
      const result = applyTruncate(event, {
        entries: [{ length: 2 }],
      });
      expect(result.num).toBe(12345);
      expect(result.bool).toBe(true);
      expect(result.obj).toEqual({ a: 1 });
    });

    it('Property: handles null values', () => {
      const event = { value: null };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['value'], length: 5 }],
      });
      expect(result.value).toBeNull();
    });

    it('Property: default start_at is 0', () => {
      const event = { message: 'Hello' };
      const result = applyTruncate(event, {
        entries: [{ source_keys: ['message'], length: 3 }],
      });
      expect(result.message).toBe('Hel');
    });

    it('Property: preserves original event immutability', () => {
      const event = { message: 'Hello World' };
      const original = { ...event };
      applyTruncate(event, {
        entries: [{ source_keys: ['message'], length: 5 }],
      });
      expect(event).toEqual(original);
    });
  });
});
