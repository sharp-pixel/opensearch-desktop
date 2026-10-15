// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/** Compatibility API for callers that explicitly request an immediate durable edit. */
import type { Notebook } from '../types/notebook';
import type { Cell, CellType } from '../types/cell';
import { newNotebook, newCell } from '../features/notebook/domain/create';
import { appReducer, initialState, type AppAction } from '../features/notebook/domain/state';
import * as persistence from './persistence';

export function createNotebook(name: string): Notebook {
  const notebook = newNotebook(name, crypto.randomUUID(), Date.now());
  persistence.saveNotebook(notebook);
  return notebook;
}
export function loadNotebook(id: string): Notebook | null { return persistence.loadNotebook(id)?.notebook ?? null; }
export function saveNotebook(notebook: Notebook): void { persistence.saveNotebook({ ...notebook, updatedAt: Date.now() }); }
export function deleteNotebookById(id: string): void { persistence.deleteNotebook(id); }
export const listNotebooks = persistence.listNotebooks;

function edit(notebook: Notebook, action: AppAction): Notebook {
  const state = appReducer({ ...initialState, activeNotebook: notebook }, action, Date.now());
  const updated = state.activeNotebook!;
  if (updated !== notebook) persistence.saveNotebook(updated);
  return updated;
}
export function renameNotebook(id: string, name: string): Notebook | null {
  const notebook = loadNotebook(id);
  return notebook ? edit(notebook, { type: 'RENAME_NOTEBOOK', payload: name }) : null;
}
export function addCell(notebook: Notebook, type: CellType, afterCellId?: string): { notebook: Notebook; cell: Cell } {
  const cell = newCell(type, crypto.randomUUID(), Date.now());
  return { notebook: edit(notebook, { type: 'ADD_CELL', payload: { cell, afterCellId } }), cell };
}
export function getCell(notebook: Notebook, cellId: string): Cell | null { return notebook.cells.find(cell => cell.id === cellId) ?? null; }
export function updateCell(notebook: Notebook, cellId: string, updates: Partial<Cell>): Notebook | null {
  return getCell(notebook, cellId) ? edit(notebook, { type: 'UPDATE_CELL', payload: { cellId, updates } }) : null;
}
export function deleteCell(notebook: Notebook, cellId: string): Notebook | null {
  return getCell(notebook, cellId) ? edit(notebook, { type: 'DELETE_CELL', payload: cellId }) : null;
}
export function reorderCells(notebook: Notebook, ids: string[]): Notebook | null {
  if (ids.length !== notebook.cells.length || new Set(ids).size !== ids.length || ids.some(id => !getCell(notebook, id))) return null;
  return edit(notebook, { type: 'REORDER_CELLS', payload: ids });
}
export function convertCellType(notebook: Notebook, cellId: string, type: CellType): Notebook | null {
  const cell = getCell(notebook, cellId);
  if (!cell) return null;
  return cell.type === type ? notebook : edit(notebook, { type: 'CONVERT_CELL', payload: { cellId, type } });
}
