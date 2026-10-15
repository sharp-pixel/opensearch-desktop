// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { Investigation, InvestigationCell, InvestigationPPLCell, InvestigationMarkdownCell, ClusterGroup } from '../../../types/investigation';

export function newInvestigation(id: string, name: string, clusterGroupId: string, now: number): Investigation {
  return { id, name, clusterGroupId, cells: [], createdAt: now, updatedAt: now };
}
export function newPPLCell(id: string, now: number): InvestigationPPLCell {
  return { id, type: 'ppl', query: '', createdAt: now, updatedAt: now };
}
export function newMarkdownCell(id: string, now: number): InvestigationMarkdownCell {
  return { id, type: 'markdown', content: '', createdAt: now, updatedAt: now };
}
export function newClusterGroup(id: string, name: string, connectionIds: string[]): ClusterGroup {
  return { id, name, connectionIds: [...new Set(connectionIds)] };
}
export function addCell(document: Investigation, cell: InvestigationCell, now: number, afterCellId?: string): Investigation {
  if (document.cells.some(existing => existing.id === cell.id)) return document;
  const cells = [...document.cells];
  const index = afterCellId ? cells.findIndex(existing => existing.id === afterCellId) : -1;
  cells.splice(index >= 0 ? index + 1 : cells.length, 0, cell);
  return { ...document, cells, updatedAt: now };
}
export function updateCell(document: Investigation, cellId: string, updates: Partial<InvestigationCell>, now: number): Investigation {
  if (!document.cells.some(cell => cell.id === cellId)) return document;
  return { ...document, updatedAt: now, cells: document.cells.map(cell => cell.id === cellId
    ? { ...cell, ...updates, id: cell.id, type: cell.type, createdAt: cell.createdAt, updatedAt: now } as InvestigationCell : cell) };
}
export function deleteCell(document: Investigation, cellId: string, now: number): Investigation {
  const cells = document.cells.filter(cell => cell.id !== cellId);
  return cells.length === document.cells.length ? document : { ...document, cells, updatedAt: now };
}
export function reorderCells(document: Investigation, ids: string[], now: number): Investigation {
  const cells = new Map(document.cells.map(cell => [cell.id, cell]));
  if (ids.length !== cells.size || new Set(ids).size !== ids.length || ids.some(id => !cells.has(id))) return document;
  return { ...document, cells: ids.map(id => cells.get(id)!), updatedAt: now };
}
