// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { expect, it } from 'vitest';
import { mapConcurrent } from '../../execution/concurrency';

it('bounds in-flight work, preserves ordering and does not start canceled queued requests', async () => {
  const controller = new AbortController();
  let active = 0; let peak = 0; const started: number[] = []; const finish: (() => void)[] = [];
  const run = mapConcurrent([1, 2, 3, 4], 2, async item => {
    started.push(item); active++; peak = Math.max(peak, active);
    await new Promise<void>(resolve => finish.push(resolve));
    active--; return item * 10;
  }, controller.signal);
  expect(started).toEqual([1, 2]);
  controller.abort(); finish.forEach(resolve => resolve());
  const results = await run;
  expect(peak).toBe(2); expect(started).toEqual([1, 2]);
  expect(results.slice(0, 2)).toEqual([{ status: 'fulfilled', value: 10 }, { status: 'fulfilled', value: 20 }]);
  expect(results.slice(2).every(result => result.status === 'rejected')).toBe(true);
});
