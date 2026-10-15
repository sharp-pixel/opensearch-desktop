// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { ConnectionConfig } from '../types/connection';

export interface ConnectionRepository {
  load(): Promise<ConnectionConfig[]>;
  save(connection: ConnectionConfig): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface ConnectionSnapshot {
  connections: ConnectionConfig[];
  activeId: string | null;
  ready: boolean;
  error: string | null;
  revision: number;
}

/** One committed connection collection for every feature in an application. */
export function createConnectionRegistry(repository: ConnectionRepository) {
  let snapshot: ConnectionSnapshot = { connections: [], activeId: null, ready: false, error: null, revision: 0 };
  const listeners = new Set<() => void>();
  let queue: Promise<unknown> = Promise.resolve();
  let initialization: Promise<void> | undefined;
  let selectionChanged = false;
  let pending = 0;
  function publish(update: Partial<ConnectionSnapshot>) {
    snapshot = { ...snapshot, ...update };
    listeners.forEach(listener => listener());
  }
  function transaction<T>(operation: () => Promise<T>): Promise<T> {
    pending++;
    const result = queue.then(operation).catch(error => {
      publish({ error: error instanceof Error ? error.message : 'Connection storage failed' });
      throw error;
    });
    queue = result.catch(() => undefined).finally(() => { pending--; });
    return result;
  }
  function refresh() {
    return transaction(async () => {
      const connections = await repository.load();
      const activeId = snapshot.activeId && connections.some(c => c.id === snapshot.activeId)
        ? snapshot.activeId : selectionChanged ? null : connections[0]?.id ?? null;
      publish({ connections, activeId, ready: true, error: null, revision: snapshot.revision + 1 });
    });
  }
  function save(connection: ConnectionConfig) {
    // Callers may continue editing their form while persistence is pending.
    const committed = { ...structuredClone(connection), revision: crypto.randomUUID() };
    return transaction(async () => {
      await repository.save(committed);
      const connections = snapshot.connections.filter(c => c.id !== committed.id);
      const position = snapshot.connections.findIndex(c => c.id === committed.id);
      connections.splice(position < 0 ? connections.length : position, 0, committed);
      publish({ connections, error: null, revision: snapshot.revision + 1 });
    });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    initialize() {
      initialization ??= refresh().catch(error => { initialization = undefined; throw error; });
      return initialization;
    },
    refresh,
    isBusy: () => pending > 0,
    flush: async () => { await queue; return snapshot.error === null; },
    save,
    remove(id: string) {
      return transaction(async () => {
        await repository.remove(id);
        publish({ connections: snapshot.connections.filter(c => c.id !== id),
          activeId: snapshot.activeId === id ? null : snapshot.activeId,
          error: null, revision: snapshot.revision + 1 });
      });
    },
    select(connection: ConnectionConfig | null) {
      selectionChanged = true;
      publish({ activeId: connection && snapshot.connections.some(c => c.id === connection.id) ? connection.id : null });
    },
  };
}
export type ConnectionRegistry = ReturnType<typeof createConnectionRegistry>;
