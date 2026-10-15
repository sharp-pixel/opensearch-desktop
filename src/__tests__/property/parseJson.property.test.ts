// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Parse JSON Processor
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyParseJson } from '../../services/processors/parseJson';

describe('Parse JSON Processor Property Tests', () => {
  describe('Basic parsing', () => {
    it('Property: parses valid JSON from message field by default', () => {
      fc.assert(
        fc.property(
          fc.record({ key: fc.string(), value: fc.integer() }),
          (data) => {
            const event = { message: JSON.stringify(data) };
            const result = applyParseJson(event, {});
            expect(result.key).toBe(data.key);
            expect(result.value).toBe(data.value);
          }
        )
      );
    });

    it('Property: parses JSON from custom source field', () => {
      const event = { data: '{"name":"test","count":42}' };
      const result = applyParseJson(event, { source: 'data' });
      expect(result.name).toBe('test');
      expect(result.count).toBe(42);
    });

    it('Property: returns unchanged event for invalid JSON', () => {
      const event = { message: 'not valid json' };
      const result = applyParseJson(event, {});
      expect(result).toEqual(event);
    });

    it('Property: returns unchanged event for non-string source', () => {
      const event = { message: 123 };
      const result = applyParseJson(event, {});
      expect(result).toEqual(event);
    });

    it('Property: returns unchanged event for undefined source', () => {
      const event = { other: 'value' };
      const result = applyParseJson(event, { source: 'message' });
      expect(result).toEqual(event);
    });
  });

  describe('Destination handling', () => {
    it('Property: writes to root when no destination specified', () => {
      const event = { message: '{"a":1,"b":2}' };
      const result = applyParseJson(event, {});
      expect(result.a).toBe(1);
      expect(result.b).toBe(2);
      expect(result.message).toBe('{"a":1,"b":2}');
    });

    it('Property: writes to specified destination', () => {
      const event = { message: '{"a":1,"b":2}' };
      const result = applyParseJson(event, { destination: 'parsed' });
      expect(result.parsed).toEqual({ a: 1, b: 2 });
      expect(result.message).toBe('{"a":1,"b":2}');
    });

    it('Property: writes to nested destination', () => {
      const event = { message: '{"value":42}' };
      const result = applyParseJson(event, { destination: 'data/parsed' });
      expect((result.data as Record<string, unknown>).parsed).toEqual({ value: 42 });
    });

    it('Property: respects overwrite_if_destination_exists=false', () => {
      const event = { message: '{"a":1}', a: 'original' };
      const result = applyParseJson(event, { overwrite_if_destination_exists: false });
      expect(result.a).toBe('original');
    });

    it('Property: overwrites by default', () => {
      const event = { message: '{"a":1}', a: 'original' };
      const result = applyParseJson(event, {});
      expect(result.a).toBe(1);
    });

    it('Property: respects overwrite for named destination', () => {
      const event = { message: '{"x":1}', dest: 'original' };
      const result = applyParseJson(event, { 
        destination: 'dest', 
        overwrite_if_destination_exists: false 
      });
      expect(result.dest).toBe('original');
    });
  });

  describe('JSON pointer', () => {
    it('Property: extracts value at pointer path', () => {
      const event = { message: '{"data":{"nested":{"value":42}}}' };
      const result = applyParseJson(event, { pointer: '/data/nested/value' });
      // Pointer extraction writes the final field name to root.
      expect(result.value).toBe(42);
      expect(result.message).toBe('{"data":{"nested":{"value":42}}}');
    });

    it('Property: extracts value at pointer with destination', () => {
      const event = { message: '{"data":{"nested":{"value":42}}}' };
      const result = applyParseJson(event, { pointer: '/data/nested/value', destination: 'val' });
      expect(result.val).toEqual({ value: 42 });
    });

    it('Property: handles array indices in pointer', () => {
      const event = { message: '{"items":[1,2,3]}' };
      const result = applyParseJson(event, { pointer: '/items/1', destination: 'item' });
      expect(result.item).toEqual({ 'items.1': 2 });
    });

    it('Property: handles invalid array index by falling back', () => {
      const event = { message: '{"items":[1,2,3]}' };
      const result = applyParseJson(event, { pointer: '/items/10' });
      // Falls back to parsing entire source when pointer is invalid
      expect(result.items).toEqual([1, 2, 3]);
    });

    it('Property: handles root pointer', () => {
      const event = { message: '{"a":1}' };
      const result = applyParseJson(event, { pointer: '/' });
      expect(result.a).toBe(1);
    });

    it('Property: handles empty pointer', () => {
      const event = { message: '{"a":1}' };
      const result = applyParseJson(event, { pointer: '' });
      expect(result.a).toBe(1);
    });

    it('Property: handles invalid pointer path', () => {
      const event = { message: '{"a":1}' };
      const result = applyParseJson(event, { pointer: '/nonexistent/path' });
      // Falls back to parsing entire source
      expect(result.a).toBe(1);
    });

    it('Property: handles pointer through non-object', () => {
      const event = { message: '{"a":"string"}' };
      const result = applyParseJson(event, { pointer: '/a/b' });
      // Falls back to parsing entire source
      expect(result.a).toBe('string');
    });
  });

  describe('Depth limiting', () => {
    it('Property: limits depth of parsed JSON', () => {
      const event = { message: '{"a":{"b":{"c":1}}}' };
      const result = applyParseJson(event, { depth: 1 });
      expect(result.a).toBe('{"b":{"c":1}}');
    });

    it('Property: depth 0 means no limit', () => {
      const event = { message: '{"a":{"b":{"c":1}}}' };
      const result = applyParseJson(event, { depth: 0 });
      expect(result.a).toEqual({ b: { c: 1 } });
    });

    it('Property: depth 2 stringifies at level 2', () => {
      const event = { message: '{"a":{"b":{"c":1}}}' };
      const result = applyParseJson(event, { depth: 2 });
      expect((result.a as Record<string, unknown>).b).toBe('{"c":1}');
    });

    it('Property: handles arrays with depth limit', () => {
      const event = { message: '{"items":[{"nested":1}]}' };
      const result = applyParseJson(event, { depth: 1 });
      expect(result.items).toEqual([{ nested: 1 }]);
    });

    it('Property: preserves primitives at depth limit', () => {
      const event = { message: '{"a":{"b":42}}' };
      const result = applyParseJson(event, { depth: 2 });
      expect((result.a as Record<string, unknown>).b).toBe(42);
    });
  });

  describe('Delete source', () => {
    it('Property: deletes source field when configured', () => {
      const event = { message: '{"a":1}' };
      const result = applyParseJson(event, { delete_source: true });
      expect(result.a).toBe(1);
      expect(result.message).toBeUndefined();
    });

    it('Property: preserves source field by default', () => {
      const event = { message: '{"a":1}' };
      const result = applyParseJson(event, {});
      expect(result.message).toBe('{"a":1}');
    });
  });

  describe('Edge cases', () => {
    it('Property: handles JSON arrays at root with destination', () => {
      const event = { message: '[1,2,3]' };
      const result = applyParseJson(event, { destination: 'arr' });
      expect(result.arr).toEqual([1, 2, 3]);
    });

    it('Property: handles JSON arrays at root without destination', () => {
      // Arrays at root without destination don't merge into object
      const event = { message: '[1,2,3]' };
      const result = applyParseJson(event, {});
      // Array is not an object, so nothing is merged
      expect(result.message).toBe('[1,2,3]');
    });

    it('Property: handles JSON primitives with destination', () => {
      const event = { message: '"string"' };
      const result = applyParseJson(event, { destination: 'val' });
      expect(result.val).toBe('string');
    });

    it('Property: passes JSON null through unchanged like upstream', () => {
      const event = { message: 'null' };
      const result = applyParseJson(event, { destination: 'val' });
      expect(result).toEqual(event);
    });

    it('Property: handles empty JSON object', () => {
      const event = { message: '{}' };
      const result = applyParseJson(event, {});
      expect(result.message).toBe('{}');
    });

    it('Property: handles nested source field', () => {
      const event = { data: { json: '{"x":1}' } };
      const result = applyParseJson(event, { source: 'data/json' });
      expect(result.x).toBe(1);
    });
  });
});
