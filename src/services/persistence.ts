// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Persistence Service for OpenSearch Notebook
 * Handles local storage operations for notebooks, connections, and tracking data
 * Requirements: 1.6, 4.7, 5.7, 8.1
 */

import type { Notebook, NotebookMetadata } from '../types/notebook';
import type { ConnectionConfig } from '../types/connection';
import type { ApiTrackerState } from '../types/tracking';
import { encryptCredentials, decryptCredentials, releaseCredentials } from '../utils/crypto';
import { createLogger } from '../utils/logger';
import { STORAGE } from '../utils/constants';
import { DEFAULT_GRPC_ENDPOINT } from './grpcEndpoint';
import { isTauri } from '../platform/runtime';
import { credentialReferences, rememberVaultReference, reconcileVaultReferences } from '../storage/vaultReferences';

const logger = createLogger('Persistence');

// Storage key constants
export const STORAGE_KEYS = {
  NOTEBOOKS: 'opensearch-notebook:notebooks',
  CONNECTIONS: 'opensearch-notebook:connections',
  CONNECTIONS_ENCRYPTED: 'opensearch-notebook:connections:encrypted',
  ACTIVE_NOTEBOOK: 'opensearch-notebook:active',
  API_TRACKING_PREFIX: 'opensearch-notebook:tracking:',
  SETTINGS: 'opensearch-notebook:settings',
} as const;

/**
 * Stored connection format with encrypted credentials
 */
interface StoredConnection {
  revision?: string;
  id: string;
  name: string;
  endpoint: string;
  authType: ConnectionConfig['authType'];
  encryptedCredentials: string | null;
  grpcEndpoint?: string;
  useProxy?: boolean;
}

function parseStoredConnections(data: string): StoredConnection[] {
  const records: unknown = JSON.parse(data);
  if (!Array.isArray(records)) throw new Error('Invalid saved connections');
  const ids = new Set<string>();
  for (const record of records) {
    if (!record || typeof record !== 'object' || typeof record.id !== 'string' || ids.has(record.id)
      || typeof record.name !== 'string' || typeof record.endpoint !== 'string'
      || !['none', 'basic', 'apikey', 'sigv4'].includes(record.authType)
      || !(record.encryptedCredentials === null || typeof record.encryptedCredentials === 'string')) {
      throw new Error('Invalid saved connection');
    }
    ids.add(record.id);
    credentialReferences(record.encryptedCredentials);
  }
  return records as StoredConnection[];
}

async function recoverVaultReferences(records: StoredConnection[]): Promise<void> {
  // Without a cross-window lock, a pending entry could belong to another active writer.
  if (!isTauri() || typeof navigator === 'undefined' || !navigator.locks) return;
  try {
    await reconcileVaultReferences(new Set(records.flatMap(record => credentialReferences(record.encryptedCredentials))));
  } catch {
    // Cleanup failures retain the journal for the next read; committed credentials stay usable.
    logger.warn('Native credential cleanup deferred. Pending references were preserved.');
  }
}

/**
 * Stored notebook format including tracking data
 */
export interface StoredNotebook {
  file?: import('../types/notebook').NotebookFileBinding;
  notebook: Notebook;
  tracking: ApiTrackerState;
}

/**
 * Save a notebook to local storage
 * Requirements: 1.6, 8.1
 */
export function saveNotebook(notebook: Notebook): void {
  try {
    const notebooks = loadAllNotebooks();
    const existingIndex = notebooks.findIndex((n) => n.notebook.id === notebook.id);

    const existingNotebook = existingIndex >= 0 ? notebooks[existingIndex] : undefined;
    const storedNotebook: StoredNotebook = {
      ...(existingNotebook?.file ? { file: existingNotebook.file } : {}),
      notebook,
      tracking: existingNotebook?.tracking ?? { operations: [], permissions: [] },
    };

    if (existingIndex >= 0) {
      notebooks[existingIndex] = storedNotebook;
    } else {
      notebooks.push(storedNotebook);
    }

    localStorage.setItem(STORAGE_KEYS.NOTEBOOKS, JSON.stringify(notebooks));
  } catch (error) {
    // Handle localStorage quota exceeded or other errors
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      logger.error('localStorage quota exceeded. Consider clearing old notebooks.');
    } else {
      logger.error('Failed to save notebook:', error);
    }
    throw error;
  }
}

/** Commit document and tracking together, without a second tracking copy. */
export function saveStoredNotebook(stored: StoredNotebook): void {
  const notebooks = loadAllNotebooks();
  const index = notebooks.findIndex(item => item.notebook.id === stored.notebook.id);
  if (index < 0) notebooks.push(stored); else notebooks[index] = stored;
  localStorage.setItem(STORAGE_KEYS.NOTEBOOKS, JSON.stringify(notebooks));
}

/**
 * Load a notebook by ID from local storage
 * Requirements: 1.6, 8.1
 */
export function loadNotebook(id: string): StoredNotebook | null {
  const notebooks = loadAllNotebooks();
  return notebooks.find((n) => n.notebook.id === id) ?? null;
}

/**
 * Delete a notebook from local storage
 * Requirements: 1.6
 */
export function deleteNotebook(id: string): void {
  try {
    const notebooks = loadAllNotebooks();
    const filtered = notebooks.filter((n) => n.notebook.id !== id);
    localStorage.setItem(STORAGE_KEYS.NOTEBOOKS, JSON.stringify(filtered));

    // Also clear tracking data for this notebook
    localStorage.removeItem(`${STORAGE_KEYS.API_TRACKING_PREFIX}${id}`);
  } catch (error) {
    logger.error('Failed to delete notebook:', error);
    throw error;
  }
}

/**
 * Load all stored notebooks
 */
export function loadAllNotebooks(): StoredNotebook[] {
  const data = localStorage.getItem(STORAGE_KEYS.NOTEBOOKS);
  if (!data) return [];

  try {
    return JSON.parse(data) as StoredNotebook[];
  } catch {
    return [];
  }
}

/**
 * Get metadata for all notebooks (lightweight listing)
 */
export function listNotebooks(): NotebookMetadata[] {
  const notebooks = loadAllNotebooks();
  return notebooks.map((stored) => ({
    id: stored.notebook.id,
    name: stored.notebook.name,
    createdAt: stored.notebook.createdAt,
    updatedAt: stored.notebook.updatedAt,
    cellCount: stored.notebook.cells.length,
  }));
}

// Serialize the full read/modify/encrypt/write transaction. Web Locks also
// protect browser tabs sharing the same localStorage.
let connectionStorageQueue: Promise<unknown> = Promise.resolve();
function withConnectionStorage<T>(operation: () => Promise<T>): Promise<T> {
  const result = connectionStorageQueue.then(async () => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request('opensearch-connection-storage', operation);
    }
    return operation();
  });
  connectionStorageQueue = result.catch(() => undefined);
  return result;
}

async function storeConnections(connections: ConnectionConfig[]): Promise<void> {
  const previous = parseStoredConnections(localStorage.getItem(STORAGE_KEYS.CONNECTIONS_ENCRYPTED) || '[]');
  const storedConnections: StoredConnection[] = [];
  const created: string[] = [];
  try {
    if (isTauri()) for (const old of previous) {
      for (const reference of credentialReferences(old.encryptedCredentials)) rememberVaultReference(reference);
    }
    for (const conn of connections) {
      const old = previous.find(value => value.id === conn.id);
      const oldCredentials = old ? await decryptCredentials(old.encryptedCredentials) : null;
      const reuse = old && (conn.credentialError || JSON.stringify(oldCredentials) === JSON.stringify(conn.credentials ?? null));
      const encryptedCredentials = reuse ? old.encryptedCredentials : await encryptCredentials(conn.credentials);
      if (!reuse && encryptedCredentials) created.push(encryptedCredentials);
      storedConnections.push({ revision: conn.revision, id: conn.id, name: conn.name, endpoint: conn.endpoint, authType: conn.authType,
        encryptedCredentials, useProxy: conn.useProxy, grpcEndpoint: conn.grpcEndpoint });
    }
    localStorage.setItem(STORAGE_KEYS.CONNECTIONS_ENCRYPTED, JSON.stringify(storedConnections));
  } catch (error) {
    await Promise.all(created.map(value => releaseCredentials(value).catch(() => undefined)));
    throw error;
  }
  // References are retired only after the new metadata has committed.
  for (const old of previous) if (old.encryptedCredentials && !storedConnections.some(value => value.encryptedCredentials === old.encryptedCredentials)) {
    await releaseCredentials(old.encryptedCredentials).catch(error => logger.warn('Credential cleanup deferred:', error));
  }
  localStorage.removeItem(STORAGE_KEYS.CONNECTIONS);
}

/**
 * Save a connection configuration to local storage (with encryption)
 * Requirements: 4.7
 */
export async function saveConnectionAsync(connection: ConnectionConfig): Promise<void> {
  return withConnectionStorage(async () => {
    const connections = await readConnections();
    const existingIndex = connections.findIndex((c) => c.id === connection.id);
    if (existingIndex >= 0) connections[existingIndex] = connection;
    else connections.push(connection);
    await storeConnections(connections);
  });
}

/**
 * Save a connection configuration to local storage (sync version for backward compatibility)
 * @deprecated Use saveConnectionAsync for proper error handling
 * Requirements: 4.7
 */
export function saveConnection(connection: ConnectionConfig): void {
  // Trigger async save but don't wait for it
  // Note: Errors are logged but not propagated - use saveConnectionAsync for error handling
  saveConnectionAsync(connection).catch((error) => logger.error('Async save failed:', error));
}

/**
 * Default connection for local Docker OpenSearch
 * Uses Vite proxy to bypass SSL certificate issues in development
 * Credentials are loaded from environment variables for security
 * If password is not set, credentials are null to force user configuration
 */
const DEFAULT_LOCAL_CONNECTION: ConnectionConfig = {
  id: STORAGE.DEFAULT_CONNECTION_ID,
  name: 'Local Docker OpenSearch',
  endpoint: 'https://localhost:9200',
  grpcEndpoint: DEFAULT_GRPC_ENDPOINT,
  authType: 'basic',
  credentials: import.meta.env.VITE_OPENSEARCH_PASSWORD
    ? {
        username: import.meta.env.VITE_OPENSEARCH_USERNAME || 'admin',
        password: import.meta.env.VITE_OPENSEARCH_PASSWORD,
      }
    : null,
  useProxy: true,
};

/**
 * Load all connection configurations from local storage (with decryption)
 * Requirements: 4.7
 */
export async function loadConnectionsAsync(): Promise<ConnectionConfig[]> {
  return withConnectionStorage(readConnections);
}

async function readConnections(): Promise<ConnectionConfig[]> {
  // First try encrypted storage
  const encryptedData = localStorage.getItem(STORAGE_KEYS.CONNECTIONS_ENCRYPTED);
  if (encryptedData) {
    try {
      const storedConnections = parseStoredConnections(encryptedData);
      await recoverVaultReferences(storedConnections);
      const connections: ConnectionConfig[] = await Promise.all(
        storedConnections.map(async (stored) => {
          const credentials = await decryptCredentials(stored.encryptedCredentials);
          return {
            id: stored.id,
            revision: stored.revision,
            name: stored.name,
            endpoint: stored.endpoint,
            authType: stored.authType,
            ...(stored.encryptedCredentials && credentials === null ? { credentialError: 'Saved credentials are unavailable. Edit this connection to re-enter them.' } : {}),
            credentials: credentials as ConnectionConfig['credentials'],
            useProxy: stored.useProxy,
            grpcEndpoint: stored.grpcEndpoint,
          };
        })
      );
      
      const validConnections = connections;

      // Ensure default connection exists
      if (!validConnections.some((c) => c.id === DEFAULT_LOCAL_CONNECTION.id)) {
        return [DEFAULT_LOCAL_CONNECTION, ...validConnections];
      }
      return validConnections;
    } catch (error) {
      throw new Error('Saved connections could not be read. Existing records have been preserved.', { cause: error });
    }
  }

  // Fallback to legacy unencrypted storage
  const data = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
  if (!data) {
    await recoverVaultReferences([]);
    return [DEFAULT_LOCAL_CONNECTION];
  }

  let connections: ConnectionConfig[];
  try {
    connections = JSON.parse(data) as ConnectionConfig[];
    if (!Array.isArray(connections)) return [DEFAULT_LOCAL_CONNECTION];
  } catch {
    return [DEFAULT_LOCAL_CONNECTION];
  }
  if (!connections.some((c) => c.id === DEFAULT_LOCAL_CONNECTION.id)) {
    connections = [DEFAULT_LOCAL_CONNECTION, ...connections];
  }
  // Migrate once without calling a save routine that reads the same legacy data.
  // Keep the legacy copy until the encrypted write has succeeded.
  try {
    await storeConnections(connections);
  } catch {
    // Reading existing connections must still work when storage is full or
    // encryption is temporarily unavailable. A later read can retry migration.
    logger.warn('Connection migration deferred; legacy data was preserved.');
  }
  return connections;
}

/**
 * Load all connection configurations from local storage (sync version)
 * Note: Returns cached/default connections. Use loadConnectionsAsync for full decryption.
 * Requirements: 4.7
 */
export function loadConnections(): ConnectionConfig[] {
  // For sync access, try to load from legacy storage or return default
  const data = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
  if (!data) {
    // Check if we have encrypted storage - if so, return just the default
    // The async version will be called to get the full list
    const hasEncrypted = localStorage.getItem(STORAGE_KEYS.CONNECTIONS_ENCRYPTED);
    if (hasEncrypted) {
      return [DEFAULT_LOCAL_CONNECTION];
    }
    return [DEFAULT_LOCAL_CONNECTION];
  }

  try {
    const connections = JSON.parse(data) as ConnectionConfig[];
    if (!connections.some((c) => c.id === DEFAULT_LOCAL_CONNECTION.id)) {
      return [DEFAULT_LOCAL_CONNECTION, ...connections];
    }
    return connections;
  } catch {
    return [DEFAULT_LOCAL_CONNECTION];
  }
}

/**
 * Delete a connection configuration from local storage
 */
export async function deleteConnectionAsync(id: string): Promise<void> {
  return withConnectionStorage(async () => {
    const connections = await readConnections();
    await storeConnections(connections.filter((c) => c.id !== id));
  });
}

/**
 * Delete a connection configuration from local storage (sync version)
 * @deprecated Use deleteConnectionAsync for proper error handling
 */
export function deleteConnection(id: string): void {
  // Note: Errors are logged but not propagated - use deleteConnectionAsync for error handling
  deleteConnectionAsync(id).catch((error) => logger.error('Async delete failed:', error));
}

/**
 * Save API tracking state for a notebook
 * Requirements: 5.7
 */
export function saveTracking(notebookId: string, tracking: ApiTrackerState): void {
  try {
    // Update tracking in the stored notebook
    const notebooks = loadAllNotebooks();
    const notebookIndex = notebooks.findIndex((n) => n.notebook.id === notebookId);

    if (notebookIndex >= 0) {
      const existingNotebook = notebooks[notebookIndex];
      if (existingNotebook) {
        existingNotebook.tracking = tracking;
        localStorage.setItem(STORAGE_KEYS.NOTEBOOKS, JSON.stringify(notebooks));
      }
    }

    // Also store separately for quick access
    localStorage.setItem(`${STORAGE_KEYS.API_TRACKING_PREFIX}${notebookId}`, JSON.stringify(tracking));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      logger.error('localStorage quota exceeded. Consider clearing tracking data.');
    } else {
      logger.error('Failed to save tracking:', error);
    }
    // Don't throw - tracking is non-critical
  }
}

/**
 * Load API tracking state for a notebook
 * Requirements: 5.7
 */
export function loadTracking(notebookId: string): ApiTrackerState {
  // First try to load from the notebook itself
  const storedNotebook = loadNotebook(notebookId);
  if (storedNotebook) {
    return storedNotebook.tracking;
  }

  // Fallback to separate tracking storage
  const data = localStorage.getItem(`${STORAGE_KEYS.API_TRACKING_PREFIX}${notebookId}`);
  if (!data) {
    return { operations: [], permissions: [] };
  }

  try {
    return JSON.parse(data) as ApiTrackerState;
  } catch {
    return { operations: [], permissions: [] };
  }
}

/**
 * Clear all tracking data for a notebook
 */
export function clearTracking(notebookId: string): void {
  saveTracking(notebookId, { operations: [], permissions: [] });
}

/**
 * Save the active notebook ID
 */
export function saveActiveNotebookId(id: string | null): void {
  if (id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_NOTEBOOK, id);
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_NOTEBOOK);
  }
}

/**
 * Load the active notebook ID
 */
export function loadActiveNotebookId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_NOTEBOOK);
}
