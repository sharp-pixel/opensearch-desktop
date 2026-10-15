// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, expect, it, vi } from 'vitest';
import { executeFederated } from '../../services/federatedExecutor';
import { executePPL } from '../../services/queryExecutor';
import type { PPLResult } from '../../types/cell';
vi.mock('../../services/queryExecutor', () => ({ executePPL: vi.fn() }));
afterEach(() => vi.clearAllMocks());
it('publishes each cluster completion before the slowest cluster finishes', async () => {
  const finish: ((value: PPLResult) => void)[] = [];
  vi.mocked(executePPL).mockImplementation(() => new Promise<PPLResult>(resolve => finish.push(resolve)));
  const status = vi.fn();
  const connections = ['a', 'b'].map(id => ({ id, name: id, endpoint: 'https://example.invalid', authType: 'none' as const, credentials: null }));
  const pending = executeFederated('source=logs', { id: 'g', name: 'G', connectionIds: ['a', 'b'] }, connections, { onClusterStatus: status });
  expect(status.mock.calls.map(([value]) => [value.connectionId, value.status])).toEqual([['a', 'executing'], ['b', 'executing']]);
  const result: PPLResult = { success: true, statusCode: 200, schema: [], datarows: [], total: 0, size: 0, duration: 1, executedAt: 1 };
  finish[0]!(result);
  await vi.waitFor(() => expect(status).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'a', status: 'success' })));
  expect(status).not.toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'b', status: 'success' }));
  finish[1]!(result); expect((await pending).successfulClusters).toBe(2);
});
