// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { releaseConfiguration, validateReleaseVersion } from '../../../scripts/prepare-updater-config.mjs';
const key = Buffer.from('untrusted comment: minisign public key\n' + Buffer.concat([Buffer.from('Ed'), Buffer.alloc(40)]).toString('base64') + '\n').toString('base64');
it('prepares signed artifacts for a stable public GitHub release endpoint', () => {
  expect(releaseConfiguration('sharp-pixel/workbench-releases', key)).toEqual({
    bundle: { createUpdaterArtifacts: true },
    plugins: { updater: { pubkey: key, endpoints: ['https://github.com/sharp-pixel/workbench-releases/releases/latest/download/latest.json'] } },
  });
});
it('rejects missing signing keys and malformed release destinations', () => {
  for (const repo of ['', 'https://github.com/owner/repo', 'owner/repo/extra', 'owner/repo?x=1']) expect(() => releaseConfiguration(repo, key)).toThrow();
  for (const invalid of ['', 'placeholder', Buffer.from('not a public key').toString('base64')]) expect(() => releaseConfiguration('owner/repo', invalid)).toThrow();
});
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
it('requires the release tag to agree with all application versions', () => {
  expect(() => validateReleaseVersion(`v${version}`)).not.toThrow();
  for (const tag of ['main', `v${version}-beta.1`, version]) expect(() => validateReleaseVersion(tag)).toThrow();
});
