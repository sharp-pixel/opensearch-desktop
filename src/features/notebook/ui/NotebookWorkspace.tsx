// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
/**
 * Main App Component for OpenSearch Developer Workbench
 * Wires all components together with proper state management and service integration
 * Supports multiple features: Notebook and Data Prepper Workbench
 */

import React, { useState, useCallback } from 'react';
import { ToastList, type Toast } from '../../../components/Toast';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import {
  useNotebook,
  useTracking,
  useUI,
  useNotebookStore,
} from './NotebookContext';
import { useConnections } from '../../../connections/ConnectionProvider';
import { NotebookPage } from './layout';
import { CellList } from './cells';
import { ConnectionModal, RolePreviewModal } from '../../../components/Dialogs';
import type { ActiveFeature } from './layout/Toolbar';
import { executeNotebookCell } from '../application/executeCell';
import { generateRole } from '../../../services/roleGenerator';
import { RecentNotebookFiles } from './RecentNotebookFiles';
import { useTheme } from '../../../context/ThemeContext';
import { UI, HTTP_STATUS } from '../../../utils/constants';
import type { CellType } from '../../../types/cell';
import type { ConnectionConfig } from '../../../types/connection';
import type { GeneratedRole } from '../../../types/role';


/**
 * Toast ID counter for unique toast IDs
 */
let toastIdCounter = 0;

/**
 * Main application content with all wiring
 */
export function NotebookWorkspace({ onFeatureChange }: { onFeatureChange: (feature: ActiveFeature) => void }): React.ReactElement {
  useLanguage();
  const notebookStore = useNotebookStore();
  const {
    activeNotebook,
    selectedCellId,
    executingCellIds,
    createNewNotebook,
    addCell,
    updateCell,
    convertCell,
    deleteCell,
    reorderCells,
    selectCell,
    activeFile, fileBusy, fileError, openNotebookFile, saveNotebookFile, dismissFileError,
    saveState, saveError, retrySave, loadingNotebookId, loadError, retryLoad,
  } = useNotebook();

  const {
    activeConnection,
    setActiveConnection,
    addConnection,
  } = useConnections();

  const { tracking } = useTracking();
  const { theme } = useTheme();
  const [showFiles, setShowFiles] = useState(true);
  const { rolePreviewOpen, setRolePreviewOpen } = useUI();

  // Local state for modals and toasts
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);
  const [generatedRole, setGeneratedRole] = useState<GeneratedRole | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);


  /**
   * Add a toast notification
   */
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${toastIdCounter++}`;
    setToasts((prev: Toast[]) => [...prev, { ...toast, id }]);
  }, []);

  /**
   * Remove a toast notification
   */
  const removeToast = useCallback((removedToast: Toast) => {
    setToasts((prev: Toast[]) => prev.filter((t) => t.id !== removedToast.id));
  }, []);

  /**
   * Handle creating a new notebook
   */
  const handleCreateNotebook = useCallback(() => {
    if (notebookStore.getSnapshot().fileBusy) return;
    const name = `Notebook ${notebookStore.getSnapshot().notebooks.length + 1}`;
    const notebook = createNewNotebook(name);
    setShowFiles(false);
    addToast({
      title: 'Notebook created',
      text: t('Created “{name}”', { name: notebook.name }),
      color: 'success',
    });
  }, [createNewNotebook, addToast, notebookStore]);

  /**
   * Handle adding a new cell
   */
  const handleAddCell = useCallback((type: CellType, afterCellId?: string) => {
    if (activeNotebook) {
      addCell(type, afterCellId);
    }
  }, [activeNotebook, addCell]);

  const runCell = useCallback(async (cellId: string, profile = false) => {
    if (!activeConnection) {
      addToast({ title: 'Cannot execute query', text: t('Please configure a connection first'), color: 'warning' });
      return;
    }
    try {
      const result = await executeNotebookCell(notebookStore, cellId, activeConnection, profile);
      if (result && 'statusCode' in result && result.statusCode === HTTP_STATUS.TOO_MANY_REQUESTS) {
        addToast({ title: 'Rate limit exceeded', text: t('Please wait before trying again.'), color: 'warning' });
      }
      if (profile && result?.success) addToast({ title: 'Profile query executed', text: t('Profile data is available in the results'), color: 'success' });
    } catch (error) {
      addToast({ title: 'Query execution failed', text: error instanceof Error ? error.message : 'Unknown error', color: 'danger' });
    }
  }, [notebookStore, activeConnection, addToast]);
  const handleRunCell = useCallback((cellId: string) => runCell(cellId), [runCell]);
  const handleRunCellWithProfile = useCallback((cellId: string) => runCell(cellId, true), [runCell]);

  /**
   * Handle generating a security role
   */
  const handleGenerateRole = useCallback(() => {
    if (tracking.operations.length === 0) {
      addToast({
        title: 'No operations tracked',
        text: t('Execute some queries first to track API operations'),
        color: 'warning',
      });
      return;
    }

    const roleName = activeNotebook
      ? `${activeNotebook.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}_role`
      : 'notebook_role';

    const role = generateRole(tracking.permissions, roleName);
    setGeneratedRole(role);
    setRolePreviewOpen(true);
  }, [tracking, activeNotebook, setRolePreviewOpen, addToast]);

  const handleOpenNotebook = useCallback(async (path?: string) => {
    const notebook = await openNotebookFile(path);
    if (notebook) setShowFiles(false);
  }, [openNotebookFile]);

  const handleSaveNotebook = useCallback(async (saveAs = false) => {
    const file = await saveNotebookFile(saveAs);
    if (file) addToast({ title: file.path ? 'Notebook saved' : 'Notebook download started', text: file.path ?? file.name, color: 'success' });
  }, [saveNotebookFile, addToast]);

  const handleLocateNotebook = useCallback(async (path: string) => {
    const notebook = await openNotebookFile();
    if (notebook) {
      const locatedPath = notebookStore.getSnapshot().notebooks.find(item => item.id === notebook.id)?.file?.path;
      if (locatedPath !== path) notebookStore.forgetRecentFile(path);
      setShowFiles(false);
    }
  }, [openNotebookFile, notebookStore]);

  const handleResumeNotebook = useCallback(async (id: string) => {
    await notebookStore.select(id);
    if (notebookStore.getSnapshot().activeNotebook?.id === id) setShowFiles(false);
  }, [notebookStore]);

  /**
   * Handle opening connection settings
   */
  const handleOpenConnectionSettings = useCallback(() => {
    setEditingConnection(null);
    setIsConnectionModalOpen(true);
  }, []);

  /**
   * Handle editing an existing connection
   */
  const handleEditConnection = useCallback((connection: ConnectionConfig) => {
    setEditingConnection(connection);
    setIsConnectionModalOpen(true);
  }, []);

  /**
   * Handle saving connection
   */
  const handleSaveConnection = useCallback(
    async (connection: ConnectionConfig) => {
      await addConnection(connection);
      setActiveConnection(connection);
      addToast({
        title: 'Connection saved',
        text: t('Connected to “{name}”', { name: connection.name }),
        color: 'success',
      });
    },
    [addConnection, setActiveConnection, addToast]
  );

  /**
   * Handle closing role preview modal
   */
  const handleCloseRolePreview = useCallback(() => {
    setRolePreviewOpen(false);
    setGeneratedRole(null);
  }, [setRolePreviewOpen]);

  /**
   * Handle role update from preview modal
   */
  const handleRoleUpdate = useCallback((role: GeneratedRole) => {
    setGeneratedRole(role);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/* Notebook Feature */}
        {(
          <ErrorBoundary>
            <>
              <NotebookPage
                onGenerateRole={handleGenerateRole}
                onSaveNotebook={() => { void handleSaveNotebook(); }}
                onSaveNotebookAs={() => { void handleSaveNotebook(true); }}
                onShowFiles={() => setShowFiles(true)}
                showFiles={showFiles}
                filesHome={<RecentNotebookFiles onNew={handleCreateNotebook} onOpen={path => { void handleOpenNotebook(path); }} onLocate={path => { void handleLocateNotebook(path); }} onResume={id => { void handleResumeNotebook(id); }} />}
                onOpenNotebook={() => { void handleOpenNotebook(); }}
                onOpenConnectionSettings={handleOpenConnectionSettings}
                onEditConnection={handleEditConnection}
                onCreateNotebook={handleCreateNotebook}
                activeFeature="notebook"
                onFeatureChange={onFeatureChange}
              >
                {activeNotebook && (
                  <CellList key={activeNotebook.id}
                    cells={activeNotebook.cells}
                    selectedCellId={selectedCellId}
                    executingCellIds={executingCellIds}
                    connection={activeConnection}
                    onSelectCell={selectCell}
                    onDeleteCell={deleteCell}
                    onUpdateCell={updateCell}
                    onConvertCell={convertCell}
                    onReorderCells={reorderCells}
                    onRunCell={handleRunCell}
                    onRunCellWithProfile={handleRunCellWithProfile}
                    onAddCell={handleAddCell}
                  />
                )}
              </NotebookPage>

              {/* Connection Modal */}
              <ConnectionModal
                isOpen={isConnectionModalOpen}
                onClose={() => {
                  setIsConnectionModalOpen(false);
                  setEditingConnection(null);
                }}
                onSave={handleSaveConnection}
                existingConnection={editingConnection}
              />

              {/* Role Preview Modal */}
              <RolePreviewModal
                isOpen={rolePreviewOpen}
                onClose={handleCloseRolePreview}
                generatedRole={generatedRole}
                onRoleUpdate={handleRoleUpdate}
              />

            </>
          </ErrorBoundary>
        )}

      </div>

      {loadingNotebookId && <div role="status">{t('Opening notebook and saved results…')}</div>}
      {loadError && <div role="alert">{t('Unable to open notebook:')}{' '}{loadError} <button onClick={() => retryLoad()}>{t('Retry opening')}</button></div>}
      {saveState === 'error' && <div role="alert">{t('Unable to save recovery draft:')}{' '}{saveError} <button onClick={() => retrySave()}>{t('Retry save')}</button></div>}
      {fileBusy && <div role="status" style={{ padding: '8px 16px', color: theme.text, background: theme.surface }}>{t('Working with notebook file…')}</div>}
      {fileError && <div role="alert" style={{ padding: '8px 16px', color: theme.error, background: theme.surface }}>{t(fileError)} <button onClick={dismissFileError}>{t('Dismiss')}</button></div>}
      {!showFiles && activeNotebook && <div style={{ padding: '6px 16px', fontSize: 12, color: theme.textMuted, background: theme.surface, overflowWrap: 'anywhere' }}>
        {activeFile?.path ?? t('Not saved to a file')} · {activeFile?.path && !activeFile.dirty ? t('File saved') : t('Unsaved changes')} · {saveState === 'saved' ? t('Recovery draft saved') : saveState === 'error' ? t('Recovery draft could not be saved') : t('Saving recovery draft…')}
      </div>}
      {/* Toast notifications */}
      <ToastList
        toasts={toasts}
        dismissToast={removeToast}
        toastLifeTimeMs={UI.TOAST_DURATION_MS}
      />
    </div>
  );
}
