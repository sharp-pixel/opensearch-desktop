// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { createRequire } from 'node:module';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { simulatePipeline } from '../../services/pipelineSimulator';
import { getNestedValue, setNestedValue, deleteNestedValue, deepClone } from '../../services/processors/utils';
import { secureFetch } from '../../utils/platform';

const require = createRequire(import.meta.url);
const { configureNavigation, isTrustedSender, configureLocalCertificates } = require('../../../electron/security.cjs');

afterEach(() => {
  delete window.electronAPI;
  delete window.__TAURI_INTERNALS__;
  vi.unstubAllGlobals();
});

describe('R01: Electron trust boundary', () => {
  it.each(['http://localhost:5173/', 'file:///Applications/workbench/dist/index.html'])('restricts navigation and IPC for %s', entry => {
    const listeners: Record<string, (...args: any[]) => void> = {};
    let openWindow!: (details: { url: string }) => { action: string };
    const webContents = {
      mainFrame: { url: entry },
      on: (name: string, handler: (...args: any[]) => void) => { listeners[name] = handler; },
      setWindowOpenHandler: (handler: typeof openWindow) => { openWindow = handler; },
    };
    const shell = { openExternal: vi.fn().mockResolvedValue(undefined) };
    configureNavigation(webContents, shell, entry);
    const preventDefault = vi.fn();
    listeners['will-navigate']!({ preventDefault }, 'https://external.example/');
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(shell.openExternal).toHaveBeenCalledWith('https://external.example/');
    expect(openWindow({ url: 'file:///etc/passwd' }).action).toBe('deny');
    expect(openWindow({ url: 'javascript:alert(1)' }).action).toBe('deny');
    expect(shell.openExternal).toHaveBeenCalledTimes(1);
    preventDefault.mockClear();
    listeners['will-navigate']!({ preventDefault }, entry + '#cell');
    expect(preventDefault).not.toHaveBeenCalled();
    listeners['will-redirect']!({ preventDefault }, 'https://external.example/');
    expect(preventDefault).toHaveBeenCalledOnce();
    const event = { sender: webContents, senderFrame: webContents.mainFrame };
    expect(isTrustedSender(event, webContents, entry)).toBe(true);
    expect(isTrustedSender({ ...event, senderFrame: { url: entry } }, webContents, entry)).toBe(false);
    expect(isTrustedSender({ ...event, sender: {} }, webContents, entry)).toBe(false);
    webContents.mainFrame.url = 'https://external.example/';
    expect(isTrustedSender(event, webContents, entry)).toBe(false);
  });
});

describe('R02: exact localhost routing', () => {
  it('accepts only exact local hostnames in the native Electron certificate verifier', () => {
    let verify!: (request: { hostname: string }, callback: (result: number) => void) => void;
    configureLocalCertificates({ setCertificateVerifyProc: (handler: typeof verify) => { verify = handler; } });
    for (const hostname of ['localhost', '127.0.0.1']) {
      const callback = vi.fn();
      verify({ hostname }, callback);
      expect(callback).toHaveBeenCalledWith(0);
    }
    for (const hostname of ['example.com', 'localhost.example.com', '127.0.0.1.example.com', 'localhost@remote.example']) {
      const callback = vi.fn();
      verify({ hostname }, callback);
      expect(callback).toHaveBeenCalledWith(-3);
    }
  });
  it.each(['https://localhost.example.com', 'https://localhost@remote.example', 'https://127.0.0.1.example.com'])('does not exempt %s', async url => {
    const invoke = vi.fn();
    window.__TAURI_INTERNALS__ = { invoke };
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await secureFetch(url);
    expect(invoke).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(url, undefined);
  });
});

describe('R03: processor prototype protection', () => {
  it.each(['__proto__.polluted', '/__proto__/polluted', 'constructor.prototype.polluted', 'nested.__proto__.polluted'])('rejects %s', path => {
    expect(() => setNestedValue({}, path, true)).toThrow('Unsafe field path');
    expect(() => deleteNestedValue({}, path)).toThrow('Unsafe field path');
    expect(() => getNestedValue({}, path)).toThrow('Unsafe field path');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('reports unsafe pipeline fields as processing errors', () => {
    const result = simulatePipeline('{}', 'json', 'test:\n  processor:\n    - add_entries:\n        entries:\n          - key: __proto__.polluted\n            value: true\n');
    expect(result.success).toBe(false);
    expect(result.errors[0]?.message).toBe('Unsafe field path');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('clones a literal prototype key without changing the object prototype', () => {
    const source = JSON.parse('{"__proto__":{"polluted":true}}');
    const cloned = deepClone(source);
    expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(cloned, '__proto__')).toBe(true);
    expect(getNestedValue(Object.create({ inherited: true }), 'inherited')).toBeUndefined();
  });
});

it('R18 does not send AbortSignal across Electron IPC', async () => {
  const proxy = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', body: {} });
  window.electronAPI = { isElectron: true, fetch: proxy } as unknown as NonNullable<Window['electronAPI']>;
  await secureFetch('https://localhost:9200', { method: 'POST', body: '{}', signal: new AbortController().signal });
  expect(proxy).toHaveBeenCalledWith('https://localhost:9200', { method: 'POST', body: '{}', headers: {}, requestId: expect.any(String) });
});
