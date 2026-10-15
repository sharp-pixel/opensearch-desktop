// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
/**
 * Workbench Toolbar Component
 * Action buttons for the Data Prepper workbench
 */

import React, { useCallback, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';

interface WorkbenchToolbarProps {
  isProcessing: boolean;
  hasErrors: boolean;
  onEvaluate: () => void;
  onExport: () => string;
  onImport: (json: string) => boolean;
}

export function WorkbenchToolbar({
  isProcessing,
  hasErrors,
  onEvaluate,
  onExport,
  onImport,
}: WorkbenchToolbarProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toolbarStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const titleStyles: React.CSSProperties = {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: theme.text,
  };

  const spacerStyles: React.CSSProperties = {
    flex: 1,
  };

  const buttonEmptyStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.primary,
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background-color 0.15s ease',
  };

  const buttonPrimaryStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    border: 'none',
    backgroundColor: theme.primary,
    color: '#fff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'all 0.15s ease',
  };

  const handleExport = useCallback(() => {
    const json = onExport();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data-prepper-workbench-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [onExport]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        onImport(text);
      } catch {
        // Handle error silently
      }

      event.target.value = '';
    },
    [onImport]
  );

  return (
    <div style={toolbarStyles}>
      <h2 style={titleStyles}>{t('Data Prepper Workbench')}</h2>

      <div style={spacerStyles} />

      <button style={buttonEmptyStyles} onClick={handleImportClick}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0l4 4h-3v4H7V4H4l4-4zm6 9v5H2V9H1v6h14V9h-1z" />
        </svg>{t('Import')}</button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <button style={buttonEmptyStyles} onClick={handleExport}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 12L4 8h3V4h2v4h3l-4 4zm6-3v5H2V9H1v6h14V9h-1z" />
        </svg>{t('Export')}</button>

      <button
        style={{
          ...buttonPrimaryStyles,
          opacity: hasErrors || isProcessing ? 0.5 : 1,
          cursor: hasErrors || isProcessing ? 'not-allowed' : 'pointer',
        }}
        onClick={onEvaluate}
        disabled={isProcessing || hasErrors}
      >
        {isProcessing ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14A6 6 0 118 2a6 6 0 010 12z" opacity="0.3"/>
            <path d="M8 2a6 6 0 016 6h-2a4 4 0 00-4-4V2z"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2l10 6-10 6V2z"/>
          </svg>
        )}{t('Simulate')}</button>
    </div>
  );
}
