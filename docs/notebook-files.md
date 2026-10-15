# Notebook files

Notebook uses files as saved documents, with a separate local recovery draft.
The start screen and **Recent files** button replace the notebook dropdown.

## Desktop workflow

- **New** creates a notebook in **Unsaved notebooks**.
- **Open** uses the native file picker and accepts existing notebook JSON exports.
- **Save** prompts for a location on the first save, then updates that file.
- **Save As** prompts for another location and makes it the notebook's saved file.
- **Recent files** shows up to 30 paths, filenames, and last-opened times.
- **Locate** opens a picker for a moved or missing file. **Remove** forgets the
  recent entry without deleting the file or its recovery draft.

Shortcuts are Ctrl/Cmd+N, Ctrl/Cmd+O, Ctrl/Cmd+S, and Ctrl/Cmd+Shift+S.
The filename appears above the editor; `*` indicates unsaved work. The footer
distinguishes changes saved to the file from changes saved in recovery storage.
Renaming a notebook changes its title. Use Save As to change its filename.

Notebook files use the existing version 1.0.0 JSON envelope containing `version`,
`exportedAt`, `notebook`, and `tracking`. New files default to
`<notebook-name>.notebook.json`; existing `.json` files remain supported.
Local paths, recent-file metadata, and recovery state are not exported.

## Recovery and disk conflicts

Existing internal notebooks remain available under **Unsaved notebooks**.
Editing continues to autosave into the existing workspace recovery storage.
Opening another file or returning to Recent files does not discard these changes.

**Recovered changes** lists edits not yet saved to their associated files.
Reopening one of those files selects the recovery draft instead of replacing its
pending edits with disk content. Reopening a clean file reloads its disk content.
Discarding a recovery draft requires confirmation and never deletes its file.

Desktop writes replace files atomically and check the disk content revision before
overwriting an attached file. If another program changes the file, Save reports a
conflict: use Save As to preserve your edits, or discard the recovery draft and
open the changed file. Cancelled dialogs and failed saves retain the current work.
Edits made while saving remain marked as unsaved after that save finishes.
The desktop close guard waits for recovery saves and keeps the window open while
a file operation is pending. Closing does not implicitly overwrite the file.

Native access is limited to locations previously selected through an Open or Save
As dialog. Access grants are remembered in the desktop app's configuration folder,
allowing recent files to reopen after restart. Files must be UTF-8 and smaller
than 100 MiB; Save As requires a `.json` filename.

## Browser workflow

Open loads a local copy and Save downloads a JSON copy. The browser does not claim
a filesystem path or populate filesystem recent entries. Local copies remain
available under Unsaved notebooks. Direct save and recent-file reopening use the
desktop app.

Data Prepper, ISM, and Investigation use the same native file capability and
recent-file workflow. See [Workspace files](workspace-files.md) for their formats.
