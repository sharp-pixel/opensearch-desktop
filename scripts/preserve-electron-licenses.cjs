// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

const { copyFile, mkdir, access } = require('node:fs/promises');
const path = require('node:path');

// electron-builder removes the top-level runtime notices when creating a macOS
// app. Preserve the exact notices from the extracted runtime before that step.
module.exports = async function preserveElectronLicenses(context) {
  const isMac = ['darwin', 'mas'].includes(context.electronPlatformName);
  const resources = isMac
    ? path.join(context.appOutDir, context.packager.info.framework.distMacOsAppName, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const destination = path.join(resources, 'licenses', 'electron');
  await mkdir(destination, { recursive: true });
  let license = path.join(context.appOutDir, 'LICENSE.electron.txt');
  try { await access(license); }
  catch { license = path.join(context.appOutDir, 'LICENSE'); }
  // Missing notices must fail packaging, including when using a custom runtime.
  await copyFile(license, path.join(destination, 'LICENSE.electron.txt'));
  await copyFile(path.join(context.appOutDir, 'LICENSES.chromium.html'), path.join(destination, 'LICENSES.chromium.html'));
};
