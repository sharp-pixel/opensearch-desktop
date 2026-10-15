// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { InvestigationProvider, useInvestigationStore } from '../../features/investigation/ui/InvestigationContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { InvestigationCellList } from '../../features/investigation/ui/InvestigationCellList';
import type { InvestigationStore } from '../../features/investigation/state/store';
const { renderEditor } = vi.hoisted(() => ({ renderEditor: vi.fn() }));
vi.mock('../../editor/WorkbenchEditor', () => ({ WorkbenchEditor: (props: { value: string }) => { renderEditor(props.value); return null; } }));
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
it('keeps other editors unchanged when one cell edits or reports progress', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let store!: InvestigationStore;
  function Probe() { store = useInvestigationStore(); return React.createElement(InvestigationCellList); }
  const root = createRoot(document.createElement('div'));
  try {
    await act(async () => root.render(React.createElement(ThemeProvider, null,
      React.createElement(InvestigationProvider, null, React.createElement(Probe)))));
    await act(async () => { store.createNewInvestigation('Rendering'); store.addCell('ppl'); store.addCell('ppl'); });
    const [first, second] = store.getSnapshot().activeInvestigation!.cells;
    await act(async () => { store.updateCell(first!.id, { query: 'source=first' }); store.updateCell(second!.id, { query: 'source=second' }); });
    renderEditor.mockClear();
    await act(async () => store.setClusterStatus(first!.id, { connectionId: 'cluster', connectionName: 'Cluster', status: 'executing' }));
    expect(renderEditor).toHaveBeenCalledWith('source=first');
    expect(renderEditor).not.toHaveBeenCalledWith('source=second');
    renderEditor.mockClear();
    await act(async () => store.updateCell(first!.id, { query: 'source=changed' }));
    expect(renderEditor).toHaveBeenCalledWith('source=changed');
    expect(renderEditor).not.toHaveBeenCalledWith('source=second');
    await act(async () => store.saveCurrentInvestigation());
    renderEditor.mockClear();
    await act(async () => store.createNewInvestigation('Another'));
    expect(renderEditor).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
