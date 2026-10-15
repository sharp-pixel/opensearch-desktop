// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

let release: (() => void) | undefined;
let guard: (() => Promise<boolean>) | undefined;
/** The app lifecycle owns saving; the updater cannot restart until it agrees. */
export function registerUpdateRestartGuard(next: () => Promise<boolean>, cancel: () => void) {
  guard = next;
  release = cancel;
  return () => { if (guard === next) { guard = undefined; release = undefined; } };
}
export async function prepareUpdateRestart() {
  if (!guard) return false;
  return guard();
}

export function cancelUpdateRestart() { release?.(); }
