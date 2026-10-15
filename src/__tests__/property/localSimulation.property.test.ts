// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { DataPrepperProvider, useDataPrepper } from '../../features/dataprepper/ui/DataPrepperContext';
import { configureDraftRepository, flushDrafts } from '../../storage/drafts';
import { evaluatePipeline } from '../../features/dataprepper/application/evaluate';
import { importPipelineDocument } from '../../features/dataprepper/domain/document';

const document = { sourceData: '{"message":"hello"}', sourceFormat: 'json' as const, pipelineConfig: `test:
  processor:
    - add_entries:
        entries:
          - key: tested
            value: true
  sink:
    - stdout:
` };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('mounts and evaluates locally with no backend, preserving drafts across remounts', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const fetch = vi.fn().mockRejectedValue(new Error('Offline')); vi.stubGlobal('fetch', fetch);
  const save = vi.fn().mockResolvedValue(undefined);
  configureDraftRepository([{ id: 'dataprepper', content: document }], save);
  let context!: ReturnType<typeof useDataPrepper>;
  function Probe() { context = useDataPrepper(); return null; }
  const root = createRoot(window.document.createElement('div'));
  const mount = () => root.render(React.createElement(DataPrepperProvider, null, React.createElement(Probe)));
  try {
    await act(async () => mount());
    await act(async () => { await context.evaluate(); });
    expect(context.processingResult?.success).toBe(true);
    expect(context.processingResult?.events[0]?.output).toMatchObject({ message: 'hello', tested: true });
    const before = context.sourceData;
    await act(async () => { expect(context.importState('{"sourceData":"changed","sourceFormat":"invalid"}')).toBe(false); });
    expect(context.sourceData).toBe(before);
    await act(async () => { expect(context.importState('{"sourceData":"{\\"message\\":\\"saved\\"}"}')).toBe(true); await flushDrafts(); });
    await act(async () => root.render(null));
    await act(async () => mount());
    expect(context.sourceData).toBe('{"message":"saved"}');
    expect(context.sourceFormat).toBe('json');
    expect(save).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
it('rejects malformed imports without changing the supplied document and accepts legacy partial exports', () => {
  for (const value of [null, [], {}, { sourceData: 10 }, { sourceFormat: ['json'] }, { pipelineConfig: {} }]) {
    expect(() => importPipelineDocument(JSON.stringify(value), document)).toThrow();
  }
  expect(importPipelineDocument('{"sourceData":"replacement"}', document)).toEqual({ ...document, sourceData: 'replacement' });
  expect(document.sourceData).toBe('{"message":"hello"}');
});
it('cancels queued simulation before work begins', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const pending = evaluatePipeline(document.sourceData, document.sourceFormat, document.pipelineConfig, controller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await vi.runAllTimersAsync(); await rejected;
});
it('terminates local workers on cancellation, success, and errors', async () => {
  const { simulateInWorker } = await import('../../features/dataprepper/application/evaluate');
  const make = () => ({ postMessage: vi.fn(), terminate: vi.fn(), onmessage: null as Worker['onmessage'], onerror: null as Worker['onerror'], onmessageerror: null as Worker['onmessageerror'] });
  const first = make(); const controller = new AbortController();
  const pending = simulateInWorker(document.sourceData, 'json', document.pipelineConfig, controller.signal, () => first);
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await rejected;
  expect(first.terminate).toHaveBeenCalledOnce(); expect(first.onmessage).toBeNull();
  const second = make();
  const completed = simulateInWorker('', 'json', '', new AbortController().signal, () => second);
  const result = { success: true, events: [], errors: [], warnings: [], stats: { totalEvents: 0, successfulEvents: 0, failedEvents: 0, processingTimeMs: 0 } };
  second.onmessage!.call(second as unknown as Worker, new MessageEvent('message', { data: { result } }));
  expect(await completed).toEqual(result); expect(second.terminate).toHaveBeenCalledOnce();
  const third = make();
  const failed = simulateInWorker('', 'json', '', new AbortController().signal, () => third);
  const failure = expect(failed).rejects.toThrow('Unable to read simulation output');
  third.onmessageerror!.call(third as unknown as Worker, new MessageEvent('messageerror')); await failure;
  expect(third.terminate).toHaveBeenCalledOnce();
});
