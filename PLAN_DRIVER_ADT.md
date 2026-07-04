# Driver ADT migration — plan

Companion to [docs/DRIVER_ADT_DESIGN.md](docs/DRIVER_ADT_DESIGN.md) (the design itself —
not repeated here) · [ARCHITECTURE.md](ARCHITECTURE.md) (layering decision that gates
Phase 1) · [BACKLOG.md](BACKLOG.md) · [PLAN.md](PLAN.md) (extraction principle this
migration reuses: **extract, do not rewrite**).

---

## Status

Design adopted (`docs/DRIVER_ADT_DESIGN.md`, committed `b3da902fd`) and the layering
decision adopted (`ARCHITECTURE.md`: "Goal adopted. Migration pending — layered on top
of the `@openisd` rename"). The rename landed (`bc3804282`), so that blocker is clear.
Nothing below has started: `packages/engine/src/driver.ts` still has the free-function
shape (`deriveDriver`, `parseWdr`, `toWdr`, `parstate`) and the interim raw-vs-derived
ParState heuristic (`fe2d49891`) that the design doc says this migration kills. No
`Driver` class, no `enter`/`clear`, no `fromWdr`, no per-field marks anywhere yet.

---

## Phase 0 — Resolve the two open decisions _(human call, before any code)_

`docs/DRIVER_ADT_DESIGN.md` §"Two things to decide before building" flags these as
unresolved. Pick before Phase 2 starts — they change the shape of the class:

1. **Vue reactivity over a class** — a reactive class instance, vs. a reactive
   plain-data core (values + marks) with `enter/clear/state` as free functions over it.
   The doc's lean: the latter is lower-risk and closer to today's code.
2. **Override reconciliation** — when a user overrides a normally-derived field (Cms,
   Bl, SPL, c, roo), does it become a fixed E input (WinISD's behaviour — the doc's
   default) or do dependents recompute around it? Decide per field if it varies.

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

Per the design doc's API (`enter`, `clear`, `get`, `state`, `errors`, `fromWdr`,
`toWdr`). Write failing tests first in the new package's test suite for:

- `enter('Fs', 37)` → `state('Fs') === 'E'`, `get('Fs') === 37`.
- `clear('Fs')` after entering Vas/Sd (enough to derive Fs is NOT how Fs derives —
  use a genuinely derivable field, e.g. clearing an entered Qts when Qes/Qms are both
  entered) → reverts to `'C'` with the recomputed value; clearing with no fallback
  derivation → `'N'`.
- Overriding a normally-computed field (per the Phase 0 decision) marks it `'E'` and
  behaves per the decided reconciliation rule.
- `state()` is the only implementation `stateOf` (editor) and `parstate` (exporter)
  call — no duplicate logic.

**Gate:** these are new tests against new code — no existing behaviour to preserve yet,
but the full health-check must stay green throughout (nothing else broken).

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
- **Editor (`packages/ui/src/components/DriverDefineModal.vue`):** the `entered`
  reactive object, `activeEntered` computed (lines ~103-104), `stateOf` (line ~206),
  and the `entered[key] = val` / `delete entered[key]` writes (lines ~220-221, clear-all
  at ~312) all collapse into calls on the `Driver` instance (`driver.enter`/`clear`/
  `state`). The modal stops owning provenance — it only drives the `Driver`.
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
- Duplicate `stateOf` (editor) vs `parstate` (engine) implementations.
- The lossy field-subset `parseWdr`.

**Gate:** full health-check green with the old code physically removed (not just
unused) — confirms nothing still depends on it.

---

## Non-goals

- No new UI features — this is a structural/provenance-correctness change, behaviour
  visible to the user should be unchanged except where it fixes an existing "provenance
  wrong after edit/reload/export" bug (the class of bug this migration exists to kill).
- Mobile/PWA (`PLAN.md` Phase 6) is unaffected and not pulled into scope.
