// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.rs', '.css', '.scss', '.html', '.yml', '.yaml', '.toml', '.xml', '.sh', '.py', '.proto']);
// These files combine project code with Bootstrap SVG paths. Both licenses apply.
const bootstrapFiles = new Set([
  'src/components/ConnectionSelector.tsx',
  'src/components/FeatureSelector.tsx',
  'src/components/Icons/VisibilityIcon.tsx',
  'src/components/Layout/FeatureTabs.tsx',
  'src/components/Layout/WorkbenchHeader.tsx',
  'src/features/dataprepper/ui/OutputPanel.tsx',
  'src/features/investigation/ui/Charts/ChartPanel.tsx',
  'src/features/investigation/ui/Charts/Histogram.tsx',
  'src/features/investigation/ui/ClusterSelector.tsx',
  'src/features/investigation/ui/InvestigationCellList.tsx',
  'src/features/investigation/ui/InvestigationSelector.tsx',
  'src/features/investigation/ui/InvestigationWorkspace.tsx',
  'src/features/ism/ui/ISMPolicyAnalyzer.tsx',
  'src/features/ism/ui/StateDiagram.tsx',
  'src/features/notebook/ui/cells/CellList.tsx',
  'src/features/notebook/ui/cells/QueryCell.tsx',
]);
const upstreamFiles = new Set(['src/protobuf/opensearch-1.2.0.proto']);

export function expectedHeader(file) {
  const expression = bootstrapFiles.has(file) ? 'Apache-2.0 AND MIT' : 'Apache-2.0';
  const identifier = `SPDX-License-Identifier: ${expression}`;
  if (upstreamFiles.has(file)) return identifier;
  const lines = [
    'Copyright OpenSearch Contributors',
    identifier,
    '',
    'The OpenSearch Contributors require contributions made to',
    'this file be licensed under the Apache-2.0 license or a',
    'compatible open source license.',
  ];
  if (bootstrapFiles.has(file)) lines.push('', 'Includes Bootstrap Icons; see src/components/Icons/bootstrap-icons.LICENSE.');
  const extension = extname(file);
  if (['.html', '.xml'].includes(extension)) return `<!--\n${lines.join('\n')}\n-->`;
  if (['.css', '.scss'].includes(extension)) return `/*\n${lines.map(line => line ? ` * ${line}` : ' *').join('\n')}\n */`;
  const prefix = ['.yml', '.yaml', '.toml', '.sh', '.py'].includes(extension) ? '#' : '//';
  return lines.map(line => line ? `${prefix} ${line}` : prefix).join('\n');
}

export function hasLicenseHeader(file, content) {
  // Preserve interpreter directives, XML declarations and the HTML doctype.
  // Rust's #![...] is an attribute, not an interpreter directive.
  const body = content.replace(/^\uFEFF/, '').replace(/^(?:#![^\[\r\n][^\r\n]*|<\?xml[^\r\n]*\?>|<!doctype[^\r\n]*>)\r?\n/i, '');
  const normalized = body.replace(/\r\n/g, '\n');
  const header = expectedHeader(file);
  return normalized === header || normalized.startsWith(`${header}\n`);
}

function main() {
  const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0'))]
    .filter(file => extensions.has(extname(file)) && existsSync(resolve(root, file)));
  const failures = [];
  for (const file of files) {
    const location = upstreamFiles.has(file) ? `${file}.license` : file;
    if (!existsSync(resolve(root, location)) || !hasLicenseHeader(file, readFileSync(resolve(root, location), 'utf8'))) {
      failures.push(`${location}: expected ${expectedHeader(file)}`);
    }
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`SPDX headers verified for ${files.length} source/configuration files (including upstream sidecars).`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
