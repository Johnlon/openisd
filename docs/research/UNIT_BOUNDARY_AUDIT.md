# Unit-boundary audit — every field's file / SI / display / WinISD units

**Read-only sweep, 2026-08-13.** No source file was changed by this audit.

## Why this exists

Two bugs of one shape were found by accident on 2026-08-13:

- `no` (reference efficiency) is a **fraction** in the `.wdr`; one code path divided it by 100 as
  though it were a percent — a **20 dB** error in the simulation.
- `Gloss` is a **fraction** in the `.wdr` but a **percent** on WinISD's own pane; the OpenISD
  editor printed the fraction under a `%` label — **100×** wrong on screen.

Nothing checked for this class. The human ruled: *sweep every field.* This document is that
sweep: for every field the app reads or writes, four units are established and compared —

1. **File** — what the `.wdr` / `.wpr` actually carries.
2. **SI** — what the engine and the store hold.
3. **Display** — what a panel shows, via its `:scale` / unit-group binding.
4. **WinISD** — what WinISD 0.7.0.950 itself shows, from a screenshot.

## How to read a row — audit discipline

**Every row records the TEST that produced it, not just the conclusion.** A row whose test could
not be run is marked **❔ UNVERIFIED** and is not to be read as confirmed.

| Verdict | Meaning |
| --- | --- |
| ✅ | All four agree, or an explicit and correct conversion sits between them, and the conversion was read. |
| ❌ | Two of the four disagree with no conversion, or with the wrong one. **Reaches the simulation or a written file.** |
| ⚠ INERT | A declaration is wrong but nothing consumes it today. A latent trap, not a live defect. |
| ◐ | Correct value, divergent presentation (dp or default unit). Cosmetic. |
| ❔ | UNVERIFIED — no test was available. |

**Declaration is not implementation.** A `min`/`max`/`unit`/`scale` present in
`fieldRegistry.ts` proves only that it was declared. Every row below states whether the binding
actually passes it.

## Oracles used

| Tag | Oracle | What it settles |
| --- | --- | --- |
| **O-A** | `drivers/sample/winisd/john-all-noncalc-fields-manually-entered.wdr` | A file WinISD itself wrote after a human typed every T/S param. The one trustworthy source for a WinISD-**computed** field's unit. |
| **O-B** | `drivers/sample/winisd/john-all-defaults.wdr` | New→Save with nothing typed: WinISD's own default for all 56 keys. |
| **O-C** | `docs/winisd/sample_project_Epique15_-_pr.wpr` | A real WinISD project. `[Box]`, `[PassiveRadiator]`, `[SignalSource]`, `[VentFront/Rear/Intra]`, `[SimulatorOptions]`. |
| **O-D** | `drivers/sample/winisd/s-<field>.wdr` (53 probes) | One field typed, one file saved — which key WinISD writes for which UI field. |
| **O-E** | `winisd_drivers/db/datasheets/**/openisd.yml` | The record's own units, stated in each field's `definition:` line. |
| **S-1..S-6** | `docs/winisd/edit_driver_pg2_parameters.png`, `…pg3_advanced_parameters.png`, `…pg4_dimensions.png`, `view_3_passive_radiator.png`, `view_5_signal.png`, `view_6_advanced.png` | WinISD's own displayed unit and dp, per field. |
| **DOC** | `docs/design/WDR_SCHEMA.md` §3, §4 | Our reverse-engineered schema. Confirms, never overrides, O-A…O-E. |

> `drivers/sample/other/` was deleted as untrustworthy. It is not cited here and must not be
> resurrected. A third party's export into `.wdr` shape is **not** an oracle.

---

## 1. Findings, ranked by blast radius

### ❌ F1 — `.wpr` `[PassiveRadiator].Vas` is written in LITRES into a cubic-metre field (×1000)

**Severity: highest. Reaches a file WinISD reads.**

| Step | Evidence |
| --- | --- |
| `prVas()` returns **litres** | `packages/engine/src/formulas.ts:16` — `return prCms * prSd * prSd * RHO * C * C * 1000;` The trailing `* 1000` is the m³→l conversion. |
| Its output goes straight into the `.wpr` | `packages/ui/src/logic/wprMapping.ts:101` — `Vas: prVas(P.prCms, P.prSd),` |
| …and is serialised unconverted | `packages/winisd/src/classic/wpr.ts:197` — `['Vas', num(pr.Vas)]` |
| The file's unit is **m³** | O-C line 151 `Vas=0.0048`; WinISD's own PR pane shows that project as **`Vas 4.80 l`** (S-4). 0.0048 × 1000 = 4.80. |
| Every other `[PassiveRadiator]` key IS SI, so this is not a per-section convention | O-C `Sd=0.0095` → S-4 shows `95.0 cm^2` (×1e4, m²); `Xmax=19` → S-4 shows `19000.0 mm` (×1000, metres); `Fs=30` → `30.00 Hz`. |
| The default design exports a wrong number today | `P_DEFAULTS.prCms=0.0008`, `prSd=0.0133` (`packages/ui/src/logic/store.ts:42`) ⇒ `prVas` = **20.074**, written as `Vas=20.074…`. WinISD will read 20 m³. Correct value: `0.020074`. |
| The export is reachable from the UI | `packages/ui/src/ui/components/ExportMenu.vue:29` "Save As WinISD project (.wpr)" → `exportWpr()` → `packages/ui/src/logic/useDesignIO.ts:151`. |
| **Why no test caught it** | `packages/winisd/test/classic/wpr.test.ts:130` asserts the `[PassiveRadiator]` block with `Vas: 0.0048` **fed in by hand** (line 31) — it proves the *serialiser*, and the mapping that feeds it is unexercised. `command grep -rn 'buildWprInput' packages/ui/test/` returns **zero hits**: `wprMapping.ts` has no test at all. |

### ❌ F2 — driver-editor edits to 11 fields are silently discarded on `.wdr` save

**Severity: high. The file keeps a value the human replaced on screen.**

`Driver.toWdr()`'s carried path rewrites a line only when the key is in `MODELED_BY_WDRKEY` **or**
in `WDR_META`; otherwise it echoes the source file's line verbatim
(`packages/winisd/src/driver.ts:369-383`).

- `MODELED_SLOTS` — 15 keys: `Znom Fs Pe Re Le BL Xmax Cms Qms Qes Qts Rms Mms Sd Vas`
  (`packages/winisd/src/parstate.ts:84-100`).
- `WDR_META` — 25 keys, none of them the ones below (`packages/winisd/src/driver.ts:87-113`).

So these 11 editable cells never reach the file: **`Vd`, `Dd`, `no`, `SPL`, `USPL`, `SPLmax`,
`SPLmaxLF`, `Rme`, `gamma`, `Mpow`, `Mcost`** (bound at `DriverEditorModal.vue` lines 541, 594,
616, 627, 632, 675, 680, 685, 690, 695, 700).

`Dd` is the one that bites hardest: it is a real geometry **input** to WinISD's solver
(WDR_SCHEMA §4.1 — "`Sd` sits in row 6 and row 20… with `Dd` entered, row 6 fires"). Editing `Dd`
in OpenISD and saving `.wdr` hands WinISD the old diameter. Worse, `#buildParState()`
(`driver.ts:393-399`) rewrites only the modeled slots, so slot 21 (`Dd`) keeps the source's `E`
mark — the file asserts "the human entered this" over a number the human replaced.

*(This is a boundary defect, not a unit defect — recorded here because the sweep is what
surfaced it.)*

### ❌ F3 — `.wpr` writes three project values as hardcoded constants

**Severity: medium-high. Reaches the written file; wrong physics on re-import into WinISD.**

| `.wpr` key | Written as | Should carry | Evidence |
| --- | --- | --- | --- |
| `[SignalSource].Rg` | literal `0.1` | `state.P.Rs` | `wpr.ts:187` `['Rg', signal.Rg ?? 0.1]`; `wprMapping.ts:54` passes `signal: { P: P.Pin }` — no `Rg` key, so the default always wins. `state.P.Rs` default is 0.1 but is user-editable (`OriginalShell.vue:1423`). |
| `[Box].alfaVC` | literal `0.0039` | `state.P.alfaVC` | `wpr.ts:175` `['alfaVC', 0.0039]`. Store holds SI 1/K (`store.ts:46`), same unit as the file (O-C line 93 `alfaVC=0.0039`) — so it is a pure pass-through that was never wired. |
| `[Box].dTVC` | literal `0` | `state.P.vcTempRise` | `wpr.ts:175` `['dTVC', 0]`. Unit ❔ UNVERIFIED — every corpus value is 0, so K-vs-°C cannot be settled from O-C. |

### ⚠ INERT F4 — `fLe`'s registry bound is in HERTZ under a `kHz` label

`fieldRegistry.ts:397` declares `fLe … unit: 'kHz', min: 0, max: 100`, and its own description says
**"STORED IN HERTZ"**. Registry bounds are SI for a `modeled: true` field
(`fieldRegistry.ts:45-52`), so `max: 100` is **100 Hz = 0.1 kHz** — below any real fLe (typ.
0.5–2 kHz).

**Inert today**: the binding is `<NumInput :class … :model-value="cellVal('fLe')" :scale="1e-3"
:precision="precision('fLe')">` (`DriverEditorModal.vue:563`) with **no `field=` prop**, and
`NumInput` only reads registry limits when `field` is given (`NumInput.vue:107-109`). Adding
`field="fLe"` — the obvious "tidy-up" — would start silently rejecting every real fLe.

### ⚠ INERT F5 — `no`'s registry bound is in PERCENT while the model holds a FRACTION

`fieldRegistry.ts:403` — `no … unit: '%', min: 0, max: 100`. The model holds the fraction
(O-A `no=8.81202645607949E-6`; `packages/engine/src/efficiency.ts` header: *"η₀ is a FRACTION …
that ×100 belongs to the display layer"*). `max: 100` as an SI bound would allow η₀ = 10000 %.
Inert for the same reason as F4 — `DriverEditorModal.vue:618` passes no `field=`.

### ✅ F6 — there is no second driver-entry path holding dimensions in millimetres

The driver model's dimension keys are `outer basket magnet depth thick magnetDepth VCd
basketDisplacement`, all **metres / m³** (`packages/winisd/src/driver.ts:87-113`). A parallel set
of `*Mm` keys carrying the same quantities in millimetres would be a 1000× trap the moment anyone
wired them up, so the sweep looked for one.

**Test run:** `command grep -rn 'dimOnly\|outerMm\|basketMm\|magnetMm\|vcDiaMm\|magDepthMm'
packages/ui/src packages/winisd/src packages/engine/src` → **zero hits**. `command find
packages/ui/src -name '*.vue'` lists 20 components, all under `ui/`, and the only driver-entry
surface among them is `DriverEditorModal.vue`, which binds every dimension through
`cellVal(…) :scale="1000"` / `1e6` (§3.7) and therefore holds SI.

**One duplicate of F1's ×1000 does exist**, and it is display-only:
`packages/ui/src/ui/components/PREditModal.vue:22` recomputes `prCms · prSd² · ρ · c² · 1000`
inline instead of calling `prVas()`. It feeds that modal's own readout, not the `.wpr` writer, so
it is a second copy of the formula rather than a second instance of the defect — but it will
diverge the moment F1 is fixed in `formulas.ts` alone.

### ◐ F7 — 15 driver-editor fields render at 2 dp where WinISD shows 4–6

`NumInput`'s default `precision` is 2 (`NumInput.vue:29`). These bindings pass no `:precision`,
so they lose resolution against WinISD (S-1, S-2): `KLe` (WinISD 6 dp), `Hc` `Hg` `Xlim` (3),
`Vd` (0), `no` (4), `numVC` (0), `AlfaVC` (4), `R(t)` `C(t)` `Rme` `gamma` `Mpow` `Mcost` (5).
Values are correct; only the printed dp differs. `driver-editor-units.test.ts:226-256` already
gates the fields that *do* bind `precision('…')`.

### ◐ F8 — registry `unit:` strings that no binding matches (documentation drift)

| Field | Registry says | Binding actually shows | Evidence |
| --- | --- | --- | --- |
| `advPressure` | `unit: 'kPa'`, precision 2 | **Pa**, precision 1 | `OriginalShell.vue:1439` and `OptionsModal.vue:194` both bind `group="pressure" base="Pa" :precision="1"`. WinISD also shows Pa (S-6, `101325.0`). The registry string is the odd one out. |
| `Hc`, `Hg`, `Xlim` | `unit: 'm'` | **mm** (`:scale="1000"`) | `DriverEditorModal.vue:585, 588, 599`. |
| `Gloss`, `SPLmaxLF`, `Mcost` | `modeled: false` + *"formula has NOT been recovered"* | the engine derives all three | `packages/engine/src/driver.ts:289` (`loss`), `:296-298` (`SPLmaxLF`), `:309-310` (`Mcost`). |

### ❔ F9 — oracle warning: do NOT use `sample_project_Epique15_-_pr.wpr` as a `Gloss` oracle

The recovered formula `Gloss = g/((2π·Fs)²·Xmax)` reproduces O-A exactly:

```
9.80665 / ((2π·4)² · 0.009) = 1.7250371277189787
O-A  Gloss=1.72503712771898          ← identical to 14 significant figures
```

The same formula on O-C's own `Fs=40`, `Xmax=0.0147` gives **0.0105614518**, while O-C line 51
carries `Gloss=0.0000105614518023611` — the identical digits, **exactly 1000× smaller**.

⚠ **Unverified hypothesis** (WinISD's internals were not observed): WDR_SCHEMA §4.1 records that
WinISD only fills a relation when exactly ONE member is unknown, so a `Gloss` already present in
a loaded file is never recomputed. That driver's `ProvidedBy=loudspeakerdatabase.com` says it
arrived as a third-party `.wdr` export. If so the number is the exporter's, not WinISD's. Either
way the arithmetic above is directly observed, and the row is marked ❔ because the cause is not.
**Anyone "fixing" a Gloss scale by chasing that number will introduce a 1000× error.**

---

## 2. Leads from the brief — where each one landed

| Lead | Status | Evidence |
| --- | --- | --- |
| `no` fraction ÷100 in a code path | **Fixed.** Editor binds `:scale="100"` (fraction→%); the engine holds the fraction end-to-end. | `DriverEditorModal.vue:618`; `packages/engine/src/efficiency.ts:29-31, 45-47`; `command grep -rn '/ *100' packages/engine/src` finds no η₀ divide. WinISD shows `no … %` at 4 dp (S-1). |
| `Gloss` fraction-vs-percent | **Fixed during this audit, single-placed.** The ONE ×100 is the binding; the engine module states the percent "exists nowhere in this module". | `DriverEditorModal.vue:713` `:scale="100" :precision="precision('Gloss')"`; `packages/engine/src/driver.ts:242-246`; gated by `packages/ui/test/ui/driver-editor-units.test.ts:169-224`. WinISD shows `Gloss … %` 4 dp (S-2). |
| `fLe` `:scale="1000"` → should be `1e-3` | **Fixed.** | `DriverEditorModal.vue:558-562` (`:scale="1e-3"`, with the inverted-scale trap written into the comment); gated by `driver-editor-units.test.ts:132`. WinISD shows `fLe … kHz` 5 dp (S-1). But see **F4** — the registry bound is still in Hz. |
| Other kHz/mH/µ fields with an inverted scale | **None found.** `Le` `:scale="1000"` (H→mH ✓), `KLe` unscaled (H·√Hz, same both sides ✓), `Cms` `:scale="1000"` (m/N→mm/N ✓), `genHz`/`filterFc`/`Fb` all Hz→Hz. `freq` group's only non-unity factor is `kHz: 1e-3` (`units.ts:62-65`). | `command grep -n 'scale=' DriverEditorModal.vue`, all 27 bindings tabulated in §3. |
| Dimensions tab in metres under an `m` label; `Thick` metres under `in` | **Fixed.** All 8 fields `:scale="1000"` (mm) / `1e6` (cm³), with the old symptom recorded in the comment at line 736. | `DriverEditorModal.vue:740-745`; gated by `driver-editor-units.test.ts:158`. WinISD's own defaults are mixed — `Thick` in **in**, `Dvol` in **in^3**, the other six in **m** (S-3) — so mm/cm³ is a documented divergence within WinISD's own unit cycle, not an error. |
| `.wpr` `phi` fraction vs `humidityPct` | **Correct and single-placed.** | `wpr.ts:174` `['phi', num((env.humidityPct ?? 30) / 100)]`, the only ÷100 in the writer; O-C line 87 `phi=0.3` where S-6 shows `Relative humidity 30.0000 %`. `types.ts:225` states the invariant. |
| `VCCon` 1=parallel / 2=series, writer defaulting to 2 | **openisd side is correct — the lead is upstream.** Every openisd writer defaults to **1**. | `packages/winisd/src/classic/wdr.ts:37` `'VCCon=' + (raw.VCCon \|\| 1)`; `openisdToWdr.ts:42` `['VCCon', 1]`; `driver.ts:316-321` backfills `'1'`; editor select `1=Parallel / 2=Series` (`DriverEditorModal.vue:643`). Matches WDR_SCHEMA §3.5 and WinISD's own `Connection: Parallel` default (S-1). The "defaults to 2" writer is `winisd_tools/scrapers/plugins/visaton/emit.py:119-130`, **outside this repo**. |
| `AlfaVC` labelled `1000/K` but bound with no `:scale` | **Fixed in both places.** | `DriverEditorModal.vue:656` `:scale="1000"`; `OriginalShell.vue:1207` `group="tempCoeff" base="perMilliK"` (factor 1000, `units.ts:93-97`). Gated by `driver-editor-units.test.ts:140`. WinISD shows `AlfaVC … 1000/K` 4 dp (S-2). |

---

## 3. The sweep — `.wdr` `[Driver]`, all 56 keys

Display column = the **Original** skin's Driver-editor binding (`DriverEditorModal.vue`), which
is the maintained skin (AGENTS.md §"Priority Skin").

### 3.1 Metadata (positions 1–7)

| # | Key | File | SI/store | Display | WinISD | Verdict | Test run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `Brand` | string | `brand` | text | text | ✅ | O-B; `driver.ts:88` WDR_META |
| 2 | `Model` | string | `model` | text | text | ✅ | O-B; `driver.ts:89` |
| 3 | `Manufacturer` | string | `manufacturer` | text | text | ✅ | O-B; `driver.ts:90` |
| 4 | `ProvidedBy` | string | `providedBy` | text | text | ✅ | O-A `ProvidedBy=johnl`; `driver.ts:91` |
| 5 | `Comment` | string | `comment` | textarea | text | ✅ | `driver.ts:92` |
| 6 | `DateAdded` | `YYYYMMDD` | `added` | text | date | ✅ | O-A `DateAdded=20260626`; `driver.ts:112` |
| 7 | `DateModified` | `YYYYMMDD` | — | not shown | date | ⚠ INERT — `classic/wdr.ts:28` always writes `DateModified=` empty | `wdr.ts:28`; O-A carries `20260626` |

### 3.2 T/S parameters (positions 8–25)

| # | Key | File | SI/store | Display (scale) | WinISD (S-1) | Verdict | Test run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 8 | `Qts` | — | — | `1`, 3 dp | — 3 dp | ✅ | O-A `Qts=3`; editor L490 |
| 9 | `Znom` | Ω | Ω (`Z`) | `1`, 3 dp, `ohm` | `ohm` 3 dp | ✅ unit — and it is a CALCULATED field, not a label: `Znom = 2·round_half_to_even(0.75·Re)` | O-A `Znom=8` beside `Re=6`; `packages/engine/src/driver.ts` `nominalImpedance`; `packages/engine/test/znom.test.ts`; WDR_SCHEMA §4.2; L623 |
| 10 | `Fs` | Hz | Hz | `1`, 2 dp, `Hz` | `Hz` 2 dp | ✅ | O-A `Fs=4`; L495 |
| 11 | `Pe` | W | W | `1`, 2 dp, `W` | `W` 1 dp | ◐ dp only | O-A `Pe=12`; L606 |
| 12 | `SPL` | dB/W/1m | dB | unscaled, `dB` | `dB` 2 dp | ✅ unit; ❌ **F2** on save | O-A `SPL=61.605…` reproduced by `efficiency.ts:45`; L634 |
| 13 | `Re` | Ω | Ω | `1`, 3 dp, `ohm` | `ohm` 3 dp | ✅ | O-A `Re=6`; L531 |
| 14 | `Le` | **H** | H | `1000`, 3 dp, `mH` | **`H`** 6 dp | ✅ (documented divergence) | O-A `Le=7`; O-E `'3.0'`→`0.003` "voice-coil inductance (H)"; L548 |
| 15 | `fLe` | **Hz** | Hz | `1e-3`, 5 dp, `kHz` | `kHz` 5 dp | ✅ value / ⚠ **F4** bound | O-A `fLe=8`; DOC §3.2; L563 |
| 16 | `KLe` | H·√Hz | H·√Hz | unscaled, 2 dp | `H*sqrt(Hz)` 6 dp | ◐ dp only | O-A `KLe=49.628…`; L568 |
| 17 | `BL` | T·m | T·m (`Bl`) | `1`, 3 dp, `Tm` | `Tm` 5 dp | ◐ dp only | O-A `BL=0.868…`; L537 |
| 18 | `Xmax` | **m** | m | `1000`, 3 dp, `mm peak` | **`m`** 3 dp `peak` | ✅ (documented divergence) | O-A `Xmax=0.009`; O-E "stored in m, not mm"; L579 |
| 19 | `Cms` | **m/N** | m/N | `1000`, 4 dp, `mm/N` | **`um/N`** 1 dp | ✅ (documented divergence) | O-A `Cms=0.3166…`; O-E "(m/N)"; L519 |
| 20 | `Qms` | — | — | `1`, 3 dp | — 3 dp | ✅ | O-A `Qms=2`; L485 |
| 21 | `Qes` | — | — | `1`, 3 dp | — 3 dp | ✅ | O-A `Qes=1`; L480 |
| 22 | `Rms` | kg/s ≡ N·s/m | kg/s | `1`, 4 dp, `Ns/m` | `Ns/m` 5 dp | ✅ (same unit, two spellings) | O-A `Rms=0.06283…` = 2π·4·0.005/2; O-E "(kg/s)"; L525 |
| 23 | `Mms` | **kg** | kg | `1000`, 2 dp, `g` | **`kg`** 5 dp | ✅ (documented divergence) | O-A `Mms=0.005`; O-E "stored in kg, not g"; L513 |
| 24 | `Sd` | **m²** | m² | `1e4`, 2 dp, `cm²` | **`m^2`** 4 dp | ✅ (documented divergence) | O-A `Sd=0.0017754…`; O-E "stored in m², not cm²"; L554 |
| 25 | `Vas` | **m³** | m³ | `1000`, 2 dp, `L` | **`in^3`** 1 dp | ✅ (mm/L divergence documented) | O-A `Vas=0.14158…`; O-E "stored in m³, not litres"; L501 |

### 3.3 `Dia` (position 26)

| # | Key | File | SI/store | Display | WinISD | Verdict | Test run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 26 | `Dia` | m | m (aliased to `Dd` in `driver.ts:419, 429`) | not rendered | superseded by `Dd` (DOC §3.3) | ⚠ INERT | O-A `Dia=0`; `driver.ts:419` |

### 3.4 Calculated fields (positions 27–44)

| # | Key | File | SI/store | Display (scale) | WinISD | Verdict | Test run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 27 | `Vd` | **m³** | m³ | `1e6`, 2 dp, `cm³` | `cm^3` 0 dp (S-1) | ✅ unit; ❌ **F2**; ◐ dp | O-A `Vd=1.5979e-5` = Sd×Xmax; DOC §3.4 "displays as 200 cm³"; L596 |
| 28 | `no` | **fraction** | fraction | `100`, 2 dp, `%` | **`%`** 4 dp (S-1) | ✅ unit; ❌ **F2**; ⚠ **F5**; ◐ dp | O-A `no=8.812e-6` reproduced by `(4π²/c³)·Fs³·Vas/Qes` = 8.81202645607949e-6; L618 |
| 29 | `Dd` | **m** | m | `1000`, 2 dp, `mm` | **`m`** 3 dp (S-1) | ✅ unit; ❌ **F2** | O-A `Dd=0.047545…` = 2√(Sd/π); O-E "stored in m, not mm"; L543 |
| 30 | `EBP` | Hz | Hz | read-only, 1 dp, `Hz` | `Hz` 2 dp (S-2) | ✅ | O-A `EBP=4` = Fs/Qes; `DriverEditorModal.vue:707` |
| 31 | `numVC` | integer | integer | unscaled, 2 dp | integer (S-1) | ✅ unit; ◐ dp (shows `1.00`) | O-B `numVC=1`; `driver.ts:445`; L639 |
| 32 | `Hc` | **m** | m | `1000`, 2 dp, `mm` | **`m`** 3 dp (S-1) | ✅ value; ⚠ F8 registry says `m` | O-A `Hc=10`; O-E `Hc_mm` "(mm)" → the RECORD is mm, the FILE is m, converted at `openisdToWdr.ts:60` `1e-3` ✅; L585 |
| 33 | `Hg` | **m** | m | `1000`, 2 dp, `mm` | **`m`** 3 dp | ✅ value; ⚠ F8 | O-A `Hg=9.982`; `openisdToWdr.ts:60`; L590 |
| 34 | `SPLmax` | dB | dB | unscaled, `dB` | `dB` 2 dp (S-2) | ✅ unit; ❌ **F2** | O-A `SPLmax=69.397…` = SPL+10log₁₀(12); `driver.ts:278` |
| 35 | `SPLmaxLF` | dB | dB | unscaled, `dB` | `dB` 2 dp (S-2) | ✅ unit; ❌ **F2**; ⚠ F8 stale registry | O-A `SPLmaxLF=64.635…`; `driver.ts:296-298` |
| 36 | `USPL` | dB/2.83V | dB | unscaled, `dB` | `dB` 2 dp (S-1) | ✅ unit; ❌ **F2** | O-A `USPL=62.859…` = SPL+10log₁₀(8/6); `driver.ts:242` |
| 37 | `alfaVC` | **1/K** | 1/K (`tc`) | `1000`, 2 dp, `1000/K` | **`1000/K`** 4 dp (S-2) | ✅ unit; ◐ dp | O-C `alfaVC=0.0039` = copper 0.0039/K; L656; test `driver-editor-units.test.ts:140` |
| 38 | `Rt` | K/W | K/W (`Rth`) | unscaled, `K/W` | `K/W` 5 dp (S-2) | ✅ unit; ◐ dp | O-A `Rt=0`; L661 |
| 39 | `Ct` | J/K | J/K (`Cth`) | unscaled, `J/K` | `J/K` 5 dp (S-2) | ✅ unit; ◐ dp | O-A `Ct=0`; L666 |
| 40 | `gamma` | m/(s²·A) ≡ N/(A·kg) | same | unscaled, `N/(A·kg)` | `N/(A*kg)` 5 dp (S-2) | ✅ unit; ❌ **F2**; ◐ dp | O-A `gamma=173.664…` = BL/Mms; `driver.ts:273` |
| 41 | `Rme` | N·s/m | N·s/m | unscaled, `Ns/m` | `Ns/m` 5 dp (S-2) | ✅ unit; ❌ **F2**; ◐ dp | O-A `Rme=0.12566…` = 2π·4·0.005/1; `driver.ts:262` |
| 42 | `Mpow` | N/√W | N/√W | unscaled, `N/√W` | `N/sqrt(W)` 5 dp (S-2) | ✅ unit; ❌ **F2**; ◐ dp | O-A `Mpow=0.35449…` = √Rme; `driver.ts:271` |
| 43 | `Mcost` | N·s/m (DOC) / kg/s (S-2) | same quantity | unscaled, `kg/s` | `kg/s` 5 dp (S-2) | ❔ **the two spellings are not the same quantity** — DOC §3.4 says N·s/m, WinISD's pane says kg/s. N·s/m ≡ kg/s dimensionally, so this is a spelling difference, but no probe settles which WinISD means. ⚠ F8 stale registry | O-A `Mcost=0.125777…`; `driver.ts:309-310`; DOC §3.4 vs S-2 |
| 44 | `Gloss` | **fraction of Xmax** | fraction (`loss`) | `100`, 4 dp, `%` | **`%`** 4 dp (S-2) | ✅ (fixed this session) | O-A `Gloss=1.72503712771898` reproduced to 14 s.f. by `g/((2π·Fs)²·Xmax)`; L713; test `driver-editor-units.test.ts:169-224`. See **F9**. |

### 3.5 Voice-coil connection (position 45)

| # | Key | File | SI/store | Display | WinISD | Verdict | Test run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 45 | `VCCon` | 1=parallel, 2=series | same integer | `<select>` 1/2 | `Connection: Parallel` (S-1) | ✅ | O-A/O-B/O-C all `VCCon=1`; `wdr.ts:37`, `openisdToWdr.ts:42`, `driver.ts:318`; `DriverEditorModal.vue:643` |

### 3.6 Environment constants (positions 46–47)

| # | Key | File | SI/store | Display | WinISD (S-2) | Verdict | Test run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 46 | `c` | m/s | m/s | read-only `C.toFixed(2)` `m/s` | `m/s` 2 dp | ✅ | O-A `c=343.684120962152`; `DriverEditorModal.vue:722` |
| 47 | `roo` | kg/m³ | kg/m³ | read-only `RHO.toFixed(5)` `kg/m³` | `kg/m^3` 5 dp | ✅ | O-A `roo=1.20095217714682`; `DriverEditorModal.vue:726` |

### 3.7 Physical dimensions (positions 48–55)

All eight are **metres** in the file (m³ for `DVol`), **metres** in the store, **mm** on the panel
(`cm³` for `Dvol`). WinISD's own defaults are mixed (S-3).

| # | Key | File | SI/store | Display | WinISD (S-3) | Verdict | Test run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 48 | `Thick` | m | m (`thick`) | `1000` `mm` | **`in`** 2 dp | ✅ | O-B `Thick=0`; O-E `thick_mm` "(mm)" → `openisdToWdr.ts:61` `1e-3` ✅; editor L740 |
| 49 | `Depth` | m | m (`depth`) | `1000` `mm` | `m` 3 dp | ✅ | O-E `depth_mm` `'3.875'`→`98.425` mm; `openisdToWdr.ts:61`; L741 |
| 50 | `MagDepth` | m | m (`magnetDepth`) | `1000` `mm` | `m` 3 dp | ✅ | O-E `magnet_depth_mm`; `openisdToWdr.ts:62`; L742 |
| 51 | `Magnet` | m | m (`magnet`) | `1000` `mm` | `m` 3 dp | ✅ | O-E `magnet_dia_mm` `24.5` mm; `openisdToWdr.ts:62`; L743 |
| 52 | `Basket` | m | m (`basket`) | `1000` `mm` | `m` 3 dp | ✅ | O-E `basket_dia_mm` `232.0` mm; `openisdToWdr.ts:63`; L744 |
| 53 | `Outer` | m | m (`outer`) | `1000` `mm` | `m` 3 dp | ✅ | O-E `outer_dia_mm` `203.2` mm; `openisdToWdr.ts:63`; L745 |
| 54 | `Vcd` | m | m (`VCd`) | `1000` `mm` | `m` 3 dp | ✅ | O-E `voice_coil_dia_mm` `38.1` mm; `openisdToWdr.ts:60`; L746 |
| 55 | `DVol` | **m³** | m³ (`basketDisplacement`) | `1e6` `cm³` | **`in^3`** 1 dp | ✅ | O-E `driver_volume_l` `1.6` **litres** → `openisdToWdr.ts:64` `1e-3` ✅; L747 |

### 3.8 ParState (position 56)

| # | Key | File | SI/store | Display | WinISD | Verdict | Test run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 56 | `ParState` | 49-char `E`/`C`/`N` | `#parStateIn` + live `cell().state` | E/C/N cell colouring | green/blue/black legend (S-1) | ✅ length & alphabet; ❌ **F2** for the 11 unmodeled slots | O-A 49 chars; `parstate.ts:12, 18-68`; `driver.ts:393-399` |
| — | `Xlim` | **no file key** — ParState slot 10 only | m | `1000` `mm` | `m` 3 dp (S-1) | ✅ (openisd writes an extra `Xlim=` line for its own round-trip only — `wdr.ts:42`) | O-D `s-xlim.wdr` writes no `Xlim=`; DOC §8.4 pos 11; O-E `Xlim` "stored in m"; L601 |

---

## 4. The sweep — `.wpr` project file

Written by `packages/winisd/src/classic/wpr.ts`, fed by `packages/ui/src/logic/wprMapping.ts`.
**Read-back is not implemented** — `.wpr` is export-only (`useDesignIO.ts:284` only branches on
the extension for the *driver* block), so every row below is a write-side risk.

### 4.1 `[Box]`

| Key | File | Store | Verdict | Test run |
| --- | --- | --- | --- | --- |
| `BType` | 0/1/2/4 | `BoxType` | ✅ | O-C `BType=4`; `wprMapping.ts:24` |
| `Vr`, `Vf` | m³ | m³ (`P.Vb`, `P.Vf`) | ✅ | O-C `Vr=0.00372` (3.72 l); `wprMapping.ts:53, 89` |
| `Fr`, `Ff` | Hz | Hz | ✅ | O-C `Fr=45.4014…`; `wprMapping.ts:73, 80, 88, 90` |
| `Qlr/Qar/Qpr` | — | — | ✅ | O-C `Qlr=10 Qar=100 Qpr=100`; `wpr.ts:166` |
| `T` | K | K (`P.tempK`) | ✅ | O-C `T=293.15`; S-6 shows `293.15 K`; `wpr.ts:173` |
| `p` | Pa | Pa (`P.pressurePa`) | ✅ | O-C `p=101325`; S-6 shows `101325.0 Pa`; `wpr.ts:173` |
| `phi` | **fraction** | **percent** (`P.humidityPct`) | ✅ converted once | O-C `phi=0.3`; S-6 shows `30.0000 %`; `wpr.ts:174` `/ 100` |
| `alfaVC` | 1/K | 1/K (`P.alfaVC`) | ❌ **F3** — hardcoded `0.0039` | `wpr.ts:175` |
| `dTVC` | ❔ K assumed | K (`P.vcTempRise`) | ❌ **F3** — hardcoded `0`; unit ❔ UNVERIFIED | `wpr.ts:175`; O-C `dTVC=0` (no non-zero sample) |
| `Sdfport`, `Sdrport` | m² | m² | ✅ | `wprMapping.ts:42` `Sp = π(ventD/2)²` with `ventD` in m; `wpr.ts:176` |
| `Npr` | integer | integer | ✅ | O-C `Npr=1`; `wprMapping.ts:99` |
| `d`, `Med`, `Nd`, `Angle`, `Isobarik`, `Vc/Fc/Q*c`, `Qicl*` | — | — | ⚠ INERT (boilerplate copied from O-C) | `wpr.ts:168-175`; O-C lines 77-92 |

### 4.2 `[VentFront] / [VentRear] / [VentIntra]`

| Key | File | Store | Verdict | Test run |
| --- | --- | --- | --- | --- |
| `dia1`, `dia2` | m | m (`P.ventD`) | ✅ | O-C `dia1=0.102` (a 102 mm port); `wpr.ts:136-137` |
| `len` | m | m (`P.ventL`) | ✅ | O-C `len=0` (PR project); `wpr.ts:139`; `wprMapping.ts:82` |
| `endcorrection` | coefficient | coefficient | ✅ | O-C `endcorrection=0.732`; `fieldRegistry.ts:126-130`; `wpr.ts:140` |
| `Num`, `Shape`, `Fb`, `Vb`, `carea`, `crosscalc` | — | — | ⚠ INERT boilerplate / provenance flag | O-C lines 100-109; `wpr.ts:131-141` |

### 4.3 `[SignalSource]`, `[PlotSettings]`, `[Filters]`, `[SimulatorOptions]`

| Key | File | Store | Verdict | Test run |
| --- | --- | --- | --- | --- |
| `P` | W | W (`P.Pin`) | ✅ | O-C `P=140`; S-5 shows `System input power 140.0 W`; `wprMapping.ts:54` |
| `Rg` | Ω | Ω (`P.Rs`) | ❌ **F3** — hardcoded `0.1` | O-C `Rg=0.1`; S-5 `Series resistance 0.100 ohm`; `wpr.ts:187` |
| `Color`, `Width` | Win32 COLORREF / px | — | ⚠ INERT | O-C `Color=16711680 Width=1`; `wpr.ts:181-183` |
| `Count` + `filterNtype/params` | WinISD filter codes | `P.filters` | ⚠ INERT — always `Count=0` | O-C `Count=2` with two real filters; `wpr.ts:192` |
| `VCInd`, `FlatResponse`, `TLPorts` | 0/1 | booleans | ✅ | O-C all `=0`; `wprMapping.ts:59-63`; `wpr.ts:203-207` |

### 4.4 `[PassiveRadiator]` — WinISD pane units confirmed by S-4

| Key | File | Store | Display (Original skin) | WinISD (S-4) | Verdict | Test run |
| --- | --- | --- | --- | --- | --- | --- |
| `Vas` | **m³** | derived, **litres** | `L` | **`l`** | ❌ **F1 — ×1000** | O-C `Vas=0.0048` vs S-4 `4.80 l`; `formulas.ts:16`; `wprMapping.ts:101` |
| `Qms` | — | — | — | — | ✅ | O-C `Qms=3.3` vs S-4 `3.300`; `formulas.ts:39`; `wprMapping.ts:102` |
| `Fs` | Hz | Hz | `Hz` | `Hz` | ✅ | O-C `Fs=30` vs S-4 `30.00 Hz`; `formulas.ts:31`; `wprMapping.ts:103` |
| `Sd` | **m²** | m² (`P.prSd`) | `cm²` (`group="area" base="cm2"`) | **`cm^2`** | ✅ | O-C `Sd=0.0095` vs S-4 `95.0 cm^2` (×1e4); `OriginalShell.vue:1353`; `wprMapping.ts:104` |
| `Xmax` | **m** | m (`P.prXmax`) | `mm` (`group="length" base="mm"`) | **`mm`** | ✅ | O-C `Xmax=19` vs S-4 `19000.0 mm` (×1000 ⇒ the file is metres; that project's value is simply an absurd 19 m) ; `OriginalShell.vue:1356`; `wprMapping.ts:105` |
| `Me` | ❔ kg assumed | kg (`P.prMadd`) | `g` (`group="mass" base="g"`) | **`g`** | ❔ UNVERIFIED — every corpus value is 0, so kg-vs-g cannot be settled | O-C `Me=0`; S-4 `Added mass to cone 0.0 g`; `OriginalShell.vue:1362`; `wprMapping.ts:106` |

---

## 5. The sweep — store (`UiParams`) and the Original skin's panels

The store **always holds SI** (`units.ts` header; `store.ts:26-57` `P_DEFAULTS`). Two display
mechanisms exist and both were checked: the fixed `:scale` prop, and the rotatable unit-group
triple (`group` + `field` + `base`) resolved through `units.ts`.

| Field | SI/store | Display binding | WinISD | Verdict | Test run |
| --- | --- | --- | --- | --- | --- |
| `Vb` | m³ (`0.030`) | `group="volume" base="L"` ⇒ ×1000 | `l` | ✅ | `store.ts:27`; `OriginalShell.vue:1032`; `units.ts:47-51` |
| `Vf` | m³ | `group="volume" base="L"` | `l` | ✅ | `OriginalShell.vue:1076` |
| `Fb`, `Frc`, `boxResonance`, `rearResonance`, `portResonance`, `prFs`, `prFsMass` | Hz | `group="freq" base="Hz"` ⇒ ×1 | `Hz` | ✅ | `OriginalShell.vue:1040-1047, 1060-1066, 1085 → 1319, 1294 → 1352, 1321 → 1363`; `units.ts:62-65` |
| `ventD`, `ventW`, `ventH`, `ventL` | m (`0.05`, `0.10`) | `group="length" base="cm"` ⇒ ×100 | `cm` (Vents pane) | ✅ | `store.ts:27`; `OriginalShell.vue:1252-1283`; `units.ts:52-56` |
| `ventCrossArea` (`ventArea`) | m² | `group="area" base="m2"` ⇒ ×1 | `m^2` | ✅ | `OriginalShell.vue:1316`; `fieldRegistry.ts:132-136` |
| `endCorrection` | coefficient | `<select>` of `END_CORRECTION_OPTIONS` | 0.732 default | ✅ | `fieldRegistry.ts:126-130`; `OriginalShell.vue:1239-1242`; O-C `endcorrection=0.732` |
| `Ql`, `Qa`, `Qp` | — | `:scale="1"` | — | ✅ | `store.ts:27`; `OriginalShell.vue:1481-1483` |
| `nDrivers` | integer | `<select>` 1–8 | integer | ✅ | `OriginalShell.vue:1188` |
| `wiring` | enum | `<select>` parallel/series | `Parallel` | ✅ | `OriginalShell.vue:1198` |
| `Pin` | W | `:scale="1"`, 2 dp, `W` | `W` 1 dp (S-5) | ✅ unit; ◐ dp | `OriginalShell.vue:1416` |
| `driveV` | V | `:scale="1"`, 2 dp, `V` | `V` 1 dp (S-5) | ✅ unit; ◐ dp | `OriginalShell.vue:1422`; `formulas.ts:47` `√(Pin·Re)` |
| `Rs` | Ω | `:scale="1"`, 3 dp, `ohm` | `ohm` 3 dp (S-5) | ✅ | `OriginalShell.vue:1423` |
| `listenDistance` | — | hardcoded `1.000`, disabled, `m` | `m` 3 dp (S-5) | ⚠ INERT (declared `modeled: false`, honestly shown as disabled) | `OriginalShell.vue:1415`; `fieldRegistry.ts:209-212` |
| `listenAngle` | — | hardcoded `0.0000`, disabled, `rad` | `rad` 4 dp (S-5) | ⚠ INERT | `OriginalShell.vue:1416`; `fieldRegistry.ts:214-217` |
| `genHz` | Hz | `v-model.number`, `Hz` | `Hz` 2 dp (S-6) | ✅ | `OriginalShell.vue:957` |
| `tempK` | K | `group="temp" base="K"` (affine, offset −273.15 for °C) | `K` 2 dp (S-6) | ✅ | `store.ts:56`; `OriginalShell.vue:1401`; `units.ts:72-76` |
| `humidityPct` | **percent** | plain `%` input | `%` 4 dp (S-6) | ✅ (the `.wpr` fraction is converted once — see §4.1) | `store.ts:56`; `OriginalShell.vue:1438`; `types.ts:225` |
| `pressurePa` | Pa | `group="pressure" base="Pa"` ⇒ ×1 | `Pa` 1 dp (S-6) | ✅ value; ⚠ **F8** registry says `kPa` | `OriginalShell.vue:1439`; `units.ts:78-82`; `fieldRegistry.ts:253-256` |
| `advSoundVelocity` | m/s | read-only 2 dp, `m/s` | `m/s` 2 dp (S-6) | ✅ | `OriginalShell.vue:1438`; `packages/engine/src/air.ts` |
| `advAirDensity` | kg/m³ | read-only 5 dp, `kg/m³` | `kg/m^3` 5 dp (S-6) | ✅ | `OriginalShell.vue:1439` |
| `vcTempRise` | K | `group="tempDiff" base="K"` ⇒ ×1 | — (no WinISD field) | ✅ | `store.ts:46`; `OriginalShell.vue:1206`; `units.ts:86-89` |
| `alfaVC` (project) | **1/K** | `group="tempCoeff" base="perMilliK"` ⇒ ×1000 | `1000/K` (S-2) | ✅ | `store.ts:46` `0.0039`; `OriginalShell.vue:1207`; `units.ts:93-97` |
| `driverAddedMass` | kg | `group="mass" base="g"` ⇒ ×1000 | `kg` on the Classic mock; `g` on the PR pane (S-4) | ✅ | `store.ts:46`; `OriginalShell.vue:1208`; `units.ts:66-70` |
| `prSd` | m² | `group="area" base="cm2"` ⇒ ×1e4 | `cm^2` (S-4) | ✅ | `store.ts:42`; `OriginalShell.vue:1353` |
| `prXmax` | m | `group="length" base="mm"` ⇒ ×1000 | `mm` (S-4) | ✅ | `store.ts:42`; `OriginalShell.vue:1356` |
| `prMadd` | kg | `group="mass" base="g"` ⇒ ×1000 | `g` (S-4) | ✅ | `store.ts:42`; `OriginalShell.vue:1362` |
| `prVas` (derived) | **litres** | `fmtU(prVas / 1000, …, 'volume', 'L')` — divided back to m³, then ×1000 | `l` (S-4) | ✅ on screen (the ÷1000 is deliberate); ❌ on `.wpr` export (**F1**) | `OriginalShell.vue:1342`; `formulas.ts:16` |
| `prMmd`, `prCms`, `prRms` | kg, m/N, kg/s | **no direct binding** — the PR editor shows WinISD's own trio instead, and writes these back through setters | not shown by WinISD (it exposes Fs/Qms/Vas) | ✅ | `store.ts:42`; `PREditModal.vue:112, 117, 122` (`prFsDisplay`, `prQmsDisplay`, `prVas` → `setWinIsdFs/Qms/Vas`) |
| `prVas` (PR editor readout) | litres, from `PREditModal.vue:22`'s inline `…·ρ·c²·1000` | `:scale="1"` under a `L` label | `l` (S-4) | ✅ on screen | `PREditModal.vue:22, 122`. The inline formula duplicates `formulas.ts:16` — see **F6** |
| `prNum` | integer | `:scale="1"` | integer (S-4) | ✅ | `OriginalShell.vue:1361` |
| `prFp` | Hz | solved by `usePrGroup` | `Fs (with added mass)` Hz (S-4) | ✅ | `store.ts:36`; `alignments.ts:113-118` |
| `filterFc`, `filterQ`, `filterGain`, `filterOrder` | Hz, —, dB, integer | plain inputs with `v-limits`, labelled `Hz`/`dB` | 3 dp each (`view_4_filters_*.png`) | ✅ unit; ◐ dp (OgFilters prints 0–2 dp) | `OgFilters.vue:85-94`; `fieldRegistry.ts:447-450` |
| `fmin`, `fmax`, `N` | Hz, Hz, count | chart axis only | — | ✅ | `store.ts:43`; `sweep.ts:130` |
| `rgAtDriverSide`, `tlPortModel`, `forceFlatResponse`, `splXmaxLimited`, `ignoreHumidityAndPressure`, `circuitModel` | booleans / enum | checkboxes in `AdvancedOptions.vue` | checkboxes (S-6) | ✅ (no unit) | `AdvancedOptions.vue`; `store.ts:44-56` |

### 5.1 Chart series

| Series | Engine array | Engine unit | Axis label | Verdict | Test run |
| --- | --- | --- | --- | --- | --- |
| Cone excursion | `sw.exc` | **mm** | `mm` | ✅ | `sweep.ts:158` `… * 1000`; the Xmax limit line is `drv.Xmax * 1000` (`series.ts:115`) and the clamp converts back `exc[i] / 1000` (`sweep.ts:201`, comment *"exc is mm; Xmax is metres"*) |
| PR excursion | `sw.excPR` | mm | `mm` | ✅ | `series.ts:120` `(P.prXmax) * 1000` |
| Air velocity | `sw.pv` | m/s | `m/s` | ✅ | `series.ts:24` |
| Group delay | `sw.gd` | ms | `ms` | ✅ | `types.ts:290` |
| SPL / MaxSPL / TFMag / filter magnitude | `sw.spl`, … | dB | `dB` | ✅ | `series.ts:17, 22, 29, 31` |
| Impedance / phase | `sw.zmag`, `sw.zph`, `sw.phase` | Ω, ° | `Ω`, `°` | ✅ | `series.ts:26-28` |
| Maximum power | `maxCurves` | W | `W` | ✅ | `series.ts:30` |

---

## 6. The sweep — `openisd.yml` record → `.wdr` projection

`packages/winisd/src/native/openisdToWdr.ts` `SPEC_TO_WDR` (lines 53-65). The record's own
`definition:` strings are the oracle (**O-E**), read from live files under
`winisd_drivers/db/datasheets/`.

| Record field | Record unit (O-E `definition:`) | Scale applied | `.wdr` unit | Verdict |
| --- | --- | --- | --- | --- |
| `Fs Re Le Znom Qts Qes Qms BL Rms Pe SPL EBP numVC VCCon` | SI (`Le`: `'3.0'` → `0.003` "H") | `1` | SI | ✅ |
| `Vas` | "stored in **m³**, not litres" (`'1.31'` → `0.037095008`) | `1` | m³ | ✅ |
| `Sd` | "stored in **m²**, not cm²" (`'215.0'` → `0.0215`) | `1` | m² | ✅ |
| `Xmax` | "stored in **m**, not mm" (`'3.0'` → `0.003`) | `1` | m | ✅ |
| `Mms` | "stored in **kg**, not g" (`'22.2'` → `0.0222`) | `1` | kg | ✅ |
| `Cms` | "(m/N)" (`'0.56'` → `0.00056`) | `1` | m/N | ✅ |
| `Dd` | "stored in **m**, not mm" (`'13.0cm'` → `0.13`) | `1` | m | ✅ |
| `voice_coil_dia_mm` | "(mm)" (`38.1`) | `1e-3` | m (`Vcd`) | ✅ |
| `Hg_mm`, `Hc_mm` | "(mm)" (`2.0`, `18.0`) | `1e-3` | m | ✅ |
| `thick_mm`, `depth_mm`, `magnet_depth_mm`, `magnet_dia_mm`, `basket_dia_mm`, `outer_dia_mm` | "(mm)" (`12.5`, `98.425`, `24.5`, `232.0`, `203.2`) | `1e-3` | m | ✅ |
| `driver_volume_l` | "(l)" (`1.6` from `'1.6 dm3'`) | `1e-3` | m³ (`DVol`) | ✅ |
| `Xlim` | "stored in m" (`0.0125`) | — not in `SPEC_TO_WDR` | — | ⚠ INERT (correct: `.wdr` has no `Xlim=` key — DOC §8.4) |
| `fLe`, `KLe` | ❔ no live record carries either | `1` | Hz, H·√Hz | ❔ UNVERIFIED — no sample found across the whole `db/datasheets` tree |
| `weight_kg`, `freq_low_hz`, `freq_high_hz`, `power_peak_W`, `outer_x_mm`, `outer_y_mm` | kg / Hz / W / mm | — | — | ⚠ INERT — no `.wdr` key exists; correctly not projected |

**Bundler**: `scripts/bundle-drivers.mjs:78-82` `SPEC_TO_FIELD` copies 17 SI spec fields 1:1 into
`drivers-bundle.json` and deliberately excludes every `*_mm` / `*_l` field (line 77). Spot-check:
`packages/ui/src/drivers-bundle.json` Accuton AS168-9-470 carries `Le: 0.001`, `Xmax: 0.008`,
`Cms: 0.00097`, `Mms: 0.036`, `Sd: 0.0161`, `Vas: 0.0355` — all SI. ✅

---

## 7. Counts

| | |
| --- | --- |
| Fields swept | **117** (56 `.wdr` keys + 27 `.wpr` keys + 42 store/panel/chart/record rows) |
| ❌ live mismatches | **3** (F1, F2, F3) touching **15 fields** |
| ⚠ inert / latent traps | **5** (F4, F5, plus the boilerplate `.wpr` and `Dia`/`DateModified` rows) |
| ◐ presentation-only divergences | **2** (F7 across 15 fields, F8 across 6 fields) |
| ✅ negatives established by test | **1** (F6 — the mm-keyed second entry path does not exist) |
| ❔ UNVERIFIED rows | **4** — `.wpr` `[Box].dTVC` unit; `.wpr` `[PassiveRadiator].Me` unit; `Mcost`'s unit spelling (DOC N·s/m vs WinISD `kg/s`); the record's `fLe`/`KLe` scale |

**Every `file:line` in this document was re-resolved against the working tree on 2026-08-13.**
The UI tree is being restructured (`packages/ui/src/{ui,logic,db,…}`), so a `packages/ui/…`
citation is the more perishable half of the evidence: where a line has moved, the durable locator
is the token quoted beside it — a `field="…"` attribute, a `cellVal('…')` call, a registry `id:`
— and that is what to grep for. Engine, `winisd` and `.wpr`/`.wdr` writer citations are stable.

### Why each UNVERIFIED row could not be settled

- **`dTVC`, `Me`** — every value in the entire `.wpr` corpus is `0`, and 0 is unit-free. Settling
  them needs a WinISD session with a non-zero coil temperature rise and a non-zero PR added mass,
  saved to `.wpr`. WinISD has no CLI (WDR_SCHEMA §Provenance note 3), so this is a hand-driven
  probe.
- **`Mcost`** — `docs/design/WDR_SCHEMA.md` §3.4 says `N·s/m`, WinISD's own pane says `kg/s`
  (S-2). They are dimensionally identical, so no numeric test separates them; the disagreement is
  in the naming and only the WinISD binary can settle it.
- **`fLe` / `KLe` in `openisd.yml`** — searched the whole `winisd_drivers/db/datasheets` tree;
  no record carries either field, so no `definition:`/`read_value` pair exists to read the scale
  from. The `1` in `SPEC_TO_WDR` is therefore an assumption, not an observation.

## 8. Recommended order of work (not done here — this is a read-only audit)

1. **F1** — make `wprMapping.ts:101` pass m³, and add the first test of `buildWprInput`.
2. **F2** — put the 11 fields into `WDR_META` (or extend `MODELED_SLOTS`), so an edit reaches the
   file and the ParState mark matches the number beside it.
3. **F3** — pass `Rs`, `alfaVC` and `vcTempRise` through `wprMapping.ts` instead of the literals.
4. **F4/F5** — correct the two registry bounds to the unit the comment beside them already names,
   *before* anyone adds the `field=` prop that would activate them.
5. **F8** — bring the six registry `unit:`/`modeled:` strings back in line with the code.
6. A gate in the shape of `driver-editor-units.test.ts` for the `.wpr` writer and the Original
   shell's unit-group bindings would have caught F1 and F4 mechanically.
