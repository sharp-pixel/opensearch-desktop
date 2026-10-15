# Data Prepper processing simulator validation

Reference: the local `data-prepper` checkout at commit
[`0c8acd7ffc0328b1f9dbd9bc7161ed673a59be42`](https://github.com/opensearch-project/data-prepper/tree/0c8acd7ffc0328b1f9dbd9bc7161ed673a59be42),
version `2.17.0-SNAPSHOT`. Validation performed on September 26, 2026.
The reference checkout was read without modification.

This is **source-derived contract validation**, not an execution comparison
against a running Data Prepper JVM. Expected results were derived from upstream
processor implementations, configuration defaults, and tests, then checked
through the workbench's public `simulatePipeline` entry point. The browser
simulator remains a preview of supported event transformations, not a replacement
for validating a production pipeline with Data Prepper.

Current scope is **processing only**: processor transformations, configuration
options, and expression behavior. Sources, sinks, routing, and runtime lifecycle
are excluded from this work.

## Reproduced differences and repairs

The initial 48-case contract suite reproduced **40 failures**. The expanded suite
now contains **324 checks**, covering output data, immutable input, conditional
options, processing expressions, malformed pipelines, and unsupported options.

| Area | Behavior verified or corrected | Upstream reference under the Data Prepper checkout |
| --- | --- | --- |
| Event paths | Slash paths work with or without a leading slash; dots are literal; `~1` and `~0` tokens are decoded; existing prototype protections remain | `data-prepper-api/.../event/JacksonEventKey.java` and `JacksonEvent.java` |
| `add_entries` | Preserve existing fields by default, including null; explicit overwrite; literal `value` versus interpolated `format`; expressions; append list behavior; `add_when`; dynamic keys; list iteration, root/element value contexts and predicates, literal/nested key modes, and sequential writes; null/missing formatting and Java collection string representations; literal `metadata_key` writes with overwrite/append rules | `data-prepper-plugins/mutate-event-processors/.../AddEntryProcessor.java` and `AddEntryProcessorConfig.java` |
| `copy_values` | Preserve destination by default; explicit overwrite; nested paths; `copy_when`; list projection with literal item keys, root predicates, empty item preservation, and explicit target-list overwrite | `data-prepper-plugins/mutate-event-processors/.../CopyValueProcessor.java` and `CopyValueProcessorConfig.java` |
| `rename_keys`, `delete_entries` | Nested paths, literal dotted names, and `rename_when` / `delete_when`; whole-key regex selection; recursive map key case transformation; sequential delete entries; deletion within lists with element predicates and regex exclusions | `data-prepper-plugins/mutate-event-processors/.../RenameKeyProcessor.java` and `DeleteEntryProcessor.java` |
| `parse_json` | Nested destinations; pointer result keeps its leaf name or full dotted pointer on root conflict; array pointer names; depth conversion applies to maps, not arrays; root source deletion precedes merge; JSON null passes through; `parse_when`; `tags_on_failure` for invalid JSON, JSON null, non-object root output, and missing source with a pointer; clean missing-source skip without a pointer | `data-prepper-plugins/parse-json-processor/.../parse/AbstractParseProcessor.java`, `parse/json/ParseJsonProcessor.java`, and `ParseJsonProcessorTest.java` |
| `csv` | Persist parsed columns and header/source deletion; quoted delimiters; configured header fallback; `csv_when`; explicitly reject the upstream `multiline: true` option because event expansion is not implemented | `data-prepper-plugins/csv-processor/.../CsvProcessor.java` and `CsvProcessorConfig.java` |
| `flatten` | Persist target writes; remove source fields while retaining the source object and exclusions; option aliases; custom separator; list index removal; `flatten_when` | `data-prepper-plugins/flatten-processor/.../FlattenProcessor.java` and `FlattenProcessorConfig.java` |
| `split_string` | Java `Pattern.split` behavior: omit captured separators and trailing empty elements; retain empty input; literal delimiters; `split_when` | `data-prepper-plugins/mutate-string-processors/.../SplitStringProcessor.java` |
| `substitute_string` | Persist replacement writes; Java numeric and named capture references, group zero, and escaped dollar signs; `substitute_when` | `data-prepper-plugins/mutate-string-processors/.../SubstituteStringProcessor.java` |
| `truncate` | Start/length example from upstream tests; `recursive`; empty source lists select nothing; out-of-range start stops the processor and retains previous work; `truncate_when` | `data-prepper-plugins/truncate-processor/.../TruncateProcessor.java` and `TruncateProcessorTests.java` |
| `obfuscate` | Persist default mask writes; `obfuscate_when`; reject unimplemented hash action and invalid patterns; `tags_on_match_failure` when masking leaves the string unchanged, with clean skips for missing sources and false conditions | `data-prepper-plugins/obfuscate-processor/.../ObfuscationProcessor.java` and `MaskAction.java` |
| `key_value` | Persist default destination writes; lenient versus strict whitespace; drop unmatched entries by default; `key_value_when`; skip, overwrite, merge-preserve, and merge-overwrite destination strategies; root merge and non-map conflict behavior; capitalization preserves remaining case | `data-prepper-plugins/key-value-processor/.../KeyValueProcessor.java`, `KeyValueProcessorConfig.java`, and `data-prepper-api/.../event/JacksonEvent.java` |
| `grok` | Target map writes, empty target on no match, merge existing captures by default, `keys_to_overwrite`, and `grok_when`; `tags_on_match_failure` when the capture map is empty, including empty/missing sources and patterns without captures | `data-prepper-plugins/grok-processor/.../GrokProcessor.java` |
| `date` | `date_when`; recognize upstream `epoch_milli` and default ISO formatter spelling; remove unconditional native date parsing fallback | `data-prepper-plugins/date-processor/.../DateProcessor.java` and `DateProcessorConfig.java` |
| Expressions | Comparisons, parentheses, literals, deep map/list equality, missing/null fields, arithmetic precedence and unary minus, string concatenation, homogeneous literal sets with `in`/`not in`, whole-string regex comparisons, nonnumeric `typeof`, `length`, `contains`, `startsWith`, nested functions, and `join` list/map behavior; `and`/`or` have equal precedence upstream; legacy `&&`/`||`/`!` preserved | `data-prepper-expression/src/main/antlr/DataPrepperExpression.g4`, `.../OperatorConfiguration.java`, `.../ParseTreeEvaluatorListener.java`, `.../LengthExpressionFunction.java`, `.../ContainsExpressionFunction.java`, `.../StartsWithExpressionFunction.java`, `.../JoinExpressionFunction.java`, and `.../GenericExpressionEvaluator_ArithmeticIT.java` |
| Metadata and tags | Metadata survives all supported processor steps independently of body fields; isolated per input event; metadata-aware list contexts; `getMetadata` trims its argument and traverses nested maps without JSON Pointer decoding or array indexing; `hasTags` requires every requested tag; tag additions deduplicate; invalid metadata/tag function arguments report errors | `data-prepper-api/.../event/DefaultEventMetadata.java`, `data-prepper-expression/.../GetMetadataExpressionFunction.java`, and `HasTagsExpressionFunction.java` |
| Pipeline structure | Reject multiple pipelines rather than concatenating independent processor chains; report malformed structure and selected invalid plugin options before processing | `data-prepper-core/.../pipeline/Pipeline.java` and plugin constructors/configuration classes |

Older local property tests that assumed nested dot paths, automatic overwrite,
or value interpolation were updated to reflect the reference behavior.

Processing results expose attributes and tags through each event's optional
`outputMetadata` field. The Metadata tab displays and copies them separately;
Diff also shows them alongside the event body. Body output and its Copy action
serialize only event data. Metadata cloning and the UI copy/display behavior
have separate regression checks in addition to the contracts above.

## Compatibility limits

- The simulator accepts one pipeline at a time. Sources, sinks, buffers, routes,
  pipeline links, acknowledgements, concurrency, and lifecycle are not executed.
  Samples are parsed locally into event objects with initially empty processing
  metadata. Attributes and tags are modeled; event type, received time, external
  origination time, and source-created metadata are not reproduced.
  Unsupported processors are skipped with an explicit warning.
- Only a subset of each plugin's configuration is implemented. Unknown options
  and unknown entry options produce warnings. Remaining processing options include
  key normalization, failure tags for other processors, and recursive key-value
  parsing. A warning means the result does
  not validate those options. List copying, list deletion, regex key selection,
  key case transformations, and key-value destination conflict strategies are
  covered by the supported contracts above.
- Conditions, value expressions, and dynamic keys share a structured local
  expression evaluator. The functions listed above and `getMetadata`/`hasTags`
  are supported; date functions, variables, and the complete upstream grammar/type
  system are not implemented. Unsupported functions and
  numeric `typeof` produce explicit processing errors. Numeric operations use
  JavaScript numbers and do not reproduce Java Float rounding, integer overflow,
  Long precision, or BigDecimal behavior. Non-finite results are rejected because
  JSON events cannot represent them. Set membership retains primitive types,
  but cannot reproduce distinctions between Java numeric classes. Standalone
  set outputs are explicitly rejected; sets are supported for membership tests.
  Literal and collection formatting may differ in map ordering or numeric text.
  Malformed/invalid dynamic keys produce an explicit processing error; upstream
  exception recovery and all incidental metadata side effects are not reproduced.
- JavaScript regular expressions do not implement every Java regex construct.
  The split and replacement rules covered by the fixtures match the referenced
  Java methods, but the regex engines are not interchangeable. Grok uses a
  reduced built-in pattern set and does not reproduce timeouts or all capture
  conversions. Grok previews emit a compatibility warning.
  Regex key operations and regex expressions also emit a compatibility warning.
  Regex expressions reproduce whole-string matching and false results on missing
  left operands or invalid patterns, including the negated operator.
  Rename patterns that
  match several root keys, and case transformations that collide, can depend on
  map iteration order; Java and JavaScript map ordering differ, so the winning
  value in such collisions is not covered by these contracts.
- Date previews use a small set of formats and JavaScript dates, normalize output
  to UTC, and cannot reproduce all Java formatter, locale, timezone, precision,
  and event-received-time behavior. Date previews emit a compatibility warning.
  `date_when` is tested; complete date output parity is not claimed.
- CSV `multiline: true` event expansion and obfuscation hash actions are explicitly
  rejected. `split_string` mutates a field into an array; it is distinct from
  Data Prepper's unsupported `split_event` processor.
- Parsing failures generally pass the original event through, with configured
  tags in the cases listed above. Tags are sets upstream; displayed tag order is
  a local presentation choice. Timeout tags, other plugins' failure tags, backend
  metrics, detailed exception handling, partial writes in every exceptional case,
  and all event array mutation rules are outside this validation. CSV and date
  do not expose upstream failure-tag options; no generic failure tags are added.
- `mutate`, generic `when`, bare field references, single-quoted literals,
  `${field}` value expressions, `&&`/`||`/`!`, presence-based truth conversion,
  and historical date aliases remain simulator extensions. The legacy `mutate`
  processor emits a warning because it is not an upstream Data Prepper plugin.
  `&&` retains higher precedence than `||`; upstream `and`/`or` associate from
  left to right with equal precedence. Use parentheses to express mixed intent.

## Reproduce the checks

Run the contract suite from the workbench repository root:

```sh
npx vitest --run src/__tests__/property/dataPrepperParity.property.test.ts
```

Run the broader checks:

```sh
npm test
npm run lint
npm run build
```

Validation results: 324 contract checks passed; the full suite passed 1,351 tests
with one existing test skipped. Lint, TypeScript checking, the production Vite
build, and `git diff --check` passed.

The existing gRPC tests in the full suite require localhost listen access.
No Data Prepper download or backend is required for these source-derived fixtures.
When the upstream checkout changes, re-check the referenced processor methods
and defaults before treating these fixtures as validation of the new version.
