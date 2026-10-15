// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import type { Cell } from '../types/cell';
import type { ConnectionConfig } from '../types/connection';

export interface ResultSource { runId: string; input: string; connection: string }
/** Only request inputs and public connection metadata belong in output provenance. */
export function cellInput(cell: Cell): string {
  return JSON.stringify(cell.type === 'query' ? [cell.type, cell.method, cell.endpoint, cell.body]
    : cell.type === 'ppl' ? [cell.type, cell.query] : cell.type === 'grpc' ? [cell.type, cell.method, cell.body] : [cell.type, cell.content]);
}
export function connectionInput(connection: ConnectionConfig): string {
  return JSON.stringify([connection.id, connection.endpoint, connection.grpcEndpoint, connection.authType, connection.useProxy, connection.revision]);
}
export function resultIsStale(cell: Cell, connection: ConnectionConfig | null): boolean {
  if (cell.type === 'markdown' || !cell.lastResult?.source) return false;
  return cell.lastResult.source.input !== cellInput(cell) || !connection || cell.lastResult.source.connection !== connectionInput(connection);
}

export function federatedConnectionInput(group: import('../types/investigation').ClusterGroup | null, connections: ConnectionConfig[]): string {
  return JSON.stringify(group ? [group.id, [...new Set(group.connectionIds)].sort().map(id => {
    const connection = connections.find(value => value.id === id);
    return connection ? connectionInput(connection) : [id, 'unavailable'];
  })] : null);
}
export function investigationResultIsStale(cell: import('../types/investigation').InvestigationPPLCell,
  group: import('../types/investigation').ClusterGroup | null, connections: ConnectionConfig[]): boolean {
  const source = cell.lastResult?.source;
  return !!source && (source.input !== JSON.stringify(['ppl', cell.query]) || source.connection !== federatedConnectionInput(group, connections));
}
