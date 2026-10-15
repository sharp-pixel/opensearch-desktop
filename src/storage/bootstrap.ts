// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { configureDraftRepository, validateDraft, type WorkspaceDraft } from './drafts';
import { openWorkspaceDatabase, migrateLegacyWorkspace } from './workspaceDatabase';
import { configureNotebookRepository } from '../features/notebook/state/store';
import { configureInvestigationRepository } from '../features/investigation/state/store';
import { loadActiveNotebookId, saveActiveNotebookId } from '../services/persistence';

/** Complete and verify migration before any feature can edit workspace data. */
export async function initializeWorkspaceStorage() {
  const db = await openWorkspaceDatabase();
  try {
    await migrateLegacyWorkspace(db, localStorage);
    let [notebooks, investigations, groups] = await Promise.all([db.load('notebook', { includeOutputs: false }), db.load('investigation', { includeOutputs: false }), db.load('clusterGroup')]);
    if (!await db.migrationComplete('feature-drafts')) {
      const existing = await db.load('draft');
      const pipeline = localStorage.getItem('dataprepper-workbench-state');
      const policy = localStorage.getItem('ism-analyzer-state');
      const recent = localStorage.getItem('ism-analyzer-recent');
      const drafts: WorkspaceDraft[] = [];
      if (pipeline) {
        const { sourceData, sourceFormat, pipelineConfig } = JSON.parse(pipeline);
        drafts.push({ id: 'dataprepper', content: { sourceData, sourceFormat, pipelineConfig } });
      }
      if (policy || recent) drafts.push({ id: 'ism', content: {
        policyJson: policy ? JSON.parse(policy).policyJson : '{}', recentPolicies: recent ? JSON.parse(recent) : [],
      } });
      for (const draft of drafts) {
        validateDraft(draft);
        const previous = existing.find(value => value.id === draft.id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(draft)) throw new Error('Feature draft migration conflict; original data has been preserved');
        if (!previous) await db.save('draft', draft);
      }
      const verified = await db.load('draft');
      if (drafts.some(draft => JSON.stringify(verified.find(value => value.id === draft.id)) !== JSON.stringify(draft))) throw new Error('Feature draft migration verification failed');
      await db.finishMigration('feature-drafts');
    }
    configureDraftRepository(await db.load('draft'), record => db.save('draft', record));
    configureNotebookRepository({
      get unloadedIds() { return new Set(notebooks.filter(record => db.hasUnloadedOutputs('notebook', record.notebook.id)).map(record => record.notebook.id)); },
      async loadOutputs(id) {
        const record = await db.loadOutputs('notebook', id);
        notebooks = notebooks.map(item => item.notebook.id === id ? record : item);
        return record;
      },
      releaseOutputs(record) {
        const released = db.releaseOutputs('notebook', record);
        notebooks = notebooks.map(item => item.notebook.id === record.notebook.id ? released : item);
        return released;
      },
      loadAll: () => notebooks, activeId: loadActiveNotebookId, select: saveActiveNotebookId,
      async save(record) { await db.save('notebook', record); notebooks = [...notebooks.filter(item => item.notebook.id !== record.notebook.id), record]; },
      async remove(id) { await db.remove('notebook', id); notebooks = notebooks.filter(item => item.notebook.id !== id); },
    });
    configureInvestigationRepository({
      get unloadedIds() { return new Set(investigations.filter(record => db.hasUnloadedOutputs('investigation', record.id)).map(record => record.id)); },
      async loadOutputs(id) {
        const record = await db.loadOutputs('investigation', id);
        investigations = investigations.map(item => item.id === id ? record : item);
        return record;
      },
      releaseOutputs(record) {
        const released = db.releaseOutputs('investigation', record);
        investigations = investigations.map(item => item.id === record.id ? released : item);
        return released;
      },
      loadAllInvestigations: () => investigations, loadAllClusterGroups: () => groups,
      async saveInvestigation(value) { await db.save('investigation', value); investigations = [...investigations.filter(item => item.id !== value.id), value]; },
      async saveClusterGroup(value) { await db.save('clusterGroup', value); groups = [...groups.filter(item => item.id !== value.id), value]; },
      async deleteInvestigation(id) { await db.remove('investigation', id); investigations = investigations.filter(item => item.id !== id); },
    });
  } catch (error) { db.close(); throw error; }
}
