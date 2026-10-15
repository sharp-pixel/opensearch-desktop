// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { expect, it } from 'vitest';
import { cellInput, connectionInput, resultIsStale } from '../../execution/provenance';
import type { QueryCell } from '../../types/cell';
import type { ConnectionConfig } from '../../types/connection';

it('marks input and connection changes stale without storing credentials in provenance', () => {
  const connection: ConnectionConfig = { id: 'c', name: 'C', endpoint: 'https://example.invalid', authType: 'basic', credentials: { username: 'user', password: 'private' }, revision: '1' };
  const cell: QueryCell = { id: 'cell', type: 'query', method: 'GET', endpoint: '/_search', body: '', createdAt: 1, updatedAt: 1 };
  cell.lastResult = { success: true, statusCode: 200, body: {}, duration: 1, executedAt: 1,
    source: { runId: 'run', input: cellInput(cell), connection: connectionInput(connection) } };
  expect(resultIsStale(cell, connection)).toBe(false);
  expect(resultIsStale({ ...cell, body: '{}' }, connection)).toBe(true);
  expect(resultIsStale(cell, { ...connection, revision: '2' })).toBe(true);
  expect(resultIsStale(cell, null)).toBe(true);
  expect(JSON.stringify(cell.lastResult.source)).not.toContain('private');
});
