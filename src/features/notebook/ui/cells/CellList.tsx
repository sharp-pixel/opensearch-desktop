// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0 AND MIT
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
//
// Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.

import { t, useLanguage } from '../../../../i18n';
/**
 * CellList Component - Manages list of cells with drag-drop reordering
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import React, { useCallback, useState, useRef } from 'react';
import type { Cell, CellType, QueryCell as QueryCellType, MarkdownCell as MarkdownCellType, PPLCell as PPLCellType } from '../../../../types/cell';
import type { ConnectionConfig } from '../../../../types/connection';
import { resultIsStale } from '../../../../execution/provenance';
import { CellContainer } from './CellContainer';
import { QueryCell } from './QueryCell';
import { MarkdownCell } from './MarkdownCell';
import { GrpcCell } from './GrpcCell';
import { PPLCell } from './PPLCell';
import { useTheme } from '../../../../context/ThemeContext';

export interface CellListProps {
  cells: Cell[];
  selectedCellId: string | null;
  executingCellIds: Set<string>;
  connection: ConnectionConfig | null;
  onSelectCell: (cellId: string) => void;
  onDeleteCell: (cellId: string) => void;
  onConvertCell: (cellId: string, type: CellType) => void;
  onUpdateCell: (cellId: string, updates: Partial<Cell>) => void;
  onReorderCells: (cellIds: string[]) => void;
  onRunCell: (cellId: string) => void;
  onRunCellWithProfile?: (cellId: string) => void;
  onAddCell?: (type: CellType, afterCellId?: string) => void;
}


const CellContent = React.memo(function CellContent({ cell, connection, isExecuting, onUpdateCell, onRunCell, onRunCellWithProfile }: {
  cell: Cell; connection: ConnectionConfig | null; isExecuting: boolean;
  onUpdateCell: CellListProps['onUpdateCell']; onRunCell: CellListProps['onRunCell'];
  onRunCellWithProfile: CellListProps['onRunCellWithProfile'];
}) {
  useLanguage();
  return cell.type === 'query' ? (
                <QueryCell
                  cell={cell as QueryCellType}
                  connection={connection}
                  isExecuting={isExecuting}
                  onUpdate={(updates) => onUpdateCell(cell.id, updates)}
                  onRun={() => onRunCell(cell.id)}
                  onRunWithProfile={onRunCellWithProfile ? () => onRunCellWithProfile(cell.id) : undefined}
                />
              ) : cell.type === 'grpc' ? (
                <GrpcCell cell={cell} connection={connection} isExecuting={isExecuting}
                  onUpdate={updates => onUpdateCell(cell.id, updates)} onRun={() => onRunCell(cell.id)} />
              ) : cell.type === 'ppl' ? (
                <PPLCell
                  cell={cell as PPLCellType}
                  connection={connection}
                  isExecuting={isExecuting}
                  onUpdate={(updates) => onUpdateCell(cell.id, updates)}
                  onRun={() => onRunCell(cell.id)}
                />
              ) : (
                <MarkdownCell
                  cell={cell as MarkdownCellType}
                  onUpdate={(updates) => onUpdateCell(cell.id, updates)}
                />
              );
});

/**
 * Insert cell buttons that appear between cells
 */
function InsertCellButtons({ 
  onAdd, 
  visible 
}: { 
  onAdd: (type: CellType) => void; 
  visible: boolean;
}): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  
  const buttonStyle: React.CSSProperties = {
    padding: '4px 12px',
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    backgroundColor: theme.surface,
    color: theme.textMuted,
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s ease',
  };

  return (
    <div
      style={{
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.15s ease',
        margin: '4px 0',
      }}
    >
      <button
        onClick={() => onAdd('query')}
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = theme.primary;
          e.currentTarget.style.color = theme.primary;
          e.currentTarget.style.backgroundColor = theme.primaryLight;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = theme.border;
          e.currentTarget.style.color = theme.textMuted;
          e.currentTarget.style.backgroundColor = theme.surface;
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
        </svg>
        REST
      </button>
      <button
        onClick={() => onAdd('ppl')}
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = theme.primary;
          e.currentTarget.style.color = theme.primary;
          e.currentTarget.style.backgroundColor = theme.primaryLight;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = theme.border;
          e.currentTarget.style.color = theme.textMuted;
          e.currentTarget.style.backgroundColor = theme.surface;
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
        </svg>
        PPL
      </button>
      <button onClick={() => onAdd('grpc')} style={buttonStyle}>{t('+ gRPC')}</button>
      <button
        onClick={() => onAdd('markdown')}
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = theme.primary;
          e.currentTarget.style.color = theme.primary;
          e.currentTarget.style.backgroundColor = theme.primaryLight;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = theme.border;
          e.currentTarget.style.color = theme.textMuted;
          e.currentTarget.style.backgroundColor = theme.surface;
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
        </svg>{t('Markdown')}</button>
    </div>
  );
}

/**
 * Empty state when no cells exist
 */
function EmptyCellsState({ onAddCell }: { onAddCell?: (type: CellType) => void }): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  
  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    backgroundColor: theme.surface,
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.15s ease',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 40px',
        textAlign: 'center',
        minHeight: '400px',
      }}
    >
      {/* Illustration */}
      <div
        style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          backgroundColor: theme.primaryLight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          {/* Notebook icon */}
          <rect x="12" y="8" width="32" height="40" rx="3" fill={theme.primaryLight} stroke={theme.primary} strokeWidth="2"/>
          <rect x="16" y="14" width="18" height="3" rx="1.5" fill={theme.primary}/>
          <rect x="16" y="21" width="24" height="2" rx="1" fill={theme.border}/>
          <rect x="16" y="26" width="20" height="2" rx="1" fill={theme.border}/>
          <rect x="16" y="31" width="22" height="2" rx="1" fill={theme.border}/>
          <rect x="16" y="36" width="16" height="2" rx="1" fill={theme.border}/>
          {/* Plus badge */}
          <circle cx="42" cy="40" r="10" fill={theme.primary}/>
          <path d="M42 35v10M37 40h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Title */}
      <h2
        style={{
          margin: '0 0 12px 0',
          fontSize: '22px',
          fontWeight: 600,
          color: theme.text,
        }}
      >{t('Start Your Notebook')}</h2>

      {/* Description */}
      <p
        style={{
          margin: '0 0 32px 0',
          fontSize: '15px',
          color: theme.textMuted,
          maxWidth: '400px',
          lineHeight: 1.6,
        }}
      >{t('Add cells to write OpenSearch queries and document your work. REST cells execute REST calls, gRPC cells send Protobuf requests, PPL cells run queries, and Markdown cells help you organize.')}</p>

      {/* Action buttons */}
      {onAddCell && (
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onAddCell('query')}
            style={{
              ...buttonStyle,
              border: `1px solid ${theme.primary}`,
              backgroundColor: theme.primaryLight,
              color: theme.primary,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 2a2 2 0 00-2 2v8a2 2 0 002 2h4a2 2 0 002-2V4a2 2 0 00-2-2H6zm0 1h4a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/>
              <path d="M6.5 5h3v1h-3V5zm0 2h3v1h-3V7zm0 2h2v1h-2V9z"/>
            </svg>{t('REST Query')}</button>
          <button
            onClick={() => onAddCell('ppl')}
            style={{
              ...buttonStyle,
              color: theme.text,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/>
              <path d="M6 6h4v1H6V6zm0 2h4v1H6V8zm0 2h2v1H6v-1z"/>
            </svg>{t('PPL Query')}</button>
          <button onClick={() => onAddCell('grpc')} style={{ ...buttonStyle, color: theme.text }}>gRPC</button>
          <button
            onClick={() => onAddCell('markdown')}
            style={{
              ...buttonStyle,
              color: theme.text,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14 1H2a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V2a1 1 0 00-1-1zM2 0a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V2a2 2 0 00-2-2H2z"/>
              <path d="M9.146 8.146a.5.5 0 01.708 0L11.5 9.793l1.646-1.647a.5.5 0 01.708.708l-2 2a.5.5 0 01-.708 0l-2-2a.5.5 0 010-.708z"/>
              <path d="M11.5 5a.5.5 0 01.5.5v4a.5.5 0 01-1 0v-4a.5.5 0 01.5-.5z"/>
              <path d="M3.56 11V5.01h1.064l1.216 3.352 1.216-3.352h1.064V11H7.04V6.57L5.84 9.922h-.56L4.08 6.57V11H3.56z"/>
            </svg>{t('Markdown')}</button>
        </div>
      )}
    </div>
  );
}

/**
 * CellList component - renders cells with native HTML5 drag-drop support
 */
export function CellList({
  cells,
  selectedCellId,
  executingCellIds,
  connection,
  onSelectCell,
  onDeleteCell,
  onUpdateCell,
  onConvertCell,
  onReorderCells,
  onRunCell,
  onRunCellWithProfile,
  onAddCell,
}: CellListProps): React.ReactElement {
  useLanguage();
  const { theme } = useTheme();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setTimeout(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = '0.5';
    }, 0);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedIndex;
    
    if (sourceIndex !== null && sourceIndex !== dropIndex) {
      const newCellIds = [...cells.map(c => c.id)];
      const [removed] = newCellIds.splice(sourceIndex, 1);
      if (removed !== undefined) {
        newCellIds.splice(dropIndex, 0, removed);
        onReorderCells(newCellIds);
      }
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  }, [cells, draggedIndex, onReorderCells]);

  const handleTypeChange = onConvertCell;

  const handleInsertCell = useCallback((type: CellType, afterCellId?: string) => {
    if (onAddCell) {
      onAddCell(type, afterCellId);
    }
  }, [onAddCell]);

  if (cells.length === 0) {
    return <EmptyCellsState onAddCell={(type) => handleInsertCell(type)} />;
  }

  return (
    <div>
      {cells.map((cell, index) => (
        <div
          key={cell.id}
          onMouseEnter={() => setHoveredInsertIndex(index)}
          onMouseLeave={() => setHoveredInsertIndex(null)}
        >
          {/* Insert button before first cell */}
          {index === 0 && (
            <InsertCellButtons
              onAdd={(type) => handleInsertCell(type, '__BEGINNING__')}
              visible={hoveredInsertIndex === 0}
            />
          )}
          
          <div
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            style={{
              position: 'relative',
              transition: 'transform 0.15s ease',
            }}
          >
            {/* Drop indicator line */}
            {dragOverIndex === index && draggedIndex !== null && draggedIndex > index && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 20,
                  right: 0,
                  height: '2px',
                  backgroundColor: theme.primary,
                  zIndex: 10,
                }}
              />
            )}
            
            <CellContainer
              cell={cell}
              isSelected={selectedCellId === cell.id}
              isExecuting={executingCellIds.has(cell.id)}
              isDragging={draggedIndex === index}
              onSelect={() => onSelectCell(cell.id)}
              onDelete={() => onDeleteCell(cell.id)}
              onRun={(cell.type !== 'markdown') ? () => onRunCell(cell.id) : undefined}
              onTypeChange={(type) => handleTypeChange(cell.id, type)}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
            >
              {resultIsStale(cell, connection) && <p role="status" style={{ padding: '0 16px', color: theme.textMuted }}>{t('Inputs or connection settings changed since this result was produced. Run again to refresh it.')}</p>}
              <CellContent cell={cell} connection={connection} isExecuting={executingCellIds.has(cell.id)}
                onUpdateCell={onUpdateCell} onRunCell={onRunCell} onRunCellWithProfile={onRunCellWithProfile} />
            </CellContainer>
            
            {/* Drop indicator line for dropping after */}
            {dragOverIndex === index && draggedIndex !== null && draggedIndex < index && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 20,
                  right: 0,
                  height: '2px',
                  backgroundColor: theme.primary,
                  zIndex: 10,
                }}
              />
            )}
          </div>
          
          {/* Insert button after each cell */}
          <InsertCellButtons
            onAdd={(type) => handleInsertCell(type, cell.id)}
            visible={hoveredInsertIndex === index}
          />
        </div>
      ))}
    </div>
  );
}

export default CellList;
