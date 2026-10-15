// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Query Executor Service
 * Tests execute, validateConnection, executePPL, extractPPLIndex, validatePPLSyntax, QueryExecutor class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { ConnectionConfig } from '../../types/connection';
import type { QueryCell } from '../../types/cell';
import {
  execute,
  validateConnection,
  executePPL,
  extractPPLIndex,
  validatePPLSyntax,
  createQueryExecutor,
  fetchClusterIndices,
} from '../../services/queryExecutor';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Query Executor Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractPPLIndex', () => {
    it('extracts index from simple source clause', () => {
      expect(extractPPLIndex('source=logs')).toBe('logs');
      expect(extractPPLIndex('source=my-index')).toBe('my-index');
      expect(extractPPLIndex('source=logs-2024.01.15')).toBe('logs-2024.01.15');
    });

    it('extracts index with wildcard', () => {
      expect(extractPPLIndex('source=logs-*')).toBe('logs-*');
      expect(extractPPLIndex('source=*')).toBe('*');
    });

    it('extracts index from query with pipes', () => {
      expect(extractPPLIndex('source=logs | head 10')).toBe('logs');
      expect(extractPPLIndex('source=metrics | where value > 100 | stats avg(value)')).toBe('metrics');
    });

    it('handles case insensitive source', () => {
      expect(extractPPLIndex('SOURCE=logs')).toBe('logs');
      expect(extractPPLIndex('Source=logs')).toBe('logs');
    });

    it('returns null for invalid queries', () => {
      expect(extractPPLIndex('')).toBeNull();
      expect(extractPPLIndex('invalid query')).toBeNull();
      expect(extractPPLIndex('select * from logs')).toBeNull();
    });

    it('Property: valid source clause always extracts index', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-z][a-z0-9_-]*$/.test(s)),
          (indexName) => {
            const query = `source=${indexName} | head 10`;
            expect(extractPPLIndex(query)).toBe(indexName);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('validatePPLSyntax', () => {
    it('returns error for empty query', () => {
      const error = validatePPLSyntax('');
      expect(error).not.toBeNull();
      expect(error).toContain('empty');
    });

    it('returns error for whitespace-only query', () => {
      const error = validatePPLSyntax('   ');
      expect(error).not.toBeNull();
    });

    it.each([
      'source=logs', 'source = logs | head 10', 'search source=logs',
      'search status=500 source=logs', 'source=logs | tail 10',
      'source=logs | ad', 'source=logs | kmeans', 'source=logs | ml',
      'select * from logs', 'source=',
    ])('delegates nonempty query validation to the cluster: %s', query => {
      expect(validatePPLSyntax(query)).toBeNull();
    });
  });

  describe('execute', () => {
    const baseConnection: ConnectionConfig = {
      id: 'test-conn',
      name: 'Test Connection',
      endpoint: 'https://localhost:9200',
      authType: 'none',
      credentials: null,
    };

    const baseCell: QueryCell = {
      id: 'cell-1',
      type: 'query',
      method: 'GET',
      endpoint: '/_cluster/health',
      body: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('returns error when credentials required but missing', async () => {
      const connection: ConnectionConfig = {
        ...baseConnection,
        authType: 'basic',
        credentials: null,
      };

      const result = await execute(connection, baseCell);
      
      expect(result.success).toBe(false);
      expect(result.body).toHaveProperty('error');
    });

    it('returns error for invalid JSON body', async () => {
      const cell: QueryCell = {
        ...baseCell,
        method: 'POST',
        body: '{ invalid json }',
      };

      const result = await execute(baseConnection, cell);
      
      expect(result.success).toBe(false);
      expect(result.body).toHaveProperty('error');
      expect((result.body as { error: string }).error).toContain('Invalid JSON');
    });

    it('executes successful GET request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ cluster_name: 'test', status: 'green' }),
      });

      const result = await execute(baseConnection, baseCell);
      
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.body).toHaveProperty('cluster_name');
    });

    it('executes successful POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ hits: { total: { value: 10 } } }),
      });

      const cell: QueryCell = {
        ...baseCell,
        method: 'POST',
        endpoint: '/index/_search',
        body: '{"query": {"match_all": {}}}',
      };

      const result = await execute(baseConnection, cell);
      
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: '{"query": {"match_all": {}}}',
        })
      );
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await execute(baseConnection, baseCell);
      
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(0);
      expect(result.body).toHaveProperty('type', 'NetworkError');
    });

    it('handles timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      const result = await execute(baseConnection, baseCell, { timeout: 1000 });
      
      expect(result.success).toBe(false);
      expect(result.body).toHaveProperty('type', 'TimeoutError');
    });

    it('handles non-JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'plain text response',
        json: async () => { throw new Error('Not JSON'); },
      });

      const result = await execute(baseConnection, baseCell);
      
      expect(result.success).toBe(true);
      expect(result.body).toBe('plain text response');
    });
  });

  describe('validateConnection', () => {
    const baseConnection: ConnectionConfig = {
      id: 'test-conn',
      name: 'Test Connection',
      endpoint: 'https://localhost:9200',
      authType: 'none',
      credentials: null,
    };

    it('returns error when credentials required but missing', async () => {
      const connection: ConnectionConfig = {
        ...baseConnection,
        authType: 'basic',
        credentials: null,
      };

      const result = await validateConnection(connection);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('credentials');
    });

    it('returns valid result for successful connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ cluster_name: 'test-cluster', status: 'green' }),
      });

      const result = await validateConnection(baseConnection);
      
      expect(result.valid).toBe(true);
      expect(result.clusterName).toBe('test-cluster');
      expect(result.clusterStatus).toBe('green');
    });

    it('returns error for failed connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Unauthorized' }),
      });

      const result = await validateConnection(baseConnection);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Authentication');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await validateConnection(baseConnection);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('executePPL', () => {
    const baseConnection: ConnectionConfig = {
      id: 'test-conn',
      name: 'Test Connection',
      endpoint: 'https://localhost:9200',
      authType: 'none',
      credentials: null,
    };

    it('returns error when credentials required but missing', async () => {
      const connection: ConnectionConfig = {
        ...baseConnection,
        authType: 'basic',
        credentials: null,
      };

      const result = await executePPL(connection, 'source=logs', 'cell-1');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('credentials');
    });

    it('returns error for invalid PPL syntax', async () => {
      const result = await executePPL(baseConnection, 'invalid query', 'cell-1');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('executes successful PPL query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          schema: [{ name: 'field1', type: 'string' }],
          datarows: [['value1'], ['value2']],
          total: 2,
          size: 2,
        }),
      });

      const result = await executePPL(baseConnection, 'source=logs | head 10', 'cell-1');
      
      expect(result.success).toBe(true);
      expect(result.schema).toHaveLength(1);
      expect(result.datarows).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('handles PPL error response with type and reason', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            type: 'SemanticCheckException',
            reason: 'Field not found',
            details: 'Unknown field: invalid_field',
          },
        }),
      });

      const result = await executePPL(baseConnection, 'source=logs | where invalid_field > 0', 'cell-1');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Field not found');
      expect(result.error).toContain('SemanticCheckException');
    });

    it('handles PPL error response with root_cause', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            type: 'SyntaxError',
            root_cause: [{ reason: 'Syntax error at line 1' }],
          },
        }),
      });

      const result = await executePPL(baseConnection, 'source=logs | invalid', 'cell-1');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Syntax error');
    });

    it('handles PPL error response with caused_by', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            type: 'QueryError',
            caused_by: { reason: 'Index not found' },
          },
        }),
      });

      const result = await executePPL(baseConnection, 'source=nonexistent | head 10', 'cell-1');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Index not found');
    });

    it('handles PPL error response with message format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          message: 'Query execution failed',
        }),
      });

      const result = await executePPL(baseConnection, 'source=logs', 'cell-1');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Query execution failed');
    });

    it('handles PPL error response with string error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: 'Simple error message',
        }),
      });

      const result = await executePPL(baseConnection, 'source=logs', 'cell-1');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Simple error message');
    });

    it('handles PPL error response with status and error object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          status: 500,
          error: { code: 'INTERNAL_ERROR' },
        }),
      });

      const result = await executePPL(baseConnection, 'source=logs', 'cell-1');
      
      expect(result.success).toBe(false);
      // The error contains the stringified error object
      expect(result.error).toContain('INTERNAL_ERROR');
    });

    it('handles PPL error with empty error object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {},
        }),
      });

      const result = await executePPL(baseConnection, 'source=logs', 'cell-1');
      
      expect(result.success).toBe(false);
      // Should stringify the empty object
      expect(result.error).toBeDefined();
    });

    it('handles network error in PPL execution', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await executePPL(baseConnection, 'source=logs | head 10', 'cell-1');
      
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(0);
    });

    it('handles non-object error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => null,
      });

      const result = await executePPL(baseConnection, 'source=logs', 'cell-1');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown PPL error');
    });
  });

  describe('QueryExecutor class', () => {
    it('creates executor instance', () => {
      const executor = createQueryExecutor();
      expect(executor).toBeDefined();
    });

    it('sets and uses tracker', async () => {
      const executor = createQueryExecutor();
      const mockTracker = {
        trackOperation: vi.fn(),
        trackPPLOperation: vi.fn(),
      };
      
      executor.setTracker(mockTracker as any);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ cluster_name: 'test' }),
      });

      const connection: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'https://localhost:9200',
        authType: 'none',
        credentials: null,
      };

      const cell: QueryCell = {
        id: 'cell-1',
        type: 'query',
        method: 'GET',
        endpoint: '/_cluster/health',
        body: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await executor.execute(connection, cell);
      
      expect(mockTracker.trackOperation).toHaveBeenCalled();
    });

    it('sets default timeout', async () => {
      const executor = createQueryExecutor();
      executor.setDefaultTimeout(5000);
      
      // The timeout is used internally, we just verify no error
      expect(() => executor.setDefaultTimeout(10000)).not.toThrow();
    });

    it('validates connection', async () => {
      const executor = createQueryExecutor();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ cluster_name: 'test', status: 'green' }),
      });

      const connection: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'https://localhost:9200',
        authType: 'none',
        credentials: null,
      };

      const result = await executor.validateConnection(connection);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Property-based tests', () => {
    it('Property: extractPPLIndex returns string or null', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (query) => {
            const result = extractPPLIndex(query);
            expect(result === null || typeof result === 'string').toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: validatePPLSyntax returns string or null', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (query) => {
            const result = validatePPLSyntax(query);
            expect(result === null || typeof result === 'string').toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: valid PPL queries pass validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z][a-z0-9_-]*$/.test(s)),
          (indexName) => {
            const query = `source=${indexName}`;
            const error = validatePPLSyntax(query);
            expect(error).toBeNull();
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('fetchClusterIndices', () => {
    const baseConnection: ConnectionConfig = {
      id: 'test-conn',
      name: 'Test Connection',
      endpoint: 'https://localhost:9200',
      authType: 'none',
      credentials: null,
    };

    it('returns indices from cluster', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [
            { index: 'logs', health: 'green', status: 'open', 'docs.count': '1000' },
            { index: 'metrics', health: 'yellow', status: 'open', 'docs.count': '500' },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data_streams: [] }),
        });

      const indices = await fetchClusterIndices(baseConnection);
      
      expect(indices).toHaveLength(2);
      expect(indices[0]?.name).toBe('logs');
      expect(indices[0]?.health).toBe('green');
      expect(indices[0]?.docsCount).toBe(1000);
    });

    it('filters out system indices', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [
            { index: 'logs', health: 'green', status: 'open', 'docs.count': '100' },
            { index: '.kibana', health: 'green', status: 'open', 'docs.count': '50' },
            { index: '.security', health: 'green', status: 'open', 'docs.count': '10' },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data_streams: [] }),
        });

      const indices = await fetchClusterIndices(baseConnection);
      
      expect(indices).toHaveLength(1);
      expect(indices[0]?.name).toBe('logs');
    });

    it('includes data streams', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [
            { index: 'logs', health: 'green', status: 'open', 'docs.count': '100' },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            data_streams: [
              { name: 'logs-stream', status: 'green' },
            ],
          }),
        });

      const indices = await fetchClusterIndices(baseConnection);
      
      expect(indices).toHaveLength(2);
      expect(indices.some(i => i.name === 'logs-stream')).toBe(true);
    });

    it('returns empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const indices = await fetchClusterIndices(baseConnection);
      
      expect(indices).toEqual([]);
    });

    it('returns empty array on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Unauthorized' }),
      });

      const indices = await fetchClusterIndices(baseConnection);
      
      expect(indices).toEqual([]);
    });

    it('handles data streams endpoint failure gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [
            { index: 'logs', health: 'green', status: 'open', 'docs.count': '100' },
          ],
        })
        .mockRejectedValueOnce(new Error('Data streams not supported'));

      const indices = await fetchClusterIndices(baseConnection);
      
      // Should still return regular indices
      expect(indices).toHaveLength(1);
      expect(indices[0]?.name).toBe('logs');
    });

    it('handles non-array response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'unexpected format' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data_streams: [] }),
        });

      const indices = await fetchClusterIndices(baseConnection);
      
      expect(indices).toEqual([]);
    });
  });
});
