// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
/**
 * TrackingSidebar Component - Collapsible sidebar showing tracked API usage
 * Requirements: 10.3, 10.4
 */

import React, { useState } from 'react';
import { useTracking, useUI } from '../NotebookContext';
import { useTheme } from '../../../../context/ThemeContext';
import { parseEndpoint } from '../../../../services/endpointParser';
import type { TrackedOperation, CategorizedPermission } from '../../../../types/tracking';

export interface TrackingSidebarProps {
  onGenerateRole?: () => void;
}

/**
 * Categorize operations into cluster and index operations
 */
function categorizeOperations(operations: TrackedOperation[]): {
  cluster: TrackedOperation[];
  index: Map<string, TrackedOperation[]>;
} {
  const cluster: TrackedOperation[] = [];
  const index = new Map<string, TrackedOperation[]>();

  for (const op of operations) {
    const parsed = parseEndpoint(op.endpoint);
    if (parsed.type === 'cluster' || parsed.type === 'unknown') {
      cluster.push(op);
    } else {
      const patterns = op.indexPatterns.length > 0 ? op.indexPatterns : ['*'];
      for (const pattern of patterns) {
        const existing = index.get(pattern) || [];
        existing.push(op);
        index.set(pattern, existing);
      }
    }
  }

  return { cluster, index };
}

/**
 * Group permissions by type
 */
function groupPermissions(permissions: CategorizedPermission[]): {
  cluster: CategorizedPermission[];
  indexByPattern: Map<string, CategorizedPermission[]>;
} {
  const cluster: CategorizedPermission[] = [];
  const indexByPattern = new Map<string, CategorizedPermission[]>();

  for (const perm of permissions) {
    if (perm.type === 'cluster') {
      cluster.push(perm);
    } else {
      const patterns = perm.indexPatterns ?? ['*'];
      for (const pattern of patterns) {
        const existing = indexByPattern.get(pattern) || [];
        if (!existing.some((p) => p.permission === perm.permission)) {
          existing.push(perm);
          indexByPattern.set(pattern, existing);
        }
      }
    }
  }

  return { cluster, indexByPattern };
}

/**
 * Collapsible section component
 */
function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  useLanguage();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: '16px' }}>
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
          cursor: 'pointer',
          userSelect: 'none',
        }} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: theme.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            style={{
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          >
            <path d="M4 2l4 4-4 4V2z" />
          </svg>
          {title}
        </span>
        <span style={{
          backgroundColor: theme.surfaceHover,
          color: theme.text,
          padding: '2px 6px',
          borderRadius: '10px',
          fontSize: '11px',
          fontWeight: 500,
        }}>{count}</span>
      </div>
      {isOpen && <div style={{ paddingLeft: '4px' }}>{children}</div>}
    </div>
  );
}

/**
 * TrackingSidebar component
 */
export function TrackingSidebar({ onGenerateRole }: TrackingSidebarProps): React.ReactElement | null {
  useLanguage();
  const { theme, mode } = useTheme();
  const { sidebarOpen } = useUI();
  const { operations, permissions, clearTracking } = useTracking();

  if (!sidebarOpen) {
    return null;
  }

  const { cluster: clusterOps, index: indexOps } = categorizeOperations(operations);
  const { cluster: clusterPerms, indexByPattern } = groupPermissions(permissions);

  const totalIndexPerms = Array.from(indexByPattern.values()).reduce(
    (sum, perms) => sum + perms.length,
    0
  );

  const hasTrackedOperations = operations.length > 0;

  // Method badge colors
  const getMethodBadgeStyles = (method: string): React.CSSProperties => {
    const colors: Record<string, { bg: string; color: string }> = {
      GET: { bg: theme.primaryLight, color: theme.primary },
      POST: { bg: theme.successLight, color: theme.success },
      PUT: { bg: theme.warningLight, color: theme.warning },
      DELETE: { bg: theme.errorLight, color: theme.error },
      HEAD: { bg: mode === 'dark' ? '#3d2a4d' : '#f0e6fa', color: '#6b4fa2' },
      PATCH: { bg: theme.infoLight, color: theme.info },
    };
    const style = colors[method] || { bg: theme.surfaceHover, color: theme.text };
    return {
      padding: '2px 6px',
      borderRadius: '3px',
      fontSize: '10px',
      fontWeight: 600,
      backgroundColor: style.bg,
      color: style.color,
    };
  };

  return (
    <aside style={{
      width: '300px',
      minWidth: '300px',
      borderLeft: `1px solid ${theme.border}`,
      backgroundColor: theme.backgroundSecondary,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: `1px solid ${theme.border}`,
        backgroundColor: theme.surface,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: 600,
          color: theme.text,
        }}>{t('API Tracking')}</h3>
        <button
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            color: theme.error,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: operations.length === 0 ? 'not-allowed' : 'pointer',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: operations.length === 0 ? 0.5 : 1,
          }}
          onClick={clearTracking}
          disabled={operations.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 3h3v1h-1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4H2V3h3V2a1 1 0 011-1h4a1 1 0 011 1v1zM5 3h6V2H5v1z" />
          </svg>{t('Clear')}</button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
        {/* Stats Card */}
        <div style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '16px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
          }}>
            <span style={{ color: theme.textMuted }}>{t('Tracked Operations')}</span>
            <span style={{ fontWeight: 600, color: theme.text }}>{operations.length}</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            marginTop: '8px',
          }}>
            <span style={{ color: theme.textMuted }}>{t('Derived Permissions')}</span>
            <span style={{ fontWeight: 600, color: theme.text }}>{permissions.length}</span>
          </div>
        </div>

        {operations.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '24px 16px',
            color: theme.textMuted,
            fontSize: '13px',
          }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              style={{ marginBottom: '12px', opacity: 0.5 }}
            >
              <circle cx="24" cy="24" r="20" stroke={theme.border} strokeWidth="2" />
              <path d="M24 14v12M24 30v2" stroke={theme.border} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p>{t('No API calls tracked yet.')}</p>
            <p style={{ fontSize: '12px', color: theme.textMuted }}>{t('Execute queries to track API usage.')}</p>
          </div>
        ) : (
          <>
            {/* Cluster Operations */}
            {clusterOps.length > 0 && (
              <CollapsibleSection title={t('Cluster Operations')} count={clusterOps.length}>
                {clusterOps.map((op, idx) => (
                  <div key={`cluster-op-${idx}`} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.borderLight}`,
                    borderRadius: '4px',
                    marginBottom: '4px',
                    fontSize: '12px',
                  }}>
                    <span style={getMethodBadgeStyles(op.method)}>{op.transport === 'grpc' ? 'gRPC' : op.method}</span>
                    <span style={{
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                      fontSize: '11px',
                      color: theme.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }} title={op.endpoint}>
                      {op.endpoint}
                    </span>
                  </div>
                ))}
              </CollapsibleSection>
            )}

            {/* Index Operations */}
            {indexOps.size > 0 && (
              <CollapsibleSection title={t('Index Operations')} count={indexOps.size}>
                {Array.from(indexOps.entries()).map(([pattern, ops]) => (
                  <div key={pattern} style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: theme.warningLight,
                      border: `1px solid ${theme.warning}`,
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: theme.warning,
                      marginBottom: '8px',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z" />
                      </svg>
                      {pattern}
                    </div>
                    {ops.map((op, idx) => (
                      <div key={`${pattern}-op-${idx}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        backgroundColor: theme.surface,
                        border: `1px solid ${theme.borderLight}`,
                        borderRadius: '4px',
                        marginBottom: '4px',
                        fontSize: '12px',
                      }}>
                        <span style={getMethodBadgeStyles(op.method)}>{op.transport === 'grpc' ? 'gRPC' : op.method}</span>
                        <span style={{
                          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                          fontSize: '11px',
                          color: theme.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }} title={op.endpoint}>
                          {op.endpoint}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </CollapsibleSection>
            )}

            {/* Divider */}
            <div
              style={{
                height: '1px',
                backgroundColor: theme.border,
                margin: '16px 0',
              }}
            />

            {/* Cluster Permissions */}
            {clusterPerms.length > 0 && (
              <CollapsibleSection title={t('Cluster Permissions')} count={clusterPerms.length}>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {clusterPerms.map((perm, idx) => (
                    <span key={`cluster-perm-${idx}`} style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      backgroundColor: theme.surface,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                      color: theme.text,
                      marginRight: '4px',
                      marginBottom: '4px',
                    }}>
                      {perm.permission}
                    </span>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Index Permissions */}
            {indexByPattern.size > 0 && (
              <CollapsibleSection title={t('Index Permissions')} count={totalIndexPerms}>
                {Array.from(indexByPattern.entries()).map(([pattern, perms]) => (
                  <div key={pattern} style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: theme.warningLight,
                      border: `1px solid ${theme.warning}`,
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: theme.warning,
                      marginBottom: '8px',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z" />
                      </svg>
                      {pattern}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {perms.map((perm, idx) => (
                        <span key={`${pattern}-perm-${idx}`} style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          backgroundColor: theme.surface,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                          color: theme.text,
                          marginRight: '4px',
                          marginBottom: '4px',
                        }}>
                          {perm.permission}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </CollapsibleSection>
            )}
          </>
        )}
      </div>

      {/* Generate Role Button */}
      <div style={{ padding: '16px', borderTop: `1px solid ${theme.border}`, backgroundColor: theme.surface }}>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#fff',
            backgroundColor: theme.primary,
            border: 'none',
            borderRadius: '6px',
            cursor: hasTrackedOperations ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            opacity: hasTrackedOperations ? 1 : 0.5,
          }}
          onClick={onGenerateRole}
          disabled={!hasTrackedOperations}
          title={hasTrackedOperations ? t('Generate security role from tracked operations') : t('Execute queries first to track operations')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0L1 3v5c0 4.4 3 8.5 7 10 4-1.5 7-5.6 7-10V3L8 0zm0 2l5 2v4c0 3.3-2.2 6.4-5 7.7-2.8-1.3-5-4.4-5-7.7V4l5-2zm2.5 4.5l-3 3-1.5-1.5-1 1 2.5 2.5 4-4-1-1z" />
          </svg>{t('Generate Role')}</button>
      </div>
    </aside>
  );
}

export default TrackingSidebar;
