// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Rename Keys Processor
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyRenameKeys } from '../../services/processors/renameKeys';

describe('Rename Keys Processor Property Tests', () => {
  describe('Basic renaming', () => {
    it('Property: renames key from source to destination', () => {
      const event = { oldName: 'value', other: 123 };
      const result = applyRenameKeys(event, {
        entries: [{ from_key: 'oldName', to_key: 'newName' }],
      });
      expect(result.newName).toBe('value');
      expect(result.oldName).toBeUndefined();
      expect(result.other).toBe(123);
    });

    it('Property: renames nested keys', () => {
      const event = { data: { oldKey: 42 } };
      const result = applyRenameKeys(event, {
        entries: [{ from_key: 'data/oldKey', to_key: 'data/newKey' }],
      });
      expect((result.data as any).newKey).toBe(42);
      expect((result.data as any).oldKey).toBeUndefined();
    });

    it('Property: renames to nested destination', () => {
      const event = { source: 'test' };
      const result = applyRenameKeys(event, {
        entries: [{ from_key: 'source', to_key: 'dest/nested/value' }],
      });
      expect((result.dest as any).nested.value).toBe('test');
      expect(result.source).toBeUndefined();
    });

    it('Property: renames multiple entries', () => {
      const event = { a: 1, b: 2 };
      const result = applyRenameKeys(event, {
        entries: [
          { from_key: 'a', to_key: 'x' },
          { from_key: 'b', to_key: 'y' },
        ],
      });
      expect(result.x).toBe(1);
      expect(result.y).toBe(2);
      expect(result.a).toBeUndefined();
      expect(result.b).toBeUndefined();
    });
  });

  describe('Overwrite behavior', () => {
    it('Property: does not overwrite existing key by default', () => {
      const event = { source: 'new', dest: 'old' };
      const result = applyRenameKeys(event, {
        entries: [{ from_key: 'source', to_key: 'dest' }],
      });
      expect(result.dest).toBe('old');
      expect(result.source).toBe('new'); // Not renamed
    });

    it('Property: overwrites when overwrite_if_to_key_exists=true', () => {
      const event = { source: 'new', dest: 'old' };
      const result = applyRenameKeys(event, {
        entries: [{ from_key: 'source', to_key: 'dest', overwrite_if_to_key_exists: true }],
      });
      expect(result.dest).toBe('new');
      expect(result.source).toBeUndefined();
    });

    it('Property: renames when target missing and overwrite=false', () => {
      const event = { source: 'value' };
      const result = applyRenameKeys(event, {
        entries: [{ from_key: 'source', to_key: 'dest', overwrite_if_to_key_exists: false }],
      });
      expect(result.dest).toBe('value');
      expect(result.source).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('Property: handles missing source key', () => {
      const event = { other: 'value' };
      const result = applyRenameKeys(event, {
        entries: [{ from_key: 'missing', to_key: 'dest' }],
      });
      expect(result.dest).toBeUndefined();
      expect(result).toEqual(event);
    });

    it('Property: handles empty entries array', () => {
      const event = { a: 1 };
      const result = applyRenameKeys(event, { entries: [] });
      expect(result).toEqual(event);
    });

    it('Property: handles missing entries', () => {
      const event = { a: 1 };
      const result = applyRenameKeys(event, {} as any);
      expect(result).toEqual(event);
    });

    it('Property: handles null entries', () => {
      const event = { a: 1 };
      const result = applyRenameKeys(event, { entries: null as any });
      expect(result).toEqual(event);
    });
  });

  describe('Property-based tests', () => {
    it('Property: renamed value equals original value', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.string(), fc.integer(), fc.boolean()),
          (value) => {
            const event = { source: value };
            const result = applyRenameKeys(event, {
              entries: [{ from_key: 'source', to_key: 'dest' }],
            });
            expect(result.dest).toEqual(value);
            expect(result.source).toBeUndefined();
          }
        )
      );
    });

    it('Property: other keys are preserved', () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.integer(),
          (a, b) => {
            const event = { toRename: a, toKeep: b };
            const result = applyRenameKeys(event, {
              entries: [{ from_key: 'toRename', to_key: 'renamed' }],
            });
            expect(result.toKeep).toBe(b);
          }
        )
      );
    });
  });
});
