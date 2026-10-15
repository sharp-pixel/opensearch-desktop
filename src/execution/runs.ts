// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

export interface RunIdentity {
  feature: string;
  documentId: string;
  cellId: string;
  connectionId: string;
  inputRevision: number;
}

/** Run identities, not selection or component lifetime, govern completion. */
export function createRunCoordinator() {
  const active = new Map<string, { id: string; scope: RunIdentity; controller: AbortController }>();
  const key = (scope: Pick<RunIdentity, 'feature' | 'documentId' | 'cellId'>) => JSON.stringify([scope.feature, scope.documentId, scope.cellId]);
  return {
    hasDocument: (id: string) => [...active.values()].some(run => run.scope.documentId === id),
    begin(scope: RunIdentity) {
      const slot = key(scope);
      active.get(slot)?.controller.abort();
      const run = { id: crypto.randomUUID(), scope, controller: new AbortController() };
      active.set(slot, run);
      return { ...scope, id: run.id, signal: run.controller.signal,
        isCurrent: () => active.get(slot) === run && !run.controller.signal.aborted,
        finish() { if (active.get(slot) === run) active.delete(slot); },
      };
    },
    cancelDocument(documentId: string, cellId?: string) {
      for (const [slot, run] of active) if (run.scope.documentId === documentId && (cellId === undefined || run.scope.cellId === cellId)) {
        run.controller.abort(); active.delete(slot);
      }
    },
    dispose() { active.forEach(run => run.controller.abort()); active.clear(); },
  };
}
