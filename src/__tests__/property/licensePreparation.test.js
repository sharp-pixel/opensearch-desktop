// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

// @vitest-environment node

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { expectedHeader, hasLicenseHeader } from '../../../scripts/check-license-headers.mjs';
import preserveElectronLicenses from '../../../scripts/preserve-electron-licenses.cjs';

const root = resolve(import.meta.dirname, '../../..');
const temporaryDirectories = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'workbench-license-check-'));
  temporaryDirectories.push(directory);
  const inventory = JSON.parse(readFileSync(join(root, 'licenses/distribution/dependency-inventory.json')));
  for (const file of [...Object.keys(inventory.inputs), 'package.json']) {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    cpSync(join(root, file), join(directory, file));
  }
  cpSync(join(root, 'licenses'), join(directory, 'licenses'), { recursive: true });
  return directory;
}
function check(directory, mode = '--check') {
  return spawnSync(process.execPath, ['scripts/license-notices.mjs', mode], { cwd: directory, encoding: 'utf8' });
}
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('license distribution safeguards', () => {
  it.each(['darwin', 'linux', 'win32'])('preserves exact runtime notices before %s packaging', async platform => {
    const directory = mkdtempSync(join(tmpdir(), 'workbench-electron-notices-'));
    temporaryDirectories.push(directory);
    const licenseName = platform === 'darwin' ? 'LICENSE' : 'LICENSE.electron.txt';
    writeFileSync(join(directory, licenseName), 'Electron runtime license');
    writeFileSync(join(directory, 'LICENSES.chromium.html'), '<html>Chromium notices</html>');
    const context = { appOutDir: directory, electronPlatformName: platform,
      packager: { info: { framework: { distMacOsAppName: 'Electron.app' } } } };
    await preserveElectronLicenses(context);
    const resources = platform === 'darwin' ? 'Electron.app/Contents/Resources' : 'resources';
    expect(readFileSync(join(directory, resources, 'licenses/electron/LICENSE.electron.txt'), 'utf8')).toBe('Electron runtime license');
    expect(readFileSync(join(directory, resources, 'licenses/electron/LICENSES.chromium.html'), 'utf8')).toBe('<html>Chromium notices</html>');
    rmSync(join(directory, 'LICENSES.chromium.html'));
    await expect(preserveElectronLicenses(context)).rejects.toThrow();
  });

  it('accepts current artifacts and bundles their source archives with the frontend', () => {
    const directory = fixture();
    const result = check(directory, '--bundle');
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const inventory = JSON.parse(readFileSync(join(directory, 'dist/licenses/dependency-inventory.json')));
    const sources = inventory.packages.filter(pkg => pkg.license === 'MPL-2.0');
    expect(sources.length).toBeGreaterThan(0);
    for (const pkg of sources) {
      expect(readFileSync(join(directory, 'dist/licenses', pkg.bundledSource)))
        .toEqual(readFileSync(join(root, 'licenses/distribution', pkg.bundledSource)));
    }
  });

  it('rejects an inventory after dependency changes', () => {
    const directory = fixture();
    const path = join(directory, 'package-lock.json');
    const lock = JSON.parse(readFileSync(path));
    lock.packages['node_modules/react'].version = '0.0.0';
    writeFileSync(path, JSON.stringify(lock));
    const result = check(directory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Licensing inputs changed');
  });

  it('rejects tampered attribution and missing source archives', () => {
    const directory = fixture();
    const notices = join(directory, 'licenses/distribution/THIRD-PARTY-NOTICES.txt');
    const original = readFileSync(notices);
    writeFileSync(notices, 'Removed notices');
    expect(check(directory).stderr).toContain('License artifact changed');
    writeFileSync(notices, original);
    const inventory = JSON.parse(readFileSync(join(directory, 'licenses/distribution/dependency-inventory.json')));
    const source = inventory.packages.find(pkg => pkg.bundledSource).bundledSource;
    rmSync(join(directory, 'licenses/distribution', source));
    expect(check(directory).status).not.toBe(0);
  });

  it('requires complete project headers while retaining upstream sidecars', () => {
    expect(hasLicenseHeader('example.ts', '// SPDX-License-Identifier: Apache-2.0\n')).toBe(false);
    expect(hasLicenseHeader('example.ts', expectedHeader('example.ts') + '\nexport {};')).toBe(true);
    expect(hasLicenseHeader('example.html', '<!doctype html>\n' + expectedHeader('example.html') + '\n')).toBe(true);
    expect(hasLicenseHeader('example.py', '#!/usr/bin/env python3\n' + expectedHeader('example.py') + '\n')).toBe(true);
    const mixed = 'src/components/Icons/VisibilityIcon.tsx';
    expect(hasLicenseHeader(mixed, expectedHeader('example.ts'))).toBe(false);
    expect(hasLicenseHeader(mixed, expectedHeader(mixed))).toBe(true);
    const schema = 'src/protobuf/opensearch-1.2.0.proto';
    expect(hasLicenseHeader(schema, readFileSync(join(root, `${schema}.license`), 'utf8'))).toBe(true);
  });
});
