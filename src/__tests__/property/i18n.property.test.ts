// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { PreferencesMenu } from '../../components/Layout/PreferencesMenu';
import { createBrowserAdapter } from '../../platform/adapters/browser';
import { documentFiles, initializePlatform } from '../../platform/runtime';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { detectLanguage, formatDate, getLanguage, getLanguagePreference, LANGUAGE_KEY, setLanguage, t } from '../../i18n';
import { ja } from '../../i18n/ja';
import { ThemeProvider } from '../../context/ThemeContext';
import { RenameDocumentTitle } from '../../components/Files/RenameDocumentTitle';
import { ACTION_REFERENCE, CONDITION_REFERENCE } from '../../features/ism/domain/ismActionReference';

let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  setLanguage('en');
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); setLanguage('en'); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('uses the saved choice before the first supported browser language', () => {
  expect(detectLanguage('en', ['ja-JP'])).toBe('en');
  expect(detectLanguage('ja', ['en-US'])).toBe('ja');
  expect(detectLanguage(null, ['fr-FR', 'ja-JP', 'en-US'])).toBe('ja');
  expect(detectLanguage(null, ['en-US', 'ja-JP'])).toBe('en');
  expect(detectLanguage('invalid', ['fr-FR'])).toBe('en');
});
it('persists language, updates document semantics, and safely interpolates user names', () => {
  setLanguage('ja');
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe('ja');
  expect(document.documentElement.lang).toBe('ja');
  expect(t('Discard “{name}”?', { name: '$& {name} <日本語>' })).toBe('「$& {name} <日本語>」を破棄しますか？');
  expect(t('GET /my-index/_search')).toBe('GET /my-index/_search');
  expect(t('Unknown upstream error')).toBe('Unknown upstream error');
  expect(t('constructor')).toBe('constructor');
  expect(t('{constructor}')).toBe('{constructor}');
  expect(formatDate(0)).toBe(new Date(0).toLocaleString('ja-JP'));
  setLanguage('en'); expect(t('Save As…')).toBe('Save As…');
});
it('keeps switching available when preference storage fails', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  expect(() => setLanguage('ja')).not.toThrow();
  expect(getLanguage()).toBe('ja'); expect(t('Save')).toBe('保存');
});
it('refreshes the language on preference changes from another window', () => {
  localStorage.setItem(LANGUAGE_KEY, 'ja');
  window.dispatchEvent(new StorageEvent('storage', { key: LANGUAGE_KEY, newValue: 'ja' }));
  expect(getLanguage()).toBe('ja'); expect(document.documentElement.lang).toBe('ja');
});
it('retains all interpolation fields and translates every ISM reference description', () => {
  const fields = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [source, message] of Object.entries(ja)) { expect(message.trim()).not.toBe(''); expect(fields(message), source).toEqual(fields(source)); }
  for (const item of [...ACTION_REFERENCE, ...CONDITION_REFERENCE]) expect(ja[item.description], item.description).toBeTruthy();
  for (const item of ACTION_REFERENCE) for (const parameter of item.parameters ?? []) expect(ja[parameter.description]).toBeTruthy();
});
it('switches an open rename dialog without modifying its draft or filename', async () => {
  const rename = vi.fn();
  const name = 'Search notes 日本語';
  await act(async () => root.render(React.createElement(ThemeProvider, null, React.createElement(RenameDocumentTitle, {
    document: { id: 'notes', name, updatedAt: 1, file: { path: '/notes/source.json', name: 'source.json', revision: 'r', dirty: true } }, kind: 'notebook', busy: false, onRename: rename,
  }))));
  await act(async () => container.querySelector('button')!.click());
  const input = document.querySelector<HTMLInputElement>('[role="dialog"] input')!;
  await act(async () => setLanguage('ja'));
  expect(document.querySelector('[role="dialog"] h2')!.textContent).toBe('ノートブックの名前を変更');
  expect(input.value).toBe(name); expect(container.textContent).toContain('source.json');
  expect(document.querySelector('[role="dialog"]')!.textContent).toContain('ファイル名を変更するには');
  await act(async () => document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')[1]!.click());
  expect(rename).toHaveBeenCalledWith(name);
});

it('localizes native dialog titles while preserving file paths and serialized document content', async () => {
  const open = vi.fn().mockResolvedValue(null); const save = vi.fn().mockResolvedValue(null);
  initializePlatform({ ...createBrowserAdapter(vi.fn(), false), kind: 'tauri', files: { open, save, read: vi.fn() } });
  setLanguage('ja');
  try {
    await documentFiles.open({ title: 'Open pipeline' });
    expect(open).toHaveBeenCalledWith({ title: 'パイプラインを開く' });
    const request = { title: 'Save pipeline as', suggestedName: 'Pipeline.json', path: '/project/English.json', content: '{"name":"Source Data","query":"GET /_search"}', expectedRevision: 'revision' };
    await documentFiles.save(request);
    expect(save).toHaveBeenCalledWith({ ...request, title: 'パイプラインに名前を付けて保存' });
    expect(request.title).toBe('Save pipeline as');
  } finally { initializePlatform(createBrowserAdapter(vi.fn(), false)); }
});

it('follows host language changes in system mode and keeps explicit overrides', () => {
  const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
  setLanguage('system');
  expect(getLanguagePreference()).toBe('system'); expect(getLanguage()).toBe('ja');
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe('system');
  languages.mockReturnValue(['en-US']); window.dispatchEvent(new Event('languagechange'));
  expect(getLanguage()).toBe('en'); expect(document.documentElement.lang).toBe('en');
  setLanguage('ja'); window.dispatchEvent(new Event('languagechange'));
  expect(getLanguagePreference()).toBe('ja'); expect(getLanguage()).toBe('ja');
  languages.mockReturnValue(['fr-FR']); setLanguage('system'); expect(getLanguage()).toBe('en');
});
it('restores system mode when another window clears the preference', () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
  localStorage.removeItem(LANGUAGE_KEY);
  window.dispatchEvent(new StorageEvent('storage', { key: LANGUAGE_KEY, newValue: null }));
  expect(getLanguagePreference()).toBe('system'); expect(getLanguage()).toBe('ja');
  setLanguage('en'); localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  expect(getLanguagePreference()).toBe('system'); expect(getLanguage()).toBe('ja');
});
it('keeps system selected when the effective language is unchanged and restores focus on dismissal', async () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
  setLanguage('system');
  await act(async () => root.render(React.createElement(ThemeProvider, null, React.createElement(PreferencesMenu))));
  const trigger = container.querySelector('button')!; trigger.focus();
  await act(async () => trigger.click());
  const select = document.querySelector<HTMLSelectElement>('[role="dialog"] select')!;
  expect(select.value).toBe('system'); expect(document.activeElement).toBe(select);
  expect(Array.from(select.options).map(option => option.value)).toEqual(['system', 'en', 'ja']);
  await act(async () => { select.value = 'en'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(select.value).toBe('en'); expect(getLanguage()).toBe('en');
  await act(async () => { select.value = 'system'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(select.value).toBe('system'); expect(getLanguage()).toBe('en');
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  await act(async () => trigger.click());
  expect(document.querySelector<HTMLSelectElement>('[role="dialog"] select')!.value).toBe('system');
});
