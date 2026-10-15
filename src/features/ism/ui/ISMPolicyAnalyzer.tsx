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
 * ISM Policy Analyzer Main Component
 * Container for the ISM policy editor, visualization, and analysis tools
 */

import { DocumentFileActions, DocumentFilesHome, DocumentFileStatus, useDocumentFileView } from '../../../components/Files/DocumentFiles';
import React, { useCallback } from 'react';
import { ISMAnalyzerProvider, useISMAnalyzer } from './ISMAnalyzerContext';
import { PolicyEditor } from './PolicyEditor';
import { StateDiagram } from './StateDiagram';
import { TimelinePanel } from './TimelinePanel';
import { AnalysisPanel } from './AnalysisPanel';
import { ReferencePanel } from './ReferencePanel';
import { WorkbenchHeader, ToolbarButton } from '../../../components/Layout/WorkbenchHeader';
import { useTheme } from '../../../context/ThemeContext';
import type { ActiveFeature } from '../../../components/Layout/FeatureTabs';
import type { AnalyzerTab, AnalysisResult } from '../../../types/ism';

interface ISMPolicyAnalyzerProps {
  onFeatureChange: (feature: ActiveFeature) => void;
}

function ISMPolicyAnalyzerContent({ onFeatureChange }: ISMPolicyAnalyzerProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: theme.background,
  };

  const mainContentStyles: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  };

  const leftPanelStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: '50%',
    minWidth: '300px',
    borderRight: `1px solid ${theme.border}`,
    backgroundColor: theme.backgroundTertiary,
  };

  const rightPanelStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: '300px',
    backgroundColor: theme.background,
  };

  const tabBarStyles: React.CSSProperties = {
    display: 'flex',
    borderBottom: `1px solid ${theme.border}`,
    backgroundColor: theme.backgroundSecondary,
  };

  const tabStyles = (active: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    fontSize: '12px',
    fontWeight: 500,
    color: active ? theme.text : theme.textMuted,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: active ? `2px solid ${theme.primary}` : '2px solid transparent',
    cursor: 'pointer',
    marginBottom: '-1px',
  });

  const tabContentStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
  };
  const {
    policyJson,
    validationErrors,
    analysisResults,
    diagramData,
    timelineData,
    simulationParams,
    activeTab,
    selectedState,
    setPolicyJson,
    setActiveTab,
    setSelectedState,
    setSimulationParams,
    loadTemplate,
    files, fileState, saveState,
    copyToClipboard,
    saveError, retrySave,
  } = useISMAnalyzer();

  const fileView = useDocumentFileView(files);

  const handleStateClick = useCallback((stateName: string) => {
    setSelectedState(stateName);
  }, [setSelectedState]);

  const handleAnalysisResultClick = useCallback((result: AnalysisResult) => {
    if (result.stateName) {
      setSelectedState(result.stateName);
      setActiveTab('diagram');
    }
  }, [setSelectedState, setActiveTab]);

  const tabs: { id: AnalyzerTab; label: string }[] = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'reference', label: 'Reference' },
  ];

  return (
    <div style={containerStyles}>
      <WorkbenchHeader activeFeature="ism" onFeatureChange={onFeatureChange}
        fileActions={<DocumentFileActions actions={files} state={fileState} active={fileState.active} view={fileView} />}
        featureActions={
          <ToolbarButton onClick={copyToClipboard} disabled={fileView.showFiles || !fileState.active} title={t('Copy policy JSON')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 1.5H3a2 2 0 00-2 2V14a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V14a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z"/>
              <path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3zm-3-1A1.5 1.5 0 005 1.5v1A1.5 1.5 0 006.5 4h3A1.5 1.5 0 0011 2.5v-1A1.5 1.5 0 009.5 0h-3z"/>
            </svg>{t('Copy')}</ToolbarButton>        } />

      {fileView.showFiles || !fileState.active ? <DocumentFilesHome label="ISM policy" actions={files} state={fileState} drafts={fileState.documents} view={fileView} /> : <div style={mainContentStyles}>
        <div style={leftPanelStyles}>
          <PolicyEditor
            value={policyJson}
            errors={validationErrors}
            onChange={setPolicyJson}
            onLoadTemplate={loadTemplate}
          />
        </div>

        <div style={rightPanelStyles}>
          <div style={tabBarStyles}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                style={tabStyles(activeTab === tab.id)}
                onClick={() => setActiveTab(tab.id)}
              >
                {t(tab.label)}
                {tab.id === 'analysis' && analysisResults.length > 0 && (
                  <span style={{
                    marginLeft: '6px',
                    padding: '1px 6px',
                    fontSize: '10px',
                    backgroundColor: analysisResults.some(r => r.severity === 'error') ? '#ef4444' : '#f59e0b',
                    borderRadius: '10px',
                    color: '#fff',
                  }}>
                    {analysisResults.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={tabContentStyles}>
            {activeTab === 'diagram' && (
              <StateDiagram
                data={diagramData}
                onStateClick={handleStateClick}
                selectedState={selectedState}
              />
            )}
            {activeTab === 'timeline' && (
              <TimelinePanel
                data={timelineData}
                params={simulationParams}
                onParamsChange={setSimulationParams}
              />
            )}
            {activeTab === 'analysis' && (
              <AnalysisPanel
                results={analysisResults}
                onResultClick={handleAnalysisResultClick}
              />
            )}
            {activeTab === 'reference' && (
              <ReferencePanel />
            )}
          </div>
        </div>
      </div>}
      <DocumentFileStatus state={fileState} active={fileState.active} saveState={saveState} saveError={saveError} retrySave={retrySave} />
    </div>
  );
}

export function ISMPolicyAnalyzer(props: ISMPolicyAnalyzerProps): React.ReactElement {
  useLanguage();
  return (
    <ISMAnalyzerProvider>
      <ISMPolicyAnalyzerContent {...props} />
    </ISMAnalyzerProvider>
  );
}
