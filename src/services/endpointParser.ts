// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Endpoint Parser and Categorizer for OpenSearch Notebook
 * Parses OpenSearch API endpoints and categorizes them as cluster or index operations
 * Requirements: 5.3, 5.6
 */

/**
 * Parsed endpoint result
 */
export interface ParsedEndpoint {
  type: 'cluster' | 'index' | 'unknown';
  indexPattern?: string;
  normalizedPath: string;
}

/**
 * Endpoint pattern definition for matching
 */
interface EndpointPattern {
  pattern: RegExp;
  type: 'cluster' | 'index';
  extractIndex?: boolean;
}

/**
 * Endpoint patterns for categorization
 * Order matters - more specific patterns should come first
 */
const ENDPOINT_PATTERNS: EndpointPattern[] = [
  // Cluster patterns (must come before index patterns to avoid false matches)
  { pattern: /^\/_cluster\//, type: 'cluster' },
  { pattern: /^\/_cat\//, type: 'cluster' },
  { pattern: /^\/_nodes/, type: 'cluster' },
  { pattern: /^\/_search\/pipeline/, type: 'cluster' },
  { pattern: /^\/_template/, type: 'cluster' },
  { pattern: /^\/_index_template/, type: 'cluster' },
  { pattern: /^\/_component_template/, type: 'cluster' },
  { pattern: /^\/_snapshot/, type: 'cluster' },
  { pattern: /^\/_tasks/, type: 'cluster' },
  { pattern: /^\/_ingest/, type: 'cluster' },
  { pattern: /^\/_scripts/, type: 'cluster' },
  { pattern: /^\/_plugins\//, type: 'cluster' },
  { pattern: /^\/_remote\//, type: 'cluster' },
  { pattern: /^\/_remotestore\//, type: 'cluster' },
  { pattern: /^\/_list\/wlm_stats/, type: 'cluster' },
  { pattern: /^\/_script_context$/, type: 'cluster' },
  { pattern: /^\/_script_language$/, type: 'cluster' },
  
  // Index-specific patterns (extract index name)
  // Index-level root endpoints (no index extraction)
  { pattern: /^\/_search$/, type: 'index' },
  { pattern: /^\/_search\/scroll/, type: 'index' },
  { pattern: /^\/_search\/point_in_time/, type: 'index' },
  { pattern: /^\/_search\/template/, type: 'index' },
  { pattern: /^\/_search_shards/, type: 'index' },
  { pattern: /^\/_render\/template/, type: 'index' },
  { pattern: /^\/_rank_eval/, type: 'index' },
  { pattern: /^\/_count$/, type: 'index' },
  { pattern: /^\/_bulk(\/|$)/, type: 'index' },
  { pattern: /^\/_mget$/, type: 'index' },
  { pattern: /^\/_msearch/, type: 'index' },
  { pattern: /^\/_mtermvectors$/, type: 'index' },
  { pattern: /^\/_analyze$/, type: 'index' },
  { pattern: /^\/_validate\/query$/, type: 'index' },
  { pattern: /^\/_aliases(\/|$)/, type: 'index' },
  { pattern: /^\/_alias(\/|$)/, type: 'index' },
  { pattern: /^\/_mapping(\/|$)/, type: 'index' },
  { pattern: /^\/_settings(\/|$)/, type: 'index' },
  { pattern: /^\/_refresh$/, type: 'index' },
  { pattern: /^\/_flush(\/|$)/, type: 'index' },
  { pattern: /^\/_cache\/clear$/, type: 'index' },
  { pattern: /^\/_forcemerge$/, type: 'index' },
  { pattern: /^\/_stats(\/|$)/, type: 'index' },
  { pattern: /^\/_segments$/, type: 'index' },
  { pattern: /^\/_recovery$/, type: 'index' },
  { pattern: /^\/_shard_stores$/, type: 'index' },
  { pattern: /^\/_field_caps$/, type: 'index' },
  { pattern: /^\/_upgrade$/, type: 'index' },
  { pattern: /^\/_reindex$/, type: 'index' },
  { pattern: /^\/_data_stream$/, type: 'index' },
  { pattern: /^\/_data_stream\/([^\/]+)$/, type: 'index', extractIndex: true },
  { pattern: /^\/_data_stream\/_stats$/, type: 'index' },
  { pattern: /^\/_data_stream\/([^\/]+)\/_stats$/, type: 'index', extractIndex: true },
  { pattern: /^\/_resolve\/index\/([^\/]+)$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_search$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_search\/point_in_time$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_search\/template$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_search_shards$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_count$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_doc\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_doc$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_create\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_update\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_bulk$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_bulk\/stream$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_mapping$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_mappings$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_mapping\/field\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_settings$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_settings\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_setting\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_refresh$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_flush\/synced$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_flush$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_cache\/clear$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_forcemerge$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_close$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_open$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_stats$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_stats\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_segments$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_recovery$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_shard_stores$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_field_caps$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_upgrade$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_block\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_rollover$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_rollover\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_split\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_shrink\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_clone\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_scale$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_alias$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_alias\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_aliases\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_aliases$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_analyze$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_validate\/query$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_explain\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_termvectors$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_termvectors\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_mtermvectors$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_source\/[^\/]+$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_mget$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_msearch$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_msearch\/template$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_delete_by_query$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_update_by_query$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_rank_eval$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_noop_search$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/_noop_bulk$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/ingestion\/_state$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/ingestion\/_pause$/, type: 'index', extractIndex: true },
  { pattern: /^\/([^\/]+)\/ingestion\/_resume$/, type: 'index', extractIndex: true },
  
  // Generic index pattern (single segment path = index name)
  { pattern: /^\/([^\/]+)$/, type: 'index', extractIndex: true },
];

/**
 * Normalize an endpoint path by replacing dynamic segments with placeholders
 * This helps with deduplication and permission mapping
 */
export function normalizeEndpoint(endpoint: string): string {
  // Remove query parameters
  const pathOnly = endpoint.split('?')[0] || endpoint;
  
  // Ensure endpoint starts with /
  const withSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  const trimmedSlash = withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
  
  // Normalize document IDs in paths like /{index}/_doc/{id}
  let normalized = trimmedSlash.replace(/\/_doc\/[^\/]+$/, '/_doc/{id}');
  normalized = normalized.replace(/\/_create\/[^\/]+$/, '/_create/{id}');
  normalized = normalized.replace(/\/_update\/[^\/]+$/, '/_update/{id}');
  normalized = normalized.replace(/\/_explain\/[^\/]+$/, '/_explain/{id}');
  normalized = normalized.replace(/\/_termvectors\/[^\/]+$/, '/_termvectors/{id}');
  normalized = normalized.replace(/\/_source\/[^\/]+$/, '/_source/{id}');
  
  return normalized;
}

/**
 * Parse an endpoint and extract its type and index pattern
 * Requirements: 5.3, 5.6
 * 
 * @param endpoint - The API endpoint path (e.g., "/my-index/_search")
 * @returns ParsedEndpoint with type, optional index pattern, and normalized path
 */
export function parseEndpoint(endpoint: string): ParsedEndpoint {
  // Remove query parameters for pattern matching
  const pathOnly = endpoint.split('?')[0] || endpoint;
  
  // Ensure endpoint starts with /
  const normalizedInput = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  
  for (const { pattern, type, extractIndex } of ENDPOINT_PATTERNS) {
    const match = normalizedInput.match(pattern);
    if (match) {
      return {
        type,
        indexPattern: extractIndex && match[1] ? match[1] : undefined,
        normalizedPath: normalizeEndpoint(normalizedInput),
      };
    }
  }
  
  // Unknown endpoint type
  return {
    type: 'unknown',
    normalizedPath: normalizeEndpoint(normalizedInput),
  };
}

/**
 * Extract all index patterns from an endpoint
 * Handles comma-separated indices like "index1,index2"
 * 
 * @param endpoint - The API endpoint path
 * @returns Array of index patterns found in the endpoint
 */
export function extractIndexPatterns(endpoint: string): string[] {
  const parsed = parseEndpoint(endpoint);
  
  if (!parsed.indexPattern) {
    return [];
  }
  
  // Handle comma-separated indices (e.g., "index1,index2/_search")
  const patterns = parsed.indexPattern.split(',').map((p) => p.trim()).filter(Boolean);
  
  return patterns;
}

/**
 * Check if an endpoint is a cluster-level operation
 * 
 * @param endpoint - The API endpoint path
 * @returns true if the endpoint is a cluster operation
 */
export function isClusterOperation(endpoint: string): boolean {
  const parsed = parseEndpoint(endpoint);
  return parsed.type === 'cluster';
}

/**
 * Check if an endpoint is an index-level operation
 * 
 * @param endpoint - The API endpoint path
 * @returns true if the endpoint is an index operation
 */
export function isIndexOperation(endpoint: string): boolean {
  const parsed = parseEndpoint(endpoint);
  return parsed.type === 'index';
}
