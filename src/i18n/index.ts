// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { useSyncExternalStore } from 'react';
import { ja } from './ja';

export type Language = 'en' | 'ja';
export type LanguagePreference = 'system' | Language;
export const LANGUAGE_KEY = 'workbench:language';

export function detectLanguage(saved: string | null, preferred: readonly string[] = []): Language {
  if (saved === 'en' || saved === 'ja') return saved;
  for (const value of preferred) {
    if (/^ja(?:-|$)/i.test(value)) return 'ja';
    if (/^en(?:-|$)/i.test(value)) return 'en';
  }
  return 'en';
}
function normalizePreference(value: string | null): LanguagePreference {
  return value === 'en' || value === 'ja' ? value : 'system';
}
function readPreference(): LanguagePreference {
  try { return normalizePreference(localStorage.getItem(LANGUAGE_KEY)); }
  catch { return 'system'; }
}
function systemLanguages(): readonly string[] {
  return typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
}
let preference = readPreference();
let language = detectLanguage(preference, systemLanguages());
const listeners = new Set<() => void>();
export function getLanguage() { return language; }
export function getLanguagePreference() { return preference; }

/** Explicit choices persist; system mode keeps following the host's language preferences. */
export function setLanguage(next: LanguagePreference) {
  if (next !== 'system' && next !== 'en' && next !== 'ja') return;
  try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Keep the preference for this session when storage is unavailable. */ }
  applyPreference(next);
}
function applyPreference(next: LanguagePreference) {
  preference = next;
  language = detectLanguage(next, systemLanguages());
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useLanguage() { return useSyncExternalStore(subscribe, getLanguage, () => 'en' as Language); }
export function useLanguagePreference() { return useSyncExternalStore(subscribe, getLanguagePreference, () => 'system' as LanguagePreference); }
export function t(source: string, values: Record<string, string | number> = {}): string {
  const message = language === 'ja' && Object.prototype.hasOwnProperty.call(ja, source) ? ja[source] ?? source : source;
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) => Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder);
}
export function formatDate(value: number | Date) { return new Date(value).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US'); }
if (typeof document !== 'undefined') document.documentElement.lang = language;
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', event => {
    if (event.key === LANGUAGE_KEY || event.key === null) applyPreference(readPreference());
  });
  window.addEventListener('languagechange', () => {
    if (preference === 'system') applyPreference('system');
  });
}
