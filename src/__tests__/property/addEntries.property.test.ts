// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Add Entries Processor
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyAddEntries } from '../../services/processors/addEntries';

describe('Add Entries Processor Property Tests', () => {
  it('list additions do not alias the input or configured values', () => {
    const event = { items: [{ name: 'Ada' }, { name: 'Bob' }] };
    const value = { nested: ['value'] };
    const before = structuredClone(event);
    const result = applyAddEntries(event, { entries: [{ iterate_on: 'items', key: 'added', value }] });
    const items = result.items as { added: { nested: string[] } }[];
    items[0]!.added.nested.push('changed');
    expect(event).toEqual(before);
    expect(value).toEqual({ nested: ['value'] });
    expect(items[1]!.added).toEqual({ nested: ['value'] });
  });

  it('retains field-path protections for dynamically resolved literal list keys', () => {
    const event = { key: '__proto__', items: [{}] };
    expect(() => applyAddEntries(event, { entries: [{ iterate_on: 'items', key: '${/key}', value: { polluted: true } }] })).toThrow('Unsafe field path');
    expect(event.items).toEqual([{}]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  describe('Basic entry addition', () => {
    it('Property: adds simple key-value entries', () => {
      // Use safe key generator that avoids problematic keys:
      // - __proto__, constructor, prototype (prototype pollution)
      // - Empty or whitespace-only keys
      const safeKeyArb = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,20}$/);
      
      fc.assert(
        fc.property(safeKeyArb, fc.integer(), (key, value) => {
          const event = {};
          const result = applyAddEntries(event, {
            entries: [{ key, value }],
          });
          expect(result[key]).toBe(value);
        })
      );
    });

    it('Property: adds multiple entries', () => {
      const event = {};
      const result = applyAddEntries(event, {
        entries: [
          { key: 'a', value: 1 },
          { key: 'b', value: 'two' },
          { key: 'c', value: true },
        ],
      });
      expect(result.a).toBe(1);
      expect(result.b).toBe('two');
      expect(result.c).toBe(true);
    });

    it('Property: adds nested key entries', () => {
      const event = {};
      const result = applyAddEntries(event, {
        entries: [{ key: 'a/b/c', value: 42 }],
      });
      expect((result.a as Record<string, unknown>).b).toEqual({ c: 42 });
    });

    it('Property: preserves existing fields', () => {
      const event = { existing: 'value' };
      const result = applyAddEntries(event, {
        entries: [{ key: 'new', value: 'added' }],
      });
      expect(result.existing).toBe('value');
      expect(result.new).toBe('added');
    });
  });

  describe('Overwrite behavior', () => {
    it('Property: preserves existing keys by default', () => {
      const event = { key: 'original' };
      const result = applyAddEntries(event, {
        entries: [{ key: 'key', value: 'new' }],
      });
      expect(result.key).toBe('original');
    });

    it('Property: respects overwrite_if_key_exists=false', () => {
      const event = { key: 'original' };
      const result = applyAddEntries(event, {
        entries: [{ key: 'key', value: 'new', overwrite_if_key_exists: false }],
      });
      expect(result.key).toBe('original');
    });

    it('Property: adds new key when overwrite_if_key_exists=false and key missing', () => {
      const event = {};
      const result = applyAddEntries(event, {
        entries: [{ key: 'key', value: 'new', overwrite_if_key_exists: false }],
      });
      expect(result.key).toBe('new');
    });
  });

  describe('Formatted values and field expressions', () => {
    it('Property: interpolates ${field} in string values', () => {
      const event = { name: 'John' };
      const result = applyAddEntries(event, {
        entries: [{ key: 'greeting', format: 'Hello ${name}' }],
      });
      expect(result.greeting).toBe('Hello John');
    });

    it('Property: interpolates multiple fields', () => {
      const event = { first: 'John', last: 'Doe' };
      const result = applyAddEntries(event, {
        entries: [{ key: 'full', format: '${first} ${last}' }],
      });
      expect(result.full).toBe('John Doe');
    });

    it('Property: preserves type for single field reference', () => {
      const event = { count: 42 };
      const result = applyAddEntries(event, {
        entries: [{ key: 'copy', value_expression: '/count' }],
      });
      expect(result.copy).toBe(42);
    });

    it('Property: handles nested field interpolation', () => {
      const event = { user: { name: 'John' } };
      const result = applyAddEntries(event, {
        entries: [{ key: 'greeting', format: 'Hello ${/user/name}' }],
      });
      expect(result.greeting).toBe('Hello John');
    });
  });

  describe('Value expression', () => {
    it('Property: evaluates field reference expression', () => {
      const event = { source: 'value' };
      const result = applyAddEntries(event, {
        entries: [{ key: 'dest', value_expression: 'source' }],
      });
      expect(result.dest).toBe('value');
    });

    it('Property: evaluates slash path expression', () => {
      const event = { a: { b: 'nested' } };
      const result = applyAddEntries(event, {
        entries: [{ key: 'dest', value_expression: '/a/b' }],
      });
      expect(result.dest).toBe('nested');
    });

    it('Property: evaluates ${} syntax expression', () => {
      const event = { field: 123 };
      const result = applyAddEntries(event, {
        entries: [{ key: 'dest', value_expression: '${field}' }],
      });
      expect(result.dest).toBe(123);
    });

    it('Property: evaluates numeric literal expressions', () => {
      const event = {};
      const result = applyAddEntries(event, {
        entries: [{ key: 'dest', value_expression: '123' }],
      });
      expect(result.dest).toBe(123);
    });
  });

  describe('Format string', () => {
    it('Property: formats string with field substitution', () => {
      const event = { name: 'John', age: 30 };
      const result = applyAddEntries(event, {
        entries: [{ key: 'info', format: '${name} is ${age} years old' }],
      });
      expect(result.info).toBe('John is 30 years old');
    });

    it('Property: handles missing fields in format', () => {
      const event = { name: 'John' };
      const result = applyAddEntries(event, {
        entries: [{ key: 'info', format: '${name} - ${missing}' }],
      });
      expect(result.info).toBe('John - ');
    });

    it('Property: handles nested fields in format', () => {
      const event = { user: { id: 123 } };
      const result = applyAddEntries(event, {
        entries: [{ key: 'ref', format: 'user-${/user/id}' }],
      });
      expect(result.ref).toBe('user-123');
    });
  });

  describe('Edge cases', () => {
    it('Property: handles empty entries array', () => {
      const event = { a: 1 };
      const result = applyAddEntries(event, { entries: [] });
      expect(result).toEqual({ a: 1 });
    });

    it('Property: handles missing entries', () => {
      const event = { a: 1 };
      const result = applyAddEntries(event, {} as any);
      expect(result).toEqual({ a: 1 });
    });

    it('Property: handles null entries', () => {
      const event = { a: 1 };
      const result = applyAddEntries(event, { entries: null as any });
      expect(result).toEqual({ a: 1 });
    });

    it('Property: handles non-array entries', () => {
      const event = { a: 1 };
      const result = applyAddEntries(event, { entries: 'invalid' as any });
      expect(result).toEqual({ a: 1 });
    });

    it('Property: handles null value', () => {
      const event = {};
      const result = applyAddEntries(event, {
        entries: [{ key: 'nullKey', value: null }],
      });
      expect(result.nullKey).toBeNull();
    });

    it('Property: handles undefined value', () => {
      const event = {};
      const result = applyAddEntries(event, {
        entries: [{ key: 'undefinedKey', value: undefined }],
      });
      expect(result.undefinedKey).toBeUndefined();
    });

    it('Property: handles object value', () => {
      const event = {};
      const result = applyAddEntries(event, {
        entries: [{ key: 'obj', value: { nested: true } }],
      });
      expect(result.obj).toEqual({ nested: true });
    });

    it('Property: handles array value', () => {
      const event = {};
      const result = applyAddEntries(event, {
        entries: [{ key: 'arr', value: [1, 2, 3] }],
      });
      expect(result.arr).toEqual([1, 2, 3]);
    });
  });
});
