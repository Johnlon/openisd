# PLAN 2026-10-14 — Options › "Your data"

One tab replaces Backup + Storage history. Cloud sync is already its own dialog (menu item, `CloudSyncDialog`), not an Options tab: untouched. Delta on T168 (`openisd-t168`); T169's refused copies arrive through `storageHistory.entries()` and need no UI change beyond the row words below.

Facts checked: Options tabs are a no-wrap flex row (`.opt-tabs`), 4 tabs incl. "Export / Import" overflow a 360 px phone; 3 fit. Mobile shows the same `OptionsModal` full-screen (`.mob-options`), so one layout serves both skins. No formatted storage breakdown exists today (Diagnostics only dumps raw bytes per key in the fault log); T168 adds only the backups total. Bin confirm text already lives in `packages/design/fields/projectBinText.ts` and every Bin action already takes a backup first.

## Wireframe — Original (470 px)
```
Options                                            ✕
[General] [Plot Window] [Your data]
┌ Storage ───────────────────────────────────────────┐
│ Using 2.1 MB of about 5 MB in this browser.        │
│ Projects 0.9 MB · My Drivers 0.1 MB · Bin 0.2 MB   │
│ Backups 0.8 MB · Settings 0.1 MB                   │
│ [Empty Bin]  [Delete all backups]                  │
├ Backups ───────────────────────────────────────────┤
│ A backup of everything is made before anything is  │
│ restored, repaired or deleted. The newest 3 are    │
│ kept, plus the last one made before an app update. │
│ [Back up now]                         Total 0.8 MB │
│ ┌ 14 Oct 2026, 14:01  Before delete  3 projects  0.3 MB │
│ │ [Restore everything] [Restore one project] [Export] [Delete]
│ ┌ 13 Oct 2026, 17:01  Would not load  Project "Sub 12"  12 KB │
│ │ [Export] [Delete]                                 │
├ Export / Import ───────────────────────────────────┤
│ Everything in this browser as one file: projects,  │
│ My Drivers, My Passive Radiators, settings.        │
│ [Export everything]  [Import file…]                │
│ ☐ Remove what the file does not hold               │
└────────────────────────────────────────────────────┘
```
## Wireframe — Mobile (full-screen pane, single column, no sideways scroll)
```
Options                                  ✕
[General] [Plot Window] [Your data]
Storage
Using 2.1 MB of about 5 MB in this browser.
Projects      0.9 MB      (dl, two columns)
My Drivers    0.1 MB
Bin           0.2 MB
Backups       0.8 MB
Settings      0.1 MB
[Empty Bin] [Delete all backups]
Backups  …same rows; buttons wrap to two lines (already flex-wrap)
Export / Import  …same, buttons stacked
```

## Strings
| Where | Text |
|---|---|
| Tab | Your data |
| Storage legend / line | Storage / "Using {used} of about 5 MB in this browser." |
| Storage rows | Projects, My Drivers (incl. passive radiators + favourites), Bin, Backups (whole-store + kept copies + refused), Settings (everything else) |
| Storage buttons | Empty Bin (disabled when Bin empty), Delete all backups (disabled when none) |
| Backups legend / help | Backups / "A backup of everything in this browser is made before anything is restored, repaired or deleted. The newest 3 are kept, plus the last one made before an app update; older ones are removed. Copies of records that were repaired or would not load stay until you delete them, or a save needs the room." |
| Backups head | Back up now · "Total {size}" · empty list: "No backups yet." |
| Backup row | "{taken}  {reason}  {n projects}  {size}"; reasons as T168 `reasonText` |
| Copy row (T168) | "{taken}  Before repair / Would not load  {holds}  {size}" |
| Refused row (T169) | "{taken}  Would not load  Project "{name}"  {size}"; unnamed: Project (unreadable) |
| Row notes | "This backup cannot be read. You can still export or delete it." / "Saved by a newer OpenISD. Update the app to restore it." |
| Row buttons | Restore everything · Restore one project · Export · Delete (copies/refused: Export · Delete) |
| Picker | "Restore one project" list; per row Restore; Close; empty: "This backup holds no saved project." Flash: Added "{name}" to your saved projects. |
| Export / Import legend / help | Export / Import / "Everything in this browser as one file: projects, My Drivers, My Passive Radiators and settings. The built-in driver catalogue is not included." |
| Export / Import buttons | Export everything · Import file… · ☐ Remove what the file does not hold |
| Flashes | Backed up everything in this browser. / Nothing is saved in this browser yet, so there is nothing to back up. / There is no room for another backup. Delete an old one, or export and delete. / That is no longer there. / Bin emptied. / All backups deleted. |

## Actions
| Action | Confirm (title / message / OK) | Backup first |
|---|---|---|
| Back up now | none | is one |
| Restore everything | Restore everything from this backup? / Everything in this browser is replaced by what is in this backup: all projects, My Drivers, My Passive Radiators and settings. A backup of what is here now is made first. Continue? / Restore | yes |
| Restore one project | none; adds a copy named by `restoredProjectName`, never overwrites | no |
| Export (row) / Export everything | none | n/a |
| Delete (row) | Delete this backup? (copy: Delete this copy?) / It is removed from this browser. Export it first if you may want it back. Continue? / Delete | no |
| Delete all backups | Delete all backups? / Every backup and kept copy is removed from this browser, including the one from before the last app update. Export any you may want first. Continue? / Delete | no |
| Empty Bin | existing `emptyBinMessage(count, size)` / Delete | yes (existing) |
| Import file… (unticked) | Import this file? / What is in the file (projects, My Drivers, My Passive Radiators, settings) is put into this browser, replacing the same items. Anything the file does not hold is kept. A backup of what is here now is made first. Continue? / Import | yes |
| Import file… (ticked) | Import this file? / Everything in this browser is replaced by what is in this file. Anything not in the file is removed. A backup of what is here now is made first. Continue? / Import | yes |
| After restore/import | alert "Restored ({n} items). The app will now reload." then reload | – |

## T168: stays / changes
Stays: `StorageHistory.vue` list + picker, `StorageHistory-hooks.ts` views/reasons, `MAX_BACKUPS = 3`, pre-upgrade exemption, `entries()`/`totalSize()`, all tests of those.
Changes: (1) `OptionsModal.vue` tab union → `'General' | 'Plot Window' | 'Your data'`; the Your data branch renders `<StorageUsage/>`, `<StorageHistory/>`, then the existing Export/Import fieldset with the new words; (2) "Download" → "Export" in button, note and delete message; keep-rule help text as above (hook `keepRule` string); (3) `useBackupSettings` confirm/alert words as above; (4) new `StorageUsage.vue` + `StorageUsage-hooks.ts` (display only) over a new persistence `storageUsage()` returning bytes per group from the known key list (`storageKeys.ts`; `OPENISD_CLOUD_PREFIX`/layout/log/app_settings/view → Settings), `removeAllBackups()` on `StorageHistory`, `emptyBin` via existing `projectBinActions.emptyBin`; `formatByteSize` from design; 5 MB is a design constant `BROWSER_STORAGE_LIMIT_BYTES` with the "about" in the text; (5) `mobile-storage-history.browser.spec.ts` tab text "Your data".

## Tasks
1. Persistence: `storageUsage()` + `removeAllBackups()` with unit tests (one spec each).
2. UI: `StorageUsage` hook + vue; Options tab rename and layout; string changes in `StorageHistory-hooks.ts`, `useBackupSettings.ts`, `OptionsModal.vue`.
3. Tests: fix the two tab-text browser specs; one hook test for the new strings; typecheck.
