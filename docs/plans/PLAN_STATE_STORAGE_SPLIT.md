# Plan — split view state into project state and app state

Rulings: QO130 (John, 2026-09-09). This plan reverses the QO90 ruling for every field in the
PROJECT table below: a saved `.owpr` now carries them.

## The principle

Three homes, decided per field by what the value is about:

| Home | Holds | Where |
|---|---|---|
| **Project** | anything about THIS design — how it is modelled, and how it is being looked at | inside `OpenISDProject`, saved in the `.owpr` |
| **App** | anything about the person using the app, across every design | one browser storage key |
| **Neither** | anything whose loss on refresh costs nothing | `presentationState`, live only |

## Project state

Goes into `OpenISDProject`, saved in the `.owpr`.

| Current | Current location | Becomes | Notes |
|---|---|---|---|
| `lossMode` | `presentationState.lossMode` → `ViewSnapshot.lossMode` | `lossMode` | Typed as the engine's `LossMode` enum, not `string`. Selector already sits correctly on the Box tab. |
| `graphs` | `presentationState.graphs` → `ViewSnapshot.graphs` | `graphs` | Which chart tabs are open, ordered. |
| `cursorF` | `presentationState.cursorF` → `ViewSnapshot.cursor.f` | `cursorF` | Frequency under the pointer (Hz); null off-plot. |
| `pinnedF` | `presentationState.pinnedF` → `ViewSnapshot.cursor.pinnedF` | `cursorPinnedF` | Frequency clicked to pin. |
| `cursorLocked` | `presentationState.cursorLocked` → `ViewSnapshot.cursor.locked` | `cursorLocked` | Held against hover. Kept because `pinnedF` alone is ambiguous on restore. |
| `dragRange` | `presentationState.dragRange` → `ViewSnapshot.cursor.range` | `cursorRange` | Dragged band `{fLo, fHi}`. |
| `ui.chartColors` | `presentationState.ui` → `ViewSnapshot.ui` | `chartColors` | Per-line colour overrides. |
| `ui.originalChartTab` | `presentationState.ui` → `ViewSnapshot.ui` | `selectedChart` | `original` was the deleted skin's name. |
| `ui.originalProjectTab` | `presentationState.ui` — undeclared, riding the index signature | `selectedProjectTab` | Gains a declared type. |
| `yRanges` | `presentationState.yRanges` — **persisted nowhere** | `chartYMin` / `chartYMax`, **per chart type** | Lost on every reload today. |
| *(none)* | — | `chartFreqMin` / `chartFreqMax`, **one pair for the whole project** | New state. All charts share one frequency axis. |

## App state

One browser storage key, replacing `openisd.view`.

| Current | Becomes | Notes |
|---|---|---|
| `ui.username` | `username` | No OS-user lookup exists in a browser. Empty until the user types a name; from then on it is the default for anything new. |
| `ui.unitTokens` | `unitTokens` | Preferred display unit per field. |
| `ui.envDefaults` | `envDefaults` | Temp/pressure/humidity a NEW project starts from. The project holds its own live values. |

## Not persisted

Stays on `presentationState`, live only — unchanged from today. The test John set: store it only
if it helps across a page refresh or a crash. None of these do, because the input behind each
dialog is not stored either, so restoring the flag alone reopens an empty dialog.

`newProjectOpen`, `browseOpen`, `editDriver`, `editDriverInfo`

## Deleted

| Thing | Why |
|---|---|
| `ui.originalChartLabel` | John: "junk". The display label of `selectedChart`. |
| `ViewSnapshot` (`packages/persistence/src/repos/projectRepo.ts:38`) | Splits into project fields and app fields; nothing is left to hold. |
| `viewStateRepo.ts` | Replaced by the app-state repo. Its `parsed as ViewSnapshot` cast goes with it. |

## Storage keys

`openisd_my_drivers`, `openisd_pr_lib`, `openisd_favorite_drivers` and `openisd.view` use two
different separators and three naming styles. One convention across all of them: lower case,
words separated by underscores, `openisd_` prefix.

| Current | Becomes |
|---|---|
| `openisd_my_drivers` | `openisd_my_drivers` — unchanged |
| `openisd_pr_lib` | `openisd_my_passive_radiators` |
| `openisd_favorite_drivers` | `openisd_my_favourite_drivers` |
| *(none — see the bug below)* | `openisd_my_favourite_passive_radiators` |
| `openisd.view` | `openisd_app` |

**No migration** (John: "no migration - as there is no user"). Renaming a key orphans whatever
sits in a developer's browser.

## Related defects

Recorded separately; settle the favourites identity scheme before building the favourites half.

- `bugs/BUG_20260909_loss_mode_is_app_wide_so_it_is_wrong_for_every_project_but_the_last_one_touched.md`
- `bugs/BUG_20260909_a_saved_copy_of_a_bundled_driver_shares_its_favourite_key_so_one_star_stars_both.md`
- `bugs/BUG_20260909_passive_radiators_cannot_be_favourited_at_all.md`

## Verification

1. `npx tsc -p packages/design --noEmit`, `packages/persistence`, `packages/ui` — 0 errors.
2. `packages/ui/test/logic/persist.test.ts:199` INVERTS: the test currently asserts a saved file
   carries no `ui`/`cursor`/`graphs`/`lossMode`. It must assert the opposite for every field in
   the PROJECT table, and still assert the APP fields are absent.
3. A browser test: set a loss mode and a Y range on project A, open project B, confirm B is
   unaffected; save A, reload, reopen, confirm both come back.
4. `bash scripts/health-check.sh` green.
