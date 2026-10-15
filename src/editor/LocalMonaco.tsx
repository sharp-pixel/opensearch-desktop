// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { jsonDefaults } from 'monaco-editor/languages/features/json/register';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';

// The installed editor and its workers ship with every host; startup needs no CDN.
self.MonacoEnvironment = {
  getWorker: (_moduleId, label) => label === 'json' ? new JsonWorker() : new EditorWorker(),
};
jsonDefaults.setModeConfiguration({ ...jsonDefaults.modeConfiguration, completionItems: false, hovers: false, documentSymbols: false, diagnostics: false });
jsonDefaults.setDiagnosticsOptions({ validate: false, schemas: [], enableSchemaRequest: false, allowComments: true });
loader.config({ monaco });
export default Editor;
