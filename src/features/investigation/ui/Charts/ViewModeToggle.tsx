// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
/**
 * ViewModeToggle component for switching between table and chart views
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

import React from 'react';
import { useTheme } from '../../../../context/ThemeContext';
import type { ViewMode } from '../../../../types/chart';

interface ViewModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  chartEnabled: boolean;
  disabledReason?: string;
}

export function ViewModeToggle({
  mode,
  onModeChange,
  chartEnabled,
  disabledReason,
}: ViewModeToggleProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();

  const buttonStyle = (isActive: boolean, isDisabled: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 500,
    border: 'none',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    backgroundColor: isActive ? theme.primary : 'transparent',
    color: isActive ? '#fff' : isDisabled ? theme.textMuted : theme.text,
    opacity: isDisabled ? 0.5 : 1,
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  });

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    borderRadius: '4px',
    border: `1px solid ${theme.border}`,
    overflow: 'hidden',
    backgroundColor: theme.backgroundSecondary,
  };

  const handleChartClick = () => {
    if (chartEnabled) {
      onModeChange('chart');
    }
  };

  return (
    <div style={containerStyle}>
      <button
        style={{
          ...buttonStyle(mode === 'table', false),
          borderRadius: '3px 0 0 3px',
        }}
        onClick={() => onModeChange('table')}
        title={t('View as table')}
      >
        <TableIcon />{t('Table')}</button>
      <button
        style={{
          ...buttonStyle(mode === 'chart', !chartEnabled),
          borderRadius: '0 3px 3px 0',
          borderLeft: `1px solid ${theme.border}`,
        }}
        onClick={handleChartClick}
        disabled={!chartEnabled}
        title={chartEnabled ? t('View as chart') : disabledReason || t('Chart view not available')}
      >
        <ChartIcon />{t('Chart')}</button>
    </div>
  );
}

function TableIcon(): React.ReactElement {
  useLanguage();
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

function ChartIcon(): React.ReactElement {
  useLanguage();
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

export default ViewModeToggle;
