// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * NotebookPage Component - Main page layout using OuiPage
 * Requirements: 10.1, 10.2, 10.3, 10.6
 */

import { ReactNode } from 'react';
import { Toolbar, ToolbarProps, ActiveFeature } from './Toolbar';
import { TrackingSidebar } from './TrackingSidebar';
import { useNotebook, useUI } from '../NotebookContext';
import { useTheme } from '../../../../context/ThemeContext';

export type { ActiveFeature } from './Toolbar';

export interface NotebookPageProps extends ToolbarProps {
  children?: ReactNode;
  filesHome?: ReactNode;
  onCreateNotebook?: () => void;
  activeFeature?: ActiveFeature;
  onFeatureChange?: (feature: ActiveFeature) => void;
}

/**
 * NotebookPage component - main layout with toolbar, content area, and sidebar
 */
export function NotebookPage({
  children,
  filesHome,
  showFiles,
  onShowFiles,
  onSaveNotebookAs,
  onGenerateRole,
  onSaveNotebook,
  onOpenNotebook,
  onOpenConnectionSettings,
  onEditConnection,
  onCreateNotebook,
  activeFeature,
  onFeatureChange,
}: NotebookPageProps) {
  const { theme } = useTheme();
  const { activeNotebook } = useNotebook();
  const { sidebarOpen } = useUI();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: theme.background,
    }}>
      <Toolbar
        onShowFiles={onShowFiles}
        showFiles={showFiles}
        onCreateNotebook={onCreateNotebook}
        onSaveNotebookAs={onSaveNotebookAs}
        onSaveNotebook={onSaveNotebook}
        onOpenNotebook={onOpenNotebook}
        onOpenConnectionSettings={onOpenConnectionSettings}
        onEditConnection={onEditConnection}
        activeFeature={activeFeature}
        onFeatureChange={onFeatureChange}
      />
      
      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* Main content area */}
        <main style={{
          flex: 1,
          padding: '24px 32px',
          overflowY: 'auto',
          minWidth: 0,
          backgroundColor: theme.background,
        }}>
          {showFiles || !activeNotebook ? filesHome : children}
        </main>

        {/* Tracking sidebar - only show when a notebook is active */}
        {!showFiles && sidebarOpen && activeNotebook && <TrackingSidebar onGenerateRole={onGenerateRole} />}
      </div>
    </div>
  );
}

export default NotebookPage;
