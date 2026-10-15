// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Profiling types for OpenSearch query profiling visualization
 */

export interface ProfileBreakdown {
  operation: string;
  timeMs: number;
}

export interface ProfileQuery {
  type: string;
  description: string;
  timeMs: number;
  breakdown: ProfileBreakdown[];
  children: ProfileQuery[];
}

export interface ProfileCollector {
  name: string;
  reason: string;
  timeMs: number;
  children: ProfileCollector[];
}

export interface ProfileSearch {
  queries: ProfileQuery[];
  collectors: ProfileCollector[];
  rewriteTimeMs: number;
}

export interface ProfileAggregation {
  type: string;
  description: string;
  timeMs: number;
  breakdown: ProfileBreakdown[];
  children: ProfileAggregation[];
}

export interface ProfileShard {
  id: string;
  index: string;
  searches: ProfileSearch[];
  aggregations: ProfileAggregation[];
}

export interface PhaseTiming {
  query: number;
  fetch: number;
  dfsQuery: number;
  dfsPreQuery: number;
  expand: number;
  canMatch: number;
}

export interface ProfileData {
  shards: ProfileShard[];
  phaseTook?: PhaseTiming;
  totalTimeMs: number;
}

export interface ProfileComponent {
  shard: string;
  type: 'Query' | 'Collector' | 'Aggregation';
  name: string;
  timeMs: number;
}
