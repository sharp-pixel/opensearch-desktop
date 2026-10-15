// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
//
// Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.

import { t, useLanguage } from '../../../i18n';
/**
 * Investigation Workspace Component
 * Main container for multi-cluster investigation feature
 * Requirements: 1.1, 1.2, 1.3, 2.1
 */

import { DocumentFileActions, DocumentFilesHome, DocumentFileStatus, useDocumentFileView } from '../../../components/Files/DocumentFiles';
import { useState, useCallback } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { useInvestigation, InvestigationProvider } from './InvestigationContext';
import { ClusterSelector } from './ClusterSelector';
import { InvestigationCellList } from './InvestigationCellList';
import { useConnections } from '../../../connections/ConnectionProvider';
import { WorkbenchHeader, ToolbarButton } from '../../../components/Layout/WorkbenchHeader';
import { RenameDocumentTitle } from '../../../components/Files/RenameDocumentTitle';
import { ConnectionModal } from '../../../components/Dialogs';
import type { ActiveFeature } from '../../../components/Layout/FeatureTabs';
import type { ConnectionConfig } from '../../../types/connection';

export interface InvestigationWorkspaceProps {
  onFeatureChange?: (feature: ActiveFeature) => void;
}

function InvestigationWorkspaceInner({ onFeatureChange }: InvestigationWorkspaceProps) {
  useLanguage();
  const { theme } = useTheme();
  const { state, createNewInvestigation, setInvestigation, saveCurrentInvestigation, retryLoad, openFile, saveFile, selectId, deleteInvestigation, forgetRecentFile } = useInvestigation();
  const files = { newDocument: createNewInvestigation, openFile, saveFile, selectId, removeDraft: deleteInvestigation, forgetRecentFile };
  const fileView = useDocumentFileView(files);
  const { addConnection, error: connectionError } = useConnections();
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);

  const handleSaveConnection = useCallback(async (connection: ConnectionConfig) => {
    await addConnection(connection);
    setEditingConnection(null);
  }, [addConnection]);

  const handleEditConnection = useCallback((connection: ConnectionConfig) => {
    setEditingConnection(connection);
    setIsConnectionModalOpen(true);
  }, []);

  const handleOpenConnectionModal = useCallback(() => {
    setEditingConnection(null);
    setIsConnectionModalOpen(true);
  }, []);

  const handleCloseConnectionModal = useCallback(() => {
    setIsConnectionModalOpen(false);
    setEditingConnection(null);
  }, []);

  const selectedClusterCount = state.clusterGroup?.connectionIds.length ?? 0;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      backgroundColor: theme.background,
    }}>
      <WorkbenchHeader activeFeature="investigation" onFeatureChange={onFeatureChange}
        fileActions={<DocumentFileActions actions={files} state={state} active={state.activeInvestigation} view={fileView}
          title={state.activeInvestigation && <RenameDocumentTitle document={state.activeInvestigation} kind="investigation" busy={state.fileBusy}
            onRename={name => setInvestigation({ ...state.activeInvestigation!, name })} />} />}
        featureActions={<>
          {/* Cluster count badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            backgroundColor: selectedClusterCount > 0 ? theme.primaryLight : theme.warningLight,
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 500,
            color: selectedClusterCount > 0 ? theme.primary : theme.warning,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4zm0 8a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H4zm0 1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H4zm2-6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm0 8a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z"/>
            </svg>
            <span>{t(selectedClusterCount === 1 ? '{count} cluster' : '{count} clusters', { count: selectedClusterCount })}</span>
          </div>
          
          <ToolbarButton
            onClick={handleOpenConnectionModal}
            title={t('Add new connection')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>{t('Add Connection')}</ToolbarButton>
        </>} />

      {connectionError && <div role="alert">{t('Connections:')}{' '}{connectionError}</div>}
      {state.loadingInvestigationId && <div role="status">{t('Opening investigation and saved results…')}</div>}
      {state.loadError && <div role="alert">{t('Unable to open investigation:')}{' '}{state.loadError} <button onClick={() => retryLoad()}>{t('Retry opening')}</button></div>}
      {/* Main content area */}
      {fileView.showFiles || !state.activeInvestigation ? <DocumentFilesHome label="Investigation" actions={files} state={state} drafts={state.investigations} view={fileView} /> : <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Main workspace */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Cluster selector */}
          <ClusterSelector 
            onAddConnection={handleOpenConnectionModal} 
            onEditConnection={handleEditConnection}
          />

          {/* Cell list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <InvestigationCellList key={state.activeInvestigation?.id} />
          </div>
        </div>
      </div>}
      <DocumentFileStatus state={state} active={state.activeInvestigation} saveState={state.saveState} saveError={state.saveError} retrySave={saveCurrentInvestigation} />

      {/* Connection Modal */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={handleCloseConnectionModal}
        onSave={handleSaveConnection}
        existingConnection={editingConnection}
      />
    </div>
  );
}

/**
 * Investigation Workspace with Provider wrapper
 */
export function InvestigationWorkspace(props: InvestigationWorkspaceProps) {
  useLanguage();
  return (
    <InvestigationProvider>
      <InvestigationWorkspaceInner {...props} />
    </InvestigationProvider>
  );
}
