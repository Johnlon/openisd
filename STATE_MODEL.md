# Project state model

Layered project state — **ground → modified → what-if**, plus a parallel **edit** state.
This governs unsaved-change tracking, what-if previews, edit dialogs, and — critically —
**which state the charts render**.

> Status: **being implemented incrementally.**
>
> - **Increment 1 — ground↔modified (DONE):** the store tracks a **ground** fingerprint
>   (`store.ts` `markProjectSaved` / `isModified` / `resetProjectToGround`). `App.vue` marks
>   the just-loaded design as ground; the design is **modified** when it differs. The Original
>   skin's Save bar is wired to it: an Unsaved indicator, **Save Changes** (adopt current as
>   ground), **Reset state** (revert to ground). This is additive — components still read
>   `state.P`/`state.box` directly; the layer only observes/restores them.
> - **Increment 2 — driver what-if priorityState overlay (DONE):** `store.ts` holds a driver
>   what-if overlay (`startDriverWhatIf` / `keepDriverWhatIf` / `cancelDriverWhatIf` /
>   `setWhatIfFromRaw` / `isDriverWhatIfActive`). The **effective** accessors (`driver`,
>   `driverRaw`, `driverErrors`) resolve to the overlay when active, else the committed model —
>   this IS the priorityState indirection: reactive readers hang off the effective accessors and
>   start/keep/cancel just swap which layer they resolve to. **`driverJSON` stays
>   committed-only** (persistence + the ground fingerprint), so a live what-if previews on the
>   charts but never dirties the modified/ground state until **Keep**. OgTune drives the
>   lifecycle; Modern/Classic never start an overlay, so effective ≡ committed there (Invariant 1).
> - **Increment 3 — edit-dialog buffer + box/params what-if (TODO):** the **edit** dialog
>   (charts ignore the buffer until **Accept**) still runs through the shared DriverEditorModal;
>   and the overlay is currently **driver-only** — box-type / param what-ifs are not yet routed
>   through a layer. Both extend the same priorityState machinery.

## The state layers

Each layer is a **complete copy** of the project state.

| Layer        | Exists when                                                                          | Created by copying                      |
| ------------ | ------------------------------------------------------------------------------------ | --------------------------------------- |
| **Ground**   | always (the last loaded / last saved project)                                        | —                                       |
| **Modified** | the project has unsaved changes                                                      | ground + the change                     |
| **What-if**  | a what-if is active (shared by ALL what-if popups **and** what-if expander sections) | the current modified state, else ground |
| **Edit**     | an edit dialog is open                                                               | the current modified state, else ground |

Strict hierarchy: **ground → modified → what-if**. **Edit** is a parallel top layer that the
charts do **not** react to (until the edit is accepted).

## Chart reactivity (priority)

The charts render the highest-priority state that currently exists:

1. **what-if** state, if active;
2. else **modified** state, if it exists;
3. else **ground** state.

The charts **never** react to the edit state while an edit dialog is open.

## Creation rules

- **On load** the project is clean — only the ground state exists.
- **First change to the project** (e.g. box type Passive-Radiator → Ported) creates the
  modified state: copy the ground state, apply the change.
- **Starting a what-if** creates the what-if state: copy the current modified state; if
  there is no modified state, copy the ground state.
- **Opening an edit dialog** creates the edit state the same way (copy of modified, else
  ground).

## What-if lifecycle (previews LIVE on the charts)

The what-if dialog's accept button is labelled **"Keep"**.

- While active, spinner / field changes are applied to the **what-if state only**.
- **"Keep"** (accept): the what-if state **replaces** the current modified state; the
  what-if state is destroyed. If there was no modified state, a modified state is **created
  from** the what-if state, then the what-if state is destroyed.
- **"Cancel"**: the what-if state is destroyed. Chart priority reverts to whichever of
  modified / ground state was in effect **before** the what-if began.

## Edit-dialog lifecycle (affects charts only on accept)

Identical to the what-if lifecycle **except the charts do not react to the edit state**. The
edit dialog's accept button is labelled **"Accept"**.

- **Open**: create the edit state (copy of modified, else ground).
- Changes in the dialog mutate the edit state only; the charts do **not** update.
- **"Accept"**: the edit state **replaces** the modified state (edit state destroyed); if
  there was no modified state, one is **created from** the edit state.
- **Dismiss / Cancel**: the edit state is discarded (lost); nothing changes.

## Save / Reset (the modified state)

- While a modified state is active, the app shows **unsaved-change indicators**.
- **Save**: persist the modified state to storage; on success the modified state **replaces
  the ground state** (no modified state remains).
- **Reset state**: discard the current modified state (revert to ground).

## Button labels & tooltips

| Context                       | Accept     | Discard         |
| ----------------------------- | ---------- | --------------- |
| **What-if** dialog / expander | **Keep**   | **Cancel**      |
| **Edit** dialog               | **Accept** | **Cancel**      |
| **Modified** state (project)  | **Save**   | **Reset state** |

Every one of these buttons carries a **hover tooltip explaining exactly what it does** to the
state (e.g. "Keep — apply these what-if changes to the project", "Accept — commit the edited
values to the project", "Reset state — discard all unsaved changes and return to the last
saved version"). The tooltip is required, not optional — the state transitions are subtle and
the user must be able to see the consequence before clicking.

## The two editor types (why both exist)

- **What-if dialog / expander** — changes **preview live** on the charts (via the what-if
  state) while you scrub.
- **Edit dialog** — changes affect the charts **only when accepted** (**Accept**) and the
  dialog is dismissed (via edit state → modified state).

This is the contract every skin's editors must honour: what-if is immediate; edit is
commit-on-accept.
