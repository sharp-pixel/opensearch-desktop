// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Notebook Import/Export Service
 * Feature: opensearch-notebook-ui
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { notebookArb } from './generators/notebook.generator';
import { apiTrackerStateArb } from './generators/tracking.generator';
import {
  exportNotebook,
  importNotebook,
  validateNotebookJson,
  isValidationResult,
  EXPORT_FORMAT_VERSION,
} from '../../services/notebookIO';

describe('Notebook Import/Export Property Tests', () => {
  /**
   * Property 17: Notebook Export/Import Round-Trip
   * For any valid notebook with cells and tracked API usage, exporting to JSON
   * and then importing should produce an equivalent notebook with identical
   * cells, content, and tracking data.
   * **Validates: Requirements 8.3, 8.4**
   */
  it('Property 17: Notebook Export/Import Round-Trip', () => {
    fc.assert(
      fc.property(notebookArb, apiTrackerStateArb, (notebook, tracking) => {
        // Export the notebook
        const exported = exportNotebook(notebook, tracking);

        // Import the notebook
        const imported = importNotebook(exported);

        // Should not be a validation error
        expect(isValidationResult(imported)).toBe(false);

        if (!isValidationResult(imported)) {
          // Verify notebook is equivalent
          expect(imported.notebook).toEqual(notebook);

          // Verify tracking is equivalent
          expect(imported.tracking).toEqual(tracking);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18: Notebook Import Validation
   * For any malformed or invalid notebook JSON (missing required fields, wrong types,
   * invalid structure), the import function should reject the input and return a
   * descriptive error rather than producing a corrupted notebook state.
   * **Validates: Requirements 8.5**
   */
  it('Property 18: Notebook Import Validation - Invalid JSON rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Completely invalid JSON strings
          fc.string().filter((s) => {
            try {
              JSON.parse(s);
              return false;
            } catch {
              return true;
            }
          }),
          // Valid JSON but wrong structure (arrays, primitives)
          fc.constant('[]'),
          fc.constant('null'),
          fc.constant('123'),
          fc.constant('"string"'),
          fc.constant('true'),
          // Missing required fields
          fc.constant('{}'),
          fc.constant('{"version": "1.0.0"}'),
          fc.constant('{"version": "1.0.0", "exportedAt": 123}'),
          // Wrong types for fields
          fc.constant('{"version": 123, "exportedAt": 123, "notebook": {}, "tracking": {}}'),
          fc.constant('{"version": "1.0.0", "exportedAt": "not-a-number", "notebook": {}, "tracking": {}}'),
          // Invalid notebook structure
          fc.constant('{"version": "1.0.0", "exportedAt": 123, "notebook": "not-an-object", "tracking": {}}'),
          fc.constant('{"version": "1.0.0", "exportedAt": 123, "notebook": {"id": 123}, "tracking": {}}'),
          // Invalid tracking structure
          fc.constant('{"version": "1.0.0", "exportedAt": 123, "notebook": {"id": "1", "name": "test", "cells": [], "createdAt": 1, "updatedAt": 1, "connectionId": null}, "tracking": "not-an-object"}'),
          fc.constant('{"version": "1.0.0", "exportedAt": 123, "notebook": {"id": "1", "name": "test", "cells": [], "createdAt": 1, "updatedAt": 1, "connectionId": null}, "tracking": {"operations": "not-array"}}')
        ),
        (invalidJson) => {
          const result = importNotebook(invalidJson);

          // Should be a validation result with errors
          expect(isValidationResult(result)).toBe(true);

          if (isValidationResult(result)) {
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: validateNotebookJson returns descriptive errors
   */
  it('Property 18: validateNotebookJson returns descriptive errors for invalid input', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate objects with potentially missing or wrong-typed fields
          version: fc.oneof(fc.constant(undefined), fc.integer(), fc.string()),
          exportedAt: fc.oneof(fc.constant(undefined), fc.string(), fc.integer()),
          notebook: fc.oneof(
            fc.constant(undefined),
            fc.string(),
            fc.array(fc.anything()),
            fc.record({
              id: fc.oneof(fc.constant(undefined), fc.integer(), fc.string()),
              name: fc.oneof(fc.constant(undefined), fc.integer(), fc.string()),
              cells: fc.oneof(fc.constant(undefined), fc.string(), fc.array(fc.anything())),
              createdAt: fc.oneof(fc.constant(undefined), fc.string(), fc.integer()),
              updatedAt: fc.oneof(fc.constant(undefined), fc.string(), fc.integer()),
              connectionId: fc.oneof(fc.constant(null), fc.string(), fc.integer()),
            })
          ),
          tracking: fc.oneof(
            fc.constant(undefined),
            fc.string(),
            fc.record({
              operations: fc.oneof(fc.constant(undefined), fc.string(), fc.array(fc.anything())),
              permissions: fc.oneof(fc.constant(undefined), fc.string(), fc.array(fc.anything())),
            })
          ),
        }),
        (obj) => {
          const json = JSON.stringify(obj);
          const result = validateNotebookJson(json);

          // If the object is missing required fields or has wrong types,
          // validation should fail with descriptive errors
          const hasValidVersion = typeof obj.version === 'string';
          const hasValidExportedAt = typeof obj.exportedAt === 'number';
          const hasValidNotebook =
            typeof obj.notebook === 'object' &&
            obj.notebook !== null &&
            !Array.isArray(obj.notebook) &&
            typeof (obj.notebook as Record<string, unknown>).id === 'string' &&
            typeof (obj.notebook as Record<string, unknown>).name === 'string' &&
            Array.isArray((obj.notebook as Record<string, unknown>).cells) &&
            typeof (obj.notebook as Record<string, unknown>).createdAt === 'number' &&
            typeof (obj.notebook as Record<string, unknown>).updatedAt === 'number';
          const hasValidTracking =
            typeof obj.tracking === 'object' &&
            obj.tracking !== null &&
            !Array.isArray(obj.tracking) &&
            Array.isArray((obj.tracking as Record<string, unknown>).operations) &&
            Array.isArray((obj.tracking as Record<string, unknown>).permissions);

          if (!hasValidVersion || !hasValidExportedAt || !hasValidNotebook || !hasValidTracking) {
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            // Each error should be a descriptive string
            result.errors.forEach((error) => {
              expect(typeof error).toBe('string');
              expect(error.length).toBeGreaterThan(0);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test that exported JSON contains the correct version
   */
  it('Exported notebook contains correct format version', () => {
    fc.assert(
      fc.property(notebookArb, apiTrackerStateArb, (notebook, tracking) => {
        const exported = exportNotebook(notebook, tracking);
        const parsed = JSON.parse(exported);

        expect(parsed.version).toBe(EXPORT_FORMAT_VERSION);
        expect(typeof parsed.exportedAt).toBe('number');
      }),
      { numRuns: 100 }
    );
  });
});
