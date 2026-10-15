// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { ownEditorResource } from '../editor/lifecycle';
import type * as Monaco from 'monaco-editor';
import type { FieldSource, MappedField } from './fieldMappings';
import { dslFieldContext } from './fieldCompletionContext';
import { getQueryDslSuggestions, parseJsonContext } from './autocompleteProvider';
import { jsonCompletionContext, jsonCompletionRange } from './jsonCompletionContext';
import { getCompletions, getDocumentStateCompletions } from './ismAutocomplete';
import { getPPLSuggestions, getPPLCompletionRange, shouldSuggestPPLFields } from './pplAutocomplete';

/** Monaco providers are global; restrict each provider to its owning editor. */
export function registerScopedCompletions(
  monaco: typeof Monaco,
  editor: Monaco.editor.IStandaloneCodeEditor,
  language: string,
  provider: Monaco.languages.CompletionItemProvider,
): Monaco.IDisposable {
  const registration = monaco.languages.registerCompletionItemProvider(language, {
    ...provider,
    provideCompletionItems(model, position, context, token) {
      return model === editor.getModel() ? provider.provideCompletionItems(model, position, context, token) : { suggestions: [] };
    },
  });
  return ownEditorResource(editor, `completions:${language}`, registration);
}

function rangeFor(model: Monaco.editor.ITextModel, start: number, end: number): Monaco.IRange {
  const from = model.getPositionAt(start);
  const to = model.getPositionAt(end);
  return { startLineNumber: from.lineNumber, startColumn: from.column, endLineNumber: to.lineNumber, endColumn: to.column };
}

export function jsonEditorCompletionProvider(monaco: typeof Monaco, kind: 'dsl' | 'ism', getFields?: FieldSource): Monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['"', ':', '{', ','],
    async provideCompletionItems(model, position, _context, token) {
      const text = model.getValue();
      const offset = model.getOffsetAt(position);
      const context = jsonCompletionContext(text, offset);
      const edit = jsonCompletionRange(text, offset);
      const range = rangeFor(model, edit.start, edit.end);
      if (kind === 'dsl') {
        const fieldContext = dslFieldContext(text, offset);
        const fields = fieldContext && getFields ? await getFields(text).catch(() => []) : [];
        if (token.isCancellationRequested || model.isDisposed?.() || model.getValue() !== text) return { suggestions: [] };
        const staticItems = context.isProperty ? getQueryDslSuggestions(parseJsonContext(text, offset)) : [];
        const items = staticItems.map(item => ({
          label: item.field, description: item.description, detail: item.valueType as string,
        }));
        for (const field of fields) {
          if (fieldContext === 'nested' && !field.types.includes('nested')) continue;
          if (!items.some(item => item.label === field.name)) items.push({ label: field.name, description: fieldDocumentation(field), detail: field.types.join(' | ') });
        }
        return { suggestions: items.map(item => ({
          label: item.label, kind: monaco.languages.CompletionItemKind.Field,
          filterText: text[edit.start] === '"' ? JSON.stringify(item.label) : item.label,
          documentation: item.description, detail: item.detail,
          insertText: JSON.stringify(item.label), range,
        })) };
      }
      const items = context.isValue && ['state_name', 'default_state'].includes(context.key || '')
        ? getDocumentStateCompletions(text)
        : getCompletions(null, { line: position.lineNumber, column: position.column }, text.slice(0, offset));
      return { suggestions: items.map(item => ({
        label: item.label,
        filterText: text[edit.start] === '"' ? JSON.stringify(item.label) : item.label,
        kind: item.kind === 'value' ? monaco.languages.CompletionItemKind.Value : monaco.languages.CompletionItemKind.Property,
        documentation: item.documentation, detail: item.detail,
        // Keep an existing value when completing an existing property name.
        insertText: item.kind === 'property' && edit.hasColon ? JSON.stringify(item.label) : item.insertText,
        range,
      })) };
    },
  };
}

export function pplEditorCompletionProvider(monaco: typeof Monaco, getIndices: () => string[], getFields?: FieldSource): Monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['=', '|', ' ', '(', '.', '-'],
    async provideCompletionItems(model, position, _context, token) {
      const text = model.getValue();
      const offset = model.getOffsetAt(position);
      const edit = getPPLCompletionRange(text, offset);
      const fields = getFields && shouldSuggestPPLFields(text, offset) ? await getFields(text).catch(() => []) : [];
      if (token.isCancellationRequested || model.isDisposed?.() || model.getValue() !== text) return { suggestions: [] };
      const byName = new Map(fields.map(field => [field.name, field]));
      return { suggestions: getPPLSuggestions(text, offset, getIndices(), fields.map(field => field.name)).map(item => ({
        label: item.label,
        filterText: edit.quoted ? '`' + item.label + '`' : item.label,
        kind: item.type === 'index' ? monaco.languages.CompletionItemKind.Folder
          : item.type === 'field' ? monaco.languages.CompletionItemKind.Field
          : item.type === 'function' ? monaco.languages.CompletionItemKind.Function
          : monaco.languages.CompletionItemKind.Keyword,
        documentation: byName.has(item.label) ? fieldDocumentation(byName.get(item.label)!) : item.description,
        detail: byName.get(item.label)?.types.join(' | ') ?? item.detail,
        insertText: item.type === 'field' ? quotePPLField(item.insertText, edit.quoted) : edit.quoted ? '`' + item.insertText + '`' : item.insertText,
        range: rangeFor(model, edit.start, edit.end),
      })) };
    },
  };
}

function fieldDocumentation(field: MappedField): string {
  return `${field.name} (${field.types.join(' | ')})\nIndexes: ${field.indices.join(', ')}`;
}

function quotePPLField(name: string, alreadyQuoted: boolean): string {
  // Quoting also protects reserved names such as "source" and "where".
  return alreadyQuoted || !/^[A-Za-z_][\w]*$/.test(name) || /^(source|where|fields|stats|sort|by|as|and|or|not|null|true|false)$/i.test(name)
    ? '`' + name.replace(/`/g, '``') + '`' : name;
}
