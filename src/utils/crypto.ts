// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Crypto Utility for OpenSearch DevTools
 * Provides encryption/decryption for sensitive data stored in localStorage
 * 
 * Uses a hybrid approach:
 * - In Electron: Uses safeStorage API (OS keychain - most secure)
 * - In Browser: Uses Web Crypto API with AES-GCM (localStorage-persisted key)
 */

import { isTauri, nativeAPI } from '../platform/runtime';
import { createLogger } from './logger';
import { rememberVaultReference, deleteVaultReference, credentialReferences } from '../storage/vaultReferences';

const logger = createLogger('Crypto');

// Storage keys
const ENCRYPTION_KEY_NAME = 'opensearch-devtools-key';

/**
 * Electron safeStorage API interface
 */
interface ElectronSafeStorageApi {
  isAvailable: () => Promise<boolean>;
  encrypt: (plaintext: string) => Promise<string | null>;
  decrypt: (encryptedBase64: string) => Promise<string | null>;
}

/**
 * Electron API interface
 */
interface ElectronApi {
  isElectron: boolean;
  safeStorage: ElectronSafeStorageApi;
}

/**
 * Check if we're running in Electron with safeStorage available
 */
function getElectronSafeStorage(): ElectronSafeStorageApi | null {
  if (typeof window !== 'undefined' && 'electronAPI' in window) {
    const api = (window as unknown as { electronAPI: ElectronApi }).electronAPI;
    if (api?.isElectron && api?.safeStorage) {
      return api.safeStorage;
    }
  }
  return null;
}

/**
 * Cache for safeStorage availability check
 */
let safeStorageAvailable: boolean | null = null;

/**
 * Check if Electron safeStorage is available
 */
async function isSafeStorageAvailable(): Promise<boolean> {
  if (safeStorageAvailable !== null) {
    return safeStorageAvailable;
  }
  
  const safeStorage = getElectronSafeStorage();
  if (!safeStorage) {
    safeStorageAvailable = false;
    return false;
  }
  
  try {
    safeStorageAvailable = await safeStorage.isAvailable();
    return safeStorageAvailable;
  } catch {
    safeStorageAvailable = false;
    return false;
  }
}

// ============================================================================
// Web Crypto Fallback (for browser-only mode)
// ============================================================================

/**
 * Get or create an encryption key stored in localStorage
 * This is less secure than safeStorage but works in browser-only mode
 * The key persists across sessions (unlike sessionStorage)
 * 
 * For backward compatibility, also checks sessionStorage for existing keys
 */
let pendingWebCryptoKey: Promise<CryptoKey> | null = null;

function getWebCryptoKey(): Promise<CryptoKey> {
  if (!pendingWebCryptoKey) {
    pendingWebCryptoKey = loadOrCreateWebCryptoKey().finally(() => {
      pendingWebCryptoKey = null;
    });
  }
  return pendingWebCryptoKey;
}

async function loadOrCreateWebCryptoKey(): Promise<CryptoKey> {
  // First check localStorage (new location)
  let existingKeyData = localStorage.getItem(ENCRYPTION_KEY_NAME);
  
  // Backward compatibility: check sessionStorage if not in localStorage
  if (!existingKeyData) {
    existingKeyData = sessionStorage.getItem(ENCRYPTION_KEY_NAME);
    // Migrate to localStorage if found in sessionStorage
    if (existingKeyData) {
      localStorage.setItem(ENCRYPTION_KEY_NAME, existingKeyData);
      logger.info('Migrated encryption key from sessionStorage to localStorage');
    }
  }
  
  if (existingKeyData) {
    try {
      const keyData = JSON.parse(existingKeyData);
      return await crypto.subtle.importKey(
        'jwk',
        keyData,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch {
      // Key corrupted, generate new one
      logger.warn('Encryption key corrupted, generating new key');
    }
  }
  
  // Generate a new key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // Export and store in localStorage
  const exportedKey = await crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exportedKey));
  
  return key;
}

/**
 * Encrypt data using Web Crypto API
 */
async function encryptWithWebCrypto(data: string): Promise<string> {
  const key = await getWebCryptoKey();
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // Generate random IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  
  // Convert to base64 with prefix to identify encryption method
  return 'wc:' + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using Web Crypto API
 */
async function decryptWithWebCrypto(encryptedData: string): Promise<string> {
  // Remove prefix if present
  const data = encryptedData.startsWith('wc:') ? encryptedData.slice(3) : encryptedData;
  
  const key = await getWebCryptoKey();
  
  // Decode from base64
  const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Encrypt sensitive data
 * Uses Electron safeStorage when available, falls back to Web Crypto
 * 
 * @param data - Plain text data to encrypt
 * @returns Encrypted data string (prefixed to identify encryption method)
 */
export async function encryptData(data: string): Promise<string> {
  try {
    if (isTauri()) {
      const reference = 'keyring:' + crypto.randomUUID();
      rememberVaultReference(reference);
      try {
        const stored = await nativeAPI.safeStorage.encrypt(data, reference);
        if (stored !== reference || await nativeAPI.safeStorage.decrypt(reference) !== data) {
          throw new Error('The operating-system credential store could not verify the saved secret');
        }
        return 'tv:' + reference;
      } catch (error) {
        await deleteVaultReference(reference).catch(() => undefined);
        throw error;
      }
    }
    // Try Electron safeStorage first
    if (await isSafeStorageAvailable()) {
      const safeStorage = getElectronSafeStorage()!;
      const encrypted = await safeStorage.encrypt(data);
      if (encrypted) {
        return 'es:' + encrypted; // 'es' prefix for Electron safeStorage
      }
      logger.warn('safeStorage encryption failed, falling back to Web Crypto');
    }
    
    // Fall back to Web Crypto
    return await encryptWithWebCrypto(data);
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data', { cause: error });
  }
}

/**
 * Decrypt sensitive data
 * Automatically detects encryption method from prefix
 * 
 * @param encryptedData - Encrypted data string
 * @returns Decrypted plain text
 */
export async function decryptData(encryptedData: string): Promise<string> {
  try {
    if (encryptedData.startsWith('tv:')) {
      if (!isTauri()) throw new Error('This secret requires the Tauri credential store');
      const value = await nativeAPI.safeStorage.decrypt(encryptedData.slice(3));
      if (value === null) throw new Error('Saved credential is missing or unavailable');
      return value;
    }
    // Check for Electron safeStorage prefix
    if (encryptedData.startsWith('es:')) {
      const safeStorage = getElectronSafeStorage();
      if (safeStorage) {
        const decrypted = await safeStorage.decrypt(encryptedData.slice(3));
        if (decrypted !== null) {
          return decrypted;
        }
      }
      // If safeStorage not available but data was encrypted with it,
      // we can't decrypt - this happens when switching from Electron to browser
      throw new Error('Data was encrypted with Electron safeStorage which is not available');
    }
    
    // Web Crypto (with or without 'wc:' prefix for backward compatibility)
    return await decryptWithWebCrypto(encryptedData);
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data', { cause: error });
  }
}

/**
 * Check if data appears to be encrypted
 */
export function isEncrypted(data: string): boolean {
  // Check for known prefixes
  if (data.startsWith('tv:') || data.startsWith('es:') || data.startsWith('wc:')) {
    return true;
  }
  
  // Legacy format (no prefix) - check if it's valid base64 with minimum length
  try {
    const decoded = atob(data);
    return decoded.length > 12; // IV (12 bytes) + some data
  } catch {
    return false;
  }
}

/**
 * Get the current encryption method being used
 */
export async function getEncryptionMethod(): Promise<'safeStorage' | 'webCrypto'> {
  if (isTauri() || await isSafeStorageAvailable()) {
    return 'safeStorage';
  }
  return 'webCrypto';
}

/**
 * Encrypt credentials object, preserving non-sensitive fields
 */
export async function encryptCredentials(
  credentials: unknown
): Promise<string | null> {
  if (!credentials || typeof credentials !== 'object') return null;
  
  const credObj = credentials as Record<string, unknown>;
  const sensitiveFields = ['password', 'apiKey', 'secretAccessKey', 'sessionToken'];
  const encrypted: Record<string, unknown> = { ...credObj };
  
  try {
  for (const field of sensitiveFields) {
    if (field in encrypted && typeof encrypted[field] === 'string') {
      encrypted[`__encrypted_${field}`] = await encryptData(encrypted[field] as string);
      delete encrypted[field];
    }
  }
  
  return JSON.stringify(encrypted);
  } catch (error) {
    await releaseCredentials(JSON.stringify(encrypted)).catch(() => undefined);
    throw error;
  }
}

/**
 * Decrypt credentials object, restoring sensitive fields
 */
export async function decryptCredentials(
  encryptedJson: string | null
): Promise<Record<string, unknown> | null> {
  if (!encryptedJson) return null;
  
  try {
    const credentials = JSON.parse(encryptedJson);
    const sensitiveFields = ['password', 'apiKey', 'secretAccessKey', 'sessionToken'];
    
    for (const field of sensitiveFields) {
      const encryptedField = `__encrypted_${field}`;
      if (encryptedField in credentials && typeof credentials[encryptedField] === 'string') {
        try {
          credentials[field] = await decryptData(credentials[encryptedField]);
          delete credentials[encryptedField];
        } catch {
          // If decryption fails, credentials need to be re-entered
          logger.warn(`Failed to decrypt ${field}, credentials may need to be re-entered`);
          return null;
        }
      }
    }
    
    return credentials;
  } catch {
    return null;
  }
}

/** Delete only native references; ciphertext needs no external cleanup. */
export async function releaseCredentials(json: string | null): Promise<void> {
  if (!json || !isTauri()) return;
  for (const reference of credentialReferences(json)) await deleteVaultReference(reference);
}
