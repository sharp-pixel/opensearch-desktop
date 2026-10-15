// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Data Prepper Role Generator Service
 * Generates OpenSearch security roles from pipeline configurations
 * Analyzes sinks, sources, and features to determine minimum required permissions
 */

import type { 
  PipelineConfig, 
  OpenSearchSinkConfig,
} from '../types/dataPrepper';
import type { GeneratedRole, IndexPermission, SecurityRole } from '../types/role';
import { 
  parsePipelineConfig, 
  isValidationResult, 
  extractOpenSearchSinks,
  extractOpenSearchSources,
} from './pipelineParser';

/**
 * Permission categories for different Data Prepper operations
 */
const PERMISSIONS = {
  // Cluster-level permissions
  cluster: {
    monitor: [
      'cluster:monitor/main',
      'cluster:monitor/health',
    ],
    ism: [
      'cluster:admin/opendistro/ism/policy/get',
      'cluster:admin/opendistro/ism/managedindex/add',
    ],
    template: [
      'cluster:admin/indices/template/get',
      'cluster:admin/indices/template/put',
    ],
  },
  // Index-level permissions for writing
  indexWrite: {
    basic: [
      'indices:data/write/index',
      'indices:data/write/bulk',
    ],
    create: [
      'indices:admin/create',
    ],
    mapping: [
      'indices:admin/mapping/put',
    ],
    delete: [
      'indices:data/write/delete',
    ],
    update: [
      'indices:data/write/update',
    ],
  },
  // Index-level permissions for reading
  indexRead: {
    search: [
      'indices:data/read/search',
    ],
    scroll: [
      'indices:data/read/scroll',
      'indices:data/read/scroll/clear',
    ],
    get: [
      'indices:data/read/get',
    ],
  },
};

/**
 * Detected features from pipeline analysis
 */
interface DetectedFeatures {
  hasOpenSearchSink: boolean;
  hasOpenSearchSource: boolean;
  hasTemplateFile: boolean;
  hasIsmPolicy: boolean;
  hasDlq: boolean;
  sinkActions: Set<string>;
  writeIndexPatterns: string[];
  readIndexPatterns: string[];
  dlqIndexPatterns: string[];
}

/**
 * Generate a security role from pipeline configuration
 */
export function generateDataPrepperRole(
  pipelineYaml: string,
  roleName: string = 'data_prepper_role'
): GeneratedRole | { error: string } {
  // Parse pipeline config
  const parseResult = parsePipelineConfig(pipelineYaml);
  
  if (isValidationResult(parseResult)) {
    return {
      error: `Invalid pipeline configuration: ${parseResult.errors.map((e) => e.message).join(', ')}`,
    };
  }

  return generateRoleFromConfig(parseResult, roleName);
}

/**
 * Generate role from parsed pipeline config
 */
export function generateRoleFromConfig(
  config: PipelineConfig,
  roleName: string = 'data_prepper_role'
): GeneratedRole | { error: string } {
  // Analyze pipeline to detect features
  const features = analyzePipeline(config);
  
  if (!features.hasOpenSearchSink && !features.hasOpenSearchSource) {
    return {
      error: 'No OpenSearch sinks or sources found in pipeline configuration',
    };
  }

  if (features.writeIndexPatterns.length === 0 && features.readIndexPatterns.length === 0) {
    return {
      error: 'No index patterns found in OpenSearch configurations',
    };
  }

  // Build cluster permissions
  const clusterPermissions = buildClusterPermissions(features);
  
  // Build index permissions
  const indexPermissions = buildIndexPermissions(features);

  const roleDefinition: SecurityRole = {
    cluster_permissions: clusterPermissions,
    index_permissions: indexPermissions,
    tenant_permissions: [],
  };

  // Build summary
  const allIndexPatterns = [
    ...features.writeIndexPatterns,
    ...features.readIndexPatterns,
    ...features.dlqIndexPatterns,
  ];

  return {
    roleName,
    roleDefinition,
    summary: {
      clusterPermissionCount: clusterPermissions.length,
      indexPermissionCount: indexPermissions.reduce((sum, ip) => sum + ip.allowed_actions.length, 0),
      indexPatterns: [...new Set(allIndexPatterns)],
    },
  };
}

/**
 * Analyze pipeline configuration to detect features
 */
function analyzePipeline(config: PipelineConfig): DetectedFeatures {
  const features: DetectedFeatures = {
    hasOpenSearchSink: false,
    hasOpenSearchSource: false,
    hasTemplateFile: false,
    hasIsmPolicy: false,
    hasDlq: false,
    sinkActions: new Set(),
    writeIndexPatterns: [],
    readIndexPatterns: [],
    dlqIndexPatterns: [],
  };

  // Analyze OpenSearch sinks
  const openSearchSinks = extractOpenSearchSinks(config);
  if (openSearchSinks.length > 0) {
    features.hasOpenSearchSink = true;
    
    for (const sink of openSearchSinks) {
      if (sink.opensearch) {
        analyzeSink(sink.opensearch, features);
      }
    }
  }

  // Analyze OpenSearch sources
  const openSearchSources = extractOpenSearchSources(config);
  if (openSearchSources.length > 0) {
    features.hasOpenSearchSource = true;
    
    for (const source of openSearchSources) {
      if (source.opensearch) {
        analyzeSource(source.opensearch as Record<string, unknown>, features);
      }
    }
  }

  return features;
}

/**
 * Analyze a single OpenSearch sink configuration
 */
function analyzeSink(sink: OpenSearchSinkConfig, features: DetectedFeatures): void {
  // Extract index pattern
  const indexPattern = normalizeIndexPattern(sink.index);
  if (indexPattern && !features.writeIndexPatterns.includes(indexPattern)) {
    features.writeIndexPatterns.push(indexPattern);
  }

  // Check for template file
  if (sink.template_file) {
    features.hasTemplateFile = true;
  }

  // Check for ISM policy
  if (sink.ism_policy_file) {
    features.hasIsmPolicy = true;
  }

  // Check for DLQ
  if (sink.dlq || sink.dlq_file) {
    features.hasDlq = true;
    // Add DLQ index pattern (convention: original-index-dlq)
    if (indexPattern) {
      const dlqPattern = indexPattern.replace(/\*$/, '') + 'dlq-*';
      if (!features.dlqIndexPatterns.includes(dlqPattern)) {
        features.dlqIndexPatterns.push(dlqPattern);
      }
    }
  }

  // Track action type
  const action = sink.action || 'index';
  features.sinkActions.add(action);
}

/**
 * Analyze a single OpenSearch source configuration
 */
function analyzeSource(source: Record<string, unknown>, features: DetectedFeatures): void {
  // Extract index pattern from source
  if (typeof source.index === 'string') {
    const indexPattern = normalizeIndexPattern(source.index);
    if (indexPattern && !features.readIndexPatterns.includes(indexPattern)) {
      features.readIndexPatterns.push(indexPattern);
    }
  }

  // Handle indices.include array
  if (source.indices && typeof source.indices === 'object') {
    const indices = source.indices as { include?: string[]; exclude?: string[] };
    if (Array.isArray(indices.include)) {
      for (const idx of indices.include) {
        const indexPattern = normalizeIndexPattern(idx);
        if (indexPattern && !features.readIndexPatterns.includes(indexPattern)) {
          features.readIndexPatterns.push(indexPattern);
        }
      }
    }
  }
}

/**
 * Normalize an index pattern (handle dynamic patterns)
 */
function normalizeIndexPattern(index: string): string | null {
  if (!index) return null;

  let pattern = index;

  // Handle date math patterns: %{yyyy.MM.dd} -> *
  if (pattern.includes('%{')) {
    pattern = pattern.replace(/%\{[^}]+\}/g, '*');
  }

  // Handle variable patterns: ${field} -> *
  if (pattern.includes('${')) {
    pattern = pattern.replace(/\$\{[^}]+\}/g, '*');
  }

  // Collapse multiple wildcards
  pattern = pattern.replace(/\*+/g, '*');

  // Ensure pattern ends with wildcard if it has date components
  if (pattern.includes('-') && !pattern.endsWith('*')) {
    // Check if it looks like a date-based index
    const lastPart = pattern.split('-').pop() || '';
    if (/^\d/.test(lastPart) || lastPart === '*') {
      // Already has date component
    } else if (pattern.includes('*')) {
      // Has wildcard somewhere
    }
  }

  return pattern;
}

/**
 * Build cluster permissions based on detected features
 */
function buildClusterPermissions(features: DetectedFeatures): string[] {
  const permissions: string[] = [];

  // Always include monitoring permissions
  permissions.push(...PERMISSIONS.cluster.monitor);

  // Add template permissions if template file is used
  if (features.hasTemplateFile) {
    permissions.push(...PERMISSIONS.cluster.template);
  }

  // Add ISM permissions if ISM policy is used
  if (features.hasIsmPolicy) {
    permissions.push(...PERMISSIONS.cluster.ism);
  }

  return [...new Set(permissions)];
}

/**
 * Build index permissions based on detected features
 */
function buildIndexPermissions(features: DetectedFeatures): IndexPermission[] {
  const permissions: IndexPermission[] = [];

  // Write permissions for sink indices
  if (features.writeIndexPatterns.length > 0) {
    const writeActions: string[] = [
      ...PERMISSIONS.indexWrite.basic,
      ...PERMISSIONS.indexWrite.create,
      ...PERMISSIONS.indexWrite.mapping,
    ];

    // Add delete permission if delete action is used
    if (features.sinkActions.has('delete')) {
      writeActions.push(...PERMISSIONS.indexWrite.delete);
    }

    // Add update permission if update/upsert action is used
    if (features.sinkActions.has('update') || features.sinkActions.has('upsert')) {
      writeActions.push(...PERMISSIONS.indexWrite.update);
    }

    permissions.push({
      index_patterns: features.writeIndexPatterns,
      allowed_actions: [...new Set(writeActions)],
    });
  }

  // Read permissions for source indices
  if (features.readIndexPatterns.length > 0) {
    permissions.push({
      index_patterns: features.readIndexPatterns,
      allowed_actions: [
        ...PERMISSIONS.indexRead.search,
        ...PERMISSIONS.indexRead.scroll,
      ],
    });
  }

  // DLQ permissions (write-only, simpler than main sink)
  if (features.dlqIndexPatterns.length > 0) {
    permissions.push({
      index_patterns: features.dlqIndexPatterns,
      allowed_actions: [
        ...PERMISSIONS.indexWrite.basic,
        ...PERMISSIONS.indexWrite.create,
      ],
    });
  }

  return permissions;
}

/**
 * Check if result is an error
 */
export function isRoleError(result: GeneratedRole | { error: string }): result is { error: string } {
  return 'error' in result;
}

/**
 * Format role as JSON string for display/export
 */
export function formatRoleJson(role: GeneratedRole): string {
  const roleBody = {
    cluster_permissions: role.roleDefinition.cluster_permissions,
    index_permissions: role.roleDefinition.index_permissions.map((ip) => ({
      index_patterns: ip.index_patterns,
      allowed_actions: ip.allowed_actions,
    })),
    tenant_permissions: role.roleDefinition.tenant_permissions,
  };

  return JSON.stringify({ [role.roleName]: roleBody }, null, 2);
}

/**
 * Get the required permissions description for documentation
 */
export function getPermissionsDescription(): {
  cluster: { permission: string; description: string }[];
  index: { permission: string; description: string }[];
} {
  return {
    cluster: [
      { permission: 'cluster:monitor/main', description: 'Required for version check' },
      { permission: 'cluster:monitor/health', description: 'Required for health check' },
      { permission: 'cluster:admin/indices/template/get', description: 'Get index templates (if template_file used)' },
      { permission: 'cluster:admin/indices/template/put', description: 'Create/update index templates (if template_file used)' },
      { permission: 'cluster:admin/opendistro/ism/policy/get', description: 'Get ISM policies (if ism_policy_file used)' },
      { permission: 'cluster:admin/opendistro/ism/managedindex/add', description: 'Apply ISM policies (if ism_policy_file used)' },
    ],
    index: [
      { permission: 'indices:data/write/index', description: 'Write individual documents' },
      { permission: 'indices:data/write/bulk', description: 'Bulk write operations' },
      { permission: 'indices:admin/create', description: 'Create index if not exists' },
      { permission: 'indices:admin/mapping/put', description: 'Update index mappings' },
      { permission: 'indices:data/write/delete', description: 'Delete documents (if action: delete)' },
      { permission: 'indices:data/write/update', description: 'Update documents (if action: update/upsert)' },
      { permission: 'indices:data/read/search', description: 'Search documents (for OpenSearch source)' },
      { permission: 'indices:data/read/scroll', description: 'Scroll through results (for OpenSearch source)' },
    ],
  };
}
