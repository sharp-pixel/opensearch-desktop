// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage, formatDate } from '../../../i18n';
import { useId, useState } from 'react';
import { useNotebook } from './NotebookContext';
import { useTheme } from '../../../context/ThemeContext';
import { AccessibleDialog } from '../../../components/Dialogs/AccessibleDialog';
import { isDesktopApp } from '../../../platform/runtime';
import type { NotebookMetadata } from '../../../types/notebook';

interface Props {
  onNew: () => void;
  onOpen: (path?: string) => void;
  onLocate: (path: string) => void;
  onResume: (id: string) => void;
}

export function RecentNotebookFiles({ onNew, onOpen, onLocate, onResume }: Props) {
  useLanguage();
  const { theme } = useTheme();
  const { notebooks, recentFiles, fileBusy, forgetRecentFile, deleteNotebook } = useNotebook();
  const [discard, setDiscard] = useState<NotebookMetadata | null>(null);
  const [discardBusy, setDiscardBusy] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const titleId = useId();
  const button = { padding: '7px 12px', background: theme.surface, color: theme.primary, border: `1px solid ${theme.border}`, borderRadius: 4, cursor: 'pointer' };
  const unsaved = notebooks.filter(item => !item.file?.path).sort((a, b) => b.updatedAt - a.updatedAt);
  const recovered = notebooks.filter(item => item.file?.path && item.file.dirty).sort((a, b) => b.updatedAt - a.updatedAt);
  const drafts = (items: NotebookMetadata[]) => items.map(item => (
    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${theme.border}` }}>
      <button disabled={fileBusy} onClick={() => onResume(item.id)} style={{ ...button, flex: 1, textAlign: 'left', border: 'none', background: 'transparent' }}>
        <div>{item.name}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4, overflowWrap: 'anywhere' }}>{item.file?.path ?? t('{arg0} cells · Not saved to a file', { arg0: item.cellCount })}</div>
      </button>
      <button disabled={fileBusy} style={button} onClick={() => { setDiscard(item); setDiscardError(null); }}>{t('Discard draft')}</button>
    </div>
  ));
  return (
    <div style={{ maxWidth: 900, margin: '20px auto', color: theme.text }}>
      <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>{t('Notebook files')}</h1>
      <p style={{ color: theme.textSecondary }}>{t('Open a notebook from your project folder or create one and save it as a file.')}</p>
      <div style={{ display: 'flex', gap: 10, margin: '20px 0 28px' }}>
        <button style={button} disabled={fileBusy} onClick={onNew}>{t('New notebook')}</button>
        <button style={button} disabled={fileBusy} onClick={() => onOpen()}>{t('Open file…')}</button>
      </div>
      {!isDesktopApp() && <p style={{ color: theme.textMuted, fontSize: 13 }}>{t('In the browser, Open loads a local copy and Save downloads it. Use the desktop app to save directly and reopen recent files.')}</p>}
      <h2 style={{ fontSize: 18 }}>{t('Recent files')}</h2>
      {recentFiles.length === 0 && <p style={{ color: theme.textMuted }}>{t('Files you open or save in the desktop app will appear here.')}</p>}
      {recentFiles.map(file => (
        <div key={file.path} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 0', borderBottom: `1px solid ${theme.border}` }}>
          <button disabled={fileBusy || !isDesktopApp()} onClick={() => onOpen(file.path)} style={{ ...button, flex: 1, minWidth: 200, textAlign: 'left', border: 'none', background: 'transparent' }}>
            <div>{file.name}</div>
            <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4, overflowWrap: 'anywhere' }}>{file.path}</div>
            <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>{t('Notebook · Last opened')}{' '}{formatDate(file.openedAt)}</div>
          </button>
          <button style={button} disabled={fileBusy || !isDesktopApp()} onClick={() => onLocate(file.path)} aria-label={t('Locate {arg0}', { arg0: file.name })}>{t('Locate…')}</button>
          <button style={button} disabled={fileBusy} onClick={() => forgetRecentFile(file.path)} aria-label={t('Remove {arg0} from recent files', { arg0: file.name })}>{t('Remove')}</button>
        </div>
      ))}
      {recovered.length > 0 && <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18 }}>{t('Recovered changes')}</h2>
        <p style={{ color: theme.textMuted, fontSize: 13 }}>{t('These notebooks have changes that have not been saved to their files.')}</p>
        {drafts(recovered)}
      </section>}
      {unsaved.length > 0 && <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18 }}>{t('Unsaved notebooks')}</h2>
        <p style={{ color: theme.textMuted, fontSize: 13 }}>{t('Your existing notebooks and new drafts are kept here until you save them to a file.')}</p>
        {drafts(unsaved)}
      </section>}
      {discard && <AccessibleDialog labelledBy={titleId} onDismiss={() => { if (!discardBusy) setDiscard(null); }}
        style={{ padding: 24, width: 420, maxWidth: '90vw', background: theme.surface, borderRadius: 8, color: theme.text }}>
        <h2 id={titleId} style={{ fontSize: 18 }}>{t('Discard recovery draft?')}</h2>
        <p>{t('Discard the locally recovered changes for “{name}”?', { name: discard.name })}{' '}{discard.file?.path ? t('The file on disk will remain unchanged.') : t('This notebook has no saved file.')}</p>
        {discardError && <p role="alert">{discardError}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={button} disabled={discardBusy} onClick={() => setDiscard(null)}>{t('Cancel')}</button>
          <button style={{ ...button, color: theme.error }} disabled={discardBusy} onClick={() => {
            setDiscardBusy(true);
            void deleteNotebook(discard.id).then(() => setDiscard(null)).catch(error => setDiscardError(error instanceof Error ? error.message : 'Unable to discard draft.')).finally(() => setDiscardBusy(false));
          }}>{t('Discard draft')}</button>
        </div>
      </AccessibleDialog>}
    </div>
  );
}
