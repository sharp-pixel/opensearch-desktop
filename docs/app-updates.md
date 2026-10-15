# App updates

Tauri builds support signed in-app updates for Linux AppImage and macOS `.app`
bundles. Preferences → App updates shows the current version, checks for newer
stable releases, displays release notes, downloads with progress, and offers
Restart and install. Automatic checks are enabled by default and can be turned
off. Downloads and installation always require user actions.

For releases with signing keys kept on your own computer, follow
[Local signing and manual GitHub releases](local-releases.md). That is the
preferred publishing process for this project. GitHub receives release artifacts,
signatures and public update metadata; signing secrets stay local.

The native updater checks the artifact's signature before it becomes installable.
Restart first flushes notebook, investigation, Data Prepper and ISM recovery data,
and connections. Failed saves prevent installation and restart. Installation
failures retain the verified download for retry and leave the app usable. Close
requests are blocked while saving/installing for a restart. No user files or
configuration are sent to GitHub as part of update checks.

On Linux, the updater replaces the running AppImage at its original path. The
AppImage and its directory must be writable. Debian/RPM packages and unpackaged
development binaries use their normal installation mechanisms. On macOS, install
the app from its DMG into Applications before updating; the updater replaces the
installed app bundle. Read-only DMGs cannot be updated in place. Browser and
Electron builds do not use this Tauri updater.

## Release source and signing

The source repository is private. Publish binary releases to a separate **public
GitHub repository** so installed apps can fetch metadata and artifacts without a
GitHub account or an embedded access token. Releases contain installers, updater
artifacts, signatures and metadata; the Git repository remains private.
GitHub's stable `releases/latest/download/latest.json` endpoint supplies
version, notes and signed platform assets. Drafts and prereleases are excluded.
Private release repositories need a separate authenticated update service and
are not enabled by this public release workflow.

Generate one updater signing key pair and keep the private key for all future
versions. Do not commit it or rotate it between releases: installed apps trust
the original public key. `.updater-keys/` is ignored by Git.

```sh
mkdir -p .updater-keys
chmod 700 .updater-keys
npm run tauri -- signer generate -w .updater-keys/workbench.key
chmod 600 .updater-keys/workbench.key
```

Keep a backup of the private signing key outside the repository. The generated
config embeds only the public key and endpoint and enables updater artifacts.
Ordinary development builds remain usable without a signing key and report that
updates are not configured.

## Optional GitHub Actions signing

The existing `Desktop release` workflow is an alternative that signs in CI. It
requires signing secrets in GitHub Actions, so do not use it for the local signing
process. The [local release guide](local-releases.md#prepare-the-release-source)
explains how to disable its automatic tag trigger in repository settings.

Only when choosing CI signing, store these variables and secrets in the
**source repository's** GitHub Actions settings:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `RELEASE_REPOSITORY` | Public release destination, `owner/repository` |
| Variable | `RELEASE_BRANCH` | Existing branch in the release repository; defaults to `main` |
| Variable | `TAURI_UPDATER_PUBLIC_KEY` | Contents of `workbench.key.pub` |
| Secret | `RELEASE_TOKEN` | Fine-grained token with Contents read/write on the release repository |
| Secret | `TAURI_SIGNING_PRIVATE_KEY` | Contents of `workbench.key` |
| Secret | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Signing key password, if set |
| Secrets | `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` | Developer ID Application certificate (Base64 `.p12`), password and identity |
| Secrets | `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | Apple notarization account, app-specific password and team |

Updater signatures and Apple signing are separate requirements. macOS CI requires
signing and notarization credentials before uploading macOS assets. The release
destination needs an initial commit and the configured release branch.

## Publishing with the optional CI workflow

1. Run `npm run release:version -- X.Y.Z` to synchronize package.json, its lockfile,
   Cargo.toml/Cargo.lock and tauri.conf.json. Commit the version and source changes.
2. Create and push the matching stable `vX.Y.Z` tag in the source repository. You
   can also dispatch Desktop release manually with an existing matching tag.
3. CI validates the version and public destination, runs frontend checks, and
   builds signed Linux x86_64 AppImage, macOS Apple Silicon and macOS Intel assets.
   Platform builds upload sequentially into one draft so manifest merging cannot
   lose another platform's entry.
4. Review the draft and `latest.json`. It must include `linux-x86_64`,
   `darwin-aarch64` and `darwin-x86_64` entries (or their bundle-specific keys),
   each with an HTTPS URL and signature. Linux uses `.AppImage` + `.sig`;
   macOS uses `.app.tar.gz` + `.sig`, plus DMGs for first-time installation.
5. Publish the completed draft as a stable release. Installed apps can now offer
   the update. Older builds without the updater/public key need one manual install
   of the first update-enabled build.

Test a real update using two differently versioned signed builds and a temporary
release repository before distributing the first production version. Verify
signature rejection, offline/retry behavior, an unwritable AppImage directory,
macOS installed in Applications, and restart with unsaved drafts. macOS packaging
and installation must be tested on macOS; a Linux build cannot validate them.

References: [Tauri updater](https://v2.tauri.app/plugin/updater/),
[Tauri GitHub releases](https://v2.tauri.app/distribute/pipelines/github/),
[Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/).
