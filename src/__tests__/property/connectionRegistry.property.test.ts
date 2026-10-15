// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { createConnectionRegistry, type ConnectionRepository } from '../../connections/registry';
import { ConnectionProvider, useConnections } from '../../connections/ConnectionProvider';
import { AppProvider } from '../../app/AppProviders';
import { InvestigationProvider, useInvestigation } from '../../features/investigation/ui/InvestigationContext';
import type { ConnectionConfig } from '../../types/connection';

const connection: ConnectionConfig = { id: 'one', name: 'One', endpoint: 'https://one.test', authType: 'none', credentials: null };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function repository(): ConnectionRepository {
  return { load: vi.fn().mockResolvedValue([connection]), save: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(undefined) };
}
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

it('serializes initial loading and saves without exposing an uncommitted edit', async () => {
  const repo = repository();
  const loading = deferred<ConnectionConfig[]>();
  const saving = deferred<void>();
  repo.load = () => loading.promise;
  repo.save = () => saving.promise;
  const registry = createConnectionRegistry(repo);
  const initialized = registry.initialize();
  const edited = { ...connection, name: 'Edited' };
  const saved = registry.save(edited);
  edited.name = 'Changed after save started';
  loading.resolve([connection]);
  await initialized;
  expect(registry.getSnapshot().connections[0]?.name).toBe('One');
  saving.resolve();
  await saved;
  expect(registry.getSnapshot().connections[0]?.name).toBe('Edited');
});

it('preserves committed state on save/delete failure and permits retry', async () => {
  const repo = repository();
  const registry = createConnectionRegistry(repo);
  await registry.initialize();
  const original = registry.getSnapshot().connections;
  repo.save = vi.fn().mockRejectedValueOnce(new Error('Vault locked')).mockResolvedValue(undefined);
  await expect(registry.save({ ...connection, name: 'Edited' })).rejects.toThrow('Vault locked');
  expect(registry.getSnapshot().connections).toBe(original);
  expect(registry.getSnapshot().error).toBe('Vault locked');
  await registry.save({ ...connection, name: 'Edited' });
  expect(registry.getSnapshot().error).toBeNull();
  repo.remove = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(undefined);
  await expect(registry.remove('one')).rejects.toThrow('Unavailable');
  expect(registry.getSnapshot().activeId).toBe('one');
  await registry.remove('one');
  expect(registry.getSnapshot().connections).toEqual([]);
  expect(registry.getSnapshot().activeId).toBeNull();
});

it('replaces connection identity for cache invalidation and preserves explicit disconnection', async () => {
  const registry = createConnectionRegistry(repository());
  await registry.initialize();
  const previous = registry.getSnapshot().connections[0];
  await registry.save({ ...connection, endpoint: 'https://changed.test' });
  expect(registry.getSnapshot().connections[0]).not.toBe(previous);
  registry.select(null);
  await registry.refresh();
  expect(registry.getSnapshot().activeId).toBeNull();
});

it('shares committed edits between Notebook and Investigations without remounting', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const registry = createConnectionRegistry(repository());
  let notebook!: ReturnType<typeof useConnections>;
  let investigation!: ReturnType<typeof useInvestigation>;
  function NotebookProbe() { const value = useConnections(); useEffect(() => { notebook = value; }, [value]); return null; }
  function InvestigationProbe() { const value = useInvestigation(); useEffect(() => { investigation = value; }, [value]); return null; }
  const root = createRoot(document.createElement('div'));
  try {
    await act(async () => root.render(React.createElement(ConnectionProvider, { registry },
      React.createElement(AppProvider, null, React.createElement(NotebookProbe),
        React.createElement(InvestigationProvider, null, React.createElement(InvestigationProbe))))));
    await act(async () => notebook.updateConnection({ ...connection, endpoint: 'https://new.test' }));
    expect(notebook.activeConnection?.endpoint).toBe('https://new.test');
    expect(investigation.state.connections).toBe(notebook.connections);
    await act(async () => notebook.removeConnection('one'));
    expect(investigation.state.connections).toEqual([]);
  } finally { await act(async () => root.unmount()); }
});
