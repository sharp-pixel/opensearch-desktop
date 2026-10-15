// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
//
// Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.

import { t, useLanguage } from '../../../../i18n';
import { registerRunShortcut } from '../../../../editor/lifecycle';
/**
 * QueryCell Component - Query editor with Monaco, autocomplete, results display, and profiling
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 3.9
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import type { OnMount, OnChange } from '@monaco-editor/react';
import { WorkbenchEditor as Editor } from '../../../../editor/WorkbenchEditor';
import type * as Monaco from 'monaco-editor';
import type { QueryCell as QueryCellType, HttpMethod } from '../../../../types/cell';
import type { ConnectionConfig } from '../../../../types/connection';
import {
  getEndpointSuggestionsWithIndices,
  getAllowedMethods,
} from '../../../../services/autocompleteProvider';
import { createFieldSource, mappingTargetForEndpoint } from '../../../../services/fieldMappings';
import { registerScopedCompletions, jsonEditorCompletionProvider } from '../../../../services/editorCompletions';
import { fetchClusterIndices } from '../../../../services/queryExecutor';
import { getApiDocumentation, openApiDocumentation } from '../../../../services/apiDocumentation';
import { parseProfileResponse } from '../../../../services/profileParser';
import { ProfileVisualization } from '../profiling';
import { useTheme } from '../../../../context/ThemeContext';
import type { ProfileData } from '../../../../types/profiling';

export interface QueryCellProps {
  cell: QueryCellType;
  connection: ConnectionConfig | null;
  isExecuting: boolean;
  onUpdate: (updates: Partial<QueryCellType>) => void;
  onRun: () => void;
  onRunWithProfile?: () => void;
}

interface EndpointSuggestion {
  endpoint: string;
  description: string;
}

const httpMethodOptions = [
  { value: 'GET', text: 'GET' },
  { value: 'POST', text: 'POST' },
  { value: 'PUT', text: 'PUT' },
  { value: 'DELETE', text: 'DELETE' },
  { value: 'HEAD', text: 'HEAD' },
  { value: 'PATCH', text: 'PATCH' },
];

// Styles are now defined inline using theme colors

/**
 * Format JSON for display
 */
function formatJson(value: unknown): string {
  try {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * QueryCell component - full query editing experience
 */
export function QueryCell({
  cell,
  connection,
  isExecuting,
  onUpdate,
  onRun,
  onRunWithProfile,
}: QueryCellProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const [endpointSuggestions, setEndpointSuggestions] = useState<EndpointSuggestion[]>([]);
  const [isEndpointPopoverOpen, setIsEndpointPopoverOpen] = useState(false);
  const [hoveredSuggestionIndex, setHoveredSuggestionIndex] = useState(-1);
  const endpointInputRef = useRef<HTMLDivElement | null>(null);
  const [clusterIndices, setClusterIndices] = useState<string[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [documentationError, setDocumentationError] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  // Use refs to always have access to the latest callbacks in Monaco command handlers
  const mappingContextRef = useRef({ connection, endpoint: cell.endpoint });
  useEffect(() => { mappingContextRef.current = { connection, endpoint: cell.endpoint }; }, [connection, cell.endpoint]);
  const onUpdateRef = useRef(onUpdate);
  const onRunRef = useRef(onRun);
  const executingRef = useRef(isExecuting);
  useEffect(() => { executingRef.current = isExecuting; }, [isExecuting]);
  
  // Keep refs updated
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onRunRef.current = onRun;
  }, [onUpdate, onRun]);

  // Fetch cluster indices when connection changes
  useEffect(() => {
    let isMounted = true;
    
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

  // Parse profile data when results change
  useEffect(() => {
    if (cell.lastResult?.success && cell.lastResult.body) {
      const parsed = parseProfileResponse(cell.lastResult.body as Record<string, unknown>);
      setProfileData(parsed);
      // Auto-show profile if data is available
      if (parsed) {
        setShowProfile(true);
      }
    } else {
      setProfileData(null);
      setShowProfile(false);
    }
  }, [cell.lastResult]);

  const handleMethodChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onUpdate({ method: e.target.value as HttpMethod });
    },
    [onUpdate]
  );

  const handleEndpointFocus = useCallback(() => {
    if (cell.endpoint.length > 0) {
      const suggestions = getEndpointSuggestionsWithIndices(cell.endpoint, cell.method, clusterIndices);
      if (suggestions.length > 0) {
        setEndpointSuggestions(suggestions.slice(0, 10));
        setIsEndpointPopoverOpen(true);
      }
    }
  }, [cell.endpoint, cell.method, clusterIndices]);

  const handleEndpointSelect = useCallback(
    (suggestion: EndpointSuggestion) => {
      onUpdate({ endpoint: suggestion.endpoint });
      setIsEndpointPopoverOpen(false);
    },
    [onUpdate]
  );

  const handleBodyChange: OnChange = useCallback(
    (value) => {
      onUpdate({ body: value || '' });
    },
    [onUpdate]
  );

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      registerScopedCompletions(monaco, editor, 'json', jsonEditorCompletionProvider(monaco, 'dsl', createFieldSource(
        () => mappingContextRef.current.connection ? [mappingContextRef.current.connection] : [],
        () => mappingTargetForEndpoint(mappingContextRef.current.endpoint),
      )));

      registerRunShortcut(editor, monaco, () => {
        onUpdateRef.current({ body: editor.getValue() });
        onRunRef.current();
      }, () => executingRef.current);

    },
    []
  );

  // Handle keyboard shortcuts in endpoint field
  const handleEndpointKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onRun();
      }
      if (e.key === 'Escape') {
        setIsEndpointPopoverOpen(false);
      }
      if (e.key === 'Tab' && isEndpointPopoverOpen && endpointSuggestions.length > 0) {
        e.preventDefault();
        const firstSuggestion = endpointSuggestions[0];
        if (firstSuggestion) {
          onUpdate({ endpoint: firstSuggestion.endpoint });
          setIsEndpointPopoverOpen(false);
        }
      }
      if (e.key === 'ArrowDown' && isEndpointPopoverOpen) {
        e.preventDefault();
        setHoveredSuggestionIndex((prev) => 
          prev < endpointSuggestions.length - 1 ? prev + 1 : 0
        );
      }
      if (e.key === 'ArrowUp' && isEndpointPopoverOpen) {
        e.preventDefault();
        setHoveredSuggestionIndex((prev) => 
          prev > 0 ? prev - 1 : endpointSuggestions.length - 1
        );
      }
      if (e.key === 'Enter' && isEndpointPopoverOpen && hoveredSuggestionIndex >= 0) {
        e.preventDefault();
        const suggestion = endpointSuggestions[hoveredSuggestionIndex];
        if (suggestion) {
          onUpdate({ endpoint: suggestion.endpoint });
          setIsEndpointPopoverOpen(false);
        }
      }
    },
    [onRun, isEndpointPopoverOpen, endpointSuggestions, onUpdate, hoveredSuggestionIndex]
  );

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (endpointInputRef.current && !endpointInputRef.current.contains(e.target as Node)) {
        setIsEndpointPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Theme-aware styles
  const suggestionListStyles: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 1000,
  };

  const suggestionItemStyles: React.CSSProperties = {
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: `1px solid ${theme.borderLight}`,
    fontSize: '13px',
    color: theme.text,
  };

  const suggestionItemHoverStyles: React.CSSProperties = {
    ...suggestionItemStyles,
    backgroundColor: theme.surfaceHover,
  };

  const successOutputStyles: React.CSSProperties = {
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    padding: '12px',
    borderRadius: '4px',
    overflow: 'auto',
    maxHeight: '250px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    backgroundColor: theme.successLight,
    border: `1px solid ${theme.border}`,
    color: theme.text,
  };

  const errorOutputStyles: React.CSSProperties = {
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    padding: '12px',
    borderRadius: '4px',
    overflow: 'auto',
    maxHeight: '250px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    backgroundColor: theme.errorLight,
    border: `1px solid ${theme.error}`,
    color: theme.error,
  };

  const hasResult = cell.lastResult !== undefined;
  const isSuccess = cell.lastResult?.success ?? false;
  const resultBody = cell.lastResult?.body;

  // Check which methods are allowed for the current endpoint
  const allowedMethods = getAllowedMethods(cell.endpoint);
  const isMethodValid = allowedMethods === null || allowedMethods.includes(cell.method);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Input section */}
      <div>
        {/* Method and Endpoint row */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'center',
          marginBottom: '8px',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        }}>
          <select
            value={cell.method}
            onChange={handleMethodChange}
            disabled={isExecuting}
            title={!isMethodValid ? t('{arg0} is not supported for this endpoint', { arg0: cell.method }) : undefined}
            style={{
              padding: '4px 8px',
              border: `1px solid ${isMethodValid ? theme.border : theme.error}`,
              borderRadius: '3px',
              backgroundColor: isMethodValid ? theme.surface : theme.errorLight,
              fontSize: '13px',
              fontFamily: 'inherit',
              fontWeight: 600,
              color: isMethodValid ? theme.primary : theme.textMuted,
              cursor: 'pointer',
            }}
          >
            {httpMethodOptions.map(opt => {
              const isAllowed = allowedMethods === null || allowedMethods.includes(opt.value as HttpMethod);
              return (
                <option 
                  key={opt.value} 
                  value={opt.value}
                  style={{ color: isAllowed ? theme.text : theme.textMuted }}
                >
                  {opt.text}{!isAllowed ? ' ✗' : ''}
                </option>
              );
            })}
          </select>
          <div style={{ flex: 1, position: 'relative' }} ref={endpointInputRef}>
            <input
              type="text"
              value={cell.endpoint}
              onChange={(e) => {
                onUpdate({ endpoint: e.target.value });
                const suggestions = getEndpointSuggestionsWithIndices(e.target.value, cell.method, clusterIndices);
                if (suggestions.length > 0) {
                  setEndpointSuggestions(suggestions.slice(0, 10));
                  setIsEndpointPopoverOpen(true);
                  setHoveredSuggestionIndex(-1);
                } else {
                  setEndpointSuggestions([]);
                  setIsEndpointPopoverOpen(false);
                }
              }}
              onFocus={handleEndpointFocus}
              onKeyDown={handleEndpointKeyDown}
              placeholder="/_search"
              disabled={isExecuting}
              style={{
                width: '100%',
                padding: '4px 8px',
                border: `1px solid ${theme.border}`,
                borderRadius: '3px',
                fontSize: '13px',
                fontFamily: 'inherit',
                backgroundColor: connection ? theme.surface : theme.warningLight,
                color: theme.text,
              }}
            />
            {/* Endpoint suggestions dropdown */}
            {isEndpointPopoverOpen && endpointSuggestions.length > 0 && (
              <div style={suggestionListStyles}>
                {endpointSuggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.endpoint}
                    style={index === hoveredSuggestionIndex ? suggestionItemHoverStyles : suggestionItemStyles}
                    onClick={() => handleEndpointSelect(suggestion)}
                    onMouseEnter={() => setHoveredSuggestionIndex(index)}
                  >
                    <div style={{ fontWeight: 500 }}>{suggestion.endpoint}</div>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>{t(suggestion.description)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* API Documentation button */}
          <button
            onClick={() => {
              setDocumentationError(false);
              void openApiDocumentation(cell.endpoint, cell.method).catch(() => setDocumentationError(true));
            }}
            aria-label={t('API Documentation')}
            title={getApiDocumentation(cell.endpoint, cell.method)?.title || t('API Documentation')}
            style={{
              padding: '4px 8px',
              border: `1px solid ${theme.border}`,
              borderRadius: '3px',
              backgroundColor: theme.surface,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.primary,
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.surfaceHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = theme.surface)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
          </button>
          {/* Profile button - only show for search endpoints */}
          {onRunWithProfile && cell.endpoint.includes('_search') && (
            <button
              onClick={onRunWithProfile}
              disabled={isExecuting || !connection}
              title={t('Run with profiling enabled')}
              style={{
                padding: '4px 8px',
                border: `1px solid ${theme.border}`,
                borderRadius: '3px',
                backgroundColor: isExecuting ? theme.surfaceHover : theme.surface,
                cursor: isExecuting || !connection ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                color: isExecuting || !connection ? theme.textMuted : theme.primary,
                transition: 'background-color 0.15s ease',
                fontSize: '12px',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => {
                if (!isExecuting && connection) {
                  e.currentTarget.style.backgroundColor = theme.surfaceHover;
                }
              }}
              onMouseLeave={(e) => {
                if (!isExecuting) {
                  e.currentTarget.style.backgroundColor = theme.surface;
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
              </svg>{t('Profile')}</button>
          )}
        </div>

        {/* Warning for GET with body */}
        {cell.method === 'GET' && cell.body && cell.body.trim().length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            marginBottom: '8px',
            backgroundColor: theme.warningLight,
            border: `1px solid ${theme.warning}`,
            borderRadius: '3px',
            fontSize: '12px',
            color: theme.warning,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
            </svg>
            <span>{t('GET requests typically should not have a body. Consider using POST for search queries.')}</span>
          </div>
        )}

        {documentationError && (
          <div role="alert" style={{ color: theme.error, marginBottom: '8px' }}>
            {t('Unable to open API documentation. Please try again.')}
          </div>
        )}
        {/* JSON Body Editor */}
        <div style={{ 
          border: `1px solid ${theme.border}`, 
          borderRadius: '3px', 
          overflow: 'visible',
          backgroundColor: theme.surface,
          position: 'relative',
        }}>
          <Editor
            height="120px"
            language="json"
            value={cell.body}
            onChange={handleBodyChange}
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
              quickSuggestions: { other: true, strings: true, comments: false },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'off',
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
                marginBottom: '4px',
                fontSize: '12px',
                color: theme.textMuted,
              }}>
                <span style={{ color: theme.success, fontWeight: 500 }}>
                  {cell.lastResult?.statusCode}
                </span>
                <span>{cell.lastResult?.duration}ms</span>
              </div>
              <pre style={successOutputStyles}>
                {formatJson(resultBody)}
              </pre>
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
                {formatJson(resultBody)}
              </pre>
            </div>
          )}
          
          {/* Profile visualization */}
          {profileData && (
            <div style={{ marginTop: '16px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}>
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  style={{
                    padding: '4px 12px',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '3px',
                    backgroundColor: showProfile ? theme.primary : theme.surface,
                    color: showProfile ? '#fff' : theme.primary,
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 11H2v3h2v-3zm5-4H7v7h2V7zm5-5h-2v12h2V2zm-2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1h-2zM6 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm-5 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3z"/>
                  </svg>
                  {showProfile ? t('Hide Profile') : t('Show Profile')}
                </button>
                <span style={{ fontSize: '11px', color: theme.textMuted }}>
                  {t(profileData.shards.length === 1 ? '{count} shard profiled' : '{count} shards profiled', { count: profileData.shards.length })}</span>
              </div>
              
              {showProfile && (
                <ProfileVisualization profileData={profileData} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QueryCell;
