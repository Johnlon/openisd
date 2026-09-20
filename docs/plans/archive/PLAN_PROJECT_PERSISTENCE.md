# Project persistence — plan

Autosave and project storage were removed because they were never designed — a Vue watch
persisted committed state to `localStorage` on every reactive tick, which forced
`ManagedProject` to hand its whole private record out to the app just so it could be
serialised, breaking the "OpenISDProject is not exposed to the app directly" rule, and it lost
unfocused projects' edits and clobbered other open projects on focus switch. This plan is the
replacement design.

---

## Settled

**No Vue in the write path.** `OpenISDProject` (`packages/design`) imports nothing from Vue and
already owns `#notify()`, called by every mutating method. Persistence hangs off that directly —
no watcher, no computed, no App.vue hook.

**Two layers, not four.** `#saved` (the project as of the last save) and `#edited` (every change
since, `null` until the first write). Reads take `#edited ?? #saved`. The first write copies
`#saved` into `#edited`. `isModified()` is `#edited !== null`.

**Each project writes itself.** `ProjectStores { saved, edited }`, held per project, written on
every change — not a shared repo called from outside, not a message bus (rejected: it would
route through a channel), not `#notify(record)` (rejected: handing the record to every listener
recreates the leak that was just removed).

**Identity is an internal-only uuid.** Minted at project construction, carried on
`ProjectLiveState` in memory, never on `OpenISDProjectJson` — the wire shape. `toJsonRecord()`
strips it; `fromJsonRecord()` and `empty()` always mint a fresh one, including on `.owdr` import.
This makes "internal only" structural: nothing outside the record's own construction can ever
put a uuid on disk. Matches the existing driver precedent (QO81): a driver's own uuid is never
trusted from an imported file either — the store always mints fresh on import, so importing the
same file twice yields two entries, never a silent overwrite.

**`focusedIndex` becomes `focusedUuid`.** An array index breaks under reordering or when a
different project closes; the uuid does not.

**A cast is stripped by the layers, not the app.** `OpenISDProject` has no domain-level
serialisation itself; a persistence-layer record crosses the boundary, not the object.

---

## Open

**What crosses the persistence boundary.** A record the persistence layer owns, or opaque
bytes/text. Blocks everything else in this plan.

**Storage backend.** `localStorage` (strings only, ~5MB) cannot hold a `FileSystemFileHandle`
and is small for a multi-project store carrying full driver records. IndexedDB solves both, and
a handle is structured-cloneable so it can persist there. Open: does the project store move to
IndexedDB, and do the existing buckets (My Drivers, view state) move with it or stay on
`localStorage`.

**File access / Open Recent.** `fileStorage.ts` already retains a `FileSystemFileHandle`,
currently session-only. Persisting it in IndexedDB turns "Open Recent" into genuinely
re-openable entries — re-opening needs a permission re-prompt, which the user's click on the
entry supplies. Chromium only; Firefox/Safari lack the file-system-access pickers, so there a
recent list can hold names but nothing directly re-openable. Also open: whether to use
`showDirectoryPicker()` so the user nominates one projects folder, closest to WinISD's own
folder memory.

**Which layer is autosaved.** John said the edit layer, but an open what-if must never reach
storage, and autosaving edit-layer state changes what "Revert" means (revert-to-committed vs
revert-to-stored). Needs a ruling before `#edited` writes are wired to storage.

**Close/reload semantics.** Closing a project currently drops it from memory entirely (the
`projects` array is the only holder). Unruled: does closing also delete its store entry, or
leave a recoverable copy; on reload, does the app reopen everything that was open, or start
empty.

**Out-of-order writes and silent write failures.** Each project writing itself independently
raises both; neither has a design yet.

**Load with both a saved and an edited record present.** Which one the app resumes into, and
whether the user is asked.

**Second in-app id for My Drivers.** Whether a My Drivers entry needs an id distinct from its
persisted corpus uuid.

---

## Non-goals

- View-state persistence (`viewStateRepo`, its own key, QO90) is a separate feature and is
  unaffected by this plan.
