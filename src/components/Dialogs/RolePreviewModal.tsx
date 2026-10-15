// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../i18n';
/**
 * Role Preview Modal Component
 * Displays generated role JSON with editing, validation, and export capabilities
 * Requirements: 6.8, 6.9, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import type { GeneratedRole, RoleSummary } from '../../types/role';
import {
  exportAsJson,
  validateRoleJson,
  parseRoleJson,
} from '../../services/roleGenerator';

export interface RolePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  generatedRole: GeneratedRole | null;
  onRoleUpdate?: (role: GeneratedRole) => void;
}

const overlayStyles: React.CSSProperties = {
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
  width: '700px',
  maxWidth: '90vw',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const getHeaderStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '16px 20px',
  borderBottom: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const getTitleStyles = (isDark: boolean): React.CSSProperties => ({
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  color: isDark ? '#fff' : '#1a1c21',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
});

const badgeStyles: React.CSSProperties = {
  backgroundColor: '#006bb4',
  color: '#fff',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 500,
};

const bodyStyles: React.CSSProperties = {
  padding: '20px',
  overflowY: 'auto',
  flex: 1,
};

const getFooterStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '16px 20px',
  borderTop: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: isDark ? '#252525' : '#f5f7fa',
});

const getSummaryPanelStyles = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? '#252525' : '#f5f7fa',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  borderRadius: '6px',
  padding: '16px',
  marginBottom: '16px',
});

const summaryRowStyles: React.CSSProperties = {
  display: 'flex',
  gap: '24px',
  marginBottom: '8px',
};

const getSummaryLabelStyles = (isDark: boolean): React.CSSProperties => ({
  fontSize: '13px',
  color: isDark ? '#98a2b3' : '#69707d',
});

const getSummaryValueStyles = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? '#3c3c3c' : '#e0e5ee',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 500,
  marginLeft: '8px',
  color: isDark ? '#fff' : '#1a1c21',
});

const getPatternBadgeStyles = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? '#3c3c3c' : '#e0e5ee',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  marginRight: '6px',
  marginBottom: '6px',
  display: 'inline-block',
  color: isDark ? '#fff' : '#1a1c21',
});

const toolbarStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
};

const getSwitchLabelStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  color: isDark ? '#fff' : '#1a1c21',
});

const getCodeBlockStyles = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? '#1a1a1a' : '#1d1f24',
  color: '#dfe5ef',
  padding: '16px',
  borderRadius: '6px',
  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
  fontSize: '12px',
  lineHeight: '1.5',
  overflow: 'auto',
  maxHeight: '350px',
  whiteSpace: 'pre',
});

const getTextareaStyles = (isDark: boolean): React.CSSProperties => ({
  width: '100%',
  minHeight: '350px',
  padding: '12px',
  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
  fontSize: '12px',
  lineHeight: '1.5',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  borderRadius: '6px',
  resize: 'vertical',
  backgroundColor: isDark ? '#1e1e1e' : '#fff',
  color: isDark ? '#fff' : '#1a1c21',
});

const getErrorBoxStyles = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? '#3d1f1f' : '#fef6f6',
  border: `1px solid ${isDark ? '#ef4444' : '#f5a9a9'}`,
  borderRadius: '6px',
  padding: '12px',
  marginBottom: '12px',
  color: isDark ? '#ef4444' : '#bd271e',
});

const buttonStyles: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  border: 'none',
};

const primaryButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: '#006bb4',
  color: '#fff',
};

const getSecondaryButtonStyles = (isDark: boolean): React.CSSProperties => ({
  ...buttonStyles,
  backgroundColor: isDark ? '#2d2d2d' : '#fff',
  color: isDark ? '#3b82f6' : '#006bb4',
  border: `1px solid ${isDark ? '#3b82f6' : '#006bb4'}`,
});

const getTextButtonStyles = (isDark: boolean): React.CSSProperties => ({
  ...buttonStyles,
  backgroundColor: 'transparent',
  color: isDark ? '#3b82f6' : '#006bb4',
});

const getIconButtonStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '6px',
  borderRadius: '4px',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  backgroundColor: isDark ? '#2d2d2d' : '#fff',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: isDark ? '#fff' : '#1a1c21',
});

const getHelpTextStyles = (isDark: boolean): React.CSSProperties => ({
  fontSize: '12px',
  color: isDark ? '#98a2b3' : '#69707d',
  marginTop: '16px',
  paddingTop: '12px',
  borderTop: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
});

/**
 * RolePreviewModal component for previewing and editing generated security roles
 */
export function RolePreviewModal({
  isOpen,
  onClose,
  generatedRole,
  onRoleUpdate,
}: RolePreviewModalProps) {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const [isEditing, setIsEditing] = useState(false);
  const [editedJson, setEditedJson] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [currentRole, setCurrentRole] = useState<GeneratedRole | null>(null);

  // Initialize state when modal opens or role changes
  useEffect(() => {
    if (generatedRole) {
      const json = exportAsJson(generatedRole);
      setEditedJson(json);
      setCurrentRole(generatedRole);
      setValidationErrors([]);
      setIsEditing(false);
    }
  }, [generatedRole, isOpen]);

  // Validate JSON when editing
  useEffect(() => {
    if (isEditing && editedJson) {
      const result = validateRoleJson(editedJson);
      setValidationErrors(result.errors);

      if (result.valid) {
        const parsed = parseRoleJson(editedJson, currentRole?.roleName);
        if (parsed) {
          setCurrentRole(parsed);
        }
      }
    }
  }, [editedJson, isEditing, currentRole?.roleName]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!currentRole) return;
    try {
      const jsonToCopy = isEditing ? editedJson : exportAsJson(currentRole);
      await navigator.clipboard.writeText(jsonToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [isEditing, editedJson, currentRole]);

  const handleDownload = useCallback(() => {
    if (!currentRole) return;

    const jsonToDownload = isEditing ? editedJson : exportAsJson(currentRole);
    const blob = new Blob([jsonToDownload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentRole.roleName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentRole, isEditing, editedJson]);

  const handleToggleEdit = useCallback(() => {
    if (!currentRole) return;
    if (isEditing) {
      // Switching from edit to view mode
      if (validationErrors.length === 0) {
        onRoleUpdate?.(currentRole);
      }
    } else {
      // Switching to edit mode
      setEditedJson(exportAsJson(currentRole));
    }
    setIsEditing(!isEditing);
  }, [isEditing, validationErrors, currentRole, onRoleUpdate]);

  const handleJsonChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditedJson(e.target.value);
    },
    []
  );

  const handleClose = useCallback(() => {
    setIsEditing(false);
    setValidationErrors([]);
    setCopySuccess(false);
    onClose();
  }, [onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  const summary = useMemo<RoleSummary | null>(() => {
    return currentRole?.summary || null;
  }, [currentRole]);

  if (!isOpen || !generatedRole || !currentRole) {
    return null;
  }

  const displayJson = isEditing ? editedJson : exportAsJson(currentRole);
  const hasValidationErrors = validationErrors.length > 0;

  return (
    <div style={overlayStyles} onClick={handleOverlayClick}>
      <div style={getModalStyles(isDark)} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={getHeaderStyles(isDark)}>
          <h2 style={getTitleStyles(isDark)}>{t('Generated Security Role')}<span style={badgeStyles}>{currentRole?.roleName}</span>
          </h2>
          <button
            style={getIconButtonStyles(isDark)}
            onClick={handleClose}
            aria-label={t('Close modal')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 6.586L12.293 2.293a1 1 0 111.414 1.414L9.414 8l4.293 4.293a1 1 0 01-1.414 1.414L8 9.414l-4.293 4.293a1 1 0 01-1.414-1.414L6.586 8 2.293 3.707a1 1 0 011.414-1.414L8 6.586z"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={bodyStyles}>
          {/* Permission Summary */}
          <div style={getSummaryPanelStyles(isDark)}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: isDark ? '#fff' : '#1a1c21' }}>{t('Permission Summary')}</h4>
            <div style={summaryRowStyles}>
              <span style={getSummaryLabelStyles(isDark)}>{t('Cluster Permissions:')}<span style={getSummaryValueStyles(isDark)}>
                  {summary?.clusterPermissionCount || 0}
                </span>
              </span>
              <span style={getSummaryLabelStyles(isDark)}>{t('Index Permissions:')}<span style={getSummaryValueStyles(isDark)}>
                  {summary?.indexPermissionCount || 0}
                </span>
              </span>
            </div>
            {summary && summary.indexPatterns.length > 0 && (
              <div>
                <span style={{ ...getSummaryLabelStyles(isDark), display: 'block', marginBottom: '8px' }}>{t('Index Patterns:')}</span>
                <div>
                  {summary.indexPatterns.map((pattern) => (
                    <span key={pattern} style={getPatternBadgeStyles(isDark)}>
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Edit Mode Toggle & Actions */}
          <div style={toolbarStyles}>
            <label style={getSwitchLabelStyles(isDark)}>
              <input
                type="checkbox"
                checked={isEditing}
                onChange={handleToggleEdit}
                disabled={hasValidationErrors && isEditing}
              />{t('Edit JSON')}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={getIconButtonStyles(isDark)}
                onClick={handleCopyToClipboard}
                title={copySuccess ? t('Copied') : t('Copy to clipboard')}
              >
                {copySuccess ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="#00a86b">
                    <path d="M6.5 12.5l-4-4 1.4-1.4 2.6 2.6 6.6-6.6 1.4 1.4-8 8z"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11 2H2v9h2V4h7V2zm3 2H5v10h9V4zm-1 9H6V5h7v8z"/>
                  </svg>
                )}
              </button>
              <button
                style={getIconButtonStyles(isDark)}
                onClick={handleDownload}
                title={t('Download as JSON')}
                disabled={hasValidationErrors}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 12l-4-4h2.5V2h3v6H12L8 12zm-6 2h12v1H2v-1z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Validation Errors */}
          {hasValidationErrors && (
            <div style={getErrorBoxStyles(isDark)}>
              <strong style={{ display: 'block', marginBottom: '8px' }}>{t('Invalid JSON')}</strong>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* JSON Display/Editor */}
          {isEditing ? (
            <textarea
              value={editedJson}
              onChange={handleJsonChange}
              style={{
                ...getTextareaStyles(isDark),
                borderColor: hasValidationErrors ? (isDark ? '#ef4444' : '#bd271e') : (isDark ? '#3c3c3c' : '#d3dae6'),
              }}
            />
          ) : (
            <pre style={getCodeBlockStyles(isDark)}>{displayJson}</pre>
          )}

          {/* Usage Instructions */}
          <p style={getHelpTextStyles(isDark)}>{t('To use this role, copy the JSON and create it using the OpenSearch Security API or Dashboards Security plugin.')}</p>
        </div>

        {/* Footer */}
        <div style={getFooterStyles(isDark)}>
          <button style={getTextButtonStyles(isDark)} onClick={handleClose}>{t('Close')}</button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              style={getSecondaryButtonStyles(isDark)}
              onClick={handleCopyToClipboard}
            >
              {copySuccess ? t('Copied') : t('Copy to Clipboard')}
            </button>
            <button
              style={{
                ...primaryButtonStyles,
                opacity: hasValidationErrors ? 0.5 : 1,
                cursor: hasValidationErrors ? 'not-allowed' : 'pointer',
              }}
              onClick={handleDownload}
              disabled={hasValidationErrors}
            >{t('Download JSON')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RolePreviewModal;
