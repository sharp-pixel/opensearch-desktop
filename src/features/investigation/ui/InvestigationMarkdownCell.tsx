// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../i18n';
/**
 * Investigation Markdown Cell Component
 * Markdown editor for investigation documentation
 * Requirements: 3.1, 3.3
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { InvestigationMarkdownCell as InvestigationMarkdownCellType } from '../../../types/investigation';
import { renderMarkdown } from '../../../utils/markdownRenderer';
import { useTheme } from '../../../context/ThemeContext';
import { useInvestigationStore } from './InvestigationContext';
import 'katex/dist/katex.min.css';

export interface InvestigationMarkdownCellProps {
  cell: InvestigationMarkdownCellType;
  onDelete: () => void;
}

const EMPTY_PLACEHOLDER = 'Double-click to add documentation...';

/**
 * Investigation Markdown Cell - documentation for investigation
 */
export function InvestigationMarkdownCell({
  cell,
  onDelete,
}: InvestigationMarkdownCellProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const { updateCell } = useInvestigationStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(cell.content);
  const [isHovered, setIsHovered] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditContent(cell.content);
    }
  }, [cell.content, isEditing]);

  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.focus();
      const length = textAreaRef.current.value.length;
      textAreaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    setEditContent(cell.content);
  }, [cell.content]);

  const handleSave = useCallback(() => {
    updateCell(cell.id, { content: editContent });
    setIsEditing(false);
  }, [cell.id, editContent, updateCell]);

  const handleCancel = useCallback(() => {
    setEditContent(cell.content);
    setIsEditing(false);
  }, [cell.content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleCancel, handleSave]
  );

  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, handleSave]);

  const renderedHtml = renderMarkdown(cell.content);
  const isEmpty = !cell.content || cell.content.trim() === '';

  return (
    <div
      ref={containerRef}
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
            backgroundColor: theme.successLight,
            color: theme.success,
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: 600,
          }}>
            MD
          </span>
          <span style={{ fontSize: '12px', color: theme.textMuted }}>{t('Documentation')}</span>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}>
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

      {/* Content */}
      <div style={{ padding: '12px' }}>
        {isEditing ? (
          <div>
            <textarea
              ref={textAreaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('Enter markdown content...')}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '8px 12px',
                border: `1px solid ${theme.border}`,
                borderRadius: '3px',
                fontSize: '14px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                lineHeight: '1.5',
                resize: 'vertical',
                backgroundColor: theme.surface,
                color: theme.text,
              }}
            />
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '8px',
              marginTop: '8px',
            }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: theme.textMuted,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >{t('Cancel')}</button>
              <button
                onClick={handleSave}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: theme.primary,
                  color: '#fff',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >{t('Save')}</button>
            </div>
          </div>
        ) : (
          <div
            onDoubleClick={handleDoubleClick}
            style={{ cursor: 'text', minHeight: '24px' }}
          >
            {isEmpty ? (
              <span style={{ fontSize: '14px', color: theme.textMuted, fontStyle: 'italic' }}>
                {EMPTY_PLACEHOLDER}
              </span>
            ) : (
              <div
                className="markdown-content"
                style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: theme.textSecondary,
                }}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default InvestigationMarkdownCell;
