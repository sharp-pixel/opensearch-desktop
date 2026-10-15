// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

// @vitest-environment node
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, rm, readdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DocumentFileAccess } from '../../platform/contracts';
const require = createRequire(import.meta.url);
const { createDocumentFiles, atomicWrite } = require('../../../electron/documents.cjs');
let directory: string;
let filename: string;
let registryPath: string;
let files: DocumentFileAccess;
const dialog = { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() };

beforeEach(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'workbench-documents-')));
  filename = join(directory, 'notebook.json');
  registryPath = join(directory, 'access.json');
  await writeFile(filename, '{"version":"original"}');
  dialog.showOpenDialog.mockReset().mockResolvedValue({ canceled: false, filePaths: [filename] });
  dialog.showSaveDialog.mockReset().mockResolvedValue({ canceled: false, filePath: join(directory, 'new.json') });
  files = createDocumentFiles({ dialog, getWindow: () => undefined, registryPath });
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

it('allows access only after a native selection and remembers it across restarts', async () => {
  await expect(files.read(filename)).rejects.toThrow('Locate this file');
  const opened = await files.open();
  expect(opened).toMatchObject({ path: filename, name: 'notebook.json', content: '{"version":"original"}' });
  expect(opened!.revision).toMatch(/^[a-f0-9]{64}$/);
  expect(await files.read(filename)).toEqual(opened);
  const restarted: DocumentFileAccess = createDocumentFiles({ dialog, getWindow: () => undefined, registryPath });
  expect(await restarted.read(filename)).toEqual(opened);
  await expect(restarted.read(join(directory, 'other.json'))).rejects.toThrow('Locate this file');
});

it('saves atomically to the selected location and overwrites using the last revision', async () => {
  const saved = await files.save({ suggestedName: 'new.notebook.json', content: '{"saved":true}' });
  expect(saved!.path).toBe(join(directory, 'new.json'));
  expect(await readFile(saved!.path!, 'utf8')).toBe('{"saved":true}');
  const updated = await files.save({ path: saved!.path!, expectedRevision: saved!.revision, suggestedName: saved!.name, content: '{"updated":true}' });
  expect(updated!.revision).not.toBe(saved!.revision);
  expect(dialog.showSaveDialog).toHaveBeenCalledOnce();
  expect((await readdir(directory)).some(name => name.endsWith('.tmp'))).toBe(false);
});

it('rejects external changes and preserves both the disk content and save revision', async () => {
  const opened = await files.open();
  await writeFile(filename, '{"external":true}');
  await expect(files.save({ path: filename, expectedRevision: opened!.revision, suggestedName: 'notebook.json', content: '{"local":true}' })).rejects.toThrow('File changed on disk');
  expect(await readFile(filename, 'utf8')).toBe('{"external":true}');
  await expect(files.save({ path: filename, suggestedName: 'notebook.json', content: '{}' })).rejects.toThrow('File changed on disk');
});

it('cancelling dialogs creates no files or access grants', async () => {
  dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
  dialog.showSaveDialog.mockResolvedValue({ canceled: true });
  expect(await files.open()).toBeNull();
  expect(await files.save({ suggestedName: 'new.json', content: '{}' })).toBeNull();
  expect(await readdir(directory)).toEqual(['notebook.json']);
});

it('missing recent files fail with locate guidance and invalid saves preserve existing content', async () => {
  const opened = await files.open();
  await expect(files.save({ path: filename, expectedRevision: opened!.revision, suggestedName: 'notebook.json', content: '{invalid' })).rejects.toThrow();
  expect(await readFile(filename, 'utf8')).toBe(opened!.content);
  await rm(filename);
  await expect(files.read(filename)).rejects.toThrow('Locate it again');
});

it('a failed atomic write removes temporary files and preserves existing destinations', async () => {
  const existing = await readFile(filename, 'utf8');
  await expect(atomicWrite(directory, '{}')).rejects.toThrow();
  expect(await readFile(filename, 'utf8')).toBe(existing);
  expect((await readdir(directory)).some(name => name.endsWith('.tmp'))).toBe(false);
});

it('rejects unsupported save extensions without writing a different unconfirmed destination', async () => {
  dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: join(directory, 'unexpected.txt') });
  await expect(files.save({ suggestedName: 'new.json', content: '{}' })).rejects.toThrow('ending in .json');
  expect(await readdir(directory)).toEqual(['notebook.json']);
});
it('uses view-specific titles with the shared JSON picker', async () => {
  await files.open({ title: 'Open policy' });
  expect(dialog.showOpenDialog).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ title: 'Open policy', filters: [{ name: 'JSON documents', extensions: ['json'] }] }));
  await files.save({ title: 'Save investigation as', suggestedName: 'investigation.json', content: '{}' });
  expect(dialog.showSaveDialog).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ title: 'Save investigation as' }));
});
