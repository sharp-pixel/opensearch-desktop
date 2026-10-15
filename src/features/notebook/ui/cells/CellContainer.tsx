// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { t, useLanguage } from '../../../../i18n';
/**
 * CellContainer Component - notebook cell with bracket grouping
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import React, { useState, useRef, useEffect } from 'react';
import type { Cell, CellType } from '../../../../types/cell';
import { useTheme } from '../../../../context/ThemeContext';

export interface CellContainerProps {
  cell: Cell;
  isSelected: boolean;
  isExecuting: boolean;
  isDragging?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRun?: () => void;
  onTypeChange: (type: CellType) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  children: React.ReactNode;
}

/**
 * CellContainer component - with left bracket indicator
 */
export function CellContainer({
  cell,
  isSelected,
  isExecuting,
  isDragging = false,
  onSelect,
  onDelete,
  onRun,
  onTypeChange,
  onDragStart,
  onDragEnd,
  children,
}: CellContainerProps): React.ReactElement {
  useLanguage();
  const { theme, mode } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTypeDropdown(false);
      }
    };

    if (showTypeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTypeDropdown]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && cell.type !== 'markdown' && !isExecuting && onRun) {
      e.preventDefault();
      onRun();
    }
  };

  const handleTypeSelect = (newType: CellType) => {
    if (isExecuting) return;
    onTypeChange(newType);
    setShowTypeDropdown(false);
  };

  // Bracket color based on cell type and state
  const getBracketColor = () => {
    if (isExecuting) return theme.primary;
    if (isSelected) {
      if (cell.type === 'grpc') return theme.info;
      if (cell.type === 'query') return theme.primary;
      if (cell.type === 'ppl') return '#9b59b6'; // Purple for PPL
      return theme.success; // Green for markdown
    }
    return theme.border;
  };

  // Get cell type label and colors
  const getCellTypeInfo = () => {
    switch (cell.type) {
      case 'query':
        return { label: 'REST', color: theme.primary, bgColor: theme.primaryLight };
      case 'grpc':
        return { label: 'gRPC', color: theme.info, bgColor: theme.infoLight };
      case 'ppl':
        return { label: 'PPL', color: '#9b59b6', bgColor: mode === 'dark' ? '#3d2a4d' : '#f3e8ff' };
      case 'markdown':
        return { label: 'Markdown', color: theme.success, bgColor: theme.successLight };
    }
  };

  const cellTypeInfo = getCellTypeInfo();

  const iconButtonStyle: React.CSSProperties = {
    padding: '4px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: '3px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        opacity: isDragging ? 0.5 : 1,
        transition: 'opacity 0.15s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Bracket on the left */}
      <div
        style={{
          width: '20px',
          minWidth: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          paddingRight: '2px',
          cursor: 'pointer',
        }}
        onClick={onSelect}
      >
        {/* Single continuous bracket using border */}
        <div
          style={{
            flex: 1,
            width: '12px',
            borderLeft: `2px solid ${getBracketColor()}`,
            borderTop: `2px solid ${getBracketColor()}`,
            borderBottom: `2px solid ${getBracketColor()}`,
            borderTopLeftRadius: '4px',
            borderBottomLeftRadius: '4px',
            transition: 'border-color 0.15s ease',
            minHeight: '40px',
          }}
        />
      </div>

      {/* Cell content area */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: isSelected ? theme.surfaceHover : theme.surface,
          borderRadius: '4px',
          transition: 'background-color 0.15s ease',
        }}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-pressed={isSelected}
      >
        {/* Cell label row - shows on hover or when selected */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            minHeight: '28px',
            opacity: isHovered || isSelected ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Drag handle - native HTML5 drag */}
            <div 
              draggable
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              style={{ 
                display: 'flex', 
                alignItems: 'center',
                cursor: 'grab',
                padding: '4px',
                borderRadius: '3px',
                color: theme.textMuted,
              }}
              title={t('Drag to reorder')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="3" r="1.5" />
                <circle cx="11" cy="3" r="1.5" />
                <circle cx="5" cy="8" r="1.5" />
                <circle cx="11" cy="8" r="1.5" />
                <circle cx="5" cy="13" r="1.5" />
                <circle cx="11" cy="13" r="1.5" />
              </svg>
            </div>
            
            {/* Cell type dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTypeDropdown(!showTypeDropdown);
                }}
                title={t('Change cell type')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: cell.type === 'grpc' ? 'none' : 'uppercase',
                  letterSpacing: '0.5px',
                  color: cellTypeInfo.color,
                  backgroundColor: cellTypeInfo.bgColor,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {t(cellTypeInfo.label)}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              {/* Dropdown menu */}
              {showTypeDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    minWidth: '100px',
                    overflow: 'hidden',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleTypeSelect('query')}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: cell.type === 'query' ? theme.primaryLight : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: theme.primary,
                      fontWeight: cell.type === 'query' ? 600 : 400,
                    }}
                  >
                    REST
                  </button>
                  <button
                    onClick={() => handleTypeSelect('ppl')}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: cell.type === 'ppl' ? (mode === 'dark' ? '#3d2a4d' : '#f3e8ff') : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#9b59b6',
                      fontWeight: cell.type === 'ppl' ? 600 : 400,
                    }}
                  >
                    PPL
                  </button>
                  <button onClick={() => handleTypeSelect('grpc')} disabled={isExecuting}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12, color: theme.info, background: cell.type === 'grpc' ? theme.infoLight : 'transparent' }}>gRPC</button>
                  <button
                    onClick={() => handleTypeSelect('markdown')}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: cell.type === 'markdown' ? theme.successLight : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: theme.success,
                      fontWeight: cell.type === 'markdown' ? 600 : 400,
                    }}
                  >{t('Markdown')}</button>
                </div>
              )}
            </div>

            {isExecuting && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 500,
                color: theme.primary,
                backgroundColor: theme.primaryLight,
              }}>{t('Running...')}</span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {(cell.type !== 'markdown') && onRun && (
              <button
                style={{
                  ...iconButtonStyle,
                  color: cell.type === 'ppl' ? '#9b59b6' : theme.primary,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRun();
                }}
                disabled={isExecuting}
                title={t('Run (⌘+Enter)')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2l10 6-10 6V2z"/>
                </svg>
              </button>
            )}
            <button
              style={{
                ...iconButtonStyle,
                color: theme.error,
              }}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onDelete();
              }}
              title={t('Delete cell')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11 3h3v1h-1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4H2V3h3V2a1 1 0 011-1h4a1 1 0 011 1v1zM5 3h6V2H5v1zm-1 1v10h8V4H4zm2 2h1v6H6V6zm3 0h1v6H9V6z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Main cell content */}
        <div style={{ padding: '0 8px 8px 8px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default CellContainer;
