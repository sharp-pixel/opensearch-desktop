// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Authentication Header Generator for OpenSearch Notebook
 * Generates HTTP headers for different authentication methods
 * Requirements: 4.2, 4.3
 */

import type {
  ConnectionConfig,
  BasicAuthCredentials,
  ApiKeyCredentials,
  SigV4Credentials,
} from '../types/connection';

export interface AuthHeaders {
  [key: string]: string;
}

/**
 * Generate authentication headers based on connection configuration
 * Requirements: 4.2, 4.3
 * 
 * Note: For SigV4, this returns base headers only. The actual signing
 * must be done per-request using signRequest() from sigv4.ts
 * 
 * @param config - Connection configuration with auth type and credentials
 * @returns Headers object with appropriate Authorization header
 */
export function generateAuthHeaders(config: ConnectionConfig): AuthHeaders {
  const headers: AuthHeaders = {
    'Content-Type': 'application/json',
    // Prevent browser from showing native auth dialog on 401 responses
    // This header tells the server we're handling auth ourselves
    'X-Requested-With': 'XMLHttpRequest',
  };

  switch (config.authType) {
    case 'basic':
      return {
        ...headers,
        ...generateBasicAuthHeader(config.credentials as BasicAuthCredentials),
      };
    
    case 'apikey':
      return {
        ...headers,
        ...generateApiKeyHeader(config.credentials as ApiKeyCredentials),
      };
    
    case 'sigv4':
      // SigV4 headers are generated per-request in queryExecutor
      // Return base headers here
      return headers;
    
    case 'none':
    default:
      return headers;
  }
}

/**
 * Generate Basic Authentication header
 * Requirements: 4.2
 * 
 * Format: "Basic base64(username:password)"
 * 
 * @param credentials - Username and password credentials
 * @returns Headers object with Basic Authorization header
 */
export function generateBasicAuthHeader(
  credentials: BasicAuthCredentials
): AuthHeaders {
  if (!credentials || !credentials.username) {
    return {};
  }

  const { username, password } = credentials;
  const encoded = btoa(`${username}:${password}`);
  
  return {
    Authorization: `Basic ${encoded}`,
  };
}

/**
 * Generate API Key Authentication header
 * Requirements: 4.3
 * 
 * Format: "ApiKey <api_key>"
 * 
 * @param credentials - API key credentials
 * @returns Headers object with ApiKey Authorization header
 */
export function generateApiKeyHeader(
  credentials: ApiKeyCredentials
): AuthHeaders {
  if (!credentials || !credentials.apiKey) {
    return {};
  }

  return {
    Authorization: `ApiKey ${credentials.apiKey}`,
  };
}

/**
 * Check if credentials are valid for the given auth type
 */
export function hasValidCredentials(config: ConnectionConfig): boolean {
  switch (config.authType) {
    case 'basic': {
      const creds = config.credentials as BasicAuthCredentials;
      return !!(creds && creds.username);
    }
    
    case 'apikey': {
      const creds = config.credentials as ApiKeyCredentials;
      return !!(creds && creds.apiKey);
    }
    
    case 'sigv4': {
      const creds = config.credentials as SigV4Credentials;
      return !!(creds && creds.accessKeyId && creds.secretAccessKey && creds.region && creds.service);
    }
    
    case 'none':
      return true;
    
    default:
      return false;
  }
}
