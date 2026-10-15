// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Extended Property-based tests for Crypto Utility
 * Tests isEncrypted, getEncryptionMethod, encryptData, decryptData
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the electron detection
vi.mock('../../utils/platform', () => ({
  isElectron: () => false,
}));

describe('Crypto Utility Extended Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear encryption key between tests
    localStorage.removeItem('opensearch-devtools-key');
    sessionStorage.removeItem('opensearch-devtools-key');
  });

  describe('isEncrypted', () => {
    it('returns true for es: prefix', async () => {
      const { isEncrypted } = await import('../../utils/crypto');
      expect(isEncrypted('es:somedata')).toBe(true);
    });

    it('returns true for wc: prefix', async () => {
      const { isEncrypted } = await import('../../utils/crypto');
      expect(isEncrypted('wc:somedata')).toBe(true);
    });

    it('returns true for valid base64 with sufficient length', async () => {
      const { isEncrypted } = await import('../../utils/crypto');
      // Create a base64 string that decodes to more than 12 bytes
      const longData = btoa('a'.repeat(20));
      expect(isEncrypted(longData)).toBe(true);
    });

    it('returns false for short base64', async () => {
      const { isEncrypted } = await import('../../utils/crypto');
      const shortData = btoa('short');
      expect(isEncrypted(shortData)).toBe(false);
    });

    it('returns false for invalid base64', async () => {
      const { isEncrypted } = await import('../../utils/crypto');
      expect(isEncrypted('not-valid-base64!!!')).toBe(false);
    });

    it('returns false for plain text', async () => {
      const { isEncrypted } = await import('../../utils/crypto');
      expect(isEncrypted('plain text')).toBe(false);
    });

    it('Property: encrypted data is detected as encrypted', async () => {
      const { encryptData, isEncrypted } = await import('../../utils/crypto');
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (data) => {
            const encrypted = await encryptData(data);
            // encryptData returns a string with wc: prefix
            expect(isEncrypted(encrypted)).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('getEncryptionMethod', () => {
    it('returns webCrypto in browser environment', async () => {
      const { getEncryptionMethod } = await import('../../utils/crypto');
      const method = await getEncryptionMethod();
      expect(method).toBe('webCrypto');
    });
  });

  describe('encryptData and decryptData', () => {
    it('roundtrip works for simple string', async () => {
      const { encryptData, decryptData } = await import('../../utils/crypto');
      
      const original = 'Hello, World!';
      const encrypted = await encryptData(original);
      const decrypted = await decryptData(encrypted);
      
      expect(decrypted).toBe(original);
    });

    it('encrypted data has wc: prefix in browser', async () => {
      const { encryptData } = await import('../../utils/crypto');
      
      const encrypted = await encryptData('test');
      expect(encrypted.startsWith('wc:')).toBe(true);
    });

    it('handles empty string', async () => {
      const { encryptData, decryptData } = await import('../../utils/crypto');
      
      const encrypted = await encryptData('');
      const decrypted = await decryptData(encrypted);
      
      expect(decrypted).toBe('');
    });

    it('handles unicode characters', async () => {
      const { encryptData, decryptData } = await import('../../utils/crypto');
      
      const original = '你好世界 🌍 مرحبا';
      const encrypted = await encryptData(original);
      const decrypted = await decryptData(encrypted);
      
      expect(decrypted).toBe(original);
    });

    it('handles special characters', async () => {
      const { encryptData, decryptData } = await import('../../utils/crypto');
      
      const original = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const encrypted = await encryptData(original);
      const decrypted = await decryptData(encrypted);
      
      expect(decrypted).toBe(original);
    });

    it('handles newlines and tabs', async () => {
      const { encryptData, decryptData } = await import('../../utils/crypto');
      
      const original = 'line1\nline2\tcolumn';
      const encrypted = await encryptData(original);
      const decrypted = await decryptData(encrypted);
      
      expect(decrypted).toBe(original);
    });

    it('handles JSON strings', async () => {
      const { encryptData, decryptData } = await import('../../utils/crypto');
      
      const original = JSON.stringify({ key: 'value', nested: { arr: [1, 2, 3] } });
      const encrypted = await encryptData(original);
      const decrypted = await decryptData(encrypted);
      
      expect(decrypted).toBe(original);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(original));
    });

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const { encryptData } = await import('../../utils/crypto');
      
      const original = 'same text';
      const encrypted1 = await encryptData(original);
      const encrypted2 = await encryptData(original);
      
      // Due to random IV, ciphertexts should be different
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('throws on invalid encrypted data', async () => {
      const { decryptData } = await import('../../utils/crypto');
      
      await expect(decryptData('wc:invalid')).rejects.toThrow();
    });

    it('throws on es: prefix without safeStorage', async () => {
      const { decryptData } = await import('../../utils/crypto');
      
      await expect(decryptData('es:somedata')).rejects.toThrow();
    });

    it('Property: roundtrip preserves data', async () => {
      const { encryptData, decryptData } = await import('../../utils/crypto');
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 500 }),
          async (original) => {
            const encrypted = await encryptData(original);
            const decrypted = await decryptData(encrypted);
            expect(decrypted).toBe(original);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Key persistence', () => {
    it('uses same key across multiple encryptions', async () => {
      const { encryptData, decryptData } = await import('../../utils/crypto');
      
      // Encrypt first value
      const encrypted1 = await encryptData('value1');
      
      // Encrypt second value
      const encrypted2 = await encryptData('value2');
      
      // Both should decrypt correctly (using same key)
      expect(await decryptData(encrypted1)).toBe('value1');
      expect(await decryptData(encrypted2)).toBe('value2');
    });

    it('key is stored in localStorage', async () => {
      const { encryptData } = await import('../../utils/crypto');
      
      await encryptData('test');
      
      const storedKey = localStorage.getItem('opensearch-devtools-key');
      expect(storedKey).not.toBeNull();
      
      // Should be valid JSON (JWK format)
      const parsed = JSON.parse(storedKey!);
      expect(parsed.kty).toBe('oct');
      expect(parsed.alg).toBe('A256GCM');
    });
  });
});
