// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import * as domain from '../features/investigation/domain/document';
/**
 * Investigation Persistence Service
 * Handles storage operations for investigations and cluster groups
 * Requirements: 1.4, 1.5, 2.5
 */

import type {
  Investigation,
  ClusterGroup,
  InvestigationMetadata,
  InvestigationCell,
  InvestigationPPLCell,
  InvestigationMarkdownCell,
} from '../types/investigation';
import { createLogger } from '../utils/logger';

const logger = createLogger('InvestigationPersistence');

// Storage keys
export const INVESTIGATION_STORAGE_KEYS = {
  INVESTIGATIONS: 'opensearch-devtools:investigations',
  CLUSTER_GROUPS: 'opensearch-devtools:cluster-groups',
  ACTIVE_INVESTIGATION: 'opensearch-devtools:active-investigation',
} as const;

/** Compatibility factories; domain operations receive identity and time explicitly. */
export function createInvestigation(name?: string, clusterGroupId?: string): Investigation {
  const now = Date.now();
  return domain.newInvestigation(crypto.randomUUID(), name || `Investigation ${new Date(now).toLocaleDateString()}`, clusterGroupId || '', now);
}
export function createInvestigationPPLCell(): InvestigationPPLCell { return domain.newPPLCell(crypto.randomUUID(), Date.now()); }
export function createInvestigationMarkdownCell(): InvestigationMarkdownCell { return domain.newMarkdownCell(crypto.randomUUID(), Date.now()); }
export function createClusterGroup(name: string, connectionIds: string[] = []): ClusterGroup {
  return domain.newClusterGroup(crypto.randomUUID(), name, connectionIds);
}

/**
 * Save an investigation to local storage
 */
export function saveInvestigation(investigation: Investigation): void {
  try {
    const investigations = loadAllInvestigations();
    const existingIndex = investigations.findIndex((i) => i.id === investigation.id);

    const updatedInvestigation = {
      ...investigation,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      investigations[existingIndex] = updatedInvestigation;
    } else {
      investigations.push(updatedInvestigation);
    }

    localStorage.setItem(INVESTIGATION_STORAGE_KEYS.INVESTIGATIONS, JSON.stringify(investigations));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      logger.error('localStorage quota exceeded');
    } else {
      logger.error('Failed to save investigation:', error);
    }
    throw error;
  }
}

/**
 * Load an investigation by ID
 */
export function loadInvestigation(id: string): Investigation | null {
  const investigations = loadAllInvestigations();
  return investigations.find((i) => i.id === id) ?? null;
}

/**
 * Load all investigations from storage
 */
export function loadAllInvestigations(): Investigation[] {
  const data = localStorage.getItem(INVESTIGATION_STORAGE_KEYS.INVESTIGATIONS);
  if (!data) return [];

  try {
    return JSON.parse(data) as Investigation[];
  } catch {
    return [];
  }
}

/**
 * Delete an investigation
 */
export function deleteInvestigation(id: string): void {
  try {
    const investigations = loadAllInvestigations();
    const filtered = investigations.filter((i) => i.id !== id);
    localStorage.setItem(INVESTIGATION_STORAGE_KEYS.INVESTIGATIONS, JSON.stringify(filtered));
  } catch (error) {
    logger.error('Failed to delete investigation:', error);
    throw error;
  }
}

/**
 * List investigations with metadata
 */
export function listInvestigations(): InvestigationMetadata[] {
  const investigations = loadAllInvestigations();
  const clusterGroups = loadAllClusterGroups();

  return investigations.map((inv) => {
    const group = clusterGroups.find((g) => g.id === inv.clusterGroupId);
    return {
      id: inv.id,
      name: inv.name,
      clusterGroupId: inv.clusterGroupId,
      clusterGroupName: group?.name,
      cellCount: inv.cells.length,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    };
  });
}

/**
 * Save a cluster group
 */
export function saveClusterGroup(group: ClusterGroup): void {
  try {
    const groups = loadAllClusterGroups();
    const existingIndex = groups.findIndex((g) => g.id === group.id);

    if (existingIndex >= 0) {
      groups[existingIndex] = group;
    } else {
      groups.push(group);
    }

    localStorage.setItem(INVESTIGATION_STORAGE_KEYS.CLUSTER_GROUPS, JSON.stringify(groups));
  } catch (error) {
    logger.error('Failed to save cluster group:', error);
    throw error;
  }
}

/**
 * Load a cluster group by ID
 */
export function loadClusterGroup(id: string): ClusterGroup | null {
  const groups = loadAllClusterGroups();
  return groups.find((g) => g.id === id) ?? null;
}

/**
 * Load all cluster groups
 */
export function loadAllClusterGroups(): ClusterGroup[] {
  const data = localStorage.getItem(INVESTIGATION_STORAGE_KEYS.CLUSTER_GROUPS);
  if (!data) return [];

  try {
    return JSON.parse(data) as ClusterGroup[];
  } catch {
    return [];
  }
}

/**
 * Delete a cluster group
 */
export function deleteClusterGroup(id: string): void {
  try {
    const groups = loadAllClusterGroups();
    const filtered = groups.filter((g) => g.id !== id);
    localStorage.setItem(INVESTIGATION_STORAGE_KEYS.CLUSTER_GROUPS, JSON.stringify(filtered));
  } catch (error) {
    logger.error('Failed to delete cluster group:', error);
    throw error;
  }
}

/**
 * Save active investigation ID
 */
export function saveActiveInvestigationId(id: string | null): void {
  if (id) {
    localStorage.setItem(INVESTIGATION_STORAGE_KEYS.ACTIVE_INVESTIGATION, id);
  } else {
    localStorage.removeItem(INVESTIGATION_STORAGE_KEYS.ACTIVE_INVESTIGATION);
  }
}

/**
 * Load active investigation ID
 */
export function loadActiveInvestigationId(): string | null {
  return localStorage.getItem(INVESTIGATION_STORAGE_KEYS.ACTIVE_INVESTIGATION);
}

/** Compatibility API for callers using the old service exports. */
export function addCellToInvestigation(document: Investigation, cell: InvestigationCell, afterCellId?: string): Investigation {
  return domain.addCell(document, cell, Date.now(), afterCellId);
}
export function updateCellInInvestigation(document: Investigation, cellId: string, updates: Partial<InvestigationCell>): Investigation {
  return domain.updateCell(document, cellId, updates, Date.now());
}
export function deleteCellFromInvestigation(document: Investigation, cellId: string): Investigation {
  return domain.deleteCell(document, cellId, Date.now());
}
export function reorderCellsInInvestigation(document: Investigation, cellIds: string[]): Investigation {
  return domain.reorderCells(document, cellIds, Date.now());
}
