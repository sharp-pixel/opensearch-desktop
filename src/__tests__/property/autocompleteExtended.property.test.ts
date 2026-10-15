// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Extended Property-based tests for Autocomplete Provider
 * Tests parseJsonContext, getAllowedMethods, isMethodAllowed, and AutocompleteProvider class
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { HttpMethod } from '../../types/cell';
import {
  parseJsonContext,
  getAllowedMethods,
  isMethodAllowed,
  createAutocompleteProvider,
  ENDPOINT_REGISTRY,
} from '../../services/autocompleteProvider';

describe('Autocomplete Provider Extended Tests', () => {
  describe('parseJsonContext', () => {
    it('returns root context for empty string', () => {
      const context = parseJsonContext('', 0);
      expect(context.path).toEqual([]);
      expect(context.parentKey).toBeUndefined();
      expect(context.isValue).toBe(false);
    });

    it('returns root context for opening brace', () => {
      const context = parseJsonContext('{', 1);
      expect(context.path).toEqual([]);
      expect(context.isValue).toBe(false);
    });

    it('detects query context', () => {
      const json = '{"query": {';
      const context = parseJsonContext(json, json.length);
      expect(context.path).toContain('query');
    });

    it('detects bool context inside query', () => {
      const json = '{"query": {"bool": {';
      const context = parseJsonContext(json, json.length);
      expect(context.path).toContain('query');
      expect(context.path).toContain('bool');
    });

    it('detects aggs context', () => {
      const json = '{"aggs": {';
      const context = parseJsonContext(json, json.length);
      expect(context.path).toContain('aggs');
    });

    it('detects value position after colon', () => {
      const json = '{"size": ';
      const context = parseJsonContext(json, json.length);
      expect(context.isValue).toBe(true);
    });

    it('detects key position after comma', () => {
      const json = '{"size": 10, ';
      const context = parseJsonContext(json, json.length);
      expect(context.isValue).toBe(false);
    });

    it('handles nested objects correctly', () => {
      const json = '{"query": {"bool": {"must": [{"match": {';
      const context = parseJsonContext(json, json.length);
      expect(context.path.length).toBeGreaterThan(0);
    });

    it('handles closing braces correctly', () => {
      const json = '{"query": {"match_all": {}}, "size": ';
      const context = parseJsonContext(json, json.length);
      expect(context.isValue).toBe(true);
    });

    it('handles strings with escaped quotes', () => {
      const json = '{"field": "value with \\"quotes\\"", "other": ';
      const context = parseJsonContext(json, json.length);
      expect(context.isValue).toBe(true);
    });

    it('Property: cursor position within bounds produces valid context', () => {
      fc.assert(
        fc.property(
          fc.json(),
          fc.nat(),
          (jsonStr, pos) => {
            const cursorPos = Math.min(pos, jsonStr.length);
            const context = parseJsonContext(jsonStr, cursorPos);
            
            expect(Array.isArray(context.path)).toBe(true);
            expect(typeof context.isValue).toBe('boolean');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('getAllowedMethods', () => {
    it('returns null for empty endpoint', () => {
      expect(getAllowedMethods('')).toBeNull();
      expect(getAllowedMethods('   ')).toBeNull();
    });

    it('returns methods for exact match endpoints', () => {
      const methods = getAllowedMethods('/_cluster/health');
      expect(methods).toContain('GET');
    });

    it('returns methods for search endpoint', () => {
      const methods = getAllowedMethods('/_search');
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
    });

    it('handles endpoints without leading slash', () => {
      const methods = getAllowedMethods('_cluster/health');
      expect(methods).toContain('GET');
    });

    it('handles endpoints with query parameters', () => {
      const methods = getAllowedMethods('/_cat/indices?v=true');
      expect(methods).toContain('GET');
    });

    it('returns methods for pattern-matched endpoints', () => {
      const methods = getAllowedMethods('/my-index/_search');
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
    });

    it('returns methods for document endpoints', () => {
      const methods = getAllowedMethods('/my-index/_doc/123');
      expect(methods).toContain('GET');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
    });

    it('returns default methods for bare index name', () => {
      const methods = getAllowedMethods('/myindex');
      expect(methods).toContain('GET');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('HEAD');
    });

    it('returns null for unknown endpoints', () => {
      const methods = getAllowedMethods('/unknown/path/that/does/not/exist');
      expect(methods).toBeNull();
    });

    it('Property: known endpoints return non-null methods', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ENDPOINT_REGISTRY.map(e => e.endpoint)),
          (endpoint) => {
            const methods = getAllowedMethods(endpoint);
            expect(methods).not.toBeNull();
            expect(methods!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('isMethodAllowed', () => {
    it('returns true for allowed method', () => {
      expect(isMethodAllowed('/_cluster/health', 'GET')).toBe(true);
    });

    it('returns false for disallowed method', () => {
      expect(isMethodAllowed('/_cluster/health', 'DELETE')).toBe(false);
    });

    it('returns null for unknown endpoint', () => {
      expect(isMethodAllowed('/unknown/endpoint', 'GET')).toBeNull();
    });

    it('handles search endpoint methods correctly', () => {
      expect(isMethodAllowed('/_search', 'GET')).toBe(true);
      expect(isMethodAllowed('/_search', 'POST')).toBe(true);
      expect(isMethodAllowed('/_search', 'DELETE')).toBe(false);
    });

    it('handles bulk endpoint methods correctly', () => {
      expect(isMethodAllowed('/_bulk', 'POST')).toBe(true);
      expect(isMethodAllowed('/_bulk', 'GET')).toBe(false);
    });

    it('Property: isMethodAllowed consistent with getAllowedMethods', () => {
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...ENDPOINT_REGISTRY.map(e => e.endpoint)),
          fc.constantFrom(...methods),
          (endpoint, method) => {
            const allowed = getAllowedMethods(endpoint);
            const isAllowed = isMethodAllowed(endpoint, method);
            
            if (allowed === null) {
              expect(isAllowed).toBeNull();
            } else {
              expect(isAllowed).toBe(allowed.includes(method));
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('AutocompleteProvider class', () => {
    it('creates provider with empty indices', () => {
      const provider = createAutocompleteProvider();
      expect(provider.getClusterIndices()).toEqual([]);
    });

    it('sets and gets cluster indices', () => {
      const provider = createAutocompleteProvider();
      const indices = ['logs', 'metrics', 'users'];
      
      provider.setClusterIndices(indices);
      expect(provider.getClusterIndices()).toEqual(indices);
    });

    it('getEndpointSuggestions uses cluster indices', () => {
      const provider = createAutocompleteProvider();
      provider.setClusterIndices(['logs', 'metrics']);
      
      const suggestions = provider.getEndpointSuggestions('/', 'GET');
      
      // Should include suggestions for the cluster indices
      const logsEndpoints = suggestions.filter(s => s.endpoint.includes('/logs'));
      expect(logsEndpoints.length).toBeGreaterThan(0);
    });

    it('getQueryDslSuggestions returns suggestions', () => {
      const provider = createAutocompleteProvider();
      
      const suggestions = provider.getQueryDslSuggestions({
        path: [],
        parentKey: undefined,
        isValue: false,
      });
      
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('parseJsonContext delegates correctly', () => {
      const provider = createAutocompleteProvider();
      
      const context = provider.parseJsonContext('{"query": {', 11);
      expect(context.path).toContain('query');
    });

    it('Property: provider methods are consistent with standalone functions', () => {
      const provider = createAutocompleteProvider();
      
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)), { minLength: 0, maxLength: 5 }),
          (indices) => {
            provider.setClusterIndices(indices);
            expect(provider.getClusterIndices()).toEqual(indices);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
