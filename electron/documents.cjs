// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const MAX_BYTES = 100 * 1024 * 1024;
const revision = bytes => createHash('sha256').update(bytes).digest('hex');

async function atomicWrite(filename, bytes) {
  const temporary = path.join(path.dirname(filename), `.workbench-${randomUUID()}.tmp`);
  let file;
  try {
    let mode = 0o600;
    try { mode = (await fs.stat(filename)).mode; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    file = await fs.open(temporary, 'wx', mode);
    await file.writeFile(bytes);
    await file.sync();
    await file.close(); file = null;
    await fs.rename(temporary, filename);
  } finally {
    if (file) await file.close();
    await fs.rm(temporary, { force: true });
  }
}

function createDocumentFiles({ dialog, getWindow, registryPath }) {
  const loading = fs.readFile(registryPath, 'utf8').then(text => {
    const paths = JSON.parse(text);
    return new Set(Array.isArray(paths) ? paths.filter(p => typeof p === 'string' && path.isAbsolute(p)) : []);
  }).catch(() => new Set());
  let saving = Promise.resolve();
  async function grant(filename) {
    const paths = await loading;
    const next = new Set([...paths, filename]);
    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await atomicWrite(registryPath, JSON.stringify([...next]));
    paths.add(filename);
  }
  async function authorized(filename) {
    if (typeof filename !== 'string' || !(await loading).has(filename)) throw new Error('Locate this file with Open before accessing it.');
    let resolved;
    try { resolved = await fs.realpath(filename); }
    catch { throw new Error('File unavailable. Locate it again.'); }
    if (resolved !== filename) throw new Error('File location changed. Locate it again.');
    return filename;
  }
  async function read(filename) {
    const metadata = await fs.stat(filename);
    if (!metadata.isFile()) throw new Error('Choose a regular JSON file.');
    if (metadata.size > MAX_BYTES) throw new Error('Document files must be smaller than 100 MiB.');
    const bytes = await fs.readFile(filename);
    return { path: filename, name: path.basename(filename), content: new TextDecoder('utf-8', { fatal: true }).decode(bytes), revision: revision(bytes) };
  }
  const serial = operation => {
    const pending = saving.then(operation);
    saving = pending.catch(() => {});
    return pending;
  };
  return {
    open: options => serial(async () => {
      const result = await dialog.showOpenDialog(getWindow(), { title: typeof options?.title === 'string' ? options.title : 'Open notebook', properties: ['openFile'], filters: [{ name: 'JSON documents', extensions: ['json'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      const filename = await fs.realpath(result.filePaths[0]);
      const document = await read(filename);
      await grant(filename);
      return document;
    }),
    read: async filename => read(await authorized(filename)),
    save: request => serial(async () => {
      if (!request || typeof request.content !== 'string' || typeof request.suggestedName !== 'string') throw new Error('Invalid save request.');
      const bytes = Buffer.from(request.content, 'utf8');
      if (bytes.length > MAX_BYTES) throw new Error('Document files must be smaller than 100 MiB.');
      JSON.parse(request.content);
      let filename;
      if (request.path !== undefined) {
        filename = await authorized(request.path);
        if ((await read(filename)).revision !== request.expectedRevision) throw new Error('File changed on disk. Open it again or use Save As to preserve your changes.');
      } else {
        const result = await dialog.showSaveDialog(getWindow(), { title: typeof request.title === 'string' ? request.title : 'Save notebook as', defaultPath: path.basename(request.suggestedName), filters: [{ name: 'JSON documents', extensions: ['json'] }] });
        if (result.canceled || !result.filePath) return null;
        if (path.extname(result.filePath).toLowerCase() !== '.json') throw new Error('Choose a filename ending in .json.');
        try { filename = await fs.realpath(result.filePath); }
        catch (error) {
          if (error.code !== 'ENOENT') throw error;
          filename = path.join(await fs.realpath(path.dirname(result.filePath)), path.basename(result.filePath));
        }
        await grant(filename);
      }
      await atomicWrite(filename, bytes);
      return { path: filename, name: path.basename(filename), content: request.content, revision: revision(bytes) };
    }),
  };
}

module.exports = { createDocumentFiles, atomicWrite };
