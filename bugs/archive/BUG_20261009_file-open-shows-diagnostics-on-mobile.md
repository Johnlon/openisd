# BUG_20261009_file-open-shows-diagnostics-on-mobile

**Status:** RESOLVED

## Symptom
John, 9 Oct 2026, mobile (Android Chrome, openisd.app): opening the file-open dialog shows an "OpenISD diagnostics" dump (url, agent, faults, stored keys with byte sizes) instead of, or as well as, the file list.

## Evidence
- Stored keys at the time: openisd_projects 868819 B, openisd_projects_backup 868939 B, openisd_open_sessions 470554 B, openisd_open_sessions_backup 482340 B, others small: about 2.7 MB of browser storage, over half of a typical 5 MB limit.
- `listStoredProjects()` called `readRepairing(entry.text, null)`. When a project had any repaired field, `readRepairing` called `onRepaired({ ... })`, firing `faultLog.recordRepair` and causing `DiagnosticsModal-hooks` to set `open.value = true`.
- `DiagnosticsModal` (z-index 9999) rendered directly over `MobilePaneDialog` (z-index 100), hiding the file list behind the diagnostics modal. When clipboard permissions failed, `outcome.value = faultLog.report()` rendered the exact "OpenISD diagnostics" dump on screen.

## Cause
1. `readRepairing` in `packages/persistence/src/repos/projectRepo.ts` notified `onRepaired` even when `source === null` (unbacked listing/preview).
2. There was no explicit "Diagnostics" menu action in the UI, and `DiagnosticsModal` had no injection key / provider wired for explicit opening.

## Fix
1. In `packages/persistence/src/repos/projectRepo.ts`, `readRepairing` only calls `onRepaired` when `source !== null`. Listing stored projects (`listStoredProjects()`) never notifies repairs.
2. In `packages/ui/src/hooks/DiagnosticsModal-hooks.ts`, added `show()`, `close()`, `provideDiagnosticsModal()`, and `injectDiagnosticsModal()`.
3. In `packages/ui/src/ui/App.vue`, called `provideDiagnosticsModal()`.
4. In `packages/ui/src/ui/shells/mobile/MobileShell.vue` and `OriginalShell.vue`, added explicit "Diagnostics" action calling `diagnostics.show()`.
5. Adjusted `.mob-menu-item` padding to 5px so the complete menu continues to fit a 375×667 phone viewport without scrolling.

## Verification
- `bash scripts/test.sh packages/persistence/test/projectRepo.test.ts` — 33 passed (verifying `listStoredProjects` does not trigger `onRepaired`).
- `bash scripts/test.sh packages/ui/test/ui/mobile-file-open.browser.spec.ts` — 1 passed (file dialog shows list, no diagnostics text; explicit Diagnostics menu action opens modal).
- `bash scripts/test.sh packages/ui/test/ui/mobile-menu.browser.spec.ts` — 16 passed (all menu items including Diagnostics verified, fits 375×667 viewport).
- `bash scripts/quiet-test.sh npm run typecheck` — ok across all packages.
