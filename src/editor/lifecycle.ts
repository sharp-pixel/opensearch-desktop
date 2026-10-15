// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type * as Monaco from 'monaco-editor';

const resources = new WeakMap<Monaco.editor.IStandaloneCodeEditor, Map<string, Monaco.IDisposable>>();
/** Replace duplicate registrations and release them with their owning editor. */
export function ownEditorResource(editor: Monaco.editor.IStandaloneCodeEditor, key: string, resource: Monaco.IDisposable): Monaco.IDisposable {
  let registrations = resources.get(editor);
  if (!registrations) { registrations = new Map(); resources.set(editor, registrations); }
  registrations.get(key)?.dispose();
  let disposed = false;
  const owned = { dispose() {
    if (disposed) return;
    disposed = true; resource.dispose(); listener.dispose();
    if (registrations.get(key) === owned) registrations.delete(key);
  } };
  registrations.set(key, owned);
  const listener = editor.onDidDispose(owned.dispose);
  return owned;
}

/** One keydown path for all hosts: no overlapping command/fallback or delayed run. */
export function registerRunShortcut(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco,
  run: () => void, disabled: () => boolean = () => false): Monaco.IDisposable {
  return ownEditorResource(editor, 'run-shortcut', editor.onKeyDown(event => {
    if (!(event.ctrlKey || event.metaKey) || event.keyCode !== monaco.KeyCode.Enter || event.altKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation();
    if (!event.browserEvent.repeat && !event.browserEvent.isComposing && !disabled()) run();
  }));
}
