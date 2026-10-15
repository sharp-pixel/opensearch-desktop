// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Delete Entries Processor
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyDeleteEntries } from '../../services/processors/deleteEntries';

describe('Delete Entries Processor Property Tests', () => {
  describe('Basic deletion', () => {
    it('Property: deletes specified key', () => {
      const event = { a: 1, b: 2, c: 3 };
      const result = applyDeleteEntries(event, { with_keys: ['b'] });
      expect(result.a).toBe(1);
      expect(result.b).toBeUndefined();
      expect(result.c).toBe(3);
    });

    it('Property: deletes multiple keys', () => {
      const event = { a: 1, b: 2, c: 3, d: 4 };
      const result = applyDeleteEntries(event, { with_keys: ['a', 'c'] });
      expect(result.a).toBeUndefined();
      expect(result.b).toBe(2);
      expect(result.c).toBeUndefined();
      expect(result.d).toBe(4);
    });

    it('Property: deletes nested keys', () => {
      const event = { data: { nested: { value: 42 }, other: 'keep' } };
      const result = applyDeleteEntries(event, { with_keys: ['data/nested'] });
      expect((result.data as any).nested).toBeUndefined();
      expect((result.data as any).other).toBe('keep');
    });
  });

  describe('Edge cases', () => {
    it('Property: handles missing key gracefully', () => {
      const event = { a: 1 };
      const result = applyDeleteEntries(event, { with_keys: ['nonexistent'] });
      expect(result).toEqual(event);
    });

    it('Property: handles empty with_keys array', () => {
      const event = { a: 1, b: 2 };
      const result = applyDeleteEntries(event, { with_keys: [] });
      expect(result).toEqual(event);
    });

    it('Property: handles missing with_keys', () => {
      const event = { a: 1 };
      const result = applyDeleteEntries(event, {} as any);
      expect(result).toEqual(event);
    });

    it('Property: handles null with_keys', () => {
      const event = { a: 1 };
      const result = applyDeleteEntries(event, { with_keys: null as any });
      expect(result).toEqual(event);
    });

    it('Property: handles deeply nested deletion', () => {
      const event = { a: { b: { c: { d: 'value' } } } };
      const result = applyDeleteEntries(event, { with_keys: ['a/b/c/d'] });
      expect((result.a as any).b.c.d).toBeUndefined();
    });
  });

  describe('Property-based tests', () => {
    it('Property: deleted key is not in result', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z][a-z0-9]{0,10}$/),
          fc.integer(),
          (key, value) => {
            const event = { [key]: value, other: 'preserved' };
            const result = applyDeleteEntries(event, { with_keys: [key] });
            expect(result[key]).toBeUndefined();
            expect(result.other).toBe('preserved');
          }
        )
      );
    });

    it('Property: non-deleted keys are preserved', () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer(),
          (a, b) => {
            const event = { toDelete: a, toKeep: b };
            const result = applyDeleteEntries(event, { with_keys: ['toDelete'] });
            expect(result.toKeep).toBe(b);
          }
        )
      );
    });
  });
});
