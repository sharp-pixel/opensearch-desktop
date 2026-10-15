// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { useCallback, useEffect, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';

interface MarkerError { line: number; column: number; message: string; severity: 'error' | 'warning' }
/** Bind markers to the mounted Monaco instance, including errors received before mount. */
export function useEditorMarkers(owner: string, errors: MarkerError[]): OnMount {
  const [binding, setBinding] = useState<{ editor: Monaco.editor.IStandaloneCodeEditor; monaco: typeof Monaco } | null>(null);
  const mount: OnMount = useCallback((editor, monaco) => setBinding({ editor, monaco }), []);
  useEffect(() => {
    if (!binding) return;
    const { editor, monaco } = binding;
    let model: Monaco.editor.ITextModel | null = null;
    const clear = () => { if (model && !model.isDisposed()) monaco.editor.setModelMarkers(model, owner, []); };
    const update = () => {
      clear(); model = editor.getModel();
      if (model && !model.isDisposed()) monaco.editor.setModelMarkers(model, owner, errors.map(error => ({
        severity: error.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        startLineNumber: Math.max(1, error.line), endLineNumber: Math.max(1, error.line),
        startColumn: Math.max(1, error.column), endColumn: Math.max(1, error.column) + 10, message: error.message,
      })));
    };
    update();
    const modelChanged = editor.onDidChangeModel(update);
    const disposed = editor.onDidDispose(clear);
    return () => { modelChanged.dispose(); disposed.dispose(); clear(); };
  }, [binding, errors, owner]);
  return mount;
}
