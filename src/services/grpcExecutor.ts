// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { GrpcCell, GrpcResult } from '../types/cell';
import type { ConnectionConfig } from '../types/connection';
import { generateAuthHeaders, hasValidCredentials } from '../utils/authHeaders';
import { executeGrpcTransport } from '../platform/runtime';
import { requestScope } from '../platform/cancellation';
import { DEFAULT_GRPC_ENDPOINT, validateGrpcEndpoint } from './grpcEndpoint';

export async function executeGrpc(config: ConnectionConfig, cell: GrpcCell, options: { signal?: AbortSignal; timeout?: number } = {}): Promise<GrpcResult> {
  const start = Date.now();
  let grpcStatus: number | null = null;
  try {
    if (!config.grpcEndpoint) throw new Error(`Set a gRPC endpoint in Connection settings (for example ${DEFAULT_GRPC_ENDPOINT}).`);
    if (config.authType === 'sigv4') throw new Error('IAM (SigV4) authentication is not supported for gRPC cells. Use a connection with basic, API key, or no authentication.');
    if (!hasValidCredentials(config)) throw new Error('Configure credentials in Connection settings before running this cell.');
    const { encodeGrpcRequest, decodeGrpcResponse } = await import('./grpcCodec');
    const request = {
      endpoint: validateGrpcEndpoint(config.grpcEndpoint),
      method: cell.method,
      payload: encodeGrpcRequest(cell.method, cell.body),
      authorization: generateAuthHeaders(config).Authorization,
    };
    const scope = requestScope(options.timeout, options.signal);
    const response = await executeGrpcTransport(request, scope.signal).finally(scope.dispose);
    grpcStatus = response.code;
    if (response.code !== 0) throw new Error(response.error || `gRPC error ${response.code}`);
    if (typeof response.payload !== 'string') throw new Error('Missing Protobuf response.');
    return { success: true, grpcStatus, body: decodeGrpcResponse(cell.method, response.payload), duration: Date.now() - start, executedAt: Date.now() };
  } catch (error) {
    return { success: false, grpcStatus, body: { error: error instanceof Error ? error.message : String(error) }, duration: Date.now() - start, executedAt: Date.now() };
  }
}
