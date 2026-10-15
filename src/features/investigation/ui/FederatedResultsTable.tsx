// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
/**
 * Federated Results Table Component
 * Displays consolidated results from multi-cluster PPL execution
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7
 */

import React, { useState, useMemo } from 'react';
import type { FederatedPPLResult } from '../../../types/investigation';
import type { ViewMode, ChartConfig } from '../../../types/chart';
import { useTheme } from '../../../context/ThemeContext';
import { ViewModeToggle, ChartPanel } from './Charts';
import { analyzeSchema } from '../../../services/schemaAnalyzer';

export interface FederatedResultsTableProps {
  result: FederatedPPLResult;
  viewMode?: ViewMode;
  chartConfig?: ChartConfig;
  onViewModeChange?: (mode: ViewMode) => void;
  onChartConfigChange?: (config: ChartConfig) => void;
}

// Cluster colors for visual distinction
const CLUSTER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

/**
 * Federated Results Table - displays multi-cluster query results
 */
export function FederatedResultsTable({
  result,
  viewMode: externalViewMode,
  chartConfig: externalChartConfig,
  onViewModeChange,
  onChartConfigChange,
}: FederatedResultsTableProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('table');
  const [clusterFilter, setClusterFilter] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Use external or internal view mode
  const viewMode = externalViewMode ?? internalViewMode;
  const handleViewModeChange = (mode: ViewMode) => {
    setInternalViewMode(mode);
    onViewModeChange?.(mode);
  };

  // Analyze schema for chart compatibility
  const schemaAnalysis = useMemo(() => {
    return analyzeSchema(result.consolidatedSchema, result.consolidatedRows);
  }, [result.consolidatedSchema, result.consolidatedRows]);

  // Check if chart view is available
  const chartEnabled = schemaAnalysis.compatibleChartTypes.length > 0;
  const chartDisabledReason = !chartEnabled 
    ? 'No compatible chart types for this data. Requires categorical + numeric columns, time columns, or geo columns.'
    : undefined;

  // Build cluster color map
  const clusterColorMap = useMemo(() => {
    const map = new Map<string, string>();
    result.clusterResults.forEach((cr, index) => {
      const colorIndex = index % CLUSTER_COLORS.length;
      const color = CLUSTER_COLORS[colorIndex];
      if (color) {
        map.set(cr.clusterName, color);
      }
    });
    return map;
  }, [result.clusterResults]);

  // Filter and sort rows
  const displayRows = useMemo(() => {
    let rows = [...result.consolidatedRows];
    
    // Apply cluster filter
    if (clusterFilter) {
      rows = rows.filter((row) => row._cluster === clusterFilter);
    }
    
    // Apply sort
    if (sortColumn !== null) {
      rows.sort((a, b) => {
        const aVal = a.data[sortColumn];
        const bVal = b.data[sortColumn];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        let cmp: number;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal).localeCompare(String(bVal));
        }
        
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }
    
    return rows;
  }, [result.consolidatedRows, clusterFilter, sortColumn, sortDirection]);

  // Calculate per-cluster stats
  const clusterStats = useMemo(() => {
    return result.clusterResults.map((cr) => ({
      name: cr.clusterName,
      rows: cr.total,
      duration: cr.duration,
      success: cr.success,
      error: cr.error,
      color: clusterColorMap.get(cr.clusterName) || CLUSTER_COLORS[0],
    }));
  }, [result.clusterResults, clusterColorMap]);

  const handleSort = (columnIndex: number) => {
    if (sortColumn === columnIndex) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnIndex);
      setSortDirection('asc');
    }
  };

  const schema = result.consolidatedSchema;

  return (
    <div>
      {/* Header with View Toggle */}
      <div style={{
        padding: '12px',
        backgroundColor: theme.background,
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1 }}>
          {/* Cluster Summary */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '8px',
          }}>
            {clusterStats.map((stat) => (
              <div
                key={stat.name}
                onClick={() => setClusterFilter(clusterFilter === stat.name ? null : stat.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  backgroundColor: clusterFilter === stat.name ? stat.color + '20' : theme.surface,
                  border: `1px solid ${clusterFilter === stat.name ? stat.color : theme.border}`,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: stat.success ? stat.color : theme.error,
                }} />
                <span style={{ fontWeight: 500, color: theme.text }}>{stat.name}</span>
                {stat.success ? (
                  <>
                    <span style={{ color: theme.textMuted }}>{stat.rows}{' '}{t('rows')}</span>
                    <span style={{ color: theme.textMuted }}>({stat.duration}{t('ms)')}</span>
                  </>
                ) : (
                  <span style={{ color: theme.error }}>{t('Failed')}</span>
                )}
              </div>
            ))}
          </div>
          
          {/* Summary stats */}
          <div style={{
            display: 'flex',
            gap: '16px',
            fontSize: '12px',
            color: theme.textMuted,
          }}>
            <span>{t('Total:')}{' '}<strong style={{ color: theme.text }}>{result.totalRows}</strong>{' '}{t('rows')}</span>
            <span>{t('Clusters:')}{' '}<strong style={{ color: theme.success }}>{result.successfulClusters}</strong>{' '}{t('success')}{result.failedClusters > 0 && (
                <>, <strong style={{ color: theme.error }}>{result.failedClusters}</strong>{' '}{t('failed')}</>
              )}
            </span>
            <span>{t('Duration:')}{' '}<strong style={{ color: theme.text }}>{result.totalDuration}</strong>ms
            </span>
          </div>
        </div>
        
        {/* View Mode Toggle */}
        <ViewModeToggle
          mode={viewMode}
          onModeChange={handleViewModeChange}
          chartEnabled={chartEnabled}
          disabledReason={chartDisabledReason}
        />
      </div>

      {/* Failed cluster errors */}
      {result.failedClusters > 0 && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: theme.errorLight,
          borderBottom: `1px solid ${theme.error}`,
        }}>
          {clusterStats.filter((s) => !s.success).map((stat) => (
            <div key={stat.name} style={{
              fontSize: '12px',
              color: theme.error,
              marginBottom: '4px',
            }}>
              <strong>{stat.name}:</strong> {stat.error || t('Unknown error')}
            </div>
          ))}
        </div>
      )}

      {/* Chart View */}
      {viewMode === 'chart' && chartEnabled && (
        <div style={{ padding: '12px' }}>
          <ChartPanel
            rows={clusterFilter 
              ? result.consolidatedRows.filter(r => r._cluster === clusterFilter)
              : result.consolidatedRows
            }
            schema={schema}
            schemaAnalysis={schemaAnalysis}
            initialConfig={externalChartConfig}
            onConfigChange={onChartConfigChange}
          />
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <>
          {displayRows.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
              }}>
                <thead>
                  <tr style={{ backgroundColor: theme.background }}>
                    <th style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: theme.text,
                      borderBottom: `1px solid ${theme.border}`,
                      whiteSpace: 'nowrap',
                    }}>
                      _cluster
                    </th>
                    {schema.map((col, index) => (
                      <th
                        key={col.name}
                        onClick={() => handleSort(index)}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: theme.text,
                          borderBottom: `1px solid ${theme.border}`,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.name}
                        {sortColumn === index && (
                          <span style={{ marginLeft: '4px' }}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.slice(0, 100).map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      style={{
                        backgroundColor: rowIndex % 2 === 0 ? theme.surface : theme.background,
                      }}
                    >
                      <td style={{
                        padding: '6px 12px',
                        borderBottom: `1px solid ${theme.border}`,
                        color: theme.text,
                      }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          <div style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: clusterColorMap.get(row._cluster) || CLUSTER_COLORS[0],
                          }} />
                          {row._cluster}
                        </span>
                      </td>
                      {row.data.map((value, colIndex) => (
                        <td
                          key={colIndex}
                          style={{
                            padding: '6px 12px',
                            borderBottom: `1px solid ${theme.border}`,
                            color: theme.text,
                            maxWidth: '300px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatValue(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {displayRows.length > 100 && (
                <div style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: theme.textMuted,
                  textAlign: 'center',
                  borderTop: `1px solid ${theme.border}`,
                }}>{t('Showing 100 of')}{' '}{displayRows.length}{' '}{t('rows')}</div>
              )}
            </div>
          ) : (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: theme.textMuted,
              fontSize: '13px',
            }}>{t('No results to display')}</div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Format a cell value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export default FederatedResultsTable;
