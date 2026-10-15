// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Split String Processor
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applySplitString } from '../../services/processors/splitString';

describe('Split String Processor Property Tests', () => {
  describe('Basic splitting', () => {
    it('Property: splits string by delimiter', () => {
      const event = { message: 'a,b,c' };
      const result = applySplitString(event, {
        entries: [{ source: 'message', delimiter: ',' }],
      });
      expect(result.message).toEqual(['a', 'b', 'c']);
    });

    it('Property: splits by space delimiter', () => {
      const event = { text: 'hello world test' };
      const result = applySplitString(event, {
        entries: [{ source: 'text', delimiter: ' ' }],
      });
      expect(result.text).toEqual(['hello', 'world', 'test']);
    });

    it('Property: splits by pipe delimiter', () => {
      const event = { data: 'a|b|c' };
      const result = applySplitString(event, {
        entries: [{ source: 'data', delimiter: '|' }],
      });
      expect(result.data).toEqual(['a', 'b', 'c']);
    });

    it('Property: splits nested field', () => {
      const event = { data: { csv: '1,2,3' } };
      const result = applySplitString(event, {
        entries: [{ source: 'data/csv', delimiter: ',' }],
      });
      expect((result.data as any).csv).toEqual(['1', '2', '3']);
    });
  });

  describe('Regex delimiter', () => {
    it('Property: splits by regex pattern', () => {
      const event = { message: 'a1b2c3d' };
      const result = applySplitString(event, {
        entries: [{ source: 'message', delimiter_regex: '\\d' }],
      });
      expect(result.message).toEqual(['a', 'b', 'c', 'd']);
    });

    it('Property: splits by whitespace regex', () => {
      const event = { text: 'a  b\tc\nd' };
      const result = applySplitString(event, {
        entries: [{ source: 'text', delimiter_regex: '\\s+' }],
      });
      expect(result.text).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('Special characters', () => {
    it('Property: escapes special regex characters in delimiter', () => {
      const event = { message: 'a.b.c' };
      const result = applySplitString(event, {
        entries: [{ source: 'message', delimiter: '.' }],
      });
      expect(result.message).toEqual(['a', 'b', 'c']);
    });

    it('Property: escapes asterisk in delimiter', () => {
      const event = { message: 'a*b*c' };
      const result = applySplitString(event, {
        entries: [{ source: 'message', delimiter: '*' }],
      });
      expect(result.message).toEqual(['a', 'b', 'c']);
    });

    it('Property: escapes plus in delimiter', () => {
      const event = { message: 'a+b+c' };
      const result = applySplitString(event, {
        entries: [{ source: 'message', delimiter: '+' }],
      });
      expect(result.message).toEqual(['a', 'b', 'c']);
    });

    it('Property: escapes brackets in delimiter', () => {
      const event = { message: 'a[b[c' };
      const result = applySplitString(event, {
        entries: [{ source: 'message', delimiter: '[' }],
      });
      expect(result.message).toEqual(['a', 'b', 'c']);
    });

    it('Property: escapes backslash in delimiter', () => {
      const event = { message: 'a\\b\\c' };
      const result = applySplitString(event, {
        entries: [{ source: 'message', delimiter: '\\' }],
      });
      expect(result.message).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Edge cases', () => {
    it('Property: handles missing source field', () => {
      const event = { other: 'value' };
      const result = applySplitString(event, {
        entries: [{ source: 'missing', delimiter: ',' }],
      });
      expect(result).toEqual(event);
    });

    it('Property: handles non-string source', () => {
      const event = { num: 123 };
      const result = applySplitString(event, {
        entries: [{ source: 'num', delimiter: ',' }],
      });
      expect(result).toEqual(event);
    });

    it('Property: handles missing delimiter', () => {
      const event = { message: 'a,b,c' };
      const result = applySplitString(event, {
        entries: [{ source: 'message' }],
      });
      expect(result.message).toBe('a,b,c'); // Unchanged
    });

    it('Property: handles empty string', () => {
      const event = { message: '' };
      const result = applySplitString(event, {
        entries: [{ source: 'message', delimiter: ',' }],
      });
      expect(result.message).toEqual(['']);
    });

    it('Property: handles string without delimiter', () => {
      const event = { message: 'nodelmiter' };
      const result = applySplitString(event, {
        entries: [{ source: 'message', delimiter: ',' }],
      });
      expect(result.message).toEqual(['nodelmiter']);
    });

    it('Property: handles multiple entries', () => {
      const event = { a: '1,2,3', b: 'x|y|z' };
      const result = applySplitString(event, {
        entries: [
          { source: 'a', delimiter: ',' },
          { source: 'b', delimiter: '|' },
        ],
      });
      expect(result.a).toEqual(['1', '2', '3']);
      expect(result.b).toEqual(['x', 'y', 'z']);
    });
  });

  describe('Property-based tests', () => {
    it('Property: split result is always an array', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (value) => {
            const event = { message: value };
            const result = applySplitString(event, {
              entries: [{ source: 'message', delimiter: ',' }],
            });
            expect(Array.isArray(result.message)).toBe(true);
          }
        )
      );
    });

    it('Property: joining split result with delimiter gives original', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1 }).filter(s => !s.includes(',')), { minLength: 1, maxLength: 5 }),
          (parts) => {
            const original = parts.join(',');
            const event = { message: original };
            const result = applySplitString(event, {
              entries: [{ source: 'message', delimiter: ',' }],
            });
            expect((result.message as string[]).join(',')).toBe(original);
          }
        )
      );
    });
  });
});
