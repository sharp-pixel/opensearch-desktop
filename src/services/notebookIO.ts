// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Notebook Import/Export Service for OpenSearch Notebook
 * Handles exporting notebooks to JSON and importing from JSON files
 * Requirements: 8.2, 8.3, 8.4, 8.5
 */

import type { Notebook } from '../types/notebook';
import type { HttpMethod } from '../types/cell';
import type { ApiTrackerState } from '../types/tracking';

/**
 * Export format version for compatibility checking
 */
export const EXPORT_FORMAT_VERSION = '1.0.0';

/**
 * Exported notebook format including cells and tracking data
 * Requirements: 8.4
 */
export interface ExportedNotebook {
  version: string;
  exportedAt: number;
  notebook: Notebook;
  tracking: ApiTrackerState;
}

/**
 * Validation result for import operations
 * Requirements: 8.5
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valid HTTP methods for validation
 */
const VALID_HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];

/**
 * Export a notebook to JSON format
 * Requirements: 8.2, 8.3, 8.4
 */
export function exportNotebook(notebook: Notebook, tracking: ApiTrackerState): string {
  const exported: ExportedNotebook = {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: Date.now(),
    notebook,
    tracking,
  };
  return JSON.stringify(exported, null, 2);
}

/**
 * Import a notebook from JSON string
 * Requirements: 8.3, 8.4, 8.5
 */
export function importNotebook(json: string): { notebook: Notebook; tracking: ApiTrackerState } | ValidationResult {
  const validation = validateNotebookJson(json);
  if (!validation.valid) {
    return validation;
  }

  try {
    const parsed = JSON.parse(json) as ExportedNotebook;
    return {
      notebook: parsed.notebook,
      tracking: parsed.tracking,
    };
  } catch {
    return { valid: false, errors: ['Failed to parse JSON'] };
  }
}

/**
 * Validate notebook JSON format
 * Requirements: 8.5
 */
export function validateNotebookJson(json: string): ValidationResult {
  const errors: string[] = [];

  // Check if JSON is parseable
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { valid: false, errors: ['Invalid JSON: ' + (e instanceof Error ? e.message : 'Parse error')] };
  }

  // Check if parsed value is an object
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, errors: ['Root must be an object'] };
  }

  const obj = parsed as Record<string, unknown>;

  // Validate version field
  if (!('version' in obj)) {
    errors.push('Missing required field: version');
  } else if (typeof obj.version !== 'string') {
    errors.push('Field "version" must be a string');
  }

  // Validate exportedAt field
  if (!('exportedAt' in obj)) {
    errors.push('Missing required field: exportedAt');
  } else if (typeof obj.exportedAt !== 'number') {
    errors.push('Field "exportedAt" must be a number');
  }

  // Validate notebook field
  if (!('notebook' in obj)) {
    errors.push('Missing required field: notebook');
  } else {
    const notebookErrors = validateNotebookStructure(obj.notebook);
    errors.push(...notebookErrors);
  }

  // Validate tracking field
  if (!('tracking' in obj)) {
    errors.push('Missing required field: tracking');
  } else {
    const trackingErrors = validateTrackingStructure(obj.tracking);
    errors.push(...trackingErrors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate notebook structure
 */
function validateNotebookStructure(notebook: unknown): string[] {
  const errors: string[] = [];

  if (typeof notebook !== 'object' || notebook === null || Array.isArray(notebook)) {
    return ['Field "notebook" must be an object'];
  }

  const nb = notebook as Record<string, unknown>;

  // Required fields
  if (!('id' in nb) || typeof nb.id !== 'string') {
    errors.push('notebook.id must be a string');
  }
  if (!('name' in nb) || typeof nb.name !== 'string') {
    errors.push('notebook.name must be a string');
  }
  if (!('createdAt' in nb) || typeof nb.createdAt !== 'number') {
    errors.push('notebook.createdAt must be a number');
  }
  if (!('updatedAt' in nb) || typeof nb.updatedAt !== 'number') {
    errors.push('notebook.updatedAt must be a number');
  }

  // connectionId can be string or null
  if ('connectionId' in nb && nb.connectionId !== null && typeof nb.connectionId !== 'string') {
    errors.push('notebook.connectionId must be a string or null');
  }

  // Validate cells array
  if (!('cells' in nb)) {
    errors.push('notebook.cells is required');
  } else if (!Array.isArray(nb.cells)) {
    errors.push('notebook.cells must be an array');
  } else {
    nb.cells.forEach((cell, index) => {
      const cellErrors = validateCellStructure(cell, index);
      errors.push(...cellErrors);
    });
  }

  return errors;
}

/**
 * Validate cell structure
 */
function validateCellStructure(cell: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `notebook.cells[${index}]`;

  if (typeof cell !== 'object' || cell === null || Array.isArray(cell)) {
    return [`${prefix} must be an object`];
  }

  const c = cell as Record<string, unknown>;

  // Common fields
  if (!('id' in c) || typeof c.id !== 'string') {
    errors.push(`${prefix}.id must be a string`);
  }
  if (!('type' in c) || (c.type !== 'query' && c.type !== 'markdown' && c.type !== 'ppl' && c.type !== 'grpc')) {
    errors.push(`${prefix}.type must be "query", "markdown", "ppl", or "grpc"`);
  }
  if (!('createdAt' in c) || typeof c.createdAt !== 'number') {
    errors.push(`${prefix}.createdAt must be a number`);
  }
  if (!('updatedAt' in c) || typeof c.updatedAt !== 'number') {
    errors.push(`${prefix}.updatedAt must be a number`);
  }

  // Type-specific validation
  if (c.type === 'query') {
    if (!('method' in c) || !VALID_HTTP_METHODS.includes(c.method as HttpMethod)) {
      errors.push(`${prefix}.method must be one of: ${VALID_HTTP_METHODS.join(', ')}`);
    }
    if (!('endpoint' in c) || typeof c.endpoint !== 'string') {
      errors.push(`${prefix}.endpoint must be a string`);
    }
    if (!('body' in c) || typeof c.body !== 'string') {
      errors.push(`${prefix}.body must be a string`);
    }
  } else if (c.type === 'grpc') {
    if (c.method !== 'Search' && c.method !== 'Bulk') errors.push(`${prefix}.method must be Search or Bulk`);
    if (typeof c.body !== 'string') errors.push(`${prefix}.body must be a string`);
  } else if (c.type === 'markdown') {
    if (!('content' in c) || typeof c.content !== 'string') {
      errors.push(`${prefix}.content must be a string`);
    }
  } else if (c.type === 'ppl') {
    if (!('query' in c) || typeof c.query !== 'string') {
      errors.push(`${prefix}.query must be a string`);
    }
  }

  return errors;
}

/**
 * Validate tracking structure
 */
function validateTrackingStructure(tracking: unknown): string[] {
  const errors: string[] = [];

  if (typeof tracking !== 'object' || tracking === null || Array.isArray(tracking)) {
    return ['Field "tracking" must be an object'];
  }

  const t = tracking as Record<string, unknown>;

  // Validate operations array
  if (!('operations' in t)) {
    errors.push('tracking.operations is required');
  } else if (!Array.isArray(t.operations)) {
    errors.push('tracking.operations must be an array');
  } else {
    t.operations.forEach((op, index) => {
      const opErrors = validateOperationStructure(op, index);
      errors.push(...opErrors);
    });
  }

  // Validate permissions array
  if (!('permissions' in t)) {
    errors.push('tracking.permissions is required');
  } else if (!Array.isArray(t.permissions)) {
    errors.push('tracking.permissions must be an array');
  } else {
    t.permissions.forEach((perm, index) => {
      const permErrors = validatePermissionStructure(perm, index);
      errors.push(...permErrors);
    });
  }

  return errors;
}

/**
 * Validate tracked operation structure
 */
function validateOperationStructure(operation: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `tracking.operations[${index}]`;

  if (typeof operation !== 'object' || operation === null || Array.isArray(operation)) {
    return [`${prefix} must be an object`];
  }

  const op = operation as Record<string, unknown>;

  if (!('method' in op) || !VALID_HTTP_METHODS.includes(op.method as HttpMethod)) {
    errors.push(`${prefix}.method must be one of: ${VALID_HTTP_METHODS.join(', ')}`);
  }
  if (!('endpoint' in op) || typeof op.endpoint !== 'string') {
    errors.push(`${prefix}.endpoint must be a string`);
  }
  if (!('indexPatterns' in op) || !Array.isArray(op.indexPatterns)) {
    errors.push(`${prefix}.indexPatterns must be an array`);
  } else if (!op.indexPatterns.every((p) => typeof p === 'string')) {
    errors.push(`${prefix}.indexPatterns must contain only strings`);
  }
  if (!('timestamp' in op) || typeof op.timestamp !== 'number') {
    errors.push(`${prefix}.timestamp must be a number`);
  }
  if (!('cellId' in op) || typeof op.cellId !== 'string') {
    errors.push(`${prefix}.cellId must be a string`);
  }

  return errors;
}

/**
 * Validate categorized permission structure
 */
function validatePermissionStructure(permission: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `tracking.permissions[${index}]`;

  if (typeof permission !== 'object' || permission === null || Array.isArray(permission)) {
    return [`${prefix} must be an object`];
  }

  const perm = permission as Record<string, unknown>;

  if (!('type' in perm) || (perm.type !== 'cluster' && perm.type !== 'index')) {
    errors.push(`${prefix}.type must be "cluster" or "index"`);
  }
  if (!('permission' in perm) || typeof perm.permission !== 'string') {
    errors.push(`${prefix}.permission must be a string`);
  }

  // indexPatterns is optional but if present must be an array of strings
  if ('indexPatterns' in perm && perm.indexPatterns !== undefined) {
    if (!Array.isArray(perm.indexPatterns)) {
      errors.push(`${prefix}.indexPatterns must be an array`);
    } else if (!perm.indexPatterns.every((p) => typeof p === 'string')) {
      errors.push(`${prefix}.indexPatterns must contain only strings`);
    }
  }

  return errors;
}

/**
 * Check if a validation result indicates success
 */
export function isValidationResult(result: unknown): result is ValidationResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'valid' in result &&
    'errors' in result &&
    typeof (result as ValidationResult).valid === 'boolean' &&
    Array.isArray((result as ValidationResult).errors)
  );
}
