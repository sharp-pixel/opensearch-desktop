// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { DocumentFileBinding } from '../platform/contracts';
import type { ResultSource } from '../execution/provenance';
/**
 * Investigation types for Multi-Cluster Investigation feature
 * Requirements: 1.1, 1.2, 2.1, 3.1
 */

import type { PPLColumn } from './cell';
import type { ViewMode, ChartConfig } from './chart';

/**
 * Investigation document - a specialized notebook for multi-cluster analysis
 */
export interface Investigation {
  file?: DocumentFileBinding;
  id: string;
  name: string;
  cells: InvestigationCell[];
  clusterGroupId: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Cluster group - a named collection of connections for federated queries
 */
export interface ClusterGroup {
  id: string;
  name: string;
  connectionIds: string[];
}

/**
 * Investigation cell types - PPL and Markdown only
 */
export type InvestigationCellType = 'ppl' | 'markdown';

/**
 * Base cell interface for investigation cells
 */
export interface InvestigationBaseCell {
  id: string;
  type: InvestigationCellType;
  createdAt: number;
  updatedAt: number;
}

/**
 * PPL cell for investigation - executes across multiple clusters
 */
export interface InvestigationPPLCell extends InvestigationBaseCell {
  type: 'ppl';
  query: string;
  lastResult?: FederatedPPLResult;
  viewMode?: ViewMode;
  chartConfig?: ChartConfig;
}

/**
 * Markdown cell for investigation documentation
 */
export interface InvestigationMarkdownCell extends InvestigationBaseCell {
  type: 'markdown';
  content: string;
}

/**
 * Union type for all investigation cell types
 */
export type InvestigationCell = InvestigationPPLCell | InvestigationMarkdownCell;

/**
 * Result from a single cluster's PPL execution
 */
export interface ClusterPPLResult {
  clusterId: string;
  clusterName: string;
  success: boolean;
  statusCode: number;
  schema: PPLColumn[];
  datarows: unknown[][];
  total: number;
  duration: number;
  error?: string;
}

/**
 * Consolidated row with cluster identification
 */
export interface ConsolidatedRow {
  _cluster: string;
  data: unknown[];
}

/**
 * Federated PPL result - consolidated from all clusters
 */
export interface FederatedPPLResult {
  source?: ResultSource;
  success: boolean;
  clusterResults: ClusterPPLResult[];
  consolidatedSchema: PPLColumn[];
  consolidatedRows: ConsolidatedRow[];
  totalRows: number;
  successfulClusters: number;
  failedClusters: number;
  totalDuration: number;
  executedAt: number;
}

/**
 * Investigation metadata for listing
 */
export interface InvestigationMetadata {
  id: string;
  name: string;
  clusterGroupId: string;
  clusterGroupName?: string;
  cellCount: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Cluster status during execution
 */
export type ClusterExecutionStatus = 'idle' | 'executing' | 'success' | 'error';

export interface ClusterStatus {
  connectionId: string;
  connectionName: string;
  status: ClusterExecutionStatus;
  lastError?: string;
  lastDuration?: number;
}
