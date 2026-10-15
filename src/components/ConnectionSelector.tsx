// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
//
// Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.

import { t, useLanguage } from '../i18n';
/**
 * ConnectionSelector Component - Manages connection selection, creation, and deletion
 * Allows users to save multiple connections and switch between them
 */

import React, { useState, useCallback, useRef, useEffect, useId } from 'react';
import { useConnections } from '../connections/ConnectionProvider';
import { usePopoverPosition } from '../hooks/usePopoverPosition';
import { AccessibleDialog } from './Dialogs/AccessibleDialog';
import { useTheme } from '../context/ThemeContext';
import { validateConnection } from '../services/queryExecutor';
import type { ConnectionConfig } from '../types/connection';

export interface ConnectionSelectorProps {
  onOpenConnectionSettings: () => void;
  onEditConnection?: (connection: ConnectionConfig) => void;
}

// Cluster status from OpenSearch (matches /_cluster/health response)
type ClusterStatus = 'green' | 'yellow' | 'red' | 'disconnected' | 'checking';

// Get colors based on cluster status - these are semantic colors that work in both themes
function getStatusColors(status: ClusterStatus, isDark: boolean): { borderColor: string; backgroundColor: string; color: string } {
  switch (status) {
    case 'green':
      return { 
        borderColor: isDark ? '#10b981' : '#7dcea0', 
        backgroundColor: isDark ? '#1a3d2e' : '#e6f7f0', 
        color: isDark ? '#10b981' : '#00a86b' 
      };
    case 'yellow':
      return { 
        borderColor: isDark ? '#f59e0b' : '#f5d67d', 
        backgroundColor: isDark ? '#3d3520' : '#fef9e6', 
        color: isDark ? '#f59e0b' : '#8a6d3b' 
      };
    case 'red':
      return { 
        borderColor: isDark ? '#ef4444' : '#f5c6cb', 
        backgroundColor: isDark ? '#3d1f1f' : '#fef6f6', 
        color: isDark ? '#ef4444' : '#bd271e' 
      };
    case 'checking':
      return { 
        borderColor: isDark ? '#3c3c3c' : '#d3dae6', 
        backgroundColor: isDark ? '#2d2d2d' : '#f5f7fa', 
        color: isDark ? '#98a2b3' : '#69707d' 
      };
    case 'disconnected':
    default:
      return { 
        borderColor: isDark ? '#3c3c3c' : '#d3dae6', 
        backgroundColor: isDark ? '#2d2d2d' : '#f5f7fa', 
        color: isDark ? '#98a2b3' : '#98a2b3' 
      };
  }
}

// Styles
const selectorButtonStyles = (status: ClusterStatus, isDark: boolean): React.CSSProperties => {
  const colors = getStatusColors(status, isDark);
  
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: '16px',
    border: `1px solid ${colors.borderColor}`,
    backgroundColor: colors.backgroundColor,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    color: colors.color,
    transition: 'all 0.15s ease',
    minWidth: '140px',
    maxWidth: '280px',
  };
};

// Theme-aware style functions
const getDropdownStyles = (isDark: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginTop: '8px',
  backgroundColor: isDark ? '#2d2d2d' : '#fff',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  borderRadius: '8px',
  boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.12)',
  minWidth: '300px',
  maxHeight: '400px',
  overflowY: 'auto',
  zIndex: 1100,
});

const getDropdownHeaderStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '12px 16px',
  borderBottom: `1px solid ${isDark ? '#3c3c3c' : '#e0e5ee'}`,
  fontSize: '11px',
  fontWeight: 600,
  color: isDark ? '#98a2b3' : '#69707d',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
});

const getMenuItemStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 16px',
  cursor: 'pointer',
  fontSize: '13px',
  color: isDark ? '#fff' : '#1a1c21',
  transition: 'background-color 0.1s ease',
  borderBottom: `1px solid ${isDark ? '#3c3c3c' : '#f0f2f5'}`,
});

const getMenuItemHoverStyles = (isDark: boolean): React.CSSProperties => ({
  ...getMenuItemStyles(isDark),
  backgroundColor: isDark ? '#3c3c3c' : '#f5f7fa',
});

const getMenuItemActiveStyles = (isDark: boolean): React.CSSProperties => ({
  ...getMenuItemStyles(isDark),
  backgroundColor: isDark ? '#1a3d2e' : '#e6f7f0',
  color: isDark ? '#10b981' : '#00a86b',
});

const getCreateButtonStyles = (isDark: boolean): React.CSSProperties => ({
  ...getMenuItemStyles(isDark),
  color: isDark ? '#3b82f6' : '#006bb4',
  fontWeight: 500,
  borderBottom: 'none',
});

const deleteButtonStyles: React.CSSProperties = {
  padding: '4px',
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  color: '#bd271e',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.6,
  transition: 'opacity 0.15s ease',
};

const getModalStyles = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? '#2d2d2d' : '#fff',
  borderRadius: '8px',
  boxShadow: isDark ? '0 4px 24px rgba(0, 0, 0, 0.5)' : '0 4px 24px rgba(0, 0, 0, 0.2)',
  width: '400px',
  maxWidth: '90vw',
});

const getModalHeaderStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '16px 20px',
  borderBottom: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  fontSize: '16px',
  fontWeight: 600,
  color: isDark ? '#fff' : '#1a1c21',
});

const modalBodyStyles: React.CSSProperties = {
  padding: '20px',
};

const getModalFooterStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '16px 20px',
  borderTop: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  backgroundColor: isDark ? '#252525' : '#f5f7fa',
});

const buttonStyles: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
};

const dangerButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: '#bd271e',
  color: '#fff',
};

const getTextButtonStyles = (isDark: boolean): React.CSSProperties => ({
  ...buttonStyles,
  backgroundColor: 'transparent',
  color: isDark ? '#98a2b3' : '#69707d',
});

const connectionInfoStyles: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
};

const getConnectionNameStyles = (isDark: boolean): React.CSSProperties => ({
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: isDark ? '#fff' : '#1a1c21',
});

const connectionEndpointStyles: React.CSSProperties = {
  fontSize: '11px',
  color: '#98a2b3',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginTop: '2px',
};

const getAuthBadgeStyles = (authType: string, isDark: boolean): React.CSSProperties => ({
  fontSize: '10px',
  padding: '2px 6px',
  borderRadius: '3px',
  backgroundColor: authType === 'sigv4' 
    ? (isDark ? '#2d4a6f' : '#e6f1fa') 
    : authType === 'basic' 
      ? (isDark ? '#3d3520' : '#f5f0e6') 
      : (isDark ? '#3c3c3c' : '#f5f7fa'),
  color: authType === 'sigv4' 
    ? (isDark ? '#3b82f6' : '#006bb4') 
    : authType === 'basic' 
      ? (isDark ? '#f59e0b' : '#8a6d3b') 
      : (isDark ? '#98a2b3' : '#69707d'),
  fontWeight: 500,
  textTransform: 'uppercase',
});

/**
 * Get auth type display label
 */
function getAuthLabel(authType: string): string {
  switch (authType) {
    case 'sigv4': return 'IAM';
    case 'basic': return 'Basic';
    case 'apikey': return 'API Key';
    default: return 'None';
  }
}

/**
 * ConnectionSelector component
 */
export function ConnectionSelector({
  onOpenConnectionSettings,
  onEditConnection,
}: ConnectionSelectorProps): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const {
    connections,
    activeConnection,
    setActiveConnection,
    removeConnection,
    error: connectionError,
  } = useConnections();

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<ConnectionConfig | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [clusterStatus, setClusterStatus] = useState<ClusterStatus>('disconnected');
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (isDropdownOpen) menuRef.current?.querySelector('button')?.focus();
  }, [isDropdownOpen]);
  const popoverPosition = usePopoverPosition(dropdownRef, isDropdownOpen, 340);
  const healthCheckIntervalRef = useRef<number | null>(null);

  // Health check function - gets actual cluster status
  // showChecking: only show 'checking' state on initial check, not periodic refreshes
  const checkConnectionHealth = useCallback(async (connection: ConnectionConfig, showChecking: boolean = false) => {
    if (showChecking) {
      setClusterStatus('checking');
    }
    try {
      const result = await validateConnection(connection);
      if (result.valid && result.clusterStatus) {
        // Map cluster status to our type (green, yellow, red)
        const status = result.clusterStatus.toLowerCase();
        if (status === 'green' || status === 'yellow' || status === 'red') {
          setClusterStatus(status as ClusterStatus);
        } else {
          setClusterStatus('green'); // Default to green if unknown but connected
        }
      } else {
        setClusterStatus('disconnected');
      }
    } catch {
      setClusterStatus('disconnected');
    }
  }, []);

  // Run health check when active connection changes and periodically
  useEffect(() => {
    // Clear any existing interval
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }

    if (!activeConnection) {
      setClusterStatus('disconnected');
      return;
    }

    // Initial health check - show checking state
    checkConnectionHealth(activeConnection, true);

    // Set up periodic health check every 30 seconds - don't show checking state
    healthCheckIntervalRef.current = window.setInterval(() => {
      checkConnectionHealth(activeConnection, false);
    }, 30000);

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [activeConnection, checkConnectionHealth]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectConnection = useCallback(
    (connection: ConnectionConfig) => {
      setActiveConnection(connection);
      triggerRef.current?.focus();
      setIsDropdownOpen(false);
    },
    [setActiveConnection]
  );

  const handleOpenCreateModal = useCallback(() => {
    setIsDropdownOpen(false);
    triggerRef.current?.focus();
    onOpenConnectionSettings();
  }, [onOpenConnectionSettings]);

  const handleEditConnection = useCallback((connection: ConnectionConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(false);
    triggerRef.current?.focus();
    if (onEditConnection) {
      onEditConnection(connection);
    }
  }, [onEditConnection]);

  const handleOpenDeleteModal = useCallback((connection: ConnectionConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerRef.current?.focus();
    setDeleteError(null);
    setConnectionToDelete(connection);
    setIsDeleteModalOpen(true);
    setIsDropdownOpen(false);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!connectionToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await removeConnection(connectionToDelete.id);
      setIsDeleteModalOpen(false);
      setConnectionToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete connection');
    } finally {
      setIsDeleting(false);
    }
  }, [connectionToDelete, isDeleting, removeConnection]);

  const handleDisconnect = useCallback(() => {
    triggerRef.current?.focus();
    setActiveConnection(null);
    setIsDropdownOpen(false);
  }, [setActiveConnection]);

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}
      onBlur={event => {
        // macOS WebKit can blur to the body before clicking an unfocused button.
        // Keep that button mounted until its click; outside clicks are handled above.
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setIsDropdownOpen(false);
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && isDropdownOpen) {
          event.preventDefault(); event.stopPropagation();
          setIsDropdownOpen(false); triggerRef.current?.focus();
        }
      }}>

      {/* Selector Button */}
      <button
        ref={triggerRef}
        aria-expanded={isDropdownOpen}
        aria-controls={isDropdownOpen ? menuId : undefined}
        style={selectorButtonStyles(clusterStatus, isDark)}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          {clusterStatus === 'disconnected' ? (
            // WiFi off icon (Bootstrap Icons wifi-off)
            <>
              <path d="M10.706 3.294A12.545 12.545 0 0 0 8 3C5.259 3 2.723 3.882.663 5.379a.485.485 0 0 0-.048.736.518.518 0 0 0 .668.05A11.448 11.448 0 0 1 8 4c.63 0 1.249.05 1.852.148l.854-.854zM8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065 8.448 8.448 0 0 1 3.51-1.27L8 6zm2.596 1.404l.785-.785c.63.24 1.227.545 1.785.907a.482.482 0 0 1 .063.745.525.525 0 0 1-.652.065 8.462 8.462 0 0 0-1.98-.932zM8 10l.933-.933a6.455 6.455 0 0 1 2.013.637.482.482 0 0 1 .063.745.525.525 0 0 1-.652.065A5.478 5.478 0 0 0 8 10zm4.905-4.905l.747-.747c.59.3 1.153.645 1.685 1.03a.485.485 0 0 1 .048.737.518.518 0 0 1-.668.05 11.493 11.493 0 0 0-1.812-1.07zM9.02 11.78c.238.14.236.464.04.66l-.707.706a.5.5 0 0 1-.707 0l-.707-.707c-.195-.195-.197-.518.04-.66A1.99 1.99 0 0 1 8 11.5c.374 0 .723.102 1.021.28zm4.355-9.905a.53.53 0 0 1 .75.75l-10.75 10.75a.53.53 0 0 1-.75-.75l10.75-10.75z"/>
            </>
          ) : clusterStatus === 'checking' ? (
            // Loading/sync icon
            <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
          ) : (
            // WiFi connected icon (Bootstrap Icons wifi)
            <path d="M15.384 6.115a.485.485 0 0 0-.047-.736A12.444 12.444 0 0 0 8 3C5.259 3 2.723 3.882.663 5.379a.485.485 0 0 0-.048.736.518.518 0 0 0 .668.05A11.448 11.448 0 0 1 8 4c2.507 0 4.827.802 6.716 2.164.205.148.49.13.668-.049zM13.229 8.271a.482.482 0 0 0-.063-.745A9.455 9.455 0 0 0 8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065A8.448 8.448 0 0 1 8 7a8.448 8.448 0 0 1 4.576 1.336c.206.132.48.108.653-.065zm-2.183 2.183c.226-.226.185-.605-.1-.75A6.473 6.473 0 0 0 8 9c-1.06 0-2.062.254-2.946.704-.285.145-.326.524-.1.75l.015.015c.16.16.408.19.611.09A5.478 5.478 0 0 1 8 10c.868 0 1.69.201 2.42.56.203.1.45.07.611-.091l.015-.015zM9.06 12.44c.196-.196.198-.52-.04-.66A1.99 1.99 0 0 0 8 11.5a1.99 1.99 0 0 0-1.02.28c-.238.14-.236.464-.04.66l.706.706a.5.5 0 0 0 .707 0l.708-.707z"/>
          )}
        </svg>
        <span style={{ 
          flex: 1, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}>
          {activeConnection ? activeConnection.name : t('Not Connected')}
        </span>
        {clusterStatus === 'checking' && (
          <span style={{ fontSize: '10px', opacity: 0.7 }}>...</span>
        )}
        <svg 
          width="10" 
          height="10" 
          viewBox="0 0 12 12" 
          fill="currentColor"
          style={{
            transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <path d="M2 4l4 4 4-4H2z" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div ref={menuRef} id={menuId} role="group" aria-label={t('Connections')} style={{ ...getDropdownStyles(isDark), ...popoverPosition }}>
          {/* Add New Connection */}
          <button type="button" className="connection-menu-action"
            style={hoveredItem === 'create' ? { ...getCreateButtonStyles(isDark), backgroundColor: isDark ? '#3c3c3c' : '#f5f7fa' } : getCreateButtonStyles(isDark)}
            onClick={handleOpenCreateModal}
            onMouseEnter={() => setHoveredItem('create')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm4 9H9v3H7V9H4V7h3V4h2v3h3v2z" />
            </svg>{t('Add New Connection')}</button>

          {/* Disconnect option if connected */}
          {activeConnection && (
            <button type="button" className="connection-menu-action"
              style={hoveredItem === 'disconnect' ? { ...getMenuItemStyles(isDark), backgroundColor: isDark ? '#3d1f1f' : '#fef6f6', color: isDark ? '#ef4444' : '#bd271e' } : { ...getMenuItemStyles(isDark), color: isDark ? '#ef4444' : '#bd271e' }}
              onClick={handleDisconnect}
              onMouseEnter={() => setHoveredItem('disconnect')}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.5 4.5l-3 3 3 3-.7.7-3-3-3 3-.7-.7 3-3-3-3 .7-.7 3 3 3-3 .7.7z" />
              </svg>{t('Disconnect')}</button>
          )}

          {connections.length > 0 && (
            <>
              <div style={getDropdownHeaderStyles(isDark)}>{t('Saved Connections')}</div>
              {connections.map((connection) => {
                const isActive = activeConnection?.id === connection.id;
                const isHovered = hoveredItem === connection.id;
                
                return (
                  <div
                    key={connection.id}
                    style={isActive ? getMenuItemActiveStyles(isDark) : (isHovered ? getMenuItemHoverStyles(isDark) : getMenuItemStyles(isDark))}
                    onMouseEnter={() => setHoveredItem(connection.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <button type="button" className="connection-select-action" aria-pressed={isActive}
                      onClick={() => handleSelectConnection(connection)}>
                    {isActive ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill={isDark ? '#10b981' : '#00a86b'}>
                        <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.5 6.5l-4 4a.5.5 0 01-.7 0l-2-2a.5.5 0 01.7-.7L7 9.3l3.5-3.5a.5.5 0 01.7.7z" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill={isDark ? '#4a4a4a' : '#d3dae6'}>
                        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                    <div style={connectionInfoStyles}>
                      <div style={getConnectionNameStyles(isDark)}>{connection.name}</div>
                      <div style={connectionEndpointStyles}>{connection.endpoint}</div>
                    </div>
                    <span style={getAuthBadgeStyles(connection.authType, isDark)}>
                      {getAuthLabel(connection.authType)}
                    </span>
                    </button>
                    {/* Edit button */}
                    {onEditConnection && (
                      <button
                        style={{
                          ...deleteButtonStyles,
                          color: isDark ? '#3b82f6' : '#006bb4',
                          opacity: 1,
                        }}
                        onClick={(e) => handleEditConnection(connection, e)}
                        title={t('Edit connection')}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M11.4 1.6a2 2 0 012.8 2.8l-8.5 8.5-3.5.7.7-3.5 8.5-8.5zm-1.4 1.4L3.5 9.5l-.3 1.3 1.3-.3L11 4l-1-1z" />
                        </svg>
                      </button>
                    )}
                    {/* Delete button */}
                    <button
                      style={{
                        ...deleteButtonStyles,
                        opacity: 1,
                      }}
                      onClick={(e) => handleOpenDeleteModal(connection, e)}
                      title={t('Delete connection')}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11 3h3v1h-1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4H2V3h3V2a1 1 0 011-1h4a1 1 0 011 1v1zM5 3h6V2H5v1z" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {connections.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: isDark ? '#98a2b3' : '#69707d', fontSize: '13px' }}>
              <p style={{ margin: '0 0 8px 0' }}>{t('No saved connections')}</p>
              <p style={{ margin: 0, fontSize: '12px' }}>{t('Click "Add New Connection" to get started')}</p>
            </div>
          )}
        </div>
      )}

      {(connectionError || activeConnection?.credentialError) && <span role="alert">{connectionError || activeConnection?.credentialError}</span>}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && connectionToDelete && (
        <AccessibleDialog labelledBy={`${menuId}-delete-title`} onDismiss={() => setIsDeleteModalOpen(false)} style={getModalStyles(isDark)}>
            <div id={`${menuId}-delete-title`} style={getModalHeaderStyles(isDark)}>{t('Delete Connection')}</div>
            <div style={modalBodyStyles}>
              <p style={{ margin: 0, fontSize: '14px', color: isDark ? '#fff' : '#1a1c21' }}>{t('Are you sure you want to delete')}{' '}<strong>{connectionToDelete.name}</strong>?
              </p>
              <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: isDark ? '#98a2b3' : '#69707d' }}>{t('This action cannot be undone.')}</p>
            </div>
            {deleteError && <p role="alert">{deleteError}</p>}
            <div style={getModalFooterStyles(isDark)}>
              <button style={getTextButtonStyles(isDark)} onClick={() => setIsDeleteModalOpen(false)}>{t('Cancel')}</button>
              <button style={dangerButtonStyles} disabled={isDeleting} onClick={handleConfirmDelete}>{t('Delete')}</button>
            </div>
        </AccessibleDialog>
      )}
    </div>
  );
}

export default ConnectionSelector;
