// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
/**
 * Data Prepper Workbench Main Component
 * Container for the pipeline configuration editor and simulator
 */

import { DocumentFileActions, DocumentFilesHome, DocumentFileStatus, useDocumentFileView } from '../../../components/Files/DocumentFiles';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DataPrepperProvider, useDataPrepper } from './DataPrepperContext';
import { useTheme } from '../../../context/ThemeContext';
import { SourceEditor } from './SourceEditor';
import { ConfigEditor } from './ConfigEditor';
import { OutputPanel } from './OutputPanel';
import { WorkbenchHeader, ToolbarButton } from '../../../components/Layout/WorkbenchHeader';
import type { ActiveFeature } from '../../../components/Layout/FeatureTabs';

export interface DataPrepperWorkbenchProps {
  onFeatureChange?: (feature: ActiveFeature) => void;
}

/**
 * Inner workbench content that uses the context
 */
function WorkbenchContent({ onFeatureChange }: DataPrepperWorkbenchProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const {
    sourceData,
    sourceFormat,
    pipelineConfig,
    processingResult,
    isProcessing,
    sourceErrors,
    pipelineErrors,
    generatedRole,
    roleError,
    setSourceData,
    setSourceFormat,
    setPipelineConfig,
    evaluate,
    cancelEvaluation,
    generateRole,
    files, fileState, saveState,
    loadTemplate,
    saveError, retrySave,
  } = useDataPrepper();

  const pageContainerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: theme.background,
  };

  const mainLayoutStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    padding: '16px',
    overflow: 'hidden',
  };

  const editorsRowStyles: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    minHeight: '200px',
  };

  const editorPanelStyles: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.backgroundTertiary,
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    overflow: 'hidden',
  };

  const resizeHandleStyles: React.CSSProperties = {
    height: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'row-resize',
    backgroundColor: 'transparent',
    transition: 'background-color 0.15s ease',
    flexShrink: 0,
  };

  const resizeHandleBarStyles: React.CSSProperties = {
    width: '48px',
    height: '4px',
    backgroundColor: theme.border,
    borderRadius: '2px',
    transition: 'background-color 0.15s ease',
  };

  const outputPanelStyles: React.CSSProperties = {
    minHeight: '120px',
    backgroundColor: theme.backgroundTertiary,
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    overflow: 'hidden',
  };

  const hasErrors = sourceErrors.some((e) => e.severity === 'error') ||
    pipelineErrors.some((e) => e.severity === 'error');

  const fileView = useDocumentFileView(files);
  const containerRef = useRef<HTMLDivElement>(null);
  const [outputHeight, setOutputHeight] = useState(280);
  const [isResizing, setIsResizing] = useState(false);


  // Handle resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY - 16; // 16px for padding
      const minHeight = 120;
      const maxHeight = containerRect.height - 200 - 12; // Leave at least 200px for editors + 12px handle
      setOutputHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div style={pageContainerStyles}>
      <WorkbenchHeader activeFeature="dataprepper" onFeatureChange={onFeatureChange}
        fileActions={<DocumentFileActions actions={files} state={fileState} active={fileState.active} view={fileView} />}
        featureActions={
          <ToolbarButton primary
            onClick={isProcessing ? cancelEvaluation : evaluate}
            disabled={fileView.showFiles || !fileState.active || (hasErrors && !isProcessing)}
            title={isProcessing ? t('Cancel simulation') : hasErrors ? t('Fix errors before evaluating') : t('Simulate pipeline locally')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2l10 6-10 6V2z" />
            </svg>
            {isProcessing ? t('Cancel') : t('Simulate')}
          </ToolbarButton>        } />

      {/* Main content area */}
      {fileView.showFiles || !fileState.active ? <DocumentFilesHome label="Data Prepper" actions={files} state={fileState} drafts={fileState.documents} view={fileView} /> : <main ref={containerRef} style={mainLayoutStyles}>
        {/* Top row: Source and Config editors side by side */}
        <div style={{ ...editorsRowStyles, flex: 1, height: `calc(100% - ${outputHeight + 12}px)` }}>
          <div style={editorPanelStyles}>
            <SourceEditor
              value={sourceData}
              format={sourceFormat}
              errors={sourceErrors}
              onChange={setSourceData}
              onFormatChange={setSourceFormat}
              onLoadTemplate={loadTemplate}
            />
          </div>
          
          <div style={editorPanelStyles}>
            <ConfigEditor
              value={pipelineConfig}
              errors={pipelineErrors}
              onChange={setPipelineConfig}
            />
          </div>
        </div>
        
        {/* Resize handle */}
        <div
          style={{
            ...resizeHandleStyles,
            backgroundColor: isResizing ? '#e6f1fa' : 'transparent',
          }}
          onMouseDown={handleResizeStart}
        >
          <div
            style={{
              ...resizeHandleBarStyles,
              backgroundColor: isResizing ? '#006bb4' : '#d3dae6',
            }}
          />
        </div>
        
        {/* Bottom row: Output panel */}
        <div style={{ ...outputPanelStyles, height: outputHeight }}>
          <OutputPanel
            result={processingResult}
            isProcessing={isProcessing}
            generatedRole={generatedRole}
            roleError={roleError}
            onGenerateRole={generateRole}
          />
        </div>
      </main>}
      <DocumentFileStatus state={fileState} active={fileState.active} saveState={saveState} saveError={saveError} retrySave={retrySave} />
    </div>
  );
}

/**
 * Data Prepper Workbench with provider
 */
export function DataPrepperWorkbench({ onFeatureChange }: DataPrepperWorkbenchProps): React.ReactElement {
  useLanguage();
  return (
    <DataPrepperProvider>
      <WorkbenchContent onFeatureChange={onFeatureChange} />
    </DataPrepperProvider>
  );
}
