// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureDraftRepository, flushDrafts, validateDraft, type WorkspaceDraft } from '../../storage/drafts';
import { createFeatureFileWorkspace } from '../../storage/featureFileWorkspace';
import { pipelineFileSettings, policyFileSettings } from '../../services/featureFileSettings';
import type { DocumentFile, DocumentFileAccess } from '../../platform/contracts';
import type { PipelineDocument } from '../../features/dataprepper/domain/document';

const pipeline: PipelineDocument = { sourceData: '{"original":true}', sourceFormat: 'json', pipelineConfig: 'logs:\n  processor: []' };
const policy = '{"policy":{"default_state":"hot","states":[{"name":"hot","actions":[]}]}}';
let saved: WorkspaceDraft[];
beforeEach(() => { localStorage.clear(); saved = []; configureDraftRepository([], async record => { saved = [structuredClone(record)]; }); });
afterEach(async () => { await flushDrafts(); localStorage.clear(); });
function files(content: string): DocumentFileAccess {
  return { open: vi.fn().mockResolvedValue({ path: '/project/document.json', name: 'document.json', revision: 'disk', content }),
    read: vi.fn().mockResolvedValue({ path: '/project/document.json', name: 'document.json', revision: 'disk', content }),
    save: vi.fn().mockImplementation(request => Promise.resolve({ path: request.path ?? '/project/saved.json', name: 'saved.json', revision: 'written', content: request.content })) };
}

describe.each(['pipeline', 'policy'] as const)('%s files', kind => {
  const setup = () => kind === 'pipeline'
    ? createFeatureFileWorkspace(pipelineFileSettings(pipeline), files(JSON.stringify(pipeline)))
    : createFeatureFileWorkspace(policyFileSettings(policy), files(policy));
  it('preserves the previous draft when creating and opening documents, and recovers them after restart', async () => {
    const workspace = setup();
    const original = workspace.getSnapshot().active;
    workspace.newDocument();
    await workspace.openFile();
    expect(workspace.getSnapshot().documents).toHaveLength(3);
    expect(workspace.getSnapshot().documents[0]).toEqual(original);
    await workspace.retrySave();
    expect(saved).toHaveLength(1);
    validateDraft(saved[0]);
    configureDraftRepository(saved, async () => {});
    const recovered = setup();
    expect(recovered.getSnapshot().documents).toEqual(workspace.getSnapshot().documents);
    expect(recovered.getSnapshot().active!.file).toMatchObject({ path: '/project/document.json', dirty: false });
  });
  it('keeps recent history separate from recovery drafts and uses separate history keys', async () => {
    const workspace = setup();
    await workspace.openFile();
    workspace.forgetRecentFile('/project/document.json');
    expect(workspace.getSnapshot().recentFiles).toEqual([]);
    expect(workspace.getSnapshot().documents).toHaveLength(2);
    workspace.removeDraft(workspace.getSnapshot().active!.id);
    expect(workspace.getSnapshot().documents).toHaveLength(1);
  });
  it('reopens dirty recovery instead of replacing it from disk', async () => {
    const access = files(kind === 'pipeline' ? JSON.stringify(pipeline) : policy);
    if (kind === 'pipeline') {
      const workspace = createFeatureFileWorkspace(pipelineFileSettings(pipeline), access);
      await workspace.openFile(); workspace.update({ sourceData: 'edited' }); workspace.newDocument();
      await workspace.openFile('/project/document.json');
      expect(workspace.getSnapshot().active!.content.sourceData).toBe('edited');
    } else {
      const workspace = createFeatureFileWorkspace(policyFileSettings(policy), access);
      await workspace.openFile(); workspace.update(() => 'edited'); workspace.newDocument();
      await workspace.openFile('/project/document.json');
      expect(workspace.getSnapshot().active!.content).toBe('edited');
    }
    expect(access.read).not.toHaveBeenCalled();
  });
  it('does not replace the active draft on invalid or cancelled Open', async () => {
    const access = files('[]');
    const workspace = kind === 'pipeline' ? createFeatureFileWorkspace(pipelineFileSettings(pipeline), access) : createFeatureFileWorkspace(policyFileSettings(policy), access);
    const original = workspace.getSnapshot().active;
    expect(await workspace.openFile()).toBeNull();
    expect(workspace.getSnapshot().fileError).toBeTruthy();
    expect(workspace.getSnapshot().active).toBe(original);
    vi.mocked(access.open).mockResolvedValue(null);
    expect(await workspace.openFile()).toBeNull();
    expect(workspace.getSnapshot().active).toBe(original);
    expect(workspace.getSnapshot().fileBusy).toBe(false);
  });
});

it('pipeline Save follows the selected path, passes revisions, and preserves edits made during a pending save', async () => {
  const access = files(JSON.stringify(pipeline));
  const workspace = createFeatureFileWorkspace(pipelineFileSettings(pipeline), access);
  await workspace.openFile();
  let complete!: (value: DocumentFile) => void;
  vi.mocked(access.save).mockImplementation(request => new Promise(resolve => { complete = value => resolve({ ...value, content: request.content }); }));
  const saving = workspace.saveFile();
  workspace.update({ sourceData: 'edited while saving' });
  expect(await workspace.saveFile()).toBe(false);
  complete({ path: '/project/document.json', name: 'document.json', revision: 'new', content: '' });
  await saving;
  expect(access.save).toHaveBeenCalledWith(expect.objectContaining({ path: '/project/document.json', expectedRevision: 'disk' }));
  expect(workspace.getSnapshot().active!.file).toMatchObject({ dirty: true, revision: 'new' });
  expect(workspace.getSnapshot().active!.content.sourceData).toBe('edited while saving');
  const written = JSON.parse(vi.mocked(access.save).mock.calls[0]![0].content);
  expect(written).toEqual(pipeline);
  expect(written.fileWorkspace).toBeUndefined();
});

it('Save As selects another path and string errors preserve policy recovery', async () => {
  const access = files(policy);
  const workspace = createFeatureFileWorkspace(policyFileSettings(policy), access);
  await workspace.openFile();
  workspace.update(() => policy.replace('hot', 'warm'));
  vi.mocked(access.save).mockRejectedValue('File changed on disk. Use Save As.');
  expect(await workspace.saveFile()).toBe(false);
  expect(workspace.getSnapshot().fileError).toContain('File changed on disk');
  expect(workspace.getSnapshot().active!.file?.dirty).toBe(true);
  vi.mocked(access.save).mockImplementation(request => Promise.resolve({ path: '/project/copy.json', name: 'copy.json', revision: 'copy', content: request.content }));
  expect(await workspace.saveFile(true)).toBe(true);
  expect(vi.mocked(access.save).mock.calls.slice(-1)[0]![0].path).toBeUndefined();
  expect(workspace.getSnapshot().active!.file).toMatchObject({ path: '/project/copy.json', dirty: false });
  expect(JSON.parse(vi.mocked(access.save).mock.calls.slice(-1)[0]![0].content)).toHaveProperty('policy');
});

it('migrates old recent ISM policy copies into recoverable documents without duplicates', async () => {
  configureDraftRepository([{ id: 'ism', content: { policyJson: policy, recentPolicies: [
    { id: 'a', name: 'Older policy', policy: policy.replace(/hot/g, 'warm'), timestamp: 2 },
    { id: 'a', name: 'Duplicate', policy: policy.replace(/hot/g, 'warm'), timestamp: 1 },
    { id: 'current', name: 'Current', policy, timestamp: 0 },
  ] } }], async record => { saved = [record]; });
  const workspace = createFeatureFileWorkspace(policyFileSettings(policy), files(policy));
  expect(workspace.getSnapshot().documents).toHaveLength(2);
  const older = workspace.getSnapshot().documents.find(item => item.name === 'Older policy')!;
  workspace.selectId(older.id);
  expect(workspace.getSnapshot().active!.content).toContain('warm');
  await workspace.retrySave();
  validateDraft(saved[0]);
});

it('uses defaults for legacy partial pipeline imports instead of inheriting previous document fields', async () => {
  const workspace = createFeatureFileWorkspace(pipelineFileSettings(pipeline), files('{"pipelineConfig":"new"}'));
  workspace.update({ sourceData: 'previous document' });
  await workspace.openFile();
  expect(workspace.getSnapshot().active!.content).toEqual({ ...pipeline, pipelineConfig: 'new' });
});

it('browser copies remain unsaved documents and invalid policy JSON cannot download', async () => {
  const access = files(policy);
  vi.mocked(access.open).mockResolvedValue({ path: null, name: 'policy.json', revision: '', content: policy });
  vi.mocked(access.save).mockImplementation(request => Promise.resolve({ path: null, name: 'policy.json', revision: '', content: request.content }));
  const workspace = createFeatureFileWorkspace(policyFileSettings(policy), access);
  await workspace.openFile(); await workspace.saveFile();
  expect(workspace.getSnapshot().recentFiles).toEqual([]);
  expect(workspace.getSnapshot().active!.file?.path).toBeNull();
  expect(workspace.getSnapshot().fileNotice).toContain('Download started');
  workspace.update(() => '{invalid');
  expect(await workspace.saveFile()).toBe(false);
  expect(access.save).toHaveBeenCalledOnce();
});

it('rejects corrupted recovery file bindings and duplicate draft identities', () => {
  expect(() => validateDraft({ id: 'ism', content: { policyJson: policy, recentPolicies: [], fileWorkspace: {
    version: 1, activeId: 'a', documents: [{ id: 'a', name: 'A', updatedAt: 1, content: policy, file: { path: 123 } }],
  } } })).toThrow('Invalid feature draft');
});

describe.each(['pipeline', 'policy'] as const)('%s draft deletion', kind => {
  function setup(access: DocumentFileAccess) {
    return kind === 'pipeline' ? createFeatureFileWorkspace(pipelineFileSettings(pipeline), access)
      : createFeatureFileWorkspace(policyFileSettings(policy), access);
  }
  it('allows every draft to be deleted and persists the empty workspace across a restart', async () => {
    const access = files(kind === 'pipeline' ? JSON.stringify(pipeline) : policy);
    const workspace = setup(access);
    workspace.newDocument();
    await workspace.openFile();
    const history = workspace.getSnapshot().recentFiles;
    for (const draft of [...workspace.getSnapshot().documents]) workspace.removeDraft(draft.id);
    expect(workspace.getSnapshot().documents).toEqual([]);
    expect(workspace.getSnapshot().active).toBeNull();
    expect(workspace.getSnapshot().recentFiles).toEqual(history);
    expect(await workspace.saveFile()).toBe(false);
    expect(access.save).not.toHaveBeenCalled();
    await workspace.retrySave();
    validateDraft(saved[0]);
    expect(saved[0]!.content.fileWorkspace).toMatchObject({ activeId: null, documents: [] });
    configureDraftRepository(saved, async record => { saved = [structuredClone(record)]; });
    const restarted = setup(access);
    expect(restarted.getSnapshot().documents).toEqual([]);
    expect(restarted.getSnapshot().active).toBeNull();
    restarted.newDocument();
    expect(restarted.getSnapshot().documents).toHaveLength(1);
    expect(restarted.getSnapshot().active).not.toBeNull();
  });
  it('can open a recent file after discarding the last recovery draft', async () => {
    const access = files(kind === 'pipeline' ? JSON.stringify(pipeline) : policy);
    const workspace = setup(access);
    const initialId = workspace.getSnapshot().active!.id;
    await workspace.openFile();
    workspace.removeDraft(initialId);
    workspace.removeDraft(workspace.getSnapshot().active!.id);
    expect(workspace.getSnapshot().active).toBeNull();
    await workspace.openFile('/project/document.json');
    expect(workspace.getSnapshot().documents).toHaveLength(1);
    expect(workspace.getSnapshot().active!.file).toMatchObject({ path: '/project/document.json', dirty: false });
  });
});

it('accepts empty recovery workspaces but rejects a dangling active document ID', () => {
  const content = { policyJson: policy, recentPolicies: [], fileWorkspace: { version: 1, activeId: null, documents: [] } };
  expect(() => validateDraft({ id: 'ism', content })).not.toThrow();
  expect(() => validateDraft({ id: 'ism', content: { ...content, fileWorkspace: { ...content.fileWorkspace, activeId: 'deleted' } } })).toThrow();
});
