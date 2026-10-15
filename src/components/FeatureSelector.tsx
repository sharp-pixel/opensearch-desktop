// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
//
// Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.

import { t, useLanguage } from '../i18n';
/**
 * Feature Selector Component
 * Allows switching between Notebook, Data Prepper, ISM, and Investigation
 */

import React from 'react';
import { useTheme } from '../context/ThemeContext';

export type ActiveFeature = 'notebook' | 'dataprepper' | 'ism' | 'investigation';

interface FeatureSelectorProps {
  active: ActiveFeature;
  onChange: (feature: ActiveFeature) => void;
}

const tabsContainerStyles: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  marginBottom: 0,
};

const getTabStyles = (isSelected: boolean, isDark: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  border: 'none',
  borderBottom: isSelected 
    ? `2px solid ${isDark ? '#3b82f6' : '#006bb4'}` 
    : '2px solid transparent',
  backgroundColor: 'transparent',
  color: isSelected 
    ? (isDark ? '#3b82f6' : '#006bb4') 
    : (isDark ? '#98a2b3' : '#69707d'),
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

export function FeatureSelector({ active, onChange }: FeatureSelectorProps): React.ReactElement {
  useLanguage();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  
  return (
    <div style={tabsContainerStyles}>
      <button
        style={getTabStyles(active === 'notebook', isDark)}
        onClick={() => onChange('notebook')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 1h10a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V3a2 2 0 012-2zm0 1a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1H3zm1 2h8v1H4V4zm0 3h8v1H4V7zm0 3h5v1H4v-1z"/>
        </svg>{t('Notebook')}</button>
      <button
        style={getTabStyles(active === 'investigation', isDark)}
        onClick={() => onChange('investigation')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
        </svg>{t('Investigation')}</button>
      <button
        style={getTabStyles(active === 'dataprepper', isDark)}
        onClick={() => onChange('dataprepper')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 4h3v2H2V4zm0 3h5v2H2V7zm0 3h3v2H2v-2zm12-6h-5v2h5V4zm0 3h-7v2h7V7zm0 3h-5v2h5v-2z"/>
        </svg>{t('Data Prepper')}</button>
      <button
        style={getTabStyles(active === 'ism', isDark)}
        onClick={() => onChange('ism')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1a6 6 0 110 12A6 6 0 018 2zm0 2a.5.5 0 01.5.5v3.793l2.354 2.353a.5.5 0 01-.708.708l-2.5-2.5A.5.5 0 017.5 8V4.5A.5.5 0 018 4z"/>
        </svg>{t('ISM Analyzer')}</button>
    </div>
  );
}
