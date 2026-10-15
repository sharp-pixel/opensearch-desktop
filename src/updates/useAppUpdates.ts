// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { useEffect, useSyncExternalStore } from 'react';
import { updateStore } from './store';
export function useAppUpdates() {
  const state = useSyncExternalStore(updateStore.subscribe, updateStore.getSnapshot);
  useEffect(() => { void updateStore.initialize(); }, []);
  return state;
}
