# Contributing to OpenSearch Developer Workbench

Bug reports, documentation, tests, accessibility improvements, and code
contributions are welcome. This repository is independently maintained; it has
not been adopted into the `opensearch-project` organization. Our contribution
process follows the [OpenSearch contribution guidelines](https://github.com/opensearch-project/.github/blob/main/CONTRIBUTING.md)
where applicable to this project.

Participating in this project means following our [Code of Conduct](CODE_OF_CONDUCT.md).
For vulnerabilities, use the private reporting process in [SECURITY.md](SECURITY.md).

## Before starting

Search existing issues and pull requests. Open an issue for a substantial change
so maintainers can discuss its scope and design before implementation. Small
documentation fixes can go directly to a pull request.

For a bug, include the app version or commit, operating system, host (Tauri,
Electron, or browser), reproduction steps, and expected and actual behavior.
Include relevant OpenSearch/Data Prepper versions when applicable. Remove
credentials, authorization headers, private endpoints, and user data from
screenshots, logs, and sample notebooks.

Feature proposals should describe the user problem, alternatives, and the
expected effect on existing workflows.

## Set up and develop

See the [README](README.md#development) for prerequisites and development commands,
and [dependency documentation](docs/dependencies.md) for native requirements.

```sh
npm ci
npm run tauri:dev
```

Browser and Electron development are also supported. Start one host at a time
because they share port 5173. OpenSearch containers are optional for local
development; use synthetic data when exercising queries and saved documents.

Use a topic branch and keep each pull request focused. Follow nearby code style:
TypeScript uses two-space indentation, single quotes, and strict type checking.
Features own their domain logic, application workflows, and UI; shared components
must not depend on feature implementations. Put host-specific operations behind
the platform adapters. See [repository guidance](AGENTS.md) and the
[architecture documentation](docs/architecture-implementation.md).

## Validate changes

For application changes, run:

```sh
npm run lint
npm test
npm run build
```

The test suite starts local gRPC servers and needs localhost socket access. For
Rust changes, also run:

```sh
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
```

OS credential-store tests are explicitly ignored in ordinary runs. Report native
platform checks separately; a macOS result does not establish Windows or Linux
behavior. Verify affected packaging when moving runtime files or changing build
configuration. Documentation-only changes need link and formatting checks rather
than an application rebuild.

Add regression coverage for behavior changes. In the pull request, list checks
run and any checks that could not be completed, including the reason.

## Licensing and sign-off

Submit only material you have the right to contribute under this project's
[Apache-2.0 license](LICENSE). Preserve third-party notices and follow
[our SPDX header conventions](docs/licensing.md); `npm run lint:licenses` verifies
header coverage.

Every new contribution commit must carry the author's Developer Certificate of
Origin sign-off. Read [DCO 1.1](https://developercertificate.org/) before signing.
With your contributor name and reachable email configured in Git, use:

```sh
git commit -s -m "Describe the change"
```

This adds a `Signed-off-by` trailer. A GPG or SSH commit signature is separate
from DCO sign-off. Do not certify another person's contribution on their behalf.
If a sign-off is missing, coordinate correction with the author and maintainer;
do not rewrite shared branch history as part of an unrelated pull request.

## AI-assisted contributions

If AI generated a substantial part of the contribution, identify the tool and
describe its use in the pull request. You remain responsible for understanding
the code, verifying it, respecting licensing, and responding to review questions.
Apply the same review and testing standards to AI-assisted and handwritten work.

## Pull requests and review

Target `main`. Explain the problem, resulting behavior, linked issue, and
validation. Include screenshots for visible UI changes and update documentation
when workflows or commands change. Do not include generated build artifacts,
signing material, or unrelated formatting changes.

A listed [maintainer](MAINTAINERS.md) reviews contributions and decides when they
are ready to merge. Address review comments or explain disagreements with
concrete examples. Maintainers may ask for a smaller scope or a design discussion.
Signing keys and release credentials are not required to contribute.
