// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Notebook Manager Service
 * Feature: opensearch-notebook-ui
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { notebookArb } from './generators/notebook.generator';
import {
  addCell,
  deleteCell,
  reorderCells,
} from '../../services/notebookManager';
import { STORAGE_KEYS } from '../../services/persistence';
import type { CellType } from '../../types/cell';

/**
 * Generator for cell types
 */
const cellTypeArb: fc.Arbitrary<CellType> = fc.constantFrom('query', 'markdown', 'ppl', 'grpc');

describe('Notebook Manager Property Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  /**
   * Property 1: Cell Addition Preserves Notebook Integrity
   * For any notebook with N cells and any valid selected cell position,
   * adding a new cell should result in a notebook with N+1 cells,
   * where the new cell appears immediately after the selected position
   * and all original cells are preserved.
   * **Validates: Requirements 1.1**
   */
  it('Property 1: Cell Addition Preserves Notebook Integrity', () => {
    fc.assert(
      fc.property(
        notebookArb,
        cellTypeArb,
        fc.option(fc.nat(), { nil: undefined }),
        (notebook, cellType, afterIndexOption) => {
          // Clear storage before each iteration
          localStorage.removeItem(STORAGE_KEYS.NOTEBOOKS);

          const originalCellCount = notebook.cells.length;
          const originalCellIds = notebook.cells.map((c) => c.id);

          // Determine afterCellId based on the option
          let afterCellId: string | undefined;
          if (afterIndexOption !== undefined && notebook.cells.length > 0) {
            const afterIndex = afterIndexOption % notebook.cells.length;
            afterCellId = notebook.cells[afterIndex]?.id;
          }

          // Add a new cell
          const result = addCell(notebook, cellType, afterCellId);

          // Property: Cell count increases by exactly 1
          expect(result.notebook.cells.length).toBe(originalCellCount + 1);

          // Property: All original cells are preserved
          const newCellIds = result.notebook.cells.map((c) => c.id);
          for (const originalId of originalCellIds) {
            expect(newCellIds).toContain(originalId);
          }

          // Property: The new cell is in the result
          expect(newCellIds).toContain(result.cell.id);

          // Property: The new cell has the correct type
          expect(result.cell.type).toBe(cellType);

          // Property: If afterCellId was specified and valid, new cell is after it
          if (afterCellId && originalCellIds.includes(afterCellId)) {
            const afterIndex = result.notebook.cells.findIndex((c) => c.id === afterCellId);
            const newCellIndex = result.notebook.cells.findIndex((c) => c.id === result.cell.id);
            expect(newCellIndex).toBe(afterIndex + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Cell Reordering Preserves All Cells
   * For any notebook with cells and any valid reordering permutation,
   * reordering the cells should result in a notebook with the same number of cells,
   * the same cell IDs, and the same cell contents—only the order changes.
   * **Validates: Requirements 1.3**
   */
  it('Property 2: Cell Reordering Preserves All Cells', () => {
    fc.assert(
      fc.property(
        notebookArb.filter((n) => n.cells.length > 0),
        (notebook) => {
          // Clear storage before each iteration
          localStorage.removeItem(STORAGE_KEYS.NOTEBOOKS);

          const originalCellCount = notebook.cells.length;
          const originalCellIds = notebook.cells.map((c) => c.id);
          const originalCellContents = new Map(
            notebook.cells.map((c) => [c.id, JSON.stringify(c)])
          );

          // Generate a random permutation of cell IDs
          const shuffledIds = [...originalCellIds].sort(() => Math.random() - 0.5);

          // Reorder cells
          const result = reorderCells(notebook, shuffledIds);

          // Property: Reordering should succeed
          expect(result).not.toBeNull();

          // Property: Cell count remains the same
          expect(result!.cells.length).toBe(originalCellCount);

          // Property: All cell IDs are preserved
          const newCellIds = result!.cells.map((c) => c.id);
          expect(new Set(newCellIds)).toEqual(new Set(originalCellIds));

          // Property: Cell contents are preserved (except updatedAt on notebook)
          for (const cell of result!.cells) {
            const originalContent = originalCellContents.get(cell.id);
            expect(originalContent).toBeDefined();
            expect(JSON.stringify(cell)).toBe(originalContent);
          }

          // Property: Cells are in the new order
          expect(newCellIds).toEqual(shuffledIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Cell Deletion Reduces Count Correctly
   * For any notebook with N cells (N > 0) and any valid cell ID,
   * deleting that cell should result in a notebook with N-1 cells,
   * where the deleted cell is no longer present and all other cells remain unchanged.
   * **Validates: Requirements 1.4**
   */
  it('Property 3: Cell Deletion Reduces Count Correctly', () => {
    fc.assert(
      fc.property(
        notebookArb.filter((n) => n.cells.length > 0),
        fc.nat(),
        (notebook, deleteIndexSeed) => {
          // Clear storage before each iteration
          localStorage.removeItem(STORAGE_KEYS.NOTEBOOKS);

          const originalCellCount = notebook.cells.length;
          const deleteIndex = deleteIndexSeed % originalCellCount;
          const cellToDelete = notebook.cells[deleteIndex];
          
          if (!cellToDelete) {
            return; // Skip if no cell at index
          }

          const cellIdToDelete = cellToDelete.id;
          const remainingCellIds = notebook.cells
            .filter((c) => c.id !== cellIdToDelete)
            .map((c) => c.id);

          // Delete the cell
          const result = deleteCell(notebook, cellIdToDelete);

          // Property: Deletion should succeed
          expect(result).not.toBeNull();

          // Property: Cell count decreases by exactly 1
          expect(result!.cells.length).toBe(originalCellCount - 1);

          // Property: The deleted cell is no longer present
          const newCellIds = result!.cells.map((c) => c.id);
          expect(newCellIds).not.toContain(cellIdToDelete);

          // Property: All other cells remain
          expect(new Set(newCellIds)).toEqual(new Set(remainingCellIds));
        }
      ),
      { numRuns: 100 }
    );
  });
});
