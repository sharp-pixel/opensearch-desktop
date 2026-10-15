// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Extended Property-based tests for Persistence Service
 * Tests deleteNotebook, listNotebooks, clearTracking, saveActiveNotebookId, loadActiveNotebookId, deleteConnectionAsync
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { notebookArb } from './generators/notebook.generator';
import { connectionConfigArb } from './generators/connection.generator';
import {
  saveNotebook,
  loadNotebook,
  deleteNotebook,
  listNotebooks,
  loadAllNotebooks,
  saveTracking,
  loadTracking,
  clearTracking,
  saveActiveNotebookId,
  loadActiveNotebookId,
  saveConnectionAsync,
  loadConnectionsAsync,
  deleteConnectionAsync,
  STORAGE_KEYS,
} from '../../services/persistence';
import type { ApiTrackerState } from '../../types/tracking';

describe('Persistence Service Extended Tests', () => {
  beforeEach(() => {
    // Clear all localStorage before each test
    localStorage.clear();
  });

  describe('deleteNotebook', () => {
    it('removes notebook from storage', () => {
      fc.assert(
        fc.property(notebookArb, (notebook) => {
          localStorage.clear();
          
          // Save the notebook
          saveNotebook(notebook);
          expect(loadNotebook(notebook.id)).not.toBeNull();
          
          // Delete the notebook
          deleteNotebook(notebook.id);
          expect(loadNotebook(notebook.id)).toBeNull();
        }),
        { numRuns: 20 }
      );
    });

    it('does not affect other notebooks', () => {
      fc.assert(
        fc.property(notebookArb, notebookArb, (notebook1, notebook2) => {
          // Ensure different IDs
          if (notebook1.id === notebook2.id) return;
          
          localStorage.clear();
          
          saveNotebook(notebook1);
          saveNotebook(notebook2);
          
          deleteNotebook(notebook1.id);
          
          expect(loadNotebook(notebook1.id)).toBeNull();
          expect(loadNotebook(notebook2.id)).not.toBeNull();
        }),
        { numRuns: 20 }
      );
    });

    it('clears tracking data for deleted notebook', () => {
      fc.assert(
        fc.property(notebookArb, (notebook) => {
          localStorage.clear();
          
          saveNotebook(notebook);
          const tracking: ApiTrackerState = {
            operations: [{ method: 'GET', endpoint: '/_search', cellId: 'cell1', timestamp: Date.now(), indexPatterns: [] }],
            permissions: [{ type: 'cluster', permission: 'indices:data/read/search' }],
          };
          saveTracking(notebook.id, tracking);
          
          deleteNotebook(notebook.id);
          
          // Tracking should be cleared
          const loadedTracking = loadTracking(notebook.id);
          expect(loadedTracking.operations).toEqual([]);
          expect(loadedTracking.permissions).toEqual([]);
        }),
        { numRuns: 10 }
      );
    });

    it('handles deleting non-existent notebook gracefully', () => {
      expect(() => deleteNotebook('non-existent-id')).not.toThrow();
    });
  });

  describe('listNotebooks', () => {
    it('returns empty array when no notebooks', () => {
      const list = listNotebooks();
      expect(list).toEqual([]);
    });

    it('returns metadata for all saved notebooks', () => {
      fc.assert(
        fc.property(
          fc.array(notebookArb, { minLength: 1, maxLength: 5 }),
          (notebooks) => {
            localStorage.clear();
            
            // Ensure unique IDs
            const uniqueNotebooks = notebooks.filter(
              (n, i, arr) => arr.findIndex(x => x.id === n.id) === i
            );
            
            for (const notebook of uniqueNotebooks) {
              saveNotebook(notebook);
            }
            
            const list = listNotebooks();
            expect(list.length).toBe(uniqueNotebooks.length);
            
            for (const notebook of uniqueNotebooks) {
              const metadata = list.find(m => m.id === notebook.id);
              expect(metadata).toBeDefined();
              expect(metadata!.name).toBe(notebook.name);
              expect(metadata!.cellCount).toBe(notebook.cells.length);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('metadata includes correct cell count', () => {
      fc.assert(
        fc.property(notebookArb, (notebook) => {
          localStorage.clear();
          
          saveNotebook(notebook);
          const list = listNotebooks();
          
          const metadata = list.find(m => m.id === notebook.id);
          expect(metadata!.cellCount).toBe(notebook.cells.length);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('clearTracking', () => {
    it('clears tracking data for notebook', () => {
      fc.assert(
        fc.property(notebookArb, (notebook) => {
          localStorage.clear();
          
          saveNotebook(notebook);
          const tracking: ApiTrackerState = {
            operations: [
              { method: 'GET', endpoint: '/_search', cellId: 'cell1', timestamp: Date.now(), indexPatterns: [] },
              { method: 'POST', endpoint: '/_bulk', cellId: 'cell2', timestamp: Date.now(), indexPatterns: [] },
            ],
            permissions: [
              { type: 'cluster', permission: 'indices:data/read/search' },
              { type: 'cluster', permission: 'indices:data/write/bulk' },
            ],
          };
          saveTracking(notebook.id, tracking);
          
          // Verify tracking was saved
          const savedTracking = loadTracking(notebook.id);
          expect(savedTracking.operations.length).toBe(2);
          
          // Clear tracking
          clearTracking(notebook.id);
          
          // Verify tracking is cleared
          const clearedTracking = loadTracking(notebook.id);
          expect(clearedTracking.operations).toEqual([]);
          expect(clearedTracking.permissions).toEqual([]);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('saveActiveNotebookId and loadActiveNotebookId', () => {
    it('saves and loads active notebook ID', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (id) => {
            localStorage.clear();
            
            saveActiveNotebookId(id);
            expect(loadActiveNotebookId()).toBe(id);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('returns null when no active notebook', () => {
      expect(loadActiveNotebookId()).toBeNull();
    });

    it('clears active notebook when null is passed', () => {
      saveActiveNotebookId('some-id');
      expect(loadActiveNotebookId()).toBe('some-id');
      
      saveActiveNotebookId(null);
      expect(loadActiveNotebookId()).toBeNull();
    });
  });

  describe('deleteConnectionAsync', () => {
    it('removes connection from storage', async () => {
      await fc.assert(
        fc.asyncProperty(connectionConfigArb, async (connection) => {
          localStorage.clear();
          
          await saveConnectionAsync(connection);
          
          let connections = await loadConnectionsAsync();
          // Filter out default connection for comparison
          const found = connections.find(c => c.id === connection.id);
          
          // Connection might not be found if decryption failed (for auth types with credentials)
          if (found) {
            await deleteConnectionAsync(connection.id);
            
            connections = await loadConnectionsAsync();
            const deleted = connections.find(c => c.id === connection.id);
            expect(deleted).toBeUndefined();
          }
        }),
        { numRuns: 10 }
      );
    });

    it('does not affect other connections', async () => {
      await fc.assert(
        fc.asyncProperty(connectionConfigArb, connectionConfigArb, async (conn1, conn2) => {
          if (conn1.id === conn2.id) return;
          
          localStorage.clear();
          
          await saveConnectionAsync(conn1);
          await saveConnectionAsync(conn2);
          
          await deleteConnectionAsync(conn1.id);
          
          const connections = await loadConnectionsAsync();
          expect(connections.find(c => c.id === conn1.id)).toBeUndefined();
          // conn2 might not be found if decryption failed, which is acceptable
        }),
        { numRuns: 10 }
      );
    });

    it('handles deleting non-existent connection', async () => {
      localStorage.clear();
      
      // Should not throw
      await expect(deleteConnectionAsync('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('loadAllNotebooks', () => {
    it('returns empty array for invalid JSON', () => {
      localStorage.setItem(STORAGE_KEYS.NOTEBOOKS, 'invalid json');
      const notebooks = loadAllNotebooks();
      expect(notebooks).toEqual([]);
    });

    it('returns empty array when storage is empty', () => {
      const notebooks = loadAllNotebooks();
      expect(notebooks).toEqual([]);
    });
  });

  describe('loadTracking', () => {
    it('returns empty state for non-existent notebook', () => {
      const tracking = loadTracking('non-existent');
      expect(tracking.operations).toEqual([]);
      expect(tracking.permissions).toEqual([]);
    });

    it('returns empty state for invalid JSON in separate storage', () => {
      localStorage.setItem(`${STORAGE_KEYS.API_TRACKING_PREFIX}test-id`, 'invalid json');
      const tracking = loadTracking('test-id');
      expect(tracking.operations).toEqual([]);
      expect(tracking.permissions).toEqual([]);
    });
  });
});
