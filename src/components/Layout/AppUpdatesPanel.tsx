// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { useId } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { t, useLanguage } from '../../i18n';
import { useAppUpdates } from '../../updates/useAppUpdates';
import { updateStore } from '../../updates/store';

export function AppUpdatesPanel() {
  useLanguage();
  const state = useAppUpdates();
  const { theme } = useTheme();
  const autoId = useId();
  const { native, busy, error } = state;
  const style = { background: theme.surface, color: theme.text, borderColor: theme.border };
  const progress = native?.totalBytes ? Math.min(100, Math.round(native.downloadedBytes / native.totalBytes * 100)) : undefined;
  return <section style={{ borderTop: `1px solid ${theme.border}`, marginTop: 24, paddingTop: 16 }}>
    <h3 style={{ fontSize: 16, margin: '0 0 12px' }}>{t('App updates')}</h3>
    {native?.info.version && <p style={{ fontSize: 13 }}>{t('Current version: {version}', { version: native.info.version })}</p>}
    {!native && !error && <p role="status">{t('Loading update settings…')}</p>}
    {!native && error && <button type="button" className="workbench-toolbar-button" style={style} disabled={busy} onClick={() => void updateStore.initialize()}>{t('Retry update settings')}</button>}
    {native && (!native.info.supported || !native.info.configured) && <p style={{ fontSize: 13, color: theme.textSecondary }}>{t(native.info.reason ?? 'Updates are not configured for this build.')}</p>}
    {native?.info.supported && native.info.configured && <>
      <label htmlFor={autoId} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
        <input id={autoId} type="checkbox" checked={state.automaticChecks} onChange={event => updateStore.setAutomaticChecks(event.target.checked)} />
        {t('Automatically check for updates')}
      </label>
      {native.release && <p>{t('Version {version} is available.', { version: native.release.version })}</p>}
      {native.release?.notes && <details><summary>{t('Release notes')}</summary><p style={{ fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 160, overflow: 'auto' }}>{native.release.notes}</p></details>}
      <div role="status" aria-live="polite" style={{ margin: '12px 0', fontSize: 13 }}>
        {state.restarting ? t('Saving changes and restarting…') : native.phase === 'checking' || (busy && native.phase === 'idle') ? t('Checking for updates…')
          : native.phase === 'downloading' ? t('Downloading update…') : native.phase === 'downloaded' ? t('Update downloaded. Restart to install it.')
          : native.phase === 'installed' ? t('Update installed. Restart to finish.') : state.checked && native.phase === 'idle' ? t('You are up to date.') : null}
      </div>
      {native.phase === 'downloading' && <progress aria-label={t('Update download progress')} value={progress} max={100} style={{ width: '100%' }} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {!['downloaded', 'installed'].includes(native.phase) && <button type="button" className="workbench-toolbar-button" style={style} disabled={busy} onClick={() => void updateStore.check()}>{t('Check for updates')}</button>}
        {native.phase === 'available' && <button type="button" className="workbench-toolbar-button" style={style} disabled={busy} onClick={() => void updateStore.download()}>{t('Download update')}</button>}
        {['downloaded', 'installed'].includes(native.phase) && <button type="button" className="workbench-toolbar-button" style={style} disabled={busy} onClick={() => void updateStore.restart()}>{t(native.phase === 'installed' ? 'Restart now' : 'Restart and install')}</button>}
      </div>
    </>}
    {error && <p role="alert" style={{ fontSize: 13, color: theme.error, overflowWrap: 'anywhere' }}>{t(error)}</p>}
  </section>;
}
