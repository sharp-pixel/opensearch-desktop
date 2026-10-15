// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { IDBFactory } from 'fake-indexeddb';
import { initializeWorkspaceStorage } from '../../storage/bootstrap';
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { simulateTimeline, createDefaultSimulationParams } from '../../features/ism/domain/ismTimelineSimulator';
import { ISMAnalyzerProvider, useISMAnalyzer } from '../../features/ism/ui/ISMAnalyzerContext';
import { DataPrepperProvider, useDataPrepper } from '../../features/dataprepper/ui/DataPrepperContext';
import type { ISMPolicy } from '../../types/ism';

let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('R04 stops an instantaneous cycle with an explanation', () => {
  const policy: ISMPolicy = { policy: { description: 'cycle', default_state: 'a', states: [
    { name: 'a', transitions: [{ state_name: 'b' }] },
    { name: 'b', transitions: [{ state_name: 'a' }] },
  ] } };
  const result = simulateTimeline(policy, createDefaultSimulationParams());
  expect(result.warning).toContain('without advancing time');
  expect(result.events).toHaveLength(3);
});

it('R04 preserves immediate acyclic transitions and bounds excessive durations', () => {
  const policy: ISMPolicy = { policy: { description: 'chain', default_state: 'a', states: [
    { name: 'a', transitions: [{ state_name: 'b', conditions: { min_index_age: '2d' } }] },
    { name: 'b', transitions: [{ state_name: 'c' }] },
    { name: 'c', actions: [{ delete: {} }] },
  ] } };
  const result = simulateTimeline(policy, createDefaultSimulationParams());
  expect(result.finalState).toBe('c');
  expect(result.totalDuration).toBe(2 * 86400000);
  expect(result.warning).toBeUndefined();
  policy.policy.states[0]!.transitions![0]!.conditions = { min_index_age: '999999d' };
  expect(simulateTimeline(policy, { ...createDefaultSimulationParams(), simulationDays: Infinity }).warning).toContain('10,000');
});

it('R05 restores policy and layout in StrictMode without overwriting storage', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.setItem('ism-analyzer-state', JSON.stringify({ policyJson: '' }));
  localStorage.setItem('ism-analyzer-layout', JSON.stringify({ editorWidth: 30, rightPanelWidth: 70 }));
  await initializeWorkspaceStorage();
  let state!: ReturnType<typeof useISMAnalyzer>;
  function Probe() {
    const value = useISMAnalyzer();
    useEffect(() => { state = value; }, [value]);
    return null;
  }
  root = createRoot(document.createElement('div'));
  await act(async () => root!.render(React.createElement(React.StrictMode, null, React.createElement(ISMAnalyzerProvider, null, React.createElement(Probe)))));
  expect(state.policyJson).toBe('');
  expect(state.layoutPreferences.editorWidth).toBe(30);
  expect(JSON.parse(localStorage.getItem('ism-analyzer-state')!).policyJson).toBe('');
});

it('R05 restores Data Prepper input, format, and pipeline in StrictMode', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  localStorage.setItem('dataprepper-workbench-state', JSON.stringify({ sourceData: '', sourceFormat: 'csv', pipelineConfig: 'saved:\n  processor: []' }));
  await initializeWorkspaceStorage();
  let state!: ReturnType<typeof useDataPrepper>;
  function Probe() {
    const value = useDataPrepper();
    useEffect(() => { state = value; }, [value]);
    return null;
  }
  root = createRoot(document.createElement('div'));
  await act(async () => root!.render(React.createElement(React.StrictMode, null, React.createElement(DataPrepperProvider, null, React.createElement(Probe)))));
  expect(state.sourceData).toBe('');
  expect(state.sourceFormat).toBe('csv');
  expect(state.pipelineConfig).toBe('saved:\n  processor: []');
  expect(JSON.parse(localStorage.getItem('dataprepper-workbench-state')!).sourceData).toBe('');
});
