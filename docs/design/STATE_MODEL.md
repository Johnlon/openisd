# OpenISD — state & memory model

What the app remembers, where each fact lives, and the moment a change becomes part of the
user's design. Every dialog, picker and panel follows these rules.

The code that implements it is `OpenISDProject` (`packages/design/domain/openisdDomain.ts`),
read and written through `appState.ts`; `driverSelection.ts` (draft → commit) and
`driverBrowsingState.ts` (the library picker) sit on top of it. The layer rule that keeps
components from bypassing it is [ARCHITECTURE.md §7](../../ARCHITECTURE.md#7-patterns-and-coupling-rules).

`OpenISDDriver` has no session or what-if layer of its own; that lifecycle is
`OpenISDProject`'s, which embeds the driver as one of its members (rule 8).

---

## The layers

`OpenISDProject` holds three stored record layers and one transient one
([ARCHITECTURE.md §5](../../ARCHITECTURE.md#5-state)):

| Layer     | Holds                                                  | Changed by                          | Survives a refresh |
|-----------|---------------------------------------------------------|--------------------------------------|---------------------|
| `#saved`  | The project as of the last save, including the driver.  | `save()` replaces it.                | yes (autosaved)     |
| `#edited` | Every change since the last save, or none.               | Any `.set()`/`.clear()`; `save()` promotes it into `#saved`. | yes (autosaved) |
| `#whatif` | A tuning session (the Tune panel). | Any `.set()`/`.clear()` while active; `beginWhatIf()`/`resetWhatIf()` clone it from the committed record; `cancelWhatIf()` discards it. | no |

Reads resolve to the highest layer that exists: `#whatif ?? #edited ?? #saved`. That is the
whole mechanism — beginning and cancelling a what-if only changes which layer resolves.

The library (`.wdr`/`.owdr` files, the bundled catalogue, My Drivers) sits outside the project
entirely: choosing a driver copies its record into the project's top layer, and nothing else
references it afterwards.

## The rules

1. **Choosing a driver embeds it in the project.** WinISD's driver list is a folder of `.wdr`
   files, and choosing one copies it into the project. OpenISD follows that model — choosing copies the driver into the project and
   closes the picker. There is no live link back to the library row, the saved My Driver or the
   file it came from, so later edits change the project's copy alone. Editing is a separate act,
   from the Driver panel's Edit button.
2. **A dialog edits its own draft.** Typing in the driver editor changes that dialog's own
   working copy only; OK writes it into the project, Cancel discards it without ever touching
   `#edited`.
3. **A what-if never commits.** Its values may not match any real driver, so nothing promotes
   them into the design. A what-if ends only by `cancelWhatIf()`, which always discards: the
   panel's ✕ or Cancel, a focus change, closing the project, or opening a file. To make an
   explored value real, use the driver editor (rule 2), whose OK commits.
4. **Escape dismisses one dialog — the top-most.** A dialog opened over another takes the key;
   the one underneath stays open (`useEscToClose`).
5. **Provenance is recorded where entry happens.** E and C are stored with the value by
   `.set()` and the solve; N is the absence of an entry. See
   [ARCHITECTURE.md §3](../../ARCHITECTURE.md#3-domain-model) ("Fields").
6. **One record per concept.** `OpenISDProject` holds exactly three record layers,
   `#saved`/`#edited`/`#whatif`; `architecture-project-has-three-fields.test.ts` pins its full
   set of private fields. A component that keeps its
   own parallel copy of the driver or the box is the bug.
7. **A saved driver is its repository id.** My Drivers keys rows, delete and Save on that id.
   Save writes under the id; changing brand or model asks whether to rename in place or save a
   copy. Clone and copy get a new id; clone names the copy `Copy of <model>`.
8. **An entered value is never cleared or overridden; disagreement is marked.** A driver from
   the library arrives with every stated field entered, the Q trio included, because the record
   holds stated values only. If an edit leaves an entered value (such as Qts) disagreeing with
   its group (Qes, Qms), nothing is cleared: every member gets an `inconsistent-inputs` DQ mark
   and the user decides.

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
