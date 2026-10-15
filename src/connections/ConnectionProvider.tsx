// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { loadConnectionsAsync, saveConnectionAsync, deleteConnectionAsync, STORAGE_KEYS } from '../services/persistence';
import { createConnectionRegistry, type ConnectionRegistry } from './registry';

const RegistryContext = createContext<ConnectionRegistry | null>(null);

function OwnedProvider({ children, registry: supplied }: { children?: ReactNode; registry?: ConnectionRegistry }) {
  const [registry] = useState(() => supplied ?? createConnectionRegistry({
    load: loadConnectionsAsync, save: saveConnectionAsync, remove: deleteConnectionAsync,
  }));
  useEffect(() => {
    void registry.initialize().catch(() => undefined); // Exposed through the snapshot's error state.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEYS.CONNECTIONS || event.key === STORAGE_KEYS.CONNECTIONS_ENCRYPTED) {
        void registry.refresh().catch(() => undefined);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [registry]);
  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}

/** Standalone features can mount this boundary without creating a second registry. */
export function ConnectionProvider({ children, registry }: { children?: ReactNode; registry?: ConnectionRegistry }) {
  const parent = useContext(RegistryContext);
  return parent ? children : <OwnedProvider registry={registry}>{children}</OwnedProvider>;
}

export function useConnections() {
  const registry = useContext(RegistryContext);
  if (!registry) throw new Error('ConnectionProvider is required');
  const snapshot = useSyncExternalStore(registry.subscribe, registry.getSnapshot);
  return {
    ...snapshot,
    activeConnection: snapshot.connections.find(c => c.id === snapshot.activeId) ?? null,
    setActiveConnection: registry.select,
    addConnection: registry.save,
    updateConnection: registry.save,
    removeConnection: registry.remove,
    refreshConnections: registry.refresh,
    flushConnections: registry.flush,
    connectionsAreBusy: registry.isBusy,
  };
}
