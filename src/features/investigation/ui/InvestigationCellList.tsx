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
 * Investigation Cell List Component
 * Renders PPL and Markdown cells for investigation
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React, { useState, useCallback, memo } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { useInvestigationStore, useInvestigationSelector } from './InvestigationContext';
import { InvestigationPPLCell } from './InvestigationPPLCell';
import { InvestigationMarkdownCell } from './InvestigationMarkdownCell';
import type { InvestigationCell, InvestigationCellType } from '../../../types/investigation';

const EMPTY_CELLS: InvestigationCell[] = [];
const CellEditor = memo(function CellEditor({ cell, onDelete }: { cell: InvestigationCell; onDelete: (id: string) => void }) {
  useLanguage();
  const remove = useCallback(() => onDelete(cell.id), [onDelete, cell.id]);
  return cell.type === 'ppl'
    ? <InvestigationPPLCell cell={cell} onDelete={remove} />
    : <InvestigationMarkdownCell cell={cell} onDelete={remove} />;
});

export const InvestigationCellList = memo(function InvestigationCellList() {
  useLanguage();
  const { theme } = useTheme();
  const { addCell, deleteCell, reorderCells } = useInvestigationStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const cells = useInvestigationSelector(state => state.activeInvestigation?.cells ?? EMPTY_CELLS);

  const handleAddCell = useCallback((type: InvestigationCellType, afterCellId?: string) => {
    addCell(type, afterCellId);
  }, [addCell]);

  const handleDeleteCell = useCallback((cellId: string) => {
    deleteCell(cellId);
  }, [deleteCell]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newOrder = [...cells.map((c) => c.id)];
      const removed = newOrder.splice(draggedIndex, 1)[0];
      if (removed) {
        newOrder.splice(dragOverIndex, 0, removed);
        reorderCells(newOrder);
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, cells, reorderCells]);

  const renderCell = (cell: InvestigationCell, index: number) => {

    return (
      <div
        key={cell.id}
        draggable
        onDragStart={(e) => handleDragStart(e, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragEnd={handleDragEnd}
        style={{
          opacity: draggedIndex === index ? 0.5 : 1,
          borderTop: dragOverIndex === index && draggedIndex !== null && draggedIndex > index
            ? `2px solid ${theme.primary}`
            : 'none',
          borderBottom: dragOverIndex === index && draggedIndex !== null && draggedIndex < index
            ? `2px solid ${theme.primary}`
            : 'none',
        }}
      >
        <CellEditor cell={cell} onDelete={handleDeleteCell} />

        {/* Add cell button between cells */}
        <AddCellButton
          onAdd={(type) => handleAddCell(type, cell.id)}
        />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Add cell buttons at top - always visible */}
      <AddCellButton
        onAdd={(type) => handleAddCell(type, '__BEGINNING__')}
        alwaysVisible
      />

      {/* Empty state when no cells */}
      {cells.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
          border: `2px dashed ${theme.border}`,
          borderRadius: '8px',
          backgroundColor: theme.surface,
        }}>
          <p style={{
            margin: '0',
            fontSize: '14px',
            color: theme.textMuted,
          }}>{t('Start your investigation by adding a cell above')}</p>
        </div>
      )}

      {/* Render cells */}
      {cells.map((cell, index) => renderCell(cell, index))}
    </div>
  );
});

/**
 * Add cell button component
 */
function AddCellButton({ onAdd, alwaysVisible = false }: { onAdd: (type: InvestigationCellType) => void; alwaysVisible?: boolean }) {
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
      className={`cell-insert-controls${alwaysVisible ? ' always-visible' : ''}`}
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '4px 0',
        transition: 'opacity 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', gap: '8px' }}>
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
    </div>
  );
}
