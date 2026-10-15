// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Tracking generators for property-based testing
 * Used for Property 11: Tracking Persistence Round-Trip
 */

import * as fc from 'fast-check';
import type {
  TrackedOperation,
  CategorizedPermission,
  ApiTrackerState,
} from '../../../types/tracking';
import { httpMethodArb, endpointArb } from './notebook.generator';

/**
 * Generator for index patterns
 */
export const indexPatternArb: fc.Arbitrary<string> = fc.string({
  unit: fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_', '*'),
  minLength: 1,
  maxLength: 50,
});

/**
 * Generator for TrackedOperation
 */
export const trackedOperationArb: fc.Arbitrary<TrackedOperation> = fc.record({
  method: httpMethodArb,
  endpoint: endpointArb,
  indexPatterns: fc.array(indexPatternArb, { minLength: 0, maxLength: 5 }),
  timestamp: fc.nat({ max: 1e12 }),
  cellId: fc.uuid(),
});

/**
 * Generator for permission type
 */
export const permissionTypeArb: fc.Arbitrary<'cluster' | 'index'> = fc.constantFrom('cluster', 'index');

/**
 * Generator for permission string
 */
export const permissionStringArb: fc.Arbitrary<string> = fc.string({
  unit: fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', ':', '/', '_'),
  minLength: 1,
  maxLength: 50,
});

/**
 * Generator for CategorizedPermission
 */
export const categorizedPermissionArb: fc.Arbitrary<CategorizedPermission> = fc.oneof(
  fc.record({
    type: fc.constant('cluster' as const),
    permission: permissionStringArb,
  }),
  fc.record({
    type: fc.constant('index' as const),
    permission: permissionStringArb,
    indexPatterns: fc.array(indexPatternArb, { minLength: 1, maxLength: 5 }),
  })
);

/**
 * Generator for ApiTrackerState
 */
export const apiTrackerStateArb: fc.Arbitrary<ApiTrackerState> = fc.record({
  operations: fc.array(trackedOperationArb, { minLength: 0, maxLength: 20 }),
  permissions: fc.array(categorizedPermissionArb, { minLength: 0, maxLength: 20 }),
});
