// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * API Documentation URL Mapper
 * Maps OpenSearch API endpoints to their documentation pages on opensearch.org
 */

import { openExternal } from '../platform/runtime';

const DOCS_BASE_URL = 'https://opensearch.org/docs/latest';

/**
 * Documentation mapping entry
 */
interface DocMapping {
  pattern: RegExp;
  url: string;
  title: string;
}

/**
 * Mappings from endpoint patterns to documentation URLs
 * More specific patterns should come first
 */
const DOC_MAPPINGS: DocMapping[] = [
  // Search APIs
  { pattern: /^\/?_search$/, url: '/api-reference/search/', title: 'Search API' },
  { pattern: /^\/?[^\/]+\/_search$/, url: '/api-reference/search/', title: 'Search API' },
  { pattern: /^\/?_msearch/, url: '/api-reference/multi-search/', title: 'Multi-search API' },
  { pattern: /^\/?[^\/]+\/_msearch/, url: '/api-reference/multi-search/', title: 'Multi-search API' },
  { pattern: /^\/?_count$/, url: '/api-reference/count/', title: 'Count API' },
  { pattern: /^\/?[^\/]+\/_count$/, url: '/api-reference/count/', title: 'Count API' },
  { pattern: /^\/?[^\/]+\/_validate\/query/, url: '/api-reference/validate/', title: 'Validate API' },
  { pattern: /^\/?[^\/]+\/_explain/, url: '/api-reference/explain/', title: 'Explain API' },
  
  // Document APIs
  { pattern: /^\/?[^\/]+\/_doc\/[^\/]+$/, url: '/api-reference/document-apis/index-document/', title: 'Index Document API' },
  { pattern: /^\/?[^\/]+\/_doc$/, url: '/api-reference/document-apis/index-document/', title: 'Index Document API' },
  { pattern: /^\/?[^\/]+\/_create/, url: '/api-reference/document-apis/index-document/', title: 'Create Document API' },
  { pattern: /^\/?[^\/]+\/_update\//, url: '/api-reference/document-apis/update-document/', title: 'Update Document API' },
  { pattern: /^\/?[^\/]+\/_source\//, url: '/api-reference/document-apis/get-documents/', title: 'Get Document Source API' },
  { pattern: /^\/?_mget/, url: '/api-reference/document-apis/multi-get/', title: 'Multi-get API' },
  { pattern: /^\/?[^\/]+\/_mget/, url: '/api-reference/document-apis/multi-get/', title: 'Multi-get API' },
  { pattern: /^\/?_bulk$/, url: '/api-reference/document-apis/bulk/', title: 'Bulk API' },
  { pattern: /^\/?[^\/]+\/_bulk$/, url: '/api-reference/document-apis/bulk/', title: 'Bulk API' },
  { pattern: /^\/?[^\/]+\/_delete_by_query/, url: '/api-reference/document-apis/delete-by-query/', title: 'Delete by Query API' },
  { pattern: /^\/?[^\/]+\/_update_by_query/, url: '/api-reference/document-apis/update-by-query/', title: 'Update by Query API' },
  { pattern: /^\/?_reindex/, url: '/api-reference/document-apis/reindex/', title: 'Reindex API' },
  
  // Index APIs
  { pattern: /^\/?[^\/]+\/_mapping/, url: '/api-reference/index-apis/put-mapping/', title: 'Index Mapping API' },
  { pattern: /^\/?[^\/]+\/_settings/, url: '/api-reference/index-apis/update-settings/', title: 'Index Settings API' },
  { pattern: /^\/?[^\/]+\/_refresh/, url: '/api-reference/index-apis/refresh/', title: 'Refresh API' },
  { pattern: /^\/?[^\/]+\/_flush/, url: '/api-reference/index-apis/flush/', title: 'Flush API' },
  { pattern: /^\/?[^\/]+\/_forcemerge/, url: '/api-reference/index-apis/force-merge/', title: 'Force Merge API' },
  { pattern: /^\/?[^\/]+\/_close/, url: '/api-reference/index-apis/close-index/', title: 'Close Index API' },
  { pattern: /^\/?[^\/]+\/_open/, url: '/api-reference/index-apis/open-index/', title: 'Open Index API' },
  { pattern: /^\/?[^\/]+\/_alias/, url: '/api-reference/index-apis/alias/', title: 'Index Alias API' },
  { pattern: /^\/?_aliases/, url: '/api-reference/index-apis/alias/', title: 'Aliases API' },
  { pattern: /^\/?[^\/]+\/_analyze/, url: '/api-reference/analyze-apis/', title: 'Analyze API' },
  { pattern: /^\/?_analyze/, url: '/api-reference/analyze-apis/', title: 'Analyze API' },
  
  // Cluster APIs
  { pattern: /^\/?_cluster\/health/, url: '/api-reference/cluster-api/cluster-health/', title: 'Cluster Health API' },
  { pattern: /^\/?_cluster\/state/, url: '/api-reference/cluster-api/cluster-state/', title: 'Cluster State API' },
  { pattern: /^\/?_cluster\/stats/, url: '/api-reference/cluster-api/cluster-stats/', title: 'Cluster Stats API' },
  { pattern: /^\/?_cluster\/settings/, url: '/api-reference/cluster-api/cluster-settings/', title: 'Cluster Settings API' },
  { pattern: /^\/?_cluster\/allocation/, url: '/api-reference/cluster-api/cluster-allocation/', title: 'Cluster Allocation API' },
  { pattern: /^\/?_cluster\/reroute/, url: '/api-reference/cluster-api/cluster-reroute/', title: 'Cluster Reroute API' },
  { pattern: /^\/?_cluster\/pending_tasks/, url: '/api-reference/cluster-api/cluster-pending/', title: 'Pending Tasks API' },
  
  // CAT APIs
  { pattern: /^\/?_cat\/indices/, url: '/api-reference/cat/cat-indices/', title: 'CAT Indices API' },
  { pattern: /^\/?_cat\/shards/, url: '/api-reference/cat/cat-shards/', title: 'CAT Shards API' },
  { pattern: /^\/?_cat\/nodes/, url: '/api-reference/cat/cat-nodes/', title: 'CAT Nodes API' },
  { pattern: /^\/?_cat\/health/, url: '/api-reference/cat/cat-health/', title: 'CAT Health API' },
  { pattern: /^\/?_cat\/master/, url: '/api-reference/cat/cat-master/', title: 'CAT Master API' },
  { pattern: /^\/?_cat\/aliases/, url: '/api-reference/cat/cat-aliases/', title: 'CAT Aliases API' },
  { pattern: /^\/?_cat\/allocation/, url: '/api-reference/cat/cat-allocation/', title: 'CAT Allocation API' },
  { pattern: /^\/?_cat\/count/, url: '/api-reference/cat/cat-count/', title: 'CAT Count API' },
  { pattern: /^\/?_cat\/plugins/, url: '/api-reference/cat/cat-plugins/', title: 'CAT Plugins API' },
  { pattern: /^\/?_cat\/recovery/, url: '/api-reference/cat/cat-recovery/', title: 'CAT Recovery API' },
  { pattern: /^\/?_cat\/segments/, url: '/api-reference/cat/cat-segments/', title: 'CAT Segments API' },
  { pattern: /^\/?_cat\/tasks/, url: '/api-reference/cat/cat-tasks/', title: 'CAT Tasks API' },
  { pattern: /^\/?_cat\/templates/, url: '/api-reference/cat/cat-templates/', title: 'CAT Templates API' },
  { pattern: /^\/?_cat\/thread_pool/, url: '/api-reference/cat/cat-thread-pool/', title: 'CAT Thread Pool API' },
  { pattern: /^\/?_cat/, url: '/api-reference/cat/index/', title: 'CAT APIs' },
  
  // Nodes APIs
  { pattern: /^\/?_nodes\/stats/, url: '/api-reference/nodes-apis/nodes-stats/', title: 'Nodes Stats API' },
  { pattern: /^\/?_nodes\/info/, url: '/api-reference/nodes-apis/nodes-info/', title: 'Nodes Info API' },
  { pattern: /^\/?_nodes\/hot_threads/, url: '/api-reference/nodes-apis/nodes-hot-threads/', title: 'Nodes Hot Threads API' },
  { pattern: /^\/?_nodes\/usage/, url: '/api-reference/nodes-apis/nodes-usage/', title: 'Nodes Usage API' },
  { pattern: /^\/?_nodes/, url: '/api-reference/nodes-apis/index/', title: 'Nodes APIs' },
  
  // Template APIs
  { pattern: /^\/?_index_template/, url: '/api-reference/index-apis/index-template/', title: 'Index Template API' },
  { pattern: /^\/?_component_template/, url: '/api-reference/index-apis/component-template/', title: 'Component Template API' },
  { pattern: /^\/?_template/, url: '/api-reference/index-apis/index-template/', title: 'Index Template API' },
  
  // Snapshot APIs
  { pattern: /^\/?_snapshot/, url: '/api-reference/snapshots/index/', title: 'Snapshot APIs' },
  
  // Ingest APIs
  { pattern: /^\/?_ingest\/pipeline/, url: '/api-reference/ingest-apis/index/', title: 'Ingest Pipeline API' },
  { pattern: /^\/?_ingest/, url: '/api-reference/ingest-apis/index/', title: 'Ingest APIs' },
  
  // Script APIs
  { pattern: /^\/?_scripts/, url: '/api-reference/script-apis/index/', title: 'Script APIs' },
  
  // Task APIs
  { pattern: /^\/?_tasks/, url: '/api-reference/tasks/', title: 'Tasks API' },
  
  // Security plugin APIs
  { pattern: /^\/?_plugins\/_security\/api\/roles/, url: '/security/access-control/api/#roles', title: 'Security Roles API' },
  { pattern: /^\/?_plugins\/_security\/api\/internalusers/, url: '/security/access-control/api/#internal-users', title: 'Security Users API' },
  { pattern: /^\/?_plugins\/_security\/api\/rolesmapping/, url: '/security/access-control/api/#role-mapping', title: 'Security Role Mapping API' },
  { pattern: /^\/?_plugins\/_security\/api\/actiongroups/, url: '/security/access-control/api/#action-groups', title: 'Security Action Groups API' },
  { pattern: /^\/?_plugins\/_security\/api\/tenants/, url: '/security/access-control/api/#tenants', title: 'Security Tenants API' },
  { pattern: /^\/?_plugins\/_security\/authinfo/, url: '/security/access-control/api/#get-authentication-info', title: 'Security Auth Info API' },
  { pattern: /^\/?_plugins\/_security/, url: '/security/access-control/api/', title: 'Security APIs' },
  
  // SQL plugin
  { pattern: /^\/?_plugins\/_sql/, url: '/search-plugins/sql/sql-ppl-api/', title: 'SQL API' },
  { pattern: /^\/?_plugins\/_ppl/, url: '/search-plugins/sql/sql-ppl-api/', title: 'PPL API' },
  
  // Anomaly Detection plugin
  { pattern: /^\/?_plugins\/_anomaly_detection/, url: '/observing-your-data/ad/api/', title: 'Anomaly Detection API' },
  
  // Alerting plugin
  { pattern: /^\/?_plugins\/_alerting/, url: '/observing-your-data/alerting/api/', title: 'Alerting API' },
  
  // ISM plugin
  { pattern: /^\/?_plugins\/_ism/, url: '/im-plugin/ism/api/', title: 'Index State Management API' },
  
  // k-NN plugin
  { pattern: /^\/?_plugins\/_knn/, url: '/search-plugins/knn/api/', title: 'k-NN API' },
  
  // Asynchronous search
  { pattern: /^\/?_plugins\/_asynchronous_search/, url: '/search-plugins/async/index/', title: 'Asynchronous Search API' },
  
  // Generic index operations (PUT/DELETE on index name)
  { pattern: /^\/[^_][^\/]*$/, url: '/api-reference/index-apis/create-index/', title: 'Index API' },
];

/**
 * Get documentation info for an endpoint
 * @param endpoint - The API endpoint (e.g., "/_search" or "/my-index/_search")
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @returns Documentation URL and title, or null if no mapping found
 */
export function getApiDocumentation(endpoint: string, _method?: string): { url: string; title: string } | null {
  // Normalize endpoint - remove leading slash inconsistencies
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Remove query parameters
  const pathOnly = normalizedEndpoint.split('?')[0] || normalizedEndpoint;
  
  for (const mapping of DOC_MAPPINGS) {
    if (mapping.pattern.test(pathOnly)) {
      return {
        url: `${DOCS_BASE_URL}${mapping.url}`,
        title: mapping.title,
      };
    }
  }
  
  // Default to API reference index
  return {
    url: `${DOCS_BASE_URL}/api-reference/index/`,
    title: 'OpenSearch API Reference',
  };
}

/**
 * Open documentation in external browser
 * @param endpoint - The API endpoint
 * @param method - HTTP method
 */
export async function openApiDocumentation(endpoint: string, method?: string): Promise<void> {
  const doc = getApiDocumentation(endpoint, method);
  if (doc) {
    await openExternal(doc.url);
  }
}
