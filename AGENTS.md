# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + TypeScript UI. `src/app/` composes features; `src/features/` owns feature domain, application, and UI code. Shared components, platform adapters, storage, and services live in their corresponding top-level `src/` directories.
- `src/__tests__/property/` holds property-based tests.
- `electron/` contains Electron main/preload scripts for desktop builds.
- `shared/node/` contains the Node gRPC transport and cancellation registry used by Electron and browser development; `tooling/vite/` contains development middleware. Keep shared Node runtime files in Electron's packaging allowlist.
- `src-tauri/` contains the Rust/Tauri backend and config. `src/main.rs` calls the library entry point; register commands and initialize Tauri in `src/lib.rs`, with implementations in capability modules.
- `README.md` documents development, repository layout, checks, and release documentation.
- `assets/` stores logos and icons; `compose.yml` defines local OpenSearch services.

## Build, Test, and Development Commands
- `npm run dev`: start the Vite dev server for the web UI.
- `npm run build`: typecheck + production build (`tsc -b` then `vite build`).
- `npm run preview`: serve the production build locally.
- `npm run lint`: run ESLint across the repo.
- `npm test`: run Vitest in CI mode (`vitest --run`).
- `npm run tauri:dev` / `npm run tauri:build`: run/build the Tauri desktop app.
- `npm run electron:dev` / `npm run electron:build`: run/build the Electron app.

## Coding Style & Naming Conventions
- Add the complete OpenSearch copyright, SPDX, and contribution-license header to new project source files using the file's comment syntax. Preserve third-party license requirements; see `docs/licensing.md` for exceptions and vendored files.
- Run `npm run lint:licenses` to check source and configuration headers. Regenerate and review `licenses/distribution/` with `npm run licenses:generate` after dependency or notice changes. Both header and artifact freshness checks are included in `npm run lint`.
- Use 2-space indentation and single quotes (matches existing TS/TSX files).
- Prefer explicit, descriptive names; keep React components in `PascalCase` and helpers in `camelCase`.
- TypeScript runs in strict mode; avoid unused locals/parameters.
- ESLint is available; run `npm run lint` before submitting.

## Testing Guidelines
- Test framework: Vitest; property-based checks use `fast-check`.
- Naming convention: `*.property.test.ts` under `src/__tests__/property/`.
- Run all tests with `npm test`; target a single file via `npx vitest --run <path>`.

## Commit & Pull Request Guidelines
- This branch has no commit history yet, so no established commit format. Use short, imperative summaries (e.g., "Add pipeline parser fixtures") and include scope when helpful.
- PRs should include: purpose/summary, testing notes (commands run), and screenshots or screen captures for UI changes.

## Security & Configuration Tips
- `compose.yml` expects `OPENSEARCH_INITIAL_ADMIN_PASSWORD` for local OpenSearch containers. Set it in your shell or a local `.env` before running `docker compose up`.
