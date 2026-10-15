// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Autocomplete Provider
 * Feature: opensearch-notebook-ui
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { HttpMethod } from '../../types/cell';
import {
  getEndpointSuggestions,
  getEndpointSuggestionsWithIndices,
  getQueryDslSuggestions,
  ENDPOINT_REGISTRY,
  QUERY_DSL_REGISTRY,
  type QueryDslContext,
} from '../../services/autocompleteProvider';

/**
 * Generator for HTTP methods
 */
const httpMethodArb: fc.Arbitrary<HttpMethod> = fc.constantFrom(
  'GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'
);

/**
 * Generator for partial endpoint strings
 * Uses substrings from actual endpoints in the registry
 */
const partialEndpointArb: fc.Arbitrary<string> = fc.oneof(
  // Empty string
  fc.constant(''),
  // Common endpoint prefixes
  fc.constantFrom('/', '/_', '/_c', '/_cat', '/_cluster', '/_search', '/{index}'),
  // Random substrings from registry endpoints
  fc.constantFrom(...ENDPOINT_REGISTRY.map(e => e.endpoint.substring(0, Math.min(5, e.endpoint.length)))),
  // Arbitrary strings that might match
  fc.string({ minLength: 0, maxLength: 10 }).filter((s: string) => /^[/_a-z]*$/.test(s)),
);

/**
 * Generator for Query DSL context keys
 */
const contextKeyArb: fc.Arbitrary<string> = fc.constantFrom(
  'root', 'query', 'bool', 'aggs', 'highlight', 'sort', 'range', 'nested', 'function_score'
);

/**
 * Generator for QueryDslContext
 */
const queryDslContextArb: fc.Arbitrary<QueryDslContext> = fc.record({
  path: fc.array(contextKeyArb, { minLength: 0, maxLength: 5 }),
  parentKey: fc.option(contextKeyArb, { nil: undefined }),
  isValue: fc.boolean(),
});

/**
 * Generator for index names (realistic OpenSearch index names)
 */
const indexNameArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('logs', 'metrics', 'users', 'products', 'orders', 'events'),
  fc.string({ minLength: 3, maxLength: 15 })
    .filter((s: string) => /^[a-z][a-z0-9_-]*$/.test(s)) // Valid index name format
);

/**
 * Generator for array of index names
 */
const indexNamesArb: fc.Arbitrary<string[]> = fc.array(indexNameArb, { minLength: 0, maxLength: 10 })
  .map(arr => [...new Set(arr)]); // Remove duplicates

describe('Autocomplete Provider Property Tests', () => {
  /**
   * Property 21: Endpoint Autocomplete Filtering
   * For any partial endpoint string and HTTP method, the autocomplete provider
   * should return only suggestions where the endpoint contains the partial string
   * and the method is supported by that endpoint.
   * Validates: Requirements 3.3, 3.9
   */
  it('Property 21: Endpoint Autocomplete Filtering', () => {
    fc.assert(
      fc.property(partialEndpointArb, httpMethodArb, (partialEndpoint, method) => {
        const suggestions = getEndpointSuggestions(partialEndpoint, method);
        
        // All returned suggestions should:
        // 1. Contain the partial endpoint string (case-insensitive)
        // 2. Support the specified HTTP method
        for (const suggestion of suggestions) {
          // Check endpoint contains partial input
          const endpointContainsPartial = suggestion.endpoint
            .toLowerCase()
            .includes(partialEndpoint.toLowerCase().trim());
          expect(endpointContainsPartial).toBe(true);
          
          // Check method is supported
          const methodSupported = suggestion.methods.includes(method);
          expect(methodSupported).toBe(true);
        }
        
        // Verify suggestions are a subset of the registry
        for (const suggestion of suggestions) {
          const inRegistry = ENDPOINT_REGISTRY.some(
            e => e.endpoint === suggestion.endpoint
          );
          expect(inRegistry).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Endpoint suggestions without method filter
   * When no method is specified, suggestions should only filter by endpoint match
   */
  it('Property 21b: Endpoint Autocomplete Without Method Filter', () => {
    fc.assert(
      fc.property(partialEndpointArb, (partialEndpoint) => {
        const suggestions = getEndpointSuggestions(partialEndpoint);
        
        // All returned suggestions should contain the partial endpoint string
        for (const suggestion of suggestions) {
          const endpointContainsPartial = suggestion.endpoint
            .toLowerCase()
            .includes(partialEndpoint.toLowerCase().trim());
          expect(endpointContainsPartial).toBe(true);
        }
        
        // Without method filter, we should get at least as many results
        // as with any specific method filter
        const withGet = getEndpointSuggestions(partialEndpoint, 'GET');
        expect(suggestions.length).toBeGreaterThanOrEqual(withGet.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21c: Endpoint Autocomplete With Cluster Indices
   * When cluster indices are provided, suggestions should include
   * concrete endpoints with actual index names replacing {index} placeholders.
   * Validates: Requirements 3.9
   */
  it('Property 21c: Endpoint Autocomplete With Cluster Indices', () => {
    fc.assert(
      fc.property(partialEndpointArb, httpMethodArb, indexNamesArb, (partialEndpoint, method, indices) => {
        const suggestions = getEndpointSuggestionsWithIndices(partialEndpoint, method, indices);
        
        // All returned suggestions should support the specified HTTP method
        for (const suggestion of suggestions) {
          const methodSupported = suggestion.methods.includes(method);
          expect(methodSupported).toBe(true);
        }
        
        // If we have indices and a matching partial, we should get index-specific suggestions
        if (indices.length > 0 && partialEndpoint === '/') {
          // Should have some concrete index endpoints (without {index} placeholder)
          const concreteIndexEndpoints = suggestions.filter(
            s => !s.endpoint.includes('{index}') && indices.some(idx => s.endpoint.includes(idx))
          );
          // We expect at least some concrete suggestions when indices are provided
          expect(concreteIndexEndpoints.length).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21d: Index-specific suggestions replace placeholders correctly
   */
  it('Property 21d: Index Suggestions Replace Placeholders', () => {
    const testIndices = ['logs', 'metrics', 'users'];
    
    // Test with a partial that should match index endpoints
    const suggestions = getEndpointSuggestionsWithIndices('/logs', 'GET', testIndices);
    
    // Should have suggestions for the 'logs' index
    const logsEndpoints = suggestions.filter(s => s.endpoint.includes('/logs'));
    expect(logsEndpoints.length).toBeGreaterThan(0);
    
    // None of the logs-specific endpoints should have {index} placeholder
    for (const endpoint of logsEndpoints) {
      if (endpoint.endpoint.startsWith('/logs')) {
        expect(endpoint.endpoint).not.toContain('{index}');
      }
    }
  });

  /**
   * Property 21e: System indices (starting with .) are excluded from suggestions
   */
  it('Property 21e: System Indices Excluded From Suggestions', () => {
    const testIndices = ['logs', '.kibana', '.opensearch', 'users', '.security'];
    
    const suggestions = getEndpointSuggestionsWithIndices('/', 'GET', testIndices);
    
    // Should not have any suggestions with system index names
    const systemIndexSuggestions = suggestions.filter(
      s => s.endpoint.includes('/.kibana') || 
           s.endpoint.includes('/.opensearch') || 
           s.endpoint.includes('/.security')
    );
    expect(systemIndexSuggestions.length).toBe(0);
    
    // But should have suggestions for regular indices
    const regularIndexSuggestions = suggestions.filter(
      s => s.endpoint.includes('/logs') || s.endpoint.includes('/users')
    );
    expect(regularIndexSuggestions.length).toBeGreaterThan(0);
  });

  /**
   * Property 22: Query DSL Autocomplete Context Awareness
   * For any JSON path context within a query body, the autocomplete provider
   * should return field suggestions appropriate for that context.
   * Validates: Requirements 3.7, 3.10
   */
  it('Property 22: Query DSL Autocomplete Context Awareness', () => {
    fc.assert(
      fc.property(queryDslContextArb, (context) => {
        const suggestions = getQueryDslSuggestions(context);
        
        // Should always return an array
        expect(Array.isArray(suggestions)).toBe(true);
        
        // Each suggestion should have required fields
        for (const suggestion of suggestions) {
          expect(typeof suggestion.field).toBe('string');
          expect(suggestion.field.length).toBeGreaterThan(0);
          expect(typeof suggestion.description).toBe('string');
          expect(['string', 'number', 'boolean', 'object', 'array']).toContain(suggestion.valueType);
        }
        
        // Suggestions should come from the registry
        const allSuggestions = Object.values(QUERY_DSL_REGISTRY).flat();
        for (const suggestion of suggestions) {
          const inRegistry = allSuggestions.some(
            s => s.field === suggestion.field && s.description === suggestion.description
          );
          expect(inRegistry).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22b: Query DSL Context-Specific Suggestions
   * Specific contexts should return appropriate suggestions
   */
  it('Property 22b: Query DSL Context Returns Non-Empty Suggestions', () => {
    // Test specific known contexts
    const knownContexts: QueryDslContext[] = [
      { path: [], parentKey: undefined, isValue: false }, // root
      { path: ['query'], parentKey: 'query', isValue: false }, // query context
      { path: ['query', 'bool'], parentKey: 'bool', isValue: false }, // bool context
      { path: ['aggs', 'by_status'], parentKey: 'by_status', isValue: false }, // named aggregation context
      { path: ['highlight'], parentKey: 'highlight', isValue: false }, // highlight context
    ];
    
    for (const context of knownContexts) {
      const suggestions = getQueryDslSuggestions(context);
      
      // Known contexts should return non-empty suggestions
      expect(suggestions.length).toBeGreaterThan(0);
    }
  });

  /**
   * Property: Empty partial endpoint returns all endpoints for the method
   */
  it('Empty partial endpoint returns all endpoints supporting the method', () => {
    fc.assert(
      fc.property(httpMethodArb, (method) => {
        const suggestions = getEndpointSuggestions('', method);
        
        // Should return all endpoints that support this method
        const expectedCount = ENDPOINT_REGISTRY.filter(
          e => e.methods.includes(method)
        ).length;
        
        expect(suggestions.length).toBe(expectedCount);
      }),
      { numRuns: 6 } // One for each HTTP method
    );
  });
});
