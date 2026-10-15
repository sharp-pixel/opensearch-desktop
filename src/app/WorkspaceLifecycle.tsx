// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { updateStore } from '../updates/store';
import { registerUpdateRestartGuard } from '../updates/restartGuard';
import { t, useLanguage } from '../i18n';
import { useEffect, useState, type ReactNode } from 'react';
import { useNotebookStore } from '../features/notebook/ui/NotebookContext';
import { useInvestigationStore } from '../features/investigation/ui/InvestigationContext';
import { useConnections } from '../connections/ConnectionProvider';
import { flushDrafts, hasUnsavedDrafts } from '../storage/drafts';
import { onDesktopCloseRequested, hasPendingDocumentFileOperations } from '../platform/runtime';
import { createCloseRequest } from './closeRequest';

export function WorkspaceLifecycle({ children }: { children?: ReactNode }) {
  useLanguage();
  const notebook = useNotebookStore();
  const investigation = useInvestigationStore();
  const { flushConnections, connectionsAreBusy } = useConnections();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const guard = createCloseRequest(async () => {
      if (notebook.getSnapshot().fileBusy || investigation.getSnapshot().fileBusy || hasPendingDocumentFileOperations()) return false;
      notebook.cancelAllRuns(); investigation.cancelAllRuns();
      const [notebooks, investigations, drafts, connections] = await Promise.all([
        notebook.flush(), investigation.saveCurrentInvestigation(), flushDrafts(), flushConnections(),
      ]);
      return notebooks && investigations && drafts.every(Boolean) && connections;
    }, (busy, message) => { setSaving(busy); setError(message); });
    const unregisterRestart = registerUpdateRestartGuard(guard.request, () => setSaving(false));
    void onDesktopCloseRequested(() => updateStore.getSnapshot().restarting ? Promise.resolve(false) : guard.request()).then(remove => {
      if (disposed) remove(); else unlisten = remove;
    }).catch(() => {
      if (!disposed) setError('Desktop close protection could not start. Wait for your changes to save before closing.');
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (updateStore.getSnapshot().restarting || notebook.getSnapshot().fileBusy || investigation.getSnapshot().fileBusy || hasPendingDocumentFileOperations() || notebook.getSnapshot().saveState !== 'saved' || investigation.getSnapshot().saveState !== 'saved'
        || hasUnsavedDrafts() || connectionsAreBusy()) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { disposed = true; unregisterRestart(); guard.dispose(); unlisten?.(); window.removeEventListener('beforeunload', beforeUnload); };
  }, [notebook, investigation, flushConnections, connectionsAreBusy]);
  return <>
    {error && <div role="alert" style={{ padding: 12 }}>{error} <button onClick={() => setError(null)}>{t('Dismiss')}</button></div>}
    <div inert={saving} style={{ height: '100%' }}>{children}</div>
    {saving && <div role="status" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.7)', color: 'white' }}>{t('Saving before closing…')}</div>}
  </>;
}
