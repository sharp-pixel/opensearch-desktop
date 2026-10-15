// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../i18n';
import type { ReactNode } from 'react';
import { ToolbarButton } from '../Layout/WorkbenchHeader';
import { useNativeFileMenu } from '../../platform/useNativeMenu';
export function DocumentToolbar({ busy, hasDocument, showFiles, title, onHome, onNew, onOpen, onSave, onSaveAs }: {
  busy: boolean; hasDocument: boolean; showFiles: boolean; title?: ReactNode;
  onHome?: () => void; onNew?: () => void; onOpen?: () => void; onSave?: () => void; onSaveAs?: () => void;
}) {
  useLanguage();
  const canSave = hasDocument && !showFiles;
  const nativeMenu = useNativeFileMenu({ busy, canSave, onHome, onNew, onOpen, onSave, onSaveAs });
  return <div className="workbench-file-actions" role="group" aria-label={t('File actions')}>
    {!nativeMenu && <>
    <ToolbarButton disabled={busy} onClick={onHome} aria-pressed={showFiles} title={t('Show recent files')}>{t('Recent files')}</ToolbarButton>
    <ToolbarButton disabled={busy} onClick={onNew} title={t('New document (Ctrl/Cmd+N)')}>{t('New')}</ToolbarButton>
    <ToolbarButton disabled={busy} onClick={onOpen} title={t('Open file (Ctrl/Cmd+O)')}>{t('Open…')}</ToolbarButton>
    <ToolbarButton disabled={busy || !canSave} onClick={onSave} title={t('Save file (Ctrl/Cmd+S)')}>{t('Save')}</ToolbarButton>
    <ToolbarButton disabled={busy || !canSave} onClick={onSaveAs} title={t('Save file as (Ctrl/Cmd+Shift+S)')}>{t('Save As…')}</ToolbarButton>
    </>}
    {!showFiles && hasDocument && title}
  </div>;
}
