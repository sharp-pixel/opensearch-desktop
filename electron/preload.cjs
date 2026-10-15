// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

const { contextBridge, ipcRenderer } = require('electron');
let closeWatchSequence = 0;

/**
 * AWS Profile information (without sensitive credentials)
 * NOTE: This type definition must stay in sync with src/types/connection.ts (AwsProfile interface)
 * @typedef {Object} AwsProfile
 * @property {string} name - Profile name
 * @property {boolean} hasCredentials - Whether the profile has credentials
 * @property {string|null} region - Default region for the profile
 */

/**
 * AWS Profile credentials
 * NOTE: This type definition must stay in sync with src/types/connection.ts (AwsProfileCredentials interface)
 * @typedef {Object} AwsProfileCredentials
 * @property {string} accessKeyId - AWS access key ID
 * @property {string} secretAccessKey - AWS secret access key
 * @property {string|null} sessionToken - Optional session token
 * @property {string|null} region - Default region
 */

// Expose APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  menu: {
    update: state => ipcRenderer.invoke('menu:update', state),
    listen: async handler => {
      const listener = (_event, action) => handler(action);
      ipcRenderer.on('menu:action', listener);
      return () => ipcRenderer.removeListener('menu:action', listener);
    },
  },
  files: {
    open: options => ipcRenderer.invoke('documents:open', options),
    read: path => ipcRenderer.invoke('documents:read', path),
    save: request => ipcRenderer.invoke('documents:save', request),
  },
  onCloseRequested: async (handler) => {
    const watchId = `close:${++closeWatchSequence}`;
    const listener = (_event, owner, id) => {
      if (owner !== watchId) return;
      Promise.resolve().then(handler).then(
        allowed => ipcRenderer.invoke('window:complete-close', id, allowed === true),
        () => ipcRenderer.invoke('window:complete-close', id, false),
      ).catch(() => {});
    };
    ipcRenderer.on('window:close-requested', listener);
    try { await ipcRenderer.invoke('window:watch-close', watchId, true); }
    catch (error) { ipcRenderer.removeListener('window:close-requested', listener); throw error; }
    return () => {
      ipcRenderer.removeListener('window:close-requested', listener);
      void ipcRenderer.invoke('window:watch-close', watchId, false).catch(() => {});
    };
  },
  cancelRequest: (requestId) => ipcRenderer.invoke('requests:cancel', requestId),
  grpc: { execute: (request) => ipcRenderer.invoke('grpc:execute', request) },
  platform: process.platform,
  isElectron: true,
  
  /**
   * AWS credentials management
   */
  aws: {
    /**
     * Get list of available AWS profiles from ~/.aws/credentials and ~/.aws/config
     * @returns {Promise<AwsProfile[]>}
     */
    getProfiles: () => ipcRenderer.invoke('aws:getProfiles'),
    
    /**
     * Get credentials for a specific AWS profile
     * @param {string} profileName - Name of the profile
     * @returns {Promise<AwsProfileCredentials|null>}
     */
    getProfileCredentials: (profileName) => ipcRenderer.invoke('aws:getProfileCredentials', profileName),
    
    /**
     * Refresh the list of profiles (re-read from disk)
     * @returns {Promise<AwsProfile[]>}
     */
    refreshProfiles: () => ipcRenderer.invoke('aws:refreshProfiles'),
  },

  /**
   * Secure storage using OS keychain (via Electron's safeStorage)
   */
  safeStorage: {
    /**
     * Check if secure storage is available
     * @returns {Promise<boolean>}
     */
    isAvailable: () => ipcRenderer.invoke('safeStorage:isAvailable'),

    /**
     * Encrypt a string using OS-level encryption
     * @param {string} plaintext - String to encrypt
     * @returns {Promise<string|null>} Base64-encoded encrypted data, or null on failure
     */
    encrypt: (plaintext) => ipcRenderer.invoke('safeStorage:encrypt', plaintext),

    /**
     * Decrypt a string that was encrypted with safeStorage.encrypt
     * @param {string} encryptedBase64 - Base64-encoded encrypted data
     * @returns {Promise<string|null>} Decrypted string, or null on failure
     */
    decrypt: (encryptedBase64) => ipcRenderer.invoke('safeStorage:decrypt', encryptedBase64),
  },

  /**
   * Proxy fetch for HTTPS requests (handles self-signed certificates)
   * Use this for OpenSearch requests to localhost with self-signed certs
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options (method, headers, body)
   * @returns {Promise<{ok: boolean, status: number, statusText: string, body: any, error?: string}>}
   */
  fetch: (url, options) => ipcRenderer.invoke('fetch:proxy', url, options || {}),
});
