// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { GrpcCell } from '../types/cell';
import type { TrackedOperation } from '../types/tracking';

// Permission mapping uses REST-equivalent actions, while the sidebar retains
// the actual transport. Only call after the request passed Protobuf validation.
export function grpcTrackedOperation(cell: GrpcCell): TrackedOperation {
  const request = JSON.parse(cell.body);
  const indices = new Set<string>();
  if (cell.method === 'Search') {
    for (const index of request.index || []) indices.add(index);
  } else {
    for (const item of request.bulk_request_body || []) {
      const operation = Object.values(item.operation_container || {})[0] as { x_index?: string } | undefined;
      const index = operation?.x_index || request.index;
      if (index) indices.add(index);
    }
    if (!indices.size && request.index) indices.add(request.index);
  }
  return {
    method: 'POST', endpoint: cell.method === 'Search' ? '/_search' : '/_bulk',
    transport: 'grpc', indexPatterns: indices.size ? [...indices] : ['*'],
    timestamp: Date.now(), cellId: cell.id,
  };
}
