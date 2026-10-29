# BUG_20261017_export-all-is-silent

**Status:** FIXED (T268 Export all; T290 the four other silent exports)

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

## Audit and rulings (coordinator, 17 Oct 2026)
Every other button was checked from the code. Rulings:
- A two-second bottom message counts as a visible result, so these stay as they are: Save all, Save As,
  Export .wpr / .wdr / .owdr, Share link, Download or save a stored backup, imports.
- Save is fine: the unsaved mark clearing and the Save button dimming is its result.
- The four exports with nothing on screen got the same popup as Export all (T290), with what was
  exported and the file name:
  - Export my data (saved drivers cannot be read): "Exported your saved drivers, as they are stored, to my-drivers-export.json."
  - Export a damaged driver entry: "Exported the damaged driver entry to my-driver-<n>.json."
  - Export everything (newer-store screen): "Exported everything this browser holds for OpenISD to openisd-everything-<time>.json."
  - Export log (saved data is gone notice): "Exported the storage log to openisd-storage-log-<time>.json."

## Fix (T290)
- `exportedNotice` in `packages/design/fields/exportedNotice.ts` builds title and text for all five exports
  (a sum type, so a new export kind must be handled).
- `createExportNotice` in `packages/ui/src/logic/exportNotice.ts` is the one place that shows it, through the
  existing confirm dialog. Export all now goes through it too.
- The newer-store screen is its own small app, so it hosts the confirm dialog itself; the dialog now sits above it.
- Specs, one per button, both skins: `export-my-drivers-popup`, `export-broken-driver-popup`,
  `export-everything-popup`, `export-storage-log-popup` (`.browser.spec.ts`), plus `export-all-popup`.
- The T268 change made the quota-error spec (`projects-across-addresses`) fail, because Export now ends with the popup.
  That spec now reads the popup and answers OK.

Before and after: http://lap:8000/winisd/visual-pages/export-all-popup/index.html
