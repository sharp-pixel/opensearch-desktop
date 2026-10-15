// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage, formatDate } from '../../i18n';
/* eslint-disable react-refresh/only-export-components */
import { useId, useState, type ReactNode } from 'react';
import { DocumentToolbar } from './DocumentToolbar';
import { useTheme } from '../../context/ThemeContext';
import { AccessibleDialog } from '../Dialogs/AccessibleDialog';
import { isDesktopApp } from '../../platform/runtime';
import type { DocumentFileBinding } from '../../platform/contracts';
import type { RecentDocumentFile } from '../../services/recentDocumentFiles';
import type { SaveState } from '../../storage/saveCoordinator';

export interface FileDraftItem { id: string; name: string; updatedAt: number; file?: DocumentFileBinding }
export interface FileViewActions {
  newDocument(): unknown;
  openFile(path?: string): Promise<string | null>;
  saveFile(saveAs?: boolean): Promise<boolean>;
  selectId(id: string): unknown;
  removeDraft(id: string): unknown;
  forgetRecentFile(path: string): unknown;
}
export interface FileViewState {
  fileBusy: boolean; fileError: string | null; fileNotice: string | null;
  recentFiles: RecentDocumentFile[];
}
export function useDocumentFileView(actions: FileViewActions) {
  const [showFiles, setShowFiles] = useState(true);
  const onNew = () => { actions.newDocument(); setShowFiles(false); };
  const onOpen = async (path?: string) => {
    const opened = await actions.openFile(path);
    if (opened !== null) setShowFiles(false);
    return opened;
  };
  const onLocate = async (path: string) => {
    const opened = await onOpen();
    if (opened && opened !== path) actions.forgetRecentFile(path);
  };
  const onResume = async (id: string) => { await actions.selectId(id); setShowFiles(false); };
  return { showFiles, onNew, onOpen, onLocate, onResume, onHome: () => setShowFiles(true) };
}
export type DocumentFileView = ReturnType<typeof useDocumentFileView>;
export function DocumentFileActions({ actions, state, active, view, title }: { actions: FileViewActions; state: FileViewState; active: FileDraftItem | null; view: DocumentFileView; title?: ReactNode }) {
  useLanguage();
  return <DocumentToolbar busy={state.fileBusy} hasDocument={!!active} showFiles={view.showFiles || !active}
    onHome={view.onHome} onNew={view.onNew} onOpen={() => void view.onOpen()}
    onSave={() => void actions.saveFile()} onSaveAs={() => void actions.saveFile(true)}
    title={title ?? (active && <span className="workbench-document-name" title={active.file?.path ?? t('Not saved to a file')}>
      {active.file?.name ?? active.name}{(!active.file?.path || active.file.dirty) ? ' *' : ''}
    </span>)} />;
}
export function DocumentFilesHome({ label, actions, state, drafts, view }: { label: string; actions: FileViewActions; state: FileViewState; drafts: FileDraftItem[]; view: DocumentFileView }) {
  useLanguage();
  const { theme } = useTheme();
  const [discard, setDiscard] = useState<FileDraftItem | null>(null);
  const [discardBusy, setDiscardBusy] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const titleId = useId();
  const button = { padding: '7px 12px', border: `1px solid ${theme.border}`, borderRadius: 4, background: theme.surface, color: theme.primary, cursor: 'pointer' };
  const unsaved = drafts.filter(item => !item.file?.path).sort((a, b) => b.updatedAt - a.updatedAt);
  const recovered = drafts.filter(item => item.file?.path && item.file.dirty).sort((a, b) => b.updatedAt - a.updatedAt);
  const rows = (items: FileDraftItem[]) => items.map(item => <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${theme.border}` }}>
    <button style={{ ...button, flex: 1, textAlign: 'left', border: 'none', background: 'transparent' }} disabled={state.fileBusy} onClick={() => void view.onResume(item.id)}>
      <div>{item.file?.name ?? item.name}</div><div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4, overflowWrap: 'anywhere' }}>{item.file?.path ?? t('Not saved to a file')}</div>
    </button>
    <button style={button} disabled={state.fileBusy} onClick={() => { setDiscard(item); setDiscardError(null); }}>{t('Discard draft')}</button>
  </div>);
  return <div style={{ flex: 1, overflow: 'auto', padding: 24 }}><div style={{ maxWidth: 900, margin: '0 auto', color: theme.text }}>
    <h1 style={{ fontSize: 24 }}>{t('{kind} files', { kind: t(label) })}</h1>
    <p style={{ color: theme.textSecondary }}>{t('Open a file from your project folder or create a document and save it as a file.')}</p>
    <div style={{ display: 'flex', gap: 10, margin: '20px 0 28px' }}><button style={button} disabled={state.fileBusy} onClick={view.onNew}>{t('New document')}</button><button style={button} disabled={state.fileBusy} onClick={() => void view.onOpen()}>{t('Open file…')}</button></div>
    {!isDesktopApp() && <p style={{ color: theme.textMuted, fontSize: 13 }}>{t('In the browser, Open loads a local copy and Save downloads it. Use the desktop app to save directly and reopen recent files.')}</p>}
    <h2 style={{ fontSize: 18 }}>{t('Recent files')}</h2>
    {!state.recentFiles.length && <p style={{ color: theme.textMuted }}>{t('Files you open or save in the desktop app will appear here.')}</p>}
    {state.recentFiles.map(file => <div key={file.path} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${theme.border}` }}>
      <button style={{ ...button, flex: 1, minWidth: 200, textAlign: 'left', border: 'none', background: 'transparent' }} disabled={state.fileBusy || !isDesktopApp()} onClick={() => void view.onOpen(file.path)}>
        <div>{file.name}</div><div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4, overflowWrap: 'anywhere' }}>{file.path}</div><div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>{t('Last opened')}{' '}{formatDate(file.openedAt)}</div>
      </button>
      <button style={button} disabled={state.fileBusy || !isDesktopApp()} onClick={() => void view.onLocate(file.path)}>{t('Locate…')}</button>
      <button style={button} disabled={state.fileBusy} onClick={() => actions.forgetRecentFile(file.path)} aria-label={t('Remove {arg0} from recent files', { arg0: file.name })}>{t('Remove')}</button>
    </div>)}
    {!!recovered.length && <section style={{ marginTop: 28 }}><h2 style={{ fontSize: 18 }}>{t('Recovered changes')}</h2><p style={{ color: theme.textMuted }}>{t('These drafts have changes that have not been saved to their files.')}</p>{rows(recovered)}</section>}
    {!!unsaved.length && <section style={{ marginTop: 28 }}><h2 style={{ fontSize: 18 }}>{t('Unsaved documents')}</h2><p style={{ color: theme.textMuted }}>{t('Existing documents and new drafts are kept here until you save them to a file.')}</p>{rows(unsaved)}</section>}
    {discard && <AccessibleDialog labelledBy={titleId} onDismiss={() => { if (!discardBusy) setDiscard(null); }} style={{ padding: 24, width: 420, maxWidth: '90vw', background: theme.surface, borderRadius: 8, color: theme.text }}>
      <h2 id={titleId}>{t('Discard recovery draft?')}</h2><p>{t('Discard “{name}”?', { name: discard.file?.name ?? discard.name })}{' '}{discard.file?.path ? t('The file on disk will remain unchanged.') : t('This document has no saved file.')}</p>
      {discardError && <p role="alert">{discardError}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button style={button} disabled={discardBusy} onClick={() => setDiscard(null)}>{t('Cancel')}</button><button style={{ ...button, color: theme.error }} disabled={discardBusy} onClick={() => {
        setDiscardBusy(true);
        void Promise.resolve().then(() => actions.removeDraft(discard.id)).then(() => setDiscard(null)).catch(error => setDiscardError(error instanceof Error ? error.message : String(error))).finally(() => setDiscardBusy(false));
      }}>{t('Discard draft')}</button></div>
    </AccessibleDialog>}
  </div></div>;
}
export function DocumentFileStatus({ state, active, saveState, saveError, retrySave }: { state: FileViewState; active: FileDraftItem | null; saveState: SaveState; saveError: string | null; retrySave(): unknown }) {
  useLanguage();
  const { theme } = useTheme();
  return <div style={{ padding: '6px 16px', fontSize: 12, color: theme.textMuted, borderTop: `1px solid ${theme.border}` }}>
    {state.fileBusy && <div role="status">{t('Accessing file…')}</div>}
    {state.fileError && <div role="alert" style={{ color: theme.error }}>{t(state.fileError)}</div>}
    {state.fileNotice && <div role="status">{t(state.fileNotice)}</div>}
    {saveError && <div role="alert">{t('Recovery could not be saved:')}{' '}{saveError} <button onClick={() => retrySave()}>{t('Retry')}</button></div>}
    {active && <div>{active.file?.path ? t('{arg0} · {arg1}', { arg0: t(active.file.dirty ? 'Unsaved file changes' : 'File saved'), arg1: active.file.path }) : t('Not saved to a file')} · {saveState === 'saved' ? t('Recovery saved') : saveState === 'pending' ? t('Saving recovery…') : t('Recovery save failed')}</div>}
  </div>;
}
