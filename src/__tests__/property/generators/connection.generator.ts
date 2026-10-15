// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Connection generators for property-based testing
 * Used for Property 8: Connection Settings Persistence Round-Trip
 */

import * as fc from 'fast-check';
import type {
  ConnectionConfig,
  AuthType,
  BasicAuthCredentials,
  ApiKeyCredentials,
} from '../../../types/connection';

/**
 * Generator for AuthType
 */
export const authTypeArb: fc.Arbitrary<AuthType> = fc.constantFrom('basic', 'apikey', 'none');

/**
 * Safe string generator that avoids problematic characters for encryption
 * Excludes null bytes and other control characters that may cause issues
 */
const safeStringArb = (minLength: number, maxLength: number): fc.Arbitrary<string> =>
  fc.string({ minLength, maxLength }).filter(s => 
    !s.includes('\0') && 
    s.length >= minLength &&
    // Avoid strings that are only whitespace
    (minLength === 0 || s.trim().length > 0)
  );

/**
 * Generator for BasicAuthCredentials
 */
export const basicAuthCredentialsArb: fc.Arbitrary<BasicAuthCredentials> = fc.record({
  username: safeStringArb(1, 50),
  password: safeStringArb(1, 100),
});

/**
 * Generator for ApiKeyCredentials
 */
export const apiKeyCredentialsArb: fc.Arbitrary<ApiKeyCredentials> = fc.record({
  apiKey: safeStringArb(1, 200),
});

/**
 * Generator for ConnectionConfig with basic auth
 */
export const basicAuthConnectionArb: fc.Arbitrary<ConnectionConfig> = fc.record({
  id: fc.uuid(),
  name: safeStringArb(1, 100),
  endpoint: fc.webUrl(),
  authType: fc.constant('basic' as const),
  credentials: basicAuthCredentialsArb,
});

/**
 * Generator for ConnectionConfig with API key auth
 */
export const apiKeyConnectionArb: fc.Arbitrary<ConnectionConfig> = fc.record({
  id: fc.uuid(),
  name: safeStringArb(1, 100),
  endpoint: fc.webUrl(),
  authType: fc.constant('apikey' as const),
  credentials: apiKeyCredentialsArb,
});

/**
 * Generator for ConnectionConfig with no auth
 */
export const noAuthConnectionArb: fc.Arbitrary<ConnectionConfig> = fc.record({
  id: fc.uuid(),
  name: safeStringArb(1, 100),
  endpoint: fc.webUrl(),
  authType: fc.constant('none' as const),
  credentials: fc.constant(null),
});

/**
 * Generator for any ConnectionConfig
 */
export const connectionConfigArb: fc.Arbitrary<ConnectionConfig> = fc.oneof(
  basicAuthConnectionArb,
  apiKeyConnectionArb,
  noAuthConnectionArb
);
