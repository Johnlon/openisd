# OpenISD — state & memory model

What the app remembers, where each fact lives, and the exact moment a change becomes part
of the user's design. Every dialog, picker and panel obeys this; a component that does not
is a defect, not a variation.

The code that implements it is `packages/ui/src/logic/store.ts` plus two files under
`packages/ui/src/db/`: `useDriverSelection.ts` (draft → commit) and `useDriverLibrary.ts` (the
library picker). The rule that keeps skins from diverging is ARCHITECTURE.md AD-7.

**A note on a design that was tried and reverted (2026-08-12):** an earlier pass this session
built a `DriverSession` class that auto-cleared an inherited, now-contradicted Q-group member
the moment a session completed the group with fresh input. That is wrong and was removed —
see rule 10. `Driver` (`packages/winisd/src/driver.ts`, `DRIVER_ADT_DESIGN.md`) carries no
session/what-if/edit concept, and nothing should be added back to give it one for this purpose.
See also [PLAN_OPENISD_DRIVER_MODEL.md](../plans/PLAN_OPENISD_DRIVER_MODEL.md) — the actual target
architecture (`ARCHITECTURE.md` AD-8) retires `Driver` entirely in favor of `OpenISDDriver`.

---

## The layers

| Layer                | Holds                                                        | Changed by                                 | Survives a refresh |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------ | ------------------ |
| **Library / disk**   | `.wdr` / `.owdr` files, the bundled catalogue, My Drivers    | scrapers, releases, an explicit save       | yes                |
| **Baseline**         | the driver exactly as it was loaded                          | a load, or saving to My Drivers            | no                 |
| **Ground**           | fingerprint of the last loaded/saved project                 | open, save, New Project                    | no                 |
| **Committed design** | box, params and the `Driver` model the charts are drawn from | a deliberate commit (OK, an edit in place) | yes (localStorage) |
| **What-if overlay**  | a live copy the charts read while tuning                     | scrubbing a what-if control                | no                 |
| **Dialog draft**     | one dialog's working copy                                    | typing in that dialog                      | no                 |

Reads resolve to the highest layer that exists: what-if overlay if one is active, else the
committed design. That is the whole mechanism — starting and cancelling a what-if only
changes which layer resolves; there is no third state.

## The rules

1. **Choosing a driver EMBEDS it in the project.** WinISD has no driver database: its driver
   manager handles one driver on disk, disconnected from any open project, and selecting one
   copies it in. OpenISD follows that model — choosing copies the driver into the project,
   closes the picker, and returns the user to the project. There is no live link back to the
   library row, the saved My Driver or the file it came from, so later edits change the
   project's copy alone. Editing is a separate act, from the Driver panel's Edit button.
2. **A dialog edits its own draft.** Typing in the driver editor changes that dialog's copy
   only. OK writes the draft into the design; Cancel discards it.
3. **Cancel means byte-identical.** After Cancel the design must match what it was before
   the dialog opened — including provenance marks, not just visible numbers. If a Cancel
   path needs to restore a snapshot, it uses `revertDriverTo`, which does not move the
   baseline: undoing an edit is not loading a driver.
4. **A what-if can never commit.** It exists to explore values that may not correspond to
   any real, buildable driver — the app cannot verify a scrubbed Qts or Vas against physical
   reality, so nothing promotes a what-if into the design. Scrubbing one never dirties the
   project, and there is no "Keep": Cancel (the panel's ✕, or its Cancel button — both call
   the same `cancelDriverWhatIf`) is the _only_ way a what-if session ends, and it always
   discards. To make an explored value real, use the driver **Editor** (rule 2) instead —
   editing is for correcting or authoring real driver data, and its OK genuinely commits.
5. **Reset goes back to the library, not to your last keystroke.** The baseline is the
   driver as chosen, set at the moment it is embedded, so Reset returns to the
   manufacturer's values however much has been typed over them since.
6. **Escape dismisses one dialog — the top-most.** A dialog opened over another takes the
   key; the one underneath stays open (`useEscToClose`).
7. **Provenance is recorded where entry happens.** E/C/N marks come from `enter`/`clear` on
   the `Driver` model, never reconstructed downstream from "is the field present".
   See [DRIVER_ADT_DESIGN.md](DRIVER_ADT_DESIGN.md).
8. **One record per concept.** There is one committed driver and one baseline. A component
   that keeps its own parallel copy of either is the bug.
9. **A saved driver IS its `<brand>/<model>`.** That identity — brand, never manufacturer —
   is what My Drivers keys on, what the row key and the delete button use, and what Save
   matches: Save overwrites the entry holding the resulting identity and adds one when none
   does. Editing brand or model therefore saves a new driver. Clone forks deliberately, as
   `"Copy of " + <old model>`.
10. **An Entered value is never silently cleared or overridden — disagreement is MARKED, not
    resolved (QO13, `ARCHITECTURE.md` §3 "Inconsistency is marked, not resolved", QP18
    ruling).** A driver loaded from `openisd.yml`/a library record arrives with every asserted
    field Entered, Q-trio included — and that's correct, not a bug: `openisd.yml` carries
    ASSERTED values only (`ARCHITECTURE.md` §3), so presence genuinely means someone stated it, whether a
    datasheet or a human. If a fresh edit during a what-if or editor session leaves an
    inherited Entered value (e.g. Qts) no longer reconciling with freshly-typed siblings
    (Qes/Qms), the fix is **never** to auto-clear or evict the stale one — `checkConsistency()`
    flags the whole group with a DQ mark instead, visible to the user, who decides. An earlier
    version of this rule described an auto-clear mechanism (`DriverSession`); that was wrong
    and has been removed — see the note above.

## What persists

`localStorage` (`openisd.state`) and the share link carry the **committed design** only —
box, params, the driver with its marks, project metadata, and local presentation prefs.
Drafts and active what-ifs are deliberately excluded: an uncommitted value must never come
back after a refresh looking like a decision the user made.

## Applying it to a new dialog

- Seed a draft from the layer you were sent from, never from a half-loaded intermediate.
- Give the user OK / Cancel, and make Cancel a true no-op.
- Commit through the store's own functions so the ground fingerprint, the baseline and the
  charts all update together.
- Put the behaviour in a composable, not in a skin (AD-7) — three skins mean three chances
  to get the commit boundary wrong.
