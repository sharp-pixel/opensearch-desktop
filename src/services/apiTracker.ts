// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * API Tracker Service for OpenSearch Notebook
 * Monitors and records all OpenSearch API endpoints invoked during notebook execution
 * Requirements: 2.7, 5.1, 5.2, 5.4, 5.5
 */

import type { HttpMethod } from '../types/cell';
import type {
  TrackedOperation,
  CategorizedPermission,
  ApiTrackerState,
} from '../types/tracking';
import {
  parseEndpoint,
  extractIndexPatterns,
  normalizeEndpoint,
} from './endpointParser';
import {
  saveTracking,
  loadTracking,
  clearTracking as persistClearTracking,
} from './persistence';

/**
 * API to permission mapping for common OpenSearch endpoints
 */
type PermissionMappingEntry =
  | { type: 'cluster' | 'index'; permission: string }
  | { permissions: CategorizedPermission[] };

const API_PERMISSION_MAP: Record<string, PermissionMappingEntry> = {
  // Main
  'GET /': { type: 'cluster', permission: 'cluster:monitor/main' },
  'HEAD /': { type: 'cluster', permission: 'cluster:monitor/main' },

  // Search operations
  'GET /{index}/_search': {
    permissions: [
      { type: 'index', permission: 'indices:data/read/search' },
      { type: 'index', permission: 'indices:data/read/search/stream' },
    ],
  },
  'POST /{index}/_search': {
    permissions: [
      { type: 'index', permission: 'indices:data/read/search' },
      { type: 'index', permission: 'indices:data/read/search/stream' },
    ],
  },
  'GET /_search': {
    permissions: [
      { type: 'index', permission: 'indices:data/read/search' },
      { type: 'index', permission: 'indices:data/read/search/stream' },
    ],
  },
  'POST /_search': {
    permissions: [
      { type: 'index', permission: 'indices:data/read/search' },
      { type: 'index', permission: 'indices:data/read/search/stream' },
    ],
  },
  'GET /_search/scroll': { type: 'index', permission: 'indices:data/read/scroll' },
  'POST /_search/scroll': { type: 'index', permission: 'indices:data/read/scroll' },
  'GET /_search/scroll/{scroll_id}': { type: 'index', permission: 'indices:data/read/scroll' },
  'POST /_search/scroll/{scroll_id}': { type: 'index', permission: 'indices:data/read/scroll' },
  'DELETE /_search/scroll': { type: 'index', permission: 'indices:data/read/scroll/clear' },
  'DELETE /_search/scroll/{scroll_id}': { type: 'index', permission: 'indices:data/read/scroll/clear' },
  'GET /_search/point_in_time/_all': {
    type: 'index',
    permission: 'indices:data/read/point_in_time/readall',
  },
  'DELETE /_search/point_in_time': {
    type: 'index',
    permission: 'indices:data/read/point_in_time/delete',
  },
  'DELETE /_search/point_in_time/_all': {
    type: 'index',
    permission: 'indices:data/read/point_in_time/delete',
  },
  'POST /{index}/_search/point_in_time': {
    type: 'index',
    permission: 'indices:data/read/point_in_time/create',
  },
  'GET /_search/template': {
    type: 'index',
    permission: 'indices:data/read/search/template',
  },
  'POST /_search/template': {
    type: 'index',
    permission: 'indices:data/read/search/template',
  },
  'GET /{index}/_search/template': {
    type: 'index',
    permission: 'indices:data/read/search/template',
  },
  'POST /{index}/_search/template': {
    type: 'index',
    permission: 'indices:data/read/search/template',
  },
  'GET /_render/template': {
    type: 'index',
    permission: 'indices:data/read/search/template/render',
  },
  'POST /_render/template': {
    type: 'index',
    permission: 'indices:data/read/search/template/render',
  },
  'GET /_render/template/{id}': {
    type: 'index',
    permission: 'indices:data/read/search/template/render',
  },
  'POST /_render/template/{id}': {
    type: 'index',
    permission: 'indices:data/read/search/template/render',
  },
  'GET /_search_shards': { type: 'index', permission: 'indices:admin/shards/search_shards' },
  'POST /_search_shards': { type: 'index', permission: 'indices:admin/shards/search_shards' },
  'GET /{index}/_search_shards': { type: 'index', permission: 'indices:admin/shards/search_shards' },
  'POST /{index}/_search_shards': { type: 'index', permission: 'indices:admin/shards/search_shards' },
  'GET /_search/pipeline': { type: 'cluster', permission: 'cluster:admin/search/pipeline/get' },
  'GET /_search/pipeline/{id}': { type: 'cluster', permission: 'cluster:admin/search/pipeline/get' },
  'PUT /_search/pipeline/{id}': { type: 'cluster', permission: 'cluster:admin/search/pipeline/put' },
  'DELETE /_search/pipeline/{id}': { type: 'cluster', permission: 'cluster:admin/search/pipeline/delete' },
  'GET /_count': { type: 'index', permission: 'indices:data/read/search' },
  'POST /_count': { type: 'index', permission: 'indices:data/read/search' },
  'GET /{index}/_count': { type: 'index', permission: 'indices:data/read/search' },
  'POST /{index}/_count': { type: 'index', permission: 'indices:data/read/search' },
  'GET /_rank_eval': { type: 'index', permission: 'indices:data/read/rank_eval' },
  'POST /_rank_eval': { type: 'index', permission: 'indices:data/read/rank_eval' },
  'GET /{index}/_rank_eval': { type: 'index', permission: 'indices:data/read/rank_eval' },
  'POST /{index}/_rank_eval': { type: 'index', permission: 'indices:data/read/rank_eval' },
  
  // Document operations
  'GET /{index}/_doc/{id}': { type: 'index', permission: 'indices:data/read/get' },
  'HEAD /{index}/_doc/{id}': { type: 'index', permission: 'indices:data/read/get' },
  'PUT /{index}/_doc/{id}': { type: 'index', permission: 'indices:data/write/index' },
  'POST /{index}/_doc/{id}': { type: 'index', permission: 'indices:data/write/index' },
  'POST /{index}/_doc': { type: 'index', permission: 'indices:data/write/index' },
  'POST /{index}/_create/{id}': { type: 'index', permission: 'indices:data/write/index' },
  'PUT /{index}/_create/{id}': { type: 'index', permission: 'indices:data/write/index' },
  'DELETE /{index}/_doc/{id}': { type: 'index', permission: 'indices:data/write/delete' },
  'POST /{index}/_update/{id}': { type: 'index', permission: 'indices:data/write/update' },
  'GET /{index}/_source/{id}': { type: 'index', permission: 'indices:data/read/get' },
  'HEAD /{index}/_source/{id}': { type: 'index', permission: 'indices:data/read/get' },
  
  // Bulk operations
  'POST /_bulk': { type: 'index', permission: 'indices:data/write/bulk' },
  'PUT /_bulk': { type: 'index', permission: 'indices:data/write/bulk' },
  'POST /_bulk/stream': { type: 'index', permission: 'indices:data/write/bulk' },
  'PUT /_bulk/stream': { type: 'index', permission: 'indices:data/write/bulk' },
  'POST /{index}/_bulk': { type: 'index', permission: 'indices:data/write/bulk' },
  'PUT /{index}/_bulk': { type: 'index', permission: 'indices:data/write/bulk' },
  'POST /{index}/_bulk/stream': { type: 'index', permission: 'indices:data/write/bulk' },
  'PUT /{index}/_bulk/stream': { type: 'index', permission: 'indices:data/write/bulk' },
  
  // Multi-get operations
  'GET /_mget': { type: 'index', permission: 'indices:data/read/mget' },
  'POST /_mget': { type: 'index', permission: 'indices:data/read/mget' },
  'GET /{index}/_mget': { type: 'index', permission: 'indices:data/read/mget' },
  'POST /{index}/_mget': { type: 'index', permission: 'indices:data/read/mget' },
  
  // Multi-search operations
  'GET /_msearch': { type: 'index', permission: 'indices:data/read/msearch' },
  'POST /_msearch': { type: 'index', permission: 'indices:data/read/msearch' },
  'GET /_msearch/template': { type: 'index', permission: 'indices:data/read/msearch/template' },
  'POST /_msearch/template': { type: 'index', permission: 'indices:data/read/msearch/template' },
  'GET /{index}/_msearch': { type: 'index', permission: 'indices:data/read/msearch' },
  'POST /{index}/_msearch': { type: 'index', permission: 'indices:data/read/msearch' },
  'GET /{index}/_msearch/template': { type: 'index', permission: 'indices:data/read/msearch/template' },
  'POST /{index}/_msearch/template': { type: 'index', permission: 'indices:data/read/msearch/template' },
  
  // Delete/Update by query
  'POST /{index}/_delete_by_query': { type: 'index', permission: 'indices:data/write/delete/byquery' },
  'POST /{index}/_update_by_query': { type: 'index', permission: 'indices:data/write/update/byquery' },
  
  // Index management
  'PUT /{index}': { type: 'index', permission: 'indices:admin/create' },
  'DELETE /{index}': { type: 'index', permission: 'indices:admin/delete' },
  'GET /{index}': { type: 'index', permission: 'indices:admin/get' },
  'HEAD /{index}': { type: 'index', permission: 'indices:admin/exists' },
  'GET /{index}/_mapping': { type: 'index', permission: 'indices:admin/mappings/get' },
  'GET /{index}/_mappings': { type: 'index', permission: 'indices:admin/mappings/get' },
  'GET /_mapping': { type: 'index', permission: 'indices:admin/mappings/get' },
  'GET /_mappings': { type: 'index', permission: 'indices:admin/mappings/get' },
  'GET /_mapping/field/{fields}': {
    type: 'index',
    permission: 'indices:admin/mappings/fields/get',
  },
  'GET /{index}/_mapping/field/{fields}': {
    type: 'index',
    permission: 'indices:admin/mappings/fields/get',
  },
  'PUT /{index}/_mapping': { type: 'index', permission: 'indices:admin/mapping/put' },
  'PUT /{index}/_mappings': { type: 'index', permission: 'indices:admin/mapping/put' },
  'POST /{index}/_mapping': { type: 'index', permission: 'indices:admin/mapping/put' },
  'GET /{index}/_settings': { type: 'index', permission: 'indices:monitor/settings/get' },
  'GET /{index}/_settings/{name}': { type: 'index', permission: 'indices:monitor/settings/get' },
  'GET /{index}/_setting/{name}': { type: 'index', permission: 'indices:monitor/settings/get' },
  'GET /_settings': { type: 'index', permission: 'indices:monitor/settings/get' },
  'GET /_settings/{name}': { type: 'index', permission: 'indices:monitor/settings/get' },
  'PUT /{index}/_settings': { type: 'index', permission: 'indices:admin/settings/update' },
  'PUT /_settings': { type: 'index', permission: 'indices:admin/settings/update' },
  'GET /_refresh': { type: 'index', permission: 'indices:admin/refresh' },
  'POST /_refresh': { type: 'index', permission: 'indices:admin/refresh' },
  'POST /{index}/_refresh': { type: 'index', permission: 'indices:admin/refresh' },
  'GET /{index}/_refresh': { type: 'index', permission: 'indices:admin/refresh' },
  'GET /_flush': { type: 'index', permission: 'indices:admin/flush' },
  'POST /_flush': { type: 'index', permission: 'indices:admin/flush' },
  'POST /{index}/_flush': { type: 'index', permission: 'indices:admin/flush' },
  'GET /{index}/_flush': { type: 'index', permission: 'indices:admin/flush' },
  'GET /_flush/synced': { type: 'index', permission: 'indices:admin/flush' },
  'POST /_flush/synced': { type: 'index', permission: 'indices:admin/flush' },
  'GET /{index}/_flush/synced': { type: 'index', permission: 'indices:admin/flush' },
  'POST /{index}/_flush/synced': { type: 'index', permission: 'indices:admin/flush' },
  'POST /_cache/clear': { type: 'index', permission: 'indices:admin/cache/clear' },
  'POST /{index}/_cache/clear': { type: 'index', permission: 'indices:admin/cache/clear' },
  'POST /_forcemerge': { type: 'index', permission: 'indices:admin/forcemerge' },
  'POST /{index}/_forcemerge': { type: 'index', permission: 'indices:admin/forcemerge' },
  'POST /{index}/_close': { type: 'index', permission: 'indices:admin/close' },
  'POST /{index}/_open': { type: 'index', permission: 'indices:admin/open' },
  'GET /_stats': { type: 'index', permission: 'indices:monitor/stats' },
  'GET /_stats/{metric}': { type: 'index', permission: 'indices:monitor/stats' },
  'GET /{index}/_stats': { type: 'index', permission: 'indices:monitor/stats' },
  'GET /{index}/_stats/{metric}': { type: 'index', permission: 'indices:monitor/stats' },
  'GET /_segments': { type: 'index', permission: 'indices:monitor/segments' },
  'GET /{index}/_segments': { type: 'index', permission: 'indices:monitor/segments' },
  'GET /_recovery': { type: 'index', permission: 'indices:monitor/recovery' },
  'GET /{index}/_recovery': { type: 'index', permission: 'indices:monitor/recovery' },
  'GET /_shard_stores': { type: 'index', permission: 'indices:monitor/shard_stores' },
  'GET /{index}/_shard_stores': { type: 'index', permission: 'indices:monitor/shard_stores' },
  'GET /_field_caps': { type: 'index', permission: 'indices:data/read/field_caps' },
  'POST /_field_caps': { type: 'index', permission: 'indices:data/read/field_caps' },
  'GET /{index}/_field_caps': { type: 'index', permission: 'indices:data/read/field_caps' },
  'POST /{index}/_field_caps': { type: 'index', permission: 'indices:data/read/field_caps' },
  'POST /_upgrade': { type: 'index', permission: 'indices:admin/upgrade' },
  'GET /_upgrade': { type: 'index', permission: 'indices:admin/upgrade' },
  'POST /{index}/_upgrade': { type: 'index', permission: 'indices:admin/upgrade' },
  'GET /{index}/_upgrade': { type: 'index', permission: 'indices:admin/upgrade' },
  'PUT /{index}/_block/{block}': { type: 'index', permission: 'indices:admin/block/add' },
  'POST /{index}/_rollover': { type: 'index', permission: 'indices:admin/rollover' },
  'POST /{index}/_rollover/{new_index}': { type: 'index', permission: 'indices:admin/rollover' },
  'POST /{alias}/_rollover': { type: 'index', permission: 'indices:admin/rollover' },
  'POST /{alias}/_rollover/{new_index}': { type: 'index', permission: 'indices:admin/rollover' },
  'POST /{index}/_shrink/{target}': { type: 'index', permission: 'indices:admin/resize' },
  'PUT /{index}/_shrink/{target}': { type: 'index', permission: 'indices:admin/resize' },
  'POST /{index}/_split/{target}': { type: 'index', permission: 'indices:admin/resize' },
  'PUT /{index}/_split/{target}': { type: 'index', permission: 'indices:admin/resize' },
  'POST /{index}/_clone/{target}': { type: 'index', permission: 'indices:admin/resize' },
  'PUT /{index}/_clone/{target}': { type: 'index', permission: 'indices:admin/resize' },
  'POST /{index}/_scale': { type: 'index', permission: 'indices:admin/scale/search_only' },
  
  // Data stream operations
  'GET /_data_stream': { type: 'index', permission: 'indices:admin/data_stream/get' },
  'GET /_data_stream/{name}': { type: 'index', permission: 'indices:admin/data_stream/get' },
  'PUT /_data_stream/{name}': { type: 'index', permission: 'indices:admin/data_stream/create' },
  'DELETE /_data_stream/{name}': { type: 'index', permission: 'indices:admin/data_stream/delete' },
  'GET /_data_stream/_stats': { type: 'index', permission: 'indices:monitor/data_stream/stats' },
  'GET /_data_stream/{name}/_stats': { type: 'index', permission: 'indices:monitor/data_stream/stats' },
  
  // Resolve index
  'GET /_resolve/index/{name}': { type: 'index', permission: 'indices:admin/resolve/index' },
  
  // Alias operations
  'GET /_alias': { type: 'index', permission: 'indices:admin/aliases/get' },
  'GET /_alias/{name}': { type: 'index', permission: 'indices:admin/aliases/get' },
  'HEAD /_alias/{name}': { type: 'index', permission: 'indices:admin/aliases/get' },
  'GET /{index}/_alias': { type: 'index', permission: 'indices:admin/aliases/get' },
  'GET /{index}/_alias/{name}': { type: 'index', permission: 'indices:admin/aliases/get' },
  'HEAD /{index}/_alias': { type: 'index', permission: 'indices:admin/aliases/get' },
  'HEAD /{index}/_alias/{name}': { type: 'index', permission: 'indices:admin/aliases/get' },
  'POST /_alias': { type: 'index', permission: 'indices:admin/aliases' },
  'POST /_alias/{name}': { type: 'index', permission: 'indices:admin/aliases' },
  'POST /_aliases/{name}': { type: 'index', permission: 'indices:admin/aliases' },
  'PUT /_alias': { type: 'index', permission: 'indices:admin/aliases' },
  'PUT /_alias/{name}': { type: 'index', permission: 'indices:admin/aliases' },
  'PUT /_aliases/{name}': { type: 'index', permission: 'indices:admin/aliases' },
  'PUT /{index}/_alias': { type: 'index', permission: 'indices:admin/aliases' },
  'PUT /{index}/_alias/{name}': { type: 'index', permission: 'indices:admin/aliases' },
  'POST /{index}/_alias/{name}': { type: 'index', permission: 'indices:admin/aliases' },
  'PUT /{index}/_aliases': { type: 'index', permission: 'indices:admin/aliases' },
  'POST /{index}/_aliases/{name}': { type: 'index', permission: 'indices:admin/aliases' },
  'PUT /{index}/_aliases/{name}': { type: 'index', permission: 'indices:admin/aliases' },
  'DELETE /{index}/_alias/{name}': { type: 'index', permission: 'indices:admin/aliases' },
  'DELETE /{index}/_aliases/{name}': { type: 'index', permission: 'indices:admin/aliases' },
  'GET /_aliases': { type: 'index', permission: 'indices:admin/aliases/get' },
  'POST /_aliases': { type: 'index', permission: 'indices:admin/aliases' },
  
  // Analyze
  'GET /_analyze': { type: 'index', permission: 'indices:admin/analyze' },
  'POST /_analyze': { type: 'index', permission: 'indices:admin/analyze' },
  'GET /{index}/_analyze': { type: 'index', permission: 'indices:admin/analyze' },
  'POST /{index}/_analyze': { type: 'index', permission: 'indices:admin/analyze' },
  
  // Validate query
  'GET /_validate/query': { type: 'index', permission: 'indices:admin/validate/query' },
  'POST /_validate/query': { type: 'index', permission: 'indices:admin/validate/query' },
  'GET /{index}/_validate/query': { type: 'index', permission: 'indices:admin/validate/query' },
  'POST /{index}/_validate/query': { type: 'index', permission: 'indices:admin/validate/query' },
  
  // Explain
  'GET /{index}/_explain/{id}': { type: 'index', permission: 'indices:data/read/explain' },
  'POST /{index}/_explain/{id}': { type: 'index', permission: 'indices:data/read/explain' },
  
  // Term vectors
  'GET /_mtermvectors': { type: 'index', permission: 'indices:data/read/mtv' },
  'POST /_mtermvectors': { type: 'index', permission: 'indices:data/read/mtv' },
  'GET /{index}/_termvectors': { type: 'index', permission: 'indices:data/read/tv' },
  'POST /{index}/_termvectors': { type: 'index', permission: 'indices:data/read/tv' },
  'GET /{index}/_termvectors/{id}': { type: 'index', permission: 'indices:data/read/tv' },
  'POST /{index}/_termvectors/{id}': { type: 'index', permission: 'indices:data/read/tv' },
  'GET /{index}/_mtermvectors': { type: 'index', permission: 'indices:data/read/mtv' },
  'POST /{index}/_mtermvectors': { type: 'index', permission: 'indices:data/read/mtv' },
  
  // Dangling indices
  'GET /_dangling': { type: 'cluster', permission: 'cluster:admin/indices/dangling/list' },
  'POST /_dangling/{index_uuid}': {
    type: 'cluster',
    permission: 'cluster:admin/indices/dangling/import',
  },
  'DELETE /_dangling/{index_uuid}': {
    type: 'cluster',
    permission: 'cluster:admin/indices/dangling/delete',
  },
  
  // Cluster operations
  'GET /_cluster/health': { type: 'cluster', permission: 'cluster:monitor/health' },
  'GET /_cluster/health/{index}': { type: 'cluster', permission: 'cluster:monitor/health' },
  'GET /_cluster/state': { type: 'cluster', permission: 'cluster:monitor/state' },
  'GET /_cluster/state/{metric}': { type: 'cluster', permission: 'cluster:monitor/state' },
  'GET /_cluster/state/{metric}/{index}': { type: 'cluster', permission: 'cluster:monitor/state' },
  'GET /_cluster/stats': { type: 'cluster', permission: 'cluster:monitor/stats' },
  'GET /_cluster/stats/nodes/{node_id}': { type: 'cluster', permission: 'cluster:monitor/stats' },
  'GET /_cluster/stats/{metric}/nodes/{node_id}': { type: 'cluster', permission: 'cluster:monitor/stats' },
  'GET /_cluster/stats/{metric}/{index_metric}/nodes/{node_id}': {
    type: 'cluster',
    permission: 'cluster:monitor/stats',
  },
  'GET /_cluster/settings': { type: 'cluster', permission: 'cluster:monitor/state' },
  'PUT /_cluster/settings': { type: 'cluster', permission: 'cluster:admin/settings/update' },
  'GET /_cluster/pending_tasks': { type: 'cluster', permission: 'cluster:monitor/task' },
  'GET /_remote/info': { type: 'cluster', permission: 'cluster:monitor/remote/info' },
  'GET /_list/wlm_stats': { type: 'cluster', permission: 'cluster:monitor/wlm/stats' },
  'GET /_list/wlm_stats/{node_id}/stats': {
    type: 'cluster',
    permission: 'cluster:monitor/wlm/stats',
  },
  'GET /_list/wlm_stats/stats/{workload_group_id}': {
    type: 'cluster',
    permission: 'cluster:monitor/wlm/stats',
  },
  'GET /_list/wlm_stats/{node_id}/stats/{workload_group_id}': {
    type: 'cluster',
    permission: 'cluster:monitor/wlm/stats',
  },
  'GET /_cluster/allocation/explain': { type: 'cluster', permission: 'cluster:monitor/allocation/explain' },
  'POST /_cluster/allocation/explain': { type: 'cluster', permission: 'cluster:monitor/allocation/explain' },
  'POST /_cluster/reroute': { type: 'cluster', permission: 'cluster:admin/reroute' },
  'GET /_cluster/routing/awareness/{attribute}/weights': {
    type: 'cluster',
    permission: 'cluster:admin/routing/awareness/weights/get',
  },
  'PUT /_cluster/routing/awareness/{attribute}/weights': {
    type: 'cluster',
    permission: 'cluster:admin/routing/awareness/weights/put',
  },
  'DELETE /_cluster/routing/awareness/weights': {
    type: 'cluster',
    permission: 'cluster:admin/routing/awareness/weights/delete',
  },
  'DELETE /_cluster/routing/awareness/{attribute}/weights': {
    type: 'cluster',
    permission: 'cluster:admin/routing/awareness/weights/delete',
  },
  'PUT /_cluster/decommission/awareness/{awareness_attribute_name}/{awareness_attribute_value}': {
    type: 'cluster',
    permission: 'cluster:admin/decommission/awareness/put',
  },
  'GET /_cluster/decommission/awareness/{awareness_attribute_name}/_status': {
    type: 'cluster',
    permission: 'cluster:admin/decommission/awareness/get',
  },
  'DELETE /_cluster/decommission/awareness': {
    type: 'cluster',
    permission: 'cluster:admin/decommission/awareness/delete',
  },
  'DELETE /_cluster/decommission/awareness/': {
    type: 'cluster',
    permission: 'cluster:admin/decommission/awareness/delete',
  },
  'POST /_cluster/voting_config_exclusions': {
    type: 'cluster',
    permission: 'cluster:admin/voting_config/add_exclusions',
  },
  'POST /_cluster/voting_config_exclusions/{node_name}': {
    type: 'cluster',
    permission: 'cluster:admin/voting_config/add_exclusions',
  },
  'DELETE /_cluster/voting_config_exclusions': {
    type: 'cluster',
    permission: 'cluster:admin/voting_config/clear_exclusions',
  },

  // Remote store operations
  'GET /_remotestore/stats/{index}': {
    type: 'cluster',
    permission: 'cluster:monitor/_remotestore/stats',
  },
  'GET /_remotestore/stats/{index}/{shard_id}': {
    type: 'cluster',
    permission: 'cluster:monitor/_remotestore/stats',
  },
  'POST /_remotestore/_restore': {
    type: 'cluster',
    permission: 'cluster:admin/remotestore/restore',
  },
  
  // Node operations
  'GET /_nodes': { type: 'cluster', permission: 'cluster:monitor/nodes/info' },
  'GET /_nodes/{node_id}': { type: 'cluster', permission: 'cluster:monitor/nodes/info' },
  'GET /_nodes/{metric}': { type: 'cluster', permission: 'cluster:monitor/nodes/info' },
  'GET /_nodes/{node_id}/{metric}': { type: 'cluster', permission: 'cluster:monitor/nodes/info' },
  'GET /_nodes/{node_id}/info/{metric}': { type: 'cluster', permission: 'cluster:monitor/nodes/info' },
  'GET /_nodes/stats': { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
  'GET /_nodes/stats/{metric}': { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
  'GET /_nodes/stats/{metric}/{index_metric}': {
    type: 'cluster',
    permission: 'cluster:monitor/nodes/stats',
  },
  'GET /_nodes/{node_id}/stats': { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
  'GET /_nodes/{node_id}/stats/{metric}': { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
  'GET /_nodes/{node_id}/stats/{metric}/{index_metric}': {
    type: 'cluster',
    permission: 'cluster:monitor/nodes/stats',
  },
  'GET /_nodes/hot_threads': { type: 'cluster', permission: 'cluster:monitor/nodes/hot_threads' },
  'GET /_nodes/{node_id}/hot_threads': { type: 'cluster', permission: 'cluster:monitor/nodes/hot_threads' },
  'GET /_nodes/hotthreads': { type: 'cluster', permission: 'cluster:monitor/nodes/hot_threads' },
  'GET /_nodes/{node_id}/hotthreads': { type: 'cluster', permission: 'cluster:monitor/nodes/hot_threads' },
  'GET /_cluster/nodes/hot_threads': { type: 'cluster', permission: 'cluster:monitor/nodes/hot_threads' },
  'GET /_cluster/nodes/{node_id}/hot_threads': {
    type: 'cluster',
    permission: 'cluster:monitor/nodes/hot_threads',
  },
  'GET /_cluster/nodes/hotthreads': { type: 'cluster', permission: 'cluster:monitor/nodes/hot_threads' },
  'GET /_cluster/nodes/{node_id}/hotthreads': {
    type: 'cluster',
    permission: 'cluster:monitor/nodes/hot_threads',
  },
  'GET /_nodes/usage': { type: 'cluster', permission: 'cluster:monitor/nodes/usage' },
  'GET /_nodes/usage/{metric}': { type: 'cluster', permission: 'cluster:monitor/nodes/usage' },
  'GET /_nodes/{node_id}/usage': { type: 'cluster', permission: 'cluster:monitor/nodes/usage' },
  'GET /_nodes/{node_id}/usage/{metric}': { type: 'cluster', permission: 'cluster:monitor/nodes/usage' },
  'GET /_nodes/flight/stats': { type: 'cluster', permission: 'cluster:monitor/flight/stats' },
  'GET /_nodes/{node_id}/flight/stats': { type: 'cluster', permission: 'cluster:monitor/flight/stats' },
  'GET /_flight/stats': { type: 'cluster', permission: 'cluster:monitor/flight/stats' },
  'GET /_flight/stats/{node_id}': { type: 'cluster', permission: 'cluster:monitor/flight/stats' },
  'POST /_nodes/reload_secure_settings': {
    type: 'cluster',
    permission: 'cluster:admin/nodes/reload_secure_settings',
  },
  'POST /_nodes/{node_id}/reload_secure_settings': {
    type: 'cluster',
    permission: 'cluster:admin/nodes/reload_secure_settings',
  },
  
  // Cat APIs
  'GET /_cat': { type: 'cluster', permission: 'cluster:admin/unknown' },
  'GET /_cat/indices': {
    permissions: [
      { type: 'index', permission: 'indices:monitor/settings/get' },
      { type: 'index', permission: 'indices:monitor/stats' },
      { type: 'cluster', permission: 'cluster:monitor/state' },
      { type: 'cluster', permission: 'cluster:monitor/health' },
    ],
  },
  'GET /_cat/indices/{index}': {
    permissions: [
      { type: 'index', permission: 'indices:monitor/settings/get' },
      { type: 'index', permission: 'indices:monitor/stats' },
      { type: 'cluster', permission: 'cluster:monitor/state' },
      { type: 'cluster', permission: 'cluster:monitor/health' },
    ],
  },
  'GET /_cat/nodes': {
    permissions: [
      { type: 'cluster', permission: 'cluster:monitor/state' },
      { type: 'cluster', permission: 'cluster:monitor/nodes/info' },
      { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
    ],
  },
  'GET /_cat/shards': { type: 'cluster', permission: 'cluster:monitor/shards' },
  'GET /_cat/shards/{index}': { type: 'cluster', permission: 'cluster:monitor/shards' },
  'GET /_cat/health': { type: 'cluster', permission: 'cluster:monitor/health' },
  'GET /_cat/allocation': {
    permissions: [
      { type: 'cluster', permission: 'cluster:monitor/state' },
      { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
    ],
  },
  'GET /_cat/allocation/{node_id}': {
    permissions: [
      { type: 'cluster', permission: 'cluster:monitor/state' },
      { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
    ],
  },
  'GET /_cat/master': { type: 'cluster', permission: 'cluster:monitor/state' },
  'GET /_cat/cluster_manager': { type: 'cluster', permission: 'cluster:monitor/state' },
  'GET /_cat/segments': {
    permissions: [
      { type: 'cluster', permission: 'cluster:monitor/state' },
      { type: 'index', permission: 'indices:monitor/segments' },
    ],
  },
  'GET /_cat/segments/{index}': {
    permissions: [
      { type: 'cluster', permission: 'cluster:monitor/state' },
      { type: 'index', permission: 'indices:monitor/segments' },
    ],
  },
  'GET /_cat/count': { type: 'index', permission: 'indices:data/read/search' },
  'GET /_cat/count/{index}': { type: 'index', permission: 'indices:data/read/search' },
  'GET /_cat/recovery': { type: 'index', permission: 'indices:monitor/recovery' },
  'GET /_cat/recovery/{index}': { type: 'index', permission: 'indices:monitor/recovery' },
  'GET /_cat/pending_tasks': { type: 'cluster', permission: 'cluster:monitor/task' },
  'GET /_cat/aliases': { type: 'index', permission: 'indices:admin/aliases/get' },
  'GET /_cat/aliases/{name}': { type: 'index', permission: 'indices:admin/aliases/get' },
  'GET /_cat/fielddata': { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
  'GET /_cat/fielddata/{fields}': { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
  'GET /_cat/nodeattrs': { type: 'cluster', permission: 'cluster:monitor/state' },
  'GET /_cat/repositories': { type: 'cluster', permission: 'cluster:admin/repository/get' },
  'GET /_cat/snapshots': { type: 'cluster', permission: 'cluster:admin/snapshot/get' },
  'GET /_cat/snapshots/{repository}': { type: 'cluster', permission: 'cluster:admin/snapshot/get' },
  'GET /_cat/tasks': { type: 'cluster', permission: 'cluster:monitor/tasks/lists' },
  'GET /_cat/pit_segments': {
    type: 'cluster',
    permission: 'indices:monitor/point_in_time/segments',
  },
  'GET /_cat/pit_segments/_all': {
    type: 'cluster',
    permission: 'indices:monitor/point_in_time/segments',
  },
  'GET /_cat/segment_replication': {
    type: 'index',
    permission: 'indices:monitor/segment_replication',
  },
  'GET /_cat/segment_replication/{index}': {
    type: 'index',
    permission: 'indices:monitor/segment_replication',
  },
  'GET /_cat/thread_pool': {
    permissions: [
      { type: 'cluster', permission: 'cluster:monitor/state' },
      { type: 'cluster', permission: 'cluster:monitor/nodes/info' },
      { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
    ],
  },
  'GET /_cat/thread_pool/{thread_pool_patterns}': {
    permissions: [
      { type: 'cluster', permission: 'cluster:monitor/state' },
      { type: 'cluster', permission: 'cluster:monitor/nodes/info' },
      { type: 'cluster', permission: 'cluster:monitor/nodes/stats' },
    ],
  },
  'GET /_cat/plugins': {
    permissions: [
      { type: 'cluster', permission: 'cluster:monitor/state' },
      { type: 'cluster', permission: 'cluster:monitor/nodes/info' },
    ],
  },
  'GET /_cat/templates': { type: 'cluster', permission: 'cluster:monitor/state' },
  'GET /_cat/templates/{name}': { type: 'cluster', permission: 'cluster:monitor/state' },
  'GET /_cat/example': { type: 'cluster', permission: 'cluster:admin/unknown' },
  'POST /_cat/example': { type: 'cluster', permission: 'cluster:admin/unknown' },
  
  // Template operations
  'GET /_template': { type: 'cluster', permission: 'indices:admin/template/get' },
  'GET /_template/{name}': { type: 'cluster', permission: 'indices:admin/template/get' },
  'HEAD /_template/{name}': { type: 'cluster', permission: 'indices:admin/template/get' },
  'PUT /_template/{name}': { type: 'cluster', permission: 'indices:admin/template/put' },
  'POST /_template/{name}': { type: 'cluster', permission: 'indices:admin/template/put' },
  'DELETE /_template/{name}': { type: 'cluster', permission: 'indices:admin/template/delete' },
  'GET /_index_template': { type: 'cluster', permission: 'indices:admin/index_template/get' },
  'GET /_index_template/{name}': { type: 'cluster', permission: 'indices:admin/index_template/get' },
  'HEAD /_index_template/{name}': { type: 'cluster', permission: 'indices:admin/index_template/get' },
  'PUT /_index_template/{name}': { type: 'cluster', permission: 'indices:admin/index_template/put' },
  'POST /_index_template/{name}': { type: 'cluster', permission: 'indices:admin/index_template/put' },
  'DELETE /_index_template/{name}': { type: 'cluster', permission: 'indices:admin/index_template/delete' },
  'POST /_index_template/_simulate': {
    type: 'cluster',
    permission: 'indices:admin/index_template/simulate',
  },
  'POST /_index_template/_simulate/{name}': {
    type: 'cluster',
    permission: 'indices:admin/index_template/simulate',
  },
  'POST /_index_template/_simulate_index/{name}': {
    type: 'cluster',
    permission: 'indices:admin/index_template/simulate_index',
  },
  'GET /_component_template': { type: 'cluster', permission: 'cluster:admin/component_template/get' },
  'GET /_component_template/{name}': { type: 'cluster', permission: 'cluster:admin/component_template/get' },
  'HEAD /_component_template/{name}': { type: 'cluster', permission: 'cluster:admin/component_template/get' },
  'POST /_component_template/{name}': { type: 'cluster', permission: 'cluster:admin/component_template/put' },
  'PUT /_component_template/{name}': { type: 'cluster', permission: 'cluster:admin/component_template/put' },
  'DELETE /_component_template/{name}': { type: 'cluster', permission: 'cluster:admin/component_template/delete' },
  
  // Reindex
  'POST /_reindex': { type: 'index', permission: 'indices:data/write/reindex' },
  'POST /_reindex/{task_id}/_rethrottle': {
    type: 'cluster',
    permission: 'cluster:admin/reindex/rethrottle',
  },
  'POST /_update_by_query/{task_id}/_rethrottle': {
    type: 'cluster',
    permission: 'cluster:admin/reindex/rethrottle',
  },
  'POST /_delete_by_query/{task_id}/_rethrottle': {
    type: 'cluster',
    permission: 'cluster:admin/reindex/rethrottle',
  },
  
  // Tasks
  'GET /_tasks': { type: 'cluster', permission: 'cluster:monitor/tasks/lists' },
  'GET /_tasks/{task_id}': { type: 'cluster', permission: 'cluster:monitor/task/get' },
  'POST /_tasks/_cancel': { type: 'cluster', permission: 'cluster:admin/tasks/cancel' },
  'POST /_tasks/{task_id}/_cancel': { type: 'cluster', permission: 'cluster:admin/tasks/cancel' },
  
  // Ingest pipelines
  'GET /_ingest/pipeline': { type: 'cluster', permission: 'cluster:admin/ingest/pipeline/get' },
  'GET /_ingest/pipeline/{id}': { type: 'cluster', permission: 'cluster:admin/ingest/pipeline/get' },
  'PUT /_ingest/pipeline/{id}': { type: 'cluster', permission: 'cluster:admin/ingest/pipeline/put' },
  'DELETE /_ingest/pipeline/{id}': { type: 'cluster', permission: 'cluster:admin/ingest/pipeline/delete' },
  'GET /_ingest/processor/grok': {
    type: 'cluster',
    permission: 'cluster:admin/ingest/processor/grok/get',
  },
  'GET /_ingest/pipeline/_simulate': {
    type: 'cluster',
    permission: 'cluster:admin/ingest/pipeline/simulate',
  },
  'POST /_ingest/pipeline/_simulate': {
    type: 'cluster',
    permission: 'cluster:admin/ingest/pipeline/simulate',
  },
  'GET /_ingest/pipeline/{id}/_simulate': {
    type: 'cluster',
    permission: 'cluster:admin/ingest/pipeline/simulate',
  },
  'POST /_ingest/pipeline/{id}/_simulate': {
    type: 'cluster',
    permission: 'cluster:admin/ingest/pipeline/simulate',
  },

  // Ingestion state
  'GET /{index}/ingestion/_state': { type: 'index', permission: 'indices:monitor/ingestion/state' },
  'POST /{index}/ingestion/_pause': { type: 'index', permission: 'indices:admin/ingestion/pause' },
  'POST /{index}/ingestion/_resume': { type: 'index', permission: 'indices:admin/ingestion/resume' },
  
  // Scripts
  'GET /_scripts/{id}': { type: 'cluster', permission: 'cluster:admin/script/get' },
  'PUT /_scripts/{id}': { type: 'cluster', permission: 'cluster:admin/script/put' },
  'POST /_scripts/{id}': { type: 'cluster', permission: 'cluster:admin/script/put' },
  'POST /_scripts/{id}/{context}': { type: 'cluster', permission: 'cluster:admin/script/put' },
  'PUT /_scripts/{id}/{context}': { type: 'cluster', permission: 'cluster:admin/script/put' },
  'DELETE /_scripts/{id}': { type: 'cluster', permission: 'cluster:admin/script/delete' },
  'GET /_scripts/painless/_context': {
    type: 'cluster',
    permission: 'cluster:admin/scripts/painless/context',
  },
  'GET /_scripts/painless/_execute': {
    type: 'cluster',
    permission: 'cluster:admin/scripts/painless/execute',
  },
  'POST /_scripts/painless/_execute': {
    type: 'cluster',
    permission: 'cluster:admin/scripts/painless/execute',
  },
  'GET /_script_context': { type: 'cluster', permission: 'cluster:admin/script_context/get' },
  'GET /_script_language': { type: 'cluster', permission: 'cluster:admin/script_language/get' },

  // Noop benchmark APIs
  'GET /_noop_search': { type: 'cluster', permission: 'mock:data/read/search' },
  'POST /_noop_search': { type: 'cluster', permission: 'mock:data/read/search' },
  'GET /{index}/_noop_search': { type: 'index', permission: 'mock:data/read/search' },
  'POST /{index}/_noop_search': { type: 'index', permission: 'mock:data/read/search' },
  'POST /_noop_bulk': { type: 'cluster', permission: 'mock:data/write/bulk' },
  'PUT /_noop_bulk': { type: 'cluster', permission: 'mock:data/write/bulk' },
  'POST /{index}/_noop_bulk': { type: 'index', permission: 'mock:data/write/bulk' },
  'PUT /{index}/_noop_bulk': { type: 'index', permission: 'mock:data/write/bulk' },

  // PPL (Piped Processing Language) - Requirements: PPL 6.3, 6.4
  'POST /_plugins/_ppl': { type: 'cluster', permission: 'cluster:admin/opensearch/ppl' },
  'GET /_plugins/_ppl/stats': { type: 'cluster', permission: 'cluster:admin/opensearch/ppl' },
  'POST /_plugins/_ppl/_explain': { type: 'cluster', permission: 'cluster:admin/opensearch/ppl' },

  // SQL Plugin
  'POST /_plugins/_sql': { type: 'cluster', permission: 'cluster:admin/opensearch/sql' },
  'GET /_plugins/_sql/stats': { type: 'cluster', permission: 'cluster:admin/opensearch/sql' },
  'POST /_plugins/_sql/_explain': { type: 'cluster', permission: 'cluster:admin/opensearch/sql' },
  'POST /_plugins/_sql/close': { type: 'cluster', permission: 'cluster:admin/opensearch/sql' },

  // Snapshot operations
  'GET /_snapshot': { type: 'cluster', permission: 'cluster:admin/repository/get' },
  'GET /_snapshot/{repository}': { type: 'cluster', permission: 'cluster:admin/repository/get' },
  'PUT /_snapshot/{repository}': { type: 'cluster', permission: 'cluster:admin/repository/put' },
  'POST /_snapshot/{repository}': { type: 'cluster', permission: 'cluster:admin/repository/put' },
  'DELETE /_snapshot/{repository}': { type: 'cluster', permission: 'cluster:admin/repository/delete' },
  'POST /_snapshot/{repository}/_verify': { type: 'cluster', permission: 'cluster:admin/repository/verify' },
  'POST /_snapshot/{repository}/_cleanup': { type: 'cluster', permission: 'cluster:admin/repository/_cleanup' },
  'PUT /_snapshot/{repository}/{snapshot}': {
    type: 'cluster',
    permission: 'cluster:admin/snapshot/create',
  },
  'POST /_snapshot/{repository}/{snapshot}': {
    type: 'cluster',
    permission: 'cluster:admin/snapshot/create',
  },
  'GET /_snapshot/{repository}/{snapshot}': {
    type: 'cluster',
    permission: 'cluster:admin/snapshot/get',
  },
  'DELETE /_snapshot/{repository}/{snapshot}': {
    type: 'cluster',
    permission: 'cluster:admin/snapshot/delete',
  },
  'POST /_snapshot/{repository}/{snapshot}/_restore': {
    type: 'cluster',
    permission: 'cluster:admin/snapshot/restore',
  },
  'PUT /_snapshot/{repository}/{snapshot}/_clone/{target_snapshot}': {
    type: 'cluster',
    permission: 'cluster:admin/snapshot/clone',
  },
  'GET /_snapshot/_status': { type: 'cluster', permission: 'cluster:admin/snapshot/status' },
  'GET /_snapshot/{repository}/_status': {
    type: 'cluster',
    permission: 'cluster:admin/snapshot/status',
  },
  'GET /_snapshot/{repository}/{snapshot}/_status': {
    type: 'cluster',
    permission: 'cluster:admin/snapshot/status',
  },
  'GET /_snapshot/{repository}/{snapshot}/{index}/_status': {
    type: 'cluster',
    permission: 'cluster:admin/snapshot/status',
  },
};

/**
 * Create a unique key for an operation (for deduplication)
 */
function createOperationKey(method: HttpMethod, endpoint: string): string {
  const normalized = normalizeEndpoint(endpoint);
  return `${method} ${normalized}`;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePermissionMapping(mapping: PermissionMappingEntry): CategorizedPermission[] {
  if ('permissions' in mapping) {
    return mapping.permissions;
  }

  return [mapping];
}

/**
 * Map an operation to its permissions
 */
function mapOperationToPermission(
  method: HttpMethod,
  endpoint: string,
  indexPatterns: string[]
): CategorizedPermission[] | null {
  const parsed = parseEndpoint(endpoint);
  let normalized = parsed.normalizedPath;
  
  // Replace index name with placeholder if present
  if (parsed.indexPattern) {
    const escapedIndex = escapeRegex(parsed.indexPattern);
    const indexRegex = new RegExp(`^/${escapedIndex}(/|$)`);
    normalized = normalized.replace(indexRegex, '/{index}$1');
  }
  
  // Replace other dynamic segments
  normalized = normalized.replace(/\/_alias\/[^\/]+$/, '/_alias/{name}');
  normalized = normalized.replace(/\/_aliases\/[^\/]+$/, '/_aliases/{name}');
  normalized = normalized.replace(/\/_template\/[^\/]+$/, '/_template/{name}');
  normalized = normalized.replace(/\/_index_template\/[^\/]+$/, '/_index_template/{name}');
  normalized = normalized.replace(/\/_component_template\/[^\/]+$/, '/_component_template/{name}');
  normalized = normalized.replace(/\/_tasks\/[^\/]+\/_cancel$/, '/_tasks/{task_id}/_cancel');
  normalized = normalized.replace(/\/_tasks\/[^\/]+$/, '/_tasks/{task_id}');
  normalized = normalized.replace(
    /\/_ingest\/pipeline\/(?!_simulate(?:\/|$))[^\/]+\/_simulate$/,
    '/_ingest/pipeline/{id}/_simulate'
  );
  normalized = normalized.replace(/\/_ingest\/pipeline\/[^\/]+$/, '/_ingest/pipeline/{id}');
  normalized = normalized.replace(
    /\/_scripts\/(?!painless(?:\/|$))[^\/]+\/[^\/]+$/,
    '/_scripts/{id}/{context}'
  );
  normalized = normalized.replace(/\/_scripts\/[^\/]+$/, '/_scripts/{id}');
  normalized = normalized.replace(/\/_search\/scroll\/[^\/]+$/, '/_search/scroll/{scroll_id}');
  normalized = normalized.replace(/\/_search\/pipeline\/[^\/]+$/, '/_search/pipeline/{id}');
  normalized = normalized.replace(
    /\/_reindex\/[^\/]+\/_rethrottle$/,
    '/_reindex/{task_id}/_rethrottle'
  );
  normalized = normalized.replace(
    /\/_update_by_query\/[^\/]+\/_rethrottle$/,
    '/_update_by_query/{task_id}/_rethrottle'
  );
  normalized = normalized.replace(
    /\/_delete_by_query\/[^\/]+\/_rethrottle$/,
    '/_delete_by_query/{task_id}/_rethrottle'
  );
  normalized = normalized.replace(/\/_render\/template\/[^\/]+$/, '/_render/template/{id}');
  normalized = normalized.replace(/\/_resolve\/index\/[^\/]+$/, '/_resolve/index/{name}');
  normalized = normalized.replace(/\/_mapping\/field\/[^\/]+$/, '/_mapping/field/{fields}');
  normalized = normalized.replace(/\/_settings\/[^\/]+$/, '/_settings/{name}');
  normalized = normalized.replace(/\/_setting\/[^\/]+$/, '/_setting/{name}');
  normalized = normalized.replace(
    /\/_data_stream\/(?!_stats(?:\/|$))[^\/]+\/_stats$/,
    '/_data_stream/{name}/_stats'
  );
  normalized = normalized.replace(/\/_data_stream\/[^\/]+$/, '/_data_stream/{name}');
  normalized = normalized.replace(/\/_dangling\/[^\/]+$/, '/_dangling/{index_uuid}');
  normalized = normalized.replace(
    /\/_list\/wlm_stats\/[^\/]+\/stats\/[^\/]+$/,
    '/_list/wlm_stats/{node_id}/stats/{workload_group_id}'
  );
  normalized = normalized.replace(
    /\/_list\/wlm_stats\/stats\/[^\/]+$/,
    '/_list/wlm_stats/stats/{workload_group_id}'
  );
  normalized = normalized.replace(
    /\/_list\/wlm_stats\/[^\/]+\/stats$/,
    '/_list/wlm_stats/{node_id}/stats'
  );
  normalized = normalized.replace(
    /\/_cluster\/state\/[^\/]+\/[^\/]+$/,
    '/_cluster/state/{metric}/{index}'
  );
  normalized = normalized.replace(/\/_cluster\/state\/[^\/]+$/, '/_cluster/state/{metric}');
  normalized = normalized.replace(
    /\/_cluster\/stats\/[^\/]+\/[^\/]+\/nodes\/[^\/]+$/,
    '/_cluster/stats/{metric}/{index_metric}/nodes/{node_id}'
  );
  normalized = normalized.replace(
    /\/_cluster\/stats\/[^\/]+\/nodes\/[^\/]+$/,
    '/_cluster/stats/{metric}/nodes/{node_id}'
  );
  normalized = normalized.replace(
    /\/_cluster\/stats\/nodes\/[^\/]+$/,
    '/_cluster/stats/nodes/{node_id}'
  );
  normalized = normalized.replace(
    /\/_cluster\/routing\/awareness\/[^\/]+\/weights$/,
    '/_cluster/routing/awareness/{attribute}/weights'
  );
  normalized = normalized.replace(
    /\/_cluster\/decommission\/awareness\/[^\/]+\/_status$/,
    '/_cluster/decommission/awareness/{awareness_attribute_name}/_status'
  );
  normalized = normalized.replace(
    /\/_cluster\/decommission\/awareness\/[^\/]+\/[^\/]+$/,
    '/_cluster/decommission/awareness/{awareness_attribute_name}/{awareness_attribute_value}'
  );
  normalized = normalized.replace(
    /\/_cluster\/voting_config_exclusions\/[^\/]+$/,
    '/_cluster/voting_config_exclusions/{node_name}'
  );
  normalized = normalized.replace(
    /\/_cluster\/nodes\/[^\/]+\/hot_threads$/,
    '/_cluster/nodes/{node_id}/hot_threads'
  );
  normalized = normalized.replace(
    /\/_cluster\/nodes\/[^\/]+\/hotthreads$/,
    '/_cluster/nodes/{node_id}/hotthreads'
  );
  normalized = normalized.replace(/\/_nodes\/stats\/[^\/]+\/[^\/]+$/, '/_nodes/stats/{metric}/{index_metric}');
  normalized = normalized.replace(/\/_nodes\/stats\/[^\/]+$/, '/_nodes/stats/{metric}');
  normalized = normalized.replace(/\/_nodes\/usage\/[^\/]+$/, '/_nodes/usage/{metric}');
  normalized = normalized.replace(
    /\/_nodes\/[^\/]+\/stats\/[^\/]+\/[^\/]+$/,
    '/_nodes/{node_id}/stats/{metric}/{index_metric}'
  );
  normalized = normalized.replace(
    /\/_nodes\/[^\/]+\/stats\/[^\/]+$/,
    '/_nodes/{node_id}/stats/{metric}'
  );
  normalized = normalized.replace(/\/_nodes\/[^\/]+\/stats$/, '/_nodes/{node_id}/stats');
  normalized = normalized.replace(
    /\/_nodes\/[^\/]+\/usage\/[^\/]+$/,
    '/_nodes/{node_id}/usage/{metric}'
  );
  normalized = normalized.replace(/\/_nodes\/[^\/]+\/usage$/, '/_nodes/{node_id}/usage');
  normalized = normalized.replace(/\/_nodes\/[^\/]+\/hot_threads$/, '/_nodes/{node_id}/hot_threads');
  normalized = normalized.replace(/\/_nodes\/[^\/]+\/hotthreads$/, '/_nodes/{node_id}/hotthreads');
  normalized = normalized.replace(/\/_nodes\/[^\/]+\/flight\/stats$/, '/_nodes/{node_id}/flight/stats');
  normalized = normalized.replace(
    /\/_nodes\/[^\/]+\/reload_secure_settings$/,
    '/_nodes/{node_id}/reload_secure_settings'
  );
  normalized = normalized.replace(/\/_flight\/stats\/[^\/]+$/, '/_flight/stats/{node_id}');
  normalized = normalized.replace(
    /\/_nodes\/[^\/]+\/info\/[^\/]+$/,
    '/_nodes/{node_id}/info/{metric}'
  );
  normalized = normalized.replace(
    /\/_nodes\/(?!stats(?:\/|$))(?!usage(?:\/|$))(?!hot_threads(?:\/|$))(?!hotthreads(?:\/|$))(?!flight(?:\/|$))(?!reload_secure_settings(?:\/|$))[^\/]+\/[^\/]+$/,
    '/_nodes/{node_id}/{metric}'
  );
  normalized = normalized.replace(
    /\/_nodes\/(?!stats(?:\/|$))(?!usage(?:\/|$))(?!hot_threads(?:\/|$))(?!hotthreads(?:\/|$))(?!reload_secure_settings(?:\/|$))[^\/]+$/,
    '/_nodes/{node_id}'
  );
  normalized = normalized.replace(/\/_cat\/indices\/[^\/]+$/, '/_cat/indices/{index}');
  normalized = normalized.replace(/\/_cat\/shards\/[^\/]+$/, '/_cat/shards/{index}');
  normalized = normalized.replace(/\/_cat\/segments\/[^\/]+$/, '/_cat/segments/{index}');
  normalized = normalized.replace(/\/_cat\/recovery\/[^\/]+$/, '/_cat/recovery/{index}');
  normalized = normalized.replace(/\/_cat\/count\/[^\/]+$/, '/_cat/count/{index}');
  normalized = normalized.replace(/\/_cat\/allocation\/[^\/]+$/, '/_cat/allocation/{node_id}');
  normalized = normalized.replace(/\/_cat\/aliases\/[^\/]+$/, '/_cat/aliases/{name}');
  normalized = normalized.replace(/\/_cat\/fielddata\/[^\/]+$/, '/_cat/fielddata/{fields}');
  normalized = normalized.replace(/\/_cat\/templates\/[^\/]+$/, '/_cat/templates/{name}');
  normalized = normalized.replace(
    /\/_cat\/thread_pool\/[^\/]+$/,
    '/_cat/thread_pool/{thread_pool_patterns}'
  );
  normalized = normalized.replace(/\/_cat\/snapshots\/[^\/]+$/, '/_cat/snapshots/{repository}');
  normalized = normalized.replace(
    /\/_cat\/segment_replication\/[^\/]+$/,
    '/_cat/segment_replication/{index}'
  );
  normalized = normalized.replace(
    /\/_remotestore\/stats\/[^\/]+\/[^\/]+$/,
    '/_remotestore/stats/{index}/{shard_id}'
  );
  normalized = normalized.replace(
    /\/_remotestore\/stats\/[^\/]+$/,
    '/_remotestore/stats/{index}'
  );
  normalized = normalized.replace(
    /\/_snapshot\/[^\/]+\/[^\/]+\/[^\/]+\/_status$/,
    '/_snapshot/{repository}/{snapshot}/{index}/_status'
  );
  normalized = normalized.replace(
    /\/_snapshot\/[^\/]+\/[^\/]+\/_status$/,
    '/_snapshot/{repository}/{snapshot}/_status'
  );
  normalized = normalized.replace(/\/_snapshot\/[^\/]+\/_status$/, '/_snapshot/{repository}/_status');
  normalized = normalized.replace(
    /\/_snapshot\/[^\/]+\/[^\/]+\/_restore$/,
    '/_snapshot/{repository}/{snapshot}/_restore'
  );
  normalized = normalized.replace(
    /\/_snapshot\/[^\/]+\/[^\/]+\/_clone\/[^\/]+$/,
    '/_snapshot/{repository}/{snapshot}/_clone/{target_snapshot}'
  );
  normalized = normalized.replace(/\/_snapshot\/[^\/]+\/_verify$/, '/_snapshot/{repository}/_verify');
  normalized = normalized.replace(/\/_snapshot\/[^\/]+\/_cleanup$/, '/_snapshot/{repository}/_cleanup');
  normalized = normalized.replace(
    /\/_snapshot\/[^\/]+\/[^\/]+$/,
    '/_snapshot/{repository}/{snapshot}'
  );
  normalized = normalized.replace(/\/_snapshot\/[^\/]+$/, '/_snapshot/{repository}');
  
  const lookupKey = `${method} ${normalized}`;
  const mapping = API_PERMISSION_MAP[lookupKey];
  
  if (mapping) {
    const permissions = normalizePermissionMapping(mapping);
    return permissions.map((perm) => {
      if (perm.type === 'index') {
        return {
          ...perm,
          indexPatterns: indexPatterns.length > 0 ? indexPatterns : undefined,
        };
      }
      return perm;
    });
  }
  
  // Default categorization based on endpoint type
  if (parsed.type === 'cluster') {
    return [{ type: 'cluster', permission: 'cluster:admin/unknown' }];
  } else if (parsed.type === 'index') {
    return [
      {
        type: 'index',
        permission: 'indices:admin/unknown',
        indexPatterns: indexPatterns.length > 0 ? indexPatterns : undefined,
      },
    ];
  }
  
  return null;
}

/**
 * API Tracker class for managing tracked operations
 */
export class ApiTracker {
  private state: ApiTrackerState;
  private notebookId: string | null = null;
  private operationKeys: Set<string> = new Set();

  constructor() {
    this.state = {
      operations: [],
      permissions: [],
    };
  }

  /**
   * Load tracking state from storage for a notebook
   * Requirements: 5.7
   */
  loadFromStorage(notebookId: string): void {
    this.notebookId = notebookId;
    this.state = loadTracking(notebookId);
    
    // Rebuild operation keys set for deduplication
    this.operationKeys = new Set(
      this.state.operations.map((op) => createOperationKey(op.method, op.endpoint))
    );
  }

  /**
   * Save tracking state to storage
   * Requirements: 5.7
   */
  saveToStorage(): void {
    if (this.notebookId) {
      saveTracking(this.notebookId, this.state);
    }
  }

  /**
   * Track an API operation
   * Requirements: 2.7, 5.1, 5.2, 5.4
   * 
   * @param method - HTTP method used
   * @param endpoint - API endpoint path
   * @param cellId - ID of the cell that executed the operation
   */
  trackOperation(method: HttpMethod, endpoint: string, cellId: string): void {
    const indexPatterns = extractIndexPatterns(endpoint);
    const operationKey = createOperationKey(method, endpoint);
    
    // Deduplication: only add if this operation hasn't been tracked
    // Requirements: 5.4
    if (!this.operationKeys.has(operationKey)) {
      const operation: TrackedOperation = {
        method,
        endpoint,
        indexPatterns,
        timestamp: Date.now(),
        cellId,
      };
      
      this.state.operations.push(operation);
      this.operationKeys.add(operationKey);
      
      // Map to permission and add if not already present
      const permissions = mapOperationToPermission(method, endpoint, indexPatterns);
      if (permissions) {
        for (const permission of permissions) {
          const existingPermission = this.state.permissions.find(
            (p) =>
              p.type === permission.type &&
              p.permission === permission.permission &&
              JSON.stringify(p.indexPatterns) === JSON.stringify(permission.indexPatterns)
          );

          if (!existingPermission) {
            this.state.permissions.push(permission);
          }
        }
      }
      
      // Auto-save to storage
      this.saveToStorage();
    }
  }

  /**
   * Track a PPL query operation
   * Requirements: PPL 6.1, 6.2
   * 
   * @param _query - PPL query string (unused, kept for API consistency)
   * @param cellId - ID of the cell that executed the operation
   * @param indexPattern - Index pattern extracted from the query (optional)
   */
  trackPPLOperation(_query: string, cellId: string, indexPattern: string | null): void {
    const endpoint = '/_plugins/_ppl';
    const method: HttpMethod = 'POST';
    const indexPatterns = indexPattern ? [indexPattern] : [];
    const operationKey = createOperationKey(method, endpoint);
    
    // Track the PPL endpoint operation
    if (!this.operationKeys.has(operationKey)) {
      const operation: TrackedOperation = {
        method,
        endpoint,
        indexPatterns,
        timestamp: Date.now(),
        cellId,
      };
      
      this.state.operations.push(operation);
      this.operationKeys.add(operationKey);
      
      // Add PPL cluster permission
      const pplPermission: CategorizedPermission = {
        type: 'cluster',
        permission: 'cluster:admin/opensearch/ppl',
      };
      
      const existingPplPermission = this.state.permissions.find(
        (p) => p.type === 'cluster' && p.permission === 'cluster:admin/opensearch/ppl'
      );
      
      if (!existingPplPermission) {
        this.state.permissions.push(pplPermission);
      }
      
      // Add index read permission if index pattern is present
      if (indexPattern) {
        const indexPermission: CategorizedPermission = {
          type: 'index',
          permission: 'indices:data/read/search',
          indexPatterns: [indexPattern],
        };
        
        const existingIndexPermission = this.state.permissions.find(
          (p) =>
            p.type === 'index' &&
            p.permission === 'indices:data/read/search' &&
            p.indexPatterns?.includes(indexPattern)
        );
        
        if (!existingIndexPermission) {
          this.state.permissions.push(indexPermission);
        }
      }
      
      // Auto-save to storage
      this.saveToStorage();
    }
  }

  /**
   * Get all tracked operations
   * Requirements: 5.5
   */
  getOperations(): TrackedOperation[] {
    return [...this.state.operations];
  }

  /**
   * Get all categorized permissions
   * Requirements: 5.5
   */
  getPermissions(): CategorizedPermission[] {
    return [...this.state.permissions];
  }

  /**
   * Get the current tracker state
   */
  getState(): ApiTrackerState {
    return {
      operations: [...this.state.operations],
      permissions: [...this.state.permissions],
    };
  }

  /**
   * Clear all tracking data
   * Requirements: 5.5
   */
  clearTracking(): void {
    this.state = {
      operations: [],
      permissions: [],
    };
    this.operationKeys.clear();
    
    if (this.notebookId) {
      persistClearTracking(this.notebookId);
    }
  }

  /**
   * Set the notebook ID for persistence
   */
  setNotebookId(notebookId: string): void {
    this.notebookId = notebookId;
  }
}

/**
 * Create a new API tracker instance
 */
export function createApiTracker(): ApiTracker {
  return new ApiTracker();
}

/**
 * Categorize an operation as cluster or index
 * Requirements: 5.6
 * 
 * @param endpoint - The API endpoint path
 * @returns 'cluster' or 'index' based on the endpoint type
 */
export function categorizeOperation(endpoint: string): 'cluster' | 'index' | 'unknown' {
  const parsed = parseEndpoint(endpoint);
  return parsed.type;
}
