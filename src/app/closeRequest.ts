// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

/** Share repeated close clicks and keep the window open if saving fails or stalls. */
export function createCloseRequest(flush: () => Promise<boolean>, report: (saving: boolean, error: string | null) => void, timeoutMs = 10000) {
  let active = true;
  let pending: Promise<boolean> | undefined;
  return {
    request() {
      if (!active) return Promise.resolve(false);
      if (pending) return pending;
      report(true, null);
      pending = (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const saved = await Promise.race([Promise.resolve().then(flush), new Promise<boolean>(resolve => {
            timer = setTimeout(() => resolve(false), timeoutMs);
          })]);
          if (!active) return false;
          if (!saved) report(false, 'The window stayed open because saving did not finish. Check the save errors and try closing again.');
          return saved;
        } catch {
          if (active) report(false, 'The window stayed open because saving failed. Check the save errors and try closing again.');
          return false;
        } finally { clearTimeout(timer); pending = undefined; }
      })();
      return pending;
    },
    dispose() { active = false; },
  };
}
