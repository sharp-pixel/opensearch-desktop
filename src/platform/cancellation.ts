// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/** Join user cancellation and a deadline; dispose releases timers/listeners. */
export function requestScope(timeout = 30_000, parent?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent?.aborted) abort();
  else parent?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, Math.max(1, timeout));
  return {
    signal: controller.signal,
    dispose() { clearTimeout(timer); parent?.removeEventListener('abort', abort); },
  };
}

/** Native IPC cannot clone a signal: cancellation travels as a separate command. */
export function invokeCancelable<T>(invoke: () => Promise<T>, cancel: () => Promise<unknown>, signal?: AbortSignal | null): Promise<T> {
  if (signal?.aborted) return Promise.reject(new DOMException('Request canceled', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      void cancel().catch(() => undefined);
      reject(new DOMException('Request canceled', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    // Start synchronously so IPC orders execute before cancel.
    try {
      invoke().then(resolve, reject).finally(() => signal?.removeEventListener('abort', abort));
    } catch (error) {
      signal?.removeEventListener('abort', abort);
      reject(error);
    }
  });
}
