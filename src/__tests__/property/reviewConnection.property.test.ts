// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../context/ThemeContext';
import { ConnectionModal } from '../../components/Dialogs/ConnectionModal';
import { InvestigationWorkspace } from '../../features/investigation/ui/InvestigationWorkspace';
import { loadConnectionsAsync } from '../../services/persistence';
import * as platform from '../../platform/runtime';

vi.mock('../../features/investigation/ui/InvestigationCellList', () => ({ InvestigationCellList: () => null }));
vi.mock('../../features/investigation/ui/ClusterSelector', () => ({ ClusterSelector: ({ onEditConnection }: { onEditConnection: (c: unknown) => void }) =>
  React.createElement('button', { onClick: () => onEditConnection({ id: 'saved', name: 'Edited connection', endpoint: 'https://cluster.example', authType: 'none', credentials: null }) }, 'Edit connection') }));

let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  container?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});
async function render(child: React.ReactElement) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ cluster_name: 'test', status: 'green' }))));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(React.createElement(ThemeProvider, null, child)));
}
async function click(label: string) {
  const button = Array.from((document.querySelector('[role="dialog"]') ?? document).querySelectorAll('button')).find(b => b.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
const existingConnection = { id: 'saved', name: 'Cluster', endpoint: 'https://cluster.example', authType: 'none' as const, credentials: null };

it.each([false, true])('shows the localhost proxy option only in browser development (desktop: %s)', async desktop => {
  vi.spyOn(platform, 'isDesktopApp').mockReturnValue(desktop);
  await render(React.createElement(ConnectionModal, { isOpen: true, onClose: vi.fn(), onSave: vi.fn(),
    existingConnection: { ...existingConnection, endpoint: 'https://localhost:9200', useProxy: true } }));
  expect(document.body.textContent?.includes('Use development proxy')).toBe(!desktop);
  expect(document.body.textContent?.includes('Self-signed certificates are accepted automatically')).toBe(desktop);
  expect(document.querySelector<HTMLInputElement>('input[id$="-grpcEndpoint"]')?.value).toBe('http://localhost:9400');
});

it('R06 persists the connection supplied by the investigation dialog', async () => {
  await render(React.createElement(InvestigationWorkspace));
  await click('New');
  await click('Edit connection');
  await click('Save');
  await act(async () => {
    await vi.waitFor(async () => {
      const connections = await loadConnectionsAsync();
      expect(connections.find(c => c.id === 'saved')).toMatchObject({ name: 'Edited connection', endpoint: existingConnection.endpoint });
    });
  });
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(document.querySelector('[aria-label="Close modal"]')).toBeNull();
  });
});

it('R06 keeps the dialog open while saving and displays storage failures', async () => {
  const onClose = vi.fn();
  let rejectSave!: (error: Error) => void;
  const onSave = vi.fn(() => new Promise<void>((_, reject) => { rejectSave = reject; }));
  await render(React.createElement(ConnectionModal, { isOpen: true, onClose, onSave, existingConnection }));
  await click('Save');
  expect(onSave).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
  expect(Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Validating...')?.disabled).toBe(true);
  await act(async () => rejectSave(new Error('Storage quota exceeded')));
  expect(onClose).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('Storage quota exceeded');
});
