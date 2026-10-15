// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Property-based tests for Crypto Utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the electron detection
vi.mock('../../utils/platform', () => ({
  isElectron: () => false,
}));

// We need to test the browser-based crypto functions
describe('Crypto Utility Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Encryption/Decryption roundtrip', () => {
    it('Property: encrypting and decrypting returns original data', async () => {
      // Import after mocks are set up
      const { encryptCredentials, decryptCredentials } = await import('../../utils/crypto');
      
      const credentials = { username: 'testuser', password: 'testpass123' };
      const encrypted = await encryptCredentials(credentials);
      
      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toBe(JSON.stringify(credentials));
      
      const decrypted = await decryptCredentials(encrypted);
      expect(decrypted).toEqual(credentials);
    });

    it('Property: null credentials encrypt to null', async () => {
      const { encryptCredentials } = await import('../../utils/crypto');
      
      const encrypted = await encryptCredentials(null);
      expect(encrypted).toBeNull();
    });

    it('Property: null encrypted string decrypts to null', async () => {
      const { decryptCredentials } = await import('../../utils/crypto');
      
      const decrypted = await decryptCredentials(null);
      expect(decrypted).toBeNull();
    });

    it('Property: different credentials produce different ciphertexts', async () => {
      const { encryptCredentials } = await import('../../utils/crypto');
      
      const creds1 = { username: 'user1', password: 'pass1' };
      const creds2 = { username: 'user2', password: 'pass2' };
      
      const encrypted1 = await encryptCredentials(creds1);
      const encrypted2 = await encryptCredentials(creds2);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('Property: handles various credential types', async () => {
      const { encryptCredentials, decryptCredentials } = await import('../../utils/crypto');
      
      // Basic auth
      const basicCreds = { username: 'user', password: 'pass' };
      const encBasic = await encryptCredentials(basicCreds);
      expect(await decryptCredentials(encBasic)).toEqual(basicCreds);
      
      // API key
      const apiKeyCreds = { apiKey: 'my-api-key-12345' };
      const encApiKey = await encryptCredentials(apiKeyCreds);
      expect(await decryptCredentials(encApiKey)).toEqual(apiKeyCreds);
      
      // AWS credentials
      const awsCreds = { 
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1'
      };
      const encAws = await encryptCredentials(awsCreds);
      expect(await decryptCredentials(encAws)).toEqual(awsCreds);
    });

    it('Property: handles special characters in credentials', async () => {
      const { encryptCredentials, decryptCredentials } = await import('../../utils/crypto');
      
      const creds = { 
        username: 'user@domain.com', 
        password: 'p@$$w0rd!#$%^&*()' 
      };
      
      const encrypted = await encryptCredentials(creds);
      const decrypted = await decryptCredentials(encrypted);
      
      expect(decrypted).toEqual(creds);
    });

    it('Property: handles unicode in credentials', async () => {
      const { encryptCredentials, decryptCredentials } = await import('../../utils/crypto');
      
      const creds = { 
        username: '用户名', 
        password: 'пароль123' 
      };
      
      const encrypted = await encryptCredentials(creds);
      const decrypted = await decryptCredentials(encrypted);
      
      expect(decrypted).toEqual(creds);
    });

    it('Property: handles empty string values', async () => {
      const { encryptCredentials, decryptCredentials } = await import('../../utils/crypto');
      
      const creds = { username: '', password: '' };
      
      const encrypted = await encryptCredentials(creds);
      const decrypted = await decryptCredentials(encrypted);
      
      expect(decrypted).toEqual(creds);
    });

    it('Property: handles long credentials', async () => {
      const { encryptCredentials, decryptCredentials } = await import('../../utils/crypto');
      
      const longPassword = 'a'.repeat(1000);
      const creds = { username: 'user', password: longPassword };
      
      const encrypted = await encryptCredentials(creds);
      const decrypted = await decryptCredentials(encrypted);
      
      expect(decrypted).toEqual(creds);
    });
  });

  describe('Error handling', () => {
    it('Property: handles invalid encrypted data gracefully', async () => {
      const { decryptCredentials } = await import('../../utils/crypto');
      
      // Invalid base64
      const result1 = await decryptCredentials('not-valid-base64!!!');
      expect(result1).toBeNull();
      
      // Valid base64 but not valid encrypted data
      const result2 = await decryptCredentials(btoa('random data'));
      expect(result2).toBeNull();
    });

    it('Property: handles corrupted encrypted data', async () => {
      const { encryptCredentials, decryptCredentials } = await import('../../utils/crypto');
      
      const creds = { username: 'user', password: 'pass' };
      const encrypted = await encryptCredentials(creds);
      
      // Corrupt the encrypted data
      const corrupted = encrypted!.slice(0, -10) + 'corrupted!';
      const result = await decryptCredentials(corrupted);
      
      expect(result).toBeNull();
    });
  });

  describe('Property-based roundtrip tests', () => {
    it('Property: any string credentials roundtrip correctly', async () => {
      const { encryptCredentials, decryptCredentials } = await import('../../utils/crypto');
      
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.string(),
            password: fc.string(),
          }),
          async (creds) => {
            const encrypted = await encryptCredentials(creds);
            const decrypted = await decryptCredentials(encrypted);
            expect(decrypted).toEqual(creds);
          }
        ),
        { numRuns: 20 } // Limit runs due to crypto overhead
      );
    });
  });
});
