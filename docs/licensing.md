# Licensing and attribution

Project code is Apache-2.0, as declared in `LICENSE`, `package.json`, and
`src-tauri/Cargo.toml`. `NOTICE` records project and copied-source attribution.
Third-party code, fonts, and artwork retain their own terms.

## Source headers

Project source, tests, scripts, stylesheets, HTML, and YAML/TOML/XML configuration
use the [OpenSearch contribution-header convention](https://github.com/opensearch-project/.github/blob/main/CONTRIBUTING.md#license-headers),
adapted to the file's comment syntax:

```ts
// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.
```

Use `#` for YAML/TOML and scripts that require it, a block comment for CSS,
and an XML comment for HTML/XML. Keep shebangs, XML declarations, and HTML
doctypes first. Existing documentation and notices follow the header.

Files with Bootstrap Icons paths retain `Apache-2.0 AND MIT`, plus a reference to
`src/components/Icons/bootstrap-icons.LICENSE`. This expresses the separate
project-code and icon obligations, not a choice of licenses. Update the file
list in `scripts/check-license-headers.mjs` when moving or adding copied icons.

The vendored Protobuf schema stays byte-for-byte unmodified. Its adjacent
`.license` sidecar records SPDX metadata; the upstream license and notice remain
in `src/protobuf/` and are included in distribution notices.

`npm run lint:licenses` checks the complete headers and the schema sidecar.
It covers tracked and new, non-ignored source files. It does not add comments to
JSON, lockfiles, upstream license documents, prose, or image assets, and is not
a full REUSE compliance audit.

## Dependency inventory and notice generation

```sh
npm ci
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
npm run licenses:generate
npm run licenses:check
```

Generation uses installed npm packages and Cargo's offline, locked metadata.
It does not change dependency versions. Cargo's cache must contain all locked
platform dependencies, not just the current host. The generated files under
`licenses/distribution/` are committed so ordinary frontend builds and license
checks do not require Rust or network access.

The inventory covers the npm application dependency closure plus Monaco, which
is bundled despite being declared as a development dependency. It also covers
all resolved Cargo packages, including build dependencies and platforms that may
not appear in a particular binary. This is an intentionally broad attribution
inventory, not a precise binary SBOM or approval of every possible distribution.
Pure npm build/test tooling is outside the shipped-application notice scope.

The generator preserves package license/notice files, including Monaco's
`ThirdPartyNotices.txt`, and deduplicates their text by SHA-256. The inventory
maps each package to its notices and source archive URL. A missing license file
or changed installed version stops generation unless an explicit reviewed
supplement exists. `licenses/supplements.json` records pinned upstream URLs and
hashes for recovered license documents and standard license texts; retained
copies are in `licenses/supplemental/`.

KaTeX's package license covers its JavaScript under MIT, while its font name
tables identify SIL Open Font License 1.1 terms. The generator extracts the
embedded copyright and Reserved Font Name records from the installed TTF files
and includes the OFL text. Preserve these terms for the shipped font formats.

After changing dependencies, release versions, source notices, or this tooling,
regenerate and review the inventory before committing. `npm run lint` and
`npm run build` check that inputs and distribution artifacts still match.
A passing check establishes freshness and file integrity, not legal clearance.

## Source availability and platform packaging

The five currently locked MPL-only Cargo packages are `cssparser`,
`cssparser-macros`, `dtoa-short`, `option-ext`, and `selectors`. Their exact,
unmodified `.crate` source archives are included under
`licenses/distribution/sources/`, verified against Cargo.lock checksums. This
keeps covered source available alongside the notices. If a dependency is patched,
ship its corresponding modified source and update the inventory process. See
[Mozilla's MPL distribution requirements](https://www.mozilla.org/en-US/MPL/2.0/).

For `r-efi`, use its offered MIT alternative and preserve its `AUTHORS` document.
DOMPurify offers Apache-2.0 as an alternative to MPL-2.0; its supplied license
texts are retained. Neither case changes this project's Apache-2.0 license.

Builds copy the notice bundle into `dist/licenses/`. Tauri and Electron also
include it as readable `licenses/` resources; on macOS this is
`Contents/Resources/licenses/` inside the app bundle. Other targets use their
platform resource directory.

The Electron `afterExtract` hook preserves its runtime license and Chromium
notices in `licenses/electron/` before macOS packaging removes the original
top-level copies. Missing runtime notices fail packaging. Verify these files in
each Electron distribution. Platform-provided webviews,
system libraries, and installer/AppImage tooling require a release-specific
review; the Cargo/npm inventory does not cover every native binary dependency.

## Publication review items

The maintainer confirmed that original workbench code is theirs to release under
Apache-2.0 during this preparation. This does not retroactively add DCO sign-offs
to historical commits. New contributions follow [CONTRIBUTING.md](../CONTRIBUTING.md).

The following items remain explicit publication review gates:

- **Branding presentation:** the maintainer supplied the official OpenSearch
  branding page as the artwork source, and both local SVG marks match its linked
  downloads byte-for-byte. Provenance is recorded in
  [artwork provenance](../assets/README.md). Review the independent app's name and
  use of the mark as its application identity against the policy; adjust the
  presentation or obtain permission if needed. No Apache-only sidecar is
  assigned to the artwork, and no endorsement is claimed.
- **sigchld 0.2.5:** its Cargo metadata declares MIT and names Jack O'Connor, but
  neither the archive nor its pinned repository tree includes a license or
  copyright file. The bundle supplies standard MIT text and records this gap;
  confirm the intended copyright attribution with upstream before publication.
- **Release artifacts:** verify the notice/source bundle and external runtime
  notices in every published platform package. Maintain any additional native
  library notices and source obligations discovered by that review.

The brand policy and attribution questions above remain separate from automated
source-header checks. No public release, trademark permission, repository
transfer, or OpenSearch adoption is established by these files.
