// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Copy Values Processor
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyCopyValues } from '../../services/processors/copyValues';

describe('Copy Values Processor Property Tests', () => {
  describe('Basic copying', () => {
    it('Property: copies value from source to destination', () => {
      const event = { source: 'value', other: 123 };
      const result = applyCopyValues(event, {
        entries: [{ from_key: 'source', to_key: 'dest' }],
      });
      expect(result.dest).toBe('value');
      expect(result.source).toBe('value'); // Original preserved
    });

    it('Property: copies nested values', () => {
      const event = { data: { nested: { value: 42 } } };
      const result = applyCopyValues(event, {
        entries: [{ from_key: 'data/nested/value', to_key: 'copied' }],
      });
      expect(result.copied).toBe(42);
    });

    it('Property: copies to nested destination', () => {
      const event = { source: 'test' };
      const result = applyCopyValues(event, {
        entries: [{ from_key: 'source', to_key: 'dest/nested/value' }],
      });
      expect((result.dest as any).nested.value).toBe('test');
    });

    it('Property: copies multiple entries', () => {
      const event = { a: 1, b: 2, c: 3 };
      const result = applyCopyValues(event, {
        entries: [
          { from_key: 'a', to_key: 'x' },
          { from_key: 'b', to_key: 'y' },
        ],
      });
      expect(result.x).toBe(1);
      expect(result.y).toBe(2);
    });
  });

  describe('Overwrite behavior', () => {
    it('Property: preserves existing key by default', () => {
      const event = { source: 'new', dest: 'old' };
      const result = applyCopyValues(event, {
        entries: [{ from_key: 'source', to_key: 'dest' }],
      });
      expect(result.dest).toBe('old');
    });

    it('Property: respects overwrite_if_to_key_exists=false', () => {
      const event = { source: 'new', dest: 'old' };
      const result = applyCopyValues(event, {
        entries: [{ from_key: 'source', to_key: 'dest', overwrite_if_to_key_exists: false }],
      });
      expect(result.dest).toBe('old');
    });

    it('Property: copies when target missing and overwrite=false', () => {
      const event = { source: 'value' };
      const result = applyCopyValues(event, {
        entries: [{ from_key: 'source', to_key: 'dest', overwrite_if_to_key_exists: false }],
      });
      expect(result.dest).toBe('value');
    });
  });

  describe('Edge cases', () => {
    it('Property: handles missing source key', () => {
      const event = { other: 'value' };
      const result = applyCopyValues(event, {
        entries: [{ from_key: 'missing', to_key: 'dest' }],
      });
      expect(result.dest).toBeUndefined();
      expect(result).toEqual(event);
    });

    it('Property: handles empty entries array', () => {
      const event = { a: 1 };
      const result = applyCopyValues(event, { entries: [] });
      expect(result).toEqual(event);
    });

    it('Property: handles missing entries', () => {
      const event = { a: 1 };
      const result = applyCopyValues(event, {} as any);
      expect(result).toEqual(event);
    });

    it('Property: handles null entries', () => {
      const event = { a: 1 };
      const result = applyCopyValues(event, { entries: null as any });
      expect(result).toEqual(event);
    });

    it('Property: deep clones copied values', () => {
      const event = { source: { nested: { value: 1 } } };
      const result = applyCopyValues(event, {
        entries: [{ from_key: 'source', to_key: 'dest' }],
      });
      
      // Modify original
      (event.source.nested as any).value = 999;
      
      // Copy should be independent
      expect((result.dest as any).nested.value).toBe(1);
    });

    it('Property: copies arrays correctly', () => {
      const event = { arr: [1, 2, 3] };
      const result = applyCopyValues(event, {
        entries: [{ from_key: 'arr', to_key: 'copied' }],
      });
      expect(result.copied).toEqual([1, 2, 3]);
    });
  });

  describe('Property-based tests', () => {
    it('Property: copied value equals source value', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
          (value) => {
            const event = { source: value };
            const result = applyCopyValues(event, {
              entries: [{ from_key: 'source', to_key: 'dest' }],
            });
            expect(result.dest).toEqual(value);
          }
        )
      );
    });

    it('Property: original value is preserved', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (value) => {
            const event = { source: value };
            const result = applyCopyValues(event, {
              entries: [{ from_key: 'source', to_key: 'dest' }],
            });
            expect(result.source).toBe(value);
          }
        )
      );
    });
  });
});
