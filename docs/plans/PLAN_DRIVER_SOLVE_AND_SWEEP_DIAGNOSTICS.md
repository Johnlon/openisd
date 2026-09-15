# Calculation and Diagnostic Contract

Status: PLAN — not implemented

This document is the written-down output of an interactive design discussion recorded verbatim in
`docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.txt`. That discussion fully typed the Driver
channel (`DriverSolveResult`/`DriverIssue`/`SolveRoute`) but was cut short by the agent running out
of session budget before doing the same for Box, Signal, Environment, and the `SweepCalculationResult`
prerequisite types it had already named — those existed only as bare field names with no type behind
them. **Public Contracts**, below, completes that work, holding every channel to the identical shape.

**Convergence**, further below, extends the same unification to every calculation method that
predates this document — not just the six new solve results. The concrete anchor is
`OpenISDDriver.checkConsistency(): ConsistencyIssue[] { return []; }`
(`packages/design/domain/openisdDomain.ts:1479`), which nothing currently makes non-empty because
the engine-side relation table it would need was removed along with the rest of the old
`packages/engine`. That section maps out which existing methods (`solveConsistencyGroup`,
`checkVentConsistency`, `checkPrConsistency`, `validateParams`, `dqCalculated.ts#calcMark`) converge
on the new shape, which stay deliberately separate (`SweepIssue`, for curve/frequency diagnostics
with no single named quantity), and which hand-rolled UI/domain helpers
(`useDriverCells.ts#consistencyNote`/`fieldIsMandatoryAndUnsatisfied`, `DriverEditorModal.vue`'s
`chartBlockingReasons`) exist only because no calculation used to return a structured issues array
and can collapse into one generic projection once every channel does.

## Terms

| Term | Meaning |
|---|---|
| **Solver** | A calculation node that derives missing quantities from known quantities and reports why a target cannot be derived. This applies to driver T/S, sealed alignment, vent, passive-radiator, and box-parameter calculations. It does not draw curves. |
| **Circuit solution** | The physical answer at **one frequency**. Given complete inputs, `circuit.ts` calculates cone/port motion, acoustic output, impedance, phase, and related complex values for that frequency. |
| **Sweep** | Calls the circuit solution repeatedly over a frequency grid and collects the results into curves. |
| **Engine** | The public façade. It exposes solver, circuit-facing, sweep, air, and alignment operations. It contains no second copy of the maths. |
| **Domain** | Owns the project record and maps engine values/issues to fields and provenance. |
| **Hook/UI** | Displays values and diagnostics. It does not calculate or diagnose. |

## Calculation Owners

| Calculation | Owner | Output |
|---|---|---|
| Driver T/S derivation | `engine/solver.ts` | solved driver values + driver issues |
| Sealed alignment | `engine/boxDesign.ts` through `Engine` | target-Qtc options, Vb, Qtc, closest option, EBP suitability |
| Vented alignment/port | `engine/boxDesign.ts` through `Engine` | Fb, vent length, reachable/unreachable issue |
| Passive-radiator tuning | `engine/boxDesign.ts`/`engine/solver.ts` through `Engine` | Fp, added mass, reachability issue |
| Box parameter validation | `engine/params.ts` through `Engine` | box prerequisite issues |
| Air properties | `engine/air.ts` through `Engine` | `rho`, `c`, environment issues |
| One-frequency physical response | `engine/circuit.ts` | one `Solution` at frequency `f` |
| Frequency response curves | `engine/sweep.ts` | curves + sweep issues/prerequisite references |
| Public access | `engine/Engine.ts` | the only calculation façade |

## Solver Nodes

These are separate solver nodes with the same result discipline. They are not separate copies of
the physics engine and they do not call the UI.

### Driver T/S Solver

**Input:** entered driver quantities, including provenance-independent numeric values such as
`Fs`, `Qes`, `Qms`, `Qts`, `Vas`, `Sd`, `Cms`, `Mms`, `Re`, `BL`, and geometry fields.

**Output:** `DriverSolveResult` — all quantities derivable from the entered values, plus
`DriverIssue[]` (**Public Contracts**, below).

**Examples:**

- `Qts` from `Qes + Qms`.
- `Cms` from `Vas + Sd + air` or from `Fs + Mms`.
- `Fs` from `Mms + Cms`, `Rme + Qes + Mms`, or `EBP + Qes`.
- `Vas` from `Cms + Sd + air`.

If no route is complete, the output names every blocked route. If complete routes disagree, the
output reports the contradiction using the engine's declared route precedence.

### Sealed Alignment Solver

**Input:** driver `Qts`, `Vas`, target numeric `Qtc`, or driver `Qts`, `Vas`, and sealed `Vb`.

**Output:** `SealedAlignmentSolveResult` (**Public Contracts**, below) — calculated `Vb` or
calculated `Qtc`, closest WinISD alignment option, and a `SealedAlignmentIssue` where appropriate.

The WinISD sealed menu is nine target values:

```text
0.500 Critically damped
0.577 Max flat delay response
0.707 Max flat amplitude response
0.800 Equal ripple response
0.900 Equal ripple response
1.000 Equal ripple response
1.100 Equal ripple response
1.200 Equal ripple response
1.500 Equal ripple response
```

The engine stores each WinISD option as a number and a label:

```ts
{ qtc: 0.707, label: '0.707 Max flat amplitude response' }
```

All nine options use the same sealed-box calculation:

```text
Vb = Vas / ((Qtc / Qts)^2 - 1)
```

The dropdown shows the labels exactly as WinISD shows them. Do not add Bessel, Butterworth, or
Chebyshev options that are not in WinISD's dropdown.

#### Why sealed and vented name alignments differently

⚠ Sourced web research (verified live, not a WinISD-source confirmation of developer intent) —
see citations below.

Sealed is a 2nd-order, single-parameter system: given a driver's Qts, `Vb` is the only design
variable, and Qtc moves as a direct function of it. The 9 dropdown entries are waypoints on ONE
continuum, not separate formula families — confirmed in-repo by `winisd_research/PROBE_FINDINGS.md`'s
closed-alignment probe: all 9 fit the same lossless `Vb = Vas / ((Qtc/Qts_eff)^2 - 1)` at one
effective Qts.

Butterworth/Bessel/Chebyshev and "max flat amplitude"/"max flat delay"/"equal ripple" are not an
electrical-vs-acoustical split. Both halves of each pair are standard electrical-filter-theory
vocabulary — an eponym and a descriptive name for the same filter object. "Alignment" as a
loudspeaker-design concept was imported from electrical filter theory wholesale by Thiele and
Small, including both naming conventions already paired there.

The two box types' menus each kept the vocabulary of the different original paper that defined
that alignment table. Thiele's 1971 AES paper "Loudspeakers in Vented Boxes: Part 1" coined
QB3/B4/C4/SC4 directly — QB3 relaxes the Butterworth (B4) point-solution to cover a range of Qts
below it, and SC4 does the same past C4 — because vented is a genuinely two-parameter system (`Vb`
AND `Fb`), so distinct named alignments are separate point-solutions, not waypoints on a line.
Small's closed-box papers describe the sealed case purely by Qtc value with descriptive labels,
because there is only one parameter to describe — a compact code buys nothing a plain description
does not already give.

So the "do not add Bessel/Butterworth/Chebyshev" rule above is not an arbitrary UI restriction: it
reflects which paper's terminology each box type's alignment table comes from, and a real
structural difference — one continuum versus several point-solutions — not a UI author's whim.

Sources:
- Thiele, "Loudspeakers in Vented Boxes: Part 1" (1971) — https://scispace.com/papers/loudspeakers-in-vented-boxes-part-1-2u24ym2wrg
- "Computation of Bass Reflex Alignments", audioXpress — https://audioxpress.com/article/focus-computation-of-bass-reflex-alignments
- Small, "Vented-Box Loudspeaker Systems Part 1: Small-Signal Analysis" — https://sdlabo.jp/archives/Vented_Box_Loudspeaker%20Systems_Part_1-4.pdf
- "DIY Loudspeaker Design - Alignments for boxes" — https://sites.google.com/site/diyloudspeakerdesign/home/box-design/alignments
- "Voice Coil Focus: Quasi-Alignment Families", audioXpress — https://audioxpress.com/article/voice-coil-focus-quasi-alignment-families
- ScienceDirect, "Bessel Filter" overview (eponym vs. descriptive-name pairing) — https://www.sciencedirect.com/topics/engineering/bessel-filter

Quick-reference table (electrical eponym paired with the acoustic/WinISD descriptive label —
"Critically Damped" has no separate eponym; it is the one row where both terminologies coincide):

| Electrical Terminology | Acoustic Terminology (WinISD label) | Qtc | System Behaviour |
| --- | --- | --- | --- |
| Critically Damped | Critically damped response (same term — no distinct eponym) | 0.500 | No overshoot, perfect transient response, but bass rolls off early. |
| Bessel Alignment | Max flat delay response | 0.577 | Best time-domain response for a speaker; tight, accurate bass. |
| Butterworth Alignment | Max flat amplitude response | 0.707 | The "ideal" compromise — flat response down to the cutoff point, standard for most hi-fi systems. |
| Chebyshev Alignment | Equal ripple response | > 0.707 (WinISD offers 0.800, 0.900, 1.000, 1.100, 1.200, 1.500) | Produces a volume "bump" or boominess in the bass before dropping off. |

### Vented Alignment and Port Solver

**Input:** driver parameters, selected vented alignment, `Vb`, `Fb`, vent area/diameter, and end
correction.

**Output:** `VentSolveResult` (**Public Contracts**, below) — alignment `Vb/Fb`, physical vent
length, achieved tuning, and `VentIssue[]`.

The vent solver owns the inverse pair:

```text
Fb + Vb + vent geometry -> vent length
vent length + Vb + vent geometry -> Fb
```

An unreachable tuning reports a negative/unbuildable length as a box/vent issue. It does not become
a generic chart error.

### Passive-Radiator Solver

**Input:** PR parameters, `Vb`, target tuning, and added mass.

**Output:** `PrSolveResult` (**Public Contracts**, below) — target tuning, required added mass,
system tuning, and `PrIssue[]`.

Negative required added mass means the target is above the bare-radiator ceiling. That is a PR
issue attached to the target/mass relation, not a sweep issue.

### Box-Parameter Solver

**Input:** active topology and its required chamber/port/PR fields.

**Output:** `BoxParamsSolveResult` (**Public Contracts**, below) — topology-specific box parameters
and `BoxParamsIssue[]`.

It owns checks such as missing `Vb`, missing `Vf`, missing vent area, and missing PR compliance.
The sweep consumes the validated result; it does not repeat these checks.

### Signal Resolver

**Input:** project power, voltage, driver resistance, driver count, wiring, and series resistance.

**Output:** `SignalSolveResult` (**Public Contracts**, below) — the drive value used by the circuit
and `SignalIssue[]`.

The established 1 W project reference is a valid project input. Missing `Re` or an inconsistent
power/voltage pair is a signal issue. The circuit never guesses a signal value.

## Data Flow

Environment is **not** a fourth input arriving only at the circuit. It is a shared input the
driver solver, the box/vent/PR solvers, and the circuit/sweep all read the same resolved
`{ rho, c }` from — the project's environment, exclusively, per **Driver Air Constants** below.
Only the Signal Resolver has no acoustic term and so takes no air input:

```text
                          ┌─────────────────────────────┐
environment ─> air.ts ─> │ resolved rho/c (one value)   │
                          └───────────┬─────────────────┘
                     ┌────────────────┼────────────────┐
                     ▼                ▼                ▼
        driver record + rho/c   box record + rho/c      │
                     │                │                 │
                     ▼                ▼                 │
             driver solver       box solver              │
                     │                │                  │
        driver values/issues   box values/issues          │
                     │                │                    ├─> circuit at f
                     └────────────────┴────────────────────┤
signal record ──> signal resolver ─> signal values/issues ─┤       │
                                                            │       ▼
environment issues ─────────────────────────────────────────┘   sweep curves/issues
```

Air is resolved once, by `air.ts`, and every other node reads that one resolved value — never a
second `airFor()`/reference-condition call of its own. `driver record`/`box record` do **not**
carry their own air fields into this graph any more (see **Driver Air Constants**, below, for the
driver half; the box/vent/PR half — `boxDesign.ts`'s `ventLength`/`tuningFromLength`/`prTuning`/
`prMassForFp` — **implemented 2026-09-15**: all four now take the project's resolved `{ rho, c }`
as a parameter instead of the module-scoped `refRho()`/`refC()` reference-only constants, which
are deleted. `OpenISDBox` reads that air from its own embedded driver
(`this.#driver.solveConsistencyGroup()`, already resolved to the project's live environment —
Driver Air Constants, below) rather than needing a second air-provider callback; every `VentWindow`
instantiation and PR-related `Field` getter passes it through. `boxDesign-air.test.ts` proves the
four functions give a different, correct answer at a non-reference air pair and are unchanged at
the reference one.

The sweep may say which upstream fields block a curve. It does not copy those upstream DQ
messages into the sweep issue list.

## Public Contracts

Every domain follows **one shape**, applied consistently — no domain gets a richer or a looser
contract than another:

```text
X Solve Result   = { values: X quantities,           issues: readonly XIssue[] }
XIssue           = missing-dependencies | inconsistent-inputs, over X's own quantity names
SolveRoute<Q>    = { formula, required: readonly Q[], missing: readonly Q[] }
XPrerequisite    = { output: SweepOutputName,         missing: readonly XQuantityName[] }
```

`DriverIssue`/`SolveRoute` already existed for the driver channel. This section gives Box, Signal,
and Environment the identical shape, and defines the `Prerequisite` types `SweepCalculationResult`
already names below but never defined — the gap that prompted this update (see
`docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.txt` for the full discussion this section
restores; the agent writing that discussion ran out of session budget immediately after the driver
channel was typed, before doing the same for box/signal/environment).

### Quantity-name vocabulary

Every quantity-name type is derived from an existing, already-declared quantities interface —
never a second hand-maintained name list (`packages/design/AGENTS.md`, "Concrete types over
flexi-shit"):

```ts
type DriverQuantityName         = keyof DriverSolverQuantities;         // engine/solverQuantities.ts, existing
type EnvironmentQuantityName     = keyof AirEnvironment;                // engine/air.ts, existing
type SignalQuantityName          = keyof SignalSolverQuantities;        // NEW — see Signal Resolver below
type VentQuantityName            = keyof VentSolverQuantities;          // engine/solverQuantities.ts, existing
type PrQuantityName              = keyof PrSolverQuantities;            // engine/solverQuantities.ts, existing
type BoxParamsQuantityName       = keyof EnclosureParams;               // engine/types.ts, existing
type SealedAlignmentQuantityName = keyof SealedAlignmentSolverQuantities; // NEW — see below
```

`SealedAlignmentSolverQuantities` is new, for the same reason `SignalSolverQuantities` is new: the
Sealed Alignment Solver (**Solver Nodes**, above) has no quantities interface today, only loose
function parameters (`sealedFromQtc(Qts, Vas_m3, Qtc)`, `sealedQtcFromVolume(Qts, Vas_m3, Vb_m3)` —
`engine/boxDesign.ts`). Named long-form, per `packages/design/AGENTS.md`:

```ts
interface SealedAlignmentSolverQuantities {
  Qts?: number;
  Vas_m3?: number;
  Qtc?: number;
  Vb_m3?: number;
}
```

There is no single `BoxQuantityName`. An earlier draft of this section tried to force one union
across `EnclosureParams`/`VentSolverQuantities`/`PrSolverQuantities`, and ran into the three
interfaces naming the same physical quantities differently (`Vb` vs. `Vb_m3`, `prCms` vs.
`prCms_m_per_N`). That was the wrong move, not an unresolved naming question: **there is no single
"Box" solver to begin with** — Vented Alignment/Port, Passive-Radiator, and Box-Parameter are three
distinct solver nodes (**Solver Nodes**, above), each over its own already-declared quantities
interface, exactly as Driver is one node over its own. Three node-scoped quantity-name types, not
one forced union, is the consistent shape — matching Driver's pattern rather than treating Box as
a special case that needs unifying first.

### Generic route and issue shape

```ts
interface SolveRoute<Q extends string> {
  readonly formula: string;
  readonly required: readonly Q[];
  readonly missing: readonly Q[];
}

type CalculationIssue<Q extends string> =
  | {
      readonly kind: 'missing-dependencies';
      readonly target: Q;
      readonly routes: readonly SolveRoute<Q>[];
    }
  | {
      readonly kind: 'inconsistent-inputs';
      readonly target: Q;
      readonly fields: readonly Q[];
      readonly formula: string;
      readonly expected: number;
      readonly actual: number;
      readonly relative: number;
    };
```

This is the same discriminated union the restored discussion specified for the driver channel,
generalised over the target's own quantity-name type — the existing `Result<T>`/`SolverField<T>`
generics in `engine/types.ts`/`engine/solverTypes.ts` are the precedent for this pattern in this
codebase. The alternative — one independent, hand-copied union per domain — was rejected because
it lets the domains drift out of shape from each other one edit at a time. **Decided (2026-09-15):
adopt this generic shape** (Implementation Order item 1).

Worked example (the driver instantiation — `CalculationIssue<DriverQuantityName>` — since `Cms` has
two routes):

```text
Cms <- Vas + Sd + air
Cms <- Fs + Mms
```

If neither route is complete, the issue lists both routes and their missing fields. If both are
complete and disagree, the issue reports the contradiction and the declared route precedence. If
one route is complete, the target is solved with no issue. Every solver node applies this same
algorithm over its own quantities — a vent's `Fb` has the same two-routes-or-one shape (**Vented
Alignment and Port Solver**, above: length-from-tuning vs. tuning-from-length).

### Per-domain instantiation

```ts
type DriverIssue = CalculationIssue<DriverQuantityName>;
type SealedAlignmentIssue = CalculationIssue<SealedAlignmentQuantityName>;
type VentIssue = CalculationIssue<VentQuantityName>;
type PrIssue = CalculationIssue<PrQuantityName>;
type BoxParamsIssue = CalculationIssue<BoxParamsQuantityName>;
type SignalIssue = CalculationIssue<SignalQuantityName>;
type EnvironmentIssue = CalculationIssue<EnvironmentQuantityName>;
```

There is no `ConfigurationIssue`. Configuration (box topology support, circuit model, required
simulation option) is not a field-level DQ — an unsupported topology is a whole-design refusal, not
a value contradicting another value on one field. It already has a home:
`engine/params.ts#validateParams` returns exactly this today (`{ level, field, message }` naming
the box type itself), and stays that shape. Configuration only ever appears below as a
`ConfigurationPrerequisite` — a reference to that refusal — never as its own Issue type. This is a
deliberate asymmetry, not an oversight: every other domain differs by its quantity vocabulary only,
Configuration differs by kind.

### Solve results per node

Same shape everywhere: `{ values, issues }`, nothing added, nothing renamed per node.

```ts
interface DriverSolveResult {
  readonly values: DriverSolverQuantities;
  readonly issues: readonly DriverIssue[];
}

interface SealedAlignmentSolveResult {
  readonly values: SealedAlignmentSolverQuantities;
  readonly issues: readonly SealedAlignmentIssue[];
}

interface VentSolveResult {
  readonly values: VentSolverQuantities;
  readonly issues: readonly VentIssue[];
}

interface PrSolveResult {
  readonly values: PrSolverQuantities;
  readonly issues: readonly PrIssue[];
}

interface BoxParamsSolveResult {
  readonly values: EnclosureParams;
  readonly issues: readonly BoxParamsIssue[];
}

interface SignalSolveResult {
  readonly values: SignalSolverQuantities;
  readonly issues: readonly SignalIssue[];
}
```

Four box-tab nodes now (`SealedAlignmentSolveResult`, `VentSolveResult`, `PrSolveResult`,
`BoxParamsSolveResult`), four issue types (`SealedAlignmentIssue`, `VentIssue`, `PrIssue`,
`BoxParamsIssue`) — this mirrors Driver exactly (one node, one issue type, repeated per node)
rather than inventing a single cross-node `BoxIssue`. All four still project to the same UI
location (Diagnostic Channels table, below: "Box/Vent/PR cells") — that is a statement about where
the domain displays them, not a reason to merge their types.

`air.ts` does not get an `EnvironmentSolveResult` of this shape: `airFor()` always returns a usable
`Air` (every `AirEnvironment` field defaults when absent — Engine.ts's own doc comment on
`airFor`), so there is never a missing-dependencies case, only an out-of-range entered value.
Environment issues are reported separately, not bundled with `Air`, so a caller that only wants
`{ rho, c }` is not forced to also destructure an issues array that is empty in the overwhelming
common case:

```ts
function environmentIssues(env: AirEnvironment): readonly EnvironmentIssue[];
```

### Signal Resolver — new concrete interface

Named long-form, per `packages/design/AGENTS.md` ("Concrete types over flexi-shit"), not built from
a field-name list:

```ts
interface SignalSolverQuantities {
  power_W?: number;
  voltage_V?: number;
  Re_ohm?: number;
  driverCount?: number;
  wiring?: Wiring;
  seriesResistance_ohm?: number;
  drive_V?: number;
}
```

The established 1 W project reference is a valid, complete `SignalSolverQuantities` input — not a
missing value — so it produces `drive_V` with no issue.

### Sweep output vocabulary and prerequisites

```ts
type SweepOutputName = keyof Pick<SweepResult, 'spl' | 'phase' | 'gd' | 'exc' | 'excPR' | 'pv' | 'zmag' | 'zph'>
  | keyof Pick<MaxCurvesResult, 'maxspl' | 'maxpwr'>;
```

Reusing `SweepResult`/`MaxCurvesResult`'s own field names (rather than inventing a parallel prose
vocabulary such as `'maximum SPL'`) keeps one name per output; a human-facing label such as
"Maximum SPL" is a presentation concern and belongs in the UI hook that formats the prerequisite,
not in the engine's type. Flagged as a recommendation, not settled by the restored discussion,
which used prose labels (`'maximum SPL'`) directly in its own examples.

```ts
interface CalculationPrerequisite<Q extends string> {
  readonly output: SweepOutputName;
  readonly missing: readonly Q[];
}

type DriverPrerequisite = CalculationPrerequisite<DriverQuantityName>;
type SealedAlignmentPrerequisite = CalculationPrerequisite<SealedAlignmentQuantityName>;
type VentPrerequisite = CalculationPrerequisite<VentQuantityName>;
type PrPrerequisite = CalculationPrerequisite<PrQuantityName>;
type BoxParamsPrerequisite = CalculationPrerequisite<BoxParamsQuantityName>;
type SignalPrerequisite = CalculationPrerequisite<SignalQuantityName>;
type EnvironmentPrerequisite = CalculationPrerequisite<EnvironmentQuantityName>;
type ConfigurationPrerequisite = CalculationPrerequisite<'boxType' | 'circuitModel' | 'simulationOption'>;
```

Same correction as `BoxIssue` above: no single `BoxPrerequisite` — four box-tab nodes, four
prerequisite types.

`ConfigurationPrerequisite`'s quantity type is a closed string-literal union rather than `keyof`
of a quantities interface, consistent with Configuration having no Issue type or values bag of its
own (above) — there is nothing to derive `keyof` from.

## Convergence — Existing Methods That Must Adopt This Shape

The origin observation, restated concretely: `OpenISDDriver.checkConsistency()`
(`packages/design/domain/openisdDomain.ts:1479`) reads

```ts
checkConsistency(): ConsistencyIssue[] {
    return [];
}
```

and `packages/design/engine/consistency.ts` today holds only the `ConsistencyIssue` interface and
the `Q_GROUP_FIELDS`/`isQGroupField`/`qGroupIsIncomplete` helpers — the relation table and the real
detector that used to compute this (visible in git history, `packages/engine/src/consistency.ts`
pre-deletion) are gone. Nothing currently calls anything that could make this method return
non-empty. This section is not a new idea on top of **Public Contracts** — it is the same
unification applied to every calculation method that predates this document, not only the six new
solver nodes.

This codebase currently has **three overlapping diagnostic vocabularies**, not one:

| Type | Shape | Where used today |
|---|---|---|
| `DriverError` | `{ level, field, message }` — a string message | `params.ts#validateParams`, `sweep.ts#classifyFinite/classifyMaxFinite/classifyFlatClamp`, `circuitQuantities` |
| `ConsistencyIssue` | `{ formula, fields, target, expected, actual, relative }` | `consistency.ts` (type only, detector removed), `solver.ts`, `openisdDomain.ts`'s dead stub, **`winisd/dqCalculated.ts#calcMark`** (a real, working consumer) |
| `CalculationIssue<Q>` | `{ kind: 'missing-dependencies' \| 'inconsistent-inputs', ... }` | this document's new design, not yet implemented |

`CalculationIssue<Q>`'s `inconsistent-inputs` variant is `ConsistencyIssue` with a `kind` tag added
— structurally identical otherwise (`formula`/`fields`/`target`/`expected`/`actual`/`relative`
all present, same names). So `ConsistencyIssue` is not a third thing to keep around; it is replaced
by instantiating `CalculationIssue<Q>` per domain, everywhere it appears above — **except** that
`dqCalculated.ts#calcMark(issue: ConsistencyIssue)` (`packages/design/winisd/dqCalculated.ts:273`)
is a real, already-shipped consumer of exactly that shape (it turns a consistency contradiction
into a `.wdr`-export DQ mark). Converting it means filtering the new union to its
`inconsistent-inputs` variant before calling `calcMark`.

**Reversed (2026-09-15): no new `missing-dependencies` mark.** The earlier "add a `'missing'`
`DqMarkJson.kind`" decision here did not account for a real constraint:
`dqCalculated.test.ts`'s own docstring states every `detail` string is validated against a Python
registry (`scrapers/lib/record_registries.py`'s `mark()`) that re-renders the registered template
on load and **refuses any mark whose `detail` differs by a single character**
(`DqMark._guard_against_invention`). That registry is not present in this checkout (searched, not
found) — inventing a new mark kind/template here with no matching Python-side registration would
produce records the scraper-side tooling rejects on load. `calcMark`/`dqCalculated` are converted
to the new `CalculationIssue<Q>` parameter type (below), but only ever process the
`inconsistent-inputs` variant, byte-for-byte unchanged from today; a `missing-dependencies` issue
produces no `.wdr`/`dq_calculated` mark and stays Cell-state-only, pending a matching Python-side
template change that is outside this session's scope.

`DriverError` does **not** collapse into `CalculationIssue<Q>` wholesale. Two different cases hide
under one type name today:

- `validateParams`'s box-parameter checks (`Vb`/`Vf`/`Sp`/`prSd`/`prCms`/`prMmd` each "must be
  greater than zero") are genuinely quantity-targeted — each error already names one `field` from
  a closed, known set, and became `BoxParamsIssue` (`missing-dependencies`, one route, no
  alternative) — **Implemented 2026-09-15, additively**, not as the "convert now" replacement this
  section originally called for: `validateParams()`'s existing `DriverError[]` return feeds
  directly into `OpenISDProject.sweep()`'s `Result<SweepResult>.errors` (`domain/openisdDomain.ts`
  `sweep()`), which is `DriverError[]` for every OTHER sweep precondition too (`circuitQuantities`,
  the postconditions below). Changing that shared shape is a materially larger change than this
  one enclosure check and was not made without confirming it — instead, `engine/params.ts` now
  exports BOTH: `validateParams()` unchanged, and a new `checkBoxParams(box, P): BoxParamsIssue[]`
  sharing the same `requiredParamsFor()` table (so the two can never name a different required set
  for one topology), reachable via `Engine.checkBoxParams()`. `VentSolveResult`/`PrSolveResult`/
  `BoxParamsSolveResult` (below) read `checkBoxParams`, not `validateParams`. Whether
  `validateParams()`/`Result<T>.errors` are later retired in favour of the unified shape stays
  open — John's call, not decided here.
- `classifyFinite`/`classifyMaxFinite`/`classifyFlatClamp` (`sweep.ts`) diagnose a **curve gone
  non-finite at some frequency**, not a named driver/box/signal/environment quantity contradicting
  another. There is no `target: Q` to put here — the same singularity can stem from any number of
  upstream quantities at once, and the diagnosis is about the OUTPUT array, not one input field.
  These stay `SweepIssue` (or `DriverError`, unchanged), explicitly outside `CalculationIssue<Q>` —
  not an oversight, the same asymmetry already noted for Configuration above.

### What actually changes, method by method

| Existing method | Today returns | Becomes |
|---|---|---|
| `solveConsistencyGroup()` + `OpenISDDriver.checkConsistency()` (dead stub) | values only + `[]` always | One `Engine` method returning `DriverSolveResult` |
| `checkVentConsistency()` | `ConsistencyIssue[]`, contradictions only, no missing-dependency case | `VentSolveResult` (`values` + `VentIssue[]`, both variants) |
| `checkPrConsistency()` | `ConsistencyIssue[]`, contradictions only | `PrSolveResult` (`values` + `PrIssue[]`, both variants) |
| `sealedFromQtc`/`sealedQtcFromVolume`/`closestSealedAlignment` (three separate calls, no issues at all) | bare numbers, `null` on failure | `SealedAlignmentSolveResult` |
| `validateParams()` | `DriverError[]` | `BoxParamsIssue[]` (decided above, 2026-09-15) |
| `dqCalculated.ts#calcMark` | takes `ConsistencyIssue` | takes the `inconsistent-inputs` variant of any `CalculationIssue<Q>` |
| `singleFieldUnblockers()`/`circuitQuantities()`'s missing-field logic (`sweep.ts`) | sweep's own private re-derivation of what the driver solver already knows | deleted; `sweep.ts` reads `DriverSolveResult.issues` instead (already Implementation Order item 9) |

### Ripple into the UI/domain layer — simplifications this unblocks

Several hand-rolled pieces exist **only because** no calculation used to hand back a structured
issues array. Once every channel does, these collapse into one generic projection instead of one
bespoke implementation per field:

- `consistencyNote()` (`packages/ui/src/logic/useDriverCells.ts:68`) formats `ConsistencyIssue[]`
  for one field today. Once every channel speaks `CalculationIssue<Q>`, this becomes one function
  usable for Driver, Vent, PR, Box-Params, Signal, and Environment alike — the driver-only version
  is a special case of the general one, not a separate implementation.
- `fieldIsMandatoryAndUnsatisfied()` (`useDriverCells.ts:88`) hand-checks Q-group membership
  (`new Engine().isQGroupField(field)`) because a missing-dependency result didn't exist to just
  read. Once `DriverSolveResult.issues` names `Qts` as `missing-dependencies` with
  `routes: [{ required: ['Qes','Qms'], missing: [...] }]` directly, this becomes "is `field` named
  in any `missing-dependencies` issue's `target` or `routes[].missing`" — one generic check, not a
  Q-group special case hand-maintained here and in `consistency.ts`'s `Q_GROUP_FIELDS` separately.
- `chartBlockingReasons` (`DriverEditorModal.vue`) manually lists mandatory fields
  (`['Fs','Vas','Re','Sd']`) and separately appends a Qts-group message, then separately re-derives
  `.checkConsistency()`'s (currently empty) issues. Once `DriverSolveResult.issues` is the single
  source for "why can't this drive a chart," this whole block becomes "format
  `DriverSolveResult.issues`" — no separately-maintained mandatory-field list to drift from what
  the solver actually requires.
- The general shape: any place that currently asks "is this field required, and is it satisfied"
  by re-deriving the answer locally (`isQGroupField`, mandatory-field lists, dead
  `checkConsistency()` calls) is a candidate to be replaced by reading the relevant `*SolveResult`
  once the engine actually returns one. This document's Implementation Order below adds a step to
  audit for these once the six solve results exist, rather than listing every call site now against
  a shape that does not exist yet.

## Diagnostic Channels

| Channel | Owns | Projected to |
|---|---|---|
| Driver | missing/inconsistent `Fs`, `Vas`, `Qts`, `Re`, `Pe`, `Xmax`, etc. | Driver cells / Driver-tab DQ |
| Box | missing/inconsistent `Vb`, `Vf`, `Fb`, sealed-alignment `Qtc`, vent geometry, PR mass/tuning, topology | Box/Vent/PR cells |
| Signal | missing/inconsistent power, voltage, `Re`, series resistance | Signal fields |
| Environment | invalid temperature, humidity, pressure, or air-model input | Advanced fields |
| Sweep | circuit singularity, non-finite sample, empty curve, unsupported simulation output | chart/simulation diagnostics |

Environment is normally **empty**: every `AirEnvironment` field has a valid default, so using the
default is not a missing value — the channel exists only for an explicitly entered value outside
the supported range (`MIN_SUPPORTED_TEMP_K`/`MAX_SUPPORTED_TEMP_K`), never for an absent field.

A sweep may return prerequisite references without owning those DQ messages:

```ts
interface SweepCalculationResult {
  readonly curves: SweepResult | null;
  readonly issues: readonly SweepIssue[];
  readonly driverPrerequisites: readonly DriverPrerequisite[];
  readonly sealedAlignmentPrerequisites: readonly SealedAlignmentPrerequisite[];
  readonly ventPrerequisites: readonly VentPrerequisite[];
  readonly prPrerequisites: readonly PrPrerequisite[];
  readonly boxParamsPrerequisites: readonly BoxParamsPrerequisite[];
  readonly signalPrerequisites: readonly SignalPrerequisite[];
  readonly environmentPrerequisites: readonly EnvironmentPrerequisite[];
  readonly configurationPrerequisites: readonly ConfigurationPrerequisite[];
}
```

Example:

```ts
driverPrerequisites: [
  { output: 'maxspl', missing: ['Pe_W', 'Xmax_m'] },
]
```

The chart can say “Maximum SPL cannot be calculated — see Driver inputs: Pe or Xmax” by formatting
`output`/`missing` through its own presentation label map. The Driver tab owns the actual DQ.

## Domain Boundary

`OpenISDDriver` passes entered values to the engine and projects returned `DriverIssue`s onto
driver cells. Its current empty `checkConsistency()` method is not a second implementation; it
must become this adapter or disappear.

`OpenISDBox` performs the same adapter role for vent and passive-radiator solver results. A box
issue belongs beside the box field that caused or participates in it, not in the chart error list.

The signal and environment channels get the identical adapter treatment, not a lesser one:
whichever domain object resolves drive voltage passes entered signal values to the Signal Resolver
and projects `SignalIssue`s onto the signal fields; whichever resolves air passes the project's
environment values to `air.ts` and projects `EnvironmentIssue`s onto the Advanced fields. Neither
recomputes a dependency or a formula the engine already owns.

`OpenISDProject` composes the solver nodes in this order:

```text
1. Resolve entered driver values and driver issues.
2. Resolve the active box topology and box issues.
3. Resolve signal drive and signal issues.
4. Resolve air/environment and environment issues.
5. If all circuit prerequisites are available, run the circuit/sweep.
6. Return curves plus sweep issues and prerequisite references.
```

The project does not merge the issue arrays into one untyped string list. Each issue remains owned
by its source domain until the UI chooses where to display it.

## Driver Air Constants — Embedded vs Standalone

Status: **IMPLEMENTED 2026-09-15** (`packages/design/domain/openisdDomain.ts`,
`packages/design/domain/driverYmlToOpenisdAndWdr.ts`,
`packages/ui/src/ui/components/DriverEditorModal.vue`) — unlike the rest of this document, this
section is not a plan; it records a decision already made and built, so a later reader does not
mistake it for open work.

### Context

WinISD carries a driver's `c`/`roo` (speed of sound / air density) and a project's own
`[Box]`/`Environment` T/RH/pressure as two separate stores. Research into real WinISD behaviour
(`docs/design/WINISD_SCHEMA.md` §12, `docs/research/WINISD_PARITY.md` §20) established:

- A driver's own `c`/`roo`, when blank, falls back to a global/app-level environment — never to
  the project's own T/RH/pressure, which WinISD leaves **confirmed inert** for this purpose in
  every tested build, including the original "WinISD Pro ALPHA ©1996-2004" (§20's Plot-tab
  finding) and the later 0.7.0.950 Linearteam build (§12).
- Grepping this repo's own driver corpus (1,628 real `.wdr` files) found 1,621 of the 1,625 that
  carry a stated `c`/`roo` all share the SAME value (the reference default, at three
  floating-point precisions) — including files from drivers genuinely hand-measured on real test
  equipment (`drivers/matt/`'s `WT3`-prefixed files), where real measurement-condition data would
  be expected to vary and does not. A driver's own `c`/`roo` is therefore not meaningful
  per-driver measurement data in practice; it is close to always just an inherited default,
  frozen in at whatever moment the file was saved.

### Decision

For an **embedded** driver (one living inside an `OpenISDProject`, as opposed to a standalone
library/My-Drivers entry), the project's own environment is the **sole** source of `c`/`roo` for
calculation — unconditionally, not as a first-preference-else-fallback chain. This is a
deliberate OpenISD design choice, not a WinISD-fidelity replication: real WinISD leaves this gap
(a live-computing environment control whose result never reaches the simulation) unfixed in every
generation tested; OpenISD closes it instead of reproducing it.

Three rules, matching the record's own Entered/Calculated/Not-available provenance vocabulary
used throughout this document's Diagnostic Channels:

1. **On embed** (a project adopting a driver — picking one from the library, loading a
   `.wdr`/`.owdr`): the incoming driver's `c`/`roo` are stripped to not-available. An embedded
   driver never carries a stored value of its own, regardless of what it arrived with.
2. **While embedded**: the driver's solved figures use the project's live environment
   unconditionally — the driver's own (always-blank) `c`/`roo` fields are not consulted, not even
   as a first preference. There is nothing to check, by construction.
3. **On detach** (Save to My Drivers, fork, disk export, or the generic editor's temporary
   edit-session copy): the currently-resolved `c`/`roo` is frozen into the departing standalone
   copy as an entered value, so the driver's behaviour does not jump the instant it is no longer
   bound to a project.

A standalone driver's own blank `c`/`roo` is unaffected by any of this — it continues to read
back as `calculated` from the bare reference-air default, exactly as before.

### Implementation

- `OpenISDDriverEmbedded.update()` (`openisdDomain.ts`) — after adopting the source record, calls
  `.clear()` on `c_m_per_s`/`roo_kg_per_m3`. This single method covers `OpenISDProject.setDriver`,
  `.loadDriver`, and the generic driver editor's commit path alike, since all three write an
  embedded driver only through `update()`.
- `OpenISDDriverEmbedded.solveConsistencyGroup()` (override) — calls `super.solveConsistencyGroup()`
  then unconditionally overwrites `c_m_per_s`/`roo_kg_per_m3` with `engine.airFor()` of the
  project's own live environment callback (the same callback `OpenISDDriverEmbedded.wrap()` was
  already given for exactly this purpose). This makes rule 2 explicit in code rather than an
  emergent property of the field's own fallback chain plus `update()`'s strip.
- `OpenISDDriverEmbedded.detach()` (override) — reads `this.solveConsistencyGroup()`'s resolved
  pair and `.set()`s it onto the detached standalone copy before returning it.
- The driver's own `c_m_per_s`/`roo_kg_per_m3` fields (`OpenIsdDriverSpec`) are otherwise
  unchanged: still entered-when-stated, calculated-from-the-driver's-own-`airProvider`-when-blank
  — the mechanism rules 1–3 rely on, not something they replace.
- `openIsdDriverToWinIsdDriver` (`.wdr`/`.wpr` export, `driverYmlToOpenisdAndWdr.ts`) DID need a
  change, corrected after first assuming otherwise: the raw field getter is not enough, because it
  cannot see a stale value already sitting in an already-embedded driver's record (below). The
  cell for `c`/`roo` is now built from `driver.solveConsistencyGroup()`'s resolved value (which
  goes through the embedded override, rule 2), with the entered/calculated MARK still taken from
  the plain field's own state. A second, subtler bug surfaced fixing this: a later, unconditional
  loop over `wdrFields()` (which still lists `c_m_per_s`/`roo_kg_per_m3` — shared with a second
  caller that has its own reason to enumerate every numeric field) re-read the raw field and
  silently clobbered the resolved value a few lines after it was set correctly. Harmless for every
  other pre-set key (`numVC` computes the identical value both ways, so double-setting it was
  never observable), but not for `c`/`roo` once the two sources could legitimately disagree. Fixed
  by skipping any key already present in the `cells` map, the same guard the next loop down
  already used for a different reason.
- **Existing data is not retroactively cleared.** `OpenISDProject.fromOwprText` (loading a saved
  `.owpr`/browser-stored project) deserialises the record directly and never calls `update()`, so
  a driver embedded before this rule existed — which, since the strip did not exist yet, is most
  real projects with a driver imported from a `.wdr` — still carries its old `entered` `c`/`roo`
  inside the raw record indefinitely. This is by design rather than a residual bug: rule 2
  (`solveConsistencyGroup()`) and `detach()` both resolve through the override regardless of what
  the raw record holds, and the export fix above means the written file no longer leaks the stale
  number either — the stale stored value becomes permanently inert everywhere it could surface,
  without needing a migration pass. The one cosmetic residue: `.wdr` export still marks a legacy
  driver's `c`/`roo` row `E` (entered) rather than `C` (calculated), since the entered/calculated
  MARK is deliberately left to the raw field's own state (above) — the printed NUMBER is correct,
  the ParState letter on a legacy file is not, until that driver is next embedded or edited
  through `update()`.
- `DriverEditorModal.vue`'s Environment-parameters readout was found hardcoded to the bare
  reference default (`referenceC()`/`referenceRho()`) regardless of context — not actually wired
  to the driver record at all. Fixed to read the resolved field value, so it now correctly shows
  the project's air for an embedded driver and the driver's own/reference value for a standalone
  one.
- Regression tests added in `test/domain.test.ts` ("editing a driver — copy, then update or drop"):
  one confirms embedding strips a driver's own stated `c`/`roo`; the other simulates the legacy-data
  case directly (writing `c`/`roo` straight onto an already-embedded driver's field, bypassing
  `setDriver`/`loadDriver` entirely, the same shape stale saved data takes) and asserts both
  `solveConsistencyGroup()` and `.wdr` export still resolve to the project's current air rather
  than the stale stored value.

### Why not other shapes

- **Driver's `c`/`roo` driving the project's T/RH/pressure** (the reverse direction): not
  possible in general — the project's environment has 3 degrees of freedom (temperature,
  humidity, pressure) and `c`/`roo` are only 2 values, so recovering "the" environment from a
  driver's pair is underdetermined.
- **Writing the project's resolved value into the driver's own stored field** (a synced copy
  rather than an always-blank one): rejected — it would mark a project-derived number as
  `entered` on the driver record, corrupting the same provenance distinction this document's
  Diagnostic Channels rely on elsewhere, and reopens exactly the drift risk (two independently
  writable copies of one fact) the embed/detach rules exist to close.

### Inbox — a further simplification to consider

Not implemented; raised for John to weigh, not decided here. The shape above still keeps
`c_m_per_s`/`roo_kg_per_m3` as a real per-driver concept — entered-or-calculated fields on
`OpenIsdDriverSpec`, with `OpenISDDriverEmbedded` overriding three methods to keep an embedded
one pinned to the project. A more radical option: strip `c`/`roo` out of the driver entirely, in
both the embedded situation AND the editor situation — i.e. stop treating a driver's own air as a
thing a driver can state at all, standalone or embedded, rather than special-casing only the
embedded half.

Concretely, this would mean:
- Deleting the `air()` field builder, `c_m_per_s`/`roo_kg_per_m3` off `OpenIsdDriverSpec`, and the
  three `OpenISDDriverEmbedded` overrides just added for them — no strip/freeze/override
  machinery needed if the driver record never carries the concept in the first place.
- The driver editor's Environment-parameters readout (`DriverEditorModal.vue`, just fixed to show
  the resolved value) becomes purely informational everywhere — always "here is the air this
  design is using," sourced from context (project env if embedded, reference default if
  standalone), never a field the driver record itself can hold an opinion on.
- `.wdr`/`.wpr` export still needs to WRITE a concrete `c`/`roo` pair (WinISD compatibility,
  unchanged) — it would just always be the contextual resolved value, with no entered-vs-
  calculated distinction to preserve on that specific pair.

Why this might be worth it: the corpus evidence above shows a driver-stated `c`/`roo` is already
essentially never real per-driver data in practice (1,621 of 1,625 populated real files share the
identical reference-default value, at three floating-point precisions, including hand-measured
`WT3` files where genuine variation would be expected) — the concept this section builds
machinery to protect the integrity of may not be carrying real information anywhere the corpus
has been checked.

Why it might not be: a `.wdr` a human or scraper genuinely wants to state a non-default `c`/`roo`
on — for instance, to pin the exact air assumption a datasheet's `Vas` was converted from — is
rare but not physically meaningless (`Vas = ρ·c²·Sd²·Cms`, so this pair genuinely does parametrize
how `Vas`/`Cms` relate to each other for a specific record). Removing the field removes that
capability outright rather than just making it inert while embedded, which is a bigger, less
reversible bet than the strip/freeze rules above. Worth a decision, not a default.

## Implementation Order

1. ~~Confirm or reject the generic~~ **Decided (2026-09-15): adopt the generic**
   `SolveRoute<Q>`/`CalculationIssue<Q>`/`CalculationPrerequisite<Q>` shape (**Public Contracts**,
   above) over four independent hand-copied unions.
2. **Completed 2026-09-15.** Extended the **Driver Air Constants** rule (project air,
   exclusively) to `boxDesign.ts`: `ventLength`/`tuningFromLength`/`prTuning`/`prMassForFp` now take
   the project's resolved `{ rho, c }` as a parameter; the module-scoped `refRho()`/`refC()`
   reference-only fallbacks are deleted. No new air-provider plumbing was needed — `OpenISDBox`
   already holds `#driver: OpenISDDriverEmbedded`, whose `solveConsistencyGroup()` already resolves
   `c_m_per_s`/`roo_kg_per_m3` to the project's live environment unconditionally (Driver Air
   Constants, above), so a local `air = () => ({ rho: this.#driver.solveConsistencyGroup().roo_kg_per_m3!,
   c: this.#driver.solveConsistencyGroup().c_m_per_s! })` closure in `OpenISDBox`'s own constructor
   is all that was needed. Threaded through `solver.ts`'s `solveVentConsistencyGroup`/
   `solvePrConsistencyGroup`, `Engine.ts`'s matching wrappers, all 7 `VentWindow` instantiation
   sites plus its own `tuningIn_hz`/`lengthForTuning_m`, the passive-radiator `Field` getters, and
   the one remaining direct `tuningFromLength` call in `OpenISDProject`. `boxDesign-air.test.ts`
   proves `ventLength`/`tuningFromLength`/`prTuning`/`prMassForFp` now give a different, correct
   answer at a non-reference air pair, and are byte-for-byte unchanged at the reference one
   (regression safety) — full design+ui typecheck and unit suite green throughout, with the
   pre-existing 11-failure baseline (unrelated missing `.wdr` fixtures) unchanged.
3. Add the driver issue and route types; restore the engine relation table and return solved
   values plus driver issues.
4. Add the `Engine` façade method for the unified driver solve result.
5. Replace the domain `checkConsistency()` stub with an entered-only adapter.
6. Add `SignalSolverQuantities` and the Signal Resolver, returning `SignalSolveResult`.
7. Add `environmentIssues()` for out-of-range entered air inputs.
8. Add missing-dependency reporting to the sealed-alignment, vent, and passive-radiator solvers,
   returning `SealedAlignmentSolveResult`/`VentSolveResult`/`PrSolveResult`/`BoxParamsSolveResult`,
   each over its own already-declared quantities interface (`SealedAlignmentQuantityName`/
   `VentQuantityName`/`PrQuantityName`/`BoxParamsQuantityName` — no shared `BoxQuantityName`).
9. Remove duplicate dependency discovery from `sweep.ts` (`singleFieldUnblockers`,
   `circuitQuantities`'s own missing-field logic) once the solver result supplies the same answer.
10. Add the eight prerequisite channels to `SweepCalculationResult` and preserve sweep-only failures
    as `SweepIssue`s. Type-only slice **done 2026-09-15** — `CalculationPrerequisite<Q>` generic,
    `SweepOutputName`, and all 8 named instantiations exist (`consistency.ts`). The REAL wiring
    (sweep() actually returning `SweepCalculationResult`, populated) needs two separate open
    decisions, not one:
    (a) `sweep()` (`sweep.ts:263`) returns `Result<SweepResult>`, the same shared shape flagged
    under `validateParams` (item 13, Convergence) — changing it touches every caller.
    (b) **Found 2026-09-15, changes the shape of this work**: the per-output "what blocks this
    curve" mapping is NOT uniform. `maxCurves()` (`sweep.ts:424`) does not treat a missing `Pe`/
    `Xmax` as "curve unavailable" — it sets `peAbsent: true` and lets `maxspl`/`maxpwr` go to
    **Infinity** (`vUse = min(Infinity, Infinity)`), a materially different semantic from
    `circuitQuantities`'s six REQUIRED fields (`sweep.ts:190-260`), whose absence blocks every main
    curve outright. A `DriverPrerequisite` naming `Pe_W`/`Xmax_m` would need to say "unbounded",
    not "missing" — the existing `CalculationPrerequisite<Q>` shape (`missing: readonly Q[]`) does
    not distinguish these two cases, and inventing that distinction without confirming it first
    risks a design that quietly gets the "blocked vs. unbounded" question wrong. Not attempted
    without that confirmation.
11. Project driver/sealed-alignment/vent/PR/box-params/signal/environment channels to domain cells
    identically — no channel gets a different projection rule than another without a stated reason.
12. Convert `dqCalculated.ts#calcMark` to take the `inconsistent-inputs` variant of
    `CalculationIssue<Q>` instead of `ConsistencyIssue` (**Convergence**, above). **Reversed
    2026-09-15 — no new mark**: found `dqCalculated.test.ts`'s own docstring documents a Python-side
    template registry (`scrapers/lib/record_registries.py`, not present in this checkout) that
    rejects any mark whose `detail` doesn't match a registered template exactly. Inventing a new
    `DqMarkJson.kind` here with no matching Python registration is unsafe. `missing-dependencies`
    issues produce no mark; `calcMark`/`dqCalculated` only ever process `inconsistent-inputs`,
    byte-for-byte unchanged from today.
13. **Implemented 2026-09-15, additively (revised from "convert now"):** `checkBoxParams(box, P):
    BoxParamsIssue[]` added beside `validateParams()` in `engine/params.ts`, sharing the same
    `requiredParamsFor()` table; `Engine.checkBoxParams()` exposes it. `validateParams()` and
    `Result<SweepResult>.errors` are UNCHANGED — converting those is a larger, separate decision
    (**Convergence**, above).
14. Delete `packages/design/engine/consistency.ts`'s now-orphaned `ConsistencyIssue` type,
    `Q_GROUP_FIELDS`, `isQGroupField`, `qGroupIsIncomplete` once nothing references them — they are
    superseded by `CalculationIssue<DriverQuantityName>` and a driver solve result that names a
    missing `Qts` route directly, not by a separately-maintained field-name list.
15. Audit `packages/ui/src/logic/useDriverCells.ts` (`consistencyNote`,
    `fieldIsMandatoryAndUnsatisfied`) and `DriverEditorModal.vue`'s `chartBlockingReasons` against
    the now-real `DriverSolveResult.issues` (**Convergence**, above) and replace each hand-rolled
    per-field check with the generic projection the six unified solve results now make possible.

## Tests

- Engine (driver): complete solve returns values with no issues.
- Engine (driver): each missing route reports its exact missing fields.
- Engine (driver): multiple routes report all blocked routes.
- Engine (driver): conflicting complete routes report an inconsistency.
- Engine (sealed alignment, vent, PR, box-params — each independently): the same four cases as
  driver — missing dependencies, multiple routes, conflicting routes, clean solve — over that
  node's own quantities.
- Engine (sealed alignment): a `Qtc` above the reachable ceiling for the driver's `Qts` reports a
  `SealedAlignmentIssue`, not a silently wrong `Vb`.
- Engine (vent/PR): resolving `Vb/Fb` at a non-reference project temperature changes the solved
  vent length/tuning versus the reference condition, and matches what `circuit.ts` actually needs
  to reproduce that tuning at the same temperature (proves item 2 above, not just that a number
  changed).
- Engine (signal): a complete signal input solves `drive_V` with no issue; a missing `Re_ohm`
  reports a signal issue, not a driver or sweep issue.
- Engine (environment): a default-only `AirEnvironment` returns no issues; an entered temperature
  outside `MIN_SUPPORTED_TEMP_K`/`MAX_SUPPORTED_TEMP_K` reports one.
- Domain: only entered values feed consistency checks, for every channel (driver, box, signal).
- Domain: affected relation cells receive the same DQ, for every channel.
- Box: sealed-alignment/vent/PR missing dependencies and contradictions stay in the box channel.
- Sweep: curve failures stay in the sweep channel and only reference upstream prerequisites via
  `driverPrerequisites`/`sealedAlignmentPrerequisites`/`ventPrerequisites`/`prPrerequisites`/
  `boxParamsPrerequisites`/`signalPrerequisites`/`environmentPrerequisites`/
  `configurationPrerequisites` — never a duplicated DQ.
- Browser: driver DQ, box DQ, signal DQ, and chart diagnostics render in their separate UI
  locations.
- `dqCalculated.ts`: a `.wdr` export produces the same DQ marks from a `CalculationIssue<Q>`
  filtered to `inconsistent-inputs` as it previously did from an equivalent `ConsistencyIssue` —
  the conversion changes no mark a real export test already pins.
- `useDriverCells.ts`/`DriverEditorModal.vue`: the generic issue-projection helper (Convergence,
  above) marks the same fields the current hand-rolled `consistencyNote`/
  `fieldIsMandatoryAndUnsatisfied`/`chartBlockingReasons` mark today, for every existing case those
  functions handle — a refactor, not a behavior change, until John asks for one.

## Appendix — Design for the Remaining Seven Prerequisite Channels (2026-09-15)

Everything above this heading is the original design document, unchanged. This appendix is a
proposal for the part of Implementation Order item 10 not yet built: `driverPrerequisites` (the
`maxspl`/`maxpwr`/`Pe`/`Xmax` case) is done, decided by QO143 and implemented in commit
`88c5d28`. The other seven — `sealedAlignmentPrerequisites`, `ventPrerequisites`,
`prPrerequisites`, `boxParamsPrerequisites`, `signalPrerequisites`,
`environmentPrerequisites`, `configurationPrerequisites` — are not built. This section proposes
how, so John can rule on it the way he ruled on QO142/143/144, rather than each channel being
implemented ad hoc as it comes up.

### The blocking/advisory split — what actually decides the shape

Building `driverPrerequisites` surfaced the organizing question the original document didn't
have to answer yet, because Driver, `BoxParams`, and `Environment` all turned out to need the
SAME answer: **when a channel's issue makes `values` entirely `null` (nothing in the sweep can be
computed at all), the issue is embedded directly in `SweepIssue` — never a separate reference.**
`SweepIssue = DriverIssue | EnvironmentIssue | BoxParamsIssue` today (`sweep.ts`) does exactly
this: `circuitQuantities()` returning `null` hands back the actual `DriverIssue` objects, not a
`{output, missing}` pointer at them, because every `SweepOutputName` is equally blocked and a
per-output reference list would just repeat the same six field names ten times over.

The `CalculationPrerequisite<Q>` array shape (`driverPrerequisites`, etc.) earns its keep only in
the OTHER case: **`values` is NOT `null` — the sweep genuinely produced a curve — but ONE
specific output is degraded, unbounded, or otherwise worth flagging without being wrong.**
`maxspl`/`maxpwr` going to `+Infinity` when neither `Pe` nor `Xmax` is stated is the only case
like this found so far: the curve is real and correct, just unlimited, and saying so needs to
name the ONE output affected (not `spl`/`phase`/`exc`/etc., which are unaffected).

So the seven remaining channels split into two groups, not seven uniform cases:

| Group | Channels | Shape |
|---|---|---|
| Blocks the whole sweep | Sealed Alignment, Vent, PR, Configuration | Embed the real issue in `SweepIssue` (widen the union), like Driver/BoxParams/Environment already do — no prerequisite array |
| Not needed (see Signal section below — twice-corrected) | Signal | No channel — `power_W`/`voltage_V` cannot disagree by construction, so the one case that would have needed this cannot occur |
| Neither (see below) | Box-Params | Already done (task #9) — listed here only to close the set |

### Sealed Alignment, Vent, PR — widen `SweepIssue`, do not add prerequisite arrays

`solveVentConsistencyGroup`/`solvePrConsistencyGroup`/`solveSealedAlignmentGroup` resolve `Vb`
(sealed) or `Sp`/`length_m` (vent) or PR mass/tuning — and the circuit CANNOT run at all without
whichever of these the active box type needs. This is structurally identical to the driver's six
required fields: one topology-specific set of quantities, entirely blocking when missing, no
partial curve possible. The evidence for this while building `driverPrerequisites`: a test fixture
that never stated `vent.tuning_hz` produced `Leff = null`, and `sweep()`'s own `.issues` came back
**empty** — the circuit silently went to `NaN` in `zmag`/`zph`/`exc`/`pv`/`gd`, and the ONLY thing
that caught it was the UI's generic `classifyFinite()` postcondition, reporting "Sweep returned no
finite values for impedance magnitude" — true, but naming the wrong layer: the actual cause was
an unstated vent tuning target, not a numerical singularity in the sweep. This is precisely the
silent gap this whole document exists to close, still open for vent/PR/sealed-alignment today.

Proposed shape:

```ts
export type SweepIssue =
  | DriverIssue | EnvironmentIssue | BoxParamsIssue
  | SealedAlignmentIssue | VentIssue | PrIssue;
```

`sweep()` would call the box type's own `checkSealedAlignment()`/`checkVentConsistency()`/
`checkPrConsistency()` (all three already exist and are exercised elsewhere, per Implementation
Order item 8) BEFORE running `circuitQuantities()`, gated on the active `box: BoxType` — a sealed
project only ever runs the sealed check, a vented one only the vent check, and so on, so the
three never fire for the same sweep. On any issue, return `{values: null, issues}` immediately,
the same early-exit pattern `circuitQuantities()` already uses. This requires `sweep()` to take
the box-specific solved quantities (`SealedAlignmentSolverQuantities`/`VentSolverQuantities`/
`PrSolverQuantities`) alongside the driver's, which today only the DOMAIN layer
(`OpenISDProject`) assembles — `sweep()` itself does not currently see raw `Vb`/`Qtc`/vent
geometry as a solve INPUT, only as an already-resolved `SweepParams.Vb`/`Sp`/`Leff` number. This
is the one real design question: does this check move into the ENGINE's `sweep()` (requiring a
wider parameter list), or does it stay a DOMAIN-level precondition
(`OpenISDProject.sweep()`, alongside the existing `checkBoxParams()` call), returning the SAME
`SweepIssue`-shaped result the engine's own circuit check already produces? The `BoxParamsIssue`
precedent (task #9) argues for the domain-level answer — `checkBoxParams()` already lives at
`OpenISDProject.sweep()`, not inside `engine/sweep.ts#sweep()`, for exactly this reason (the
engine's `sweep()` never reads box params directly, only the already-resolved `Sp`/`Leff`/`Vb`
numbers). Sealed-alignment/vent/PR would follow the identical pattern: `OpenISDProject.sweep()`
runs the box-specific check first (using values it already has — `this.box.vented...`,
`this.driver.solveConsistencyGroup()`), and only calls into `engine/sweep.ts#sweep()` once that
passes, exactly as it already does for `checkBoxParams()`.

### Configuration — the one channel with no existing check to call

Unlike the other six, there is no `checkConfiguration()` anywhere — Implementation Order's own
note explains why: "Configuration has no Issue type or values bag of its own... an unsupported
topology is a whole-design refusal, not a field-level DQ." Today, `OpenISDProject.sweep()`'s
`!box` branch (`this.#engineBoxType()` returning `null` for `bandpass6`/`abc`) returns
`{values: null, issues: []}` — an EMPTY issues array. A user with a `bandpass6` or `abc` project
sees a blank chart and no explanation at all; this is a real, currently-live gap, not a
hypothetical one.

`ConfigurationPrerequisite`'s existing type (`CalculationPrerequisite<'boxType' |
'circuitModel' | 'simulationOption'>`) does not fit here either — it is the "one output
degraded" shape, and an unsimulated topology is "every output blocked," the SAME shape as
Sealed Alignment/Vent/PR above. Two options, not yet decided:

1. Add a minimal `ConfigurationIssue` (NOT `CalculationIssue<Q>` — there is no quantity to name,
   only a topology): `{ kind: 'unsupported-topology'; boxType: BoxType }`, widen `SweepIssue` to
   include it, and drop `ConfigurationPrerequisite` from the type list entirely (nothing would
   ever populate it, since every configuration failure blocks completely).
2. Keep `ConfigurationPrerequisite` for a narrower, real future case — e.g. "this circuit model
   doesn't support transmission-line ports" — and separately give `!box` a plain, non-generic
   `DriverError`-shaped refusal (`{level: 'error', field: 'boxType', message: 'bandpass6/abc are
   not yet simulated.'}`), matching how `sweep()`'s postconditions (`classifyFinite`, etc.)
   already report by returning a `DriverError` rather than a `CalculationIssue<Q>`.

Not decided here — flagged for John, the same way QO143 settled the analogous driver question.

### Signal — a blocking input to spl/deflection, twice-corrected 2026-09-15

**First correction (superseded by the second, below — kept for the record).** The paragraph
originally here argued signal issues never need a channel of their own, reasoning that
`#sweepParams()`'s 1 W fallback makes a missing signal value harmless. John's first correction:
the signal (drive level) is a **blocking input to the SPL calculation and to deflection
(excursion), not merely something a default papers over** — `eg` feeds directly into `spl`,
`exc`, `excPR`, `pv`, `maxspl`, `maxpwr`. That much stands. The DRAFT proposal that followed —
a `signalPrerequisites` channel firing on `power_W` disagreeing with `voltage_V`+`Re_ohm` — does
not, per the second correction:

**Second correction — the actual data model.** `power_W` and `voltage_V` **cannot ever
disagree, by construction**, because only ONE of them is ever real, persisted data. John: *"W
and V cannot conflict — EVER — if they are misaligned then move V to meet W. They should be
seen as two different ends of the same pendulum... the only value the model should store is the
one that is actually pulled into the calcs. The other is just a second means to adjust the
other."* Confirmed against WinISD's own `.wpr` format: `[SignalSource]` holds `Rg` and `P` —
**never `V`**. Typing a voltage into the Signal tab is a real, legitimate way to STATE a drive
level, but the act of typing it immediately converts to and stores `power_W`; the typed voltage
itself is never independently persisted, so there is no second stored fact it could ever
disagree with.

This is bigger than the prerequisite question — it means the ENGINE's own `solveSignal()`
(`engine/signal.ts`) is modeling something that cannot happen. Its `inconsistent-inputs` branch:

```ts
if (usable(power_W) && usable(voltage_V) && usable(Re_ohm)) {
  const expected = driveVoltage(power_W, Re_ohm);
  const relative = Math.abs(expected - voltage_V) / Math.abs(voltage_V);
  if (relative > 1e-9) { issues.push({ kind: 'inconsistent-inputs', ... }); }
}
```

treats `power_W` and `voltage_V` as two independently-`entered` quantities that might disagree —
exactly the shape John's correction rules out. The DOMAIN layer (`OpenISDProject.powerDrive_W`/
`driveVoltage_V`, `openisdDomain.ts:2432-2502`) already stores them as a matched pair today
(`.set()` on either one derives and writes both, so the RECORD never disagrees) — closer to
correct than the engine, but still stores `voltage_V` at all, where John's ruling says it
should not be persisted, period: `voltage_V` should be a **pure derived read** (`√(power_W ·
Re_ohm)`), never a field the schema carries, matching `.wpr`'s own `P=`-only shape.

**Consequence for this channel:** `SignalPrerequisite`/`signalPrerequisites` is **not needed**
for a power/voltage disagreement — that case cannot exist once the model is fixed. The reachable
signal gap, if any, is a plain `missing-dependencies` one: `Re_ohm` absent when only a voltage
was typed (nothing to convert it to a storable power with), which is `Re_terminal_ohm` — a
DRIVER field already blocking the whole sweep via the driver channel, same reasoning as the
original (pre-reversal) conclusion. **Revert to: do not build `signalPrerequisites`.**

**Follow-up implied, not yet scoped as a task:** `engine/signal.ts#solveSignal()`'s
`inconsistent-inputs` branch should be deleted (dead by construction once the domain never hands
it both as independently entered), and `openisdSchema.ts`'s signal record
(`z.strictObject({power_W: z.number(), voltage_V: z.number()})` / `{power_W: z.null(),
voltage_V: z.null()}`) should drop `voltage_V` from PERSISTED storage entirely — `powerDrive_W`/
`driveVoltage_V`/`statedVoltage_V`'s `.set()`/`.get()` plumbing in `openisdDomain.ts` already
treats voltage as a derived view in spirit; this would make it true in the stored record too,
matching `.wpr`'s own `[SignalSource]` shape. Not attempted in this appendix — a real code
change to the `.wpr` schema/import-export (signal/drive level is a PROJECT concept, not a driver
one — `.wdr` carries no `[SignalSource]` section and is untouched by this) and the Signal panel,
not a doc-only decision, and outside what was asked for here.

### Revised Implementation Order (continuing from item 10)

10a. Widen `SweepIssue` to `DriverIssue | EnvironmentIssue | BoxParamsIssue |
     SealedAlignmentIssue | VentIssue | PrIssue`. Add the box-specific check to
     `OpenISDProject.sweep()`/`maxCurves()`, gated on the active box type, run before the engine
     call — same early-return pattern as the existing `checkBoxParams()` call.
10b. Get John's ruling on Configuration (the two options above), implement whichever is chosen.
10c. Do NOT build `signalPrerequisites` (twice-corrected 2026-09-15 — see Signal section above):
     `power_W`/`voltage_V` cannot disagree once the data model is right, so there is no reachable
     inconsistent-signal case for it to name. Delete `SignalPrerequisite` from `consistency.ts`'s
     type list (never populated, never will be). Separately (not part of task #10, a real code
     change to the persisted schema/import-export, raised for its own decision): drop
     `voltage_V` from `openisdSchema.ts`'s stored signal record entirely, and delete
     `engine/signal.ts#solveSignal()`'s `inconsistent-inputs` branch, which models exactly the
     conflict John's ruling says cannot exist.
10d. Delete `SealedAlignmentPrerequisite`/`VentPrerequisite`/`PrPrerequisite` from
     `consistency.ts` once 10a lands — they become as dead as the driver-level
     `DriverPrerequisite` array that was never built, superseded by the embedded-issue shape.
     (`DriverPrerequisite` itself stays: it is the one channel that DOES need the array shape,
     for `maxCurves`'s `Pe`/`Xmax` case — see the Sweep output vocabulary section above.)
10e. Tests: for each of Sealed Alignment/Vent/PR, a fixture missing the topology's required
     solve input produces the RIGHT issue (not a generic `classifyFinite` "no finite values"
     postcondition) — the exact regression the `Leff = null` finding above describes. One test
     per topology, mirroring `hardening.test.ts`'s existing driver-blocking tests.
