// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * AWS Signature Version 4 Signing for OpenSearch Notebook
 * Implements SigV4 signing for Amazon OpenSearch Service and Serverless
 * Requirements: IAM authentication support
 */

import type { SigV4Credentials } from '../types/connection';
import type { HttpMethod } from '../types/cell';
import { getAwsProfileCredentials, isAwsProfileSupportAvailable } from './awsProfiles';
import { createLogger } from './logger';

const logger = createLogger('SigV4');

/**
 * SigV4 signed request headers
 */
export interface SigV4Headers {
  Authorization: string;
  'X-Amz-Date': string;
  'X-Amz-Security-Token'?: string;
  'X-Amz-Content-Sha256': string;
  Host: string;
}

/**
 * Create a SHA-256 hash of the input
 */
async function sha256(message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  return crypto.subtle.digest('SHA-256', data);
}

/**
 * Convert ArrayBuffer to hex string
 */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create HMAC-SHA256 signature
 */
async function hmacSha256(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

/**
 * Get the signing key for SigV4
 */
async function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

/**
 * Format date for SigV4 (YYYYMMDD'T'HHMMSS'Z')
 */
function getAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

/**
 * Format date stamp (YYYYMMDD)
 */
function getDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Parse URL to get host and path
 */
function parseUrl(url: string): { host: string; path: string; query: string } {
  const parsed = new URL(url);
  return {
    host: parsed.host,
    path: parsed.pathname || '/',
    query: parsed.search ? parsed.search.slice(1) : '',
  };
}

/**
 * Create canonical query string (sorted)
 */
function createCanonicalQueryString(query: string): string {
  if (!query) return '';

  const encode = (value: string) => encodeURIComponent(value)
    .replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  const params = query.split('&')
    .map(param => {
      const separator = param.indexOf('=');
      const key = separator < 0 ? param : param.slice(0, separator);
      const value = separator < 0 ? '' : param.slice(separator + 1);
      return [encode(decodeURIComponent(key)), encode(decodeURIComponent(value))] as const;
    })
    .sort((a, b) => {
      const left = a[0] === b[0] ? a[1] : a[0];
      const right = a[0] === b[0] ? b[1] : b[0];
      return left < right ? -1 : left > right ? 1 : 0;
    });
  
  return params.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * Sign a request using AWS Signature Version 4
 * 
 * @param method - HTTP method
 * @param url - Full request URL
 * @param credentials - SigV4 credentials
 * @param body - Request body (optional)
 * @param additionalHeaders - Additional headers to include in signing
 * @returns Signed headers to include in the request
 */
export async function signRequest(
  method: HttpMethod,
  url: string,
  credentials: SigV4Credentials,
  body: string = '',
  additionalHeaders: Record<string, string> = {}
): Promise<SigV4Headers> {
  const { accessKeyId, secretAccessKey, sessionToken, region, service } = credentials;
  
  const now = new Date();
  const amzDate = getAmzDate(now);
  const dateStamp = getDateStamp(now);
  
  const { host, path, query } = parseUrl(url);
  
  // Create payload hash
  const payloadHash = toHex(await sha256(body));
  
  // Headers to sign
  const headers: Record<string, string> = {
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...additionalHeaders,
  };
  
  if (sessionToken) {
    headers['x-amz-security-token'] = sessionToken;
  }
  
  // Create canonical headers (sorted, lowercase)
  const sortedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaders
    .map(key => `${key.toLowerCase()}:${headers[key]?.trim()}`)
    .join('\n') + '\n';
  
  const signedHeaders = sortedHeaders.map(h => h.toLowerCase()).join(';');
  
  // Create canonical request
  const canonicalQueryString = createCanonicalQueryString(query);
  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = toHex(await sha256(canonicalRequest));
  
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');
  
  // Calculate signature
  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  
  // Create authorization header
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  const result: SigV4Headers = {
    Authorization: authorization,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': payloadHash,
    Host: host,
  };
  
  if (sessionToken) {
    result['X-Amz-Security-Token'] = sessionToken;
  }
  
  return result;
}

/**
 * Check if credentials appear to be valid (non-empty)
 */
export function hasValidSigV4Credentials(credentials: SigV4Credentials): boolean {
  // If using AWS profile, we only need region, service, and profile name
  if (credentials.useAwsProfile) {
    return !!(credentials.region && credentials.service && credentials.awsProfileName);
  }
  
  return !!(
    credentials.accessKeyId &&
    credentials.secretAccessKey &&
    credentials.region &&
    credentials.service
  );
}

/**
 * Fetch credentials from an AWS profile (~/.aws/credentials)
 * This is the recommended way to use IAM credentials in the Electron app
 * 
 * @param profileName - Name of the AWS profile to use
 * @returns Credentials or null if not found/not in Electron
 */
export async function fetchAwsProfileCredentials(profileName: string): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
} | null> {
  if (!isAwsProfileSupportAvailable()) {
    logger.warn('AWS profile credentials are only available in the desktop app');
    return null;
  }

  const credentials = await getAwsProfileCredentials(profileName);
  if (!credentials) {
    logger.warn(`No credentials found for AWS profile "${profileName}"`);
    return null;
  }

  return {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken || undefined,
    region: credentials.region || undefined,
  };
}
