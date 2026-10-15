// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/**
 * Connection configuration interfaces for OpenSearch Notebook
 * Requirements: 2.6 (HTTP methods support)
 */

export type AuthType = 'basic' | 'apikey' | 'sigv4' | 'none';

export interface BasicAuthCredentials {
  username: string;
  password: string;
}

export interface ApiKeyCredentials {
  apiKey: string;
}

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  service: 'es' | 'aoss'; // 'es' for OpenSearch Service, 'aoss' for Serverless
  useAwsProfile?: boolean; // Use credentials from AWS profile (~/.aws/credentials)
  awsProfileName?: string; // Name of the AWS profile to use
}

export interface ConnectionConfig {
  revision?: string;
  credentialError?: string;
  id: string;
  name: string;
  endpoint: string;
  authType: AuthType;
  credentials: BasicAuthCredentials | ApiKeyCredentials | SigV4Credentials | null;
  grpcEndpoint?: string; // Explicit http:// (plaintext) or https:// (TLS) gRPC origin
  useProxy?: boolean; // Use Vite proxy for localhost connections (bypasses SSL issues)
}

/**
 * AWS Profile information (from ~/.aws/credentials and ~/.aws/config)
 */
export interface AwsProfile {
  name: string;
  hasCredentials: boolean;
  region: string | null;
}

/**
 * AWS Profile credentials (fetched on demand)
 */
export interface AwsProfileCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | null;
  region: string | null;
}
