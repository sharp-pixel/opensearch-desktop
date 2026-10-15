// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
/**
 * Analysis Panel Component
 * Displays policy analysis results with severity levels
 */

import React from 'react';
import { useTheme } from '../../../context/ThemeContext';
import type { AnalysisResult } from '../../../types/ism';

interface AnalysisPanelProps {
  results: AnalysisResult[];
  onResultClick: (result: AnalysisResult) => void;
}

export function AnalysisPanel({
  results,
  onResultClick,
}: AnalysisPanelProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.background,
    color: theme.textSecondary,
  };

  const summaryStyles: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    borderBottom: `1px solid ${theme.border}`,
  };

  const summaryItemStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
  };

  const countBadgeStyles = (color: string): React.CSSProperties => ({
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: color,
    color: '#fff',
  });

  const resultsContainerStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
  };

  const resultGroupStyles: React.CSSProperties = {
    marginBottom: '16px',
  };

  const groupTitleStyles: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: theme.textMuted,
    marginBottom: '8px',
    letterSpacing: '0.5px',
  };

  const resultItemStyles: React.CSSProperties = {
    padding: '10px 12px',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '6px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  };

  const resultHeaderStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  };

  const severityIconStyles = (severity: string): React.CSSProperties => ({
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 700,
    backgroundColor: severity === 'error' ? theme.error : 
                     severity === 'warning' ? theme.warning : theme.info,
    color: '#fff',
  });

  const messageStyles: React.CSSProperties = {
    fontSize: '13px',
    color: theme.text,
    fontWeight: 500,
  };

  const detailsStyles: React.CSSProperties = {
    fontSize: '12px',
    color: theme.textMuted,
    marginTop: '4px',
  };

  const stateTagStyles: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 6px',
    fontSize: '10px',
    backgroundColor: theme.primaryLight,
    color: theme.primary,
    borderRadius: '3px',
    marginLeft: '8px',
  };

  const emptyStateStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.textMuted,
    textAlign: 'center',
    padding: '24px',
  };

  const successIconStyles: React.CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: theme.success,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  };
  const errors = results.filter(r => r.severity === 'error');
  const warnings = results.filter(r => r.severity === 'warning');
  const infos = results.filter(r => r.severity === 'info');

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'error': return '✕';
      case 'warning': return '!';
      default: return 'i';
    }
  };

  if (results.length === 0) {
    return (
      <div style={containerStyles}>
        <div style={emptyStateStyles}>
          <div style={successIconStyles}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: theme.text, marginBottom: '4px' }}>{t('No issues found')}</div>
          <div style={{ fontSize: '12px' }}>{t('Your ISM policy looks good!')}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      <div style={summaryStyles}>
        <div style={summaryItemStyles}>
          <span style={countBadgeStyles('#ef4444')}>{errors.length}</span>
          <span>{t('Errors')}</span>
        </div>
        <div style={summaryItemStyles}>
          <span style={countBadgeStyles('#f59e0b')}>{warnings.length}</span>
          <span>{t('Warnings')}</span>
        </div>
        <div style={summaryItemStyles}>
          <span style={countBadgeStyles('#3b82f6')}>{infos.length}</span>
          <span>{t('Info')}</span>
        </div>
      </div>

      <div style={resultsContainerStyles}>
        {errors.length > 0 && (
          <div style={resultGroupStyles}>
            <div style={groupTitleStyles}>{t('Errors')}</div>
            {errors.map((result, index) => (
              <div
                key={`error-${index}`}
                style={resultItemStyles}
                onClick={() => onResultClick(result)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = theme.backgroundSecondary)}
              >
                <div style={resultHeaderStyles}>
                  <div style={severityIconStyles('error')}>{getSeverityIcon('error')}</div>
                  <span style={messageStyles}>{result.message}</span>
                  {result.stateName && <span style={stateTagStyles}>{result.stateName}</span>}
                </div>
                {result.details && <div style={detailsStyles}>{result.details}</div>}
              </div>
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <div style={resultGroupStyles}>
            <div style={groupTitleStyles}>{t('Warnings')}</div>
            {warnings.map((result, index) => (
              <div
                key={`warning-${index}`}
                style={resultItemStyles}
                onClick={() => onResultClick(result)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = theme.backgroundSecondary)}
              >
                <div style={resultHeaderStyles}>
                  <div style={severityIconStyles('warning')}>{getSeverityIcon('warning')}</div>
                  <span style={messageStyles}>{result.message}</span>
                  {result.stateName && <span style={stateTagStyles}>{result.stateName}</span>}
                </div>
                {result.details && <div style={detailsStyles}>{result.details}</div>}
              </div>
            ))}
          </div>
        )}

        {infos.length > 0 && (
          <div style={resultGroupStyles}>
            <div style={groupTitleStyles}>{t('Information')}</div>
            {infos.map((result, index) => (
              <div
                key={`info-${index}`}
                style={resultItemStyles}
                onClick={() => onResultClick(result)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = theme.backgroundSecondary)}
              >
                <div style={resultHeaderStyles}>
                  <div style={severityIconStyles('info')}>{getSeverityIcon('info')}</div>
                  <span style={messageStyles}>{result.message}</span>
                  {result.stateName && <span style={stateTagStyles}>{result.stateName}</span>}
                </div>
                {result.details && <div style={detailsStyles}>{result.details}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
