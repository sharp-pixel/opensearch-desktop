# Dependency management

Use Node.js 22.22.2 or newer in the 22.x line, 24.15.0 or newer in the 24.x
line, or Node.js 26+. These requirements are also recorded in `package.json`.

Install the JavaScript dependencies with `npm ci`. Direct dependencies and
overrides use exact versions in `package.json`; `.npmrc` makes future npm installs
save exact versions as well. Commit `package-lock.json` with any dependency change
so transitive versions and package integrity hashes remain reproducible.

Rust dependencies use `=x.y.z` requirements in `src-tauri/Cargo.toml`.
Commit `src-tauri/Cargo.lock` with dependency changes, and use locked builds:

```sh
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

The September 2026 refresh uses TypeScript 6.0.3 because the current
`typescript-eslint` release supports TypeScript versions below 6.1. Rust crates
remain on their existing compatible release lines, including `dirs` 5,
`reqwest` 0.12, `keyring` 3, `base64` 0.22, and `tonic` 0.12; upgrades across those
boundaries require a separate migration.

After upgrading dependencies, run `npm run build`, `npm run lint`, `npm test`, and
the locked Rust checks above. The gRPC integration tests require permission to
listen on localhost.

## Tauri builds on Linux

Install Rust and the native system dependencies before running
`npm run tauri:build`. Tauri 2 requires **WebKitGTK 4.1**, including its
JavaScriptCoreGTK library, plus GTK 3 and GDK Pixbuf development files. These
are system packages and are not installed by `npm ci` or Cargo.

On Arch Linux and CachyOS, install the prerequisites with:

```sh
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
```

For other distributions, follow the
[Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux).
Debian and Ubuntu provide WebKitGTK development files in
`libwebkit2gtk-4.1-dev`.

Build the production application and installers from the repository root:

```sh
npm run tauri:build
```

If Homebrew's `pkg-config` takes precedence on Linux, it may fail to find
system libraries even when they are installed. Use the system executable:

```sh
/usr/bin/pkg-config --modversion webkit2gtk-4.1 javascriptcoregtk-4.1 gdk-pixbuf-2.0
PKG_CONFIG=/usr/bin/pkg-config npm run tauri:build
```

On rolling Linux distributions, AppImage packaging can also fail with
`unknown type [0x13] section .relr.dyn` if linuxdeploy's bundled `strip` tool
does not support the system libraries. Set
[`NO_STRIP=1`](https://github.com/linuxdeploy/linuxdeploy/issues/72) to skip
linuxdeploy's stripping step:

```sh
NO_STRIP=1 PKG_CONFIG=/usr/bin/pkg-config npm run tauri:build
```

If the release executable has already built, retry only AppImage packaging:

```sh
NO_STRIP=1 PKG_CONFIG=/usr/bin/pkg-config npm run tauri -- bundle --bundles appimage
```

The native executable is written to `src-tauri/target/release/`, and installers
are written to `src-tauri/target/release/bundle/`.

## Signed application updates

The desktop updater uses `tauri-plugin-updater` 2.12.0, pinned to match Tauri
2.11.6. Updater 2.13 requires Tauri 2.12 and is intentionally not selected. The
plugin brings its own reqwest 0.13 dependency; the app's existing reqwest 0.12
transport remains on its current release line. GitHub release configuration and
Apple signing prerequisites are documented in [app-updates.md](app-updates.md).
