// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

// @vitest-environment node
import { createRequire } from 'node:module';
import * as grpc from '@grpc/grpc-js';
import protobuf from 'protobufjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import schema from '../../protobuf/opensearch-1.2.0.proto?raw';
import { encodeGrpcRequest, decodeGrpcResponse } from '../../services/grpcCodec';
import { GRPC_EXAMPLES } from '../../services/grpcExamples';
import { validateGrpcEndpoint } from '../../services/grpcEndpoint';
import type { GrpcTransportRequest, GrpcTransportResponse } from '../../types/grpc';

const require = createRequire(import.meta.url);
const { executeGrpc } = require('../../../shared/node/grpc.cjs') as { executeGrpc: (request: GrpcTransportRequest) => Promise<GrpcTransportResponse> };
const root = new protobuf.Root();
root.addJSON(protobuf.common.get('google/protobuf/struct.proto')!.nested!);
protobuf.parse(schema, root, { keepCase: true });
root.resolveAll();
const type = (name: string) => root.lookupType(`org.opensearch.protobufs.${name}`);

it.each(['Search', 'Bulk'] as const)('encodes the %s example using official fields', method => {
  const payload = encodeGrpcRequest(method, GRPC_EXAMPLES[method]);
  const decoded = type(`${method}Request`).toObject(type(`${method}Request`).decode(Buffer.from(payload, 'base64')), { bytes: String });
  expect(decoded).toEqual(JSON.parse(GRPC_EXAMPLES[method]));
});

it.each([
  { typo: true },
  { index: 'my-index' },
  { search_request_body: { size: 'ten' } },
  { search_request_body: { size: 2.5 } },
  { search_request_body: { size: 2147483648 } },
  { search_request_body: { query: { match_all: {}, match_none: {} } } },
  { search_request_body: { query: { match_all: { boost: 'one' } } } },
  { search_request_body: { query: null } },
  { search_type: 'NOT_AN_ENUM' },
  { search_request_body: { query: { knn: { field: 'vector', vector: ['not-a-number'] } } } },
])('rejects invalid or lossy requests: %j', body => {
  expect(() => encodeGrpcRequest('Search', JSON.stringify(body))).toThrow();
});

it('rejects invalid Base64 bytes and malformed JSON', () => {
  expect(() => encodeGrpcRequest('Bulk', JSON.stringify({ bulk_request_body: [{ object: 'not base64!' }] }))).toThrow(/Base64/);
  expect(() => encodeGrpcRequest('Search', '{broken')).toThrow();
});

it('decodes byte fields and preserves 64-bit precision', () => {
  const response = type('SearchResponse');
  const bytes = response.encode(response.fromObject({ took: '9007199254740993', hits: { hits: [{ x_source: 'eyJvayI6dHJ1ZX0=' }] } })).finish();
  expect(decodeGrpcResponse('Search', Buffer.from(bytes).toString('base64'))).toMatchObject({ took: '9007199254740993', hits: { hits: [{ x_source: 'eyJvayI6dHJ1ZX0=' }] } });
});

it.each(['ftp://localhost:9400', 'http://u:p@localhost:9400', 'http://localhost:9400/search', 'http://localhost:9400?q=1', 'http://localhost:9400/#x'])('rejects invalid endpoint %s', endpoint => {
  expect(() => validateGrpcEndpoint(endpoint)).toThrow();
});
it('supports IPv6 and TLS endpoints', () => {
  expect(validateGrpcEndpoint('http://[::1]:9400')).toBe('http://[::1]:9400');
  expect(validateGrpcEndpoint('https://cluster.example:9443/')).toBe('https://cluster.example:9443');
});

describe('native gRPC transport against a real HTTP/2 test server', () => {
  const server = new grpc.Server();
  let endpoint: string;
  let received: Record<string, unknown>;
  let authorization: unknown;
  let fail = false;
  beforeAll(async () => {
    for (const method of ['Search', 'Bulk']) {
      const service = method === 'Search' ? 'SearchService' : 'DocumentService';
      const input = type(`${method}Request`);
      const output = type(`${method}Response`);
      server.addService({ [method]: {
        path: `/org.opensearch.protobufs.services.${service}/${method}`,
        requestStream: false, responseStream: false,
        requestSerialize: value => Buffer.from(input.encode(input.fromObject(value)).finish()),
        requestDeserialize: bytes => input.toObject(input.decode(bytes), { bytes: String }),
        responseSerialize: value => Buffer.from(output.encode(output.fromObject(value)).finish()),
        responseDeserialize: bytes => output.toObject(output.decode(bytes)),
      } }, { [method]: (call: grpc.ServerUnaryCall<Record<string, unknown>, unknown>, callback: grpc.sendUnaryData<unknown>) => {
        received = call.request;
        authorization = call.metadata.get('authorization')[0];
        if (fail) callback({ code: grpc.status.PERMISSION_DENIED, details: 'Denied by test server' });
        else callback(null, { took: '7', ...(method === 'Bulk' ? { errors: false } : { timed_out: false }) });
      } });
    }
    const port = await new Promise<number>((resolve, reject) => server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, port) => error ? reject(error) : resolve(port)));
    endpoint = `http://127.0.0.1:${port}`;
  });
  afterAll(() => server.forceShutdown());

  it.each(['Search', 'Bulk'] as const)('sends actual %s Protobuf bytes and auth metadata', async method => {
    const response = await executeGrpc({ endpoint, method, payload: encodeGrpcRequest(method, GRPC_EXAMPLES[method]), authorization: 'Basic dGVzdDpwdw==' });
    expect(response.code).toBe(0);
    expect(received).toEqual(JSON.parse(GRPC_EXAMPLES[method]));
    expect(authorization).toBe('Basic dGVzdDpwdw==');
    expect(decodeGrpcResponse(method, response.payload!)).toMatchObject({ took: '7' });
  });
  it('preserves gRPC errors from response trailers', async () => {
    fail = true;
    const response = await executeGrpc({ endpoint, method: 'Search', payload: encodeGrpcRequest('Search', '{}') });
    expect(response).toEqual({ code: grpc.status.PERMISSION_DENIED, error: 'Denied by test server' });
  });
  it('rejects unsupported methods at the native boundary', async () => {
    await expect(executeGrpc({ endpoint, method: 'DeleteEverything' as 'Search', payload: '' })).rejects.toThrow('Invalid gRPC request');
  });
});
