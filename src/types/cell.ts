// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { ResultSource } from '../execution/provenance';
/**
 * Cell types for OpenSearch Notebook
 * Requirements: 1.1, 2.6, PPL 1.2, 1.3
 */

export type CellType = 'query' | 'markdown' | 'ppl' | 'grpc';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'PATCH';

export interface QueryResult {
  source?: ResultSource;
  success: boolean;
  statusCode: number;
  body: unknown;
  duration: number;
  executedAt: number;
}

export interface BaseCell {
  id: string;
  type: CellType;
  createdAt: number;
  updatedAt: number;
}

export interface QueryCell extends BaseCell {
  type: 'query';
  method: HttpMethod;
  endpoint: string;
  body: string;
  lastResult?: QueryResult;
}

export interface MarkdownCell extends BaseCell {
  type: 'markdown';
  content: string;
}

/**
 * PPL column schema from query response
 */
export interface PPLColumn {
  name: string;
  type: string;
}

/**
 * PPL query execution result
 */
export interface PPLResult {
  source?: ResultSource;
  success: boolean;
  statusCode: number;
  schema: PPLColumn[];
  datarows: unknown[][];
  total: number;
  size: number;
  duration: number;
  executedAt: number;
  error?: string;
}

/**
 * PPL cell for Piped Processing Language queries
 */
export interface PPLCell extends BaseCell {
  type: 'ppl';
  query: string;
  lastResult?: PPLResult;
}

export type GrpcMethod = 'Search' | 'Bulk';

export interface GrpcResult {
  source?: ResultSource;
  success: boolean;
  grpcStatus: number | null;
  body: unknown;
  duration: number;
  executedAt: number;
}

export interface GrpcCell extends BaseCell {
  type: 'grpc';
  method: GrpcMethod;
  body: string;
  lastResult?: GrpcResult;
}

export type Cell = QueryCell | MarkdownCell | PPLCell | GrpcCell;
