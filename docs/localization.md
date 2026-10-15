# Interface languages

The shared header opens Preferences in every workspace. Its Language setting offers System default, English, and 日本語. System default is selected until an explicit preference is saved and follows changes to the host’s language settings. Switching languages updates the current interface without reopening documents. The selection is saved under `workbench:language` in local storage and synchronized between windows. System default uses the first supported language reported by the browser or desktop webview; unsupported languages fall back to English. Previously saved English/Japanese selections remain explicit overrides.

Japanese translations cover navigation, file actions and recovery, connection settings, Notebook cells and gRPC help, Investigation charts, Data Prepper processing controls, and ISM controls and reference descriptions. Recent-file dates use the selected locale. Native Open/Save dialog titles are translated; the operating system controls the dialog's other labels.

Queries, API identifiers, configurations, credentials, document titles, filenames, results, and exported content are preserved. Server and simulator diagnostics and third-party editor messages retain their original language when no translation exists.

## Adding interface messages

Use `t('English interface text')` from `src/i18n` at rendering time and add the corresponding entry to `src/i18n/ja.ts`. English source text is the fallback, so a missing translation cannot blank out a control. Components that render translations subscribe with `useLanguage()`, including memoized components. Include the returned language in memo/effect dependencies when generating translated text outside JSX, such as D3 diagrams.

Translate complete sentences with named interpolation fields, for example `t('Discard “{name}”?', { name: document.name })`. Keep interpolation fields identical in every translation and do not translate the interpolated document content. Use separate singular/plural source messages where English needs them; Japanese may use the same translation for both.

Use `formatDate(timestamp)` for interface dates. New language support requires adding a catalog, extending `Language`, language detection, locale formatting, and the Preferences options. Localization tests verify preference handling, interpolation, reference coverage, native dialog requests, and live switching across all four view toolbars.
