# Resonate — re-architecture plan ("make it not shitty")

Addresses [issue #1](https://github.com/Johnlon/resonate/issues/1). Companion to
[BACKLOG.md](BACKLOG.md) (full feature backlog and priorities) · [DEVELOPMENT.md](DEVELOPMENT.md)
(practices) · [references.md](references.md) (prior art + test oracles).

## The one principle: **extract, do not rewrite**

The engine is validated to **0.03 dB** against the closed-form physics — it is the
one genuinely proven asset in this spike. Re-architecture means **moving the
existing math behind clean boundaries, byte-for-byte**, not reimplementing it.
A clean-room rewrite would re-introduce physics bugs already paid for. Every phase
below is behaviour-preserving and gated by tests.

## Target shape

```
packages/engine/src/   pure, no DOM — the reusable library (the product)
src/ui/     DOM + canvas, consumes core — the Resonate web app
index.html  shell, classic <script src> includes (offline-safe; see DEVELOPMENT.md)
mobile      a SECOND consumer of the same core (deferred)
```

**The deliverable that makes it reusable is not "no DOM" — it is a documented,
versioned `Design → Curves` data contract.** That is what a third-party UI
depends on and what every test asserts against. "No DOM in core" is necessary but
not sufficient; the contract is the thing.

---

## Phases (in execution order)

### Phase 0 — Golden-master safety net  *(do this first, before moving any code)*
Oracle tests prove *correctness*; they do **not** prove an extraction *preserved
behaviour*. So first, freeze current behaviour:
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

### Phase 3 — Per-module oracle tests  *(test effort weighted by risk)*
Real inputs, real outputs, asserted against the tiered oracles in REFERENCES.md.
No mocking of the physics. Heavy on `circuit` / `sweep` / `alignments` and
`wdr` / `state`; light on `complex`.

### Phase 4 — Rebuild the Resonate UI on the core API
Point `src/ui/` at the published contract only (no reaching into internals).
Behaviour unchanged; golden master + Playwright green.

### Phase 5 — Functional UI tests + CI
Playwright headless (or evaluate the Chrome MCP server, see TODO research item):
grid renders non-blank canvases, driver collapse/expand, `.wdr` import changes the
curve, share-link round-trip. CI runs unit + golden + functional on every push.

### Phase 6 — Mobile  *(deferred; proves the decoupling)*
A responsive / PWA UI as a **second consumer** of the unchanged core. Explicitly
**not** part of the foundation; do not let it pull scope into the core work. No
native wrapper until the responsive web UI exists.

### Cross-cutting — error visibility  *(sized to a static client tool)*
A global error boundary (surface failures instead of dying silently) and a
debug-log toggle. **Not** an observability stack.

---

## Core modules (7) and the box-type seam

| Module | Responsibility | Test weight |
|---|---|---|
| `complex` | complex arithmetic | light |
| `driver` | T/S derivation, consistency | medium (datasheet fixtures) |
| `wdr` | `.wdr` parse / serialize | heavy (round-trips, malformed input) |
| `circuit` | per-frequency lumped solve, per box type | **heavy** (closed forms, sanity oracles) |
| `sweep` | curves from the circuit | **heavy** (golden + oracles) |
| `alignments` | Qtc / QB3 / B4 / PR tuning, vent↔tuning | **heavy** (alignment tables) |
| `state` | serialize / URL / localStorage | heavy (round-trips) |

Box types are a `boxType → loadFunction` **map**, not a plugin framework — that
abstraction is unearned until 3+ types prove the seam.

---

## Scope guards (so "rearchitect" doesn't sprawl)
- **Offline is sacred:** classic `<script src>` + dual export, never ES `import`
  in the shipped app (breaks `file://`). No build step.
- **Packaging deferred:** npm / versioned distribution waits for external demand.
  Reusability is achieved *structurally* now (boundary + contract + dual export).
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
