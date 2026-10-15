// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { expect, it } from 'vitest';
import { simulatePipeline } from '../../services/pipelineSimulator';
it.skipIf(!process.env.MEASURE_SIMULATION)('measures local simulation at representative sizes', () => {
  const pipeline = `logs:
  processor:
    - add_entries:
        entries:
          - key: environment
            value: development
    - rename_keys:
        entries:
          - from_key: message
            to_key: text
  sink:
    - stdout:
`;
  for (const size of [100, 1000, 10000, 50000]) {
    const source = Array.from({ length: size }, (_, index) => JSON.stringify({ message: `Event ${index}`, status: 200, host: 'test' })).join('\n');
    const samples: number[] = [];
    for (let run = 0; run < 5; run++) {
      const start = performance.now(); const result = simulatePipeline(source, 'jsonl', pipeline);
      samples.push(performance.now() - start); expect(result.stats.successfulEvents).toBe(size);
    }
    console.log(JSON.stringify({ events: size, milliseconds: samples.map(value => Number(value.toFixed(1))) }));
  }
});
