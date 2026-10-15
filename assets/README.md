# Artwork provenance

The maintainer identifies the [official OpenSearch trademark and branding page](https://opensearch.org/trademark-brand-policy/)
as the source of the artwork, including the application icons in `src-tauri/icons/`.

Both SVG files in this directory were verified byte-for-byte against the official
downloads linked from that page:

| Local file | Official download | SHA-256 |
| --- | --- | --- |
| `opensearch_mark_default.svg` | [Default mark](https://opensearch.org/wp-content/uploads/2025/01/opensearch_mark_default.svg) | `d89d0555a75fa2c745bfdd782589cc17ce596d3fd41e5008bef8ff3fec695bc8` |
| `opensearch_mark_darkmode.svg` | [Dark-mode mark](https://opensearch.org/wp-content/uploads/2025/01/opensearch_mark_darkmode.svg) | `72c3cc4bdb44fe9bc567d1345aa8a00d3ee059ce23f38248c067dc580448821d` |

The app icons' branding source is maintainer-confirmed; the exact conversion
commands for their PNG, ICO, and ICNS variants have not been recorded. The SVG
verification above does not assert byte identity for those converted formats.

Treat this artwork separately from Apache-2.0 project code. Do not infer a grant
of trademark rights from the root license or assign the project's source-code
copyright to these images. Generated XML configuration under `src-tauri/icons/`
is covered by the source-header policy; that does not license the artwork it
references.

The policy permits official logos to indicate integration with OpenSearch,
subject to its conditions and the [brand guidelines](https://opensearch.org/wp-content/uploads/2025/02/OpenSearch-Brand-Guide.pdf).
It permits format conversion, requires distinguishable branding, and prohibits
implying endorsement. Uses outside the policy need written permission.

The remaining publication review concerns the independent app's name and use of
the mark as its application identity, rather than an unknown artwork source.
Confirm that presentation meets the policy, adjust it, or obtain permission for
uses outside the policy. Record the decision here.

Bootstrap SVG paths embedded in React components are separate third-party
material under MIT; see [the licensing guide](../docs/licensing.md).
