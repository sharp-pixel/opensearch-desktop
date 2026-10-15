// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
import { useNotebook, useUI } from '../NotebookContext';
import { NotebookFileTitle } from '../NotebookFileTitle';
import { ConnectionSelector } from '../../../../components/ConnectionSelector';
import { WorkbenchHeader, ToolbarButton } from '../../../../components/Layout/WorkbenchHeader';
import { DocumentToolbar } from '../../../../components/Files/DocumentToolbar';
import type { ActiveFeature } from '../../../../components/Layout/FeatureTabs';
import type { ConnectionConfig } from '../../../../types/connection';

export type { ActiveFeature } from '../../../../components/Layout/FeatureTabs';

export interface ToolbarProps {
  onGenerateRole?: () => void;
  onSaveNotebook?: () => void;
  onSaveNotebookAs?: () => void;
  onCreateNotebook?: () => void;
  onShowFiles?: () => void;
  showFiles?: boolean;
  onOpenNotebook?: () => void;
  onOpenConnectionSettings?: () => void;
  onEditConnection?: (connection: ConnectionConfig) => void;
  activeFeature?: ActiveFeature;
  onFeatureChange?: (feature: ActiveFeature) => void;
}

export function Toolbar({ onSaveNotebook, onSaveNotebookAs, onCreateNotebook, onShowFiles, showFiles = false,
  onOpenNotebook, onOpenConnectionSettings, onEditConnection, activeFeature = 'notebook', onFeatureChange }: ToolbarProps) {
  useLanguage();
  const { activeNotebook, fileBusy } = useNotebook();
  const { toggleSidebar, sidebarOpen } = useUI();
  return <WorkbenchHeader activeFeature={activeFeature} onFeatureChange={onFeatureChange}
    fileActions={<DocumentToolbar busy={fileBusy} hasDocument={!!activeNotebook} showFiles={showFiles || !activeNotebook}
      onHome={onShowFiles} onNew={onCreateNotebook} onOpen={onOpenNotebook} onSave={onSaveNotebook} onSaveAs={onSaveNotebookAs}
      title={<NotebookFileTitle />} />}
    featureActions={<>
      <ConnectionSelector onOpenConnectionSettings={onOpenConnectionSettings ?? (() => {})} onEditConnection={onEditConnection} />
      <ToolbarButton iconOnly onClick={toggleSidebar} aria-label={sidebarOpen ? t('Hide tracking sidebar') : t('Show tracking sidebar')} title={sidebarOpen ? t('Hide tracking sidebar') : t('Show tracking sidebar')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              {sidebarOpen ? (
                <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1zm-1 10H9V4h3v8zM3 4h5v8H3V4z" />
              ) : (
                <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1zM3 4h10v8H3V4z" />
              )}
            </svg>
      </ToolbarButton>
    </>} />;
}
export default Toolbar;
