// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

export const DEFAULT_GRPC_ENDPOINT = 'http://localhost:9400';

export function validateGrpcEndpoint(endpoint: string): string {
  let url: URL;
  try { url = new URL(endpoint); }
  catch { throw new Error(`Enter a gRPC endpoint such as ${DEFAULT_GRPC_ENDPOINT}.`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('gRPC endpoint must be an http:// or https:// origin without credentials, a path, or query parameters.');
  }
  return url.origin;
}
