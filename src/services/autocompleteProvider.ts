// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Autocomplete Provider for OpenSearch Notebook
 * Provides context-aware suggestions for API endpoints and Query DSL fields
 * Requirements: 3.3, 3.7, 3.9, 3.10
 */

import { jsonCompletionContext } from './jsonCompletionContext';
import type { HttpMethod } from '../types/cell';

/**
 * Endpoint suggestion interface
 */
export interface EndpointSuggestion {
  endpoint: string;
  description: string;
  methods: HttpMethod[];
  category: string;
}

/**
 * Field suggestion interface for Query DSL
 */
export interface FieldSuggestion {
  field: string;
  description: string;
  valueType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  example?: string;
}

/**
 * Query DSL context for autocomplete
 */
export interface QueryDslContext {
  path: string[];  // JSON path to current position
  parentKey?: string;
  isValue: boolean;
}

/**
 * Endpoint Registry for autocomplete
 * Requirements: 3.9
 */
export const ENDPOINT_REGISTRY: EndpointSuggestion[] = [
  // Search
  { endpoint: '/{index}/_search', description: 'Search documents in an index', methods: ['GET', 'POST'], category: 'Search' },
  { endpoint: '/_search', description: 'Search across all indices', methods: ['GET', 'POST'], category: 'Search' },
  { endpoint: '/{index}/_count', description: 'Count documents matching a query', methods: ['GET', 'POST'], category: 'Search' },
  { endpoint: '/_count', description: 'Count documents across all indices', methods: ['GET', 'POST'], category: 'Search' },
  { endpoint: '/{index}/_msearch', description: 'Multi-search on an index', methods: ['GET', 'POST'], category: 'Search' },
  { endpoint: '/_msearch', description: 'Multi-search across indices', methods: ['GET', 'POST'], category: 'Search' },
  
  // Document CRUD
  { endpoint: '/{index}/_doc/{id}', description: 'Get, index, or delete a document', methods: ['GET', 'PUT', 'DELETE'], category: 'Document' },
  { endpoint: '/{index}/_doc', description: 'Index a document with auto-generated ID', methods: ['POST'], category: 'Document' },
  { endpoint: '/{index}/_create/{id}', description: 'Create a document with specific ID', methods: ['PUT', 'POST'], category: 'Document' },
  { endpoint: '/{index}/_update/{id}', description: 'Update a document', methods: ['POST'], category: 'Document' },
  { endpoint: '/{index}/_source/{id}', description: 'Get document source only', methods: ['GET'], category: 'Document' },
  { endpoint: '/_bulk', description: 'Bulk index, update, or delete documents', methods: ['POST'], category: 'Document' },
  { endpoint: '/{index}/_bulk', description: 'Bulk operations on an index', methods: ['POST'], category: 'Document' },
  { endpoint: '/_mget', description: 'Multi-get documents', methods: ['GET', 'POST'], category: 'Document' },
  { endpoint: '/{index}/_mget', description: 'Multi-get documents from an index', methods: ['GET', 'POST'], category: 'Document' },
  { endpoint: '/{index}/_delete_by_query', description: 'Delete documents by query', methods: ['POST'], category: 'Document' },
  { endpoint: '/{index}/_update_by_query', description: 'Update documents by query', methods: ['POST'], category: 'Document' },
  
  // Index Management
  { endpoint: '/{index}', description: 'Create, delete, or get index info', methods: ['PUT', 'DELETE', 'GET', 'HEAD'], category: 'Index' },
  { endpoint: '/{index}/_mapping', description: 'Get or update index mappings', methods: ['GET', 'PUT'], category: 'Index' },
  { endpoint: '/{index}/_mappings', description: 'Get or update index mappings', methods: ['GET', 'PUT'], category: 'Index' },
  { endpoint: '/{index}/_settings', description: 'Get or update index settings', methods: ['GET', 'PUT'], category: 'Index' },
  { endpoint: '/_aliases', description: 'Manage index aliases', methods: ['GET', 'POST'], category: 'Index' },
  { endpoint: '/{index}/_alias/{name}', description: 'Manage specific alias', methods: ['GET', 'PUT', 'DELETE'], category: 'Index' },
  { endpoint: '/{index}/_aliases', description: 'Get index aliases', methods: ['GET'], category: 'Index' },
  { endpoint: '/{index}/_refresh', description: 'Refresh an index', methods: ['POST'], category: 'Index' },
  { endpoint: '/{index}/_flush', description: 'Flush an index', methods: ['POST'], category: 'Index' },
  { endpoint: '/{index}/_forcemerge', description: 'Force merge index segments', methods: ['POST'], category: 'Index' },
  { endpoint: '/{index}/_close', description: 'Close an index', methods: ['POST'], category: 'Index' },
  { endpoint: '/{index}/_open', description: 'Open a closed index', methods: ['POST'], category: 'Index' },
  
  // Cluster
  { endpoint: '/_cluster/health', description: 'Get cluster health status', methods: ['GET'], category: 'Cluster' },
  { endpoint: '/_cluster/state', description: 'Get cluster state', methods: ['GET'], category: 'Cluster' },
  { endpoint: '/_cluster/stats', description: 'Get cluster statistics', methods: ['GET'], category: 'Cluster' },
  { endpoint: '/_cluster/settings', description: 'Get or update cluster settings', methods: ['GET', 'PUT'], category: 'Cluster' },
  { endpoint: '/_nodes', description: 'Get node information', methods: ['GET'], category: 'Cluster' },
  { endpoint: '/_nodes/stats', description: 'Get node statistics', methods: ['GET'], category: 'Cluster' },
  { endpoint: '/_nodes/hot_threads', description: 'Get node hot threads', methods: ['GET'], category: 'Cluster' },
  
  // Cat APIs
  { endpoint: '/_cat/indices', description: 'List all indices', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/nodes', description: 'List all nodes', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/shards', description: 'List all shards', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/health', description: 'Get cluster health', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/allocation', description: 'Show shard allocation', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/master', description: 'Show master node', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/segments', description: 'Show segment information', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/count', description: 'Show document count', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/recovery', description: 'Show recovery status', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/pending_tasks', description: 'Show pending tasks', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/aliases', description: 'Show aliases', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/thread_pool', description: 'Show thread pool stats', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/plugins', description: 'Show installed plugins', methods: ['GET'], category: 'Cat' },
  { endpoint: '/_cat/templates', description: 'Show index templates', methods: ['GET'], category: 'Cat' },
  
  // Templates
  { endpoint: '/_template', description: 'List index templates', methods: ['GET'], category: 'Template' },
  { endpoint: '/_template/{name}', description: 'Get or create index template', methods: ['GET', 'PUT', 'DELETE'], category: 'Template' },
  { endpoint: '/_index_template', description: 'List composable templates', methods: ['GET'], category: 'Template' },
  { endpoint: '/_index_template/{name}', description: 'Get or create composable template', methods: ['GET', 'PUT', 'DELETE'], category: 'Template' },
  
  // Analyze
  { endpoint: '/_analyze', description: 'Analyze text', methods: ['GET', 'POST'], category: 'Analyze' },
  { endpoint: '/{index}/_analyze', description: 'Analyze text with index analyzer', methods: ['GET', 'POST'], category: 'Analyze' },
  { endpoint: '/{index}/_validate/query', description: 'Validate a query', methods: ['GET', 'POST'], category: 'Analyze' },
  { endpoint: '/{index}/_explain/{id}', description: 'Explain document match', methods: ['GET', 'POST'], category: 'Analyze' },
  
  // Tasks
  { endpoint: '/_tasks', description: 'List running tasks', methods: ['GET'], category: 'Tasks' },
  { endpoint: '/_tasks/{task_id}', description: 'Get task details', methods: ['GET'], category: 'Tasks' },
  { endpoint: '/_tasks/{task_id}/_cancel', description: 'Cancel a task', methods: ['POST'], category: 'Tasks' },
  
  // Ingest
  { endpoint: '/_ingest/pipeline', description: 'List ingest pipelines', methods: ['GET'], category: 'Ingest' },
  { endpoint: '/_ingest/pipeline/{id}', description: 'Get or create pipeline', methods: ['GET', 'PUT', 'DELETE'], category: 'Ingest' },
  
  // Scripts
  { endpoint: '/_scripts/{id}', description: 'Get, create, or delete script', methods: ['GET', 'PUT', 'DELETE'], category: 'Scripts' },
  
  // Reindex
  { endpoint: '/_reindex', description: 'Reindex documents', methods: ['POST'], category: 'Reindex' },
  
  // Security Plugin
  { endpoint: '/_plugins/_security/api/account', description: 'Get current user account info', methods: ['GET'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/roles', description: 'List all roles', methods: ['GET'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/roles/{name}', description: 'Get, create, update, or delete a role', methods: ['GET', 'PUT', 'DELETE'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/rolesmapping', description: 'List all role mappings', methods: ['GET'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/rolesmapping/{name}', description: 'Get, create, update, or delete role mapping', methods: ['GET', 'PUT', 'DELETE'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/internalusers', description: 'List all internal users', methods: ['GET'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/internalusers/{name}', description: 'Get, create, update, or delete internal user', methods: ['GET', 'PUT', 'DELETE'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/actiongroups', description: 'List all action groups', methods: ['GET'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/actiongroups/{name}', description: 'Get, create, update, or delete action group', methods: ['GET', 'PUT', 'DELETE'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/tenants', description: 'List all tenants', methods: ['GET'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/tenants/{name}', description: 'Get, create, update, or delete tenant', methods: ['GET', 'PUT', 'DELETE'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/securityconfig', description: 'Get security configuration', methods: ['GET'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/securityconfig/config', description: 'Update security configuration', methods: ['PUT'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/audit', description: 'Get audit configuration', methods: ['GET'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/audit/config', description: 'Update audit configuration', methods: ['PUT'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/cache', description: 'Flush security cache', methods: ['DELETE'], category: 'Security' },
  { endpoint: '/_plugins/_security/api/ssl/certs', description: 'Get SSL certificate info', methods: ['GET'], category: 'Security' },
  { endpoint: '/_plugins/_security/authinfo', description: 'Get authentication info', methods: ['GET'], category: 'Security' },
  { endpoint: '/_plugins/_security/health', description: 'Get security plugin health', methods: ['GET'], category: 'Security' },
  
  // ML Plugin (Machine Learning)
  { endpoint: '/_plugins/_ml/models/_register', description: 'Register a new ML model', methods: ['POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/models/{model_id}', description: 'Get ML model info', methods: ['GET', 'DELETE'], category: 'ML' },
  { endpoint: '/_plugins/_ml/models/_search', description: 'Search ML models', methods: ['GET', 'POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/models/{model_id}/_deploy', description: 'Deploy an ML model', methods: ['POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/models/{model_id}/_undeploy', description: 'Undeploy an ML model', methods: ['POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/models/{model_id}/_predict', description: 'Run prediction with ML model', methods: ['POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/model_groups/_register', description: 'Register a model group', methods: ['POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/model_groups/{model_group_id}', description: 'Get, update, or delete model group', methods: ['GET', 'PUT', 'DELETE'], category: 'ML' },
  { endpoint: '/_plugins/_ml/model_groups/_search', description: 'Search model groups', methods: ['GET', 'POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/connectors/_create', description: 'Create an ML connector', methods: ['POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/connectors/{connector_id}', description: 'Get, update, or delete connector', methods: ['GET', 'PUT', 'DELETE'], category: 'ML' },
  { endpoint: '/_plugins/_ml/connectors/_search', description: 'Search ML connectors', methods: ['GET', 'POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/tasks/{task_id}', description: 'Get ML task status', methods: ['GET'], category: 'ML' },
  { endpoint: '/_plugins/_ml/tasks/_search', description: 'Search ML tasks', methods: ['GET', 'POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/profile', description: 'Get ML plugin profile', methods: ['GET'], category: 'ML' },
  { endpoint: '/_plugins/_ml/stats', description: 'Get ML plugin stats', methods: ['GET'], category: 'ML' },
  { endpoint: '/_plugins/_ml/agents/_register', description: 'Register an ML agent', methods: ['POST'], category: 'ML' },
  { endpoint: '/_plugins/_ml/agents/{agent_id}', description: 'Get or delete ML agent', methods: ['GET', 'DELETE'], category: 'ML' },
  { endpoint: '/_plugins/_ml/agents/{agent_id}/_execute', description: 'Execute ML agent', methods: ['POST'], category: 'ML' },
  
  // Anomaly Detection Plugin
  { endpoint: '/_plugins/_anomaly_detection/detectors', description: 'List anomaly detectors', methods: ['GET'], category: 'Anomaly Detection' },
  { endpoint: '/_plugins/_anomaly_detection/detectors/{detector_id}', description: 'Get, create, update, or delete detector', methods: ['GET', 'PUT', 'DELETE'], category: 'Anomaly Detection' },
  { endpoint: '/_plugins/_anomaly_detection/detectors/_search', description: 'Search anomaly detectors', methods: ['GET', 'POST'], category: 'Anomaly Detection' },
  { endpoint: '/_plugins/_anomaly_detection/detectors/{detector_id}/_start', description: 'Start anomaly detector', methods: ['POST'], category: 'Anomaly Detection' },
  { endpoint: '/_plugins/_anomaly_detection/detectors/{detector_id}/_stop', description: 'Stop anomaly detector', methods: ['POST'], category: 'Anomaly Detection' },
  { endpoint: '/_plugins/_anomaly_detection/detectors/{detector_id}/results', description: 'Get detector results', methods: ['GET'], category: 'Anomaly Detection' },
  { endpoint: '/_plugins/_anomaly_detection/detectors/{detector_id}/_preview', description: 'Preview detector results', methods: ['POST'], category: 'Anomaly Detection' },
  { endpoint: '/_plugins/_anomaly_detection/stats', description: 'Get anomaly detection stats', methods: ['GET'], category: 'Anomaly Detection' },
  
  // Alerting Plugin
  { endpoint: '/_plugins/_alerting/monitors', description: 'List alerting monitors', methods: ['GET'], category: 'Alerting' },
  { endpoint: '/_plugins/_alerting/monitors/{monitor_id}', description: 'Get, create, update, or delete monitor', methods: ['GET', 'PUT', 'DELETE'], category: 'Alerting' },
  { endpoint: '/_plugins/_alerting/monitors/_search', description: 'Search alerting monitors', methods: ['GET', 'POST'], category: 'Alerting' },
  { endpoint: '/_plugins/_alerting/monitors/{monitor_id}/_execute', description: 'Execute monitor', methods: ['POST'], category: 'Alerting' },
  { endpoint: '/_plugins/_alerting/monitors/{monitor_id}/_acknowledge/alerts', description: 'Acknowledge alerts', methods: ['POST'], category: 'Alerting' },
  { endpoint: '/_plugins/_alerting/destinations', description: 'List alert destinations', methods: ['GET'], category: 'Alerting' },
  { endpoint: '/_plugins/_alerting/destinations/{destination_id}', description: 'Get, create, update, or delete destination', methods: ['GET', 'PUT', 'DELETE'], category: 'Alerting' },
  { endpoint: '/_plugins/_alerting/alerts', description: 'Get alerts', methods: ['GET'], category: 'Alerting' },
  { endpoint: '/_plugins/_alerting/_settings', description: 'Get alerting settings', methods: ['GET'], category: 'Alerting' },
  
  // Index State Management (ISM) Plugin
  { endpoint: '/_plugins/_ism/policies', description: 'List ISM policies', methods: ['GET'], category: 'ISM' },
  { endpoint: '/_plugins/_ism/policies/{policy_id}', description: 'Get, create, update, or delete ISM policy', methods: ['GET', 'PUT', 'DELETE'], category: 'ISM' },
  { endpoint: '/_plugins/_ism/add/{index}', description: 'Add ISM policy to index', methods: ['POST'], category: 'ISM' },
  { endpoint: '/_plugins/_ism/remove/{index}', description: 'Remove ISM policy from index', methods: ['POST'], category: 'ISM' },
  { endpoint: '/_plugins/_ism/change_policy/{index}', description: 'Change ISM policy on index', methods: ['POST'], category: 'ISM' },
  { endpoint: '/_plugins/_ism/retry/{index}', description: 'Retry failed ISM action', methods: ['POST'], category: 'ISM' },
  { endpoint: '/_plugins/_ism/explain/{index}', description: 'Explain ISM state for index', methods: ['GET'], category: 'ISM' },
  
  // SQL Plugin
  { endpoint: '/_plugins/_sql', description: 'Execute SQL query', methods: ['POST'], category: 'SQL' },
  { endpoint: '/_plugins/_sql/_explain', description: 'Explain SQL query', methods: ['POST'], category: 'SQL' },
  { endpoint: '/_plugins/_sql/close', description: 'Close SQL cursor', methods: ['POST'], category: 'SQL' },
  { endpoint: '/_plugins/_sql/stats', description: 'Get SQL plugin stats', methods: ['GET'], category: 'SQL' },
  { endpoint: '/_plugins/_sql/settings', description: 'Get or update SQL settings', methods: ['GET', 'PUT'], category: 'SQL' },
  { endpoint: '/_plugins/_ppl', description: 'Execute PPL query', methods: ['POST'], category: 'SQL' },
  { endpoint: '/_plugins/_ppl/_explain', description: 'Explain PPL query', methods: ['POST'], category: 'SQL' },
  { endpoint: '/_plugins/_ppl/stats', description: 'Get PPL plugin stats', methods: ['GET'], category: 'SQL' },
  
  // k-NN Plugin
  { endpoint: '/_plugins/_knn/stats', description: 'Get k-NN plugin stats', methods: ['GET'], category: 'k-NN' },
  { endpoint: '/_plugins/_knn/{index}/_warmup', description: 'Warm up k-NN index', methods: ['GET'], category: 'k-NN' },
  { endpoint: '/_plugins/_knn/models/{model_id}', description: 'Get or delete k-NN model', methods: ['GET', 'DELETE'], category: 'k-NN' },
  { endpoint: '/_plugins/_knn/models/_search', description: 'Search k-NN models', methods: ['GET', 'POST'], category: 'k-NN' },
  { endpoint: '/_plugins/_knn/models/_train', description: 'Train k-NN model', methods: ['POST'], category: 'k-NN' },
  
  // Asynchronous Search Plugin
  { endpoint: '/_plugins/_asynchronous_search', description: 'Submit async search', methods: ['POST'], category: 'Async Search' },
  { endpoint: '/_plugins/_asynchronous_search/{id}', description: 'Get or delete async search', methods: ['GET', 'DELETE'], category: 'Async Search' },
  { endpoint: '/_plugins/_asynchronous_search/stats', description: 'Get async search stats', methods: ['GET'], category: 'Async Search' },
  
  // Notifications Plugin
  { endpoint: '/_plugins/_notifications/configs', description: 'List notification configs', methods: ['GET'], category: 'Notifications' },
  { endpoint: '/_plugins/_notifications/configs/{config_id}', description: 'Get, create, update, or delete notification config', methods: ['GET', 'PUT', 'DELETE'], category: 'Notifications' },
  { endpoint: '/_plugins/_notifications/channels', description: 'List notification channels', methods: ['GET'], category: 'Notifications' },
  { endpoint: '/_plugins/_notifications/send', description: 'Send notification', methods: ['POST'], category: 'Notifications' },
  { endpoint: '/_plugins/_notifications/features', description: 'Get notification features', methods: ['GET'], category: 'Notifications' },
  
  // Observability Plugin
  { endpoint: '/_plugins/_observability/object', description: 'List observability objects', methods: ['GET'], category: 'Observability' },
  { endpoint: '/_plugins/_observability/object/{object_id}', description: 'Get, create, update, or delete observability object', methods: ['GET', 'PUT', 'DELETE'], category: 'Observability' },
  
  // Reports Plugin
  { endpoint: '/_plugins/_reports/definition', description: 'List report definitions', methods: ['GET'], category: 'Reports' },
  { endpoint: '/_plugins/_reports/definition/{id}', description: 'Get, create, update, or delete report definition', methods: ['GET', 'PUT', 'DELETE'], category: 'Reports' },
  { endpoint: '/_plugins/_reports/instance', description: 'List report instances', methods: ['GET'], category: 'Reports' },
  { endpoint: '/_plugins/_reports/instance/{id}', description: 'Get report instance', methods: ['GET'], category: 'Reports' },
  { endpoint: '/_plugins/_reports/on_demand', description: 'Generate on-demand report', methods: ['POST'], category: 'Reports' },
  
  // Cross-Cluster Replication Plugin
  { endpoint: '/_plugins/_replication/{index}/_start', description: 'Start replication for index', methods: ['PUT'], category: 'Replication' },
  { endpoint: '/_plugins/_replication/{index}/_stop', description: 'Stop replication for index', methods: ['POST'], category: 'Replication' },
  { endpoint: '/_plugins/_replication/{index}/_pause', description: 'Pause replication for index', methods: ['POST'], category: 'Replication' },
  { endpoint: '/_plugins/_replication/{index}/_resume', description: 'Resume replication for index', methods: ['POST'], category: 'Replication' },
  { endpoint: '/_plugins/_replication/{index}/_status', description: 'Get replication status', methods: ['GET'], category: 'Replication' },
  { endpoint: '/_plugins/_replication/autofollow', description: 'List auto-follow patterns', methods: ['GET'], category: 'Replication' },
  { endpoint: '/_plugins/_replication/autofollow/{pattern_name}', description: 'Get, create, or delete auto-follow pattern', methods: ['GET', 'PUT', 'DELETE'], category: 'Replication' },
  
  // Snapshot Management Plugin
  { endpoint: '/_plugins/_sm/policies', description: 'List snapshot management policies', methods: ['GET'], category: 'Snapshot Management' },
  { endpoint: '/_plugins/_sm/policies/{policy_name}', description: 'Get, create, update, or delete SM policy', methods: ['GET', 'PUT', 'DELETE'], category: 'Snapshot Management' },
  { endpoint: '/_plugins/_sm/policies/{policy_name}/_start', description: 'Start SM policy', methods: ['POST'], category: 'Snapshot Management' },
  { endpoint: '/_plugins/_sm/policies/{policy_name}/_stop', description: 'Stop SM policy', methods: ['POST'], category: 'Snapshot Management' },
  { endpoint: '/_plugins/_sm/policies/{policy_name}/_explain', description: 'Explain SM policy', methods: ['GET'], category: 'Snapshot Management' },
  
  // Transform Plugin
  { endpoint: '/_plugins/_transform', description: 'List transforms', methods: ['GET'], category: 'Transform' },
  { endpoint: '/_plugins/_transform/{transform_id}', description: 'Get, create, update, or delete transform', methods: ['GET', 'PUT', 'DELETE'], category: 'Transform' },
  { endpoint: '/_plugins/_transform/{transform_id}/_start', description: 'Start transform', methods: ['POST'], category: 'Transform' },
  { endpoint: '/_plugins/_transform/{transform_id}/_stop', description: 'Stop transform', methods: ['POST'], category: 'Transform' },
  { endpoint: '/_plugins/_transform/{transform_id}/_explain', description: 'Explain transform', methods: ['GET'], category: 'Transform' },
  { endpoint: '/_plugins/_transform/{transform_id}/_preview', description: 'Preview transform', methods: ['GET'], category: 'Transform' },
  
  // Rollup Plugin
  { endpoint: '/_plugins/_rollup/jobs', description: 'List rollup jobs', methods: ['GET'], category: 'Rollup' },
  { endpoint: '/_plugins/_rollup/jobs/{rollup_id}', description: 'Get, create, update, or delete rollup job', methods: ['GET', 'PUT', 'DELETE'], category: 'Rollup' },
  { endpoint: '/_plugins/_rollup/jobs/{rollup_id}/_start', description: 'Start rollup job', methods: ['POST'], category: 'Rollup' },
  { endpoint: '/_plugins/_rollup/jobs/{rollup_id}/_stop', description: 'Stop rollup job', methods: ['POST'], category: 'Rollup' },
  { endpoint: '/_plugins/_rollup/jobs/{rollup_id}/_explain', description: 'Explain rollup job', methods: ['GET'], category: 'Rollup' },
  
  // Flow Framework Plugin
  { endpoint: '/_plugins/_flow_framework/workflow', description: 'List workflows', methods: ['GET'], category: 'Flow Framework' },
  { endpoint: '/_plugins/_flow_framework/workflow/{workflow_id}', description: 'Get, create, update, or delete workflow', methods: ['GET', 'PUT', 'DELETE'], category: 'Flow Framework' },
  { endpoint: '/_plugins/_flow_framework/workflow/{workflow_id}/_provision', description: 'Provision workflow', methods: ['POST'], category: 'Flow Framework' },
  { endpoint: '/_plugins/_flow_framework/workflow/{workflow_id}/_deprovision', description: 'Deprovision workflow', methods: ['POST'], category: 'Flow Framework' },
  { endpoint: '/_plugins/_flow_framework/workflow/{workflow_id}/_status', description: 'Get workflow status', methods: ['GET'], category: 'Flow Framework' },
  { endpoint: '/_plugins/_flow_framework/workflow/_search', description: 'Search workflows', methods: ['GET', 'POST'], category: 'Flow Framework' },
  
  // Amazon OpenSearch Service - UltraWarm APIs
  { endpoint: '/_ultrawarm/migration/_status', description: 'Get UltraWarm migration status', methods: ['GET'], category: 'UltraWarm' },
  { endpoint: '/_ultrawarm/migration/{index}/_status', description: 'Get UltraWarm migration status for index', methods: ['GET'], category: 'UltraWarm' },
  { endpoint: '/{index}/_ultrawarm', description: 'Migrate index to UltraWarm', methods: ['POST'], category: 'UltraWarm' },
  { endpoint: '/_warm/indices/{index}/_warm_to_hot', description: 'Migrate index from warm to hot', methods: ['POST'], category: 'UltraWarm' },
  { endpoint: '/_warm/indices', description: 'List UltraWarm indices', methods: ['GET'], category: 'UltraWarm' },
  { endpoint: '/_warm/indices/{index}', description: 'Get UltraWarm index info', methods: ['GET'], category: 'UltraWarm' },
  
  // Amazon OpenSearch Service - Cold Storage APIs
  { endpoint: '/_cold/indices/{index}/_warm_to_cold', description: 'Migrate index from warm to cold', methods: ['POST'], category: 'Cold Storage' },
  { endpoint: '/_cold/indices/{index}/_cold_to_warm', description: 'Migrate index from cold to warm', methods: ['POST'], category: 'Cold Storage' },
  { endpoint: '/_cold/indices', description: 'List cold storage indices', methods: ['GET'], category: 'Cold Storage' },
  { endpoint: '/_cold/indices/{index}', description: 'Get cold storage index info', methods: ['GET'], category: 'Cold Storage' },
  { endpoint: '/_cold/migration/_status', description: 'Get cold storage migration status', methods: ['GET'], category: 'Cold Storage' },
  { endpoint: '/_cold/migration/{index}/_status', description: 'Get cold storage migration status for index', methods: ['GET'], category: 'Cold Storage' },
  { endpoint: '/_cold/indices/_search', description: 'Search cold storage indices metadata', methods: ['GET', 'POST'], category: 'Cold Storage' },
];


/**
 * Query DSL Field Registry for autocomplete
 * Requirements: 3.10
 */
export const QUERY_DSL_REGISTRY: Record<string, FieldSuggestion[]> = {
  'root': [
    { field: 'query', description: 'The query definition', valueType: 'object' },
    { field: 'size', description: 'Number of results to return', valueType: 'number', example: '10' },
    { field: 'from', description: 'Starting offset for results', valueType: 'number', example: '0' },
    { field: 'sort', description: 'Sort order for results', valueType: 'array' },
    { field: '_source', description: 'Fields to include in response', valueType: 'array' },
    { field: 'aggs', description: 'Aggregations to compute', valueType: 'object' },
    { field: 'aggregations', description: 'Aggregations to compute (alias)', valueType: 'object' },
    { field: 'highlight', description: 'Highlighting configuration', valueType: 'object' },
    { field: 'track_total_hits', description: 'Track exact total hits', valueType: 'boolean' },
    { field: 'timeout', description: 'Search timeout', valueType: 'string', example: '"30s"' },
    { field: 'terminate_after', description: 'Max docs to collect per shard', valueType: 'number' },
    { field: 'min_score', description: 'Minimum score threshold', valueType: 'number' },
    { field: 'explain', description: 'Include score explanation', valueType: 'boolean' },
    { field: 'version', description: 'Include document version', valueType: 'boolean' },
    { field: 'seq_no_primary_term', description: 'Include sequence number', valueType: 'boolean' },
    { field: 'stored_fields', description: 'Stored fields to return', valueType: 'array' },
    { field: 'docvalue_fields', description: 'Doc value fields to return', valueType: 'array' },
    { field: 'script_fields', description: 'Script-computed fields', valueType: 'object' },
    { field: 'post_filter', description: 'Post-aggregation filter', valueType: 'object' },
    { field: 'rescore', description: 'Rescoring configuration', valueType: 'object' },
    { field: 'suggest', description: 'Suggestions configuration', valueType: 'object' },
    { field: 'search_after', description: 'Search after values for pagination', valueType: 'array' },
    { field: 'pit', description: 'Point in time configuration', valueType: 'object' },
    { field: 'runtime_mappings', description: 'Runtime field mappings', valueType: 'object' },
    { field: 'indices_boost', description: 'Index boosting', valueType: 'array' },
    { field: 'collapse', description: 'Field collapsing', valueType: 'object' },
  ],
  'query': [
    { field: 'match', description: 'Full-text search on a field', valueType: 'object', example: '{ "field": "value" }' },
    { field: 'match_all', description: 'Match all documents', valueType: 'object', example: '{}' },
    { field: 'match_none', description: 'Match no documents', valueType: 'object', example: '{}' },
    { field: 'match_phrase', description: 'Phrase search', valueType: 'object', example: '{ "field": "phrase" }' },
    { field: 'match_phrase_prefix', description: 'Phrase prefix search', valueType: 'object' },
    { field: 'multi_match', description: 'Search across multiple fields', valueType: 'object' },
    { field: 'term', description: 'Exact value match', valueType: 'object', example: '{ "field": "value" }' },
    { field: 'terms', description: 'Match any of multiple values', valueType: 'object', example: '{ "field": ["v1", "v2"] }' },
    { field: 'range', description: 'Range query on a field', valueType: 'object', example: '{ "field": { "gte": 10 } }' },
    { field: 'bool', description: 'Combine queries with boolean logic', valueType: 'object' },
    { field: 'exists', description: 'Match documents with a field', valueType: 'object', example: '{ "field": "name" }' },
    { field: 'wildcard', description: 'Wildcard pattern matching', valueType: 'object' },
    { field: 'regexp', description: 'Regular expression matching', valueType: 'object' },
    { field: 'fuzzy', description: 'Fuzzy matching', valueType: 'object' },
    { field: 'prefix', description: 'Prefix matching', valueType: 'object' },
    { field: 'ids', description: 'Match by document IDs', valueType: 'object', example: '{ "values": ["1", "2"] }' },
    { field: 'nested', description: 'Query nested objects', valueType: 'object' },
    { field: 'has_child', description: 'Query by child documents', valueType: 'object' },
    { field: 'has_parent', description: 'Query by parent documents', valueType: 'object' },
    { field: 'constant_score', description: 'Wrap query with constant score', valueType: 'object' },
    { field: 'dis_max', description: 'Disjunction max query', valueType: 'object' },
    { field: 'function_score', description: 'Custom scoring function', valueType: 'object' },
    { field: 'boosting', description: 'Boosting query', valueType: 'object' },
    { field: 'query_string', description: 'Query string syntax', valueType: 'object' },
    { field: 'simple_query_string', description: 'Simple query string', valueType: 'object' },
    { field: 'geo_bounding_box', description: 'Geo bounding box filter', valueType: 'object' },
    { field: 'geo_distance', description: 'Geo distance filter', valueType: 'object' },
    { field: 'geo_polygon', description: 'Geo polygon filter', valueType: 'object' },
    { field: 'geo_shape', description: 'Geo shape query', valueType: 'object' },
    { field: 'more_like_this', description: 'More like this query', valueType: 'object' },
    { field: 'script', description: 'Script-based query', valueType: 'object' },
    { field: 'percolate', description: 'Percolate query', valueType: 'object' },
    { field: 'wrapper', description: 'Wrapper query', valueType: 'object' },
    { field: 'span_term', description: 'Span term query', valueType: 'object' },
    { field: 'span_multi', description: 'Span multi-term query', valueType: 'object' },
    { field: 'span_first', description: 'Span first query', valueType: 'object' },
    { field: 'span_near', description: 'Span near query', valueType: 'object' },
    { field: 'span_or', description: 'Span or query', valueType: 'object' },
    { field: 'span_not', description: 'Span not query', valueType: 'object' },
    { field: 'span_containing', description: 'Span containing query', valueType: 'object' },
    { field: 'span_within', description: 'Span within query', valueType: 'object' },
  ],
  'bool': [
    { field: 'must', description: 'Clauses that must match', valueType: 'array' },
    { field: 'should', description: 'Clauses that should match', valueType: 'array' },
    { field: 'must_not', description: 'Clauses that must not match', valueType: 'array' },
    { field: 'filter', description: 'Filter clauses (no scoring)', valueType: 'array' },
    { field: 'minimum_should_match', description: 'Minimum should clauses to match', valueType: 'number' },
    { field: 'boost', description: 'Query boost factor', valueType: 'number' },
  ],
  'aggs': [
    { field: 'terms', description: 'Bucket aggregation by term', valueType: 'object' },
    { field: 'date_histogram', description: 'Bucket by date intervals', valueType: 'object' },
    { field: 'histogram', description: 'Bucket by numeric intervals', valueType: 'object' },
    { field: 'range', description: 'Bucket by ranges', valueType: 'object' },
    { field: 'date_range', description: 'Bucket by date ranges', valueType: 'object' },
    { field: 'filter', description: 'Single filter bucket', valueType: 'object' },
    { field: 'filters', description: 'Multiple filter buckets', valueType: 'object' },
    { field: 'nested', description: 'Nested aggregation', valueType: 'object' },
    { field: 'reverse_nested', description: 'Reverse nested aggregation', valueType: 'object' },
    { field: 'global', description: 'Global aggregation', valueType: 'object' },
    { field: 'missing', description: 'Missing values bucket', valueType: 'object' },
    { field: 'sampler', description: 'Sampler aggregation', valueType: 'object' },
    { field: 'diversified_sampler', description: 'Diversified sampler', valueType: 'object' },
    { field: 'significant_terms', description: 'Significant terms', valueType: 'object' },
    { field: 'significant_text', description: 'Significant text', valueType: 'object' },
    { field: 'composite', description: 'Composite aggregation', valueType: 'object' },
    { field: 'auto_date_histogram', description: 'Auto date histogram', valueType: 'object' },
    { field: 'variable_width_histogram', description: 'Variable width histogram', valueType: 'object' },
    { field: 'multi_terms', description: 'Multi-terms aggregation', valueType: 'object' },
    { field: 'geohash_grid', description: 'Geohash grid aggregation', valueType: 'object' },
    { field: 'geotile_grid', description: 'Geotile grid aggregation', valueType: 'object' },
    { field: 'geo_bounds', description: 'Geo bounds aggregation', valueType: 'object' },
    { field: 'geo_centroid', description: 'Geo centroid aggregation', valueType: 'object' },
    { field: 'avg', description: 'Average metric', valueType: 'object' },
    { field: 'sum', description: 'Sum metric', valueType: 'object' },
    { field: 'min', description: 'Minimum metric', valueType: 'object' },
    { field: 'max', description: 'Maximum metric', valueType: 'object' },
    { field: 'count', description: 'Count metric', valueType: 'object' },
    { field: 'value_count', description: 'Value count metric', valueType: 'object' },
    { field: 'cardinality', description: 'Unique count', valueType: 'object' },
    { field: 'stats', description: 'Stats aggregation', valueType: 'object' },
    { field: 'extended_stats', description: 'Extended stats', valueType: 'object' },
    { field: 'percentiles', description: 'Percentiles aggregation', valueType: 'object' },
    { field: 'percentile_ranks', description: 'Percentile ranks', valueType: 'object' },
    { field: 'median_absolute_deviation', description: 'MAD aggregation', valueType: 'object' },
    { field: 'top_hits', description: 'Top hits aggregation', valueType: 'object' },
    { field: 'scripted_metric', description: 'Scripted metric', valueType: 'object' },
    { field: 'weighted_avg', description: 'Weighted average', valueType: 'object' },
    { field: 'matrix_stats', description: 'Matrix stats', valueType: 'object' },
    { field: 'string_stats', description: 'String stats', valueType: 'object' },
    { field: 'boxplot', description: 'Boxplot aggregation', valueType: 'object' },
    { field: 'rate', description: 'Rate aggregation', valueType: 'object' },
    { field: 't_test', description: 'T-test aggregation', valueType: 'object' },
  ],
  'highlight': [
    { field: 'fields', description: 'Fields to highlight', valueType: 'object' },
    { field: 'pre_tags', description: 'Pre-highlight tags', valueType: 'array', example: '["<em>"]' },
    { field: 'post_tags', description: 'Post-highlight tags', valueType: 'array', example: '["</em>"]' },
    { field: 'type', description: 'Highlighter type', valueType: 'string', example: '"unified"' },
    { field: 'fragment_size', description: 'Fragment size', valueType: 'number' },
    { field: 'number_of_fragments', description: 'Number of fragments', valueType: 'number' },
    { field: 'order', description: 'Fragment order', valueType: 'string' },
    { field: 'encoder', description: 'HTML encoder', valueType: 'string' },
    { field: 'require_field_match', description: 'Require field match', valueType: 'boolean' },
    { field: 'boundary_scanner', description: 'Boundary scanner', valueType: 'string' },
    { field: 'boundary_chars', description: 'Boundary characters', valueType: 'string' },
    { field: 'boundary_max_scan', description: 'Max boundary scan', valueType: 'number' },
    { field: 'max_analyzed_offset', description: 'Max analyzed offset', valueType: 'number' },
  ],
  'sort': [
    { field: '_score', description: 'Sort by relevance score', valueType: 'string' },
    { field: '_doc', description: 'Sort by index order', valueType: 'string' },
    { field: 'order', description: 'Sort order (asc/desc)', valueType: 'string', example: '"desc"' },
    { field: 'mode', description: 'Sort mode for arrays', valueType: 'string', example: '"avg"' },
    { field: 'missing', description: 'Missing value handling', valueType: 'string', example: '"_last"' },
    { field: 'unmapped_type', description: 'Type for unmapped fields', valueType: 'string' },
    { field: 'nested', description: 'Nested sort configuration', valueType: 'object' },
  ],
  'range': [
    { field: 'gte', description: 'Greater than or equal', valueType: 'number' },
    { field: 'gt', description: 'Greater than', valueType: 'number' },
    { field: 'lte', description: 'Less than or equal', valueType: 'number' },
    { field: 'lt', description: 'Less than', valueType: 'number' },
    { field: 'format', description: 'Date format', valueType: 'string' },
    { field: 'time_zone', description: 'Time zone', valueType: 'string' },
    { field: 'boost', description: 'Query boost', valueType: 'number' },
    { field: 'relation', description: 'Range relation', valueType: 'string' },
  ],
  'nested': [
    { field: 'path', description: 'Nested path', valueType: 'string' },
    { field: 'query', description: 'Nested query', valueType: 'object' },
    { field: 'score_mode', description: 'Score mode', valueType: 'string', example: '"avg"' },
    { field: 'ignore_unmapped', description: 'Ignore unmapped', valueType: 'boolean' },
    { field: 'inner_hits', description: 'Inner hits configuration', valueType: 'object' },
  ],
  'function_score': [
    { field: 'query', description: 'Base query', valueType: 'object' },
    { field: 'functions', description: 'Scoring functions', valueType: 'array' },
    { field: 'score_mode', description: 'Function score mode', valueType: 'string', example: '"multiply"' },
    { field: 'boost_mode', description: 'Boost mode', valueType: 'string', example: '"multiply"' },
    { field: 'max_boost', description: 'Maximum boost', valueType: 'number' },
    { field: 'min_score', description: 'Minimum score', valueType: 'number' },
  ],
};


/**
 * Get endpoint suggestions based on partial input and HTTP method
 * Requirements: 3.3, 3.9
 * 
 * @param partialEndpoint - Partial endpoint string to match
 * @param method - HTTP method to filter by (optional)
 * @returns Array of matching endpoint suggestions
 */
export function getEndpointSuggestions(
  partialEndpoint: string,
  method?: HttpMethod
): EndpointSuggestion[] {
  const normalizedInput = partialEndpoint.toLowerCase().trim();
  
  return ENDPOINT_REGISTRY.filter((suggestion) => {
    // Check if endpoint contains the partial input
    const endpointMatches = suggestion.endpoint.toLowerCase().includes(normalizedInput);
    
    // Check if method is supported (if method filter is provided)
    const methodMatches = !method || suggestion.methods.includes(method);
    
    return endpointMatches && methodMatches;
  });
}

/**
 * Get Query DSL field suggestions based on JSON path context
 * Requirements: 3.7, 3.10
 * 
 * @param context - The current JSON path context
 * @returns Array of field suggestions appropriate for the context
 */
export function getQueryDslSuggestions(context: QueryDslContext): FieldSuggestion[] {
  // Determine the context key to look up suggestions
  const contextKey = determineContextKey(context);
  
  // Get suggestions for the determined context
  const suggestions = QUERY_DSL_REGISTRY[contextKey];
  
  if (suggestions) {
    return suggestions;
  }
  
  // Unknown object shapes must not receive unrelated top-level properties.
  return [];
}

/**
 * Determine the context key for Query DSL suggestions based on JSON path
 */
function determineContextKey(context: QueryDslContext): string {
  const { path } = context;
  if (path.length === 0) return 'root';
  const last = path[path.length - 1];
  const parent = path[path.length - 2];
  if (parent === 'range') return 'range';
  if (parent === 'aggs' || parent === 'aggregations') return 'aggs';
  if (last === 'query' || last === 'post_filter') return 'query';
  if (parent === 'bool' && last && ['must', 'should', 'must_not', 'filter'].includes(last)) return 'query';
  if (last === 'bool') return 'bool';
  if (last && ['highlight', 'sort', 'nested', 'function_score'].includes(last)) return last;
  // Aggregation names and query field names are user-defined, not DSL keywords.
  return '';
}

/**
 * Parse a JSON string to determine the current context for autocomplete
 * 
 * @param jsonString - The JSON string being edited
 * @param cursorPosition - The cursor position in the string
 * @returns The QueryDslContext for the cursor position
 */
export function parseJsonContext(
  jsonString: string,
  cursorPosition: number
): QueryDslContext {
  const { path, parentKey, isValue } = jsonCompletionContext(jsonString, cursorPosition);
  return { path, parentKey, isValue };
}

/**
 * Get endpoint suggestions with dynamic index names from the cluster
 * Requirements: 3.3, 3.9
 * 
 * @param partialEndpoint - Partial endpoint string to match
 * @param method - HTTP method to filter by (optional)
 * @param clusterIndices - Array of index names from the cluster
 * @returns Array of matching endpoint suggestions including cluster-specific indices
 */
export function getEndpointSuggestionsWithIndices(
  partialEndpoint: string,
  method?: HttpMethod,
  clusterIndices: string[] = []
): EndpointSuggestion[] {
  const normalizedInput = partialEndpoint.toLowerCase().trim();
  const suggestions: EndpointSuggestion[] = [];
  
  // Get base suggestions from registry
  const baseSuggestions = ENDPOINT_REGISTRY.filter((suggestion) => {
    const endpointMatches = suggestion.endpoint.toLowerCase().includes(normalizedInput);
    const methodMatches = !method || suggestion.methods.includes(method);
    return endpointMatches && methodMatches;
  });
  
  suggestions.push(...baseSuggestions);
  
  // Generate index-specific suggestions if we have cluster indices
  if (clusterIndices.length > 0) {
    // Find templates that have {index} placeholder
    const indexTemplates = ENDPOINT_REGISTRY.filter(
      (s) => s.endpoint.includes('{index}') && (!method || s.methods.includes(method))
    );
    
    // For each cluster index, generate concrete endpoint suggestions
    for (const indexName of clusterIndices) {
      // Skip system indices (starting with .)
      if (indexName.startsWith('.')) continue;
      
      // Check if the index name matches the partial input
      const indexMatchesInput = indexName.toLowerCase().includes(normalizedInput) ||
        normalizedInput.includes(indexName.toLowerCase());
      
      // Also check if input looks like it's targeting this index
      const inputStartsWithSlash = normalizedInput.startsWith('/');
      const inputAfterSlash = inputStartsWithSlash ? normalizedInput.slice(1) : normalizedInput;
      const indexPrefixMatch = indexName.toLowerCase().startsWith(inputAfterSlash.split('/')[0] || '');
      
      if (indexMatchesInput || indexPrefixMatch || normalizedInput === '' || normalizedInput === '/') {
        for (const template of indexTemplates) {
          const concreteEndpoint = template.endpoint.replace('{index}', indexName);
          
          // Check if this concrete endpoint matches the input
          if (concreteEndpoint.toLowerCase().includes(normalizedInput) || 
              normalizedInput === '' || 
              normalizedInput === '/') {
            // Avoid duplicates
            if (!suggestions.some((s) => s.endpoint === concreteEndpoint)) {
              suggestions.push({
                endpoint: concreteEndpoint,
                description: `${template.description} (${indexName})`,
                methods: template.methods,
                category: template.category,
              });
            }
          }
        }
      }
    }
    
    // Also add direct index suggestions for simple index access
    for (const indexName of clusterIndices) {
      if (indexName.startsWith('.')) continue;
      
      const indexEndpoint = `/${indexName}`;
      const indexMethods: HttpMethod[] = ['GET', 'PUT', 'DELETE', 'HEAD'];
      const indexMatchesInput = indexEndpoint.toLowerCase().includes(normalizedInput) ||
        normalizedInput === '' || normalizedInput === '/';
      const methodSupported = !method || indexMethods.includes(method);
      
      if (indexMatchesInput && methodSupported && !suggestions.some((s) => s.endpoint === indexEndpoint)) {
        suggestions.push({
          endpoint: indexEndpoint,
          description: `Access index: ${indexName}`,
          methods: indexMethods,
          category: 'Index',
        });
      }
    }
  }
  
  // Sort suggestions: exact matches first, then by category
  return suggestions.sort((a, b) => {
    // Prioritize exact prefix matches
    const aStartsWithInput = a.endpoint.toLowerCase().startsWith(normalizedInput);
    const bStartsWithInput = b.endpoint.toLowerCase().startsWith(normalizedInput);
    if (aStartsWithInput && !bStartsWithInput) return -1;
    if (!aStartsWithInput && bStartsWithInput) return 1;
    
    // Then sort by whether it's a concrete index (no placeholders)
    const aHasPlaceholder = a.endpoint.includes('{');
    const bHasPlaceholder = b.endpoint.includes('{');
    if (!aHasPlaceholder && bHasPlaceholder) return -1;
    if (aHasPlaceholder && !bHasPlaceholder) return 1;
    
    // Finally sort alphabetically
    return a.endpoint.localeCompare(b.endpoint);
  });
}

/**
 * Autocomplete Provider class for managing suggestions
 */
export class AutocompleteProvider {
  private clusterIndices: string[] = [];

  /**
   * Set cluster indices for autocomplete
   */
  setClusterIndices(indices: string[]): void {
    this.clusterIndices = indices;
  }

  /**
   * Get cluster indices
   */
  getClusterIndices(): string[] {
    return this.clusterIndices;
  }

  /**
   * Get endpoint suggestions
   */
  getEndpointSuggestions(
    partialEndpoint: string,
    method?: HttpMethod
  ): EndpointSuggestion[] {
    return getEndpointSuggestionsWithIndices(partialEndpoint, method, this.clusterIndices);
  }

  /**
   * Get Query DSL suggestions
   */
  getQueryDslSuggestions(context: QueryDslContext): FieldSuggestion[] {
    return getQueryDslSuggestions(context);
  }

  /**
   * Parse JSON context for autocomplete
   */
  parseJsonContext(jsonString: string, cursorPosition: number): QueryDslContext {
    return parseJsonContext(jsonString, cursorPosition);
  }
}

/**
 * Create a new autocomplete provider instance
 */
export function createAutocompleteProvider(): AutocompleteProvider {
  return new AutocompleteProvider();
}

/**
 * Get the allowed HTTP methods for a given endpoint
 * Returns the methods array if a matching endpoint is found, or null if unknown
 * @param endpoint - The API endpoint path
 * @returns Array of allowed HTTP methods, or null if endpoint pattern not found
 */
export function getAllowedMethods(endpoint: string): HttpMethod[] | null {
  if (!endpoint || endpoint.trim() === '') {
    return null;
  }
  
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Remove query parameters
  const pathOnly = normalizedEndpoint.split('?')[0] || normalizedEndpoint;
  
  // First, try exact match
  const exactMatch = ENDPOINT_REGISTRY.find((e) => e.endpoint === pathOnly);
  if (exactMatch) {
    return exactMatch.methods;
  }
  
  // Try pattern matching - replace concrete values with placeholders
  for (const entry of ENDPOINT_REGISTRY) {
    // Convert endpoint pattern to regex
    // {index}, {id}, {name}, etc. become [^/]+
    const patternStr = entry.endpoint
      .replace(/\{[^}]+\}/g, '[^/]+')
      .replace(/\//g, '\\/');
    
    const pattern = new RegExp(`^${patternStr}$`);
    if (pattern.test(pathOnly)) {
      return entry.methods;
    }
  }
  
  // Special case: bare index name (e.g., /myindex)
  // These support GET, PUT, DELETE, HEAD
  if (/^\/[^\/]+$/.test(pathOnly) && !pathOnly.startsWith('/_')) {
    return ['GET', 'PUT', 'DELETE', 'HEAD'];
  }
  
  return null;
}

/**
 * Check if a specific HTTP method is allowed for an endpoint
 * @param endpoint - The API endpoint path
 * @param method - The HTTP method to check
 * @returns true if method is allowed, false if not allowed, null if endpoint unknown
 */
export function isMethodAllowed(endpoint: string, method: HttpMethod): boolean | null {
  const allowedMethods = getAllowedMethods(endpoint);
  if (allowedMethods === null) {
    return null; // Unknown endpoint, can't determine
  }
  return allowedMethods.includes(method);
}
