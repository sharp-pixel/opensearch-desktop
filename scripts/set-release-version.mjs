// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { readFileSync, writeFileSync } from 'node:fs';
const version = process.argv[2];
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? '')) throw new Error('Use a stable version: npm run release:version -- X.Y.Z');
for (const file of ['package.json', 'package-lock.json', 'src-tauri/tauri.conf.json']) {
  const data = JSON.parse(readFileSync(file, 'utf8')); data.version = version;
  if (data.packages?.['']) data.packages[''].version = version;
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8').replace(/^version = "[^"]+"/m, `version = "${version}"`);
writeFileSync('src-tauri/Cargo.toml', cargo);
const lock = readFileSync('src-tauri/Cargo.lock', 'utf8').replace(/(name = "opensearch-developer-workbench"\nversion = ")[^"]+(")/, (_match, prefix, suffix) => prefix + version + suffix);
writeFileSync('src-tauri/Cargo.lock', lock);
console.log(`Set application version to ${version}.`);
