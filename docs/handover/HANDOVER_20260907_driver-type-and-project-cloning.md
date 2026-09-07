# Handover — 2026-09-07 — driver_type accessor, deep-clone fix, save-before-export

## Done, uncommitted

### `OpenISDDriver`/`OpenISDProject` clone methods were shallow, not deep

`cloneDriver()` and the project equivalent used `{...this.record.get()}` /
`{...this.#current()}` — a one-level spread. Every nested field object (`brand`, `driver_type`,
`specs.woofer.Fs`, `box`, `driver`, `environment`, …) stayed the same reference as the live
record, so a caller mutating the "clone" mutated the original too.

`packages/design/domain/project.ts`:

- `OpenISDDriver.cloneDriver()` and `OpenISDDriver.detach()` now use `structuredClone()`.
- `OpenISDProject`'s equivalent method is renamed `cloneSavedProject()` (was `cloneProject()`
  earlier in this session, briefly; before that, `recordToPersist()`) — see next section for why
  it changed name again. Uses `structuredClone()`.

### `cloneSavedProject()` reads `#saved` only, never `#edited`

`OpenISDProject` holds two records — `#saved` (as of the last save) and `#edited` (every change
since, or `null`). The persistence seam must never write out unsaved changes on its own: writing
a file/share-link/localStorage record is a distinct thing from what the user has typed into the
form right now.

`cloneSavedProject()` now reads `this.#saved` directly, not `this.#current()` (`#edited ??
#saved`).

### Every export path calls `project.save()` immediately before cloning

Because `cloneSavedProject()` only sees `#saved`, an export of a dirty (edited-but-unsaved)
project would silently drop the user's in-progress edits unless something promotes `#edited` →
`#saved` first. John's ruling: **no autosave** — the promotion must be the direct result of a
user action, never a background trigger.

The fix: `packages/design/domain/project.ts`'s `projectRepo().save(project)` — the one seam every
export path already funnels through (`saveToFile`, `saveToNewFile`, `stateToUrl`, all via
`packages/persistence`'s `payloadOf()`) — now does:

```typescript
save(project: OpenISDProject): void {
    project.save();                          // promote #edited -> #saved, explicitly, here
    const json = project.cloneSavedProject();
    store.put(project.uuid(), json);
},
```

This is not autosave: `projectRepo().save()` only runs when the user has clicked Save, Save As,
or Share Link — each of those IS the user action. No timer, no watcher, no side effect of an
unrelated read triggers it.

`stateToUrl` needed no separate handling — it already goes through the same `payloadOf()` →
`repo.save(project)` path, so it gets the same promote-then-clone behaviour for free. (John:
"if you do an export then a domain.save() is done automatically, which means that for export
there is never a need to look at #edit[ed]".)

### Callers updated for the rename

- `packages/ui/src/logic/appState.ts` — one doc-comment reference
  (`OpenISDProject.cloneProject()` → `cloneSavedProject()`).
- `packages/persistence/test/projectRepo-boxtype.test.ts` — the fixture builder now calls
  `project.save()` before `project.cloneSavedProject()` (previously called `cloneProject()`
  directly on a project that was never saved — worked before only because `cloneProject()` used
  to read `#current()`).

### `driver_type` — bug recorded, no schema change made

`bugs/BUG_20260907_driver_type_has_no_closed_set_shared_with_python.md` — `driver_type` is a
free string (`textField`/`z.string()`) on both the TS domain schema and the Python scraper, with
no shared closed-set enum backing it, even though the field is documented as a closed vocabulary.
`packages/design/filter/DriverType` looked like a candidate but is explicitly UI/search-only
(`.chips`, used only by `driverDisplay.ts`'s chip-matching) — reusing it for the domain would
couple the domain layer to a display concern, so it must NOT be used here.

`OpenISDDriver.driverType(): string` stays returning the raw string (reverted twice this session
after two false starts — once returning `filter/DriverType`, once with `DriverType.parse()`
folded in). Its doc comment now lists the 10 values seen across the driver.yml corpus (`woofer`
902, `full-range` 335, `tweeter` 320, `subwoofer` 138, `midrange` 134, `passive-radiator` 78,
`mid-woofer` 46, `coaxial` 36, `mid-bass` 19, `amt` 5) and a `TODO` pointing at the bug file.

**Not done**: creating the actual shared Python/TypeScript enum. That's the bug's fix, not yet
scoped or built.

**Started and reverted twice in this session, now clean**: `driverType()` was changed to return
`packages/design/filter/DriverType` (once directly, once via `DriverType.parse()`), then reverted
both times after John flagged the domain layer must not depend on a UI/filter-only enum. Checked
the final diff (`git diff packages/design/domain/project.ts` / `driverDisplay.ts`) — no leftover
`DriverType` import or dead code from either attempt; the method is back to its original shape
plus the doc comment and TODO above.

## Verification run this session

- `npx tsc -p packages/design --noEmit` — clean
- `npx tsc -p packages/persistence --noEmit` — clean
- `npx tsc -p packages/ui --noEmit` — clean of any `cloneDriver`/`cloneSavedProject`/`driverType`
  errors (pre-existing unrelated backlog untouched — see below)
- `npx vitest run packages/design/test/domain.test.ts packages/persistence/test/projectRepo-boxtype.test.ts`
  — 42/42 pass

Full health check (`bash scripts/health-check.sh`) was **not** run this session — only the
narrow suites above.

## Still open, not started this session

1. **The `driver_type` shared enum itself** — per the new bug file. Needs a closed-set type
   declared once and read by both the Python scraper and the TypeScript domain, kept in parity
   the way `filter/driverType.ts` and `test_driver_type_enum_parity.py` already do for the
   UI-only `DriverType`. Lives in `packages/design/domain/`, NOT `packages/design/filter/`.
2. **`useDesignIO.ts`'s dead `loadDriverFromWdrText`/`loadDriverFromOwdrText` calls** — these
   don't exist anywhere in `packages/design` (confirmed via grep). Replacement per John's
   steer: `OpenISDProject.loadDriver(driver: OpenISDDriver): void`, mirroring `setDriver()`,
   loading only from a standalone driver (file, driver bundle, or My Drivers) — never from an
   embedded driver. `OpenISDDriverStandalone` itself is not exported from `domain/index.ts`, so
   the public parameter type has to be the exported `OpenISDDriver` base class, not the
   standalone subclass.
3. **`packages/ui` typecheck backlog** — pre-existing, untouched this session:
   `driverBrowsingState.ts`, `useDesignIO.ts` (`exportDriverWdr`, `exportDriverOwdr`,
   `exportWpr`, `importWpr` also missing, on top of the load methods above), `main.ts`,
   `gen-scenarios.ts`, `persist.test.ts` (missing `OpenISDProject` setters: `setActiveBoxType`,
   `setBoxVolume_m3`, `setFrontVolume_m3`, `setVentShape`, etc.).
4. **`WinISDProject#driverSection` has no production populator** (from the now-RESOLVED bug
   `BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md`'s
   related-but-separate note) — the `.wpr` `[Driver]` section's `driverType` tag preservation is
   unverified for the actual `.wpr` export path; only tests currently supply `build()`'s
   `driverSection` parameter.

## Note on the working tree

`git status` shows a much larger uncommitted diff than this session touched (61 files, incl.
`OriginalShell.vue`, `driverSelection.ts`, `fieldRegistry.ts`, `useDriverCells.ts`,
`presentationState.ts`, several `docs/plans/*.md`) — pre-existing work from earlier in the
`packages/model` → `packages/design` migration, not started or left unfinished by this session.
Nothing here was reviewed or verified this session; do not assume it is finished or broken based
on this handover.

## Inbox — unrelated, still open

QO87 (precision model), QT73 (B10 leftovers), QT75 (B10 per-driver census) — all `DEFERRED`, not
touched this session.
