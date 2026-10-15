// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

const grpc = require('@grpc/grpc-js');
const { registerRequest } = require('./requests.cjs');

const GRPC_PATHS = {
  Search: '/org.opensearch.protobufs.services.SearchService/Search',
  Bulk: '/org.opensearch.protobufs.services.DocumentService/Bulk',
};
const LIMIT = 10 * 1024 * 1024;

async function executeGrpc(request, signal) {
  if (!request || typeof request.endpoint !== 'string' ||
      !Object.prototype.hasOwnProperty.call(GRPC_PATHS, request.method)) throw new Error('Invalid gRPC request.');
  const url = new URL(request.endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('gRPC endpoint must be an http:// or https:// origin.');
  }
  if (typeof request.payload !== 'string' || request.payload.length > Math.ceil(LIMIT / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(request.payload)) throw new Error('Invalid or oversized Protobuf payload.');
  if (request.authorization !== undefined && (typeof request.authorization !== 'string' || !/^[\x20-\x7e]*$/.test(request.authorization))) throw new Error('Invalid authorization metadata.');
  const credentials = url.protocol === 'https:' ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
  const target = `${url.hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
  const client = new grpc.Client(target, credentials, {
    'grpc.max_receive_message_length': LIMIT,
    'grpc.max_send_message_length': LIMIT,
    'grpc.enable_retries': 0, // Bulk mutations must never be retried automatically.
  });
  const metadata = new grpc.Metadata();
  if (request.authorization) metadata.set('authorization', request.authorization);
  let release = () => {};
  let abort = () => {};
  try {
    return await new Promise((resolve) => {
      const call = client.makeUnaryRequest(GRPC_PATHS[request.method], value => value, value => value,
        Buffer.from(request.payload, 'base64'), metadata,
        { deadline: Date.now() + 30000 }, (error, response) => {
          if (error) resolve({ code: error.code, error: error.details || error.message });
          else resolve({ code: 0, payload: response.toString('base64') });
        });
      abort = () => call.cancel();
      release = registerRequest(request.requestId, abort);
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    });
  } finally {
    release();
    signal?.removeEventListener('abort', abort);
    client.close();
  }
}

module.exports = { executeGrpc, GRPC_PATHS };
