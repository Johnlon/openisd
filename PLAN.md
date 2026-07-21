# OpenISD — re-architecture plan ("make it not shitty")

Addresses [issue #1](https://github.com/Johnlon/openisd/issues/1). Companion to
[BACKLOG.md](BACKLOG.md) (full feature backlog and priorities) · [DEVELOPMENT.md](DEVELOPMENT.md)
(practices) · [REFERENCES.md](REFERENCES.md) (prior art + test oracles).

## The one principle: **extract, do not rewrite**

The engine is validated to **0.03 dB** against the closed-form physics — it is the
one genuinely proven asset in this spike. Re-architecture means **moving the
existing math behind clean boundaries, byte-for-byte**, not reimplementing it.
A clean-room rewrite would re-introduce physics bugs already paid for. Every phase
below is behaviour-preserving and gated by tests.

## Target shape

```
packages/engine/src/   pure, no DOM — the reusable library (the product)
src/ui/     DOM + canvas, consumes core — the OpenISD web app
index.html  shell, classic <script src> includes (offline-safe; see DEVELOPMENT.md)
mobile      a SECOND consumer of the same core (deferred)
```

**The deliverable that makes it reusable is not "no DOM" — it is a documented,
versioned `Design → Curves` data contract.** That is what a third-party UI
depends on and what every test asserts against. "No DOM in core" is necessary but
not sufficient; the contract is the thing.

---

## Phases (in execution order)

### Phase 0 — Golden-master safety net _(do this first, before moving any code)_

Oracle tests prove _correctness_; they do **not** prove an extraction _preserved
behaviour_. So first, freeze current behaviour:

- For a handful of designs covering **every** box type (sealed, vented,
  bandpass4, PR — and the n-driver and PR cases), dump the current sweep outputs
  (SPL, excursion, impedance, group delay, port velocity, max SPL/power) at a
  fixed frequency grid to `test/fixtures/golden/*.json`.
- A `golden.test.js` asserts the engine reproduces them exactly.
- **Gate:** golden master green on the un-moved code = the net is in place.

### Phase 1 — Extract the core incrementally

One module at a time into `packages/engine/src/*.js` with the dual export (classic script +
`module.exports`, per DEVELOPMENT.md). After **each** module:

- golden master + in-page self-test stay green,
- **go/no-go:** `index.html` still opens and runs from `file://` **and**
  `node --test` requires the module. Both pass → next. Either fails → stop.
- Pure move only — identical behaviour, no UI reorg, no new features.

### Phase 2 — Define & version the `Design → Curves` contract

Write it down (shape of the `Design` input and the `Curves` output) in
`CONTRACT.md`, version it (`v1`), and make the core expose exactly that
surface: `simulate(design) → curves`, `deriveDriver`, `parseWdr` / `toWdr`,
`align(...)`, `serializeState` / `applyState`. Tests assert against the contract,
not internals.

### Phase 3 — Per-module oracle tests _(test effort weighted by risk)_

Real inputs, real outputs, asserted against the tiered oracles in REFERENCES.md.
No mocking of the physics. Heavy on `circuit` / `sweep` / `alignments` and
`wdr` / `state`; light on `complex`.

### Phase 4 — Rebuild the OpenISD UI on the core API

Point `src/ui/` at the published contract only (no reaching into internals).
Behaviour unchanged; golden master + Playwright green.

### Phase 5 — Functional UI tests + CI

Playwright headless (or evaluate the Chrome MCP server, see TODO research item):
grid renders non-blank canvases, driver collapse/expand, `.wdr` import changes the
curve, share-link round-trip. CI runs unit + golden + functional on every push.

### Phase 6 — Mobile _(deferred; proves the decoupling)_

A responsive / PWA UI as a **second consumer** of the unchanged core. Explicitly
**not** part of the foundation; do not let it pull scope into the core work. No
native wrapper until the responsive web UI exists.

### Cross-cutting — error visibility _(sized to a static client tool)_

A global error boundary (surface failures instead of dying silently) and a
debug-log toggle. **Not** an observability stack.

---

## Core modules (7) and the box-type seam

| Module       | Responsibility                           | Test weight                              |
| ------------ | ---------------------------------------- | ---------------------------------------- |
| `complex`    | complex arithmetic                       | light                                    |
| `driver`     | T/S derivation, consistency              | medium (datasheet fixtures)              |
| `wdr`        | `.wdr` parse / serialize                 | heavy (round-trips, malformed input)     |
| `circuit`    | per-frequency lumped solve, per box type | **heavy** (closed forms, sanity oracles) |
| `sweep`      | curves from the circuit                  | **heavy** (golden + oracles)             |
| `alignments` | Qtc / QB3 / B4 / PR tuning, vent↔tuning  | **heavy** (alignment tables)             |
| `state`      | serialize / URL / localStorage           | heavy (round-trips)                      |

Box types are a `boxType → loadFunction` **map**, not a plugin framework — that
abstraction is unearned until 3+ types prove the seam.

---

## Scope guards (so "rearchitect" doesn't sprawl)

- **Offline is sacred:** classic `<script src>` + dual export, never ES `import`
  in the shipped app (breaks `file://`). No build step.
- **Packaging deferred:** npm / versioned distribution waits for external demand.
  Reusability is achieved _structurally_ now (boundary + contract + dual export).
  Premature packaging tempts a build step, which fights offline.
- **Mobile deferred** to Phase 6.
- **Error handling sized small** (boundary + debug toggle).

---

## First concrete step (tomorrow morning)

Phase 0, before a single line of logic moves:

1. `node` script that loads the current engine, sweeps ~4 designs (one per box
   type) on a fixed grid, writes `test/fixtures/golden/<name>.json`.
2. `test/golden.test.js` (`node:test`) re-runs the sweeps and asserts equality.
3. Commit the fixtures + test. Green = the safety net is live; extraction begins.

---

## Thermal power compression + driver added-mass (2026-07-21)

Two WinISD-parity physics features, verified WinISD simulates them (`WINISD.md §12c`),
absent from OpenISD. Both are **engine additions gated on ΔT=0 / Madd=0 being exact no-ops**
so all existing goldens stay byte-identical.

### A. Voice-coil thermal power compression
- **Inputs (SweepParams):** `vcTempRise` (ΔT, K) and `alfaVC` (SI temp-coefficient, /K — the
  UI's `1000/K` value ÷ 1000).
- **Model:** `Re_hot = Re·(1 + alfaVC·ΔT)`, applied where `Rdc1 = Re + Rs` is built in
  `circuit.ts` — the ONLY place the coil resistance enters. Drive voltage `eg` stays on the
  cold (reference) Re, so the same voltage yields less current at hot Re → SPL drops, the
  impedance floor rises, and the Max-SPL line shifts. No change to `deriveDriver`/`Driver`.
- **No-op:** `vcTempRise=0` (default) → `Re_hot=Re` → identical to today.

### B. Driver-side added mass to cone
- **Input (SweepParams):** `driverAddedMass` (kg; UI enters grams ÷ 1000).
- **Model:** pure `withAddedMass(driver, MaddKg) → driver` transform in the engine —
  `Mms += Madd`, hold `{Cms, Rms, Bl, Re, Sd, Vas, Le}` fixed, recompute
  `Fs = 1/(2π√(Mms·Cms))`, `Qms = 2π·Fs·Mms/Rms`, `Qes = 2π·Fs·Mms·Re/Bl²`,
  `Qts = Qes·Qms/(Qes+Qms)`. Applied at the top of `sweep()` and `maxCurves()` so impedance,
  SPL, and excursion all see the shifted driver.
- **No-op:** `driverAddedMass=0` (default) → transform returns the driver unchanged.

### Oracle anchors (from the human's WinISD session, §12c)
- Added mass: `Mms≈14.6 g`, +100 g → Fs **70 → 25 Hz** (asserted ±0.5 Hz).
- Compression: impedance floor rose ~**21 → 23 Ω** (directional/monotonic check; exact ΔT
  unknown, so unit tests assert the closed form + monotonicity, not that single magnitude).

### Sequence
1. B (added mass) first — precise oracle, self-contained transform.
2. A (power compression) — circuit change.
3. UI wiring (Original + shared) reading `fieldRegistry` for both.
4. New golden fixtures at non-zero ΔT / Madd; existing goldens must not move.
