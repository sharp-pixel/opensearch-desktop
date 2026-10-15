// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Notebook generators for property-based testing
 * Used for Property 4: Notebook Persistence Round-Trip
 */

import * as fc from 'fast-check';
import type { Cell, QueryCell, MarkdownCell, PPLCell, GrpcCell, HttpMethod } from '../../../types/cell';
import type { Notebook } from '../../../types/notebook';

/**
 * Generator for HTTP methods
 */
export const httpMethodArb: fc.Arbitrary<HttpMethod> = fc.constantFrom(
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'HEAD',
  'PATCH'
);

/**
 * Generator for valid endpoint strings
 */
export const endpointArb: fc.Arbitrary<string> = fc.string({
  unit: fc.constantFrom('/', '_', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '*'),
  minLength: 1,
  maxLength: 100,
}).map((s: string) => '/' + s);

/**
 * Generator for JSON body strings
 */
export const jsonBodyArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant('{}'),
  fc.constant(''),
  fc.json()
);

/**
 * Generator for PPL query strings
 */
export const pplQueryArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.constant('source=logs'),
  fc.constant('source=logs | stats count()'),
  fc.constant('source=logs | where status > 400'),
  fc.string({ minLength: 0, maxLength: 500 })
);

/**
 * Generator for QueryCell
 */
export const queryCellArb: fc.Arbitrary<QueryCell> = fc.record({
  id: fc.uuid(),
  type: fc.constant('query' as const),
  method: httpMethodArb,
  endpoint: endpointArb,
  body: jsonBodyArb,
  createdAt: fc.nat({ max: 1e12 }),
  updatedAt: fc.nat({ max: 1e12 }),
});

/**
 * Generator for MarkdownCell
 */
export const markdownCellArb: fc.Arbitrary<MarkdownCell> = fc.record({
  id: fc.uuid(),
  type: fc.constant('markdown' as const),
  content: fc.string({ minLength: 0, maxLength: 1000 }),
  createdAt: fc.nat({ max: 1e12 }),
  updatedAt: fc.nat({ max: 1e12 }),
});

/**
 * Generator for PPLCell
 */
export const pplCellArb: fc.Arbitrary<PPLCell> = fc.record({
  id: fc.uuid(),
  type: fc.constant('ppl' as const),
  query: pplQueryArb,
  createdAt: fc.nat({ max: 1e12 }),
  updatedAt: fc.nat({ max: 1e12 }),
});

/**
 * Generator for Cell (QueryCell, MarkdownCell, or PPLCell)
 */
export const grpcCellArb: fc.Arbitrary<GrpcCell> = fc.record({
  id: fc.uuid(), type: fc.constant('grpc' as const), method: fc.constantFrom('Search' as const, 'Bulk' as const),
  body: jsonBodyArb, createdAt: fc.nat({ max: 1e12 }), updatedAt: fc.nat({ max: 1e12 }),
});

export const cellArb: fc.Arbitrary<Cell> = fc.oneof(queryCellArb, markdownCellArb, pplCellArb, grpcCellArb);

/**
 * Generator for Notebook
 */
export const notebookArb: fc.Arbitrary<Notebook> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  cells: fc.array(cellArb, { minLength: 0, maxLength: 20 }),
  createdAt: fc.nat({ max: 1e12 }),
  updatedAt: fc.nat({ max: 1e12 }),
  connectionId: fc.option(fc.uuid(), { nil: null }),
});
