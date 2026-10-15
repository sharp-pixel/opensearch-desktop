// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Endpoint Parser
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseEndpoint,
  extractIndexPatterns,
  isIndexOperation,
  isClusterOperation,
  normalizeEndpoint,
} from '../../services/endpointParser';

describe('Endpoint Parser Property Tests', () => {
  describe('parseEndpoint', () => {
    it('Property: parses simple index endpoint', () => {
      const result = parseEndpoint('/my-index/_search');
      expect(result.type).toBe('index');
      expect(result.indexPattern).toBe('my-index');
    });

    it('Property: parses endpoint with document ID', () => {
      const result = parseEndpoint('/my-index/_doc/123');
      expect(result.type).toBe('index');
      expect(result.indexPattern).toBe('my-index');
      expect(result.normalizedPath).toBe('/my-index/_doc/{id}');
    });

    it('Property: parses cluster-level endpoints', () => {
      const result = parseEndpoint('/_cluster/health');
      expect(result.type).toBe('cluster');
      expect(result.indexPattern).toBeUndefined();
    });

    it('Property: parses cat API endpoints', () => {
      const result = parseEndpoint('/_cat/indices');
      expect(result.type).toBe('cluster');
    });

    it('Property: parses bulk endpoint', () => {
      const result = parseEndpoint('/_bulk');
      expect(result.type).toBe('index');
    });

    it('Property: handles query parameters', () => {
      const result = parseEndpoint('/my-index/_search?q=test&size=10');
      expect(result.type).toBe('index');
      expect(result.indexPattern).toBe('my-index');
    });

    it('Property: handles multiple indices', () => {
      const result = parseEndpoint('/index1,index2/_search');
      expect(result.type).toBe('index');
      expect(result.indexPattern).toBe('index1,index2');
    });

    it('Property: handles wildcard indices', () => {
      const result = parseEndpoint('/logs-*/_search');
      expect(result.type).toBe('index');
      expect(result.indexPattern).toBe('logs-*');
    });

    it('Property: handles root endpoint', () => {
      const result = parseEndpoint('/');
      expect(result.type).toBe('unknown');
    });

    it('Property: handles index-only endpoint', () => {
      const result = parseEndpoint('/my-index');
      expect(result.type).toBe('index');
      expect(result.indexPattern).toBe('my-index');
    });
  });

  describe('extractIndexPatterns', () => {
    it('Property: extracts index from search endpoint', () => {
      const patterns = extractIndexPatterns('/my-index/_search');
      expect(patterns).toEqual(['my-index']);
    });

    it('Property: extracts index from doc endpoint', () => {
      const patterns = extractIndexPatterns('/my-index/_doc/123');
      expect(patterns).toEqual(['my-index']);
    });

    it('Property: returns empty for cluster endpoints', () => {
      const patterns = extractIndexPatterns('/_cluster/health');
      expect(patterns).toEqual([]);
    });

    it('Property: returns empty for cat endpoints', () => {
      const patterns = extractIndexPatterns('/_cat/indices');
      expect(patterns).toEqual([]);
    });

    it('Property: handles index patterns', () => {
      const patterns = extractIndexPatterns('/logs-2024-*/_search');
      expect(patterns).toEqual(['logs-2024-*']);
    });

    it('Property: handles comma-separated indices', () => {
      const patterns = extractIndexPatterns('/idx1,idx2,idx3/_search');
      expect(patterns).toEqual(['idx1', 'idx2', 'idx3']);
    });
  });

  describe('isIndexOperation', () => {
    it('Property: returns true for index operations', () => {
      expect(isIndexOperation('/my-index/_search')).toBe(true);
      expect(isIndexOperation('/my-index/_doc/123')).toBe(true);
      expect(isIndexOperation('/my-index/_bulk')).toBe(true);
      expect(isIndexOperation('/my-index/_mapping')).toBe(true);
    });

    it('Property: returns false for cluster operations', () => {
      expect(isIndexOperation('/_cluster/health')).toBe(false);
      expect(isIndexOperation('/_cat/indices')).toBe(false);
      expect(isIndexOperation('/_nodes/stats')).toBe(false);
    });

    it('Property: returns false for root endpoint', () => {
      expect(isIndexOperation('/')).toBe(false);
    });
  });

  describe('isClusterOperation', () => {
    it('Property: returns true for cluster operations', () => {
      expect(isClusterOperation('/_cluster/health')).toBe(true);
      expect(isClusterOperation('/_cat/indices')).toBe(true);
      expect(isClusterOperation('/_nodes/stats')).toBe(true);
      expect(isClusterOperation('/_bulk')).toBe(false);
    });

    it('Property: returns false for index operations', () => {
      expect(isClusterOperation('/my-index/_search')).toBe(false);
      expect(isClusterOperation('/my-index/_doc/123')).toBe(false);
    });
  });

  describe('normalizeEndpoint', () => {
    it('Property: normalizes document IDs', () => {
      expect(normalizeEndpoint('/index/_doc/abc123')).toBe('/index/_doc/{id}');
      expect(normalizeEndpoint('/index/_create/xyz')).toBe('/index/_create/{id}');
      expect(normalizeEndpoint('/index/_update/123')).toBe('/index/_update/{id}');
    });

    it('Property: removes query parameters', () => {
      expect(normalizeEndpoint('/index/_search?q=test')).toBe('/index/_search');
    });

    it('Property: adds leading slash if missing', () => {
      expect(normalizeEndpoint('index/_search')).toBe('/index/_search');
    });
  });

  describe('Property-based tests', () => {
    it('Property: valid index names are extracted correctly', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
          (indexName) => {
            const endpoint = `/${indexName}/_search`;
            const patterns = extractIndexPatterns(endpoint);
            expect(patterns).toEqual([indexName]);
          }
        )
      );
    });

    it('Property: parseEndpoint always returns an object', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          (endpoint) => {
            const result = parseEndpoint(endpoint);
            expect(typeof result).toBe('object');
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('normalizedPath');
          }
        )
      );
    });
  });
});
