// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
/**
 * MarkdownCell Component - Markdown editor with view/edit modes
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactElement } from 'react';
import type { MarkdownCell as MarkdownCellType } from '../../../../types/cell';
import { renderMarkdown } from '../../../../utils/markdownRenderer';
import { useTheme } from '../../../../context/ThemeContext';
// Import KaTeX CSS for math rendering
import 'katex/dist/katex.min.css';

export interface MarkdownCellProps {
  cell: MarkdownCellType;
  onUpdate: (updates: Partial<MarkdownCellType>) => void;
}

/**
 * Placeholder content for empty markdown cells
 */
const EMPTY_PLACEHOLDER = 'Double-click to add documentation...';

function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  useLanguage();
  const { theme } = useTheme();
  const [show, setShow] = useState(false);
  
  return (
    <div 
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '4px',
          padding: '4px 8px',
          backgroundColor: theme.text,
          color: theme.background,
          fontSize: '11px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          zIndex: 1000,
        }}>
          {content}
        </div>
      )}
    </div>
  );
}

/**
 * MarkdownCell component - notebook text cell
 */
export function MarkdownCell({
  cell,
  onUpdate,
}: MarkdownCellProps): ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(cell.content);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync edit content when cell content changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditContent(cell.content);
    }
  }, [cell.content, isEditing]);

  // Focus textarea when entering edit mode
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

  const handleContentChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setEditContent(e.target.value);
    },
    []
  );

  const handleSave = useCallback(() => {
    onUpdate({ content: editContent });
    setIsEditing(false);
  }, [editContent, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditContent(cell.content);
    setIsEditing(false);
  }, [cell.content]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
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

  // Handle click outside to save
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

  const buttonStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background-color 0.15s ease',
  };

  if (isEditing) {
    return (
      <div ref={containerRef}>
        <textarea
          ref={textAreaRef}
          value={editContent}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={t('Enter markdown content...')}
          aria-label={t('Markdown content')}
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
          <Tooltip content="Cancel (Escape)">
            <button style={{ ...buttonStyles, color: theme.textMuted }} onClick={handleCancel}>{t('Cancel')}</button>
          </Tooltip>
          <Tooltip content="Save (⌘+Enter)">
            <button style={{ ...buttonStyles, color: theme.primary }} onClick={handleSave}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.5 12.5l-4-4 1.4-1.4 2.6 2.6 6.6-6.6 1.4 1.4-8 8z"/>
              </svg>{t('Save')}</button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{ 
        cursor: 'text', 
        minHeight: '24px',
        padding: '4px 0',
      }}
      role="button"
      tabIndex={0}
      aria-label={t('Double-click to edit markdown')}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
          handleDoubleClick();
        }
      }}
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
  );
}

export default MarkdownCell;
