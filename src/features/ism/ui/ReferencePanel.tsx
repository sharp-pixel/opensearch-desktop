// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
/**
 * Reference Panel Component
 * Documentation for ISM actions and conditions
 */

import React, { useState } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { ACTION_REFERENCE, CONDITION_REFERENCE } from '../domain/ismActionReference';

export function ReferencePanel(): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.background,
    color: theme.textSecondary,
  };

  const searchContainerStyles: React.CSSProperties = {
    padding: '12px',
    borderBottom: `1px solid ${theme.border}`,
  };

  const searchInputStyles: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    backgroundColor: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    color: theme.textSecondary,
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
  };

  const sectionStyles: React.CSSProperties = {
    marginBottom: '24px',
  };

  const sectionTitleStyles: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: theme.textMuted,
    marginBottom: '12px',
    letterSpacing: '0.5px',
  };

  const itemStyles: React.CSSProperties = {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: '6px',
    marginBottom: '8px',
    overflow: 'hidden',
  };

  const itemHeaderStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    cursor: 'pointer',
  };

  const itemNameStyles: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: theme.text,
  };

  const expandIconStyles: React.CSSProperties = {
    color: theme.textMuted,
    fontSize: '12px',
  };

  const itemContentStyles: React.CSSProperties = {
    padding: '0 12px 12px',
    borderTop: `1px solid ${theme.border}`,
  };

  const descriptionStyles: React.CSSProperties = {
    fontSize: '12px',
    color: theme.textMuted,
    marginTop: '8px',
    lineHeight: 1.5,
  };

  const parameterListStyles: React.CSSProperties = {
    marginTop: '12px',
  };

  const parameterTitleStyles: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: theme.textMuted,
    marginBottom: '6px',
  };

  const parameterItemStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '6px',
    fontSize: '12px',
  };

  const paramNameStyles: React.CSSProperties = {
    fontFamily: 'monospace',
    color: theme.primary,
    backgroundColor: theme.primaryLight,
    padding: '1px 4px',
    borderRadius: '3px',
  };

  const paramTypeStyles: React.CSSProperties = {
    color: theme.textMuted,
    fontSize: '11px',
  };

  const requiredBadgeStyles: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 600,
    color: theme.error,
    backgroundColor: theme.errorLight,
    padding: '1px 4px',
    borderRadius: '3px',
  };

  const exampleContainerStyles: React.CSSProperties = {
    marginTop: '12px',
  };

  const exampleTitleStyles: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: theme.textMuted,
    marginBottom: '6px',
  };

  const exampleCodeStyles: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '11px',
    backgroundColor: theme.codeBackground,
    padding: '8px',
    borderRadius: '4px',
    overflow: 'auto',
    whiteSpace: 'pre',
    color: theme.textSecondary,
  };

  const copyButtonStyles: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '10px',
    backgroundColor: theme.border,
    border: 'none',
    borderRadius: '3px',
    color: theme.textSecondary,
    cursor: 'pointer',
    marginTop: '6px',
  };

  const filteredActions = (() => {
    if (!searchQuery) return ACTION_REFERENCE;
    const query = searchQuery.toLowerCase();
    return ACTION_REFERENCE.filter(
      a => a.name.toLowerCase().includes(query) ||
           t(a.description).toLowerCase().includes(query) || a.description.toLowerCase().includes(query)
    );
  })();

  const filteredConditions = (() => {
    if (!searchQuery) return CONDITION_REFERENCE;
    const query = searchQuery.toLowerCase();
    return CONDITION_REFERENCE.filter(
      c => c.name.toLowerCase().includes(query) ||
           t(c.description).toLowerCase().includes(query) || c.description.toLowerCase().includes(query)
    );
  })();

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div style={containerStyles}>
      <div style={searchContainerStyles}>
        <input
          type="text"
          placeholder={t('Search actions and conditions...')}
          style={searchInputStyles}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div style={contentStyles}>
        <div style={sectionStyles}>
          <div style={sectionTitleStyles}>{t('Actions (')}{filteredActions.length})</div>
          {filteredActions.map((action) => (
            <div key={action.name} style={itemStyles}>
              <div
                style={itemHeaderStyles}
                onClick={() => toggleExpanded(`action-${action.name}`)}
              >
                <span style={itemNameStyles}>{action.name}</span>
                <span style={expandIconStyles}>
                  {expandedItems.has(`action-${action.name}`) ? '▼' : '▶'}
                </span>
              </div>
              {expandedItems.has(`action-${action.name}`) && (
                <div style={itemContentStyles}>
                  <div style={descriptionStyles}>{t(action.description)}</div>
                  
                  {action.parameters.length > 0 && (
                    <div style={parameterListStyles}>
                      <div style={parameterTitleStyles}>{t('Parameters')}</div>
                      {action.parameters.map((param) => (
                        <div key={param.name} style={parameterItemStyles}>
                          <span style={paramNameStyles}>{param.name}</span>
                          <span style={paramTypeStyles}>({param.type})</span>
                          {param.required && <span style={requiredBadgeStyles}>{t('required')}</span>}
                          <span style={{ color: theme.textMuted }}>{t(param.description)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={exampleContainerStyles}>
                    <div style={exampleTitleStyles}>{t('Example')}</div>
                    <pre style={exampleCodeStyles}>{action.example}</pre>
                    <button
                      style={copyButtonStyles}
                      onClick={() => copyToClipboard(action.example)}
                    >{t('Copy')}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={sectionStyles}>
          <div style={sectionTitleStyles}>{t('Conditions (')}{filteredConditions.length})</div>
          {filteredConditions.map((condition) => (
            <div key={condition.name} style={itemStyles}>
              <div
                style={itemHeaderStyles}
                onClick={() => toggleExpanded(`condition-${condition.name}`)}
              >
                <span style={itemNameStyles}>{condition.name}</span>
                <span style={expandIconStyles}>
                  {expandedItems.has(`condition-${condition.name}`) ? '▼' : '▶'}
                </span>
              </div>
              {expandedItems.has(`condition-${condition.name}`) && (
                <div style={itemContentStyles}>
                  <div style={descriptionStyles}>{t(condition.description)}</div>
                  <div style={{ ...parameterItemStyles, marginTop: '8px' }}>
                    <span style={{ color: '#69707d' }}>{t('Type:')}</span>
                    <span style={paramTypeStyles}>{condition.valueType}</span>
                  </div>
                  <div style={exampleContainerStyles}>
                    <div style={exampleTitleStyles}>{t('Example')}</div>
                    <pre style={exampleCodeStyles}>{condition.example}</pre>
                    <button
                      style={copyButtonStyles}
                      onClick={() => copyToClipboard(condition.example)}
                    >{t('Copy')}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
