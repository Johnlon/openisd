# App Analysis — cell graph, WinISD defaults, and the drive/power/signal fix batch

Date: 2026-09-12. Authored from reading the current source on `refactor` (post commit `a470c9e`).

## 1. The cell model

Every domain value the UI reads is one of three shapes in `packages/design/domain/cell.ts`:

- `Cell<T>` — `{name, value: T|null, state, dq()}`. `state ∈ {entered, calculated, not-available}`.
- `Field<T>` — read/write/clear over a cell. `.get()` returns the effective cell.
- `ReadOnlyCalculatedField<T>` — pure precomputed read. `.value` / `.state` / `.dq`.
- `RawField<T>` — a bare slot lens (`get()`/`set()`), no cell state. Reserved for axiomatic inputs
  (`volume_m3`, `count`) and metadata.

The cell is the contract between domain and UI. A `dq` on a cell is the *single source of truth*
for "this field is flagged"; the shell redlines any field whose cell carries DQ and classifies
**entered-with-DQ = the real problem** vs **calculated-with-DQ = a symptom** (the generic DQ rule).

## 2. The solved pairs (cells linked by a consistency solver)

The engine's `solve*ConsistencyGroup` + `check*Consistency` form each two-ended relation. Stating
either end stores it; the other end reads back as `calculated`. An unreachable request produces a
negative derived quantity, which `checkConsistency` flags as the DQ on **all** members of the
relation (input + outputs).

| Pair | Ends | Solver | Unreachable ⇒ DQ |
| --- | --- | --- | --- |
| PR tuning ↔ cone mass | `tuning_hz` (Fp) ↔ `addedMass_kg` | `solvePrConsistencyGroup` | negative mass → DQ on Fp/Madd/systemTuning/Fpr-mass |
| Drive power ↔ voltage | `powerDrive_W` ↔ `statedVoltage_V`/`driveVoltage_V` | engine `driveVoltage`/`driveFromVoltage` | neither stated → DQ "1 W reference" on both inputs |
| Vent tuning ↔ port length | `tuning_hz` (Fb) ↔ vent `length_m` | `solveVentConsistencyGroup` | negative length → DQ on Fb + length |
| Sealed volume → resonance/Q | `volume_m3` → `resonance_hz`, `q_tc` | `sealedResonance` | no volume → not-available |

Cross-cell consumers (the "links"):
- `#sealedResonance_hz` / `#sealedQtc` read the driver's `Fs_hz`/`Qts`/`Sd_m2`/`Cms_m_per_N` +
  the box `volume_m3` + `losses.Ql/Qa` + the project environment → the engine.
- `systemTuning_hz` reads `addedMass_kg` (or 0) + `volume_m3` + the radiator's `Mms/Sd/Cms` +
  PR `count`.
- `#sweepParams` assembles driver + box + signal (`eg`) + environment + signal-chain + losses into
  `SweepParams`; `sweep(GRID)` calls the engine; `appState.doSweep` caches `curvesData`/`maxData`
  and now `sweepErrors`.
- `buildPlotData` (series.ts) turns `curvesData` + `allIssues` into a drawable plot; GraphPanel
  draws it on canvas. `blocked` (error-level issues) → "Can't plot / Fix the driver parameters".

## 3. WinISD defaults audit

| Field | Old | New | Where |
| --- | --- | --- | --- |
| Amplifier source resistance `Rs_ohm` | 0 Ω | **0.100 Ω** | `openisdTransforms.ts` `prototypeProjectJson` |
| Drive power when none stated | null → sweep refused | **1 W reference** (chart always draws) | `openisdDomain.ts` `#sweepParams` |
| Unset power/voltage inputs | silent | **DQ "1 W reference"** | signal fields' not-available cells |
| Sealed `q_tc` | hardcoded null | **computed** via `sealedResonance(...).Qtc` | `OpenISDBox.q_tc` |

Verified unchanged (matching WinISD): sealed losses Ql=10/Qa=100, vent Qp=100, endCorrection 0.6,
environment all null (CIPM defaults), nDrivers 1, wiring parallel. The `.wpr` export/import already
carries `Rg=0.1` (golden-tested).

## 4. Signal pair behaviour (fixed)

- `.set(w)` on power stores `{power_W, voltage_V: √(w·Re)}`; `.set(v)` stores both the other way.
- `.clear()` on an end blanks ONLY that end — the stated sibling survives and the cleared end
  re-derives (`V²/Re` or `√(P·Re)`). Previously clear nuked both.
- UI `driveV` now reads `projectChanged` (was stale → "upping W didn't move V").
- Power input null → `.clear()` (was `set(0)`), so "delete power" derives from the voltage.

## 5. Alignment (box type) selection

The `#og-box-type` select was only on the Box tab and in the New-Project wizard. Added
`#og-box-type-enclosure` to the Enclosure tab so the alignment is changeable from the per-box-type
content screen too.

## 6. Remaining gaps / known reds

- **bandpass4 rear Qtc** still `null` (only the plain sealed box computes `q_tc`; the coupled rear
  chamber needs the same readout).
- **Push blocked**: `refactor` is 19 commits ahead of `origin`; the pre-push hook runs `npm run ci`
  (full browser suite), which has pre-existing failures (`app.browser.spec.ts` stale ids,
  `original-tuning-target` `selectOption('pr')`, `driver-editor-mandatory`, etc.) — those must go
  green before the branch can push.
- Sample fixture driver (`Fs/Qts/Vas/Re/Sd` only) is not simulatable; it now explains itself
  ("Can't plot") rather than silently blank.