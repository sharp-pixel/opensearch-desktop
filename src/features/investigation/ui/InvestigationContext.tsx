// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useSyncExternalStore, useCallback, type ReactNode } from 'react';
import { ConnectionProvider, useConnections } from '../../../connections/ConnectionProvider';
import { createInvestigationStore, type InvestigationStore } from '../state/store';
import { executeInvestigationCell } from '../application/executeCell';

const InvestigationContext = createContext<InvestigationStore | null>(null);
function OwnedProvider({ children }: { children?: ReactNode }) {
  const [store] = useState(createInvestigationStore);
  useEffect(() => {
    store.resume();
    const flush = () => store.saveCurrentInvestigation();
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); store.dispose(); };
  }, [store]);
  return <InvestigationContext.Provider value={store}>{children}</InvestigationContext.Provider>;
}
export function InvestigationProvider({ children }: { children?: ReactNode }) {
  const parent = useContext(InvestigationContext);
  return parent ? children : <ConnectionProvider><OwnedProvider>{children}</OwnedProvider></ConnectionProvider>;
}
export function useInvestigationStore() {
  const store = useContext(InvestigationContext);
  if (!store) throw new Error('InvestigationProvider is required');
  return store;
}
/** Select stable references or primitives so unrelated cells do not invalidate editors. */
export function useInvestigationSelector<T>(select: (state: ReturnType<InvestigationStore['getSnapshot']>) => T): T {
  const store = useInvestigationStore();
  return useSyncExternalStore(store.subscribe, () => select(store.getSnapshot()));
}
export function useInvestigationRun() {
  const store = useInvestigationStore();
  const { connections } = useConnections();
  return useCallback((cellId: string) => executeInvestigationCell(store, cellId, connections), [store, connections]);
}
export function useInvestigation() {
  const store = useInvestigationStore();
  const snapshot = useInvestigationSelector(state => state);
  const { connections } = useConnections();
  const runCell = useInvestigationRun();
  return { ...store, state: { ...snapshot, connections }, runCell };
}
