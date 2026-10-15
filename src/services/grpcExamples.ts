// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { GrpcMethod } from '../types/cell';

export const GRPC_EXAMPLES: Record<GrpcMethod, string> = {
  Search: JSON.stringify({ index: ['my-index'], search_request_body: { query: { match_all: {} }, size: 10 } }, null, 2),
  Bulk: JSON.stringify({ index: 'my-index', bulk_request_body: [
    { operation_container: { index: { x_id: '1' } }, object: 'eyJ0aXRsZSI6IkhlbGxvIE9wZW5TZWFyY2gifQ==' },
  ] }, null, 2),
};
