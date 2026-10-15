// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
import { useEditorMarkers } from '../../../editor/useEditorMarkers';
/**
 * Policy Editor Component
 * Monaco-based JSON editor for ISM policy configuration
 */

import React, { useCallback, useRef, useEffect } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { WorkbenchEditor as Editor } from '../../../editor/WorkbenchEditor';
import { registerScopedCompletions, jsonEditorCompletionProvider } from '../../../services/editorCompletions';
import { useTheme } from '../../../context/ThemeContext';
import type { ValidationError } from '../../../types/ism';

interface PolicyEditorProps {
  value: string;
  errors: ValidationError[];
  onChange: (value: string) => void;
  onLoadTemplate: (template: 'hot-warm-cold' | 'rollover-delete' | 'snapshot') => void;
}

export function PolicyEditor({
  value,
  errors,
  onChange,
  onLoadTemplate,
}: PolicyEditorProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const [isTemplateOpen, setIsTemplateOpen] = React.useState(false);
  const templateRef = useRef<HTMLDivElement>(null);
  const mountMarkers = useEditorMarkers('ism-validator', errors);

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderBottom: `1px solid ${theme.border}`,
    backgroundColor: theme.backgroundSecondary,
  };

  const titleStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const labelStyles: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.text,
  };

  const formatLabelStyles: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 500,
    color: theme.textMuted,
    backgroundColor: theme.borderLight,
    padding: '2px 6px',
    borderRadius: '3px',
  };

  const actionsStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const templateButtonStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    fontWeight: 500,
    color: theme.primary,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  };

  const errorBadgeStyles: React.CSSProperties = {
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 500,
    color: theme.error,
    backgroundColor: theme.errorLight,
    borderRadius: '10px',
  };

  const warningBadgeStyles: React.CSSProperties = {
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 500,
    color: theme.warning,
    backgroundColor: theme.warningLight,
    borderRadius: '10px',
  };

  const editorContainerStyles: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
  };

  const dropdownStyles: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '4px',
    backgroundColor: theme.backgroundTertiary,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: 100,
    minWidth: '180px',
    overflow: 'hidden',
  };

  const dropdownItemStyles: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    color: theme.textSecondary,
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
  };

  const handleEditorChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue || '');
    },
    [onChange]
  );

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    mountMarkers(editor, monaco);
    registerScopedCompletions(monaco, editor, 'json', jsonEditorCompletionProvider(monaco, 'ism'));
  }, [mountMarkers]);



  const loadTemplate = useCallback((template: 'hot-warm-cold' | 'rollover-delete' | 'snapshot') => {
    onLoadTemplate(template);
    setIsTemplateOpen(false);
  }, [onLoadTemplate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(event.target as Node)) {
        setIsTemplateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;

  return (
    <>
      <div style={headerStyles}>
        <div style={titleStyles}>
          <span style={labelStyles}>{t('ISM Policy')}</span>
          <span style={formatLabelStyles}>JSON</span>
        </div>
        
        <div style={actionsStyles}>
          <div ref={templateRef} style={{ position: 'relative' }}>
            <button
              style={templateButtonStyles}
              onClick={() => setIsTemplateOpen(!isTemplateOpen)}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2h5.5L14 4.5zM4 1a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5H9.5A1.5 1.5 0 018 3.5V1H4zm5 0v2.5a.5.5 0 00.5.5H12L9 1z"/>
              </svg>{t('Templates')}</button>
            {isTemplateOpen && (
              <div style={dropdownStyles}>
                <button
                  style={dropdownItemStyles}
                  onClick={() => loadTemplate('hot-warm-cold')}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >{t('Hot-Warm-Cold Lifecycle')}</button>
                <button
                  style={dropdownItemStyles}
                  onClick={() => loadTemplate('rollover-delete')}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >{t('Rollover & Delete')}</button>
                <button
                  style={dropdownItemStyles}
                  onClick={() => loadTemplate('snapshot')}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >{t('Snapshot Before Delete')}</button>
              </div>
            )}
          </div>
          
          {errorCount > 0 && (
            <span style={errorBadgeStyles}>
              {t(errorCount === 1 ? '{count} error' : '{count} errors', { count: errorCount })}
            </span>
          )}
          {warningCount > 0 && (
            <span style={warningBadgeStyles}>
              {t(warningCount === 1 ? '{count} warning' : '{count} warnings', { count: warningCount })}
            </span>
          )}
        </div>
      </div>

      <div style={editorContainerStyles}>
        <Editor
          height="100%"
          language="json"
          value={value}
          onChange={handleEditorChange}
          onMount={handleEditorMount}

          options={{
            quickSuggestions: { other: true, strings: true, comments: false },
            suggestOnTriggerCharacters: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 8 },
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
    </>
  );
}
