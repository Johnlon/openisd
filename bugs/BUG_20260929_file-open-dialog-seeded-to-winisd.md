# BUG_20260929_file-open-dialog-seeded-to-winisd

**Status:** OPEN

## Symptom

File > Open (Import from disk) shows the system file dialog with its filter named "WinISD…".
John expects one filter that plainly covers OpenISD and WinISD projects (`.owpr`, `.wpr`) and
driver files (`.owdr`, `.wdr`), with the app deciding what to do by file type.

John, 2026-09-29: "file open project openens project file dls but seed it 'winisd' and it needd
to bne '*.owpr' and '*.wpr' or even the driver files forlamts and then you decide what to do
with it."

## Evidence

Checked 2026-09-29 on `main` at a0525698:

- `packages/ui/src/ui/shells/original/OriginalShell.vue:787`: the hidden input has
  `accept=".owpr,.wpr,.owdr,.wdr,.json"`, a hand-written string, not built from `fileFormat.ts`.
- `packages/ui/src/ui/shells/mobile/MobileShell.vue:28`: `accept=".owpr,.wpr"` — no driver
  formats.
- Both shells hand the chosen file to `useApplicationIO.importFile`
  (`packages/ui/src/logic/useApplicationIO.ts:178`), which already dispatches by format: driver →
  load into the open project or start the New Project wizard; `.wpr` / `.owpr` → open as a new
  project.
- The `<input accept>` attribute cannot name its filter; the browser names it.

## Cause

⚠ unverified: the browser (Chrome/Edge on Windows) names the filter from the OS-registered
file type of an accepted extension, and `.wpr` is registered to WinISD on John's machine.

## Fix

- Open with `window.showOpenFilePicker` and one explicit filter, "OpenISD and WinISD files",
  covering `.owpr`, `.wpr`, `.owdr`, `.wdr`; keep the hidden input as the fallback where the API
  is absent.
- Build that list once in `fileFormat.ts` (from `ProjectFileFormat.ALL` + `DriverFileFormat.ALL`)
  and use it for both shells' inputs, so the mobile shell also accepts driver files.
- Dispatch stays in `importFile`.

## Verification

- Unit test on the `fileFormat.ts` accept list (all four extensions).
- Browser test: Import from disk calls the picker with the one named filter; the chosen file
  reaches `importFile`.
- John checks the dialog on Windows.
