// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for PPL Index Extraction
 * Property 5: PPL Index Extraction Correctness
 * Validates: Requirements 6.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractPPLIndex } from '../../services/queryExecutor';

describe('Property 5: PPL Index Extraction Correctness', () => {
  /**
   * Property: Index name should be extracted correctly from source clause
   */
  it('should extract index name from source clause', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9\-]*$/),
        (indexName) => {
          const query = `source=${indexName}`;
          const extracted = extractPPLIndex(query);
          expect(extracted).toBe(indexName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Index pattern with wildcard should be extracted correctly
   */
  it('should extract index pattern with wildcard', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9\-]*$/),
        (prefix) => {
          const indexPattern = `${prefix}-*`;
          const query = `source=${indexPattern} | where status > 400`;
          const extracted = extractPPLIndex(query);
          expect(extracted).toBe(indexPattern);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Index should be extracted regardless of case
   */
  it('should extract index regardless of SOURCE keyword case', () => {
    const cases = ['source', 'SOURCE', 'Source', 'SoUrCe'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...cases),
        fc.stringMatching(/^[a-z][a-z0-9\-]*$/),
        (sourceKeyword, indexName) => {
          const query = `${sourceKeyword}=${indexName}`;
          const extracted = extractPPLIndex(query);
          expect(extracted).toBe(indexName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Index should be extracted with spaces around equals sign
   */
  it('should extract index with spaces around equals sign', () => {
    const spacings = ['=', ' =', '= ', ' = '];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...spacings),
        fc.stringMatching(/^[a-z][a-z0-9\-]*$/),
        (spacing, indexName) => {
          const query = `source${spacing}${indexName}`;
          const extracted = extractPPLIndex(query);
          expect(extracted).toBe(indexName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Index should be extracted from complex queries
   */
  it('should extract index from complex PPL queries', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9\-]*$/),
        (indexName) => {
          const queries = [
            `source=${indexName} | where status > 400`,
            `source=${indexName} | stats count() by host`,
            `source=${indexName} | fields name, age | head 10`,
            `source=${indexName} | sort - @timestamp | tail 5`,
            `source=${indexName} | dedup host | stats count()`,
          ];
          
          for (const query of queries) {
            const extracted = extractPPLIndex(query);
            expect(extracted).toBe(indexName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Should return null for queries without source clause
   */
  it('should return null for queries without source clause', () => {
    const queriesWithoutSource = [
      '',
      'where status > 400',
      '| stats count()',
      'fields name, age',
    ];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...queriesWithoutSource),
        (query) => {
          const extracted = extractPPLIndex(query);
          expect(extracted).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Should handle index names with dots
   */
  it('should extract index names with dots', () => {
    const indexNames = ['logs.2024', 'app.logs.prod', 'metrics.cpu.usage'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...indexNames),
        (indexName) => {
          const query = `source=${indexName} | head 10`;
          const extracted = extractPPLIndex(query);
          expect(extracted).toBe(indexName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Should stop at pipe character
   */
  it('should stop extraction at pipe character', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9\-]*$/),
        (indexName) => {
          const query = `source=${indexName}|where x > 1`;
          const extracted = extractPPLIndex(query);
          expect(extracted).toBe(indexName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Should stop at whitespace
   */
  it('should stop extraction at whitespace', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9\-]*$/),
        (indexName) => {
          const query = `source=${indexName} | where x > 1`;
          const extracted = extractPPLIndex(query);
          expect(extracted).toBe(indexName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
