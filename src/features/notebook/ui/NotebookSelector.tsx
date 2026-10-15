// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
/**
 * NotebookSelector Component - Manages notebook selection, creation, and deletion
 * Requirements: 8.6
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNotebook } from './NotebookContext';
import { usePopoverPosition } from '../../../hooks/usePopoverPosition';
import { useTheme } from '../../../context/ThemeContext';
import type { NotebookMetadata } from '../../../types/notebook';

export interface NotebookSelectorProps {
  onNotebookChange?: (notebookId: string | null) => void;
}

// Theme-aware style functions
const getSelectorButtonStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  borderRadius: '6px',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  backgroundColor: isDark ? '#2d2d2d' : '#fff',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  color: isDark ? '#fff' : '#1a1c21',
  transition: 'all 0.15s ease',
  minWidth: '180px',
  maxWidth: '280px',
});

const getDropdownStyles = (isDark: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: '4px',
  backgroundColor: isDark ? '#2d2d2d' : '#fff',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  borderRadius: '8px',
  boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.12)',
  minWidth: '280px',
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
  width: '100%', border: 'none', background: 'transparent', textAlign: 'left',
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
  backgroundColor: isDark ? '#2d4a6f' : '#e6f1fa',
  color: isDark ? '#3b82f6' : '#006bb4',
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

const modalOverlayStyles: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
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

const getInputStyles = (isDark: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  borderRadius: '4px',
  outline: 'none',
  backgroundColor: isDark ? '#1e1e1e' : '#fff',
  color: isDark ? '#fff' : '#1a1c21',
});

const getLabelStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'block',
  marginBottom: '6px',
  fontSize: '13px',
  fontWeight: 500,
  color: isDark ? '#fff' : '#1a1c21',
});

const buttonStyles: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
};

const primaryButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: '#006bb4',
  color: '#fff',
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

/**
 * NotebookSelector component
 */
export function NotebookSelector({
  onNotebookChange,
}: NotebookSelectorProps): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const {
    notebooks,
    activeNotebook,
    createNewNotebook,
    deleteNotebook,
    renameNotebook,
    setActiveNotebook,
  } = useNotebook();

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [notebookToDelete, setNotebookToDelete] = useState<NotebookMetadata | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const popoverPosition = usePopoverPosition(dropdownRef, isDropdownOpen, 300);

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

  const handleSelectNotebook = useCallback(
    (notebookId: string) => {
      setActiveNotebook(notebookId);
      onNotebookChange?.(notebookId);
      setIsDropdownOpen(false);
    },
    [setActiveNotebook, onNotebookChange]
  );

  const handleOpenCreateModal = useCallback(() => {
    setNewNotebookName(`Notebook ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
    setIsCreateModalOpen(true);
    setIsDropdownOpen(false);
  }, []);

  const handleCreateNotebook = useCallback(() => {
    if (newNotebookName.trim()) {
      const notebook = createNewNotebook(newNotebookName.trim());
      onNotebookChange?.(notebook.id);
      setIsCreateModalOpen(false);
      setNewNotebookName('');
    }
  }, [newNotebookName, createNewNotebook, onNotebookChange]);

  const handleOpenDeleteModal = useCallback((notebook: NotebookMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotebookToDelete(notebook);
    setIsDeleteModalOpen(true);
    setIsDropdownOpen(false);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (notebookToDelete && !isDeleting) {
      setIsDeleting(true); setDeleteError(null);
      try {
      await deleteNotebook(notebookToDelete.id);
      if (activeNotebook?.id === notebookToDelete.id) {
        onNotebookChange?.(null);
      }
      setIsDeleteModalOpen(false);
      setNotebookToDelete(null);
      } catch (error) { setDeleteError(error instanceof Error ? error.message : 'Delete failed'); }
      finally { setIsDeleting(false); }
    }
  }, [notebookToDelete, isDeleting, deleteNotebook, activeNotebook, onNotebookChange]);

  const handleOpenRenameModal = useCallback(() => {
    if (activeNotebook) {
      setRenameValue(activeNotebook.name);
      setIsRenameModalOpen(true);
      setIsDropdownOpen(false);
    }
  }, [activeNotebook]);

  const handleConfirmRename = useCallback(() => {
    if (renameValue.trim() && activeNotebook) {
      renameNotebook(renameValue.trim());
      setIsRenameModalOpen(false);
      setRenameValue('');
    }
  }, [renameValue, renameNotebook, activeNotebook]);

  const buttonLabel = activeNotebook?.name || 'Select Notebook';

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Selector Button */}
      <button
        style={getSelectorButtonStyles(isDark)}
        aria-expanded={isDropdownOpen}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill={isDark ? '#98a2b3' : '#69707d'}>
          <path d="M2 2h12v2H2V2zm0 4h12v8H2V6zm2 2v4h8V8H4z" />
        </svg>
        <span style={{ 
          flex: 1, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}>
          {buttonLabel}
        </span>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill={isDark ? '#98a2b3' : '#69707d'}
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
        <div style={{ ...getDropdownStyles(isDark), ...popoverPosition }}>
          {/* Create New */}
          <button type="button"
            style={hoveredItem === 'create' ? { ...getCreateButtonStyles(isDark), backgroundColor: isDark ? '#3c3c3c' : '#f5f7fa' } : getCreateButtonStyles(isDark)}
            onClick={handleOpenCreateModal}
            onMouseEnter={() => setHoveredItem('create')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm4 9H9v3H7V9H4V7h3V4h2v3h3v2z" />
            </svg>{t('Create New Notebook')}</button>

          {/* Rename Current */}
          {activeNotebook && (
            <button type="button"
              style={hoveredItem === 'rename' ? { ...getMenuItemStyles(isDark), backgroundColor: isDark ? '#3c3c3c' : '#f5f7fa' } : getMenuItemStyles(isDark)}
              onClick={handleOpenRenameModal}
              onMouseEnter={() => setHoveredItem('rename')}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill={isDark ? '#98a2b3' : '#69707d'}>
                <path d="M11.4 1.6a2 2 0 012.8 2.8l-8.5 8.5-3.5.7.7-3.5 8.5-8.5zm-1.4 1.4L3.5 9.5l-.3 1.3 1.3-.3L11 4l-1-1z" />
              </svg>{t('Rename Notebook')}</button>
          )}

          {notebooks.length > 0 && (
            <>
              <div style={getDropdownHeaderStyles(isDark)}>{t('Your Notebooks')}</div>
              {notebooks.map((notebook) => {
                const isActive = activeNotebook?.id === notebook.id;
                const isHovered = hoveredItem === notebook.id;
                
                return (
                  <div
                    key={notebook.id}
                    style={isActive ? getMenuItemActiveStyles(isDark) : (isHovered ? getMenuItemHoverStyles(isDark) : getMenuItemStyles(isDark))}
                    onClick={() => handleSelectNotebook(notebook.id)}
                    onMouseEnter={() => setHoveredItem(notebook.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    {isActive ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill={isDark ? '#3b82f6' : '#006bb4'}>
                        <path d="M6.5 12.5l-4-4 1.4-1.4 2.6 2.6 6.6-6.6 1.4 1.4-8 8z" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill={isDark ? '#4a4a4a' : '#d3dae6'}>
                        <path d="M2 2h12v2H2V2zm0 4h12v8H2V6zm2 2v4h8V8H4z" />
                      </svg>
                    )}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {notebook.name}
                    </span>
                    <button
                      style={{
                        ...deleteButtonStyles,
                        opacity: isHovered ? 1 : 0,
                      }}
                      onClick={(e) => handleOpenDeleteModal(notebook, e)}
                      title={t('Delete notebook')}
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
        </div>
      )}

      {/* Create Notebook Modal */}
      {isCreateModalOpen && (
        <div style={modalOverlayStyles} onClick={() => setIsCreateModalOpen(false)}>
          <div style={getModalStyles(isDark)} onClick={(e) => e.stopPropagation()}>
            <div style={getModalHeaderStyles(isDark)}>{t('Create New Notebook')}</div>
            <div style={modalBodyStyles}>
              <label style={getLabelStyles(isDark)}>{t('Notebook Name')}</label>
              <input
                type="text"
                value={newNotebookName}
                onChange={(e) => setNewNotebookName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
                placeholder={t('Enter notebook name')}
                style={getInputStyles(isDark)}
                autoFocus
              />
            </div>
            <div style={getModalFooterStyles(isDark)}>
              <button style={getTextButtonStyles(isDark)} onClick={() => setIsCreateModalOpen(false)}>{t('Cancel')}</button>
              <button
                style={{
                  ...primaryButtonStyles,
                  opacity: newNotebookName.trim() ? 1 : 0.5,
                  cursor: newNotebookName.trim() ? 'pointer' : 'not-allowed',
                }}
                onClick={handleCreateNotebook}
                disabled={!newNotebookName.trim()}
              >{t('Create')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && notebookToDelete && (
        <div style={modalOverlayStyles} onClick={() => setIsDeleteModalOpen(false)}>
          <div style={getModalStyles(isDark)} onClick={(e) => e.stopPropagation()}>
            <div style={getModalHeaderStyles(isDark)}>{t('Delete Notebook')}</div>
            <div style={modalBodyStyles}>
              <p style={{ margin: 0, fontSize: '14px', color: isDark ? '#fff' : '#1a1c21' }}>{t('Are you sure you want to delete')}{' '}<strong>{notebookToDelete.name}</strong>?
              </p>
              <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: isDark ? '#98a2b3' : '#69707d' }}>{t('This action cannot be undone.')}</p>
            </div>
            {deleteError && <p role="alert">{deleteError}</p>}
            <div style={getModalFooterStyles(isDark)}>
              <button style={getTextButtonStyles(isDark)} onClick={() => setIsDeleteModalOpen(false)}>{t('Cancel')}</button>
              <button style={dangerButtonStyles} disabled={isDeleting} onClick={handleConfirmDelete}>{t('Delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Notebook Modal */}
      {isRenameModalOpen && activeNotebook && (
        <div style={modalOverlayStyles} onClick={() => setIsRenameModalOpen(false)}>
          <div style={getModalStyles(isDark)} onClick={(e) => e.stopPropagation()}>
            <div style={getModalHeaderStyles(isDark)}>{t('Rename Notebook')}</div>
            <div style={modalBodyStyles}>
              <label style={getLabelStyles(isDark)}>{t('Notebook Name')}</label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
                placeholder={t('Enter new name')}
                style={getInputStyles(isDark)}
                autoFocus
              />
            </div>
            <div style={getModalFooterStyles(isDark)}>
              <button style={getTextButtonStyles(isDark)} onClick={() => setIsRenameModalOpen(false)}>{t('Cancel')}</button>
              <button
                style={{
                  ...primaryButtonStyles,
                  opacity: renameValue.trim() ? 1 : 0.5,
                  cursor: renameValue.trim() ? 'pointer' : 'not-allowed',
                }}
                onClick={handleConfirmRename}
                disabled={!renameValue.trim()}
              >{t('Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotebookSelector;
