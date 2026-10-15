// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * API tracking interfaces for OpenSearch Notebook
 * Requirements: 5.1
 */

import type { HttpMethod } from './cell';

export interface TrackedOperation {
  transport?: 'grpc';
  method: HttpMethod;
  endpoint: string;
  indexPatterns: string[];
  timestamp: number;
  cellId: string;
}

export interface CategorizedPermission {
  type: 'cluster' | 'index';
  permission: string;
  indexPatterns?: string[];
}

export interface ApiTrackerState {
  operations: TrackedOperation[];
  permissions: CategorizedPermission[];
}
