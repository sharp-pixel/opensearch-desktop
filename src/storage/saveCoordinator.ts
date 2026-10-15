// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

export type SaveState = 'saved' | 'pending' | 'error';

/** Serialize and coalesce writes per document; retain failed revisions for retry. */
export function createSaveCoordinator<T>(write: (id: string, value: T) => void | Promise<void>, changed: (state: SaveState, error: string | null) => void) {
  const pending = new Map<string, T>();
  const running = new Map<string, Promise<boolean>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const paused = new Set<string>();
  const failures = new Map<string, string>();
  function publish() {
    changed(failures.size ? 'error' : pending.size ? 'pending' : 'saved',
      failures.size ? [...failures.values()].join('; ') : null);
  }
  function flushKey(id: string): Promise<boolean> {
    if (paused.has(id)) return running.get(id) ?? Promise.resolve(false);
    const existing = running.get(id);
    if (existing) return existing.then(success => success && pending.has(id) ? flushKey(id) : success);
    clearTimeout(timers.get(id)); timers.delete(id);
    const operation = (async () => {
      while (pending.has(id) && !paused.has(id)) {
        const value = pending.get(id)!;
        try {
          const result = write(id, value);
          if (result) await result;
          if (pending.get(id) === value) pending.delete(id);
          failures.delete(id);
        } catch (error) {
          failures.set(id, error instanceof Error ? error.message : 'Save failed');
          publish();
          return false;
        }
      }
      return true;
    })();
    running.set(id, operation);
    void operation.finally(() => running.delete(id));
    return operation;
  }
  async function flush(id?: string): Promise<boolean> {
    const results = await Promise.all((id === undefined ? [...new Set([...pending.keys(), ...running.keys()])] : [id]).map(flushKey));
    const success = results.every(Boolean);
    publish();
    return success;
  }
  return {
    schedule(id: string, value: T, delay: number) {
      pending.set(id, value);
      clearTimeout(timers.get(id));
      if (!paused.has(id)) timers.set(id, setTimeout(() => { void flush(id); }, delay));
      publish();
    },
    flush,
    isBusy: (id: string) => pending.has(id) || running.has(id) || paused.has(id),
    pause(id: string) { paused.add(id); clearTimeout(timers.get(id)); timers.delete(id); },
    resume(id: string) { paused.delete(id); if (pending.has(id)) void flush(id); },
    async wait(id: string) { await running.get(id); },
    remove(id: string) { clearTimeout(timers.get(id)); timers.delete(id); pending.delete(id); failures.delete(id); paused.delete(id); publish(); },
    dispose() { timers.forEach(clearTimeout); timers.clear(); void flush(); },
  };
}
