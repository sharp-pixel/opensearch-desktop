// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { IDBFactory } from 'fake-indexeddb';
import { expect, it } from 'vitest';
import { configureDraftRepository, getDraftStore, flushDrafts } from '../../storage/drafts';
import { openWorkspaceDatabase } from '../../storage/workspaceDatabase';

it('keeps unsaved drafts accessible across feature remounts and retries durability', async () => {
  let fail = true;
  const db = await openWorkspaceDatabase(new IDBFactory());
  configureDraftRepository([], async value => { if (fail) throw new Error('Quota exceeded'); await db.save('draft', value); });
  const initial = { id: 'ism' as const, content: { policyJson: '{}', recentPolicies: [] } };
  const store = getDraftStore(initial);
  store.update({ ...initial, content: { ...initial.content, policyJson: '{' } });
  expect(await store.flush()).toBe(false);
  expect(getDraftStore(initial)).toBe(store);
  expect(store.getSnapshot().saveError).toBe('Quota exceeded');
  expect(store.getSnapshot().record.content).toMatchObject({ policyJson: '{' });
  fail = false; await flushDrafts();
  expect((await db.load('draft'))[0]?.content).toMatchObject({ policyJson: '{' });
  expect(store.getSnapshot().saveError).toBeNull(); db.close();
});
