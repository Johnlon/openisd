# Driver non-null invariant

Status: BUILT. John, 2026-08-24: "driver in proj is non-null - full stop."

## The invariant

`OpenISDProject` may never exist without a driver. There is no "project with
no driver" state anywhere in the app, transient or otherwise.

## How it's achieved without breaking the wizard

The New Project wizard (see `NEW_PROJECT_WIZARD.md`) collects fields
incrementally across 5 steps in its OWN local draft type — never an
`OpenISDProject`. Only `[Done]`/Create constructs the real domain object,
via a constructor that requires a non-null driver argument. No OIP exists
mid-wizard, so the invariant is never transiently violated.

## The "zero projects" question — RULED

Today the app guarantees "never zero projects" by falling back to a
driver-less empty project (`ManagedOpenISDProject.createEmpty()` →
`OpenISDProject.empty()`) at three trigger points: app first-launch (no
saved state), closing the last open project, and selecting a project-list
row that itself has no driver. That fallback is gone under the invariant.

**Ruled (John, 2026-08-24): a genuine, first-class "no project open" state.**
The project list panel shows the literal text **"No projects open"** — not
the wizard forced open non-dismissibly. The wizard is reachable from there
(same as any other time), but zero projects is a real, renderable app state
in its own right, distinct from the wizard.

## Mechanical changes (removal, not redesign — ~30 sites)

- `_OpenISDProjectJson.driver: string | undefined` → `driver: string`
  (`openisdProject.ts:302`), cascading into `OpenISDProject.empty()`/
  `prototypeProject()` (must go away or require a driver param), `setDriver()`
  (stop accepting `undefined`), `driverText()` (return type), `fromWprText()`'s
  conditional adoption.
- `ManagedOpenISDProject`'s `Layer.openIsdDriver: OpenISDDriver | null` →
  non-null. ~18 null-driver occurrences in `managedProject.ts` collapse:
  `cell()`, `metaCell()`, `toEngineDriver()`, `errors()`,
  `consistencyIssues()`, `driveVoltage_V()`'s 1Ω fallback,
  `sealedResonance()`'s early return, `mutate()`'s re-materialization,
  `persistedDriverText()`, `committedDriverText()`'s `OpenISDDriver.empty()`
  sentinel fallback, `exportDriverWdr()`/`exportDriverOwdr()`/`exportWpr()`'s
  "no driver has been chosen" error branches.
- **`clearDriver()` is deleted entirely** (ruled) — no legitimate "go back to
  no driver" action once the invariant holds. Changing driver is a
  *replacement* (pick a new one via the driver picker), never a clear.
  `hasDriver()` is already dead code (zero call sites) — delete alongside it.
- `loadEmpty()`/`createEmpty()` — their 4 real call sites (module init in
  `appState.ts`, `newProject()`, `OriginalShell.vue`'s `closeProject()` and
  `selectProject()`'s no-driver branch) all change from "fall back to an
  empty project" to "set app state to the new no-project-open state."

## Persistence (ruled)

- `ProjectPayload.driverText?: string` → `driverText: string` (required).
  The doc comment justifying its optionality (written today, same session)
  is now stale — delete it, don't leave it contradicting the type.
- `SerializedState.driver?: string` likewise becomes required on the wire.
- **No schema-upgrade coercion.** No real user data exists pre-launch
  (confirmed twice today). A stored payload with no driver is **refused on
  load** — same as any other malformed payload — never repaired by
  inventing a driver. Matches this project's hard rule against fabricating
  missing data (the DriverFile._coerce_flat_fields precedent). Any dev-era
  localStorage/`.owpr` lacking a driver (including on John's own machine, if
  exercised during development) becomes unreadable and the app lands on the
  new "no project open" state instead.
- `applyProjectPayload()`'s `if (o.driverText)` branch becomes unconditional
  (driver is always adopted, never optionally skipped).

## UI (ruled + open)

- 3 genuine user-facing "no driver has been chosen" strings
  (`useDesignIO.ts:158`, `managedProject.ts:629,656`) become dead code —
  delete, don't leave unreachable.
- `OgNewProject.vue`'s CURRENT box-then-driver sequencing (create a shell
  project, THEN hand off to the driver picker) is being replaced wholesale
  by the 5-step wizard rebuild anyway (`NEW_PROJECT_WIZARD.md`) — driver is
  step 1, so this reordering is already the plan, not new work.
- The "No projects open" panel state: the project-list rail already had an
  empty-state row (`OriginalShell.vue`'s `.project-empty-row`); its text is
  now the literal ruled wording, and `closeProject()`'s last-project branch
  sets `openProjects.value = []` instead of reseeding a fresh driver-less
  row — that trigger is fully wired.
  **Open**: first-launch (no saved state) and select-a-driverless-row are
  NOT wired to this state. `OriginalShell.vue`'s project-list seeding
  (`onMounted`) unconditionally seeds one row from whatever `managedProject`
  holds at mount, synchronously — before `App.vue`'s own async `onMounted`
  (which restores a saved project, if any) has resolved — and a later watch
  patches that seeded row in place once the restore lands. Removing the
  seed to show "No projects open" at first launch would race that restore:
  if the seed is dropped, `applyLoadedProject()`'s reactive update finds no
  row to patch (`openProjects.value.find(...)` returns nothing) and a
  genuinely restored saved project would render nothing in the list. Fixing
  this correctly needs the project registry `appState.ts` already declares
  (`openProjects()`/`addProject()`/`focusProject()`, lines 88-122) actually
  wired into `OriginalShell.vue` in place of its own local `openProjects`
  ref — deferred REVIEW.md Phase 1.4/1.5 work, out of scope here. Every
  freshly-created project (`newProject()`, `ManagedOpenISDProject.
  createEmpty()`) now always holds a real driver object — `OpenISDDriver.
  empty()`, unfilled but never absent — so "a driverless row" cannot occur
  from any current code path; the branch handling it defensively remains.

## Build order

1. Model + managed layer (mechanical collapse, ~30 sites) — foundational,
   blocks everything else.
2. Persistence (`ProjectPayload`/`SerializedState` required driver, refusal
   not coercion).
3. "No projects open" panel state + its trigger points (startup,
   close-last, select-driverless-row all redirect here instead of
   `loadEmpty()`).
4. The 5-step wizard itself (`NEW_PROJECT_WIZARD.md`), now building directly
   against a domain layer where `OpenISDProject` genuinely cannot be
   constructed without a driver — no transient invalid state to guard
   against.
