# BUG_20261011_native-confirm-called-from-logic

**Status:** OPEN

## Symptom
Several actions ask the user with the browser's own `confirm()` box: a plain grey system dialog that looks
nothing like the app, cannot be styled, cannot say more than OK/Cancel, and blocks the page. T031's failed
save ("Could not save: browser storage is full. Export all projects to a file?") is the newest one.

## Evidence
- `packages/ui/src/logic/applicationIO.ts` `handleSaveFailure()` calls the global `confirm(...)` from logic.
- `packages/ui/src/hooks/OriginalShell-hooks.ts` and `MobileShell-hooks.ts` `confirmDiscard()` call `globalThis.confirm(...)`.
- `packages/ui/src/main.ts` passes `confirmReset: (question) => confirm(question)` to the driver browsing state (injected, but still native).
- `packages/ui/src/ui/components/DriverEditorModal.vue` (legacy .wdr import warning) and `OptionsModal.vue` (restore from backup) call `confirm(...)` directly.

## Cause
No injected confirm port and no in-app confirm dialog exist, so each caller reaches for the global. Logic calling a
browser global breaks the injection rule (a logic module receives its collaborators), and the native box breaks the look.

## Fix
- One typed confirm port, `ask(request) -> Promise<ConfirmAnswer>`, injected at the composition root; every call site above takes it as a dependency, no global `confirm` anywhere under `packages/ui/src`.
- One in-app confirm dialog component hosted once (App.vue), used by both skins; plain short texts, a named confirm button ("Export", "Discard", "Restore") instead of OK.
- A lint/architecture test bans `confirm(` under `packages/ui/src`.

## Verification
- Unit: each call site with a fake port (answers yes / no).
- Browser: the failed-save prompt, the revert prompt and the restore prompt appear as the in-app dialog on both skins.
