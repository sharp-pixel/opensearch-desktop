// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Role Generator Service for OpenSearch Notebook
 * Generates OpenSearch security roles based on tracked API usage
 * Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import type { CategorizedPermission } from '../types/tracking';
import type {
  SecurityRole,
  IndexPermission,
  GeneratedRole,
  RoleSummary,
} from '../types/role';

/**
 * Validation result for role JSON
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Generate an OpenSearch security role from categorized permissions
 * Requirements: 6.1, 6.3, 6.4, 6.5, 6.6
 *
 * @param permissions - Array of categorized permissions from API tracking
 * @param roleName - Name for the generated role
 * @returns GeneratedRole with role definition and summary
 */
export function generateRole(
  permissions: CategorizedPermission[],
  roleName: string
): GeneratedRole {
  // Separate cluster and index permissions
  const clusterPermissions: string[] = [];
  const indexPermissionMap: Map<string, Set<string>> = new Map();

  for (const perm of permissions) {
    if (perm.type === 'cluster') {
      // Add cluster permission if not already present
      if (!clusterPermissions.includes(perm.permission)) {
        clusterPermissions.push(perm.permission);
      }
    } else if (perm.type === 'index') {
      // Group index permissions by index pattern
      const patterns = perm.indexPatterns || ['*'];
      const patternKey = patterns.sort().join(',');

      if (!indexPermissionMap.has(patternKey)) {
        indexPermissionMap.set(patternKey, new Set());
      }
      indexPermissionMap.get(patternKey)!.add(perm.permission);
    }
  }

  // Build index_permissions array
  const indexPermissions: IndexPermission[] = [];
  const allIndexPatterns: Set<string> = new Set();

  for (const [patternKey, actions] of indexPermissionMap) {
    const patterns = patternKey.split(',').filter(Boolean);
    patterns.forEach((p) => allIndexPatterns.add(p));

    indexPermissions.push({
      index_patterns: patterns,
      allowed_actions: Array.from(actions).sort(),
    });
  }

  // Build the security role definition
  const roleDefinition: SecurityRole = {
    cluster_permissions: clusterPermissions.sort(),
    index_permissions: indexPermissions,
    tenant_permissions: [], // Empty by default, can be extended later
  };

  // Build the summary
  const summary: RoleSummary = {
    clusterPermissionCount: clusterPermissions.length,
    indexPermissionCount: countTotalIndexPermissions(indexPermissions),
    indexPatterns: Array.from(allIndexPatterns).sort(),
  };

  return {
    roleName,
    roleDefinition,
    summary,
  };
}

/**
 * Count total unique index permissions across all index permission entries
 */
function countTotalIndexPermissions(indexPermissions: IndexPermission[]): number {
  const uniquePermissions = new Set<string>();
  for (const ip of indexPermissions) {
    for (const action of ip.allowed_actions) {
      uniquePermissions.add(action);
    }
  }
  return uniquePermissions.size;
}

/**
 * Export a generated role as JSON string
 * Requirements: 6.8
 *
 * @param role - The generated role to export
 * @returns JSON string representation of the role
 */
export function exportAsJson(role: GeneratedRole): string {
  const output = {
    [role.roleName]: role.roleDefinition,
  };
  return JSON.stringify(output, null, 2);
}

/**
 * Validate a role JSON string
 * Requirements: 7.3, 7.4
 *
 * @param json - JSON string to validate
 * @returns ValidationResult with valid flag and any errors
 */
export function validateRoleJson(json: string): ValidationResult {
  const errors: string[] = [];

  // Try to parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`],
    };
  }

  // Check if it's an object
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ['Role JSON must be an object with role name as key'],
    };
  }

  const roleObj = parsed as Record<string, unknown>;
  const roleNames = Object.keys(roleObj);

  if (roleNames.length === 0) {
    return {
      valid: false,
      errors: ['Role JSON must contain at least one role definition'],
    };
  }

  // Validate each role definition
  for (const roleName of roleNames) {
    const roleDef = roleObj[roleName];

    if (typeof roleDef !== 'object' || roleDef === null) {
      errors.push(`Role "${roleName}": definition must be an object`);
      continue;
    }

    const def = roleDef as Record<string, unknown>;

    // Validate cluster_permissions
    if ('cluster_permissions' in def) {
      if (!Array.isArray(def.cluster_permissions)) {
        errors.push(`Role "${roleName}": cluster_permissions must be an array`);
      } else {
        for (let i = 0; i < def.cluster_permissions.length; i++) {
          if (typeof def.cluster_permissions[i] !== 'string') {
            errors.push(
              `Role "${roleName}": cluster_permissions[${i}] must be a string`
            );
          }
        }
      }
    }

    // Validate index_permissions
    if ('index_permissions' in def) {
      if (!Array.isArray(def.index_permissions)) {
        errors.push(`Role "${roleName}": index_permissions must be an array`);
      } else {
        for (let i = 0; i < def.index_permissions.length; i++) {
          const ip = def.index_permissions[i] as Record<string, unknown>;

          if (typeof ip !== 'object' || ip === null) {
            errors.push(
              `Role "${roleName}": index_permissions[${i}] must be an object`
            );
            continue;
          }

          // Check index_patterns
          if (!('index_patterns' in ip)) {
            errors.push(
              `Role "${roleName}": index_permissions[${i}] missing index_patterns`
            );
          } else if (!Array.isArray(ip.index_patterns)) {
            errors.push(
              `Role "${roleName}": index_permissions[${i}].index_patterns must be an array`
            );
          }

          // Check allowed_actions
          if (!('allowed_actions' in ip)) {
            errors.push(
              `Role "${roleName}": index_permissions[${i}] missing allowed_actions`
            );
          } else if (!Array.isArray(ip.allowed_actions)) {
            errors.push(
              `Role "${roleName}": index_permissions[${i}].allowed_actions must be an array`
            );
          }
        }
      }
    }

    // Validate tenant_permissions if present
    if ('tenant_permissions' in def) {
      if (!Array.isArray(def.tenant_permissions)) {
        errors.push(`Role "${roleName}": tenant_permissions must be an array`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse a role JSON string back into a GeneratedRole
 *
 * @param json - JSON string to parse
 * @param expectedRoleName - Optional expected role name for validation
 * @returns GeneratedRole or null if invalid
 */
export function parseRoleJson(
  json: string,
  expectedRoleName?: string
): GeneratedRole | null {
  const validation = validateRoleJson(json);
  if (!validation.valid) {
    return null;
  }

  const parsed = JSON.parse(json) as Record<string, SecurityRole>;
  const roleNames = Object.keys(parsed);

  if (roleNames.length === 0) {
    return null;
  }

  // Use expected role name if provided, otherwise use first role
  const roleName: string = expectedRoleName && roleNames.includes(expectedRoleName)
    ? expectedRoleName
    : roleNames[0]!;

  const roleDefinition = parsed[roleName]!

  // Build summary from role definition
  const allIndexPatterns = new Set<string>();
  for (const ip of roleDefinition.index_permissions || []) {
    for (const pattern of ip.index_patterns) {
      allIndexPatterns.add(pattern);
    }
  }

  const summary: RoleSummary = {
    clusterPermissionCount: (roleDefinition.cluster_permissions || []).length,
    indexPermissionCount: countTotalIndexPermissions(
      roleDefinition.index_permissions || []
    ),
    indexPatterns: Array.from(allIndexPatterns).sort(),
  };

  return {
    roleName,
    roleDefinition: {
      cluster_permissions: roleDefinition.cluster_permissions || [],
      index_permissions: roleDefinition.index_permissions || [],
      tenant_permissions: roleDefinition.tenant_permissions || [],
    },
    summary,
  };
}

/**
 * Create an empty role with the given name
 *
 * @param roleName - Name for the role
 * @returns GeneratedRole with empty permissions
 */
export function createEmptyRole(roleName: string): GeneratedRole {
  return {
    roleName,
    roleDefinition: {
      cluster_permissions: [],
      index_permissions: [],
      tenant_permissions: [],
    },
    summary: {
      clusterPermissionCount: 0,
      indexPermissionCount: 0,
      indexPatterns: [],
    },
  };
}
