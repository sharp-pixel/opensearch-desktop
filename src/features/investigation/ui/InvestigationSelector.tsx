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
 * Investigation Selector Component
 * Browse and select investigations
 * Requirements: 1.5, 1.6
 */

import React, { useState, useCallback } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { useInvestigation } from './InvestigationContext';
export interface InvestigationSelectorProps {
  onClose?: () => void;
}

/**
 * Investigation Selector - browse and manage investigations
 */
export function InvestigationSelector({
  onClose,
}: InvestigationSelectorProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const { state, selectId, createNewInvestigation, deleteInvestigation } = useInvestigation();
  const investigations = state.investigations;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string) => {
    selectId(id);
    onClose?.();
  }, [selectId, onClose]);

  const handleCreate = useCallback(() => {
    const name = `Investigation ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    createNewInvestigation(name);
    onClose?.();
  }, [createNewInvestigation, onClose]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleteError(null);
    try { await deleteInvestigation(id); setDeleteConfirmId(null); }
    catch (error) { setDeleteError(error instanceof Error ? error.message : 'Delete failed'); }
  }, [deleteInvestigation]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: theme.surface,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: 600,
          color: theme.text,
        }}>{t('Investigations')}</h3>
        <button
          onClick={handleCreate}
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: theme.primary,
            color: '#fff',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
          </svg>{t('New')}</button>
      </div>

      {deleteError && <div role="alert">{deleteError}</div>}
      {/* Investigation List */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '8px',
      }}>
        {investigations.length === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            color: theme.textMuted,
            fontSize: '13px',
          }}>
            <p style={{ margin: '0 0 12px 0' }}>{t('No investigations yet')}</p>
            <button
              onClick={handleCreate}
              style={{
                padding: '8px 16px',
                border: `1px solid ${theme.primary}`,
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: theme.primary,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >{t('Create your first investigation')}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {investigations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: state.activeInvestigation?.id === inv.id
                    ? theme.primaryLight
                    : theme.background,
                  border: `1px solid ${state.activeInvestigation?.id === inv.id ? theme.primary : theme.border}`,
                  cursor: 'pointer',
                }}
                onClick={() => handleSelect(inv.id)}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: theme.text,
                  }}>
                    {inv.name}
                  </span>
                  
                  {deleteConfirmId === inv.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(inv.id);
                        }}
                        style={{
                          padding: '2px 8px',
                          border: 'none',
                          borderRadius: '3px',
                          backgroundColor: theme.error,
                          color: '#fff',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >{t('Delete')}</button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        style={{
                          padding: '2px 8px',
                          border: 'none',
                          borderRadius: '3px',
                          backgroundColor: theme.surface,
                          color: theme.textMuted,
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >{t('Cancel')}</button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(inv.id);
                      }}
                      style={{
                        padding: '2px 6px',
                        border: 'none',
                        borderRadius: '3px',
                        backgroundColor: 'transparent',
                        color: theme.textMuted,
                        fontSize: '12px',
                        cursor: 'pointer',
                        opacity: 0.6,
                      }}
                      title={t('Delete investigation')}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                      </svg>
                    </button>
                  )}
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '11px',
                  color: theme.textMuted,
                }}>
                  <span>{t(inv.cells.length === 1 ? '{count} cell' : '{count} cells', { count: inv.cells.length })}</span>
                  <span>{formatDate(inv.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default InvestigationSelector;
