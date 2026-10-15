// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for SigV4 Signing Utility
 * Tests signRequest, hasValidSigV4Credentials, fetchAwsProfileCredentials
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SigV4Credentials } from '../../types/connection';
import type { HttpMethod } from '../../types/cell';

describe('SigV4 Utility Tests', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  describe('hasValidSigV4Credentials', () => {
    it('returns true for valid static credentials', async () => {
      const { hasValidSigV4Credentials } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 'es',
      };
      
      expect(hasValidSigV4Credentials(creds)).toBe(true);
    });

    it('returns false for missing accessKeyId', async () => {
      const { hasValidSigV4Credentials } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: '',
        secretAccessKey: 'secret',
        region: 'us-east-1',
        service: 'es',
      };
      
      expect(hasValidSigV4Credentials(creds)).toBe(false);
    });

    it('returns false for missing secretAccessKey', async () => {
      const { hasValidSigV4Credentials } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: '',
        region: 'us-east-1',
        service: 'es',
      };
      
      expect(hasValidSigV4Credentials(creds)).toBe(false);
    });

    it('returns false for missing region', async () => {
      const { hasValidSigV4Credentials } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'secret',
        region: '',
        service: 'es',
      };
      
      expect(hasValidSigV4Credentials(creds)).toBe(false);
    });

    it('returns false for missing service', async () => {
      const { hasValidSigV4Credentials } = await import('../../utils/sigv4');
      
      const creds = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'secret',
        region: 'us-east-1',
        service: '',
      } as unknown as SigV4Credentials;
      
      expect(hasValidSigV4Credentials(creds)).toBe(false);
    });

    it('returns true for AWS profile credentials', async () => {
      const { hasValidSigV4Credentials } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: '',
        secretAccessKey: '',
        region: 'us-east-1',
        service: 'es',
        useAwsProfile: true,
        awsProfileName: 'default',
      };
      
      expect(hasValidSigV4Credentials(creds)).toBe(true);
    });

    it('returns false for AWS profile without profile name', async () => {
      const { hasValidSigV4Credentials } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: '',
        secretAccessKey: '',
        region: 'us-east-1',
        service: 'es',
        useAwsProfile: true,
        awsProfileName: '',
      };
      
      expect(hasValidSigV4Credentials(creds)).toBe(false);
    });
  });

  describe('signRequest', () => {
    it('generates valid SigV4 headers', async () => {
      const { signRequest } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 'es',
      };
      
      const headers = await signRequest('GET', 'https://search-domain.us-east-1.es.amazonaws.com/_cluster/health', creds);
      
      expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256/);
      expect(headers['X-Amz-Date']).toMatch(/^\d{8}T\d{6}Z$/);
      expect(headers['X-Amz-Content-Sha256']).toBeDefined();
      expect(headers.Host).toBe('search-domain.us-east-1.es.amazonaws.com');
    });

    it('includes session token when provided', async () => {
      const { signRequest } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        sessionToken: 'FwoGZXIvYXdzEBYaDK...',
        region: 'us-east-1',
        service: 'es',
      };
      
      const headers = await signRequest('GET', 'https://search-domain.us-east-1.es.amazonaws.com/_cluster/health', creds);
      
      expect(headers['X-Amz-Security-Token']).toBe('FwoGZXIvYXdzEBYaDK...');
    });

    it('handles POST requests with body', async () => {
      const { signRequest } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 'es',
      };
      
      const body = JSON.stringify({ query: { match_all: {} } });
      const headers = await signRequest('POST', 'https://search-domain.us-east-1.es.amazonaws.com/index/_search', creds, body);
      
      expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256/);
      expect(headers['X-Amz-Content-Sha256']).not.toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'); // Not empty hash
    });

    it('handles URLs with query parameters', async () => {
      const { signRequest } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 'es',
      };
      
      const headers = await signRequest('GET', 'https://search-domain.us-east-1.es.amazonaws.com/_cat/indices?v=true&format=json', creds);
      
      expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256/);
    });

    it('Property: different methods produce different signatures', async () => {
      const { signRequest } = await import('../../utils/sigv4');
      
      const creds: SigV4Credentials = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 'es',
      };
      
      const url = 'https://search-domain.us-east-1.es.amazonaws.com/_cluster/health';
      
      const getHeaders = await signRequest('GET', url, creds);
      const postHeaders = await signRequest('POST', url, creds);
      
      // Signatures should be different for different methods
      expect(getHeaders.Authorization).not.toBe(postHeaders.Authorization);
    });

    it('Property: all HTTP methods produce valid headers', async () => {
      const { signRequest } = await import('../../utils/sigv4');
      
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];
      const creds: SigV4Credentials = {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 'es',
      };
      
      for (const method of methods) {
        const headers = await signRequest(method, 'https://search-domain.us-east-1.es.amazonaws.com/_cluster/health', creds);
        
        expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256/);
        expect(headers['X-Amz-Date']).toBeDefined();
        expect(headers['X-Amz-Content-Sha256']).toBeDefined();
        expect(headers.Host).toBeDefined();
      }
    });
  });

  describe('fetchAwsProfileCredentials', () => {
    it('returns null in browser environment', async () => {
      global.window = {} as Window & typeof globalThis;
      
      const { fetchAwsProfileCredentials } = await import('../../utils/sigv4');
      const creds = await fetchAwsProfileCredentials('default');
      expect(creds).toBeNull();
    });
  });

  describe('Property-based signing tests', () => {
    it('Property: signing is deterministic for same inputs at same time', async () => {
      const { signRequest } = await import('../../utils/sigv4');
      
      // Mock Date to ensure same timestamp
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedDate);
      
      try {
        const creds: SigV4Credentials = {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          region: 'us-east-1',
          service: 'es',
        };
        
        const url = 'https://search-domain.us-east-1.es.amazonaws.com/_cluster/health';
        
        const headers1 = await signRequest('GET', url, creds);
        const headers2 = await signRequest('GET', url, creds);
        
        expect(headers1.Authorization).toBe(headers2.Authorization);
        expect(headers1['X-Amz-Date']).toBe(headers2['X-Amz-Date']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('Property: different bodies produce different signatures', async () => {
      const { signRequest } = await import('../../utils/sigv4');
      
      // Mock Date to ensure same timestamp
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedDate);
      
      try {
        const creds: SigV4Credentials = {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          region: 'us-east-1',
          service: 'es',
        };
        
        const url = 'https://search-domain.us-east-1.es.amazonaws.com/index/_search';
        
        const headers1 = await signRequest('POST', url, creds, '{"query": {"match_all": {}}}');
        const headers2 = await signRequest('POST', url, creds, '{"query": {"term": {"field": "value"}}}');
        
        expect(headers1.Authorization).not.toBe(headers2.Authorization);
        expect(headers1['X-Amz-Content-Sha256']).not.toBe(headers2['X-Amz-Content-Sha256']);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
