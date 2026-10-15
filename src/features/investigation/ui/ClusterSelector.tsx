// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
//
// Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.

import { t, useLanguage } from '../../../i18n';
/**
 * Cluster Selector Component
 * Multi-select component for choosing connections to query
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.7
 */

import { useState } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { useInvestigation } from './InvestigationContext';
import type { ConnectionConfig } from '../../../types/connection';

export interface ClusterSelectorProps {
  onAddConnection?: () => void;
  onEditConnection?: (connection: ConnectionConfig) => void;
}

export function ClusterSelector({ onAddConnection, onEditConnection }: ClusterSelectorProps) {
  useLanguage();
  const { theme } = useTheme();
  const { state, updateClusterGroup } = useInvestigation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);

  const selectedIds = new Set(state.clusterGroup?.connectionIds ?? []);

  const handleToggleConnection = (connectionId: string) => {
    const newIds = new Set(selectedIds);
    if (newIds.has(connectionId)) {
      newIds.delete(connectionId);
    } else {
      newIds.add(connectionId);
    }
    updateClusterGroup(Array.from(newIds));
  };

  const handleSelectAll = () => {
    updateClusterGroup(state.connections.map((c) => c.id));
  };

  const handleSelectNone = () => {
    updateClusterGroup([]);
  };

  return (
    <div style={{
      borderBottom: `1px solid ${theme.border}`,
      backgroundColor: theme.surface,
    }}>
      {/* Header row */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill={theme.textMuted}
            style={{
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          >
            <path d="M6 12l4-4-4-4v8z" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 500, color: theme.text }}>{t('Clusters')}</span>
          <span style={{
            fontSize: '12px',
            color: theme.textMuted,
            backgroundColor: theme.surfaceHover,
            padding: '2px 8px',
            borderRadius: '10px',
          }}>
            {selectedIds.size}{' '}{t('of')}{' '}{state.connections.length}
          </span>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleSelectAll}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              border: `1px solid ${theme.border}`,
              borderRadius: '3px',
              backgroundColor: theme.surface,
              color: theme.textMuted,
              cursor: 'pointer',
            }}
          >{t('Select All')}</button>
          <button
            onClick={handleSelectNone}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              border: `1px solid ${theme.border}`,
              borderRadius: '3px',
              backgroundColor: theme.surface,
              color: theme.textMuted,
              cursor: 'pointer',
            }}
          >{t('Clear')}</button>
        </div>
      </div>

      {/* Expanded connection list */}
      {isExpanded && (
        <div style={{
          padding: '0 16px 12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          {state.connections.length === 0 ? (
            <div style={{
              padding: '12px',
              fontSize: '13px',
              color: theme.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <span>{t('No connections configured.')}</span>
              {onAddConnection && (
                <button
                  onClick={onAddConnection}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    border: `1px solid ${theme.primary}`,
                    borderRadius: '4px',
                    backgroundColor: 'transparent',
                    color: theme.primary,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >{t('Add Connection')}</button>
              )}
            </div>
          ) : (
            <>
              {state.connections.map((connection) => {
                const isSelected = selectedIds.has(connection.id);
                const status = state.clusterStatuses.get(connection.id);
                const isHovered = hoveredConnectionId === connection.id;
                
                return (
                  <div
                    key={connection.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: `1px solid ${isSelected ? theme.primary : theme.border}`,
                      borderRadius: '6px',
                      backgroundColor: isSelected ? theme.primaryLight : theme.surface,
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={() => setHoveredConnectionId(connection.id)}
                    onMouseLeave={() => setHoveredConnectionId(null)}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        flex: 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleConnection(connection.id)}
                        style={{ margin: 0 }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: isSelected ? theme.primary : theme.text,
                        }}>
                          {connection.name}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          color: theme.textMuted,
                        }}>
                          {connection.endpoint}
                        </span>
                      </div>
                    </label>
                    {/* Status indicator */}
                    {status && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 
                          status.status === 'executing' ? theme.warning :
                          status.status === 'success' ? theme.success :
                          status.status === 'error' ? theme.error :
                          theme.textMuted,
                      }} />
                    )}
                    {/* Edit button */}
                    {onEditConnection && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditConnection(connection);
                        }}
                        style={{
                          padding: '4px',
                          border: 'none',
                          borderRadius: '3px',
                          backgroundColor: 'transparent',
                          color: theme.textMuted,
                          cursor: 'pointer',
                          opacity: isHovered ? 1 : 0,
                          transition: 'opacity 0.15s ease',
                        }}
                        title={t('Edit connection')}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
              {/* Add connection button when there are existing connections */}
              {onAddConnection && (
                <button
                  onClick={onAddConnection}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    border: `1px dashed ${theme.border}`,
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    color: theme.textMuted,
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
                  </svg>{t('Add Connection')}</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
