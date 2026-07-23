# Plan — WinISD Advanced-pane simulation options (the five toggles)

**Status: implemented 2026-07-23.** All five toggles are live in all three skins, with the
absent-`Le` defect they surfaced fixed. This document is kept as the design record: what each
option means, why that reading was chosen, and which parts rest on an unverified assumption.
Behaviour reference: `WINISD.md` §12d. Open questions Q1–Q8 are all resolved — rulings in
`BACKLOG.md`.

| #   | WinISD label (`docs/winisd/info/view_6_advanced.md`) | `.wpr` key     | Implemented as                                          |
| --- | ---------------------------------------------------- | -------------- | ------------------------------------------------------- |
| A   | `Simulate voice coil inductance`                     | `VCInd`        | `store.simVcInductance` — alias over `P.circuitModel`   |
| B   | `Force flat response`                                | `FlatResponse` | `SweepParams.forceFlatResponse` + `flatMaxBoostDb`      |
| C   | `Use "transmission line"-model for port simulation`  | `TLPorts`      | `SweepParams.tlPortModel` → `circuit.portImpedance()`   |
| D   | `Rg is at driver side`                               | none known     | `SweepParams.rgAtDriverSide`                            |
| E   | `SPL graph is Xmax limited`                          | none known     | `sweep().splXlim` / `.xlimited`, chosen by display flag |

Companion docs: [ARCHITECTURE.md](ARCHITECTURE.md) (AD-3/AD-6 layering) ·
[WINISD.md](WINISD.md) §9 (circuit model), §12d (these options) ·
[WINISD_WPR_FILE_SCHEMA.md](WINISD_WPR_FILE_SCHEMA.md) §10 ·
[docs/winisd/INPUT_PARITY.md](docs/winisd/INPUT_PARITY.md).

---

## 0. What was here before

All five checkboxes existed in the UI and were **inert** — bound to shell-local `ref`s nothing
read (`OriginalShell.vue` `advChecks`; `ClassicShell.vue` `advSimVcInductance` and friends);
Modern had no Advanced pane at all. That is the failure this work fixes, and the reason
`packages/ui/test/inert-control-gate.test.ts` now exists.

Machinery that was already present and got reused rather than reinvented:

- `SweepParams.circuitModel: 'winisd' | 'gyrator'` — feature A's physics, already built and
  validated (WINISD.md §9). Feature A needed no engine change at all.
- `sweep()`'s per-frequency `exc[]`, which feature E clamps against `Xmax`.
- The dashed-reference and segmented-colour rendering `series.ts` already had.
- The line-level gain convention `applyFilters` uses (multiply `U0`/`UD`/`UP`, leave `Zel`),
  which feature B's auto-EQ follows exactly.
- `state.P` persistence/share-link/fingerprint plumbing — the four new parameters needed none
  of their own.

### Evidence status — read before implementing

The bundled WinISD help (`research/winisd/help/`) is from an older version and **documents
none of these five toggles**. The strongest primary evidence available is the `.wpr` corpus
(50 real project files), which shows a `[SimulatorOptions]` section carrying exactly three
flags — `VCInd`, `FlatResponse`, `TLPorts` — **all zero in every sample**
(`WINISD_WPR_FILE_SCHEMA.md:361-379`). So:

- The existence and per-project scope of A/B/C is confirmed.
- The **behaviour** of A/B/C is ⚠ unverified — presumed from the names.
- D and E have **no known `.wpr` key at all**. Either they are app-level (registry/Options)
  rather than per-project, or the corpus predates them. ⚠ unverified.

Every semantic choice below must land in `WINISD.md` under an explicit
`⚠ Assumption — NOT directly verified` heading, per CLAUDE.md.

### Bug found while investigating (report only — not in this plan's scope)

**A driver with no `Le` produces `zmag = NaN` across the entire sweep, and the app reports it
as a fatal simulation error.** Directly observed 2026-07-23 via a throwaway probe against
`packages/engine/src/index.ts`:

- Input: the demo 6.5" woofer's parameters with `Le` omitted
  (`Fs:37, Qts:0.378, Qes:0.40, Qms:7.0, Vas:0.0300, Sd:0.0133, Re:5.6, Xmax:0.005, Pe:60`).
- `deriveDriver()` returns `errors: []` and `d.Le === undefined` — it neither defaults nor
  validates `Le` (`packages/engine/src/driver.ts` never assigns it; `DriverRaw.Le` is optional,
  `types.ts:46`).
- `circuit.ts:65` then evaluates `cx(0, w * drv.Le!)` → `NaN`, so `Zcoil` and therefore `Zel`
  are `NaN` at every frequency.
- Observed output: `zmag: [NaN, NaN, NaN, NaN, NaN]` while `spl` is finite.
- Downstream, `classifyFinite()` sees a non-finite observable at _every_ index and returns the
  **error** "Simulation produced no usable values — check the box volume and driver
  parameters." (`packages/engine/src/sweep.ts:139-140`) — which points the user at the wrong
  thing entirely.

This sits directly in feature A's code path. Awaiting a ruling on whether to fix it as part
of A (treat absent `Le` as 0) or as its own item. Recorded in BACKLOG.md.

---

## 1. Shared foundation (do first)

### 1.1 State

Add to `UiParams` (`packages/ui/src/types.ts`) and `P_DEFAULTS` (`packages/ui/src/store.ts:13`):

```ts
simVcInductance: boolean; // A — alias onto circuitModel, see §2A
forceFlatResponse: boolean; // B
tlPortModel: boolean; // C
rgAtDriverSide: boolean; // D
splXmaxLimited: boolean; // E
```

All default to the value that **preserves today's behaviour exactly**, so the golden fixtures
stay byte-identical (see §4). For D that is `true`, not WinISD's unchecked default — see Q3.

### 1.2 Field registry

Five `kind: 'toggle'` specs in `packages/ui/src/fields/fieldRegistry.ts`, `pane: 'Advanced'`,
`provenance: 'entered'`, `modeled: true`, `appliesTo` per feature (C is
`['vented','bandpass4']`; the rest `'all'`). These are the registry's **first** `toggle`
entries — `fieldRegistry.test.ts` requires `min`/`max` only for `kind: 'number'`, so confirm
that test passes unchanged before relying on it.

Each `description` must carry the WinISD label, the `.wpr` key (or "no known key"), and the
assumption status (UI-3).

### 1.3 Mechanical gate — "no inert control" (land this FIRST)

The class of fault here is not "these five toggles are unwired"; it is **a user-visible
control whose model nothing downstream reads**. Five of them survived in two skins.

New test `packages/ui/test/inert-control-gate.test.ts`, registry-driven:

> For every `FieldSpec` with `kind: 'toggle'` and `modeled: true`:
>
> 1. its `id` exists as a key of `P_DEFAULTS`, and
> 2. every shell that renders the field's `pane` binds `state.P.<id>` (not a shell-local
>    `ref`) — asserted by reading the `.vue` sources and matching `v-model="state.P.<id>"`.

It passes vacuously today (no toggles registered), then polices each toggle from the commit
that registers it. That ordering makes it a real driver rather than a five-commit red.

### 1.4 UI surfaces

- **Original** — replace the `advChecks` reactive (`OriginalShell.vue:309`) and the five
  `<label>`s (`:837-841`) with `state.P` bindings; delete the "not modelled by the sweep yet"
  hint at `:842`; keep the environment part of that hint (environment genuinely is still
  unmodelled — BACKLOG P1).
- **Classic** — same for `ClassicShell.vue:53-57` / `:364-376`.
- **Modern** — has no Advanced pane. Add a shared `AdvancedPanel.vue` fieldset to
  `SidePanel.vue` rather than inventing a third inline copy. (Deciding whether Modern gets
  the environment fields too is out of scope — this plan adds only the five toggles.)
- Every checkbox needs a `title` describing the _effect_ plus its WinISD cross-reference
  (UI-1, UI-3), e.g.
  `"Include voice-coil inductance Le in the acoustic circuit, not just the impedance plot. WinISD: Advanced → 'Simulate voice coil inductance' (.wpr VCInd). Default off — WinISD's own circuit excludes Le from the acoustic side (WINISD.md §9)."`
- A Playwright test per skin: toggle the checkbox, assert the SPL/Z curve actually changes
  (a DOM assertion alone does not prove a curve was redrawn — DEVELOPMENT.md §3).

### 1.5 `.wpr` export — stop writing placeholders

`packages/winisd/src/wpr.ts:155-156` currently hardcodes
`['VCInd', 0], ['FlatResponse', 0], ['TLPorts', 0]`. That is exactly the "fixed placeholder in
a foreign serialization format" the project bans. Thread the real flags through
`WprProject` → `wprMapping.ts` → `useDesignIO.ts`/`ExportMenu.vue`, and extend
`packages/ui/test/wprMapping.test.ts` to assert a toggled flag round-trips as `1`.

D and E have no known key — **do not invent one**. Leave them unserialized and note the gap in
`WINISD_WPR_FILE_SCHEMA.md` §11 question 5.

---

## 2. Per-feature design

Ordered by ascending risk. Each is its own red→green commit with its own tests.

### E — `SPL graph is Xmax limited` (do first: additive, zero semantic risk)

**Model.** At each frequency, reduce drive until peak excursion no longer exceeds `Xmax`:

```
splXlim[i] = spl[i] + 20·log10( min(1, Xmax / x_peak[i]) )
xlimited[i] = x_peak[i] > Xmax
```

`x_peak` is `sweep()`'s existing `exc[i]` (mm; `Xmax` is metres — convert). Pe is deliberately
**not** applied: the label says Xmax, and the Max-SPL chart keeps owning the Pe ∧ Xmax logic.

**Where.** In the engine, as **two new arrays on `SweepResult`** (`splXlim`, `xlimited`) —
never by mutating `spl[]`. `spl` also feeds the TFMag chart, the F3/F6/F10 read-outs
(`series.ts:46`), `StatBar`, and every compare trace; clamping it in place would silently
corrupt all of those. The golden test iterates a fixed key list
(`packages/engine/test/golden.test.ts:45-49`), so extra `SweepResult` keys are additive-safe —
fixtures do not need regenerating.

**UI.** `series.ts` `tabId === 'SPL'` plots `splXlim` when `P.splXmaxLimited`, and passes
`xlimited` as the existing `xlim` segmented-colour channel that MaxSPL already uses
(`series.ts:106-113`) so the limited region is visually obvious. The Options → Plot Window
"Xmax limit" colour already exists and binds here.

**Tests** `[unit]`: with a drive low enough that `x < Xmax` everywhere, `splXlim === spl`
exactly; with a high drive, `splXlim ≤ spl` everywhere and every clamped point has
`xlimited === true`; a point at exactly `Xmax` is unclamped. `[ui]`: toggling the checkbox
changes the SPL trace.

### A — `Simulate voice coil inductance`

**No engine change.** The physics already exists as `circuitModel` and is validated
(WINISD.md §9). This feature is naming and exposure:

- `state.P.simVcInductance` is a **derived alias** over `state.P.circuitModel`
  (`false ↔ 'winisd'`, `true ↔ 'gyrator'`) — one source of truth, two presentations. Do not
  add a second independent flag; two fields describing one switch is how they drift apart.
- The Advanced pane shows WinISD's wording; `SignalPanel.vue:36` keeps the engineer wording.
  Both write the same store field.
- `.wpr` writes `VCInd = circuitModel === 'gyrator' ? 1 : 0`.

**Open behaviour question (Q5).** With the box unchecked, does WinISD also drop `Le` from the
_impedance_ plot? Today OpenISD always includes it in `Zel` (`circuit.ts:145`). Recommendation:
keep that, document as an assumption. Changing it would alter the Z curve for every existing
design.

**Blocked-adjacent.** The absent-`Le` NaN bug above lives in this exact code path. Fixing it
inside A (`const Le = drv.Le ?? 0`) is the cheap, obvious move — but it is a behaviour change
on invalid input and needs the human's word first.

**Tests** `[unit]`: already covered by the existing circuit-model tests; add one asserting the
alias maps both ways. `[ui]`: toggling the Advanced checkbox moves the `SignalPanel` select,
and vice versa.

### D — `Rg is at driver side`

**Current behaviour is already "on".** `circuit.ts:63-68` folds `Rs` into the per-driver coil
impedance _before_ the wiring scale factor:

```
Rdc1     = Re_hot + Rs                       // per driver
ZcoilAC  = series ? n·Rdc1 : Rdc1/n          // Rs scales with the array
```

so `Rs` behaves as a resistance in series with **each** driver — i.e. at the driver side.

**Toggle off** should mean a single source resistance in series with the whole array:

```
Zarray = series ? n·Re_hot : Re_hot/n
Zcoil  = Rs + Zarray                          // one Rg, common to all drivers
```

**This differs only when `nDrivers > 1`.** For every single-driver design the two are
algebraically identical, so four of the six golden fixtures are untouched either way; only
`sealed-2drv-parallel` and `vented-2drv-series` would move if the default flips.

**Also affects `Zel`** (`circuit.ts:145`), which currently includes `Rs`. Whether the plotted
impedance should include a source resistance that sits at the amplifier is a separate
question — Q4.

**Tests** `[unit]`: with `nDrivers = 1` the flag is an exact no-op (bit-identical arrays, both
positions); with `nDrivers = 2` parallel, `rgAtDriverSide: false` yields a strictly higher
total series resistance and therefore lower SPL than `true`; hand-computed `Zel` at one
frequency for both positions.

### C — `Use "transmission line"-model for port simulation`

**Scope guard.** This is a transmission-line model **of the port/duct**, not a
transmission-line _enclosure_. `BACKLOG.md:248` P3 ("Transmission line / quarter-wave — line
length + stuffing") and `FEATURE_COMPARISON.md:172` are the enclosure item and stay open.
`FEATURE_COMPARISON.md:451` is this one. The two are currently conflated in the docs and must
be disambiguated as part of this work.

**Model.** Today the vent is a lumped mass (`circuit.ts:107-108`):

```
Map = ρ·Leff/Sp        Zport = Rap + jωMap
```

which is valid while the duct is short against a wavelength; it has no organ-pipe resonance,
so it over-predicts output above the pipe fundamental — the very `c/(2·Leff)` figure the
Original Vents pane already reports as "1st port resonance"
(`portPipeResonance`, `OriginalShell.vue`). The TL model replaces the lumped mass with the
input impedance of a uniform lossy duct terminated by its radiation load:

```
Z0   = ρc / Sp                                  characteristic impedance
γ    = α + j·ω/c                                complex propagation constant
Zrad ≈ Z0·( ¼(ka)² + j·0.6·ka ),  a = √(Sp/π)   piston-in-baffle mouth load (low ka)
Zport = Z0 · (Zrad + Z0·tanh(γL)) / (Z0 + Zrad·tanh(γL))
```

with `L` the **physical** vent length (`state.P.ventL`) — in the TL model the end correction is
no longer an added length, it is the `Zrad` term. Choose `α` so the ω→0 limit reproduces the
lumped `Rap = ωMap/Qp`, so `Qp` keeps its present meaning and the two models agree at low
frequency by construction.

**Engine work.** `complex.ts` has no transcendental functions — add `cExp` and `cTanh`
(`packages/engine/src/complex.ts`). Branch in the `vented` and `bandpass4` arms of `solve()`;
the `pr` arm is untouched.

**Tests** `[unit]`:

1. Below `Fb`, TL and lumped `Zport` agree to a stated tolerance (the physical justification
   for the lumped model, asserted rather than assumed).
2. TL `|Zport|` shows a resonance near `c/(2L)` that the lumped model does not.
3. `tlPortModel: false` is bit-identical to today (golden fixtures unchanged).
4. `cTanh` against hand-computed values, including a large-argument case (guard the
   `exp` overflow that naive `tanh` implementations hit).

### B — `Force flat response` — **BLOCKED on Q1**

Two readings, and they produce completely different charts:

1. **Display normalization** — renormalize SPL so the passband reference is 0 dB. Rejected as
   the likely reading: OpenISD already has exactly this as the separate `TFMag` chart
   (`series.ts:56-64`), which mirrors WinISD's own separate "Transfer function magnitude"
   chart (WINISD.md §17). WinISD would not need a checkbox for a chart it already has.
2. **Auto-EQ / inverse filter** — derive the frequency-dependent gain that flattens the system
   response, apply it, and let the user read the _cost_ on the excursion, port-velocity and
   max-SPL charts. This is the reading consistent with the flag living in `[SimulatorOptions]`
   next to two physics-model flags, rather than in `[PlotSettings]`.

**Recommendation: reading 2** — but do not build it until the human rules, because a wrong
reading here yields a plausible-looking, wrong chart, which is worse than an unimplemented
checkbox.

**Design under reading 2.** Two-pass inside `sweep()`:

1. Pass 1 as today → `spl[]`.
2. Reference `ref` = passband reference. **Reuse** the definition `series.ts:62-63` already
   uses for TFMag (max finite `spl`, ignoring the −200 dB sentinel) — and move it into the
   engine so the two share one implementation instead of two drifting copies.
3. Per-point correction `g[i] = ref − spl[i]`, **clamped** to a maximum boost (Q2), applied as
   a real line-level gain on `U0`/`UD`/`UP` exactly as `applyFilters` does
   (`sweep.ts:65-69`) — so SPL flattens _and_ excursion, port velocity and Max-SPL show what
   the EQ costs. `Zel` is untouched (line-level, upstream of the amp).
4. Where the clamp binds, emit a `DriverError`-shaped `warn` through the existing
   `classifyFinite`/`allIssues` channel naming the frequency — an unbounded boost of a 4th-order
   rolloff is physically absurd and must never be presented silently.

**Tests** `[unit]`: with the flag on and no clamp binding, `spl` is flat to within tolerance
across the passband; excursion strictly increases wherever boost was applied; the clamp binds
where expected and raises a warn; flag off is bit-identical to today.

---

## 3. Documentation to update in the same session

| File                                      | Change                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `WINISD.md`                               | New section: the five toggles, each with its `⚠ Assumption — NOT directly verified` block |
| `WINISD_WPR_FILE_SCHEMA.md` §10, §11 Q5   | `VCInd`/`FlatResponse`/`TLPorts` now written from real state; no key known for D/E        |
| `docs/winisd/INPUT_PARITY.md:82-86`       | Five rows ❌/⚠️ → ✅                                                                      |
| `FEATURE_COMPARISON.md:451-455`           | Same five rows; also disambiguate TL-port (this) from TL-enclosure (`:172`, still ⬜)     |
| `BACKLOG.md:236`                          | P2 "Loading/model options" — strike the four items this closes; isobaric stays open       |
| `packages/ui/src/fields/fieldRegistry.ts` | Five toggle specs                                                                         |
| `LOG.md`                                  | Value entry: what a user can now do that they could not                                   |

---

## 4. Verification

- Every feature's flag defaults to today's behaviour → **`npm run test:unit` golden fixtures
  must stay byte-identical without regeneration**. If any golden moves, that is a real
  behaviour change to explain, not a fixture to refresh.
- Full gate `bash scripts/health-check.sh` green before any "done" claim.
- Per skin, per feature: a Playwright test that proves the _curve_ changed, not just the DOM.
- `inert-control-gate.test.ts` green — no toggle can be added unwired again.

---

## 5. Open questions — awaiting the human (mirrored in `BACKLOG.md`)

| #   | Question                                                                                                                                 | Blocks |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Q1  | `Force flat response`: auto-EQ (reading 2, recommended) or display normalization (reading 1)?                                            | B      |
| Q2  | If auto-EQ: what maximum boost does the clamp allow, and is a warn at the clamp acceptable?                                              | B      |
| Q3  | `Rg is at driver side` default: match WinISD (unchecked = amp side, **moves the two 2-driver goldens**) or preserve current behaviour?   | D      |
| Q4  | Should the plotted impedance `Zel` include `Rg` when `Rg` is at the amplifier side?                                                      | D      |
| Q5  | With `VCInd` off, does `Le` also leave the _impedance_ plot, or only the acoustic path (current behaviour)?                              | A      |
| Q6  | D and E have no known `.wpr` key. Leave them out of the exported project file, or invent keys? (Recommendation: leave out.)              | §1.5   |
| Q7  | Absent-`Le` NaN bug (§0): fix inside A as `Le ?? 0`, or track separately?                                                                | A      |
| Q8  | Modern skin has no Advanced pane. Add a shared `AdvancedPanel.vue` fieldset for the five toggles (recommended), or leave Modern without? | §1.4   |

---

## 6. Suggested commit sequence

1. `1.3` mechanical gate (passes vacuously) + `1.1`/`1.2` state & registry scaffolding
2. **E** — Xmax-limited SPL (engine additive + series + 3 skins)
3. **A** — VC inductance alias + Advanced-pane exposure
4. **D** — Rg placement
5. **C** — transmission-line port model (`cExp`/`cTanh` first, as its own green step)
6. **B** — force flat response _(only after Q1/Q2 are answered)_
7. `.wpr` export wiring + docs sweep + `LOG.md`
