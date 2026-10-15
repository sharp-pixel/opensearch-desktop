// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
import { registerRunShortcut } from '../../../editor/lifecycle';
/**
 * Investigation PPL Cell Component
 * PPL query editor for multi-cluster investigation with federated execution
 * Requirements: 3.1, 3.2, 4.1, 4.7
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { OnMount, OnChange, BeforeMount } from '@monaco-editor/react';
import { WorkbenchEditor as Editor } from '../../../editor/WorkbenchEditor';
import type * as Monaco from 'monaco-editor';
import type { InvestigationPPLCell as InvestigationPPLCellType } from '../../../types/investigation';
import type { ViewMode, ChartConfig } from '../../../types/chart';
import { registerPPLLanguage, PPL_LANGUAGE_ID } from '../../../services/pplLanguage';
import type { ConnectionConfig } from '../../../types/connection';
import { createFieldSource, mappingTargetForPPL } from '../../../services/fieldMappings';
import { registerScopedCompletions, pplEditorCompletionProvider } from '../../../services/editorCompletions';
import { fetchClusterIndices } from '../../../services/queryExecutor';
import { useTheme } from '../../../context/ThemeContext';
import { useInvestigationStore, useInvestigationSelector, useInvestigationRun } from './InvestigationContext';
import { useConnections } from '../../../connections/ConnectionProvider';
import { investigationResultIsStale } from '../../../execution/provenance';
import { FederatedResultsTable } from './FederatedResultsTable';

export interface InvestigationPPLCellProps {
  cell: InvestigationPPLCellType;
  onDelete: () => void;
}

/**
 * Investigation PPL Cell - PPL query for multi-cluster execution
 */
export function InvestigationPPLCell({
  cell,
  onDelete,
}: InvestigationPPLCellProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const { updateCell } = useInvestigationStore();
  const clusterGroup = useInvestigationSelector(state => state.clusterGroup);
  const clusterProgress = useInvestigationSelector(state => state.cellClusterStatuses.get(cell.id));
  const isExecuting = useInvestigationSelector(state => state.executingCellIds.has(cell.id));
  const { connections } = useConnections();
  const runCell = useInvestigationRun();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const handleRunQueryRef = useRef<() => void>(() => {});
  const executingRef = useRef(isExecuting);
  useEffect(() => { executingRef.current = isExecuting; }, [isExecuting]);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const clusterIndicesRef = useRef<string[]>([]);
  const connectionsRef = useRef<ConnectionConfig[]>([]);
  const [clusterIndices, setClusterIndices] = useState<string[]>([]);

  // Keep clusterIndices ref updated for the completion provider
  useEffect(() => {
    clusterIndicesRef.current = clusterIndices;
  }, [clusterIndices]);

  // Fetch cluster indices from all selected connections
  useEffect(() => {
    let isMounted = true;
    setClusterIndices([]);
    clusterIndicesRef.current = [];
    
    const selected = connections.filter(connection => clusterGroup?.connectionIds.includes(connection.id));
    connectionsRef.current = selected;
    Promise.allSettled(selected.map(fetchClusterIndices)).then(results => {
      if (isMounted) setClusterIndices([...new Set(results.flatMap(result => result.status === 'fulfilled' ? result.value.map(index => index.name) : []))]);
    });

    return () => {
      isMounted = false;
    };
  }, [clusterGroup, connections]);

  const handleQueryChange: OnChange = useCallback(
    (value) => {
      updateCell(cell.id, { query: value || '' });
    },
    [cell.id, updateCell]
  );

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    registerPPLLanguage(monaco);
  }, []);

  const handleRunQuery = useCallback(async () => {
    setExecutionError(null);
    updateCell(cell.id, { query: editorRef.current?.getValue() ?? cell.query });
    try { await runCell(cell.id); }
    catch (error) { setExecutionError(error instanceof Error ? error.message : 'Query failed'); }
  }, [cell.id, cell.query, runCell, updateCell]);

  // Keep the ref updated with the latest handleRunQuery
  useEffect(() => {
    handleRunQueryRef.current = handleRunQuery;
  }, [handleRunQuery]);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      registerScopedCompletions(monaco, editor, PPL_LANGUAGE_ID,
        pplEditorCompletionProvider(monaco, () => clusterIndicesRef.current, createFieldSource(
          () => connectionsRef.current, mappingTargetForPPL,
        )));

      registerRunShortcut(editor, monaco, () => handleRunQueryRef.current(), () => executingRef.current);

    },
    [] // No dependencies - we use ref to always get latest handleRunQuery
  );

  // Handle view mode change - persist to cell
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    updateCell(cell.id, { viewMode: mode });
  }, [cell.id, updateCell]);

  // Handle chart config change - persist to cell
  const handleChartConfigChange = useCallback((config: ChartConfig) => {
    updateCell(cell.id, { chartConfig: config });
  }, [cell.id, updateCell]);

  const hasResult = cell.lastResult !== undefined;
  const staleResult = investigationResultIsStale(cell, clusterGroup, connections);
  const clusterCount = clusterGroup?.connectionIds.length ?? 0;

  return (
    <div
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: '6px',
        backgroundColor: theme.surface,
        overflow: 'hidden',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cell Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.border}`,
        backgroundColor: theme.background,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            padding: '2px 8px',
            backgroundColor: theme.infoLight,
            color: theme.info,
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: 600,
          }}>
            PPL
          </span>
          <span style={{ fontSize: '12px', color: theme.textMuted }}>{t('Federated Query →')}{' '}{t(clusterCount === 1 ? '{count} cluster' : '{count} clusters', { count: clusterCount })}
          </span>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: isHovered || isExecuting ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}>
          <button
            onClick={handleRunQuery}
            disabled={isExecuting || clusterCount === 0}
            style={{
              padding: '4px 10px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: isExecuting ? theme.surface : theme.primary,
              color: isExecuting ? theme.textMuted : '#fff',
              fontSize: '12px',
              fontWeight: 500,
              cursor: isExecuting || clusterCount === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title={clusterCount === 0 ? t('Select clusters first') : t('Run query (Ctrl+Enter)')}
          >
            {isExecuting ? (
              <>
                <div style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />{t('Running...')}</>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2l10 6-10 6V2z"/>
                </svg>{t('Run')}</>
            )}
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: '4px 8px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: theme.textMuted,
              fontSize: '12px',
              cursor: 'pointer',
            }}
            title={t('Delete cell')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
              <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* PPL Editor */}
      <div style={{ position: 'relative' }}>
        {!cell.query && (
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '12px',
            color: theme.textMuted,
            fontSize: '13px',
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            pointerEvents: 'none',
            zIndex: 1,
          }}>{t('source=<index> | <command> ... (Ctrl+Enter to run)')}</div>
        )}
        <Editor
          height="80px"
          language={PPL_LANGUAGE_ID}
          value={cell.query}
          onChange={handleQueryChange}
          beforeMount={handleBeforeMount}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'off',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            folding: false,
            fontSize: 13,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            readOnly: isExecuting,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            renderLineHighlight: 'none',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
            padding: { top: 8, bottom: 8 },
            fixedOverflowWidgets: true,
          }}

        />
      </div>

      {/* Results */}
      {executionError && <div role="alert">{executionError}</div>}
      {isExecuting && clusterProgress && <div role="status" style={{ padding: '8px 16px', color: theme.textMuted }}>
        {[...clusterProgress.values()].map(status => `${status.connectionName}: ${status.status}`).join(' · ')}
      </div>}
      {hasResult && staleResult && <p role="status" style={{ padding: '0 16px', color: theme.textMuted }}>{t('Query or selected connection settings changed since this result was produced. Run again to refresh it.')}</p>}
      {hasResult && !isExecuting && (
        <div style={{
          borderTop: `1px solid ${theme.border}`,
        }}>
          <FederatedResultsTable
            result={cell.lastResult!}
            viewMode={cell.viewMode}
            chartConfig={cell.chartConfig}
            onViewModeChange={handleViewModeChange}
            onChartConfigChange={handleChartConfigChange}
          />
        </div>
      )}
    </div>
  );
}

export default InvestigationPPLCell;
