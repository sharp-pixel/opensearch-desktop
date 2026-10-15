// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/** Shared cancellation registry for trusted renderer requests. */
const active = new Map();
function registerRequest(id, cancel) {
  if (id === undefined) return () => {};
  if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id) || active.has(id)) throw new Error('Invalid or duplicate request ID');
  active.set(id, cancel);
  return () => active.delete(id);
}
function cancelRequest(id) {
  if (typeof id !== 'string') return;
  active.get(id)?.();
}
module.exports = { registerRequest, cancelRequest };
