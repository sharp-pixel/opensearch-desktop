// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
/**
 * PPL Results Table Component
 * Displays PPL query results in a tabular format
 * Requirements: PPL 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import React, { useState, useMemo } from 'react';
import type { PPLColumn } from '../../../../types/cell';
import { useTheme } from '../../../../context/ThemeContext';

export interface PPLResultsTableProps {
  schema: PPLColumn[];
  datarows: unknown[][];
  total: number;
  maxRows?: number;
}

/**
 * Format a cell value for display
 */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  
  return String(value);
}

/**
 * Check if a value is a complex object that should be expandable
 */
function isComplexValue(value: unknown): boolean {
  return value !== null && typeof value === 'object';
}

/**
 * PPL Results Table Component
 */
export function PPLResultsTable({
  schema,
  datarows,
  total,
  maxRows = 100,
}: PPLResultsTableProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const [displayCount, setDisplayCount] = useState(maxRows);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  
  const displayedRows = useMemo(() => {
    return datarows.slice(0, displayCount);
  }, [datarows, displayCount]);
  
  const hasMoreRows = datarows.length > displayCount;
  
  const handleShowMore = () => {
    setDisplayCount(prev => Math.min(prev + 100, datarows.length));
  };
  
  const toggleCellExpand = (rowIndex: number, colIndex: number) => {
    const key = `${rowIndex}-${colIndex}`;
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  
  if (schema.length === 0) {
    return (
      <div style={{ padding: '16px', color: theme.textMuted, textAlign: 'center' }}>{t('No columns in result')}</div>
    );
  }
  
  if (datarows.length === 0) {
    return (
      <div style={{ padding: '16px', color: theme.textMuted, textAlign: 'center' }}>{t('No results found')}</div>
    );
  }
  
  return (
    <div>
      <div style={{
        overflowX: 'auto',
        border: `1px solid ${theme.border}`,
        borderRadius: '4px',
        backgroundColor: theme.surface,
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        }}>
          <thead>
            <tr>
              {schema.map((col, index) => (
                <th key={index} style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  backgroundColor: theme.backgroundSecondary,
                  borderBottom: `2px solid ${theme.border}`,
                  fontWeight: 600,
                  color: theme.text,
                  whiteSpace: 'nowrap',
                }}>
                  {col.name}
                  <span style={{
                    fontSize: '10px',
                    color: theme.textMuted,
                    fontWeight: 400,
                    marginLeft: '4px',
                  }}>({col.type})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                style={{ 
                  backgroundColor: rowIndex % 2 === 0 ? theme.surface : theme.backgroundSecondary,
                }}
              >
                {schema.map((_, colIndex) => {
                  const value = row[colIndex];
                  const cellKey = `${rowIndex}-${colIndex}`;
                  const isExpanded = expandedCells.has(cellKey);
                  const isComplex = isComplexValue(value);
                  
                  return (
                    <td 
                      key={colIndex} 
                      style={{
                        padding: '6px 12px',
                        borderBottom: `1px solid ${theme.borderLight}`,
                        color: theme.textSecondary,
                        maxWidth: isExpanded ? 'none' : '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                        cursor: isComplex ? 'pointer' : 'default',
                      }}
                      onClick={() => isComplex && toggleCellExpand(rowIndex, colIndex)}
                      title={isComplex && !isExpanded ? t('Click to expand') : undefined}
                    >
                      {formatCellValue(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{
        padding: '8px 12px',
        backgroundColor: theme.backgroundSecondary,
        borderTop: `1px solid ${theme.border}`,
        fontSize: '12px',
        color: theme.textMuted,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>{t('Showing')}{' '}{displayedRows.length}{' '}{t('of')}{' '}{total}{' '}{t('rows')}{datarows.length !== total && ` (${datarows.length} returned)`}
        </span>
        {hasMoreRows && (
          <button 
            style={{
              padding: '4px 12px',
              border: `1px solid ${theme.border}`,
              borderRadius: '3px',
              backgroundColor: theme.surface,
              cursor: 'pointer',
              fontSize: '12px',
              color: theme.primary,
            }}
            onClick={handleShowMore}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.surfaceHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = theme.surface)}
          >{t('Show more (')}{Math.min(100, datarows.length - displayCount)}{' '}{t('more)')}</button>
        )}
      </div>
    </div>
  );
}

export default PPLResultsTable;
