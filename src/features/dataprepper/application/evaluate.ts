// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { ProcessingResult, SourceFormat } from '../../../types/dataPrepper';
import { simulatePipeline } from '../../../services/pipelineSimulator';
import type { SimulationResponse } from '../workers/simulate.worker';

type SimulationWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;
/** One worker per run gives cancellation a concrete owner and releases all computation on completion. */
export function simulateInWorker(source: string, format: SourceFormat, pipeline: string, signal: AbortSignal,
  createWorker: () => SimulationWorker = () => new Worker(new URL('../workers/simulate.worker.ts', import.meta.url), { type: 'module' })): Promise<ProcessingResult> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = createWorker();
    let settled = false;
    const finish = (result?: ProcessingResult, error?: unknown) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
      worker.terminate();
      if (error !== undefined) reject(error); else resolve(result!);
    };
    const abort = () => finish(undefined, new DOMException('Simulation canceled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<SimulationResponse>) => {
      if ('error' in event.data) finish(undefined, new Error(event.data.error));
      else finish(event.data.result);
    };
    worker.onerror = event => { event.preventDefault(); finish(undefined, new Error(event.message || 'Simulation worker failed')); };
    worker.onmessageerror = () => finish(undefined, new Error('Unable to read simulation output'));
    try { worker.postMessage({ source, format, pipeline }); }
    catch (error) { finish(undefined, error); }
  });
}

export async function evaluatePipeline(source: string, format: SourceFormat, pipeline: string, signal: AbortSignal): Promise<ProcessingResult> {
  signal.throwIfAborted();
  if (typeof Worker !== 'undefined') return simulateInWorker(source, format, pipeline, signal);
  // Non-worker hosts retain local simulation; cancellation applies before synchronous work begins.
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  signal.throwIfAborted();
  return simulatePipeline(source, format, pipeline);
}
