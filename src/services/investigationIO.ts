// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { Investigation, InvestigationCell, ClusterGroup } from '../types/investigation';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const schema = (value: unknown) => Array.isArray(value) && value.every(column => object(column) && typeof column.name === 'string' && typeof column.type === 'string');
function validResult(value: unknown): boolean {
  return object(value) && typeof value.success === 'boolean' && schema(value.consolidatedSchema)
    && Array.isArray(value.consolidatedRows) && value.consolidatedRows.every(row => object(row) && typeof row._cluster === 'string' && Array.isArray(row.data))
    && ['totalRows', 'successfulClusters', 'failedClusters', 'totalDuration', 'executedAt'].every(key => Number.isFinite(value[key]))
    && Array.isArray(value.clusterResults) && value.clusterResults.every(result => object(result)
      && typeof result.clusterId === 'string' && typeof result.clusterName === 'string' && typeof result.success === 'boolean'
      && ['statusCode', 'total', 'duration'].every(key => Number.isFinite(result[key])) && schema(result.schema)
      && Array.isArray(result.datarows) && result.datarows.every(Array.isArray)
      && (result.error === undefined || typeof result.error === 'string'))
    && (value.source === undefined || (object(value.source) && ['runId', 'input', 'connection'].every(key => typeof (value.source as Record<string, unknown>)[key] === 'string')));
}
function validChart(value: unknown): boolean {
  if (!object(value) || (value.title !== undefined && typeof value.title !== 'string')) return false;
  const strings = (...keys: string[]) => keys.every(key => typeof value[key] === 'string');
  const booleans = (...keys: string[]) => keys.every(key => typeof value[key] === 'boolean');
  if (value.type === 'pie') return strings('dimensionColumn', 'measureColumn') && Number.isFinite(value.maxSlices) && booleans('showLegend', 'showPercentages');
  if (value.type === 'bar') return strings('xColumn', 'yColumn') && ['vertical', 'horizontal'].includes(String(value.orientation)) && booleans('groupByCluster', 'stacked', 'showLegend');
  if (value.type === 'histogram') return strings('timeColumn') && (value.measureColumn === undefined || typeof value.measureColumn === 'string')
    && ['auto', 'minute', 'hour', 'day', 'week', 'month'].includes(String(value.interval)) && booleans('groupByCluster', 'stacked', 'showLegend');
  return value.type === 'map' && ['geoColumn', 'latColumn', 'lonColumn', 'measureColumn'].every(key => value[key] === undefined || typeof value[key] === 'string')
    && booleans('colorByCluster') && ['fixed', 'scaled'].includes(String(value.markerSize));
}
export function isInvestigationDocument(value: unknown): value is Investigation {
  return object(value) && typeof value.id === 'string' && !!value.id && typeof value.name === 'string'
    && typeof value.clusterGroupId === 'string' && Number.isFinite(value.createdAt) && Number.isFinite(value.updatedAt)
    && Array.isArray(value.cells) && value.cells.every(cell => object(cell) && typeof cell.id === 'string' && !!cell.id
      && Number.isFinite(cell.createdAt) && Number.isFinite(cell.updatedAt)
      && (cell.type === 'ppl' ? typeof cell.query === 'string'
        && (cell.lastResult === undefined || validResult(cell.lastResult))
        && (cell.viewMode === undefined || cell.viewMode === 'table' || cell.viewMode === 'chart')
        && (cell.chartConfig === undefined || validChart(cell.chartConfig))
        : cell.type === 'markdown' && typeof cell.content === 'string'))
    && new Set(value.cells.map(cell => cell.id)).size === value.cells.length;
}
function portableDocument(document: Investigation): Investigation {
  const { id, name, createdAt, updatedAt, clusterGroupId } = document;
  return { id, name, createdAt, updatedAt, clusterGroupId, cells: document.cells.map(cell => {
    const base = { id: cell.id, type: cell.type, createdAt: cell.createdAt, updatedAt: cell.updatedAt };
    return cell.type === 'markdown' ? { ...base, type: 'markdown', content: cell.content } : {
      ...base, type: 'ppl', query: cell.query,
      ...(cell.lastResult !== undefined ? { lastResult: cell.lastResult } : {}),
      ...(cell.viewMode !== undefined ? { viewMode: cell.viewMode } : {}),
      ...(cell.chartConfig !== undefined ? { chartConfig: cell.chartConfig } : {}),
    } as InvestigationCell;
  }) };
}
export function exportInvestigation(document: Investigation, group: ClusterGroup | null): string {
  return JSON.stringify({ version: '1.0.0', type: 'investigation', investigation: portableDocument(document),
    clusterGroup: group ? { id: group.id, name: group.name, connectionIds: group.connectionIds } : null }, null, 2);
}
export function importInvestigation(text: string): { investigation: Investigation; clusterGroup: ClusterGroup | null } {
  const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!object(value) || value.type !== 'investigation' || value.version !== '1.0.0' || !isInvestigationDocument(value.investigation)) {
    throw new Error('Choose an Investigation JSON file saved by the workbench.');
  }
  const group = value.clusterGroup;
  if (group !== null && (!object(group) || typeof group.id !== 'string' || typeof group.name !== 'string'
    || !Array.isArray(group.connectionIds) || group.connectionIds.some(id => typeof id !== 'string'))) throw new Error('Invalid investigation cluster references.');
  // Construct trusted fields instead of accepting internal file bindings or extra connection properties.
  return { investigation: portableDocument(value.investigation), clusterGroup: group === null ? null : {
    id: group.id as string, name: group.name as string, connectionIds: [...new Set(group.connectionIds as string[])],
  } };
}
