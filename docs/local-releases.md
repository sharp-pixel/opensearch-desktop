# Local signing and manual GitHub releases

Build, sign and notarize on your Mac, then upload the completed files to a public
GitHub release repository. Your Apple private key stays in Keychain and your Tauri
updater private key stays on your Mac. No signing keys or notarization credentials
need to be stored in GitHub Actions. GitHub receives installers, updater archives,
public signatures and `latest.json`.

Use this process for the [app update mechanism](app-updates.md). The existing
`Desktop release` workflow signs in CI and is a separate, optional process.

## One-time Mac setup

Install Node.js compatible with `package.json` (Node 24.15 or newer on the 24.x
line), stable Rust, Xcode/Command Line Tools, and the GitHub CLI (`gh`). Apple's
`codesign`, `notarytool` and `stapler` tools must be available through Xcode.
Clone the private source repository and run `npm ci`.

Run the shell examples in **Bash** from the repository root. On a Mac using the
default Zsh shell, enter `bash` first. Password prompts below use Bash's `read`
options and do not place passwords in the shell command history.

Install your **Developer ID Application** certificate with its matching private
key in your login Keychain. Confirm that macOS can find the identity:

```sh
security find-identity -v -p codesigning
```

An Apple Development certificate is not the distribution identity used here.
A `.p8` App Store Connect key can authenticate notarization, but does not replace
the code-signing certificate. Local signing does not require exporting the
Keychain identity as a `.p12`. See [Tauri's macOS signing guide](https://v2.tauri.app/distribute/sign/macos/).

Generate the separate Tauri updater key **once**, choosing a password when prompted:

```sh
mkdir -p .updater-keys
chmod 700 .updater-keys
npm run tauri -- signer generate -w .updater-keys/workbench.key
chmod 600 .updater-keys/workbench.key
```

Reuse this key for every platform and future release. Keep a secure backup of it
and its password. `.updater-keys/` is ignored by Git. Installed apps trust the
corresponding public key; generating a replacement key for each version would
break their update chain.

Create a separate **public** GitHub repository for release files with an initial
commit on `main`. The source repository remains private. Authenticate `gh` on
your Mac with access to both repositories:

```sh
gh auth login
```

This authentication is used from your computer to upload releases, without adding
a release token to GitHub Actions secrets.

## Prepare the release source

Resolve the publication review items in [the licensing guide](licensing.md#publication-review-items)
before publishing. After updating the release version, run `cargo fetch --locked
--manifest-path src-tauri/Cargo.toml` and `npm run licenses:generate`, review the
updated `licenses/distribution/` files, and include them in the release commit.
Verify the installed app contains its `licenses/` resources and source archives.

Before pushing version tags, disable **Desktop release** in the source
repository's Actions page (select the workflow, then **Disable workflow**), or run:

```sh
gh workflow disable release.yml --repo sharp-pixel/developer-workbench
```

This prevents the existing tag-triggered workflow from attempting CI signing.
It does not disable the app's update mechanism. Disabling is a GitHub repository
setting; these instructions do not change that setting automatically.

Choose a stable version newer than the previous release and your actual public
release repository. The names below are examples to replace:

```sh
export RELEASE_VERSION=0.0.2
export RELEASE_TAG="v$RELEASE_VERSION"
export RELEASE_REPOSITORY="owner/workbench-releases"
export RELEASE_ASSET_DIR="$PWD/release/$RELEASE_TAG"
mkdir -p "$RELEASE_ASSET_DIR"

npm run release:version -- "$RELEASE_VERSION"
```

Commit the source and version changes before building. The version command updates
`package.json`, `package-lock.json`, `src-tauri/Cargo.toml`,
`src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`. For example, after any other
source changes are committed:

```sh
git add package.json package-lock.json src-tauri/Cargo.toml \
  src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -m "Release $RELEASE_VERSION"
git push origin main
git tag "$RELEASE_TAG"
git push origin "$RELEASE_TAG"
```

The source tag records the code used for the build. The public release repository
will have its own tag; its commit is not the private source commit.

## Set local signing and notarization credentials

Copy the full identity name reported by `security find-identity`:

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
read -r -s -p 'Apple app-specific password: ' APPLE_PASSWORD
printf '\n'
export APPLE_PASSWORD

export TAURI_UPDATER_PUBLIC_KEY="$(cat .updater-keys/workbench.key.pub)"
export TAURI_SIGNING_PRIVATE_KEY="$PWD/.updater-keys/workbench.key"
read -r -s -p 'Updater key password: ' TAURI_SIGNING_PRIVATE_KEY_PASSWORD
printf '\n'
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD

npm run release:prepare
```

`APPLE_PASSWORD` is an Apple **app-specific password**, not your normal account
password. Tauri uses these credentials locally to submit the signed app to Apple
for notarization. The generated updater config is ignored by Git and embeds only
the public key and GitHub endpoint. Tauri reads signing credentials from the shell
environment; a `.env` file alone does not configure updater signing.

Alternatively, notarization can use an App Store Connect API key by setting
`APPLE_API_ISSUER`, `APPLE_API_KEY` (the key ID), and `APPLE_API_KEY_PATH` (the local
`.p8` path) instead of the three Apple ID authentication variables. Keep
`APPLE_SIGNING_IDENTITY` for code signing in either case.

## Build and collect macOS assets

Build each supported architecture explicitly. Both builds use the same version,
release endpoint and updater key:

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin

npm run tauri:build -- --target aarch64-apple-darwin --bundles app,dmg \
  --config src-tauri/tauri.updater.generated.json -- --locked

cp src-tauri/target/aarch64-apple-darwin/release/bundle/macos/*.app.tar.gz \
  "$RELEASE_ASSET_DIR/workbench-macos-arm64.app.tar.gz"
cp src-tauri/target/aarch64-apple-darwin/release/bundle/macos/*.app.tar.gz.sig \
  "$RELEASE_ASSET_DIR/workbench-macos-arm64.app.tar.gz.sig"
cp src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/*.dmg \
  "$RELEASE_ASSET_DIR/workbench-macos-arm64.dmg"

npm run tauri:build -- --target x86_64-apple-darwin --bundles app,dmg \
  --config src-tauri/tauri.updater.generated.json -- --locked

cp src-tauri/target/x86_64-apple-darwin/release/bundle/macos/*.app.tar.gz \
  "$RELEASE_ASSET_DIR/workbench-macos-x64.app.tar.gz"
cp src-tauri/target/x86_64-apple-darwin/release/bundle/macos/*.app.tar.gz.sig \
  "$RELEASE_ASSET_DIR/workbench-macos-x64.app.tar.gz.sig"
cp src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/*.dmg \
  "$RELEASE_ASSET_DIR/workbench-macos-x64.dmg"
```

Each copy pattern should match exactly one file. If old bundles remain, select
the file from the current build explicitly. Renaming an artifact does not change
its bytes or invalidate its signature; keep its matching `.sig` alongside it.

The DMGs are for initial installation. The `.app.tar.gz` archives and their
signatures are for in-app updates. Signing and notarization must finish
successfully before proceeding. The local build does **not** create `latest.json`.

## Add Linux without moving the private key off the Mac

Build the AppImage on Linux using the same source tag/version. Install the
[Linux build dependencies](dependencies.md#tauri-builds-on-linux).
Transfer only `workbench.key.pub` to that computer. In its repository checkout,
set the same release values and prepare the embedded updater config:

```sh
export RELEASE_VERSION=0.0.2
export RELEASE_TAG="v$RELEASE_VERSION"
export RELEASE_REPOSITORY="owner/workbench-releases"
export TAURI_UPDATER_PUBLIC_KEY="$(cat /path/to/workbench.key.pub)"
npm ci
npm run release:prepare

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'src-tauri/tauri.updater.generated.json';
const config = JSON.parse(readFileSync(file, 'utf8'));
config.bundle.createUpdaterArtifacts = false;
writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
JS

NO_STRIP=1 PKG_CONFIG=/usr/bin/pkg-config npm run tauri:build -- \
  --target x86_64-unknown-linux-gnu --bundles appimage \
  --config src-tauri/tauri.updater.generated.json -- --locked
```

Disabling artifact signing for this build leaves the updater's public key and
endpoint embedded in the app. The AppImage itself is the Linux update artifact.
Copy the resulting file from
`src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/` to your Mac as
`$RELEASE_ASSET_DIR/workbench-linux-x64.AppImage`, then sign it there:

```sh
env -u TAURI_SIGNING_PRIVATE_KEY npm run tauri -- signer sign \
  --private-key-path "$PWD/.updater-keys/workbench.key" \
  --app-version "$RELEASE_VERSION" \
  "$RELEASE_ASSET_DIR/workbench-linux-x64.AppImage"
```

The password is read from the previously exported
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. This creates the adjacent `.AppImage.sig`.
`env -u` removes the build's key-path variable for this command: the manual signer
loads the key through `--private-key-path`, while its `TAURI_SIGNING_PRIVATE_KEY`
variable expects key contents. Your parent shell's variables are unchanged.
The updater private key stays on the Mac throughout.

## Create latest.json

Write release notes as plain text in `$RELEASE_ASSET_DIR/release-notes.md`.
With the selected version's files collected, run this from the source checkout:

```sh
node --input-type=module <<'JS'
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { RELEASE_REPOSITORY: repository, RELEASE_VERSION: version,
  RELEASE_TAG: tag, RELEASE_ASSET_DIR: directory } = process.env;
if (!directory || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')
    || !/^\d+\.\d+\.\d+$/.test(version ?? '') || tag !== `v${version}`) {
  throw new Error('Set the release repository, version, tag and asset directory.');
}
const platforms = {};
for (const [target, filename] of [
  ['darwin-aarch64', 'workbench-macos-arm64.app.tar.gz'],
  ['darwin-x86_64', 'workbench-macos-x64.app.tar.gz'],
  ['linux-x86_64', 'workbench-linux-x64.AppImage'],
]) {
  const artifact = join(directory, filename);
  if (!existsSync(artifact)) continue;
  const signature = readFileSync(artifact + '.sig', 'utf8').trim();
  if (!signature) throw new Error(`Missing signature for ${target}`);
  platforms[target] = {
    url: `https://github.com/${repository}/releases/download/${tag}/${encodeURIComponent(filename)}`,
    signature,
  };
}
if (!Object.keys(platforms).length) throw new Error('No updater artifacts found.');
const manifest = { version, notes: readFileSync(join(directory, 'release-notes.md'), 'utf8'),
  pub_date: new Date().toISOString(), platforms };
writeFileSync(join(directory, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Created latest.json for ' + Object.keys(platforms).join(', '));
JS
```

The manifest embeds each `.sig` file's **contents**, not its filename or URL.
Only platforms whose artifacts are present are included. For a release supporting
all current desktop targets, check for `darwin-aarch64`, `darwin-x86_64` and
`linux-x86_64` before publishing. A platform omitted from the latest manifest
cannot receive that release through the updater. Do not reuse an older version's
artifact or signature in a newer version's manifest.

## Upload a draft and publish

Create the draft in the **public release repository**, specifying its branch
rather than a private source commit:

```sh
gh release create "$RELEASE_TAG" --repo "$RELEASE_REPOSITORY" \
  --target main --draft --title "Developer Workbench $RELEASE_TAG" \
  --notes-file "$RELEASE_ASSET_DIR/release-notes.md"

gh release upload "$RELEASE_TAG" --repo "$RELEASE_REPOSITORY" \
  "$RELEASE_ASSET_DIR"/workbench-* "$RELEASE_ASSET_DIR/latest.json"

gh release view "$RELEASE_TAG" --repo "$RELEASE_REPOSITORY" --web
```

The upload pattern includes the staged DMGs, updater artifacts and `.sig` files.
It does not include the local signing keys. If the draft already exists, skip
creation and upload the remaining assets. Upload each asset once; if you must
replace one while the release is still a draft, replace its matching signature
and regenerate the manifest as well.

Check the release assets and manifest, test the signed/notarized Mac app by moving
it from its DMG into Applications, and verify the Linux AppImage on Linux. Draft
assets are not available through the app's public update endpoint. After review,
publish through the GitHub page or run:

```sh
gh release edit "$RELEASE_TAG" --repo "$RELEASE_REPOSITORY" \
  --draft=false --prerelease=false --latest
```

The endpoint embedded in the app now resolves to this release's `latest.json`:
`https://github.com/owner/workbench-releases/releases/latest/download/latest.json`
(using your actual repository). The first update-enabled build needs a manual
installation. Test the complete in-app update using two differently versioned,
signed builds, including restart with unsaved drafts, before broad distribution.

When finished, clear password variables from the shell:

```sh
unset APPLE_PASSWORD TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

References: [Tauri updater artifacts and manifest](https://v2.tauri.app/plugin/updater/),
[Tauri macOS signing and notarization](https://v2.tauri.app/distribute/sign/macos/),
[GitHub CLI release creation](https://cli.github.com/manual/gh_release_create),
[asset upload](https://cli.github.com/manual/gh_release_upload),
[release publication](https://cli.github.com/manual/gh_release_edit), and
[disabling a workflow](https://cli.github.com/manual/gh_workflow_disable).
