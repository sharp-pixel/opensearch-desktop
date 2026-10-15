// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getDraftStore, type WorkspaceDraft } from './drafts';

/** Feature drafts retain one owner across lazy-feature unmounts. */
export function useDraft<T extends WorkspaceDraft>(initial: T) {
  const [store] = useState(() => getDraftStore(initial));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    const flush = () => { void store.flush(); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [store]);
  const update = useCallback((change: Partial<T['content']> | ((previous: T['content']) => T['content'])) => {
    const current = store.getSnapshot().record as T;
    const content = typeof change === 'function' ? change(current.content) : { ...current.content, ...change };
    store.update({ ...current, content } as T);
  }, [store]);
  return { value: state.record.content as T['content'], update, saveState: state.saveState, saveError: state.saveError, retrySave: store.flush };
}
