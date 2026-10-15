// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { Cell, CellType } from '../../../types/cell';
import type { Notebook } from '../../../types/notebook';
import { GRPC_EXAMPLES } from '../../../services/grpcExamples';

export function newCell(type: CellType, id: string, now: number): Cell {
  const base = { id, createdAt: now, updatedAt: now };
  switch (type) {
    case 'query': return { ...base, type, method: 'GET', endpoint: '', body: '' };
    case 'ppl': return { ...base, type, query: '' };
    case 'grpc': return { ...base, type, method: 'Search', body: GRPC_EXAMPLES.Search };
    case 'markdown': return { ...base, type, content: '' };
  }
}
export function newNotebook(name: string, id: string, now: number): Notebook {
  return { id, name, cells: [], createdAt: now, updatedAt: now, connectionId: null };
}

export function convertCell(cell: Cell, type: CellType, now: number): Cell {
  const content = cell.type === 'markdown' ? cell.content : cell.type === 'ppl' ? cell.query : cell.body;
  const converted = { ...newCell(type, cell.id, now), createdAt: cell.createdAt };
  if (converted.type === 'markdown') converted.content = content;
  else if (converted.type === 'ppl') converted.query = content;
  else converted.body = content || (converted.type === 'grpc' ? GRPC_EXAMPLES.Search : '');
  return converted;
}
