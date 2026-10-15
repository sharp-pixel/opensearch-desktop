// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Persistence Service
 * Feature: opensearch-notebook-ui
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { notebookArb } from './generators/notebook.generator';
import { connectionConfigArb } from './generators/connection.generator';
import { apiTrackerStateArb } from './generators/tracking.generator';
import {
  saveNotebook,
  loadNotebook,
  saveConnectionAsync,
  loadConnectionsAsync,
  saveTracking,
  loadTracking,
  STORAGE_KEYS,
} from '../../services/persistence';

describe('Persistence Service Property Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  /**
   * Property 4: Notebook Persistence Round-Trip
   * For any valid notebook state, saving to local storage and then loading
   * should produce an equivalent notebook with identical cells, content, and metadata.
   * Validates: Requirements 1.6, 8.1
   */
  it('Property 4: Notebook Persistence Round-Trip', () => {
    fc.assert(
      fc.property(notebookArb, (notebook) => {
        // Clear storage before each iteration
        localStorage.removeItem(STORAGE_KEYS.NOTEBOOKS);

        // Save the notebook
        saveNotebook(notebook);

        // Load the notebook
        const loaded = loadNotebook(notebook.id);

        // Verify round-trip produces equivalent notebook
        expect(loaded).not.toBeNull();
        expect(loaded!.notebook).toEqual(notebook);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Connection Settings Persistence Round-Trip
   * For any valid connection configuration, saving to storage and then loading
   * should produce an equivalent configuration with identical endpoint, auth type, and credentials.
   * Validates: Requirements 4.7
   */
  it('Property 8: Connection Settings Persistence Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(connectionConfigArb, async (connection) => {
        // Clear storage before each iteration
        localStorage.removeItem(STORAGE_KEYS.CONNECTIONS);
        localStorage.removeItem(STORAGE_KEYS.CONNECTIONS_ENCRYPTED);
        // Also clear the encryption key to ensure fresh state
        localStorage.removeItem('opensearch-devtools-key');

        // Save the connection (async for encryption)
        await saveConnectionAsync(connection);

        // Load all connections (async for decryption)
        const loaded = await loadConnectionsAsync();

        // Find the saved connection (filter out default connection)
        const found = loaded.find((c) => c.id === connection.id);

        // Successfully saved credentials must survive their first load.
        expect(found).toEqual(connection);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 11: Tracking Persistence Round-Trip
   * For any API tracker state with tracked operations, saving to storage and then loading
   * should produce an equivalent state with identical operations and derived permissions.
   * Validates: Requirements 5.7
   */
  it('Property 11: Tracking Persistence Round-Trip', () => {
    fc.assert(
      fc.property(notebookArb, apiTrackerStateArb, (notebook, tracking) => {
        // Clear storage before each iteration
        localStorage.removeItem(STORAGE_KEYS.NOTEBOOKS);

        // First save the notebook (tracking is stored with notebook)
        saveNotebook(notebook);

        // Save the tracking state
        saveTracking(notebook.id, tracking);

        // Load the tracking state
        const loaded = loadTracking(notebook.id);

        // Verify round-trip produces equivalent tracking state
        expect(loaded).toEqual(tracking);
      }),
      { numRuns: 100 }
    );
  });
});
