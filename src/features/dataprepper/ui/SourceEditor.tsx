// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
/**
 * Source Editor Component
 * Monaco-based editor for input data with format selection
 */

import React, { useCallback } from 'react';
import { WorkbenchEditor as Editor } from '../../../editor/WorkbenchEditor';
import { useTheme } from '../../../context/ThemeContext';
import type { SourceFormat, ValidationError } from '../../../types/dataPrepper';

interface SourceEditorProps {
  value: string;
  format: SourceFormat;
  errors: ValidationError[];
  onChange: (value: string) => void;
  onFormatChange: (format: SourceFormat) => void;
  onLoadTemplate: (template: 'logs' | 'metrics' | 'traces') => void;
}

const FORMAT_OPTIONS: { value: SourceFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'jsonl', label: 'JSON Lines' },
  { value: 'csv', label: 'CSV' },
];

const LANGUAGE_MAP: Record<SourceFormat, string> = {
  json: 'json',
  jsonl: 'json',
  csv: 'plaintext',
};

const getHeaderStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  borderBottom: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  backgroundColor: isDark ? '#252525' : '#fafbfd',
});

const titleStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const getLabelStyles = (isDark: boolean): React.CSSProperties => ({
  fontSize: '14px',
  fontWeight: 600,
  color: isDark ? '#fff' : '#1a1c21',
});

const getSelectStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '4px 8px',
  fontSize: '12px',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  borderRadius: '4px',
  backgroundColor: isDark ? '#1e1e1e' : '#fff',
  color: isDark ? '#fff' : '#343741',
  cursor: 'pointer',
});

const actionsStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const getTemplateButtonStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  fontSize: '12px',
  fontWeight: 500,
  color: isDark ? '#3b82f6' : '#006bb4',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
});

const getBadgeStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '2px 8px',
  fontSize: '11px',
  fontWeight: 500,
  color: isDark ? '#ef4444' : '#bd271e',
  backgroundColor: isDark ? '#3d1f1f' : '#f8e9e9',
  borderRadius: '10px',
});

const editorContainerStyles: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
};

const getDropdownStyles = (isDark: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: '4px',
  backgroundColor: isDark ? '#2d2d2d' : '#fff',
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  borderRadius: '6px',
  boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
  zIndex: 100,
  minWidth: '140px',
  overflow: 'hidden',
});

const getDropdownItemStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  fontSize: '13px',
  color: isDark ? '#fff' : '#343741',
  backgroundColor: 'transparent',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
});

export function SourceEditor({
  value,
  format,
  errors,
  onChange,
  onFormatChange,
  onLoadTemplate,
}: SourceEditorProps): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const [isTemplateOpen, setIsTemplateOpen] = React.useState(false);
  const templateRef = React.useRef<HTMLDivElement>(null);

  const handleEditorChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue || '');
    },
    [onChange]
  );

  const handleFormatChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFormatChange(e.target.value as SourceFormat);
    },
    [onFormatChange]
  );

  const handleTemplateSelect = useCallback(
    (template: 'logs' | 'metrics' | 'traces') => {
      onLoadTemplate(template);
      setIsTemplateOpen(false);
    },
    [onLoadTemplate]
  );

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(event.target as Node)) {
        setIsTemplateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const hoverBg = isDark ? '#3c3c3c' : '#f5f7fa';

  return (
    <>
      <div style={getHeaderStyles(isDark)}>
        <div style={titleStyles}>
          <span style={getLabelStyles(isDark)}>{t('Source Data')}</span>
          <select
            style={getSelectStyles(isDark)}
            value={format}
            onChange={handleFormatChange}
            aria-label={t('Source format')}
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
        </div>
        
        <div style={actionsStyles}>
          <div ref={templateRef} style={{ position: 'relative' }}>
            <button
              style={getTemplateButtonStyles(isDark)}
              onClick={() => setIsTemplateOpen(!isTemplateOpen)}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2h5.5L14 4.5zM4 1a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5H9.5A1.5 1.5 0 018 3.5V1H4zm5 0v2.5a.5.5 0 00.5.5H12L9 1z"/>
              </svg>{t('Templates')}</button>
            {isTemplateOpen && (
              <div style={getDropdownStyles(isDark)}>
                <button
                  style={getDropdownItemStyles(isDark)}
                  onClick={() => handleTemplateSelect('logs')}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >{t('Log Events')}</button>
                <button
                  style={getDropdownItemStyles(isDark)}
                  onClick={() => handleTemplateSelect('metrics')}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >{t('Metrics')}</button>
                <button
                  style={getDropdownItemStyles(isDark)}
                  onClick={() => handleTemplateSelect('traces')}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >{t('Traces')}</button>
              </div>
            )}
          </div>
          
          {errorCount > 0 && (
            <span style={getBadgeStyles(isDark)}>
              {t(errorCount === 1 ? '{count} error' : '{count} errors', { count: errorCount })}
            </span>
          )}
        </div>
      </div>

      <div style={editorContainerStyles}>
        <Editor
          height="100%"
          language={LANGUAGE_MAP[format]}
          value={value}
          onChange={handleEditorChange}

          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 8 },
          }}
        />
      </div>
    </>
  );
}
