// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, expect, it, vi } from 'vitest';
import { encryptData, decryptData, encryptCredentials, releaseCredentials } from '../../utils/crypto';
import { saveConnectionAsync, deleteConnectionAsync, loadConnectionsAsync } from '../../services/persistence';

afterEach(() => { delete window.__TAURI_INTERNALS__; localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function vault() {
  const secrets = new Map<string, string>();
  window.__TAURI_INTERNALS__ = { invoke: vi.fn(async (command: string, args?: Record<string, unknown>) => {
    if (command === 'safe_storage_encrypt') { const id = String(args?.reference); secrets.set(id, String(args?.plaintext)); return id; }
    if (command === 'safe_storage_decrypt') return secrets.get(String(args?.encryptedBase64)) ?? null;
    if (command === 'safe_storage_delete') { secrets.delete(String(args?.reference)); return; }
    return true;
  }) as NonNullable<Window['__TAURI_INTERNALS__']>['invoke'] };
  return secrets;
}
it('stores only native references and reports missing secrets', async () => {
  const secrets = vault();
  const reference = await encryptData('test-only secret');
  expect(reference).toMatch(/^tv:keyring:[a-f0-9-]+$/);
  expect(await decryptData(reference)).toBe('test-only secret');
  secrets.clear(); await expect(decryptData(reference)).rejects.toThrow('Failed to decrypt');
});
it('reuses references and retires them only after a successful connection commit', async () => {
  const secrets = vault();
  const connection = { id: 'vault-test', name: 'Test', endpoint: 'https://example.invalid', authType: 'basic' as const,
    credentials: { username: 'test', password: 'first' }, useProxy: false };
  await saveConnectionAsync(connection);
  const count = secrets.size;
  await saveConnectionAsync({ ...connection, name: 'Renamed' });
  expect(secrets.size).toBe(count);
  const original = localStorage.getItem('opensearch-notebook:connections:encrypted');
  const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  await expect(saveConnectionAsync({ ...connection, credentials: { username: 'test', password: 'second' } })).rejects.toThrow('Quota');
  set.mockRestore();
  expect(localStorage.getItem('opensearch-notebook:connections:encrypted')).toBe(original);
  expect([...secrets.values()]).toContain('first'); expect([...secrets.values()]).not.toContain('second');
  await deleteConnectionAsync(connection.id); expect([...secrets.values()]).not.toContain('first');
});
it('preserves a connection with an unavailable credential while other connections are saved', async () => {
  const secrets = vault();
  const encrypted = await encryptCredentials({ password: 'gone' });
  localStorage.setItem('opensearch-notebook:connections:encrypted', JSON.stringify([{ id: 'missing', name: 'Missing', endpoint: 'https://example.invalid', authType: 'basic', encryptedCredentials: encrypted }]));
  secrets.clear();
  expect((await loadConnectionsAsync()).find(value => value.id === 'missing')?.credentialError).toBeTruthy();
  await saveConnectionAsync({ id: 'other', name: 'Other', endpoint: 'https://example.invalid', authType: 'none', credentials: null });
  expect(JSON.parse(localStorage.getItem('opensearch-notebook:connections:encrypted')!).find((value: { id: string }) => value.id === 'missing').encryptedCredentials).toBe(encrypted);
  await releaseCredentials(encrypted);
});

function crossWindowLock() {
  vi.stubGlobal('navigator', { locks: { request: (_name: string, callback: () => Promise<unknown>) => callback() } });
}

it('journals only references before a native write and recovers an interrupted save', async () => {
  const secrets = vault();
  crossWindowLock();
  const orphan = await encryptData('interrupted-test-secret');
  expect(secrets.has(orphan.slice(3))).toBe(true);
  expect(Object.values(localStorage).join(' ')).not.toContain('interrupted-test-secret');
  // No metadata commit: the next serialized load must retire the abandoned entry.
  await loadConnectionsAsync();
  expect(secrets.size).toBe(0);
  expect(localStorage.getItem('opensearch-workbench:vault-reference:' + orphan.slice(3))).toBeNull();
});

it('preserves committed references while retrying an interrupted old-secret cleanup', async () => {
  const secrets = vault();
  crossWindowLock();
  const conn = { id: 'rotate', name: 'Rotate', endpoint: 'https://example.invalid', authType: 'apikey' as const,
    credentials: { apiKey: 'first-test-secret' } };
  await saveConnectionAsync(conn);
  const invoke = window.__TAURI_INTERNALS__!.invoke;
  window.__TAURI_INTERNALS__!.invoke = vi.fn(async (command, args) => {
    if (command === 'safe_storage_delete') throw new Error('Vault locked');
    return invoke(command, args);
  }) as typeof invoke;
  await saveConnectionAsync({ ...conn, credentials: { apiKey: 'second-test-secret' } });
  expect([...secrets.values()].includes('first-test-secret')).toBe(true);
  expect([...secrets.values()].includes('second-test-secret')).toBe(true);
  window.__TAURI_INTERNALS__!.invoke = invoke;
  const loaded = await loadConnectionsAsync();
  expect(loaded.find(value => value.id === conn.id)?.credentials).toEqual({ apiKey: 'second-test-secret' });
  expect([...secrets.values()].includes('first-test-secret')).toBe(false);
  expect([...secrets.values()].includes('second-test-secret')).toBe(true);
});

it('does not sweep pending entries when cross-window exclusion is unavailable', async () => {
  const secrets = vault();
  vi.stubGlobal('navigator', {});
  await encryptData('another-writer-test-secret');
  await loadConnectionsAsync();
  expect(secrets.size).toBe(1);
});

it('does not touch the vault when its reference journal cannot be saved', async () => {
  const secrets = vault();
  const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  try {
    await expect(encryptData('test-secret')).rejects.toThrow('Failed to encrypt');
    expect(secrets.size).toBe(0);
    expect(window.__TAURI_INTERNALS__!.invoke).not.toHaveBeenCalled();
  } finally { set.mockRestore(); }
});

it('rejects failed native read-back and preserves previously committed metadata', async () => {
  const secrets = vault();
  const conn = { id: 'verify', name: 'Verify', endpoint: 'https://example.invalid', authType: 'basic' as const,
    credentials: { username: 'test', password: 'existing-test-secret' } };
  await saveConnectionAsync(conn);
  const original = localStorage.getItem('opensearch-notebook:connections:encrypted');
  const invoke = window.__TAURI_INTERNALS__!.invoke;
  window.__TAURI_INTERNALS__!.invoke = vi.fn(async (command, args) => {
    if (command === 'safe_storage_decrypt' && secrets.get(String(args?.encryptedBase64)) === 'new-test-secret') return null;
    return invoke(command, args);
  }) as typeof invoke;
  await expect(saveConnectionAsync({ ...conn, credentials: { username: 'test', password: 'new-test-secret' } })).rejects.toThrow('Failed to encrypt');
  expect(localStorage.getItem('opensearch-notebook:connections:encrypted')).toBe(original);
  expect([...secrets.values()].includes('existing-test-secret')).toBe(true);
  expect([...secrets.values()].includes('new-test-secret')).toBe(false);
});

it('preserves all journaled secrets when connection metadata is malformed', async () => {
  const secrets = vault();
  crossWindowLock();
  await encryptData('protected-test-secret');
  localStorage.setItem('opensearch-notebook:connections:encrypted', JSON.stringify([{ id: 'corrupt' }]));
  await expect(loadConnectionsAsync()).rejects.toThrow('Existing records have been preserved');
  expect([...secrets.values()]).toEqual(['protected-test-secret']);
});
