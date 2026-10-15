// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutputPanel } from '../../features/dataprepper/ui/OutputPanel';
import { simulatePipeline } from '../../services/pipelineSimulator';

vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ mode: 'light' }) }));
vi.mock('../../editor/WorkbenchEditor', async () => {
  const { createElement } = await import('react');
  return { WorkbenchEditor: ({ value }: { value: string }) => createElement('pre', { 'data-editor': true }, value) };
});

describe('Data Prepper output metadata', () => {
  let container: HTMLDivElement;
  let root: Root;
  const copy = vi.fn().mockResolvedValue(undefined);
  let originalClipboard: PropertyDescriptor | undefined;

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: copy }, configurable: true });
    copy.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const result = simulatePipeline('{"message":"invalid"}', 'json', `test:
  processor:
    - parse_json:
        tags_on_failure: [parse-failure]
    - add_entries:
        entries:
          - metadata_key: marker
            value: kept
`);
    await act(async () => {
      root.render(React.createElement(OutputPanel, { result, isProcessing: false, generatedRole: null, roleError: null, onGenerateRole: () => {} }));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
    vi.unstubAllGlobals();
  });

  const button = (label: string) => Array.from(container.querySelectorAll('button')).find(item => item.textContent?.trim() === label)!;

  it('displays and copies metadata separately from event body output', async () => {
    const bodies = [{ message: 'invalid' }];
    expect(JSON.parse(container.querySelector('[data-editor]')!.textContent!)).toEqual(bodies);
    await act(async () => button('Copy').click());
    expect(JSON.parse(copy.mock.calls[copy.mock.calls.length - 1]![0])).toEqual(bodies);

    await act(async () => button('Metadata').click());
    const metadata = [{ event: 1, attributes: { marker: 'kept' }, tags: ['parse-failure'] }];
    expect(JSON.parse(container.querySelector('[data-editor]')!.textContent!)).toEqual(metadata);
    await act(async () => button('Copy').click());
    expect(JSON.parse(copy.mock.calls[copy.mock.calls.length - 1]![0])).toEqual(metadata);
    await act(async () => button('Output').click());
    expect(JSON.parse(container.querySelector('[data-editor]')!.textContent!)).toEqual(bodies);
  });

  it('shows event metadata alongside the body diff', async () => {
    await act(async () => button('Diff').click());
    const header = Array.from(container.querySelectorAll('div')).find(item => item.textContent?.startsWith('Event 1') && item.style.cursor === 'pointer')!;
    await act(async () => header.click());
    const blocks = Array.from(container.querySelectorAll('pre')).map(block => JSON.parse(block.textContent!));
    expect(blocks).toEqual([
      { message: 'invalid' }, { message: 'invalid' }, { attributes: { marker: 'kept' }, tags: ['parse-failure'] },
    ]);
  });
});
