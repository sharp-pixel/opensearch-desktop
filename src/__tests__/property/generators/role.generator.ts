// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Role generators for property-based testing
 * Used for Property 12-16: Role Generation tests
 */

import * as fc from 'fast-check';
import type { CategorizedPermission } from '../../../types/tracking';
import type { SecurityRole, IndexPermission, GeneratedRole, RoleSummary } from '../../../types/role';
import { indexPatternArb, permissionStringArb } from './tracking.generator';

/**
 * Generator for valid role names
 * Role names should be alphanumeric with underscores and hyphens
 */
export const roleNameArb: fc.Arbitrary<string> = fc.string({
  unit: fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '_', '-'
  ),
  minLength: 1,
  maxLength: 50,
}).filter((s: string) => /^[a-zA-Z]/.test(s)); // Must start with a letter

/**
 * Generator for cluster permissions
 */
export const clusterPermissionArb: fc.Arbitrary<CategorizedPermission> = fc.record({
  type: fc.constant('cluster' as const),
  permission: permissionStringArb,
});

/**
 * Generator for index permissions with patterns
 */
export const indexPermissionArb: fc.Arbitrary<CategorizedPermission> = fc.record({
  type: fc.constant('index' as const),
  permission: permissionStringArb,
  indexPatterns: fc.array(indexPatternArb, { minLength: 1, maxLength: 3 }),
});

/**
 * Generator for mixed categorized permissions
 */
export const categorizedPermissionArb: fc.Arbitrary<CategorizedPermission> = fc.oneof(
  clusterPermissionArb,
  indexPermissionArb
);

/**
 * Generator for non-empty array of categorized permissions
 */
export const nonEmptyPermissionsArb: fc.Arbitrary<CategorizedPermission[]> = fc.array(
  categorizedPermissionArb,
  { minLength: 1, maxLength: 20 }
);

/**
 * Generator for IndexPermission (role structure)
 */
export const indexPermissionStructArb: fc.Arbitrary<IndexPermission> = fc.record({
  index_patterns: fc.array(indexPatternArb, { minLength: 1, maxLength: 5 }),
  allowed_actions: fc.array(permissionStringArb, { minLength: 1, maxLength: 10 }),
});

/**
 * Generator for SecurityRole
 */
export const securityRoleArb: fc.Arbitrary<SecurityRole> = fc.record({
  cluster_permissions: fc.array(permissionStringArb, { minLength: 0, maxLength: 10 }),
  index_permissions: fc.array(indexPermissionStructArb, { minLength: 0, maxLength: 5 }),
  tenant_permissions: fc.constant([]),
});

/**
 * Generator for RoleSummary
 */
export const roleSummaryArb: fc.Arbitrary<RoleSummary> = fc.record({
  clusterPermissionCount: fc.nat({ max: 100 }),
  indexPermissionCount: fc.nat({ max: 100 }),
  indexPatterns: fc.array(indexPatternArb, { minLength: 0, maxLength: 10 }),
});

/**
 * Generator for GeneratedRole
 */
export const generatedRoleArb: fc.Arbitrary<GeneratedRole> = fc.record({
  roleName: roleNameArb,
  roleDefinition: securityRoleArb,
  summary: roleSummaryArb,
});

/**
 * Known OpenSearch endpoint patterns for testing permission mapping
 */
export const knownEndpointArb: fc.Arbitrary<{ method: string; endpoint: string; expectedPermissions: string[] }> = fc.constantFrom(
  // Search operations
  {
    method: 'GET',
    endpoint: '/my-index/_search',
    expectedPermissions: ['indices:data/read/search', 'indices:data/read/search/stream'],
  },
  {
    method: 'POST',
    endpoint: '/logs-2024/_search',
    expectedPermissions: ['indices:data/read/search', 'indices:data/read/search/stream'],
  },
  {
    method: 'GET',
    endpoint: '/_search',
    expectedPermissions: ['indices:data/read/search', 'indices:data/read/search/stream'],
  },
  
  // Document operations
  { method: 'GET', endpoint: '/products/_doc/123', expectedPermissions: ['indices:data/read/get'] },
  { method: 'PUT', endpoint: '/users/_doc/456', expectedPermissions: ['indices:data/write/index'] },
  { method: 'POST', endpoint: '/events/_doc', expectedPermissions: ['indices:data/write/index'] },
  { method: 'DELETE', endpoint: '/temp/_doc/789', expectedPermissions: ['indices:data/write/delete'] },
  
  // Index management
  { method: 'PUT', endpoint: '/new-index', expectedPermissions: ['indices:admin/create'] },
  { method: 'DELETE', endpoint: '/old-index', expectedPermissions: ['indices:admin/delete'] },
  { method: 'GET', endpoint: '/test/_mapping', expectedPermissions: ['indices:admin/mappings/get'] },
  { method: 'PUT', endpoint: '/test/_mapping', expectedPermissions: ['indices:admin/mapping/put'] },
  
  // Cluster operations
  { method: 'GET', endpoint: '/_cluster/health', expectedPermissions: ['cluster:monitor/health'] },
  { method: 'GET', endpoint: '/_cluster/state', expectedPermissions: ['cluster:monitor/state'] },
  { method: 'GET', endpoint: '/_nodes', expectedPermissions: ['cluster:monitor/nodes/info'] },
  {
    method: 'GET',
    endpoint: '/_cat/indices',
    expectedPermissions: [
      'indices:monitor/settings/get',
      'indices:monitor/stats',
      'cluster:monitor/state',
      'cluster:monitor/health',
    ],
  },
  
  // Bulk operations
  { method: 'POST', endpoint: '/_bulk', expectedPermissions: ['indices:data/write/bulk'] },
  { method: 'POST', endpoint: '/myindex/_bulk', expectedPermissions: ['indices:data/write/bulk'] },
);
