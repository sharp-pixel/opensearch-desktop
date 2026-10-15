# OpenSearch Developer Workbench

A React and TypeScript workbench for OpenSearch query notebooks, multi-cluster
investigations, Data Prepper pipeline simulation, and ISM policy analysis.
The frontend runs in Tauri, Electron, or a browser. Native credentials, file
dialogs, menus, and transports are accessed through host adapters.

## Development

Install a Node.js version supported by `package.json` (for example, Node 24.15+
on the 24.x line), then run `npm ci` from the repository root. Tauri also needs
Rust and the [platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm run tauri:dev       # Tauri desktop app
npm run dev             # Browser development at http://localhost:5173
npm run electron:dev    # Electron desktop app
```

Run one development command at a time: all three use port 5173. Vite fails if
that port is occupied so the desktop hosts cannot connect to a different server.
Browser development includes local HTTP proxies and a gRPC bridge; the gRPC
bridge is development middleware and is not included in the static web build.

`compose.yml` provides optional local OpenSearch/Data Prepper services for manual
testing. Set `OPENSEARCH_INITIAL_ADMIN_PASSWORD` before running
`docker compose up`. The workbench's local pipeline simulator does not require
these containers.

## Repository layout

```text
src/
  app/                  Application composition and lifecycle
  features/             Notebook, Investigation, Data Prepper, and ISM
  components/           Shared React components
  platform/             Browser, Tauri, and Electron adapters and contracts
  storage/              Workspace persistence and save coordination
  connections/          Shared connection registry
  execution/            Request ownership and concurrency
  editor/               Shared Monaco integration
  services/             Shared services and remaining legacy feature services
  types/                Shared TypeScript types
  protobuf/             Vendored schema and upstream license notices
  __tests__/            Frontend, domain, and host contract tests
src-tauri/
  src/main.rs           Desktop entry point
  src/lib.rs            Tauri initialization and command registration
  src/http.rs           Native HTTP proxy and its tests
  src/*.rs              Native capability implementations
  capabilities/         Tauri window permissions
  icons/                App bundle icons
  gen/schemas/          Generated configuration schemas
  tauri.conf.json       Tauri development and bundle configuration
electron/               Electron application, preload, and host handlers
shared/node/            Node gRPC transport and request cancellation
tooling/vite/           Browser development gRPC bridge
scripts/                Release preparation and license checks
docs/                   Architecture, features, and release instructions
```

Features own their domain logic, application workflows, and UI. The app layer
composes features; shared components do not import feature implementations.
ESLint enforces these boundaries. ISM's analysis, validation, diagram, timeline,
and reference modules live in its `domain/` directory. Further legacy service
moves should follow feature ownership as those services change.

The Rust library owns Tauri setup and the desktop executable calls `run()`.
This follows Tauri's library entry-point convention; mobile packaging and native
capability support are not currently validated.

## Checks and builds

```sh
npm run lint            # SPDX coverage and ESLint
npm test                # Vitest, including local gRPC server tests
npm run build           # TypeScript check and production frontend
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
npm run tauri:build     # Native Tauri bundles
npm run electron:build  # Electron bundles
```

Frontend output is written to `dist/`, Tauri output to `src-tauri/target/`, and
Electron output to `release/`. These build directories are ignored by Git.
Some native Keychain integration tests are explicitly ignored in normal Rust
test runs because they require OS credential-store access.

For signed macOS builds, notarization, and updater releases, follow
[local release instructions](docs/local-releases.md) and
[app update configuration](docs/app-updates.md).

## Documentation and licensing

- [Contributing](CONTRIBUTING.md)
- [Maintainers](MAINTAINERS.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security reporting](SECURITY.md)
- [Architecture implementation](docs/architecture-implementation.md)
- [Workspace files](docs/workspace-files.md)
- [gRPC notebooks](docs/grpc-notebook.md)
- [Dependencies](docs/dependencies.md)
- [Licensing, generated notices, and publication review items](docs/licensing.md)
- [Project attribution](NOTICE)

Project code is licensed under [Apache-2.0](LICENSE). Files containing third-party
material preserve the applicable additional license notices.
