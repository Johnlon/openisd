# Plan — a project holds a collection of boxes, not one switchable box

Ruling: John, 2026-09-29, live on his phone — raised as an alternative to
`bugs/BUG_20260929_box-type-switch-leaves-volume-zero.md`'s "default the fields on switch"
approach. **Not started. Parked behind finishing the smaller fix (John's own call, same
conversation).** Recorded here so the idea and its open questions aren't lost.

## The problem this solves

Switching a project's box type in place (Box tab, `selectedBox`) left the new type's own
volume/tuning/geometry at 0 — nothing had ever written a value for a type the project had not
used before. `BUG_20260929_box-type-switch-leaves-volume-zero.md` fixes that by auto-defaulting
on switch (sealed/vented/PR so far). John's alternative: don't let a box switch type in place at
all — adding a different box type becomes a new trip through the New Project wizard, which
already asks every question the type needs and never leaves a field blank.

## The core idea

> "essentially [each] box is a different flavour of the current project" — John

A project stops being "one box that can be sealed today and vented tomorrow" and becomes a named
collection of boxes, all for the same driver:

- **Stays at project level** (shared across every box in the collection): project name, the
  driver/signal settings ("box model signal can stay at project level" — driver identity, drive
  voltage/power, wiring).
- **Per box** (one "flavour" of the design): box type, volume, tuning, vent/PR geometry, losses —
  everything the Box/Enclosure/Advanced tabs currently edit for the ONE active box.
- Each box gets a name, defaulting to its box type ("Sealed", "Vented", …) with an option to
  overtype it — shown wherever a box is named: the wizard, the Project panel's list, and
  (possibly) the Box panel itself, in the spot the box-type selector used to occupy.
- **No side-by-side comparison requirement** — John was explicit this is not the goal. The
  motivation is purely a cleaner way to originate a new box type than in-place switching with
  auto-filled fields the user didn't ask for.
- If you can have two vented boxes as different flavours of one project, there's no principled
  reason to forbid two sealed boxes either — "it's just a collection of boxes."

## UI shape (sketch, not decided)

- Box-type selection **moves off the Box tab** into a parent/child list on the Project panel:
  the project (parent) with its boxes (children) underneath, each showing its name.
  "This shouldn't be a massive change" — John's own estimate, not yet verified against the
  Box/Enclosure tab's current structure in either shell.
- Adding a box = re-entering the wizard, scoped to "add a box to this project" instead of "create
  a new project" — same screens (box type, alignment, geometry), different landing action.
- **Duplicate** currently dupes the whole project (`saveProjectAs`'s "Copy of …" naming). That
  stays. A NEW action is needed to duplicate one box within the current project (a fast way to
  get two vented flavours with slightly different tuning, say). With a parent/child list in
  place, the existing Duplicate button might act on whichever is selected — the box, or the whole
  project — rather than adding a second button. Not decided.

## Open questions / not yet designed

- **`.wpr` export.** WinISD's own project file is one box, period — a multi-box OpenISD project
  has no single box to flatten into it. John: "export of a project to wpr requires the user to
  select which [box] to export" — a picker step before the export proceeds. `.owpr` (OpenISD's
  own format) presumably CAN hold the whole collection; whether it should, and what the schema
  version bump looks like, is undecided.
- Whether "two sealed boxes in one project" needs anything special (naming collisions, chart
  legend labelling per box) once it's genuinely possible, not just permitted in principle.
- How chart traces / the Graph destination reference "the active box" once there can be more
  than one — does the graph show one box at a time (which one, chosen how) or does this reopen
  the multi-chart work already landed for stacking chart TYPES, now crossed with multiple boxes?
- Whether `BUG_20260929_box-type-switch-leaves-volume-zero.md`'s auto-default fix becomes
  dead code once this lands (no more in-place type switch to default), or stays as a fallback for
  however an old single-box project's type field can still change.
- Scope/estimate: touches persistence (`.owpr` schema), the domain (`OpenISDProject`/`Box`
  ownership of "the" box), the wizard, the Project panel in both shells, and the Box/Enclosure/
  Advanced tabs' whole navigation model. Nothing here has been sized against the real code yet.
