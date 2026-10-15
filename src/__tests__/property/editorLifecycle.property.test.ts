// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { registerRunShortcut } from '../../editor/lifecycle';
import { useEditorMarkers } from '../../editor/useEditorMarkers';
import type * as Monaco from 'monaco-editor';
import type { OnMount } from '@monaco-editor/react';

afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const keydown = new Set<(event: any) => void>();
  const disposed = new Set<() => void>(); const changed = new Set<() => void>();
  let model = { id: 'first', isDisposed: () => false };
  const on = <T,>(listeners: Set<T>, fn: T) => { listeners.add(fn); return { dispose: () => listeners.delete(fn) }; };
  const editor = { onKeyDown: (fn: (event: any) => void) => on(keydown, fn),
    onDidDispose: (fn: () => void) => on(disposed, fn), onDidChangeModel: (fn: () => void) => on(changed, fn), getModel: () => model };
  const monaco = { KeyCode: { Enter: 3 }, MarkerSeverity: { Error: 8, Warning: 4 }, editor: { setModelMarkers: vi.fn() } };
  return { editor: editor as unknown as Monaco.editor.IStandaloneCodeEditor, monaco: monaco as unknown as typeof Monaco, keydown, disposed,
    replaceModel() { model = { id: 'second', isDisposed: () => false }; changed.forEach(fn => fn()); }, markers: monaco.editor.setModelMarkers };
}
it('runs once per shortcut, replaces duplicate bindings, ignores repeats and releases on disposal', () => {
  const f = fixture(); let disabled = false; const old = vi.fn(); const run = vi.fn();
  registerRunShortcut(f.editor, f.monaco, old);
  const binding = registerRunShortcut(f.editor, f.monaco, run, () => disabled);
  const event = { ctrlKey: true, metaKey: false, keyCode: 3, browserEvent: { repeat: false, isComposing: false }, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  f.keydown.forEach(fn => fn(event)); expect(run).toHaveBeenCalledOnce(); expect(old).not.toHaveBeenCalled();
  f.keydown.forEach(fn => fn({ ...event, browserEvent: { repeat: true } }));
  f.keydown.forEach(fn => fn({ ...event, browserEvent: { isComposing: true } }));
  disabled = true; f.keydown.forEach(fn => fn(event)); expect(run).toHaveBeenCalledOnce();
  f.disposed.forEach(fn => fn()); binding.dispose(); expect(f.keydown.size).toBe(0); expect(f.disposed.size).toBe(0);
});
it('applies pre-mount diagnostics and clears only its own markers on model changes and unmount', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const f = fixture(); const root = createRoot(document.createElement('div'));
  const errors = [{ line: 1, column: 2, message: 'Invalid pipeline', severity: 'error' as const }];
  let mount!: OnMount;
  function Probe() { mount = useEditorMarkers('pipeline-test', errors); return null; }
  try {
    await act(async () => root.render(React.createElement(Probe)));
    await act(async () => mount(f.editor, f.monaco));
    expect(f.markers).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'first' }), 'pipeline-test', [expect.objectContaining({ message: 'Invalid pipeline', severity: 8 })]);
    f.replaceModel();
    expect(f.markers).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'first' }), 'pipeline-test', []);
    expect(f.markers).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'second' }), 'pipeline-test', expect.any(Array));
  } finally { await act(async () => root.unmount()); }
  expect(f.markers).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'second' }), 'pipeline-test', []);
});
