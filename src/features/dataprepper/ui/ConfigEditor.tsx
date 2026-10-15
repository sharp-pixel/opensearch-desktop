// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
import { useEditorMarkers } from '../../../editor/useEditorMarkers';
/**
 * Config Editor Component
 * Monaco-based YAML editor for pipeline configuration
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { WorkbenchEditor as Editor } from '../../../editor/WorkbenchEditor';
import { useTheme } from '../../../context/ThemeContext';
import type { ValidationError } from '../../../types/dataPrepper';

interface ConfigEditorProps {
  value: string;
  errors: ValidationError[];
  onChange: (value: string) => void;
}

const PIPELINE_TEMPLATES = {
  basic: `my-pipeline:
  processor:
    - add_entries:
        entries:
          - key: processed
            value: true
  sink:
    - opensearch:
        index: my-index
        hosts:
          - https://localhost:9200
`,
  grok: `log-pipeline:
  processor:
    - grok:
        match:
          message:
            - "%{COMMONAPACHELOG}"
    - date:
        match:
          - key: timestamp
            patterns:
              - "dd/MMM/yyyy:HH:mm:ss Z"
        destination: "@timestamp"
  sink:
    - opensearch:
        index: logs-%{yyyy.MM.dd}
        hosts:
          - https://localhost:9200
`,
  transform: `transform-pipeline:
  processor:
    - rename_keys:
        entries:
          - from_key: old_field
            to_key: new_field
    - delete_entries:
        with_keys:
          - temp_field
    - mutate:
        lowercase:
          - status
        convert:
          count: integer
  sink:
    - opensearch:
        index: transformed-data
        hosts:
          - https://localhost:9200
`,
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

const getFormatLabelStyles = (isDark: boolean): React.CSSProperties => ({
  fontSize: '11px',
  fontWeight: 500,
  color: isDark ? '#98a2b3' : '#69707d',
  backgroundColor: isDark ? '#3c3c3c' : '#e9edf3',
  padding: '2px 6px',
  borderRadius: '3px',
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

const getErrorBadgeStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '2px 8px',
  fontSize: '11px',
  fontWeight: 500,
  color: isDark ? '#ef4444' : '#bd271e',
  backgroundColor: isDark ? '#3d1f1f' : '#f8e9e9',
  borderRadius: '10px',
});

const getWarningBadgeStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '2px 8px',
  fontSize: '11px',
  fontWeight: 500,
  color: isDark ? '#f59e0b' : '#8a6914',
  backgroundColor: isDark ? '#3d3520' : '#fef6e6',
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
  minWidth: '160px',
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

export function ConfigEditor({
  value,
  errors,
  onChange,
}: ConfigEditorProps): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const [isTemplateOpen, setIsTemplateOpen] = React.useState(false);
  const templateRef = useRef<HTMLDivElement>(null);
  const mountMarkers = useEditorMarkers('pipeline-validator', errors);

  const handleEditorChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue || '');
    },
    [onChange]
  );

  const handleEditorMount = mountMarkers;



  const loadTemplate = useCallback((template: keyof typeof PIPELINE_TEMPLATES) => {
    onChange(PIPELINE_TEMPLATES[template]);
    setIsTemplateOpen(false);
  }, [onChange]);

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
  const hoverBg = isDark ? '#3c3c3c' : '#f5f7fa';

  return (
    <>
      <div style={getHeaderStyles(isDark)}>
        <div style={titleStyles}>
          <span style={getLabelStyles(isDark)}>{t('Pipeline Config')}</span>
          <span style={getFormatLabelStyles(isDark)}>YAML</span>
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
                  onClick={() => loadTemplate('basic')}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >{t('Basic Pipeline')}</button>
                <button
                  style={getDropdownItemStyles(isDark)}
                  onClick={() => loadTemplate('grok')}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >{t('Grok Log Parsing')}</button>
                <button
                  style={getDropdownItemStyles(isDark)}
                  onClick={() => loadTemplate('transform')}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >{t('Field Transformation')}</button>
              </div>
            )}
          </div>
          
          {errorCount > 0 && (
            <span style={getErrorBadgeStyles(isDark)}>
              {t(errorCount === 1 ? '{count} error' : '{count} errors', { count: errorCount })}
            </span>
          )}
          {warningCount > 0 && (
            <span style={getWarningBadgeStyles(isDark)}>
              {t(warningCount === 1 ? '{count} warning' : '{count} warnings', { count: warningCount })}
            </span>
          )}
        </div>
      </div>

      <div style={editorContainerStyles}>
        <Editor
          height="100%"
          language="yaml"
          value={value}
          onChange={handleEditorChange}
          onMount={handleEditorMount}

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
