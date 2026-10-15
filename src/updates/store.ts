// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { appUpdates } from '../platform/runtime';
import { prepareUpdateRestart, cancelUpdateRestart } from './restartGuard';
import type { AppUpdateAccess, AppUpdateStatus } from './contracts';

export const AUTOMATIC_UPDATES_KEY = 'workbench:automatic-update-checks';
export interface UpdateState {
  native: AppUpdateStatus | null;
  busy: boolean;
  restarting: boolean;
  automaticChecks: boolean;
  error: string | null;
  checked: boolean;
}
function automaticChecks() {
  try { return localStorage.getItem(AUTOMATIC_UPDATES_KEY) !== 'false'; }
  catch { return true; }
}
export function createUpdateStore(access: AppUpdateAccess, beforeRestart: () => Promise<boolean>, cancelRestart: () => void = () => {}) {
  let state: UpdateState = { native: null, busy: false, restarting: false, automaticChecks: automaticChecks(), error: null, checked: false };
  const listeners = new Set<() => void>();
  let initialization: Promise<void> | undefined;
  let operation: Promise<void> | undefined;
  const publish = (next: Partial<UpdateState>) => { state = { ...state, ...next }; listeners.forEach(listener => listener()); };
  async function run(action: () => Promise<AppUpdateStatus>, poll = false) {
    if (operation) return operation;
    publish({ busy: true, error: null });
    let timer: ReturnType<typeof setInterval> | undefined;
    let reading = false;
    let finished = false;
    if (poll) timer = setInterval(() => {
      if (reading) return;
      reading = true;
      void access.status().then(native => { if (!finished) publish({ native }); }).catch(() => {}).finally(() => { reading = false; });
    }, 300);
    operation = Promise.resolve().then(action).then(native => publish({ native })).catch(async error => {
      try { publish({ native: await access.status() }); } catch { /* Preserve the last known state when the host cannot be reached. */ }
      publish({ error: error instanceof Error ? error.message : String(error) });
    }).finally(() => { finished = true; clearInterval(timer); operation = undefined; publish({ busy: false }); });
    return operation;
  }
  const store = {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    initialize() {
      if (initialization) return initialization;
      initialization = run(() => access.status()).then(async () => {
        if (state.automaticChecks && state.native?.info.supported && state.native.info.configured) await store.check();
      }).finally(() => {
        if (!state.native) initialization = undefined;
      });
      return initialization;
    },
    setAutomaticChecks(value: boolean) {
      try { localStorage.setItem(AUTOMATIC_UPDATES_KEY, String(value)); } catch { /* Session preference still applies. */ }
      publish({ automaticChecks: value });
    },
    async check() {
      if (state.busy || !state.native?.info.supported || !state.native.info.configured || ['downloaded', 'installed'].includes(state.native.phase)) return;
      await run(() => access.check());
      if (!state.error) publish({ checked: true });
    },
    async download() {
      if (state.busy || state.native?.phase !== 'available') return;
      await run(() => access.download(), true);
    },
    async restart() {
      if (state.busy || !state.native || !['downloaded', 'installed'].includes(state.native.phase)) return;
      const previous = state.native;
      publish({ restarting: true });
      await run(async () => {
        if (!await beforeRestart()) throw new Error('Your changes could not be saved. Resolve the save error before restarting.');
        const installed = previous.phase === 'installed' ? previous : await access.install();
        publish({ native: installed });
        await access.restart();
        return installed;
      }, true);
      if (state.error) cancelRestart();
      publish({ restarting: false });
    },
  };
  return store;
}
export const updateStore = createUpdateStore(appUpdates, prepareUpdateRestart, cancelUpdateRestart);
