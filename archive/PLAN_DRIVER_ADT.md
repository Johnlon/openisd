# Driver ADT migration — plan

Companion to [docs/DRIVER_ADT_DESIGN.md](docs/DRIVER_ADT_DESIGN.md) (the design itself —
not repeated here) · [ARCHITECTURE.md](ARCHITECTURE.md) (layering decision that gates
Phase 1) · [BACKLOG.md](BACKLOG.md) · [PLAN.md](PLAN.md) (extraction principle this
migration reuses: **extract, do not rewrite**).

---

## Status

Design adopted (`docs/DRIVER_ADT_DESIGN.md`, committed `b3da902fd`), the layering
decision adopted (`ARCHITECTURE.md`), and the Phase 0 forks resolved (see below:
reactive class + fixed-E overrides + `cell(field)` single per-field accessor). The
`@openisd` rename landed (`bc3804282`), so that blocker is clear. No code has started:
`packages/engine/src/driver.ts` still has the free-function shape (`deriveDriver`,
`parseWdr`, `toWdr`, `parstate`) and the interim raw-vs-derived ParState heuristic
(`fe2d49891`) that this migration kills. No `Driver` class, no `enter`/`clear`, no
`fromWdr`, no per-field marks anywhere yet.

---

## Phase 0 — Design decisions _(resolved)_

`docs/DRIVER_ADT_DESIGN.md` §"Two things to decide before building" flagged two forks.
Both are now decided — best design, not lowest-risk:

1. **Reactive class instance with framework-free reactivity** (not a plain-data core,
   not Vue-coupled). Only a class makes the `enter`/`clear`-only invariant _structural_ —
   a plain `{ values, marks }` object lets any call site write a mark directly and
   re-creates the "anemic reactive bag" the design exists to kill. The class carries its
   **own general-purpose change notification** — a `subscribe(listener)` observer that
   `enter`/`clear` fire — so it is reactive **without importing Vue or any UI framework**.
   `Driver` is core logic in a lower layer (`@openisd/winisd`); it must not depend on the
   UI. The Vue binding is glue that lives in the UI layer and *subscribes* to the Driver
   (arrows point up: ui → winisd → engine, never down). This keeps AD-6's litmus test
   intact — `@openisd/winisd` stays framework-free and CLI-reusable.
2. **Fixed-E overrides** (WinISD semantics). Overriding a normally-derived field (Cms, Bl,
   SPL, Mms, Rms, Vd, η₀, c, roo) marks it **E** and the entered value sticks — dependents
   consume it, nothing recomputes around it. This is required for ParState round-trip
   fidelity (recompute-around would diverge from the reference tool) and is unambiguous
   (recompute-around has no single correct back-solve). It matches today's editor
   (`resolvedSI`'s `== null` guards).

**Consequence for the build:** the class must honour an entered derived-value through
`toWdr` and the sim. The current engine `deriveDriver` unconditionally recomputes
Cms/Mms/Rms/Bl and would clobber an override — the `Driver` derivation must skip a field
that is already E.

### API surface (locked)

```ts
class Driver {
  enter(field, value): void; // human input → E
  clear(field): void; // → C (still derivable) or N
  cell(field): { value; state; error }; // the ONLY per-field read (tied tuple)
  errors(): DriverError[]; // whole-driver list — Apply gate, summary
  static fromWdr(text): Driver; // parse all keys + ParState → replay E marks
  toWdr(): string; // all carried fields + ParState from state
}
```

- **One per-field accessor — `cell(field)`.** Value, CNE state, and that field's error are
  a single tied tuple, always from the same derivation pass, so they cannot drift.
  `value(f)`/`state(f)`/`errors(f)` are deliberately **not** separate methods — they are
  `cell(f).value` / `.state` / `.error`.
- **`errors()` (no arg) is the only aggregate** — a list across all fields, a different
  shape than the per-field tuple, needed for the Apply gate and the summary.
- **Per-field errors are alias-aware:** the `Sd` error also surfaces on `cell('Dia')`; the
  "need two Q" error surfaces on `cell('Qms')`/`cell('Qes')`/`cell('Qts')`. The driver owns
  this mapping so the UI never re-hardcodes it (kills `isRequiredMissing`).

### Internal shape

```ts
type FieldState = { value: number | undefined; state: 'E' | 'C' | 'N'; error?: DriverError };

#inputs  = reactive<Record<string, number>>({});   // ONLY mutable state; presence ⇒ E
#fields  = computed<Record<string, FieldState>>(/* one derivation pass over #inputs */);
```

`enter`/`clear` mutate `#inputs` only. `cell`/`errors` read `#fields`. The single
non-derivable fact (what the human entered) is the only thing stored; value, state, and
error are all derived together.

## Phase 1 — Package split (`ARCHITECTURE.md` layering)

`ARCHITECTURE.md` commits `parseWdr`/`toWdr`/`parstate`/the Driver ADT to move **out of
the engine** into a WinISD-specific package; `deriveDriver` (pure T/S physics, no WDR/
ParState concern) stays in the physics core. Today `packages/` only has `engine` and
`ui` — no split exists yet.

- Create the new package (naming TBD at execution time — e.g. `packages/winisd`) and
  move `parseWdr`, `toWdr`, `parstate`, `_parseSimpleYaml` into it unchanged, per
  PLAN.md's **extract, do not rewrite** principle — a pure move, not a rewrite.
- `deriveDriver` stays in `packages/engine/src/driver.ts`.
- **Gate:** existing `packages/engine/test/driver.test.ts` and all call sites
  (`packages/ui/src/store.ts`, `packages/ui/src/utils/persist.ts`,
  `packages/ui/src/components/DriverPanel.vue`, `DriverBrowser.vue`, `AppHeader.vue`,
  `App.vue`) updated to the new import path, full `bash scripts/health-check.sh` green,
  before touching any behaviour.

## Phase 2 — Build the `Driver` class (TDD, red→green per `/tdd`)

Per the locked API above (`enter`, `clear`, `cell`, `errors`, `fromWdr`, `toWdr`) with
the `#inputs`→`#fields` internal shape. Write failing tests first for:

- `enter('Fs', 37)` → `cell('Fs')` is `{ value: 37, state: 'E' }`.
- `clear` reverts to C or N: enter Qes+Qms, then the derived `Qts` reads `state 'C'`;
  clearing a genuinely derivable entered field reverts to `'C'` with the recomputed
  value; clearing with no fallback derivation → `'N'`.
- **Fixed-E override:** `enter('Cms', x)` → `cell('Cms').state === 'E'` and `.value === x`
  even when Fs/Vas/Sd would otherwise compute a different Cms (the derivation skips an
  already-E field — the behaviour the engine `deriveDriver` does _not_ have today).
- **Alias-aware per-field errors:** with no Sd/Dia, `cell('Dia').error` is the Sd
  requirement; with <2 Q entered, `cell('Qms')/('Qes')/('Qts').error` all carry the
  "need two" error.
- **One state implementation:** `cell().state` is the only E/C/N logic — `stateOf`
  (editor) and `parstate` (exporter) both route through it, no duplicate.

**Gate:** new tests against new code — no existing behaviour to preserve yet, but the
full health-check must stay green throughout (nothing else broken).

## Phase 3 — Lossless `fromWdr` / `toWdr` (TDD)

Replace the lossy `parseWdr` (currently reads ~11 fields, drops dimensions, Hc/Hg/fLe/
KLe, thermal fields, c/roo, and ParState itself — see `packages/engine/src/driver.ts:109-138`)
with `Driver.fromWdr` that reads every `[Driver]` key and replays E/C/N via
`enter`/skip per the design doc's round-trip rules.

- Write a round-trip test first (red): `fromWdr(realSampleWdr)` → `toWdr()` →
  semantically identical (same carried fields, same `ParState`) using fixtures under
  `drivers/sample/`. Watch it fail against the current lossy parser.
- Implement `fromWdr`/`toWdr` to make it pass.
- **Gate:** round-trip test green + full health-check green.

## Phase 4 — Migrate call sites off the reactive bag

- **Store (`packages/ui/src/store.ts`):** every `state.driverRaw.X = v` becomes
  `driver.enter('X', v)`.
- **Editor (`packages/ui/src/components/DriverDefineModal.vue`) becomes a pure
  projection of the `Driver` — it keeps _zero_ detection logic.** These all delete,
  each replaced by a read of the driver:
  - `entered` bag + `activeEntered` (`~102-104`) → driver `#inputs`
  - `resolvedSI` (`~163`, the duplicate derivation) → driver `#fields`
  - `stateOf` (`~206`) → `cell(field).state`
  - `displayVal` (`~212`) → `fmtSI(key, cell(field).value)`
  - `isRequiredMissing` (`~234`) → `cell(field).error?.level === 'error'` (alias-aware,
    so the hardcoded Sd/Dia and Q-trio groupings go)
  - `canApply` (`~225`) → `driver.errors().every(e => e.level !== 'error')`
  - `onInput`/`resetAll` writes (`~218-222`, `~312`) → `driver.enter`/`clear`
- **What the editor legitimately keeps — rendering only, no judgement:** `toSI`/`fmtSI`
  unit conversion (model is SI; convert at the edges), error-`level`→CSS-class mapping,
  tooltip formatting (`fmtTip`), the transient in-progress input-text buffer, and the
  "what each graph needs" affordance (`CHART_DEPS`/`highlightKeys`) — but its presence
  check `tokPresent` (`~263`) must read `driver.cell(k).state !== 'N'`, not re-derive.
- **Gate:** `npx playwright test` (driver editor UI paths) + full health-check green.

## Phase 5 — Persistence carries provenance

`packages/ui/src/utils/persist.ts` (localStorage), the URL-encoded share link, and
saved project JSON must all serialize the entered-marks alongside values — not just
WDR files — so provenance survives a reload/share/save, not only an import/export
round-trip.

- **Gate:** existing persistence round-trip tests extended to assert E/C/N survives;
  full health-check green.

## Phase 6 — Delete the obsolete code

Per the design doc's "What this kills":

- The hardcoded ParState string / presence-based guess / raw-vs-derived interim
  heuristic (`packages/engine/src/driver.ts:176-214`, from `fe2d49891`).
- Duplicate `stateOf` (editor) vs `parstate` (engine) — one `cell().state`.
- The editor's duplicate derivation (`resolvedSI`) and detection logic
  (`isRequiredMissing`, `canApply`, `activeEntered`).
- The lossy field-subset `parseWdr`.

**Gate:** full health-check green with the old code physically removed (not just
unused) — confirms nothing still depends on it.

---

## Non-goals

- No new UI features — this is a structural/provenance-correctness change, behaviour
  visible to the user should be unchanged except where it fixes an existing "provenance
  wrong after edit/reload/export" bug (the class of bug this migration exists to kill).
- Mobile/PWA (`PLAN.md` Phase 6) is unaffected and not pulled into scope.
