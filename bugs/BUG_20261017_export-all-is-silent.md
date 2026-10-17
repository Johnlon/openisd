# BUG_20261017_export-all-is-silent

**Status:** FIXED for Export all (T268). The audit list below is open.

## Symptom
Export all projects (mobile Projects pane) and Export all (Original Projects list) downloaded the
file and showed only a two-second message at the bottom, easy to miss. John, 17 Oct 2026: "button
must have visual impact so export all projects can't just do the export silently need conf popup".

General rule that came from it (`.claude/rules/general.md`, rule 4): every button shows a visible
result; nothing the app does happens silently.

## Fix
- Both skins, after the export, show the app's existing confirm dialog as a notice with one OK
  button: "Exported 12 projects to openisd-projects-2026-10-17.json."
- The sentence and the button text are built in `packages/design/fields/projectRows.ts`
  (`projectsExportedText`, `PROJECT_LIST_TEXT`).
- `ConfirmRequest.cancelLabel` is now optional; with none, the dialog shows only the confirm button.
- Specs: `export-all-popup.browser.spec.ts` (one per skin), unit test in `projectRows.test.ts`.

## Audit: other actions that finish with no clear result (not fixed here)
Only a two-second bottom message (easy to miss, gone before a slow reader looks):
- Save all (both skins): "Saved projects: N".
- Save As / Save a copy of a project: "Project saved as <file>".
- Export .wpr, Export driver .wdr, Export driver .owdr (Save As / Export menu, both skins).
- Share link: "Share link copied to clipboard".
- Download backup and Save a stored backup (Storage history).
- Import a file: "Project imported from <file>", "Imported N projects from <file>".

Nothing at all on screen:
- Save (toolbar, menu and mobile): the file or storage is written; the only change is the unsaved
  mark going away.
- Export my data (driver browser corruption panel): downloads `my-drivers-export.json`, no message.
- Export a broken driver entry (driver browser): downloads, no message.
- Export everything (store gate, newer-version screen): downloads `openisd-everything-<time>.json`,
  no message.
- Export the storage log (lost keys notice): downloads, no message.

Not checked by running each one; read from the code (`applicationIO.ts`, `driverBrowsingState.ts`,
`storeGate.ts`, `main.ts`).
