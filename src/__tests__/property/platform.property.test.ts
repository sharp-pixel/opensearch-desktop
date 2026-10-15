// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Platform Utility Tests
 * Tests for platform detection and native API utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isElectron,
  isTauri,
  isDesktopApp,
  isMacOS,
  needsTrafficLightPadding,
  getElectronAPI,
  nativeAPI,
  secureFetch,
} from '../../utils/platform';

describe('Platform Utility Tests', () => {
  // Store original window properties
  const originalWindow = { ...window };

  beforeEach(() => {
    // Reset window properties before each test
    vi.stubGlobal('window', { ...originalWindow });
    delete (window as any).electronAPI;
    delete (window as any).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isElectron', () => {
    it('returns false when electronAPI is not present', () => {
      expect(isElectron()).toBe(false);
    });

    it('returns false when electronAPI.isElectron is false', () => {
      (window as any).electronAPI = { isElectron: false };
      expect(isElectron()).toBe(false);
    });

    it('returns true when electronAPI.isElectron is true', () => {
      (window as any).electronAPI = { isElectron: true };
      expect(isElectron()).toBe(true);
    });
  });

  describe('isTauri', () => {
    it('returns false when __TAURI_INTERNALS__ is not present', () => {
      expect(isTauri()).toBe(false);
    });

    it('returns true when __TAURI_INTERNALS__ is present', () => {
      (window as any).__TAURI_INTERNALS__ = { invoke: vi.fn() };
      expect(isTauri()).toBe(true);
    });
  });


  describe('isDesktopApp', () => {
    it('returns false when neither Electron nor Tauri', () => {
      expect(isDesktopApp()).toBe(false);
    });

    it('returns true when Electron is present', () => {
      (window as any).electronAPI = { isElectron: true };
      expect(isDesktopApp()).toBe(true);
    });

    it('returns true when Tauri is present', () => {
      (window as any).__TAURI_INTERNALS__ = { invoke: vi.fn() };
      expect(isDesktopApp()).toBe(true);
    });
  });

  describe('isMacOS', () => {
    it('returns true when platform includes mac', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      expect(isMacOS()).toBe(true);
    });

    it('returns true when platform is macOS', () => {
      vi.stubGlobal('navigator', { platform: 'macOS' });
      expect(isMacOS()).toBe(true);
    });

    it('returns false when platform is Windows', () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      expect(isMacOS()).toBe(false);
    });

    it('returns false when platform is Linux', () => {
      vi.stubGlobal('navigator', { platform: 'Linux x86_64' });
      expect(isMacOS()).toBe(false);
    });
  });

  describe('needsTrafficLightPadding', () => {
    it('returns false when not a desktop app', () => {
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      expect(needsTrafficLightPadding()).toBe(false);
    });

    it('returns false when desktop app but not macOS', () => {
      (window as any).electronAPI = { isElectron: true };
      vi.stubGlobal('navigator', { platform: 'Win32' });
      expect(needsTrafficLightPadding()).toBe(false);
    });

    it('returns true when Electron on macOS', () => {
      (window as any).electronAPI = { isElectron: true };
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      expect(needsTrafficLightPadding()).toBe(true);
    });

    it('returns true when Tauri on macOS', () => {
      (window as any).__TAURI_INTERNALS__ = { invoke: vi.fn() };
      vi.stubGlobal('navigator', { platform: 'MacIntel' });
      expect(needsTrafficLightPadding()).toBe(true);
    });
  });


  describe('getElectronAPI', () => {
    it('returns undefined when electronAPI is not present', () => {
      expect(getElectronAPI()).toBeUndefined();
    });

    it('returns electronAPI when present', () => {
      const mockAPI = { isElectron: true, platform: 'darwin' };
      (window as any).electronAPI = mockAPI;
      expect(getElectronAPI()).toBe(mockAPI);
    });
  });

  describe('nativeAPI.aws', () => {
    it('getProfiles returns empty array when no backend', async () => {
      const result = await nativeAPI.aws.getProfiles();
      expect(result).toEqual([]);
    });

    it('getProfiles calls Electron API when available', async () => {
      const mockProfiles = [{ name: 'default' }];
      (window as any).electronAPI = {
        isElectron: true,
        aws: { getProfiles: vi.fn().mockResolvedValue(mockProfiles) },
      };
      const result = await nativeAPI.aws.getProfiles();
      expect(result).toEqual(mockProfiles);
    });

    it('getProfiles calls Tauri invoke when available', async () => {
      const mockProfiles = [{ name: 'default' }];
      const mockInvoke = vi.fn().mockResolvedValue(mockProfiles);
      (window as any).__TAURI_INTERNALS__ = { invoke: mockInvoke };
      const result = await nativeAPI.aws.getProfiles();
      expect(result).toEqual(mockProfiles);
      expect(mockInvoke).toHaveBeenCalledWith('get_aws_profiles', undefined);
    });

    it('getProfileCredentials returns null when no backend', async () => {
      const result = await nativeAPI.aws.getProfileCredentials('default');
      expect(result).toBeNull();
    });

    it('getProfileCredentials calls Electron API when available', async () => {
      const mockCreds = { accessKeyId: 'test' };
      (window as any).electronAPI = {
        isElectron: true,
        aws: { getProfileCredentials: vi.fn().mockResolvedValue(mockCreds) },
      };
      const result = await nativeAPI.aws.getProfileCredentials('default');
      expect(result).toEqual(mockCreds);
    });

    it('refreshProfiles returns empty array when no backend', async () => {
      const result = await nativeAPI.aws.refreshProfiles();
      expect(result).toEqual([]);
    });
  });


  describe('nativeAPI.safeStorage', () => {
    it('isAvailable returns false when no backend', async () => {
      const result = await nativeAPI.safeStorage.isAvailable();
      expect(result).toBe(false);
    });

    it('isAvailable calls Electron API when available', async () => {
      (window as any).electronAPI = {
        isElectron: true,
        safeStorage: { isAvailable: vi.fn().mockResolvedValue(true) },
      };
      const result = await nativeAPI.safeStorage.isAvailable();
      expect(result).toBe(true);
    });

    it('isAvailable calls Tauri invoke when available', async () => {
      const mockInvoke = vi.fn().mockResolvedValue(true);
      (window as any).__TAURI_INTERNALS__ = { invoke: mockInvoke };
      const result = await nativeAPI.safeStorage.isAvailable();
      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('safe_storage_is_available', undefined);
    });

    it('encrypt returns null when no backend', async () => {
      const result = await nativeAPI.safeStorage.encrypt('secret');
      expect(result).toBeNull();
    });

    it('encrypt calls Electron API when available', async () => {
      (window as any).electronAPI = {
        isElectron: true,
        safeStorage: { encrypt: vi.fn().mockResolvedValue('encrypted') },
      };
      const result = await nativeAPI.safeStorage.encrypt('secret');
      expect(result).toBe('encrypted');
    });

    it('decrypt returns null when no backend', async () => {
      const result = await nativeAPI.safeStorage.decrypt('encrypted');
      expect(result).toBeNull();
    });

    it('decrypt calls Electron API when available', async () => {
      (window as any).electronAPI = {
        isElectron: true,
        safeStorage: { decrypt: vi.fn().mockResolvedValue('decrypted') },
      };
      const result = await nativeAPI.safeStorage.decrypt('encrypted');
      expect(result).toBe('decrypted');
    });
  });


  describe('secureFetch', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue(new Response('{}'));
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('uses regular fetch for non-localhost URLs', async () => {
      await secureFetch('https://example.com/api');
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/api', undefined);
    });

    it('uses regular fetch for HTTP localhost', async () => {
      await secureFetch('http://localhost:9200/_cat/indices');
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:9200/_cat/indices', undefined);
    });

    it('uses regular fetch for HTTPS localhost when not in desktop app', async () => {
      await secureFetch('https://localhost:9200/_cat/indices');
      expect(global.fetch).toHaveBeenCalledWith('https://localhost:9200/_cat/indices', undefined);
    });

    it('uses Electron fetch proxy for HTTPS localhost when in Electron', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: { indices: [] },
      });
      (window as any).electronAPI = {
        isElectron: true,
        fetch: mockFetch,
      };

      const response = await secureFetch('https://localhost:9200/_cat/indices');
      expect(mockFetch).toHaveBeenCalledWith('https://localhost:9200/_cat/indices', { headers: {}, requestId: expect.any(String) });
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    it('uses Electron fetch proxy for HTTPS 127.0.0.1 when in Electron', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: { data: 'test' },
      });
      (window as any).electronAPI = {
        isElectron: true,
        fetch: mockFetch,
      };

      const response = await secureFetch('https://127.0.0.1:9200/test');
      expect(mockFetch).toHaveBeenCalled();
      expect(response.ok).toBe(true);
    });

    it('uses Tauri fetch proxy for HTTPS localhost when in Tauri', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        status_text: 'OK',
        body: { data: 'test' },
      });
      (window as any).__TAURI_INTERNALS__ = { invoke: mockInvoke };

      const response = await secureFetch('https://localhost:9200/test');
      expect(mockInvoke).toHaveBeenCalledWith('fetch_proxy', expect.any(Object));
      expect(response.ok).toBe(true);
    });


    it('response json() returns body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: { indices: ['test-index'] },
      });
      (window as any).electronAPI = {
        isElectron: true,
        fetch: mockFetch,
      };

      const response = await secureFetch('https://localhost:9200/_cat/indices');
      const json = await response.json();
      expect(json).toEqual({ indices: ['test-index'] });
    });

    it('response text() returns stringified body for objects', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: { key: 'value' },
      });
      (window as any).electronAPI = {
        isElectron: true,
        fetch: mockFetch,
      };

      const response = await secureFetch('https://localhost:9200/test');
      const text = await response.text();
      expect(text).toBe('{"key":"value"}');
    });

    it('response text() returns string body directly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: 'plain text response',
      });
      (window as any).electronAPI = {
        isElectron: true,
        fetch: mockFetch,
      };

      const response = await secureFetch('https://localhost:9200/test');
      const text = await response.text();
      expect(text).toBe('plain text response');
    });

    it('response clone preserves the response body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: {},
      });
      (window as any).electronAPI = {
        isElectron: true,
        fetch: mockFetch,
      };

      const response = await secureFetch('https://localhost:9200/test');
      expect(await response.clone().text()).toBe(await response.text());
    });

    it('passes options to Electron fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: {},
      });
      (window as any).electronAPI = {
        isElectron: true,
        fetch: mockFetch,
      };

      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      };

      await secureFetch('https://localhost:9200/_search', options);
      expect(mockFetch).toHaveBeenCalledWith('https://localhost:9200/_search', { ...options, requestId: expect.any(String) });
    });
  });
});
