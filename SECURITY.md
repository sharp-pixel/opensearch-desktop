# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately to Cédric Pelvet at
[cedric.pelvet@gmail.com](mailto:cedric.pelvet@gmail.com), with the subject
`Developer Workbench security report`.

Please do not disclose an unpatched vulnerability in a public issue, pull
request, or discussion. For an ordinary bug without a security impact, follow
[CONTRIBUTING.md](CONTRIBUTING.md).

Useful details include:

- The affected app version or commit, operating system, and host (Tauri,
  Electron, or browser).
- A description of the impact and any prerequisites for exploitation.
- Minimal reproduction steps or a proof of concept using synthetic data.
- Relevant sanitized logs or screenshots and any suggested mitigation.
- Your preferred contact details and whether you want public credit.

Never send real passwords, API tokens, AWS credentials, private signing keys,
or production notebook data. If you need to share sensitive evidence, first
ask the maintainer to arrange an appropriate transfer method.

## Supported versions

The project is in pre-1.0 development. Security fixes target `main` and the
latest published pre-release, when one is available. Older pre-releases and
individual development snapshots have no guaranteed backport support. Reports
about older versions are welcome when they may affect current code.

Include the exact build you tested. Platform support and native behavior can
differ; reports about any supported host are welcome even when the maintainer
cannot immediately reproduce them on that operating system.

## Response and disclosure

The [maintainer](MAINTAINERS.md) handles reports on a best-effort basis. There is
no guaranteed response or remediation deadline. If you have not received a
response, follow up by email without publishing sensitive details.

After reviewing a report, the maintainer will work with the reporter to confirm
the issue, identify affected versions, and coordinate a fix or mitigation and
disclosure timing. Release notes or an advisory will describe confirmed issues
when appropriate. Reporter credit is included with the reporter's agreement.

This repository is independently maintained and is not currently covered by the
OpenSearch Security Response Team. Vulnerabilities in OpenSearch itself should
follow the [upstream security reporting process](https://github.com/opensearch-project/security-response/security).

## Safe testing

Use systems and accounts you own or are authorized to test. Prefer disposable
local clusters and synthetic documents. Avoid accessing another user's data,
disrupting shared services, or testing release infrastructure without permission.
Reports are welcome even if you cannot provide a working exploit.
