// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../i18n';
import { useId, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { AccessibleDialog } from '../Dialogs/AccessibleDialog';
import { ToolbarButton } from '../Layout/WorkbenchHeader';
import type { FileDraftItem } from './DocumentFiles';

export function RenameDocumentTitle({ document, kind, busy, onRename }: { document: FileDraftItem; kind: string; busy: boolean; onRename(name: string): void }) {
  useLanguage();
  const { theme } = useTheme();
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const titleId = useId();
  const inputId = useId();
  const dirty = !document.file?.path || document.file.dirty;
  return <>
    <ToolbarButton className="workbench-document-name" disabled={busy}
      title={document.file?.path ?? t('Rename {arg0}', { arg0: t(kind) })} aria-label={t('Rename {arg0} {arg1}{arg2}', { arg0: t(kind), arg1: document.name, arg2: dirty ? t(' (unsaved changes)') : '' })}
      onClick={() => setEditing({ id: document.id, name: document.name })}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{document.file?.name ?? document.name}{dirty ? ' *' : ''}</span>
    </ToolbarButton>
    {editing && <AccessibleDialog labelledBy={titleId} onDismiss={() => setEditing(null)} style={{ padding: 20, width: 380, maxWidth: '90vw', background: theme.surface, color: theme.text, borderRadius: 8 }}>
      <h2 id={titleId} style={{ fontSize: 18 }}>{t('Rename {arg0}', { arg0: t(kind) })}</h2>
      {document.file?.path && <p style={{ fontSize: 13, color: theme.textMuted }}>{t('This changes the {kind} title. Use Save As to change the file name.', { kind: t(kind) })}</p>}
      <label htmlFor={inputId}>{t('{kind} name', { kind: t(kind.charAt(0).toUpperCase() + kind.slice(1)) })}</label>
      <input id={inputId} value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} style={{ width: '100%', boxSizing: 'border-box', margin: '8px 0 16px', padding: '6px 10px', border: `1px solid ${theme.border}`, borderRadius: 4, background: theme.surface, color: theme.text }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <ToolbarButton onClick={() => setEditing(null)}>{t('Cancel')}</ToolbarButton>
        <ToolbarButton disabled={busy || !editing.name.trim() || editing.id !== document.id} onClick={() => { onRename(editing.name.trim()); setEditing(null); }}>{t('Rename')}</ToolbarButton>
      </div>
    </AccessibleDialog>}
  </>;
}
