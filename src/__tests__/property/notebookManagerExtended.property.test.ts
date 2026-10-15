// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Extended property-based tests for Notebook Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  createNotebook,
  loadNotebook,
  saveNotebook,
  deleteNotebookById,
  renameNotebook,
  listNotebooks,
  addCell,
  updateCell,
  deleteCell,
  reorderCells,
  getCell,
  convertCellType,
} from '../../services/notebookManager';
import type { Notebook } from '../../types/notebook';

// Mock localStorage
let store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    store = {};
  }),
};

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Notebook Manager Extended Property Tests', () => {
  beforeEach(() => {
    store = {};
    vi.clearAllMocks();
    // Reset mock implementations
    localStorageMock.getItem.mockImplementation((key: string) => store[key] || null);
    localStorageMock.setItem.mockImplementation((key: string, value: string) => {
      store[key] = value;
    });
    localStorageMock.removeItem.mockImplementation((key: string) => {
      delete store[key];
    });
  });

  describe('Notebook CRUD operations', () => {
    it('Property: createNotebook creates valid notebook', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (name) => {
          const notebook = createNotebook(name);
          expect(notebook.name).toBe(name);
          expect(notebook.id).toBeTruthy();
          expect(notebook.cells).toEqual([]);
          expect(notebook.createdAt).toBeLessThanOrEqual(Date.now());
          expect(notebook.updatedAt).toBeLessThanOrEqual(Date.now());
        })
      );
    });

    it('Property: loadNotebook returns null for non-existent ID', () => {
      const result = loadNotebook('non-existent-id');
      expect(result).toBeNull();
    });

    it('Property: saveNotebook updates timestamp', () => {
      const notebook = createNotebook('Test');
      const originalUpdatedAt = notebook.updatedAt;
      
      // Wait a bit to ensure timestamp changes
      const updatedNotebook = { ...notebook, name: 'Updated' };
      saveNotebook(updatedNotebook);
      
      const loaded = loadNotebook(notebook.id);
      expect(loaded?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it('Property: deleteNotebookById removes notebook', () => {
      const notebook = createNotebook('Test');
      deleteNotebookById(notebook.id);
      expect(loadNotebook(notebook.id)).toBeNull();
    });

    it('Property: renameNotebook updates name', () => {
      const notebook = createNotebook('Original');
      const renamed = renameNotebook(notebook.id, 'New Name');
      expect(renamed?.name).toBe('New Name');
    });

    it('Property: renameNotebook returns null for non-existent notebook', () => {
      const result = renameNotebook('non-existent', 'New Name');
      expect(result).toBeNull();
    });

    it('Property: listNotebooks returns metadata', () => {
      createNotebook('Notebook 1');
      createNotebook('Notebook 2');
      
      const list = listNotebooks();
      expect(list.length).toBe(2);
      expect(list[0]).toHaveProperty('id');
      expect(list[0]).toHaveProperty('name');
      expect(list[0]).toHaveProperty('cellCount');
    });
  });

  describe('Cell operations', () => {
    let notebook: Notebook;

    beforeEach(() => {
      notebook = createNotebook('Test Notebook');
    });

    it('Property: addCell adds query cell', () => {
      const { notebook: updated, cell } = addCell(notebook, 'query');
      expect(cell.type).toBe('query');
      expect(updated.cells.length).toBe(1);
      expect(updated.cells[0]).toBe(cell);
    });

    it('Property: addCell adds markdown cell', () => {
      const { notebook: updated, cell } = addCell(notebook, 'markdown');
      expect(cell.type).toBe('markdown');
      expect(updated.cells.length).toBe(1);
    });

    it('Property: addCell adds ppl cell', () => {
      const { notebook: updated, cell } = addCell(notebook, 'ppl');
      expect(cell.type).toBe('ppl');
      expect(updated.cells.length).toBe(1);
    });

    it('Property: addCell inserts after specified cell', () => {
      const { notebook: nb1, cell: cell1 } = addCell(notebook, 'query');
      const { notebook: nb2, cell: cell2 } = addCell(nb1, 'markdown');
      const { notebook: nb3, cell: cell3 } = addCell(nb2, 'ppl', cell1.id);
      
      expect(nb3.cells.length).toBe(3);
      expect(nb3.cells[0]?.id).toBe(cell1.id);
      expect(nb3.cells[1]?.id).toBe(cell3.id);
      expect(nb3.cells[2]?.id).toBe(cell2.id);
    });

    it('Property: addCell appends when afterCellId not found', () => {
      const { notebook: nb1 } = addCell(notebook, 'query');
      const { notebook: nb2, cell } = addCell(nb1, 'markdown', 'non-existent');
      
      expect(nb2.cells.length).toBe(2);
      expect(nb2.cells[1]?.id).toBe(cell.id);
    });

    it('Property: updateCell updates cell properties', () => {
      const { notebook: nb1, cell } = addCell(notebook, 'query');
      const updated = updateCell(nb1, cell.id, { endpoint: '/test' });
      
      expect(updated).not.toBeNull();
      const updatedCell = updated!.cells[0];
      expect((updatedCell as any).endpoint).toBe('/test');
    });

    it('Property: updateCell preserves id, type, createdAt', () => {
      const { notebook: nb1, cell } = addCell(notebook, 'query');
      const updated = updateCell(nb1, cell.id, { 
        id: 'new-id', 
        type: 'markdown' as any,
        createdAt: 0 
      });
      
      const updatedCell = updated!.cells[0];
      expect(updatedCell?.id).toBe(cell.id);
      expect(updatedCell?.type).toBe('query');
      expect(updatedCell?.createdAt).toBe(cell.createdAt);
    });

    it('Property: updateCell returns null for non-existent cell', () => {
      const result = updateCell(notebook, 'non-existent', {});
      expect(result).toBeNull();
    });

    it('Property: deleteCell removes cell', () => {
      const { notebook: nb1, cell } = addCell(notebook, 'query');
      const updated = deleteCell(nb1, cell.id);
      
      expect(updated).not.toBeNull();
      expect(updated!.cells.length).toBe(0);
    });

    it('Property: deleteCell returns null for non-existent cell', () => {
      const result = deleteCell(notebook, 'non-existent');
      expect(result).toBeNull();
    });

    it('Property: getCell returns cell by id', () => {
      const { notebook: nb1, cell } = addCell(notebook, 'query');
      const found = getCell(nb1, cell.id);
      expect(found).toEqual(cell);
    });

    it('Property: getCell returns null for non-existent cell', () => {
      const result = getCell(notebook, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('Cell reordering', () => {
    it('Property: reorderCells changes cell order', () => {
      let nb = createNotebook('Test');
      const { notebook: nb1, cell: cell1 } = addCell(nb, 'query');
      const { notebook: nb2, cell: cell2 } = addCell(nb1, 'markdown');
      const { notebook: nb3, cell: cell3 } = addCell(nb2, 'ppl');
      
      const reordered = reorderCells(nb3, [cell3.id, cell1.id, cell2.id]);
      
      expect(reordered).not.toBeNull();
      expect(reordered!.cells[0]?.id).toBe(cell3.id);
      expect(reordered!.cells[1]?.id).toBe(cell1.id);
      expect(reordered!.cells[2]?.id).toBe(cell2.id);
    });

    it('Property: reorderCells returns null for mismatched IDs', () => {
      let nb = createNotebook('Test');
      const { notebook: nb1 } = addCell(nb, 'query');
      const { notebook: nb2 } = addCell(nb1, 'markdown');
      
      const result = reorderCells(nb2, ['wrong-id-1', 'wrong-id-2']);
      expect(result).toBeNull();
    });

    it('Property: reorderCells returns null for wrong count', () => {
      let nb = createNotebook('Test');
      const { notebook: nb1, cell: cell1 } = addCell(nb, 'query');
      const { notebook: nb2 } = addCell(nb1, 'markdown');
      
      const result = reorderCells(nb2, [cell1.id]);
      expect(result).toBeNull();
    });
  });

  describe('Cell type conversion', () => {
    it('Property: convertCellType converts query to markdown', () => {
      let nb = createNotebook('Test');
      const { notebook: nb1, cell } = addCell(nb, 'query');
      
      // Set some content
      const nb2 = updateCell(nb1, cell.id, { body: 'test content' });
      const converted = convertCellType(nb2!, cell.id, 'markdown');
      
      expect(converted).not.toBeNull();
      expect(converted!.cells[0]?.type).toBe('markdown');
      expect((converted!.cells[0] as any).content).toBe('test content');
    });

    it('Property: convertCellType converts markdown to query', () => {
      let nb = createNotebook('Test');
      const { notebook: nb1, cell } = addCell(nb, 'markdown');
      
      const nb2 = updateCell(nb1, cell.id, { content: 'test content' });
      const converted = convertCellType(nb2!, cell.id, 'query');
      
      expect(converted).not.toBeNull();
      expect(converted!.cells[0]?.type).toBe('query');
      expect((converted!.cells[0] as any).body).toBe('test content');
    });

    it('Property: convertCellType converts query to ppl', () => {
      let nb = createNotebook('Test');
      const { notebook: nb1, cell } = addCell(nb, 'query');
      
      const nb2 = updateCell(nb1, cell.id, { body: 'source = test' });
      const converted = convertCellType(nb2!, cell.id, 'ppl');
      
      expect(converted).not.toBeNull();
      expect(converted!.cells[0]?.type).toBe('ppl');
      expect((converted!.cells[0] as any).query).toBe('source = test');
    });

    it('Property: convertCellType converts ppl to markdown', () => {
      let nb = createNotebook('Test');
      const { notebook: nb1, cell } = addCell(nb, 'ppl');
      
      const nb2 = updateCell(nb1, cell.id, { query: 'source = test' });
      const converted = convertCellType(nb2!, cell.id, 'markdown');
      
      expect(converted).not.toBeNull();
      expect(converted!.cells[0]?.type).toBe('markdown');
      expect((converted!.cells[0] as any).content).toBe('source = test');
    });

    it('Property: convertCellType returns same notebook for same type', () => {
      let nb = createNotebook('Test');
      const { notebook: nb1, cell } = addCell(nb, 'query');
      
      const converted = convertCellType(nb1, cell.id, 'query');
      expect(converted).toBe(nb1);
    });

    it('Property: convertCellType returns null for non-existent cell', () => {
      const nb = createNotebook('Test');
      const result = convertCellType(nb, 'non-existent', 'markdown');
      expect(result).toBeNull();
    });

    it('Property: convertCellType preserves cell id and createdAt', () => {
      let nb = createNotebook('Test');
      const { notebook: nb1, cell } = addCell(nb, 'query');
      
      const converted = convertCellType(nb1, cell.id, 'markdown');
      
      expect(converted!.cells[0]?.id).toBe(cell.id);
      expect(converted!.cells[0]?.createdAt).toBe(cell.createdAt);
    });
  });
});
