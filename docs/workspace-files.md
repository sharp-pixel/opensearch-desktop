# Workspace files

Notebook, Data Prepper, ISM, and Investigation now share a file-based workflow.
Each view starts with **Recent files**, **Unsaved documents**, and **Recovered
changes**. Files stay in your project folders; the app keeps recovery copies.

## Open and save

**New** preserves your previous draft and creates another document. **Open** uses
the native file picker. The first **Save** prompts for a location; subsequent
saves update that file. **Save As** chooses another location. Desktop saves are
atomic and compare the last-read revision to detect external changes.

Each view keeps its own history of up to 30 recent files. **Locate** selects a moved
or missing file; **Remove** only forgets the history entry. Discarding a recovery
draft requires confirmation and leaves the file on disk untouched. Deleting the
last Data Prepper or ISM draft leaves an empty workspace; New or Open creates the
next document.

Desktop builds put New, Open, Recent files, Save, and Save As in the native **File**
menu. These actions always target the current workspace. **Preferences…** lives in
the application menu on macOS (Cmd+,), and in **Edit** on Windows/Linux (Ctrl+,).
The in-window file and Preferences buttons remain available in the browser, and
as a fallback if the native menu cannot initialize. The filename and view-specific
tools stay below feature navigation.

Save and Save As are disabled on the files screen or when no document is open.
File commands are disabled during file operations and while a dialog is open.
Native menu labels follow the language selected in Preferences.

Shortcuts: Ctrl/Cmd+N, Ctrl/Cmd+O, Ctrl/Cmd+S, and Ctrl/Cmd+Shift+S. A filename with
`*` has unsaved changes. The footer distinguishes file saves from local recovery.
Recovery is autosaved even if the file has not been saved. Edits made while a save
is pending stay dirty. Closing waits for recovery writes and does not overwrite
files automatically.

A dirty file reopens its recovery copy. To load an externally edited file after a
conflict, save your changes elsewhere with Save As or discard the recovery draft,
then reopen the file. Clean files reload their content from disk.

## Formats

All supported files are UTF-8 JSON, with a `.json` extension and a 100 MiB limit.

| View | File contents | Default name |
| --- | --- | --- |
| Notebook | Existing version 1.0.0 envelope with notebook and tracking | `<name>.notebook.json` |
| Data Prepper | `sourceData`, `sourceFormat`, and `pipelineConfig` | `dataprepper.json` |
| ISM | Ordinary policy JSON, without a workbench wrapper | `ism.json` |
| Investigation | Version 1.0.0 envelope with `type: "investigation"`, investigation, and clusterGroup | `<name>.investigation.json` |

Existing Data Prepper JSON exports, including partial exports, remain supported.
Missing fields use the new-document defaults. ISM files can contain a `policy`
wrapper or the policy object itself. The policy must have a states array to open;
editing and recovery still allow incomplete JSON. Save requires valid JSON.

Investigation files contain PPL/Markdown cells, saved results, result display and
chart settings, and selected connection IDs. They do not embed connection
credentials or connection configurations. Connection IDs refer to connections
already configured in the app; choose available connections when moving a file to
another installation. Imported groups receive fresh local IDs, so opening a file
does not alter another investigation's selected connections.

Paths, revision hashes, recovery metadata, and recent-file history are never
included in exported documents. Chart images/data and security-role downloads
remain separate export actions.

## Existing work and browser use

Existing Data Prepper and ISM drafts remain recoverable. Old ISM recent policy
copies become unsaved recovery documents; existing investigations remain under
Unsaved documents. Opening another file never replaces these copies.

In the browser, Open loads a local copy and Save downloads a copy. Browser copies
remain under Unsaved documents and do not acquire filesystem recent entries.
Direct saving and reopening recent paths require the desktop app.
