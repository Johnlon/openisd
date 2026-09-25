# OpenISD vs WinISD — chart/data gaps and bugs

Source probe: `docs/research/PROBE_W5_SEALED_20260924.md` — real WinISD 0.7 under wine vs
openisd's `Engine.sweep`, every chart, one project (Tang Band W5-1138SMF, 4.48 L sealed).
Probe script: `packages/design/test/scratch-w5.test.ts` (scratch, per
`.claude/rules/ui-test-fixtures.md` it does not belong in the tree long-term).

## John's queries this answers

| Date (2026-09-24) | Quote                                                                                                     |
|--------------------|-------------------------------------------------------------------------------------------------------------|
| 06:56              | "what do you mean openisd correctly use pe_w (of 40)? WinIsd is showing 80w so how is 40 correct?"          |
| 07:02              | "start winisd with a project with distinctive power ... do same with openisd ... what does chat show"       |
| 07:55              | "fix the chart bug"                                                                                          |
| 08:14              | "if you sample some of the wdr files ... compare to the pdf do we were rms or max ... power used"           |
| 09:35              | "peak power if used at all would be a red zone in the charts where damage occurs"                            |
| 10:23              | "it would be a red line I think and a legend entry, maybe a gradient line"                                  |
| 10:26              | "the UI doesn't provide a way to edit it yet ... we need a new tab or a free space on existing tab"          |
| 11:03              | "there is a situation in WinIsd where it writes back a value over the human entered value ... VC ... we deliberately deviated from winisd" |
| 11:09              | "we dont show the terminal value? ... add the max power to the misc field at the bottom"                    |

Max power/max SPL turned out to be an input difference, not a bug: John's WinISD run had
Pe = 80 W, his openisd run had Pe = 40 W. At matched Pe the two agree to 0.03% (max power) and
0.95% (max SPL). Terminal Re/BL (the "VC" write-back John recalled) exist in the model
(`Re_terminal_ohm`, `BL_terminal_Tm`) but the driver editor has no field showing them — that's
the "misc field at the bottom" ask, not yet built.

## Confirmed bugs — open

| Bug doc                                                                                                    | One sentence |
|--------------------------------------------------------------------------------------------------------------|--------------|
| `bugs/BUG_20260924_voice-coil-inductance-affects-impedance-but-not-spl.md`                                   | openisd's default circuit model applies Le to the impedance curve but not the SPL curve; WinISD's one switch applies it to both or neither — pick a model. |
| `bugs/BUG_20260924_sealed-box-leakage-modelled-as-damping-not-a-leak.md`                                     | Raising sealed-box leakage Ql lowers openisd's low-frequency phase/group-delay; WinISD's rises — openisd's leak model is second order, WinISD's is third order. |
| `bugs/BUG_20260924_driver-solve-and-sweep-use-different-air-models.md`                                       | The driver solve and the sweep compute two different speeds of sound / air densities from the same project. |
| `bugs/BUG_20260924_sweep-ignores-options-environment-setting.md`                                             | Options → Environment changes the temperature/humidity/pressure the app displays but not the ones the sweep uses. |
| `bugs/BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl.md`                                       | The transfer-function chart's own 0 dB reference and the sweep's own passband SPL are two different openisd numbers for the same driver sensitivity. |
| `bugs/BUG_20260924_defaulted-fields-are-neither-marked-nor-recorded.md`                                      | `numVC`, vent `count`, and the environment trio show a default value on screen that is never written to the saved record (VCCon already fixed). |
| `bugs/BUG_20260924_model-field-cannot-be-emptied-when-sku-present.md`                                        | The driver editor's Model field displays and clears the sku, not the `model` field it writes — clearing Model does nothing when a sku is present. |

## Confirmed — resolved

| Bug doc | Resolution |
|---|---|
| `bugs/BUG_20260924_inconsistent-inputs-claims-charts-blank.md` | The driver editor's chart-blocking strip listed disagreements between stated values (which don't block a chart) alongside missing values (which do) — split into two strips. |

## Not a bug — noted so it isn't re-investigated

The W5-1138SMF sample driver's own entered values are mutually inconsistent (Fs implies Mms
12.2% off the entered Mms). WinISD and openisd each pick a different consistent subset to
derive from, so their passband SPL (0.92 dB) and resonance (64.9 vs 69.6 Hz) differ. Both
programs are internally correct; the driver record is the problem. The `inconsistent-inputs` DQ
already flags this on the affected fields.

## Open decision for John

WinISD sizes the source EMF from Re+Rg (source resistance included); openisd sizes it from Re
alone. 0.1 dB effect, a real definitional difference, not a bug either way — needs a ruling if
we want to match WinISD's convention.

## Plan of action

1. Voice-coil inductance model — decide: one switch, Le in both curves or neither (matches
   WinISD's own toggle), vs. keep `'winisd'`/`'gyrator'` as two named states. Fix `circuit.ts`,
   correct its comment, add the `Engine.sweep` unit test the bug doc specifies.
2. Sealed-box leakage order — build the constant-`Ral`-at-Fc, leak-subtracts-from-driver model;
   confirm against the WinISD traces (currently `⚠ unverified`); add the unit test.
3. Air model — one `solveEnvironment` call feeding both the driver solve and the sweep; delete
   the two independent `useWinisdAirModel` defaults.
4. Sweep environment fallback — `#sweepParams` reads `envTempK`/`envHumidityPct`/`envPressurePa`
   (the fields, which already fall back to Options → Environment) instead of the raw JSON slot.
   Same root cause as #3 — one session, one commit each or combined.
5. TF-magnitude reference — pick one source for the driver's 1 W/1 m sensitivity (sweep's own
   passband level, or the efficiency formula) and use it for both the driver readout and
   `tfMag`.
6. Defaulted fields — extend the VCCon fix (record-backed, written as `'C'`) to `numVC`, vent
   `count`, and the environment trio; update `docs/FIELD_REFERENCE.md` per the bug doc's ruling.
7. Model field — decide whether Model is user-editable (read/write `model`, sku is a one-time
   placeholder) or sku-derived (make the input read-only, move the mandatory-empty mark to sku).
8. Terminal Re/BL display — add the misc-field readout John asked for (11:09), once the above
   settle so the number it shows is trustworthy.

Each item already has its own unit-test verification spec written in its bug doc — TDD per
`.claude/rules/tdd.md`, RED first, one commit per item.
