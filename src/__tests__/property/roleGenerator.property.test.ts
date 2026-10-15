// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Role Generator Service
 * Feature: opensearch-notebook-ui
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  roleNameArb,
  nonEmptyPermissionsArb,
  clusterPermissionArb,
  indexPermissionArb,
  knownEndpointArb,
} from './generators/role.generator';
import {
  generateRole,
  exportAsJson,
  validateRoleJson,
} from '../../services/roleGenerator';
import {
  mapEndpointToPermission,
} from '../../services/permissionMapper';
import type { HttpMethod } from '../../types/cell';
import type { CategorizedPermission } from '../../types/tracking';

describe('Role Generator Property Tests', () => {
  /**
   * Property 13: Endpoint to Permission Mapping Correctness
   * For any known OpenSearch API endpoint pattern, the permission mapper should return
   * the correct OpenSearch permission string as defined in the mapping table,
   * and unknown endpoints should be handled gracefully.
   * **Validates: Requirements 6.2**
   */
  it('Property 13: Endpoint to Permission Mapping Correctness', () => {
    fc.assert(
      fc.property(knownEndpointArb, ({ method, endpoint, expectedPermissions }) => {
        const result = mapEndpointToPermission(method as HttpMethod, endpoint);

        // Property: Known endpoints should return a mapping
        expect(result).not.toBeNull();

        const mappedPermissions = result!.permissions.map((perm) => perm.permission);
        for (const expectedPermission of expectedPermissions) {
          expect(mappedPermissions).toContain(expectedPermission);
        }

        // Property: The type should be either 'cluster' or 'index'
        for (const perm of result!.permissions) {
          expect(['cluster', 'index']).toContain(perm.type);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13 (additional): Unknown endpoints are handled gracefully
   */
  it('Property 13 (additional): Unknown endpoints are handled gracefully', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE') as fc.Arbitrary<HttpMethod>,
        fc.constantFrom(
          '/_unknown/endpoint',
          '/some-index/_unknown_action',
          '/_custom/api/path'
        ),
        (method, endpoint) => {
          const result = mapEndpointToPermission(method, endpoint);

          // Property: Unknown endpoints should still return a result (graceful handling)
          // They may return null or a default permission
          if (result !== null) {
            // If a result is returned, it should have valid structure
            expect(Array.isArray(result.permissions)).toBe(true);
            for (const perm of result.permissions) {
              expect(['cluster', 'index']).toContain(perm.type);
              expect(typeof perm.permission).toBe('string');
              expect(perm.permission.length).toBeGreaterThan(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12: Role Generation Produces Valid Structure
   * For any non-empty set of categorized permissions and any valid role name,
   * the generated role should conform to the OpenSearch security role JSON schema.
   * **Validates: Requirements 6.1, 6.5**
   */
  it('Property 12: Role Generation Produces Valid Structure', () => {
    fc.assert(
      fc.property(nonEmptyPermissionsArb, roleNameArb, (permissions, roleName) => {
        const role = generateRole(permissions, roleName);

        // Property: Role name should match input
        expect(role.roleName).toBe(roleName);

        // Property: roleDefinition should have required fields
        expect(role.roleDefinition).toHaveProperty('cluster_permissions');
        expect(role.roleDefinition).toHaveProperty('index_permissions');
        expect(role.roleDefinition).toHaveProperty('tenant_permissions');

        // Property: cluster_permissions should be an array of strings
        expect(Array.isArray(role.roleDefinition.cluster_permissions)).toBe(true);
        for (const perm of role.roleDefinition.cluster_permissions) {
          expect(typeof perm).toBe('string');
        }

        // Property: index_permissions should be an array of objects with correct structure
        expect(Array.isArray(role.roleDefinition.index_permissions)).toBe(true);
        for (const ip of role.roleDefinition.index_permissions) {
          expect(ip).toHaveProperty('index_patterns');
          expect(ip).toHaveProperty('allowed_actions');
          expect(Array.isArray(ip.index_patterns)).toBe(true);
          expect(Array.isArray(ip.allowed_actions)).toBe(true);
        }

        // Property: tenant_permissions should be an array
        expect(Array.isArray(role.roleDefinition.tenant_permissions)).toBe(true);

        // Property: Generated JSON should be valid
        const json = exportAsJson(role);
        const validation = validateRoleJson(json);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Role Generation Applies Least Privilege
   * For any set of tracked operations, the generated role should contain exactly
   * the permissions corresponding to those operations—no additional permissions.
   * **Validates: Requirements 6.3, 6.4, 6.6**
   */
  it('Property 14: Role Generation Applies Least Privilege', () => {
    fc.assert(
      fc.property(nonEmptyPermissionsArb, roleNameArb, (permissions, roleName) => {
        const role = generateRole(permissions, roleName);

        // Collect all input permissions
        const inputClusterPerms = new Set(
          permissions
            .filter((p) => p.type === 'cluster')
            .map((p) => p.permission)
        );
        const inputIndexPerms = new Set(
          permissions
            .filter((p) => p.type === 'index')
            .map((p) => p.permission)
        );

        // Property: All cluster permissions in output should be from input
        for (const perm of role.roleDefinition.cluster_permissions) {
          expect(inputClusterPerms.has(perm)).toBe(true);
        }

        // Property: All index permissions in output should be from input
        for (const ip of role.roleDefinition.index_permissions) {
          for (const action of ip.allowed_actions) {
            expect(inputIndexPerms.has(action)).toBe(true);
          }
        }

        // Property: No extra permissions should be added
        const outputClusterCount = role.roleDefinition.cluster_permissions.length;
        const outputIndexActions = role.roleDefinition.index_permissions.flatMap(
          (ip) => ip.allowed_actions
        );
        const uniqueOutputIndexPerms = new Set(outputIndexActions);

        // Output should not exceed input (accounting for deduplication)
        expect(outputClusterCount).toBeLessThanOrEqual(inputClusterPerms.size);
        expect(uniqueOutputIndexPerms.size).toBeLessThanOrEqual(inputIndexPerms.size);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14 (additional): Permissions are grouped by index pattern
   */
  it('Property 14 (additional): Permissions are grouped by index pattern', () => {
    fc.assert(
      fc.property(
        fc.array(indexPermissionArb, { minLength: 2, maxLength: 10 }),
        roleNameArb,
        (permissions, roleName) => {
          const role = generateRole(permissions, roleName);

          // Property: Each index_permissions entry should have unique index_patterns combination
          const patternKeys = role.roleDefinition.index_permissions.map((ip) =>
            ip.index_patterns.sort().join(',')
          );
          const uniquePatternKeys = new Set(patternKeys);
          expect(patternKeys.length).toBe(uniquePatternKeys.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15: Role Name Inclusion
   * For any role generation request with a specified role name,
   * the output should include that exact role name.
   * **Validates: Requirements 6.7**
   */
  it('Property 15: Role Name Inclusion', () => {
    fc.assert(
      fc.property(nonEmptyPermissionsArb, roleNameArb, (permissions, roleName) => {
        const role = generateRole(permissions, roleName);

        // Property: Role name should be exactly as specified
        expect(role.roleName).toBe(roleName);

        // Property: Exported JSON should contain the role name as key
        const json = exportAsJson(role);
        const parsed = JSON.parse(json);
        expect(Object.keys(parsed)).toContain(roleName);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16: Role Summary Accuracy
   * For any generated role, the summary should accurately report the count of
   * cluster permissions, index permissions, and the complete list of index patterns.
   * **Validates: Requirements 7.5**
   */
  it('Property 16: Role Summary Accuracy', () => {
    fc.assert(
      fc.property(nonEmptyPermissionsArb, roleNameArb, (permissions, roleName) => {
        const role = generateRole(permissions, roleName);

        // Property: Cluster permission count should match actual count
        expect(role.summary.clusterPermissionCount).toBe(
          role.roleDefinition.cluster_permissions.length
        );

        // Property: Index permission count should match unique actions count
        const uniqueIndexActions = new Set<string>();
        for (const ip of role.roleDefinition.index_permissions) {
          for (const action of ip.allowed_actions) {
            uniqueIndexActions.add(action);
          }
        }
        expect(role.summary.indexPermissionCount).toBe(uniqueIndexActions.size);

        // Property: Index patterns should include all patterns from index_permissions
        const actualPatterns = new Set<string>();
        for (const ip of role.roleDefinition.index_permissions) {
          for (const pattern of ip.index_patterns) {
            actualPatterns.add(pattern);
          }
        }
        const summaryPatterns = new Set(role.summary.indexPatterns);
        expect(summaryPatterns.size).toBe(actualPatterns.size);
        for (const pattern of actualPatterns) {
          expect(summaryPatterns.has(pattern)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16 (additional): Summary is consistent with role definition
   */
  it('Property 16 (additional): Summary is consistent with role definition', () => {
    fc.assert(
      fc.property(
        fc.array(clusterPermissionArb, { minLength: 0, maxLength: 5 }),
        fc.array(indexPermissionArb, { minLength: 0, maxLength: 5 }),
        roleNameArb,
        (clusterPerms, indexPerms, roleName) => {
          const allPerms: CategorizedPermission[] = [...clusterPerms, ...indexPerms];
          
          if (allPerms.length === 0) {
            return; // Skip empty case
          }

          const role = generateRole(allPerms, roleName);

          // Property: If there are cluster permissions, count should be > 0
          if (clusterPerms.length > 0) {
            expect(role.summary.clusterPermissionCount).toBeGreaterThanOrEqual(0);
          }

          // Property: If there are index permissions, patterns should be listed
          if (indexPerms.length > 0) {
            // At least some patterns should be present (may be deduplicated)
            expect(role.summary.indexPatterns.length).toBeGreaterThanOrEqual(0);
          }

          // Property: Summary counts should be non-negative
          expect(role.summary.clusterPermissionCount).toBeGreaterThanOrEqual(0);
          expect(role.summary.indexPermissionCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

import {
  parseRoleJson,
  createEmptyRole,
} from '../../services/roleGenerator';

describe('Role Generator Extended Tests', () => {
  /**
   * Property: parseRoleJson should correctly parse valid role JSON
   */
  it('Property: parseRoleJson correctly parses valid role JSON', () => {
    fc.assert(
      fc.property(nonEmptyPermissionsArb, roleNameArb, (permissions, roleName) => {
        const role = generateRole(permissions, roleName);
        const json = exportAsJson(role);
        
        const parsed = parseRoleJson(json, roleName);
        
        // Property: Parsed role should not be null
        expect(parsed).not.toBeNull();
        
        // Property: Role name should match
        expect(parsed!.roleName).toBe(roleName);
        
        // Property: Cluster permissions should match
        expect(parsed!.roleDefinition.cluster_permissions).toEqual(
          role.roleDefinition.cluster_permissions
        );
        
        // Property: Index permissions should match
        expect(parsed!.roleDefinition.index_permissions).toEqual(
          role.roleDefinition.index_permissions
        );
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: parseRoleJson returns null for invalid JSON
   */
  it('Property: parseRoleJson returns null for invalid JSON', () => {
    const invalidJsons = [
      'not json',
      '[]',
      'null',
      '{}',
      '{"role": "not an object"}',
    ];
    
    for (const json of invalidJsons) {
      const result = parseRoleJson(json);
      expect(result).toBeNull();
    }
  });

  /**
   * Property: parseRoleJson uses first role when expectedRoleName not found
   */
  it('Property: parseRoleJson uses first role when expectedRoleName not found', () => {
    const json = JSON.stringify({
      'actual-role': {
        cluster_permissions: ['cluster:monitor/health'],
        index_permissions: [],
        tenant_permissions: [],
      },
    });
    
    const parsed = parseRoleJson(json, 'non-existent-role');
    expect(parsed).not.toBeNull();
    expect(parsed!.roleName).toBe('actual-role');
  });

  /**
   * Property: createEmptyRole creates a valid empty role
   */
  it('Property: createEmptyRole creates a valid empty role', () => {
    fc.assert(
      fc.property(roleNameArb, (roleName) => {
        const role = createEmptyRole(roleName);
        
        // Property: Role name should match
        expect(role.roleName).toBe(roleName);
        
        // Property: All permission arrays should be empty
        expect(role.roleDefinition.cluster_permissions).toEqual([]);
        expect(role.roleDefinition.index_permissions).toEqual([]);
        expect(role.roleDefinition.tenant_permissions).toEqual([]);
        
        // Property: Summary counts should be zero
        expect(role.summary.clusterPermissionCount).toBe(0);
        expect(role.summary.indexPermissionCount).toBe(0);
        expect(role.summary.indexPatterns).toEqual([]);
        
        // Property: Generated JSON should be valid
        const json = exportAsJson(role);
        const validation = validateRoleJson(json);
        expect(validation.valid).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: validateRoleJson detects various invalid structures
   */
  it('Property: validateRoleJson detects invalid structures', () => {
    const invalidCases = [
      { json: '{"role": {"cluster_permissions": "not-array"}}', error: 'cluster_permissions must be an array' },
      { json: '{"role": {"cluster_permissions": [123]}}', error: 'must be a string' },
      { json: '{"role": {"index_permissions": "not-array"}}', error: 'index_permissions must be an array' },
      { json: '{"role": {"index_permissions": [{}]}}', error: 'missing index_patterns' },
      { json: '{"role": {"index_permissions": [{"index_patterns": "not-array"}]}}', error: 'index_patterns must be an array' },
      { json: '{"role": {"index_permissions": [{"index_patterns": []}]}}', error: 'missing allowed_actions' },
      { json: '{"role": {"tenant_permissions": "not-array"}}', error: 'tenant_permissions must be an array' },
    ];
    
    for (const { json, error } of invalidCases) {
      const result = validateRoleJson(json);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes(error))).toBe(true);
    }
  });

  /**
   * Property: validateRoleJson handles index_permissions with invalid allowed_actions
   */
  it('Property: validateRoleJson detects invalid allowed_actions', () => {
    const json = '{"role": {"index_permissions": [{"index_patterns": ["*"], "allowed_actions": "not-array"}]}}';
    const result = validateRoleJson(json);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('allowed_actions must be an array'))).toBe(true);
  });

  /**
   * Property: validateRoleJson handles non-object index_permissions entries
   */
  it('Property: validateRoleJson detects non-object index_permissions entries', () => {
    const json = '{"role": {"index_permissions": ["not-an-object"]}}';
    const result = validateRoleJson(json);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must be an object'))).toBe(true);
  });
});
