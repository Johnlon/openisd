# OpenISD — state & memory model

What the app remembers, where each fact lives, and the exact moment a change becomes part
of the user's design. Every dialog, picker and panel obeys this; a component that does not
is a defect, not a variation.

The code that implements it is `OpenISDProject` (`packages/design/domain/openisdDomain.ts`),
read and written through `appState.ts`; `driverSelection.ts` (draft → commit) and
`driverBrowsingState.ts` (the library picker) sit on top of it. The layer rule that keeps
components from bypassing it is [ARCHITECTURE.md §7](../../ARCHITECTURE.md#7-patterns-and-coupling-rules).

`OpenISDDriver` (`DRIVER_ADT_DESIGN.md`) carries no session/what-if/edit concept of its own, and
nothing may be added to give it one — an auto-clearing session layer on the driver WOULD
silently evict inherited Q-group members instead of surfacing the contradiction to the user
(see rule 8). That lifecycle belongs to `OpenISDProject`, which embeds the driver as one of
its members.

---

## The layers

`OpenISDProject` holds three stored record layers and one transient one
([ARCHITECTURE.md §5](../../ARCHITECTURE.md#5-state)):

| Layer     | Holds                                                  | Changed by                          | Survives a refresh |
|-----------|---------------------------------------------------------|--------------------------------------|---------------------|
| `#saved`  | The project as of the last save, including the driver.  | `save()` replaces it.                | yes (autosaved)     |
| `#edited` | Every change since the last save, or none.               | Any `.set()`/`.clear()`; `save()` promotes it into `#saved`. | yes (autosaved) |
| `#whatif` | A tuning session (the Tune panel), a clone of the committed record. | `beginWhatIf()`/`resetWhatIf()`; `cancelWhatIf()` discards it. | no |

Reads resolve to the highest layer that exists: `#whatif ?? #edited ?? #saved`. That is the
whole mechanism — beginning and cancelling a what-if only changes which layer resolves.

The library (`.wdr`/`.owdr` files, the bundled catalogue, My Drivers) sits outside the project
entirely: choosing a driver copies its record into the project's `#edited` layer, and nothing
else references it afterwards.

## The rules

1. **Choosing a driver EMBEDS it in the project.** WinISD has no driver database: its driver
   manager handles one driver on disk, disconnected from any open project, and selecting one
   copies it in. OpenISD follows that model — choosing copies the driver into the project and
   closes the picker. There is no live link back to the library row, the saved My Driver or the
   file it came from, so later edits change the project's copy alone. Editing is a separate act,
   from the Driver panel's Edit button.
2. **A dialog edits its own draft.** Typing in the driver editor changes that dialog's own
   working copy only; OK writes it into the project, Cancel discards it without ever touching
   `#edited`.
3. **A what-if can never commit.** It exists to explore values that may not correspond to any
   real, buildable driver — the app cannot verify a scrubbed Qts or Vas against physical
   reality, so nothing promotes a what-if into the design. `cancelWhatIf()` (the panel's ✕, or
   its Cancel button) is the *only* way a what-if session ends, and it always discards. To make
   an explored value real, use the driver **Editor** (rule 2) instead — editing is for
   correcting or authoring real driver data, and its OK genuinely commits.
4. **Escape dismisses one dialog — the top-most.** A dialog opened over another takes the key;
   the one underneath stays open (`useEscToClose`).
5. **Provenance is recorded where entry happens.** E/C/N marks come from `.set()`/`.clear()` on
   the field itself, never reconstructed downstream from "is the field present". See
   [DRIVER_ADT_DESIGN.md](DRIVER_ADT_DESIGN.md) and
   [ARCHITECTURE.md §3](../../ARCHITECTURE.md#3-domain-model) ("Fields").
6. **One record per concept.** `OpenISDProject` holds exactly `#saved`/`#edited`/`#whatif` and
   nothing else (`architecture-project-has-three-fields.test.ts`). A component that keeps its
   own parallel copy of the driver or the box is the bug.
7. **A saved driver IS its `<brand>/<model>`.** That identity — brand, never manufacturer — is
   what My Drivers keys on, what the row key and the delete button use, and what Save matches:
   Save overwrites the entry holding the resulting identity and adds one when none does. Editing
   brand or model therefore saves a new driver. Clone forks deliberately, as
   `"Copy of " + <old model>`.
8. **An Entered value is never silently cleared or overridden — disagreement is MARKED, not
   resolved.** A driver loaded from a library record arrives with every asserted field Entered,
   Q-trio included — and that's correct, not a bug: the record carries asserted values only, so
   presence genuinely means someone stated it, whether a datasheet or a human. If a fresh edit
   during a what-if or editor session leaves an inherited Entered value (e.g. Qts) no longer
   reconciling with freshly-typed siblings (Qes/Qms), the fix is **never** to auto-clear or evict
   the stale one — the whole group is flagged with an `inconsistent-inputs` DQ mark instead,
   visible to the user, who decides.

## What persists

`localStorage` and the share link carry `#saved` and `#edited` — box, params, the driver with
its marks, project metadata, and presentation prefs held alongside them. `#whatif` is never
persisted: an uncommitted value must never come back after a refresh looking like a decision
the user made.

## Applying it to a new dialog

- Seed a draft from the layer you were sent from, never from a half-loaded intermediate.
- Give the user OK / Cancel, and make Cancel a true no-op.
- Commit through the project's own field writes (`.set()`, `save()`), never by constructing a
  parallel record.
- Put the behaviour in a hook (`*-hooks.ts`), not in a `.vue` file — see
  [ARCHITECTURE.md §7](../../ARCHITECTURE.md#7-patterns-and-coupling-rules): "Components decide
  nothing."
