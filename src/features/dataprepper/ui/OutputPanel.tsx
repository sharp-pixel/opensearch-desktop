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
 * Output Panel Component
 * Displays processing results, errors, and generated roles
 */

import React, { useState, useCallback, useMemo } from 'react';
import { WorkbenchEditor as Editor } from '../../../editor/WorkbenchEditor';
import { useTheme } from '../../../context/ThemeContext';
import type { ProcessingResult } from '../../../types/dataPrepper';
import type { GeneratedRole } from '../../../types/role';
import { formatRoleJson } from '../../../services/dataPrepperRoleGenerator';

interface OutputPanelProps {
  result: ProcessingResult | null;
  isProcessing: boolean;
  generatedRole: GeneratedRole | null;
  roleError: string | null;
  onGenerateRole: () => void;
}

type TabId = 'output' | 'metadata' | 'diff' | 'errors' | 'role';

function getResultMetadata(result: ProcessingResult) {
  return result.events.map(event => ({ event: event.index + 1, ...(event.outputMetadata ?? { attributes: {}, tags: [] }) }));
}

const getHeaderStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  borderBottom: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  backgroundColor: isDark ? '#252525' : '#fafbfd',
  height: '40px',
});

const getTabStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '8px 12px',
  fontSize: '13px',
  fontWeight: 500,
  color: isDark ? '#98a2b3' : '#69707d',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  marginBottom: '-1px',
  transition: 'all 0.15s ease',
});

const getTabActiveStyles = (isDark: boolean): React.CSSProperties => ({
  ...getTabStyles(isDark),
  color: isDark ? '#3b82f6' : '#006bb4',
  borderBottomColor: isDark ? '#3b82f6' : '#006bb4',
});

const getTabDisabledStyles = (isDark: boolean): React.CSSProperties => ({
  ...getTabStyles(isDark),
  color: isDark ? '#4a4a4a' : '#c5c9d1',
  cursor: 'not-allowed',
});

const contentStyles: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '12px',
  minHeight: 0,
};

const getEmptyStateStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: isDark ? '#98a2b3' : '#69707d',
  textAlign: 'center',
  padding: '24px',
});

const getEmptyIconStyles = (isDark: boolean): React.CSSProperties => ({
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  backgroundColor: isDark ? '#3c3c3c' : '#f5f7fa',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '12px',
});

const getStatsBarStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: `1px solid ${isDark ? '#3c3c3c' : '#eee'}`,
  marginBottom: '8px',
});

const getStatsTextStyles = (isDark: boolean): React.CSSProperties => ({
  fontSize: '12px',
  color: isDark ? '#98a2b3' : '#69707d',
});

const getCopyButtonStyles = (isDark: boolean): React.CSSProperties => ({
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

const getWarningBoxStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  backgroundColor: isDark ? '#3d3520' : '#fef6e6',
  border: `1px solid ${isDark ? '#8a6914' : '#f5c96a'}`,
  borderRadius: '4px',
  marginBottom: '8px',
});

const getErrorBoxStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  backgroundColor: isDark ? '#3d1f1f' : '#f8e9e9',
  border: `1px solid ${isDark ? '#bd271e' : '#f5a9a9'}`,
  borderRadius: '4px',
  marginBottom: '8px',
});

const getSuccessBoxStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  backgroundColor: isDark ? '#1a3d2a' : '#e6f9f0',
  border: `1px solid ${isDark ? '#1a9c6c' : '#7dcea0'}`,
  borderRadius: '4px',
});

const getAccordionStyles = (isDark: boolean): React.CSSProperties => ({
  border: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  borderRadius: '4px',
  marginBottom: '8px',
  overflow: 'hidden',
});

const getAccordionHeaderStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: isDark ? '#252525' : '#fafbfd',
  cursor: 'pointer',
  fontSize: '13px',
  color: isDark ? '#fff' : '#343741',
});

const getAccordionContentStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '12px',
  borderTop: `1px solid ${isDark ? '#3c3c3c' : '#d3dae6'}`,
  display: 'flex',
  gap: '12px',
});

const getCodeBlockStyles = (isDark: boolean): React.CSSProperties => ({
  flex: 1,
  backgroundColor: isDark ? '#1e1e1e' : '#f5f7fa',
  borderRadius: '4px',
  padding: '8px',
  fontSize: '11px',
  fontFamily: 'monospace',
  color: isDark ? '#d4d4d4' : '#343741',
  whiteSpace: 'pre-wrap',
  overflow: 'auto',
  maxHeight: '150px',
  border: isDark ? 'none' : '1px solid #d3dae6',
});

const getGenerateButtonStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 500,
  color: isDark ? '#3b82f6' : '#006bb4',
  backgroundColor: isDark ? '#1e3a5f' : '#e6f1fa',
  border: `1px solid ${isDark ? '#3b82f6' : '#006bb4'}`,
  borderRadius: '6px',
  cursor: 'pointer',
  marginTop: '12px',
});

const getTitleStyles = (isDark: boolean): React.CSSProperties => ({
  margin: '0 0 4px 0',
  fontWeight: 500,
  color: isDark ? '#fff' : '#343741',
});

const getSubtitleStyles = (isDark: boolean): React.CSSProperties => ({
  margin: 0,
  fontSize: '13px',
  color: isDark ? '#98a2b3' : '#69707d',
});

const getWarningTextColor = (isDark: boolean): string => isDark ? '#f5c96a' : '#8a6914';
const getErrorTextColor = (isDark: boolean): string => isDark ? '#f5a9a9' : '#bd271e';
const getSuccessTextColor = (isDark: boolean): string => isDark ? '#7dcea0' : '#1a9c6c';

const getBadgeStyles = (isDark: boolean): React.CSSProperties => ({
  padding: '2px 6px',
  fontSize: '10px',
  fontWeight: 500,
  color: isDark ? '#f5a9a9' : '#bd271e',
  backgroundColor: isDark ? '#3d1f1f' : '#f8e9e9',
  borderRadius: '8px',
  marginLeft: '4px',
});

const getFailedBadgeStyles = (isDark: boolean): React.CSSProperties => ({
  ...getBadgeStyles(isDark),
  marginLeft: '8px',
});

export function OutputPanel({
  result,
  isProcessing,
  generatedRole,
  roleError,
  onGenerateRole,
}: OutputPanelProps): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const [activeTab, setActiveTab] = useState<TabId>('output');
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  const handleCopyOutput = useCallback(() => {
    if (result) {
      const output = result.events.map((e) => e.output);
      navigator.clipboard.writeText(JSON.stringify(output, null, 2));
    }
  }, [result]);

  const handleCopyMetadata = useCallback(() => {
    if (result) navigator.clipboard.writeText(JSON.stringify(getResultMetadata(result), null, 2));
  }, [result]);

  const handleCopyRole = useCallback(() => {
    if (generatedRole) {
      navigator.clipboard.writeText(formatRoleJson(generatedRole));
    }
  }, [generatedRole]);

  const handleDownloadRole = useCallback(() => {
    if (generatedRole) {
      const json = formatRoleJson(generatedRole);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${generatedRole.roleName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [generatedRole]);

  const toggleEvent = useCallback((index: number) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const tabs: { id: TabId; name: string; disabled: boolean; badge?: number }[] = [
    { id: 'output', name: 'Output', disabled: false },
    { id: 'metadata', name: 'Metadata', disabled: !result },
    { id: 'diff', name: 'Diff', disabled: !result },
    { id: 'errors', name: 'Errors', disabled: false, badge: result?.errors.length },
    { id: 'role', name: 'Role', disabled: false },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={getHeaderStyles(isDark)}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={tab.disabled ? getTabDisabledStyles(isDark) : activeTab === tab.id ? getTabActiveStyles(isDark) : getTabStyles(isDark)}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
          >
            {t(tab.name)}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span style={getBadgeStyles(isDark)}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div style={contentStyles}>
        {isProcessing ? (
          <div style={getEmptyStateStyles(isDark)}>
            <div style={{ ...getEmptyIconStyles(isDark), animation: 'spin 1s linear infinite' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#3b82f6' : '#006bb4'} strokeWidth="2">
                <path d="M12 2v4m0 12v4m-8-10H2m20 0h-2m-2.93-6.07l-1.41 1.41m-9.32 9.32l-1.41 1.41m12.14 0l-1.41-1.41M6.34 6.34L4.93 4.93" />
              </svg>
            </div>
            <p style={{ margin: 0, fontWeight: 500, color: isDark ? '#fff' : '#343741' }}>{t('Processing...')}</p>
          </div>
        ) : (
          <>
            {activeTab === 'output' && <OutputTab result={result} onCopy={handleCopyOutput} />}
            {activeTab === 'metadata' && <OutputTab result={result} onCopy={handleCopyMetadata} showMetadata />}
            {activeTab === 'diff' && <DiffTab result={result} expandedEvents={expandedEvents} onToggle={toggleEvent} />}
            {activeTab === 'errors' && <ErrorsTab result={result} />}
            {activeTab === 'role' && (
              <RoleTab
                generatedRole={generatedRole}
                roleError={roleError}
                onGenerate={onGenerateRole}
                onCopy={handleCopyRole}
                onDownload={handleDownloadRole}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OutputTab({
  result,
  onCopy,
  showMetadata = false,
}: {
  result: ProcessingResult | null;
  onCopy: () => void;
  showMetadata?: boolean;
}): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  
  if (!result) {
    return (
      <div style={getEmptyStateStyles(isDark)}>
        <div style={getEmptyIconStyles(isDark)}>
          <svg width="24" height="24" viewBox="0 0 16 16" fill="#98a2b3">
            <path d="M4 2l10 6-10 6V2z" />
          </svg>
        </div>
        <p style={getTitleStyles(isDark)}>{t('No output yet')}</p>
        <p style={getSubtitleStyles(isDark)}>{t('Click "Simulate" to process your source data through the pipeline.')}</p>
      </div>
    );
  }

  const outputJson = JSON.stringify(showMetadata ? getResultMetadata(result) : result.events.map((e) => e.output), null, 2);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={getStatsBarStyles(isDark)}>
        <span style={getStatsTextStyles(isDark)}>
          {result.stats.totalEvents}{' '}{t('input events →')}{' '}{result.events.length}{' '}{t('output events in')}{' '}{result.stats.processingTimeMs.toFixed(2)}ms
          {result.stats.failedEvents > 0 && (
            <span style={getFailedBadgeStyles(isDark)}>{result.stats.failedEvents}{' '}{t('failed')}</span>
          )}
        </span>
        <button style={getCopyButtonStyles(isDark)} onClick={onCopy}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V2zm2-1a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V2a1 1 0 00-1-1H6zM2 5a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-1h1v1a2 2 0 01-2 2H2a2 2 0 01-2-2V6a2 2 0 012-2h1v1H2z"/>
          </svg>{t('Copy')}</button>
      </div>

      {result.warnings.length > 0 && (
        <div style={getWarningBoxStyles(isDark)}>
          <strong style={{ fontSize: '12px', color: getWarningTextColor(isDark) }}>{t('Warnings')}</strong>
          {result.warnings.map((w, i) => (
            <p key={i} style={{ margin: '4px 0 0 0', fontSize: '12px', color: getWarningTextColor(isDark) }}>{w}</p>
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language="json"
          value={outputJson}

          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}

function DiffTab({
  result,
  expandedEvents,
  onToggle,
}: {
  result: ProcessingResult | null;
  expandedEvents: Set<number>;
  onToggle: (index: number) => void;
}): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  if (!result || result.events.length === 0) {
    return (
      <div style={getEmptyStateStyles(isDark)}>
        <div style={getEmptyIconStyles(isDark)}>
          <svg width="24" height="24" viewBox="0 0 16 16" fill="#98a2b3">
            <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
          </svg>
        </div>
        <p style={getTitleStyles(isDark)}>{t('No diff available')}</p>
        <p style={getSubtitleStyles(isDark)}>{t('Process some data to see the input/output diff.')}</p>
      </div>
    );
  }

  return (
    <div>
      {result.events.map((event, index) => (
        <div key={index} style={getAccordionStyles(isDark)}>
          <div style={getAccordionHeaderStyles(isDark)} onClick={() => onToggle(index)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill={isDark ? '#98a2b3' : '#69707d'}
                style={{ transform: expandedEvents.has(index) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
              >
                <path d="M6 4l4 4-4 4V4z" />
              </svg>
              <span style={{ fontWeight: 500 }}>{t('Event')}{' '}{index + 1}</span>
              {event.appliedProcessors.length > 0 && (
                <span style={{ fontSize: '11px', color: isDark ? '#98a2b3' : '#69707d' }}>
                  ({event.appliedProcessors.join(' → ')})
                </span>
              )}
            </div>
            {event.error && <span style={getBadgeStyles(isDark)}>{t('Error')}</span>}
          </div>
          {expandedEvents.has(index) && (
            <div style={getAccordionContentStyles(isDark)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 500, marginBottom: '4px', color: isDark ? '#98a2b3' : '#69707d' }}>{t('Input')}</div>
                <pre style={getCodeBlockStyles(isDark)}>{event.input === null ? t('Input association unavailable') : JSON.stringify(event.input, null, 2)}</pre>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 500, marginBottom: '4px', color: isDark ? '#98a2b3' : '#69707d' }}>{t('Output')}</div>
                <pre style={getCodeBlockStyles(isDark)}>{JSON.stringify(event.output, null, 2)}</pre>
                {event.outputMetadata && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 500, margin: '8px 0 4px', color: isDark ? '#98a2b3' : '#69707d' }}>{t('Metadata')}</div>
                    <pre style={getCodeBlockStyles(isDark)}>{JSON.stringify(event.outputMetadata, null, 2)}</pre>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ErrorsTab({ result }: { result: ProcessingResult | null }): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  if (!result) {
    return (
      <div style={getEmptyStateStyles(isDark)}>
        <div style={getEmptyIconStyles(isDark)}>
          <svg width="24" height="24" viewBox="0 0 16 16" fill="#98a2b3">
            <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0-1A6 6 0 108 2a6 6 0 000 12zM8 4a.5.5 0 01.5.5v3a.5.5 0 01-1 0v-3A.5.5 0 018 4zm0 6a.5.5 0 110 1 .5.5 0 010-1z"/>
          </svg>
        </div>
        <p style={getTitleStyles(isDark)}>{t('No errors')}</p>
        <p style={getSubtitleStyles(isDark)}>{t('Process some data to see any errors.')}</p>
      </div>
    );
  }

  if (result.errors.length === 0) {
    return (
      <div style={getSuccessBoxStyles(isDark)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill={getSuccessTextColor(isDark)}>
            <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm3.354-9.354a.5.5 0 00-.708 0L7 9.293 5.354 7.646a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4a.5.5 0 000-.708z"/>
          </svg>
          <span style={{ fontWeight: 500, color: getSuccessTextColor(isDark) }}>{t('All events processed successfully')}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {result.errors.map((error, index) => (
        <div key={index} style={getErrorBoxStyles(isDark)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill={getErrorTextColor(isDark)}>
              <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0-1A6 6 0 108 2a6 6 0 000 12zM8 4a.5.5 0 01.5.5v3a.5.5 0 01-1 0v-3A.5.5 0 018 4zm0 6a.5.5 0 110 1 .5.5 0 010-1z"/>
            </svg>
            <span style={{ fontWeight: 500, fontSize: '13px', color: getErrorTextColor(isDark) }}>{t('Event')}{' '}{error.eventIndex + 1}: {error.processor}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: getErrorTextColor(isDark) }}>{error.message}</p>
        </div>
      ))}
    </div>
  );
}

function RoleTab({
  generatedRole,
  roleError,
  onGenerate,
  onCopy,
  onDownload,
}: {
  generatedRole: GeneratedRole | null;
  roleError: string | null;
  onGenerate: () => void;
  onCopy: () => void;
  onDownload: () => void;
}): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const roleJson = useMemo(() => {
    return generatedRole ? formatRoleJson(generatedRole) : '';
  }, [generatedRole]);

  if (roleError) {
    return (
      <div>
        <div style={getWarningBoxStyles(isDark)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill={getWarningTextColor(isDark)}>
              <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0-1A6 6 0 108 2a6 6 0 000 12zM8 4a.5.5 0 01.5.5v3a.5.5 0 01-1 0v-3A.5.5 0 018 4zm0 6a.5.5 0 110 1 .5.5 0 010-1z"/>
            </svg>
            <span style={{ fontWeight: 500, fontSize: '13px', color: getWarningTextColor(isDark) }}>{t('Cannot generate role')}</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: getWarningTextColor(isDark) }}>{roleError}</p>
        </div>
        <button style={getGenerateButtonStyles(isDark)} onClick={onGenerate}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.534 7h3.932a.25.25 0 01.192.41l-1.966 2.36a.25.25 0 01-.384 0l-1.966-2.36a.25.25 0 01.192-.41zm-11 2h3.932a.25.25 0 00.192-.41L2.692 6.23a.25.25 0 00-.384 0L.342 8.59A.25.25 0 00.534 9z"/>
            <path d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 11-.771-.636A6.002 6.002 0 0113.917 7H12.9A5.002 5.002 0 008 3zM3.1 9a5.002 5.002 0 008.757 2.182.5.5 0 11.771.636A6.002 6.002 0 012.083 9H3.1z"/>
          </svg>{t('Try Again')}</button>
      </div>
    );
  }

  if (!generatedRole) {
    return (
      <div style={getEmptyStateStyles(isDark)}>
        <div style={getEmptyIconStyles(isDark)}>
          <svg width="24" height="24" viewBox="0 0 16 16" fill="#98a2b3">
            <path d="M8 0L1 3v5c0 4.4 3 8.5 7 10 4-1.5 7-5.6 7-10V3L8 0zm0 2l5 2v4c0 3.3-2.2 6.4-5 7.7-2.8-1.3-5-4.4-5-7.7V4l5-2z"/>
          </svg>
        </div>
        <p style={getTitleStyles(isDark)}>{t('Generate Security Role')}</p>
        <p style={{ ...getSubtitleStyles(isDark), marginBottom: '12px', maxWidth: '300px' }}>{t('Generate an OpenSearch security role based on the pipeline\'s sink configurations.')}</p>
        <button style={getGenerateButtonStyles(isDark)} onClick={onGenerate}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0L1 3v5c0 4.4 3 8.5 7 10 4-1.5 7-5.6 7-10V3L8 0zm0 2l5 2v4c0 3.3-2.2 6.4-5 7.7-2.8-1.3-5-4.4-5-7.7V4l5-2z"/>
          </svg>{t('Generate Role')}</button>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={getStatsBarStyles(isDark)}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: isDark ? '#fff' : '#343741' }}>{generatedRole.roleName}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={getCopyButtonStyles(isDark)} onClick={onCopy}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V2zm2-1a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V2a1 1 0 00-1-1H6zM2 5a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-1h1v1a2 2 0 01-2 2H2a2 2 0 01-2-2V6a2 2 0 012-2h1v1H2z"/>
            </svg>{t('Copy')}</button>
          <button style={getCopyButtonStyles(isDark)} onClick={onDownload}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 12L4 8h3V4h2v4h3l-4 4zm6-3v5H2V9H1v6h14V9h-1z" />
            </svg>{t('Download')}</button>
          <button style={getCopyButtonStyles(isDark)} onClick={onGenerate}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.534 7h3.932a.25.25 0 01.192.41l-1.966 2.36a.25.25 0 01-.384 0l-1.966-2.36a.25.25 0 01.192-.41zm-11 2h3.932a.25.25 0 00.192-.41L2.692 6.23a.25.25 0 00-.384 0L.342 8.59A.25.25 0 00.534 9z"/>
              <path d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 11-.771-.636A6.002 6.002 0 0113.917 7H12.9A5.002 5.002 0 008 3zM3.1 9a5.002 5.002 0 008.757 2.182.5.5 0 11.771.636A6.002 6.002 0 012.083 9H3.1z"/>
            </svg>{t('Regenerate')}</button>
        </div>
      </div>

      <div style={{ ...getSuccessBoxStyles(isDark), marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: getSuccessTextColor(isDark) }}>
          <strong>{t('Cluster Permissions (')}{generatedRole.roleDefinition.cluster_permissions.length}):</strong>
          <div style={{ marginLeft: '12px', marginTop: '4px' }}>
            {generatedRole.roleDefinition.cluster_permissions.map((p, i) => (
              <div key={i} style={{ fontFamily: 'monospace', fontSize: '11px' }}>• {p}</div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: getSuccessTextColor(isDark), marginTop: '8px' }}>
          <strong>{t('Index Permissions:')}</strong>
          {generatedRole.roleDefinition.index_permissions.map((ip, i) => (
            <div key={i} style={{ marginLeft: '12px', marginTop: '4px', paddingBottom: '4px', borderBottom: i < generatedRole.roleDefinition.index_permissions.length - 1 ? `1px solid ${isDark ? '#2e5a3a' : '#c8e6c9'}` : 'none' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 500 }}>
                {ip.index_patterns.join(', ')}
              </div>
              <div style={{ marginLeft: '8px', marginTop: '2px' }}>
                {ip.allowed_actions.map((a, j) => (
                  <div key={j} style={{ fontFamily: 'monospace', fontSize: '10px', color: isDark ? '#7dcea0' : '#2e7d32' }}>• {a}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language="json"
          value={roleJson}

          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
