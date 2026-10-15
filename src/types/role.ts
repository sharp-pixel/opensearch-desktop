// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Security role interfaces for OpenSearch Notebook
 * Requirements: 6.5
 */

export interface IndexPermission {
  index_patterns: string[];
  allowed_actions: string[];
}

export interface TenantPermission {
  tenant_patterns: string[];
  allowed_actions: string[];
}

export interface SecurityRole {
  cluster_permissions: string[];
  index_permissions: IndexPermission[];
  tenant_permissions: TenantPermission[];
}

export interface RoleSummary {
  clusterPermissionCount: number;
  indexPermissionCount: number;
  indexPatterns: string[];
}

export interface GeneratedRole {
  roleName: string;
  roleDefinition: SecurityRole;
  summary: RoleSummary;
}
