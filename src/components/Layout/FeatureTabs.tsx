// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
//
// Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.

import { t, useLanguage } from '../../i18n';
/**
 * Feature Tabs Component
 * Shared navigation tabs for switching between features
 * Add new features here to have them appear in all toolbars
 */

/* eslint-disable react-refresh/only-export-components */

import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export type ActiveFeature = 'notebook' | 'dataprepper' | 'ism' | 'investigation';

export interface FeatureConfig {
  id: ActiveFeature;
  label: string;
  icon: React.ReactNode;
}

/**
 * Central list of all features - add new features here
 */
export const FEATURES: FeatureConfig[] = [
  {
    id: 'notebook',
    label: 'Notebook',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3 1h10a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V3a2 2 0 012-2zm0 1a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1H3zm1 2h8v1H4V4zm0 3h8v1H4V7zm0 3h5v1H4v-1z"/>
      </svg>
    ),
  },
  {
    id: 'investigation',
    label: 'Investigation',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
      </svg>
    ),
  },
  {
    id: 'dataprepper',
    label: 'Data Prepper',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 4h3v2H2V4zm0 3h5v2H2V7zm0 3h3v2H2v-2zm12-6h-5v2h5V4zm0 3h-7v2h7V7zm0 3h-5v2h5v-2z"/>
      </svg>
    ),
  },
  {
    id: 'ism',
    label: 'ISM Analyzer',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-3a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 100-2H9V6a1 1 0 00-1-1z"/>
      </svg>
    ),
  },
];

const getFeatureTabStyles = (isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '4px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  backgroundColor: 'transparent',
  color: isDark ? '#98a2b3' : '#69707d',
  transition: 'all 0.15s ease',
});

const getFeatureTabActiveStyles = (isDark: boolean): React.CSSProperties => ({
  ...getFeatureTabStyles(isDark),
  backgroundColor: isDark ? '#2d4a6f' : '#e6f1fa',
  color: isDark ? '#3b82f6' : '#006bb4',
});

export interface FeatureTabsProps {
  activeFeature: ActiveFeature;
  onFeatureChange: (feature: ActiveFeature) => void;
}

/**
 * Feature tabs component for toolbar navigation
 */
export function FeatureTabs({ activeFeature, onFeatureChange }: FeatureTabsProps): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  return (
    <nav className="workbench-feature-tabs" aria-label={t('Workbench features')}>
      {FEATURES.map((feature) => (
        <button
          key={feature.id}
          aria-current={activeFeature === feature.id ? 'page' : undefined}
          style={activeFeature === feature.id ? getFeatureTabActiveStyles(isDark) : getFeatureTabStyles(isDark)}
          onClick={() => onFeatureChange(feature.id)}
        >
          {feature.icon}
          {t(feature.label)}
        </button>
      ))}
    </nav>
  );
}

export default FeatureTabs;
