// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Federated Executor Service
 * Executes PPL queries across multiple clusters in parallel
 * Requirements: 4.1, 4.2, 4.4, 7.1, 7.3
 */

import type {
  ClusterGroup,
  ClusterPPLResult,
  FederatedPPLResult,
  ClusterStatus,
} from '../types/investigation';
import type { ConnectionConfig } from '../types/connection';
import { mapConcurrent } from '../execution/concurrency';
import { executePPL } from './queryExecutor';
import { createLogger } from '../utils/logger';

const logger = createLogger('FederatedExecutor');

/**
 * Options for federated execution
 */
export interface FederatedExecuteOptions {
  concurrency?: number;
  signal?: AbortSignal;
  timeout?: number;           // Per-cluster timeout in ms (default: 30000)
  continueOnError?: boolean;  // Continue if some clusters fail (default: true)
  onClusterStatus?: (status: ClusterStatus) => void;  // Callback for status updates
}

const DEFAULT_OPTIONS: Required<Omit<FederatedExecuteOptions, 'onClusterStatus' | 'signal'>> & Pick<FederatedExecuteOptions, 'signal'> = {
  concurrency: 4,
  timeout: 30000,
  continueOnError: true,
};

/**
 * Execute a PPL query across all clusters in a group
 */
export async function executeFederated(
  query: string,
  clusterGroup: ClusterGroup,
  connections: ConnectionConfig[],
  options: FederatedExecuteOptions = {}
): Promise<FederatedPPLResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  // Get connections for the cluster group
  const targetConnections = connections.filter((c) =>
    clusterGroup.connectionIds.includes(c.id)
  );

  if (targetConnections.length === 0) {
    return createEmptyResult('No clusters selected');
  }

  logger.info(`Executing federated query across ${targetConnections.length} clusters`);

  const results = await mapConcurrent(targetConnections, opts.concurrency,
    connection => executeWithProgress(query, connection, opts), opts.signal);

  // Process results
  const clusterResults: ClusterPPLResult[] = [];
  let successfulClusters = 0;
  let failedClusters = 0;

  results.forEach((result, index) => {
    const connection = targetConnections[index];
    if (!connection) return;

    if (result.status === 'fulfilled') {
      clusterResults.push(result.value);
      if (result.value.success) {
        successfulClusters++;
      } else {
        failedClusters++;
      }
      

    } else {
      // Promise rejected (unexpected error)
      failedClusters++;
      const errorResult: ClusterPPLResult = {
        clusterId: connection.id,
        clusterName: connection.name,
        success: false,
        statusCode: 0,
        schema: [],
        datarows: [],
        total: 0,
        duration: Date.now() - startTime,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      };
      clusterResults.push(errorResult);
      

    }
  });

  // Consolidate results
  const consolidated = consolidateResults(clusterResults);

  return {
    success: successfulClusters > 0,
    clusterResults,
    consolidatedSchema: consolidated.schema,
    consolidatedRows: consolidated.rows,
    totalRows: consolidated.rows.length,
    successfulClusters,
    failedClusters,
    totalDuration: Date.now() - startTime,
    executedAt: Date.now(),
  };
}

async function executeWithProgress(query: string, connection: ConnectionConfig,
  options: FederatedExecuteOptions & { timeout: number; concurrency: number; continueOnError: boolean }): Promise<ClusterPPLResult> {
  options.onClusterStatus?.({ connectionId: connection.id, connectionName: connection.name, status: 'executing' });
  const result = await executeOnCluster(query, connection, options);
  options.onClusterStatus?.({ connectionId: connection.id, connectionName: connection.name,
    status: result.success ? 'success' : 'error', lastError: result.error, lastDuration: result.duration });
  return result;
}

/**
 * Execute PPL query on a single cluster
 */
async function executeOnCluster(
  query: string,
  connection: ConnectionConfig,
  options: Required<Omit<FederatedExecuteOptions, 'onClusterStatus' | 'signal'>> & Pick<FederatedExecuteOptions, 'signal'>
): Promise<ClusterPPLResult> {
  const startTime = Date.now();

  try {
    if (connection.credentialError) throw new Error(connection.credentialError);
    const result = await executePPL(connection, query, `federated-${connection.id}`, { timeout: options.timeout, signal: options.signal });

    return {
      clusterId: connection.id,
      clusterName: connection.name,
      success: result.success,
      statusCode: result.statusCode,
      schema: result.schema || [],
      datarows: result.datarows || [],
      total: result.total || 0,
      duration: result.duration || (Date.now() - startTime),
      error: result.error,
    };
  } catch (error) {
    return {
      clusterId: connection.id,
      clusterName: connection.name,
      success: false,
      statusCode: 0,
      schema: [],
      datarows: [],
      total: 0,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Consolidate results from multiple clusters
 * Basic implementation - merges rows with cluster tags
 */
function consolidateResults(clusterResults: ClusterPPLResult[]): {
  schema: { name: string; type: string }[];
  rows: { _cluster: string; data: unknown[] }[];
} {
  // Build a union by name; incompatible types must not be treated as numeric by charts.
  const columns = new Map<string, { name: string; type: string }>();
  for (const result of clusterResults) {
    if (!result.success) continue;
    for (const column of result.schema) {
      const existing = columns.get(column.name);
      if (!existing) columns.set(column.name, { ...column });
      else if (existing.type !== column.type) existing.type = 'unknown';
    }
  }
  const schema = [...columns.values()];

  // Merge all rows with cluster tags
  const rows: { _cluster: string; data: unknown[] }[] = [];

  for (const result of clusterResults) {
    if (!result.success) continue;
    const positions = new Map(result.schema.map((column, index) => [column.name, index]));

    for (const row of result.datarows) {
      rows.push({
        _cluster: result.clusterName,
        data: schema.map(column => {
          const position = positions.get(column.name);
          return position === undefined ? null : row[position] ?? null;
        }),
      });
    }
  }

  return { schema, rows };
}

/**
 * Create an empty result for error cases
 */
function createEmptyResult(_error: string): FederatedPPLResult {
  return {
    success: false,
    clusterResults: [],
    consolidatedSchema: [],
    consolidatedRows: [],
    totalRows: 0,
    successfulClusters: 0,
    failedClusters: 0,
    totalDuration: 0,
    executedAt: Date.now(),
  };
}

/**
 * Retry failed clusters from a previous execution
 */
export async function retryFailedClusters(
  query: string,
  previousResult: FederatedPPLResult,
  connections: ConnectionConfig[],
  options: FederatedExecuteOptions = {}
): Promise<FederatedPPLResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  // Get failed cluster IDs
  const failedClusterIds = previousResult.clusterResults
    .filter((r) => !r.success)
    .map((r) => r.clusterId);

  if (failedClusterIds.length === 0) {
    return previousResult;
  }

  // Get connections for failed clusters
  const targetConnections = connections.filter((c) =>
    failedClusterIds.includes(c.id)
  );

  logger.info(`Retrying ${targetConnections.length} failed clusters`);

  const retryResults = await mapConcurrent(targetConnections, opts.concurrency,
    connection => executeWithProgress(query, connection, opts), opts.signal);

  // Build new cluster results, replacing failed ones with retry results
  const newClusterResults = [...previousResult.clusterResults];
  let successfulClusters = previousResult.successfulClusters;
  let failedClusters = previousResult.failedClusters;

  retryResults.forEach((result, index) => {
    const connection = targetConnections[index];
    if (!connection) return;

    const existingIndex = newClusterResults.findIndex(
      (r) => r.clusterId === connection.id
    );

    if (result.status === 'fulfilled') {
      if (existingIndex >= 0) {
        const wasSuccess = newClusterResults[existingIndex]?.success;
        newClusterResults[existingIndex] = result.value;
        
        // Update counts
        if (result.value.success && !wasSuccess) {
          successfulClusters++;
          failedClusters--;
        }
      }
      

    }
  });

  // Re-consolidate results
  const consolidated = consolidateResults(newClusterResults);

  return {
    success: successfulClusters > 0,
    clusterResults: newClusterResults,
    consolidatedSchema: consolidated.schema,
    consolidatedRows: consolidated.rows,
    totalRows: consolidated.rows.length,
    successfulClusters,
    failedClusters,
    totalDuration: previousResult.totalDuration + (Date.now() - startTime),
    executedAt: Date.now(),
  };
}
