// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
/**
 * ChartTypeBar component for selecting chart type
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.7
 */

import React from 'react';
import { useTheme } from '../../../../context/ThemeContext';
import type { ChartType, ChartTypeOption } from '../../../../types/chart';

interface ChartTypeBarProps {
  options: ChartTypeOption[];
  selectedType: ChartType;
  onTypeChange: (type: ChartType) => void;
}

export function ChartTypeBar({
  options,
  selectedType,
  onTypeChange,
}: ChartTypeBarProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    padding: '8px 0',
    borderBottom: `1px solid ${theme.border}`,
    marginBottom: '12px',
  };

  const buttonStyle = (isSelected: boolean, isEnabled: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 16px',
    border: `1px solid ${isSelected ? theme.primary : theme.border}`,
    borderRadius: '6px',
    backgroundColor: isSelected ? theme.primaryLight : 'transparent',
    color: isEnabled ? (isSelected ? theme.primary : theme.text) : theme.textMuted,
    cursor: isEnabled ? 'pointer' : 'not-allowed',
    opacity: isEnabled ? 1 : 0.5,
    transition: 'all 0.15s ease',
    position: 'relative',
    minWidth: '70px',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 500,
  };

  const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    backgroundColor: theme.success,
    color: '#fff',
    fontSize: '9px',
    fontWeight: 600,
    padding: '2px 4px',
    borderRadius: '3px',
    textTransform: 'uppercase',
  };

  return (
    <div style={containerStyle}>
      {options.map((option) => (
        <button
          key={option.type}
          style={buttonStyle(selectedType === option.type, option.enabled)}
          onClick={() => option.enabled && onTypeChange(option.type)}
          disabled={!option.enabled}
          title={t(option.enabled ? option.label : option.disabledReason ?? '')}
        >
          {option.recommended && <span style={badgeStyle}>{t('Rec')}</span>}
          <ChartTypeIcon type={option.type} />
          <span style={labelStyle}>{t(option.label)}</span>
        </button>
      ))}
    </div>
  );
}

interface ChartTypeIconProps {
  type: ChartType;
}

function ChartTypeIcon({ type }: ChartTypeIconProps): React.ReactElement {
  useLanguage();
  const iconProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
  };

  switch (type) {
    case 'pie':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v9l6.36 3.68" />
        </svg>
      );
    case 'bar':
      return (
        <svg {...iconProps}>
          <rect x="3" y="12" width="4" height="9" rx="1" />
          <rect x="10" y="8" width="4" height="13" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </svg>
      );
    case 'histogram':
      return (
        <svg {...iconProps}>
          <polyline points="3 17 9 11 13 15 21 7" />
          <polyline points="14 7 21 7 21 14" />
        </svg>
      );
    case 'map':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="10" r="3" />
          <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
        </svg>
      );
  }
}

export default ChartTypeBar;
