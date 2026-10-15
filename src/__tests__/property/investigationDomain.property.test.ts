// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { expect, it } from 'vitest';
import * as domain from '../../features/investigation/domain/document';
import { federatedConnectionInput, investigationResultIsStale } from '../../execution/provenance';
import type { ConnectionConfig } from '../../types/connection';

it('protects identities and rejects duplicate insertion and invalid reorder permutations', () => {
  const first = domain.newPPLCell('a', 1); const second = domain.newMarkdownCell('b', 1);
  const doc = domain.addCell(domain.addCell(domain.newInvestigation('d', 'D', 'g', 1), first, 2), second, 3);
  expect(domain.addCell(doc, first, 4)).toBe(doc);
  expect(domain.reorderCells(doc, ['a', 'a'], 4)).toBe(doc);
  expect(domain.reorderCells(doc, ['b'], 4)).toBe(doc);
  expect(domain.reorderCells(doc, ['b', 'a'], 4).cells.map(cell => cell.id)).toEqual(['b', 'a']);
  const edited = domain.updateCell(doc, 'a', { id: 'other', type: 'markdown', createdAt: 20 }, 4);
  expect(edited.cells[0]).toMatchObject({ id: 'a', type: 'ppl', createdAt: 1, updatedAt: 4, query: '' });
  expect(doc.cells[0]).toBe(first);
});

it('detects changes in federated inputs and selected connections, excluding unrelated connections', () => {
  const connection: ConnectionConfig = { id: 'a', name: 'A', endpoint: 'https://example.invalid', authType: 'none', credentials: null, revision: '1' };
  const group = domain.newClusterGroup('g', 'G', ['a']);
  const cell = { ...domain.newPPLCell('c', 1), query: 'source=logs', lastResult: {
    success: true, clusterResults: [], consolidatedSchema: [], consolidatedRows: [], totalRows: 0,
    successfulClusters: 1, failedClusters: 0, totalDuration: 1, executedAt: 1,
    source: { runId: 'run', input: JSON.stringify(['ppl', 'source=logs']), connection: federatedConnectionInput(group, [connection]) },
  } };
  expect(investigationResultIsStale(cell, group, [connection])).toBe(false);
  expect(investigationResultIsStale(cell, group, [connection, { ...connection, id: 'b' }])).toBe(false);
  expect(investigationResultIsStale(cell, group, [{ ...connection, revision: '2' }])).toBe(true);
  expect(investigationResultIsStale(cell, group, [])).toBe(true);
  expect(investigationResultIsStale({ ...cell, query: 'source=other' }, group, [connection])).toBe(true);
});
