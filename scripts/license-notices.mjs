// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = join(root, 'licenses/distribution');
const read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path));
const hash = data => createHash('sha256').update(data).digest('hex');
const packageInfo = json('package.json');
const lock = json('package-lock.json');
const inputs = ['package-lock.json', 'src-tauri/Cargo.lock', 'src-tauri/Cargo.toml', 'LICENSE', 'NOTICE',
  'scripts/license-notices.mjs', 'licenses/supplements.json',
  'src/components/Icons/bootstrap-icons.LICENSE', 'src/protobuf/LICENSE.txt', 'src/protobuf/NOTICE.txt'];
const inputHashes = () => Object.fromEntries(inputs.map(path => [path, hash(read(path))]));
// Capture dependency roots separately: unrelated npm script edits do not stale the inventory.
const npmRoots = () => ({ ...packageInfo.dependencies, 'monaco-editor': packageInfo.devDependencies['monaco-editor'] });
const documents = new Map();
const records = [];
function addDocument(label, data) {
  const id = hash(data);
  if (!documents.has(id)) documents.set(id, data.toString('utf8'));
  return { file: label, sha256: id };
}
function noticeFiles(directory) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'target'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...noticeFiles(path));
    else if (entry.isFile() && /^(licen[cs]e|copying|copyright|notice|third[-_]?party[-_]?notices?)([._-]|$)/i.test(entry.name)) paths.push(path);
  }
  return paths.sort();
}
function collectDocuments(directory) {
  return noticeFiles(directory).map(path => addDocument(relative(directory, path).replaceAll('\\', '/'), readFileSync(path)));
}
function collectNpm() {
  const seen = new Set();
  function visit(name, base, optional = false) {
    let directory = base;
    let location;
    while (directory === root || directory.startsWith(`${root}${sep}`)) {
      const candidate = join(directory, 'node_modules', name);
      if (existsSync(join(candidate, 'package.json'))) { location = candidate; break; }
      const parent = dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    if (!location) {
      if (optional) return;
      throw new Error(`Missing npm dependency ${name} from ${base}; run npm ci.`);
    }
    if (seen.has(location)) return;
    seen.add(location);
    const info = JSON.parse(readFileSync(join(location, 'package.json')));
    const lockPath = relative(root, location).replaceAll('\\', '/');
    const locked = lock.packages[lockPath];
    if (!locked || info.version !== locked.version) throw new Error(`Installed/locked version mismatch: ${lockPath}`);
    const notices = collectDocuments(location);
    if (!notices.length) throw new Error(`No license documents found for ${info.name}@${info.version}`);
    records.push({ ecosystem: 'npm', name: info.name, version: info.version, license: locked.license,
      path: lockPath, source: locked.resolved, integrity: locked.integrity, notices });
    for (const dependency of Object.keys(info.dependencies ?? {})) visit(dependency, location, dependency in (info.optionalDependencies ?? {}));
    for (const dependency of Object.keys(info.optionalDependencies ?? {})) visit(dependency, location, true);
    for (const dependency of Object.keys(info.peerDependencies ?? {})) visit(dependency, location, info.peerDependenciesMeta?.[dependency]?.optional === true);
  }
  for (const name of Object.keys(npmRoots())) visit(name, root);
}
function fontNotices(directory) {
  const result = [];
  for (const name of readdirSync(directory).filter(name => name.endsWith('.ttf')).sort()) {
    const data = readFileSync(join(directory, name));
    const strings = new Set();
    for (let i = 0; i < data.readUInt16BE(4); i++) {
      const table = 12 + i * 16;
      if (data.toString('ascii', table, table + 4) !== 'name') continue;
      const offset = data.readUInt32BE(table + 8);
      const base = offset + data.readUInt16BE(offset + 4);
      for (let j = 0; j < data.readUInt16BE(offset + 2); j++) {
        const record = offset + 6 + j * 12;
        const platform = data.readUInt16BE(record);
        if (![0, 13, 14].includes(data.readUInt16BE(record + 6))) continue;
        const start = base + data.readUInt16BE(record + 10);
        const bytes = Buffer.from(data.subarray(start, start + data.readUInt16BE(record + 8)));
        strings.add(platform === 0 || platform === 3 ? bytes.swap16().toString('utf16le') : bytes.toString('latin1'));
      }
    }
    if (!strings.size) throw new Error(`Missing embedded font attribution: ${name}`);
    result.push(`${name}\n${[...strings].sort().join('\n\n')}`);
  }
  if (!result.length) throw new Error('KaTeX font files not found.');
  return addDocument('KaTeX font name-table attribution', Buffer.from(result.join('\n\n')));
}
function generate() {
  mkdirSync(output, { recursive: true });
  rmSync(join(output, 'sources'), { recursive: true, force: true });
  collectNpm();
  const supplements = json('licenses/supplements.json');
  function supplementDocument(doc) {
    const data = read(`licenses/supplemental/${doc.sha256}.txt`);
    if (hash(data) !== doc.sha256) throw new Error(`Supplement checksum mismatch: ${doc.url}`);
    return { ...addDocument(doc.file ?? doc.id, data), source: doc.url };
  }
  const standard = id => supplementDocument(supplements.standards.find(item => item.id === id));
  records.push({ ecosystem: 'asset', name: 'KaTeX fonts', version: packageInfo.dependencies.katex,
    license: 'OFL-1.1', source: 'Embedded copyright and license records in the installed KaTeX TTF files',
    notices: [fontNotices(join(root, 'node_modules/katex/dist/fonts')), standard('OFL-1.1')] });
  const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--offline', '--format-version', '1',
    '--manifest-path', 'src-tauri/Cargo.toml'], { cwd: root, maxBuffer: 30 * 1024 * 1024, encoding: 'utf8' }));
  const cargoLock = read('src-tauri/Cargo.lock').toString();
  for (const pkg of metadata.packages.filter(pkg => pkg.source).sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, 'en'))) {
    if (!pkg.source.startsWith('registry+')) throw new Error(`Review non-registry Cargo source: ${pkg.id}`);
    const directory = dirname(pkg.manifest_path);
    const notices = collectDocuments(directory);
    let review;
    if (!notices.length) {
      const supplement = supplements.crates.find(item => item.name === pkg.name && item.version === pkg.version);
      for (const doc of supplement?.documents ?? []) notices.push(supplementDocument(doc));
      if (pkg.name === 'r-efi') notices.push(addDocument('AUTHORS', readFileSync(join(directory, 'AUTHORS'))));
      if (pkg.name === 'selectors') notices.push(standard('MPL-2.0'));
      if (pkg.name === 'sigchld') {
        notices.push(standard('MIT'));
        review = 'Upstream declares MIT and author Jack O’Connor, but supplies no license/copyright file. Standard MIT text is included; confirm attribution with upstream before publication.';
      }
    }
    if (!notices.length || !pkg.license) throw new Error(`License review required: ${pkg.name}@${pkg.version}`);
    const entry = { ecosystem: 'cargo', name: pkg.name, version: pkg.version, license: pkg.license,
      source: `https://static.crates.io/crates/${pkg.name}/${pkg.name}-${pkg.version}.crate`, notices };
    if (review) entry.review = review;
    if (pkg.name === 'r-efi') entry.selectedLicense = 'MIT';
    if (pkg.license === 'MPL-2.0') {
      const archive = resolve(directory, '../../../cache', basename(dirname(directory)), `${pkg.name}-${pkg.version}.crate`);
      const data = readFileSync(archive);
      const block = cargoLock.split('[[package]]').find(block => block.includes(`name = "${pkg.name}"\n`) && block.includes(`version = "${pkg.version}"\n`));
      const checksum = block?.match(/checksum = "([a-f0-9]+)"/)?.[1];
      if (hash(data) !== checksum) throw new Error(`Source archive checksum mismatch: ${pkg.name}`);
      entry.bundledSource = `sources/${pkg.name}-${pkg.version}.crate`;
      entry.sourceSha256 = checksum;
      mkdirSync(join(output, 'sources'), { recursive: true });
      writeFileSync(join(output, entry.bundledSource), data);
    }
    records.push(entry);
  }
  for (const [name, license, paths] of [
    ['Bootstrap Icons copied SVG paths', 'MIT', ['src/components/Icons/bootstrap-icons.LICENSE']],
    ['OpenSearch Protobufs 1.2.0', 'Apache-2.0', ['src/protobuf/LICENSE.txt', 'src/protobuf/NOTICE.txt']],
  ]) records.push({ ecosystem: 'vendored', name, license, notices: paths.map(path => addDocument(path, read(path))) });
  records.sort((a, b) => `${a.ecosystem}/${a.name}/${a.version ?? ''}/${a.path ?? ''}`.localeCompare(`${b.ecosystem}/${b.name}/${b.version ?? ''}/${b.path ?? ''}`, 'en'));
  const inventory = { formatVersion: 1, scope: 'npm application dependency closure plus Monaco; all locked Cargo packages, including build and platform-specific dependencies; copied source and fonts. Not a binary SBOM.',
    inputs: inputHashes(), npmRoots: npmRoots(), packages: records };
  const lines = ['THIRD-PARTY NOTICES', '', inventory.scope, '',
    'Package license expressions describe upstream terms. For OR expressions, alternative licenses are offered; AND terms apply together.',
    'MPL-2.0 crate source archives are provided in sources/ with their original license notices. These are unmodified upstream archives.',
    'Electron distributions must also retain Electron LICENSE and LICENSES.chromium.html beside the runtime. OS libraries and installer dependencies require platform-specific release review.', ''];
  for (const record of records) {
    lines.push(`${record.ecosystem}: ${record.name}${record.version ? `@${record.version}` : ''}`, `License: ${record.license}`);
    if (record.selectedLicense) lines.push(`Selected license: ${record.selectedLicense}`);
    if (record.source) lines.push(`Source: ${record.source}`);
    if (record.bundledSource) lines.push(`Included source: ${record.bundledSource}`);
    if (record.review) lines.push(`REVIEW: ${record.review}`);
    for (const doc of record.notices) lines.push(`Notice ${doc.sha256}: ${doc.file}${doc.source ? ` (${doc.source})` : ''}`);
    lines.push('');
  }
  for (const [id, text] of [...documents].sort(([a], [b]) => a.localeCompare(b))) lines.push(`===== Notice ${id} =====`, text, '');
  writeFileSync(join(output, 'THIRD-PARTY-NOTICES.txt'), lines.join('\n'));
  for (const name of ['LICENSE', 'NOTICE']) cpSync(join(root, name), join(output, name));
  inventory.artifacts = Object.fromEntries(['LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.txt', ...records.flatMap(record => record.bundledSource ? [record.bundledSource] : [])]
    .map(path => [path, hash(readFileSync(join(output, path)))]));
  writeFileSync(join(output, 'dependency-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
  console.log(`Generated notices for ${records.length} components with ${documents.size} distinct notice texts.`);
}
function check() {
  const inventory = json('licenses/distribution/dependency-inventory.json');
  if (JSON.stringify(inventory.inputs) !== JSON.stringify(inputHashes()) || JSON.stringify(inventory.npmRoots) !== JSON.stringify(npmRoots())) {
    throw new Error('Licensing inputs changed. Run npm run licenses:generate and review the result.');
  }
  for (const [file, digest] of Object.entries(inventory.artifacts)) {
    if (hash(readFileSync(join(output, file))) !== digest) throw new Error(`License artifact changed: ${file}`);
  }
  const supplements = json('licenses/supplements.json');
  for (const doc of [...supplements.standards, ...supplements.crates.flatMap(crate => crate.documents)]) {
    if (hash(read(`licenses/supplemental/${doc.sha256}.txt`)) !== doc.sha256) throw new Error(`Supplement checksum mismatch: ${doc.url}`);
  }
  console.log('License inventory and distribution artifacts match their inputs.');
}
const mode = process.argv[2];
if (mode === '--generate') generate();
else if (mode === '--check' || mode === '--bundle') {
  check();
  if (mode === '--bundle') cpSync(output, join(root, 'dist/licenses'), { recursive: true });
} else throw new Error('Use --generate, --check, or --bundle.');
