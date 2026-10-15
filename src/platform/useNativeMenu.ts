// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from 'react';
import { t, useLanguage } from '../i18n';
import { getNativeMenu, hasPendingDocumentFileOperations } from './runtime';
import type { NativeMenuAccess, NativeMenuAction, NativeMenuState } from './contracts';

// Keep updates ordered when one workspace unmounts and another takes over the menu.
let pendingUpdate = Promise.resolve();
let nativeMenuReady = false;
const readinessListeners = new Set<() => void>();
function subscribeToReadiness(listener: () => void) {
  readinessListeners.add(listener);
  return () => { readinessListeners.delete(listener); };
}
function setReady(ready: boolean) {
  nativeMenuReady = ready;
  readinessListeners.forEach(listener => listener());
}
export function useNativeMenuReady() {
  return useSyncExternalStore(subscribeToReadiness, () => nativeMenuReady, () => false);
}
function updateMenu(menu: NativeMenuAccess, state: NativeMenuState) {
  const update = pendingUpdate.then(() => menu.update(state));
  pendingUpdate = update.catch(() => {});
  return update;
}
function hasDialog() { return !!document.querySelector('[role="dialog"], [aria-modal="true"]'); }

export function useNativeMenuAction(handler: (action: NativeMenuAction) => void) {
  const menu = useMemo(() => getNativeMenu(), []);
  const [listening, setListening] = useState(false);
  const onAction = useEffectEvent(handler);
  useEffect(() => {
    if (!menu) return;
    let disposed = false;
    let release: (() => void) | undefined;
    void menu.listen(action => { if (!disposed) onAction(action); }).then(unlisten => {
      if (disposed) unlisten();
      else { release = unlisten; setListening(true); }
    }).catch(error => console.error('Native menu listener failed:', error));
    return () => { disposed = true; release?.(); };
  }, [menu]);
  return { menu, listening };
}

export interface FileMenuCommands {
  busy: boolean;
  canSave: boolean;
  onHome?: () => void;
  onNew?: () => void;
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
}

export function useNativeFileMenu(commands: FileMenuCommands) {
  const language = useLanguage();
  const ready = useNativeMenuReady();
  const [modal, setModal] = useState(hasDialog);
  const dispatch = (action: NativeMenuAction) => {
    if (commands.busy || hasDialog() || hasPendingDocumentFileOperations()) return;
    if (action === 'new') commands.onNew?.();
    if (action === 'open') commands.onOpen?.();
    if (action === 'recent') commands.onHome?.();
    if (commands.canSave && action === 'save') commands.onSave?.();
    if (commands.canSave && action === 'save-as') commands.onSaveAs?.();
  };
  const onShortcut = useEffectEvent(dispatch);
  const { menu, listening } = useNativeMenuAction(action => dispatch(action));
  const { busy, canSave } = commands;
  const hasHome = !!commands.onHome, hasNew = !!commands.onNew, hasOpen = !!commands.onOpen;
  const hasSave = !!commands.onSave, hasSaveAs = !!commands.onSaveAs;

  useEffect(() => {
    if (!menu) return;
    const observer = new MutationObserver(() => setModal(hasDialog()));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-modal'] });
    return () => {
      observer.disconnect();
      setReady(false);
      void updateMenu(menu, { labels: {}, enabled: {} }).catch(error => console.error('Native menu reset failed:', error));
    };
  }, [menu]);

  useEffect(() => {
    if (!menu || !listening) return;
    let disposed = false;
    const available = !busy && !modal;
    void updateMenu(menu, {
      labels: { file: t('File'), edit: t('Edit'), window: t('Window'), new: t('New'), open: t('Open…'),
        recent: t('Recent files'), save: t('Save'), 'save-as': t('Save As…'), preferences: `${t('Preferences')}…` },
      enabled: { new: available && hasNew, open: available && hasOpen, recent: available && hasHome,
        save: available && canSave && hasSave, 'save-as': available && canSave && hasSaveAs, preferences: !modal },
    }).then(() => { if (!disposed) setReady(true); }).catch(error => {
      console.error('Native menu update failed:', error);
      if (!disposed) setReady(false);
    });
    return () => { disposed = true; };
  }, [menu, listening, language, busy, canSave, modal, hasHome, hasNew, hasOpen, hasSave, hasSaveAs]);

  useEffect(() => {
    // The native menu owns desktop accelerators; the web toolbar owns browser shortcuts.
    if (ready) return;
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || hasDialog()) return;
      const key = event.key.toLowerCase();
      if (!['n', 'o', 's'].includes(key)) return;
      event.preventDefault(); event.stopPropagation();
      onShortcut(key === 'n' ? 'new' : key === 'o' ? 'open' : event.shiftKey ? 'save-as' : 'save');
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [ready]);
  return ready;
}
