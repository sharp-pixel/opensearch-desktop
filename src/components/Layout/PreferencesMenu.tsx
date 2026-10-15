// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { AppUpdatesPanel } from './AppUpdatesPanel';
import { useAppUpdates } from '../../updates/useAppUpdates';
import { useId, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage, useLanguagePreference, setLanguage, t, type LanguagePreference } from '../../i18n';
import { AccessibleDialog } from '../Dialogs/AccessibleDialog';
import { useNativeMenuAction, useNativeMenuReady } from '../../platform/useNativeMenu';

export function PreferencesMenu() {
  useLanguage();
  const updates = useAppUpdates();
  const preference = useLanguagePreference();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuReady = useNativeMenuReady();
  const { listening } = useNativeMenuAction(action => {
    if (action === 'preferences' && !document.querySelector('[role="dialog"], [aria-modal="true"]')) setOpen(true);
  });
  const nativeMenu = menuReady && listening;
  const titleId = useId();
  const languageId = useId();
  const helpId = useId();
  const controlStyle = { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border };
  return <>
    {!nativeMenu && <button type="button" className="workbench-toolbar-button" style={controlStyle}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      {t('Preferences')}
      {updates.native?.release && <span style={{ fontSize: 11, color: theme.primary }}>{t('Update available')}</span>}
    </button>}
    {open && <AccessibleDialog labelledBy={titleId} onDismiss={() => setOpen(false)}
      style={{ padding: 24, width: 420, maxWidth: '90vw', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto', background: theme.surface, color: theme.text, borderRadius: 8 }}>
      <h2 id={titleId} style={{ margin: '0 0 24px', fontSize: 20 }}>{t('Preferences')}</h2>
      <label htmlFor={languageId} style={{ display: 'block', marginBottom: 8 }}>{t('Language')}</label>
      <select id={languageId} className="workbench-toolbar-button" style={{ ...controlStyle, width: '100%' }}
        value={preference} aria-describedby={helpId} data-autofocus
        onChange={event => setLanguage(event.target.value as LanguagePreference)}>
        <option value="system">{t('System default')}</option>
        <option value="en" lang="en">English</option>
        <option value="ja" lang="ja">日本語</option>
      </select>
      <p id={helpId} style={{ fontSize: 13, lineHeight: 1.5, color: theme.textSecondary }}>
        {t('System default follows your system language, with English as the fallback. Changes apply immediately.')}
      </p>
      <AppUpdatesPanel />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button type="button" className="workbench-toolbar-button" style={controlStyle} onClick={() => setOpen(false)}>{t('Close')}</button>
      </div>
    </AccessibleDialog>}
  </>;
}
