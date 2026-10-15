// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
//
// Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.

import { t, useLanguage } from '../../i18n';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { FeatureTabs, type ActiveFeature } from './FeatureTabs';
import { needsTrafficLightPadding, isDesktopApp, isTauri } from '../../utils/platform';
import { PreferencesMenu } from './PreferencesMenu';
import { APP } from '../../utils/constants';

export function ToolbarButton({ primary = false, iconOnly = false, style, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; iconOnly?: boolean }) {
  const { theme } = useTheme();
  return <button type="button" className={`workbench-toolbar-button${iconOnly ? ' workbench-toolbar-icon' : ''} ${className}`.trim()}
    style={{ color: primary ? '#fff' : theme.primary, backgroundColor: primary ? theme.primary : theme.surface, borderColor: primary ? theme.primary : theme.border, ...style }} {...props} />;
}

export function WorkbenchHeader({ activeFeature, onFeatureChange, fileActions, featureActions }: {
  activeFeature: ActiveFeature;
  onFeatureChange?: (feature: ActiveFeature) => void;
  fileActions: ReactNode;
  featureActions?: ReactNode;
}) {
  useLanguage();
  const { theme, mode, toggleTheme } = useTheme();
  const desktop = isDesktopApp();
  const tauri = isTauri();
  const noDrag = desktop && !tauri ? { WebkitAppRegion: 'no-drag' } as CSSProperties : undefined;
  const logo = mode === 'light' ? (
    <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M61.7374 23.5C60.4878 23.5 59.4748 24.513 59.4748 25.7626C59.4748 44.3813 44.3813 59.4748 25.7626 59.4748C24.513 59.4748 23.5 60.4878 23.5 61.7374C23.5 62.987 24.513 64 25.7626 64C46.8805 64 64 46.8805 64 25.7626C64 24.513 62.987 23.5 61.7374 23.5Z" fill="#005EB8"/>
      <path d="M48.0814 38C50.2572 34.4505 52.3615 29.7178 51.9475 23.0921C51.0899 9.36725 38.6589 -1.04463 26.9206 0.0837327C22.3253 0.525465 17.6068 4.2712 18.026 10.9805C18.2082 13.8961 19.6352 15.6169 21.9544 16.9399C24.1618 18.1992 26.9978 18.9969 30.2128 19.9011C34.0962 20.9934 38.6009 22.2203 42.063 24.7717C46.2125 27.8295 49.0491 31.3743 48.0814 38Z" fill="#003B5C"/>
      <path d="M3.91861 14C1.74276 17.5495 -0.361506 22.2822 0.0524931 28.9079C0.910072 42.6327 13.3411 53.0446 25.0794 51.9163C29.6747 51.4745 34.3932 47.7288 33.974 41.0195C33.7918 38.1039 32.3647 36.3831 30.0456 35.0601C27.8382 33.8008 25.0022 33.0031 21.7872 32.0989C17.9038 31.0066 13.3991 29.7797 9.93694 27.2283C5.78746 24.1704 2.95092 20.6257 3.91861 14Z" fill="#005EB8"/>
    </svg>
  ) : (
    <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M61.7374 23.5C60.4878 23.5 59.4748 24.513 59.4748 25.7626C59.4748 44.3813 44.3814 59.4748 25.7626 59.4748C24.513 59.4748 23.5 60.4878 23.5 61.7374C23.5 62.987 24.513 64 25.7626 64C46.8805 64 64 46.8805 64 25.7626C64 24.513 62.987 23.5 61.7374 23.5Z" fill="#00A3E0"/>
      <path d="M48.0814 38C50.2572 34.4505 52.3615 29.7178 51.9475 23.0921C51.0899 9.36725 38.6589 -1.04463 26.9206 0.0837327C22.3253 0.525465 17.6068 4.2712 18.026 10.9805C18.2082 13.8961 19.6352 15.6169 21.9544 16.9399C24.1618 18.1992 26.9978 18.9969 30.2128 19.9011C34.0962 20.9934 38.6009 22.2203 42.0631 24.7717C46.2125 27.8295 49.0491 31.3743 48.0814 38Z" fill="#B9D9EB"/>
      <path d="M3.91861 14C1.74276 17.5495 -0.361506 22.2822 0.0524931 28.9079C0.910072 42.6327 13.3411 53.0446 25.0794 51.9163C29.6747 51.4745 34.3932 47.7288 33.974 41.0195C33.7918 38.1039 32.3647 36.3831 30.0456 35.0601C27.8382 33.8008 25.0022 33.0031 21.7872 32.0989C17.9038 31.0066 13.3991 29.7797 9.93695 27.2283C5.78747 24.1704 2.95092 20.6257 3.91861 14Z" fill="#00A3E0"/>
    </svg>
  );

  return <header className="workbench-header workbench-shared-header" style={{
    backgroundColor: theme.backgroundTertiary, borderColor: theme.border, color: theme.text,
    paddingLeft: needsTrafficLightPadding() ? 85 : 16,
    ...(desktop && !tauri ? { WebkitAppRegion: 'drag' } : {}),
  } as CSSProperties} {...(tauri ? { 'data-tauri-drag-region': true } : {})}>
    <div className="workbench-navigation-row">
      <div className="workbench-header-section" style={noDrag}>
        <div className="workbench-logo" aria-hidden="true">{logo}</div>
        {APP.SHOW_TITLE && <span className="workbench-brand">{APP.NAME}</span>}
        <FeatureTabs activeFeature={activeFeature} onFeatureChange={onFeatureChange ?? (() => {})} />
      </div>
      <div className="workbench-preferences-theme" style={noDrag}>
        <PreferencesMenu />
        <ToolbarButton iconOnly onClick={toggleTheme} aria-label={mode === 'light' ? t('Switch to dark mode') : t('Switch to light mode')} title={mode === 'light' ? t('Switch to dark mode') : t('Switch to light mode')}>
            {mode === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 11a3 3 0 100-6 3 3 0 000 6zm0 1a4 4 0 110-8 4 4 0 010 8zM8 0a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2A.5.5 0 018 0zm0 13a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2A.5.5 0 018 13zm8-5a.5.5 0 01-.5.5h-2a.5.5 0 010-1h2a.5.5 0 01.5.5zM3 8a.5.5 0 01-.5.5h-2a.5.5 0 010-1h2A.5.5 0 013 8zm10.657-5.657a.5.5 0 010 .707l-1.414 1.415a.5.5 0 11-.707-.708l1.414-1.414a.5.5 0 01.707 0zm-9.193 9.193a.5.5 0 010 .707L3.05 13.657a.5.5 0 01-.707-.707l1.414-1.414a.5.5 0 01.707 0zm9.193 2.121a.5.5 0 01-.707 0l-1.414-1.414a.5.5 0 01.707-.707l1.414 1.414a.5.5 0 010 .707zM4.464 4.465a.5.5 0 01-.707 0L2.343 3.05a.5.5 0 11.707-.707l1.414 1.414a.5.5 0 010 .708z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 .278a.768.768 0 01.08.858 7.208 7.208 0 00-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 01.81.316.733.733 0 01-.031.893A8.349 8.349 0 018.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 016 .278z"/>
              </svg>
            )}
        </ToolbarButton>
      </div>
    </div>
    <div className="workbench-document-row" style={noDrag}>
      {fileActions}
      {featureActions && <div className="workbench-header-section workbench-feature-actions" role="group" aria-label={t('View actions')}>{featureActions}</div>}
    </div>
  </header>;
}
