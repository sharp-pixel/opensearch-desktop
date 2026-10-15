// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { federatedConnectionInput } from '../../../execution/provenance';
import type { InvestigationStore } from '../state/store';
import type { ConnectionConfig } from '../../../types/connection';
import { executeFederated } from '../../../services/federatedExecutor';

export async function executeInvestigationCell(store: InvestigationStore, cellId: string, connections: ConnectionConfig[], executor = executeFederated) {
  const { activeInvestigation: document, clusterGroup } = store.getSnapshot();
  const source = document?.cells.find(cell => cell.id === cellId);
  if (!document || source?.type !== 'ppl' || !source.query.trim()) return;
  if (!clusterGroup?.connectionIds.length) throw new Error('Select at least one cluster before running a query');
  const cell = structuredClone(source);
  const group = structuredClone(clusterGroup);
  const configs = structuredClone(connections);
  const run = store.runs.begin({ feature: 'investigation', documentId: document.id, cellId,
    connectionId: group.id, inputRevision: cell.updatedAt });
  store.clearClusterStatuses(cellId, document.id);
  store.setCellExecuting(cellId, true, document.id);
  try {
    const result = await executor(cell.query, group, configs, { signal: run.signal,
      onClusterStatus(status) { if (run.isCurrent()) store.setClusterStatus(cellId, status, document.id); },
    });
    if (run.isCurrent()) store.setFederatedResult(cellId, { ...result, source: { runId: run.id, input: JSON.stringify(['ppl', cell.query]), connection: federatedConnectionInput(group, configs) } }, document.id);
  } finally {
    if (run.isCurrent()) store.setCellExecuting(cellId, false, document.id);
    run.finish();
  }
}
