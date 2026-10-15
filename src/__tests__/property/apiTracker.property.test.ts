// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for API Tracker Service
 * Feature: opensearch-notebook-ui
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { httpMethodArb } from './generators/notebook.generator';
import { createApiTracker, categorizeOperation } from '../../services/apiTracker';
import { parseEndpoint, extractIndexPatterns } from '../../services/endpointParser';
import { STORAGE_KEYS } from '../../services/persistence';
// HttpMethod type is used via httpMethodArb generator

/**
 * Generator for valid OpenSearch endpoint paths
 */
const indexNameArb: fc.Arbitrary<string> = fc.string({
  unit: fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_'
  ),
  minLength: 1,
  maxLength: 20,
}).filter((s: string) => /^[a-z0-9]/.test(s)); // Must start with alphanumeric

/**
 * Generator for index-level endpoints
 */
const indexEndpointArb: fc.Arbitrary<string> = fc.oneof(
  indexNameArb.map((idx) => `/${idx}/_search`),
  indexNameArb.map((idx) => `/${idx}/_doc/123`),
  indexNameArb.map((idx) => `/${idx}/_doc`),
  indexNameArb.map((idx) => `/${idx}/_mapping`),
  indexNameArb.map((idx) => `/${idx}/_settings`),
  indexNameArb.map((idx) => `/${idx}/_count`),
  indexNameArb.map((idx) => `/${idx}/_bulk`),
  indexNameArb.map((idx) => `/${idx}`),
);

/**
 * Generator for cluster-level endpoints
 */
const clusterEndpointArb: fc.Arbitrary<string> = fc.constantFrom(
  '/_cluster/health',
  '/_cluster/state',
  '/_cluster/stats',
  '/_nodes',
  '/_nodes/stats',
  '/_cat/indices',
  '/_cat/nodes',
  '/_cat/health',
  '/_template',
);

/**
 * Generator for index-level root endpoints (no index name in path)
 */
const rootIndexEndpointArb: fc.Arbitrary<string> = fc.constantFrom(
  '/_search',
  '/_search/scroll',
  '/_search/template',
  '/_search_shards',
  '/_bulk',
  '/_mget',
  '/_msearch',
  '/_count',
  '/_rank_eval',
  '/_field_caps',
  '/_stats',
  '/_refresh',
  '/_flush',
  '/_flush/synced',
  '/_forcemerge',
  '/_cache/clear',
  '/_settings',
  '/_mapping',
  '/_aliases',
  '/_alias',
  '/_analyze',
  '/_validate/query',
  '/_mtermvectors',
  '/_reindex',
);

/**
 * Generator for any valid endpoint
 */
const endpointArb: fc.Arbitrary<string> = fc.oneof(
  indexEndpointArb,
  rootIndexEndpointArb,
  clusterEndpointArb
);

/**
 * Generator for cell IDs
 */
const cellIdArb: fc.Arbitrary<string> = fc.uuid();

describe('API Tracker Property Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Property 5: API Tracking Captures Complete Operation Details
   * For any executed query with a valid HTTP method, endpoint, and optional index pattern,
   * the API tracker should record an operation containing the exact method, the exact endpoint path,
   * and all extracted index patterns.
   * **Validates: Requirements 2.7, 5.1, 5.2, 5.3**
   */
  it('Property 5: API Tracking Captures Complete Operation Details', () => {
    fc.assert(
      fc.property(
        httpMethodArb,
        endpointArb,
        cellIdArb,
        (method, endpoint, cellId) => {
          // Clear storage before each iteration
          localStorage.removeItem(STORAGE_KEYS.NOTEBOOKS);

          const tracker = createApiTracker();
          tracker.setNotebookId('test-notebook');

          // Track the operation
          tracker.trackOperation(method, endpoint, cellId);

          // Get tracked operations
          const operations = tracker.getOperations();

          // Property: At least one operation should be tracked
          expect(operations.length).toBeGreaterThanOrEqual(1);

          // Find the tracked operation
          const trackedOp = operations.find(
            (op) => op.method === method && op.endpoint === endpoint
          );

          // Property: The operation should be found
          expect(trackedOp).toBeDefined();

          // Property: Method should match exactly
          expect(trackedOp!.method).toBe(method);

          // Property: Endpoint should match exactly
          expect(trackedOp!.endpoint).toBe(endpoint);

          // Property: Index patterns should be extracted correctly
          const expectedPatterns = extractIndexPatterns(endpoint);
          expect(trackedOp!.indexPatterns).toEqual(expectedPatterns);

          // Property: Cell ID should be recorded
          expect(trackedOp!.cellId).toBe(cellId);

          // Property: Timestamp should be a valid number
          expect(typeof trackedOp!.timestamp).toBe('number');
          expect(trackedOp!.timestamp).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: API Tracking Deduplication
   * For any sequence of tracked operations containing duplicates (same method and endpoint),
   * the tracker's operation list should contain only unique combinations.
   * **Validates: Requirements 5.4**
   */
  it('Property 9: API Tracking Deduplication', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(httpMethodArb, endpointArb, cellIdArb),
          { minLength: 1, maxLength: 20 }
        ),
        (operationTuples) => {
          // Clear storage before each iteration
          localStorage.removeItem(STORAGE_KEYS.NOTEBOOKS);

          const tracker = createApiTracker();
          tracker.setNotebookId('test-notebook');

          // Track all operations
          for (const [method, endpoint, cellId] of operationTuples) {
            tracker.trackOperation(method, endpoint, cellId);
          }

          // Get tracked operations
          const operations = tracker.getOperations();

          // Calculate expected unique operations
          const uniqueKeys = new Set(
            operationTuples.map(([method, endpoint]) => {
              // Normalize endpoint for comparison (remove query params, normalize IDs)
              const normalized = endpoint.split('?')[0] || endpoint;
              let key = `${method} ${normalized}`;
              // Normalize document IDs
              key = key.replace(/\/_doc\/[^\/]+$/, '/_doc/{id}');
              return key;
            })
          );

          // Property: Number of tracked operations should equal unique operations
          expect(operations.length).toBe(uniqueKeys.size);

          // Property: No duplicate method+endpoint combinations
          const trackedKeys = new Set(
            operations.map((op) => {
              let key = `${op.method} ${op.endpoint}`;
              key = key.replace(/\/_doc\/[^\/]+$/, '/_doc/{id}');
              return key;
            })
          );
          expect(trackedKeys.size).toBe(operations.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: API Operation Categorization
   * For any tracked operation, the categorization function should assign exactly one category
   * (either 'cluster' or 'index'), and operations with index-specific endpoints should be
   * categorized as 'index' while cluster-wide endpoints should be categorized as 'cluster'.
   * **Validates: Requirements 5.6**
   */
  it('Property 10: API Operation Categorization', () => {
    fc.assert(
      fc.property(endpointArb, (endpoint) => {
        // Categorize the endpoint
        const category = categorizeOperation(endpoint);

        // Property: Category should be one of the valid values
        expect(['cluster', 'index', 'unknown']).toContain(category);

        // Property: Index endpoints should be categorized as 'index'
        const parsed = parseEndpoint(endpoint);
        if (parsed.indexPattern) {
          expect(category).toBe('index');
        }

        // Property: Known cluster endpoints should be categorized as 'cluster'
        const knownClusterPrefixes = [
          '/_cluster/',
          '/_cat/',
          '/_nodes',
          '/_template',
        ];

        const knownIndexPrefixes = [
          '/_search',
          '/_bulk',
          '/_mget',
          '/_msearch',
          '/_count',
          '/_rank_eval',
          '/_field_caps',
          '/_stats',
          '/_refresh',
          '/_flush',
          '/_forcemerge',
          '/_cache/clear',
          '/_settings',
          '/_mapping',
          '/_aliases',
          '/_alias',
          '/_analyze',
          '/_validate/query',
          '/_mtermvectors',
          '/_reindex',
        ];
        
        const isKnownCluster = knownClusterPrefixes.some((prefix) =>
          endpoint.startsWith(prefix)
        );
        
        if (isKnownCluster && !parsed.indexPattern) {
          expect(category).toBe('cluster');
        }

        const isKnownIndex = knownIndexPrefixes.some((prefix) =>
          endpoint.startsWith(prefix)
        );

        if (isKnownIndex && !parsed.indexPattern) {
          expect(category).toBe('index');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Categorization is mutually exclusive
   * Each endpoint should be categorized as exactly one type
   */
  it('Property 10 (additional): Categorization is mutually exclusive', () => {
    fc.assert(
      fc.property(
        fc.oneof(indexEndpointArb, rootIndexEndpointArb, clusterEndpointArb),
        (endpoint) => {
          const category = categorizeOperation(endpoint);

          // Property: Category should be exactly one of cluster, index, or unknown
          const validCategories = ['cluster', 'index', 'unknown'];
          expect(validCategories).toContain(category);

          // Property: The category should be deterministic
          const category2 = categorizeOperation(endpoint);
          expect(category).toBe(category2);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('API Tracker Extended Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Property: PPL operations are tracked correctly
   */
  it('Property: PPL operations are tracked correctly', () => {
    fc.assert(
      fc.property(
        cellIdArb,
        fc.option(indexNameArb, { nil: null }),
        (cellId, indexPattern) => {
          localStorage.clear();
          
          const tracker = createApiTracker();
          tracker.setNotebookId('test-notebook');
          
          const query = indexPattern 
            ? `source=${indexPattern} | head 10`
            : 'source=* | head 10';
          
          tracker.trackPPLOperation(query, cellId, indexPattern);
          
          const operations = tracker.getOperations();
          const permissions = tracker.getPermissions();
          
          // Property: PPL endpoint should be tracked
          const pplOp = operations.find(op => op.endpoint === '/_plugins/_ppl');
          expect(pplOp).toBeDefined();
          expect(pplOp!.method).toBe('POST');
          
          // Property: PPL cluster permission should be present
          const pplPerm = permissions.find(
            p => p.type === 'cluster' && p.permission === 'cluster:admin/opensearch/ppl'
          );
          expect(pplPerm).toBeDefined();
          
          // Property: If index pattern provided, index read permission should be present
          if (indexPattern) {
            const indexPerm = permissions.find(
              p => p.type === 'index' && 
                   p.permission === 'indices:data/read/search' &&
                   p.indexPatterns?.includes(indexPattern)
            );
            expect(indexPerm).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: clearTracking removes all data
   */
  it('Property: clearTracking removes all data', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(httpMethodArb, endpointArb, cellIdArb), { minLength: 1, maxLength: 5 }),
        (operationTuples) => {
          localStorage.clear();
          
          const tracker = createApiTracker();
          tracker.setNotebookId('test-notebook');
          
          // Track some operations
          for (const [method, endpoint, cellId] of operationTuples) {
            tracker.trackOperation(method, endpoint, cellId);
          }
          
          // Verify operations were tracked
          expect(tracker.getOperations().length).toBeGreaterThan(0);
          
          // Clear tracking
          tracker.clearTracking();
          
          // Property: All operations should be cleared
          expect(tracker.getOperations()).toEqual([]);
          expect(tracker.getPermissions()).toEqual([]);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: getState returns a copy of the state
   */
  it('Property: getState returns a copy of the state', () => {
    fc.assert(
      fc.property(
        httpMethodArb,
        endpointArb,
        cellIdArb,
        (method, endpoint, cellId) => {
          localStorage.clear();
          
          const tracker = createApiTracker();
          tracker.setNotebookId('test-notebook');
          tracker.trackOperation(method, endpoint, cellId);
          
          const state1 = tracker.getState();
          const state2 = tracker.getState();
          
          // Property: States should be equal
          expect(state1).toEqual(state2);
          
          // Property: States should be different objects (copies)
          expect(state1).not.toBe(state2);
          expect(state1.operations).not.toBe(state2.operations);
          expect(state1.permissions).not.toBe(state2.permissions);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: loadFromStorage restores state
   */
  it('Property: loadFromStorage restores state', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(httpMethodArb, endpointArb, cellIdArb), { minLength: 1, maxLength: 3 }),
        (operationTuples) => {
          localStorage.clear();
          
          const notebookId = 'test-notebook-' + Math.random();
          
          // Create tracker and track operations
          const tracker1 = createApiTracker();
          tracker1.setNotebookId(notebookId);
          
          for (const [method, endpoint, cellId] of operationTuples) {
            tracker1.trackOperation(method, endpoint, cellId);
          }
          
          const originalState = tracker1.getState();
          
          // Create new tracker and load from storage
          const tracker2 = createApiTracker();
          tracker2.loadFromStorage(notebookId);
          
          const loadedState = tracker2.getState();
          
          // Property: Loaded state should match original
          expect(loadedState.operations.length).toBe(originalState.operations.length);
          expect(loadedState.permissions.length).toBe(originalState.permissions.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Duplicate PPL operations are deduplicated
   */
  it('Property: Duplicate PPL operations are deduplicated', () => {
    localStorage.clear();
    
    const tracker = createApiTracker();
    tracker.setNotebookId('test-notebook');
    
    // Track same PPL operation multiple times
    tracker.trackPPLOperation('source=logs | head 10', 'cell-1', 'logs');
    tracker.trackPPLOperation('source=logs | head 20', 'cell-2', 'logs');
    tracker.trackPPLOperation('source=logs | stats count()', 'cell-3', 'logs');
    
    const operations = tracker.getOperations();
    
    // Property: Only one PPL operation should be tracked (deduplicated)
    const pplOps = operations.filter(op => op.endpoint === '/_plugins/_ppl');
    expect(pplOps.length).toBe(1);
  });

  /**
   * Property: Permission mapping handles various endpoint patterns
   */
  it('Property: Permission mapping handles various endpoint patterns', () => {
    const testCases = [
      {
        method: 'GET' as const,
        endpoint: '/my-index/_search',
        expectedPerms: ['indices:data/read/search', 'indices:data/read/search/stream'],
      },
      { method: 'POST' as const, endpoint: '/my-index/_doc', expectedPerms: ['indices:data/write/index'] },
      { method: 'DELETE' as const, endpoint: '/my-index/_doc/123', expectedPerms: ['indices:data/write/delete'] },
      { method: 'GET' as const, endpoint: '/_cluster/health', expectedPerms: ['cluster:monitor/health'] },
      {
        method: 'GET' as const,
        endpoint: '/_cat/indices',
        expectedPerms: [
          'indices:monitor/settings/get',
          'indices:monitor/stats',
          'cluster:monitor/state',
          'cluster:monitor/health',
        ],
      },
    ];
    
    for (const { method, endpoint, expectedPerms } of testCases) {
      localStorage.clear();
      
      const tracker = createApiTracker();
      tracker.setNotebookId('test-notebook');
      tracker.trackOperation(method, endpoint, 'cell-1');
      
      const permissions = tracker.getPermissions();
      for (const expectedPerm of expectedPerms) {
        const matchingPerm = permissions.find(p => p.permission === expectedPerm);
        expect(matchingPerm).toBeDefined();
      }
    }
  });
});
