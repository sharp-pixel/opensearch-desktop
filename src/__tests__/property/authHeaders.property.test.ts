// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Auth Headers Utility
 * Tests generateAuthHeaders, generateBasicAuthHeader, generateApiKeyHeader, hasValidCredentials
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ConnectionConfig, BasicAuthCredentials, ApiKeyCredentials, SigV4Credentials } from '../../types/connection';
import {
  generateAuthHeaders,
  generateBasicAuthHeader,
  generateApiKeyHeader,
  hasValidCredentials,
} from '../../utils/authHeaders';

describe('Auth Headers Utility Tests', () => {
  describe('generateBasicAuthHeader', () => {
    it('generates valid Basic auth header', () => {
      const creds: BasicAuthCredentials = { username: 'admin', password: 'secret' };
      const headers = generateBasicAuthHeader(creds);
      
      expect(headers.Authorization).toMatch(/^Basic /);
      
      // Decode and verify
      const encoded = headers.Authorization?.replace('Basic ', '') ?? '';
      const decoded = atob(encoded);
      expect(decoded).toBe('admin:secret');
    });

    it('returns empty object for null credentials', () => {
      const headers = generateBasicAuthHeader(null as unknown as BasicAuthCredentials);
      expect(headers).toEqual({});
    });

    it('returns empty object for missing username', () => {
      const headers = generateBasicAuthHeader({ username: '', password: 'secret' });
      expect(headers).toEqual({});
    });

    it('handles special characters in credentials', () => {
      const creds: BasicAuthCredentials = { username: 'user@domain.com', password: 'p@ss:word!' };
      const headers = generateBasicAuthHeader(creds);
      
      const encoded = headers.Authorization?.replace('Basic ', '') ?? '';
      const decoded = atob(encoded);
      expect(decoded).toBe('user@domain.com:p@ss:word!');
    });

    it('handles empty password', () => {
      const creds: BasicAuthCredentials = { username: 'admin', password: '' };
      const headers = generateBasicAuthHeader(creds);
      
      const encoded = headers.Authorization?.replace('Basic ', '') ?? '';
      const decoded = atob(encoded);
      expect(decoded).toBe('admin:');
    });

    it('Property: roundtrip encoding/decoding preserves credentials', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('\0')),
          fc.string({ maxLength: 50 }).filter(s => !s.includes('\0')),
          (username, password) => {
            const creds: BasicAuthCredentials = { username, password };
            const headers = generateBasicAuthHeader(creds);
            
            const encoded = headers.Authorization?.replace('Basic ', '') ?? '';
            const decoded = atob(encoded);
            expect(decoded).toBe(`${username}:${password}`);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('generateApiKeyHeader', () => {
    it('generates valid ApiKey header', () => {
      const creds: ApiKeyCredentials = { apiKey: 'my-api-key-12345' };
      const headers = generateApiKeyHeader(creds);
      
      expect(headers.Authorization).toBe('ApiKey my-api-key-12345');
    });

    it('returns empty object for null credentials', () => {
      const headers = generateApiKeyHeader(null as unknown as ApiKeyCredentials);
      expect(headers).toEqual({});
    });

    it('returns empty object for missing apiKey', () => {
      const headers = generateApiKeyHeader({ apiKey: '' });
      expect(headers).toEqual({});
    });

    it('Property: apiKey is preserved in header', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (apiKey) => {
            const creds: ApiKeyCredentials = { apiKey };
            const headers = generateApiKeyHeader(creds);
            
            expect(headers.Authorization).toBe(`ApiKey ${apiKey}`);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('generateAuthHeaders', () => {
    it('generates headers for no auth', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'none',
        credentials: null,
      };
      
      const headers = generateAuthHeaders(config);
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Requested-With']).toBe('XMLHttpRequest');
      expect(headers.Authorization).toBeUndefined();
    });

    it('generates headers for basic auth', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'basic',
        credentials: { username: 'admin', password: 'secret' },
      };
      
      const headers = generateAuthHeaders(config);
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers.Authorization).toMatch(/^Basic /);
    });

    it('generates headers for API key auth', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'apikey',
        credentials: { apiKey: 'my-key' },
      };
      
      const headers = generateAuthHeaders(config);
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers.Authorization).toBe('ApiKey my-key');
    });

    it('generates base headers for SigV4 auth', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'https://search.us-east-1.es.amazonaws.com',
        authType: 'sigv4',
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'secret',
          region: 'us-east-1',
          service: 'es',
        },
      };
      
      const headers = generateAuthHeaders(config);
      
      // SigV4 headers are generated per-request, so only base headers here
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers.Authorization).toBeUndefined();
    });

    it('handles unknown auth type', () => {
      const config = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'unknown' as ConnectionConfig['authType'],
        credentials: null,
      };
      
      const headers = generateAuthHeaders(config);
      
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('hasValidCredentials', () => {
    it('returns true for none auth type', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'none',
        credentials: null,
      };
      
      expect(hasValidCredentials(config)).toBe(true);
    });

    it('returns true for valid basic auth', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'basic',
        credentials: { username: 'admin', password: 'secret' },
      };
      
      expect(hasValidCredentials(config)).toBe(true);
    });

    it('returns false for basic auth without username', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'basic',
        credentials: { username: '', password: 'secret' },
      };
      
      expect(hasValidCredentials(config)).toBe(false);
    });

    it('returns false for basic auth with null credentials', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'basic',
        credentials: null,
      };
      
      expect(hasValidCredentials(config)).toBe(false);
    });

    it('returns true for valid API key auth', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'apikey',
        credentials: { apiKey: 'my-key' },
      };
      
      expect(hasValidCredentials(config)).toBe(true);
    });

    it('returns false for API key auth without key', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'apikey',
        credentials: { apiKey: '' },
      };
      
      expect(hasValidCredentials(config)).toBe(false);
    });

    it('returns true for valid SigV4 auth', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'https://search.us-east-1.es.amazonaws.com',
        authType: 'sigv4',
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'secret',
          region: 'us-east-1',
          service: 'es',
        } as SigV4Credentials,
      };
      
      expect(hasValidCredentials(config)).toBe(true);
    });

    it('returns false for SigV4 auth missing fields', () => {
      const config: ConnectionConfig = {
        id: 'test',
        name: 'Test',
        endpoint: 'https://search.us-east-1.es.amazonaws.com',
        authType: 'sigv4',
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: '',
          region: 'us-east-1',
          service: 'es',
        } as SigV4Credentials,
      };
      
      expect(hasValidCredentials(config)).toBe(false);
    });

    it('returns false for unknown auth type', () => {
      const config = {
        id: 'test',
        name: 'Test',
        endpoint: 'http://localhost:9200',
        authType: 'unknown' as ConnectionConfig['authType'],
        credentials: null,
      };
      
      expect(hasValidCredentials(config)).toBe(false);
    });
  });
});
