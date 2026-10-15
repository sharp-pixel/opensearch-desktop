// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
import { registerRunShortcut } from '../../../../editor/lifecycle';
/**
 * PPL Cell Component - PPL query editor with Monaco, autocomplete, and results display
 * Requirements: PPL 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.7
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import type { OnMount, OnChange, BeforeMount } from '@monaco-editor/react';
import { WorkbenchEditor as Editor } from '../../../../editor/WorkbenchEditor';
import type * as Monaco from 'monaco-editor';
import type { PPLCell as PPLCellType } from '../../../../types/cell';
import type { ConnectionConfig } from '../../../../types/connection';
import { registerPPLLanguage, PPL_LANGUAGE_ID } from '../../../../services/pplLanguage';
import { createFieldSource, mappingTargetForPPL } from '../../../../services/fieldMappings';
import { registerScopedCompletions, pplEditorCompletionProvider } from '../../../../services/editorCompletions';
import { fetchClusterIndices } from '../../../../services/queryExecutor';
import { PPLResultsTable } from './PPLResultsTable';
import { useTheme } from '../../../../context/ThemeContext';

export interface PPLCellProps {
  cell: PPLCellType;
  connection: ConnectionConfig | null;
  isExecuting: boolean;
  onUpdate: (updates: Partial<PPLCellType>) => void;
  onRun: () => void;
}

/**
 * PPL Cell component - PPL query editing experience
 */
export function PPLCell({
  cell,
  connection,
  isExecuting,
  onUpdate,
  onRun,
}: PPLCellProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const [clusterIndices, setClusterIndices] = useState<string[]>([]);
  
  // Use refs to always have access to the latest values in the completion provider
  const clusterIndicesRef = useRef<string[]>([]);
  const connectionRef = useRef(connection);
  useEffect(() => { connectionRef.current = connection; }, [connection]);
  const onUpdateRef = useRef(onUpdate);
  const onRunRef = useRef(onRun);
  const executingRef = useRef(isExecuting);
  useEffect(() => { executingRef.current = isExecuting; }, [isExecuting]);
  
  // Keep refs updated
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onRunRef.current = onRun;
  }, [onUpdate, onRun]);
  
  // Keep clusterIndices ref updated
  useEffect(() => {
    clusterIndicesRef.current = clusterIndices;
  }, [clusterIndices]);

  // Fetch cluster indices when connection changes
  useEffect(() => {
    let isMounted = true;
    setClusterIndices([]);
    clusterIndicesRef.current = [];
    
    if (connection) {
      fetchClusterIndices(connection).then((indices) => {
        if (isMounted) {
          setClusterIndices(indices.map((i) => i.name));
        }
      }).catch(() => {
        // Silently handle errors - indices just won't be available
      });
    } else {
      setClusterIndices([]);
    }
    
    return () => {
      isMounted = false;
    };
  }, [connection]);

  const handleQueryChange: OnChange = useCallback(
    (value) => {
      onUpdate({ query: value || '' });
    },
    [onUpdate]
  );

  // Configure Monaco before mount
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    // Register PPL language
    registerPPLLanguage(monaco);
  }, []);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      registerScopedCompletions(monaco, editor, PPL_LANGUAGE_ID,
        pplEditorCompletionProvider(monaco, () => clusterIndicesRef.current, createFieldSource(
          () => connectionRef.current ? [connectionRef.current] : [], mappingTargetForPPL,
        )));

      registerRunShortcut(editor, monaco, () => {
        onUpdateRef.current({ query: editor.getValue() });
        onRunRef.current();
      }, () => executingRef.current);

    },
    []
  );

  const hasResult = cell.lastResult !== undefined;
  const isSuccess = cell.lastResult?.success ?? false;

  const errorOutputStyles: React.CSSProperties = {
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    padding: '12px',
    borderRadius: '4px',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    backgroundColor: theme.errorLight,
    border: `1px solid ${theme.error}`,
    color: theme.error,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Input section */}
      <div>
        {/* PPL label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        }}>
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
          <span style={{ fontSize: '12px', color: theme.textMuted }}>{t('Piped Processing Language')}</span>
        </div>

        {/* PPL Query Editor */}
        <div style={{ 
          border: `1px solid ${theme.border}`, 
          borderRadius: '3px', 
          overflow: 'visible',
          backgroundColor: theme.surface,
          position: 'relative',
        }}>
          {/* Placeholder text when empty */}
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
            }}>{t('source=<index> | <command> ... (Press Ctrl+Space for suggestions)')}</div>
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
              scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden',
              },
              padding: { top: 8, bottom: 8 },
              fixedOverflowWidgets: true,
            }}

          />
        </div>
      </div>

      {/* Output section */}
      {hasResult && (
        <div style={{ 
          marginTop: '12px',
          marginLeft: '24px',
          position: 'relative',
        }}>
          {/* Output label */}
          <div style={{
            position: 'absolute',
            left: '-24px',
            top: '0',
            fontSize: '11px',
            fontWeight: 500,
            color: isSuccess ? theme.success : theme.error,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          }}>{t('Out')}</div>
          
          {isSuccess ? (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px',
                fontSize: '12px',
                color: theme.textMuted,
              }}>
                <span style={{ color: theme.success, fontWeight: 500 }}>
                  {cell.lastResult?.statusCode}
                </span>
                <span>{cell.lastResult?.duration}ms</span>
                <span>{cell.lastResult?.total}{' '}{t('rows')}</span>
              </div>
              <PPLResultsTable
                schema={cell.lastResult?.schema || []}
                datarows={cell.lastResult?.datarows || []}
                total={cell.lastResult?.total || 0}
              />
            </div>
          ) : (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px',
                fontSize: '12px',
                color: theme.error,
                fontWeight: 500,
              }}>{t('Error')}{' '}{cell.lastResult?.statusCode}
              </div>
              <pre style={errorOutputStyles}>
                {cell.lastResult?.error || t('Unknown error')}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
