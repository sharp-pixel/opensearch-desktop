// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getFeatureFileWorkspace, type FeatureFileSettings } from './featureFileWorkspace';
export function useFeatureFileWorkspace<T>(settings: FeatureFileSettings<T>) {
  const [files] = useState(() => getFeatureFileWorkspace(settings));
  const state = useSyncExternalStore(files.subscribe, files.getSnapshot);
  useEffect(() => {
    const flush = () => { void files.retrySave(); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [files]);
  const update = files.update;
  return { value: state.active?.content ?? settings.empty, update, saveState: state.saveState, saveError: state.saveError, retrySave: files.retrySave, files, fileState: state };
}
