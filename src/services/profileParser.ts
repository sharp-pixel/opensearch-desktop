// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Profile Parser Service
 * Parses OpenSearch profile response data into structured format for visualization
 */

import type {
  ProfileData,
  ProfileShard,
  ProfileSearch,
  ProfileQuery,
  ProfileCollector,
  ProfileAggregation,
  ProfileBreakdown,
  PhaseTiming,
  ProfileComponent,
} from '../types/profiling';

/**
 * Parse breakdown data from profile response
 */
function parseBreakdown(breakdown: Record<string, number> | undefined): ProfileBreakdown[] {
  if (!breakdown) return [];
  
  return Object.entries(breakdown)
    .filter(([key]) => !key.endsWith('_count'))
    .map(([operation, timeNs]) => ({
      operation,
      timeMs: timeNs / 1_000_000,
    }))
    .sort((a, b) => b.timeMs - a.timeMs);
}

/**
 * Parse query data recursively
 */
function parseQuery(queryData: Record<string, unknown>): ProfileQuery {
  const timeNs = (queryData.time_in_nanos as number) || 0;
  const children = queryData.children as Record<string, unknown>[] | undefined;
  
  return {
    type: (queryData.type as string) || 'unknown',
    description: (queryData.description as string) || '',
    timeMs: timeNs / 1_000_000,
    breakdown: parseBreakdown(queryData.breakdown as Record<string, number>),
    children: children ? children.map(parseQuery) : [],
  };
}

/**
 * Parse collector data recursively
 */
function parseCollector(collectorData: Record<string, unknown>): ProfileCollector {
  const timeNs = (collectorData.time_in_nanos as number) || 0;
  const children = collectorData.children as Record<string, unknown>[] | undefined;
  
  return {
    name: (collectorData.name as string) || 'unknown',
    reason: (collectorData.reason as string) || '',
    timeMs: timeNs / 1_000_000,
    children: children ? children.map(parseCollector) : [],
  };
}

/**
 * Parse aggregation data recursively
 */
function parseAggregation(aggData: Record<string, unknown>): ProfileAggregation {
  const timeNs = (aggData.time_in_nanos as number) || 0;
  const children = aggData.children as Record<string, unknown>[] | undefined;
  
  return {
    type: (aggData.type as string) || 'unknown',
    description: (aggData.description as string) || '',
    timeMs: timeNs / 1_000_000,
    breakdown: parseBreakdown(aggData.breakdown as Record<string, number>),
    children: children ? children.map(parseAggregation) : [],
  };
}

/**
 * Parse search data from profile response
 */
function parseSearch(searchData: Record<string, unknown>): ProfileSearch {
  const queries = searchData.query as Record<string, unknown>[] | undefined;
  const collectors = searchData.collector as Record<string, unknown>[] | undefined;
  const rewriteTimeNs = (searchData.rewrite_time as number) || 0;
  
  return {
    queries: queries ? queries.map(parseQuery) : [],
    collectors: collectors ? collectors.map(parseCollector) : [],
    rewriteTimeMs: rewriteTimeNs / 1_000_000,
  };
}

/**
 * Parse shard data from profile response
 */
function parseShard(shardData: Record<string, unknown>, index: number): ProfileShard {
  const shardId = (shardData.id as string) || `shard_${index}`;
  const searches = shardData.searches as Record<string, unknown>[] | undefined;
  const aggregations = shardData.aggregations as Record<string, unknown>[] | undefined;
  
  // Extract index name from shard ID (format: "[index_name][shard_num]")
  let indexName = 'unknown';
  const match = shardId.match(/^\[([^\]]+)\]/);
  if (match && match[1]) {
    indexName = match[1];
  }
  
  return {
    id: shardId,
    index: indexName,
    searches: searches ? searches.map(parseSearch) : [],
    aggregations: aggregations ? aggregations.map(parseAggregation) : [],
  };
}

/**
 * Parse phase timing from response
 */
function parsePhaseTiming(phaseTook: Record<string, number> | undefined): PhaseTiming | undefined {
  if (!phaseTook) return undefined;
  
  return {
    query: phaseTook.query || 0,
    fetch: phaseTook.fetch || 0,
    dfsQuery: phaseTook.dfs_query || 0,
    dfsPreQuery: phaseTook.dfs_pre_query || 0,
    expand: phaseTook.expand || 0,
    canMatch: phaseTook.can_match || 0,
  };
}

/**
 * Parse OpenSearch profile response into structured data
 */
export function parseProfileResponse(response: Record<string, unknown>): ProfileData | null {
  // Check for phase_took first - this is always present when profiling is enabled
  const phaseTook = parsePhaseTiming(response.phase_took as Record<string, number>);
  
  // Profile shard data is under response.profile.shards (only present when there are hits)
  const profile = response.profile as Record<string, unknown> | undefined;
  const shards = profile?.shards as Record<string, unknown>[] | undefined;
  
  // If we have phase_took, we have profile data (even without detailed shards)
  if (phaseTook) {
    const parsedShards = shards ? shards.map(parseShard) : [];
    
    // Calculate total time from shards, or use phase timing as fallback
    let totalTimeMs = parsedShards.reduce((total, shard) => {
      const shardTime = shard.searches.reduce((searchTotal, search) => {
        return searchTotal + search.queries.reduce((queryTotal, query) => queryTotal + query.timeMs, 0);
      }, 0);
      return total + shardTime;
    }, 0);
    
    // If no shard timing, use phase timing
    if (totalTimeMs === 0) {
      totalTimeMs = (phaseTook.query || 0) + (phaseTook.fetch || 0);
    }
    
    return {
      shards: parsedShards,
      phaseTook,
      totalTimeMs,
    };
  }
  
  // No profile data at all
  if (!shards || shards.length === 0) return null;
  
  // We have shards but no phase_took (unusual but handle it)
  const parsedShards = shards.map(parseShard);
  const totalTimeMs = parsedShards.reduce((total, shard) => {
    const shardTime = shard.searches.reduce((searchTotal, search) => {
      return searchTotal + search.queries.reduce((queryTotal, query) => queryTotal + query.timeMs, 0);
    }, 0);
    return total + shardTime;
  }, 0);
  
  return {
    shards: parsedShards,
    phaseTook: undefined,
    totalTimeMs,
  };
}

/**
 * Get all components sorted by time (slowest first)
 */
export function getAllComponents(profileData: ProfileData): ProfileComponent[] {
  const components: ProfileComponent[] = [];
  
  for (const shard of profileData.shards) {
    const shardName = `${shard.index}[${shard.id}]`;
    
    for (const search of shard.searches) {
      for (const query of search.queries) {
        components.push({
          shard: shardName,
          type: 'Query',
          name: query.type,
          timeMs: query.timeMs,
        });
      }
      
      for (const collector of search.collectors) {
        components.push({
          shard: shardName,
          type: 'Collector',
          name: collector.name,
          timeMs: collector.timeMs,
        });
      }
    }
    
    for (const agg of shard.aggregations) {
      components.push({
        shard: shardName,
        type: 'Aggregation',
        name: agg.type,
        timeMs: agg.timeMs,
      });
    }
  }
  
  return components.sort((a, b) => b.timeMs - a.timeMs);
}

/**
 * Get shard timing summary
 */
export function getShardTimings(profileData: ProfileData): Array<{ name: string; timeMs: number }> {
  return profileData.shards
    .map((shard) => {
      const timeMs = shard.searches.reduce((total, search) => {
        return total + search.queries.reduce((queryTotal, query) => queryTotal + query.timeMs, 0);
      }, 0);
      return {
        name: `${shard.index}[${shard.id}]`,
        timeMs,
      };
    })
    .sort((a, b) => b.timeMs - a.timeMs);
}

/**
 * Calculate self time for a query (total time minus children time)
 */
export function calculateSelfTime(query: ProfileQuery): number {
  const childrenTime = query.children.reduce((total, child) => total + child.timeMs, 0);
  return query.timeMs - childrenTime;
}

/**
 * Get color based on percentage of total time
 */
export function getColorForPercentage(percentage: number): string {
  if (percentage >= 80) return '#ff6b6b'; // Red
  if (percentage >= 60) return '#ffa726'; // Orange
  if (percentage >= 40) return '#ffeb3b'; // Yellow
  if (percentage >= 20) return '#66bb6a'; // Light Green
  return '#e0e0e0'; // Gray
}
