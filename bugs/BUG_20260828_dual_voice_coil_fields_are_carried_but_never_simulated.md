# `numVC` / `VCCon` are carried through the whole system and reach no calculation

**Status:** RESOLVED 2026-08-28 — but NOT as a simulation gap. The mechanism is decompiled and
was already in this repo.

## THE MECHANISM — from the binary, `winisd_research/GHIDRA_FINDINGS.md`

> "`edConMode` switching series<->parallel rewrites the driver in place (`0x461242`): 1->2
> multiplies `BL` by `numVC` and `Re` by `numVC^2`; 2->1 divides by the same. No state mark is
> touched, so the E/C/N string does not record that the numbers moved."

```
parallel -> series :  BL *= numVC     Re *= numVC^2
series -> parallel :  BL /= numVC     Re /= numVC^2
```

**It is not a simulation input. It is a ONE-SHOT EDIT of the driver's stored `Re` and `BL`,
performed at the instant the combo changes.** Nothing reads `VCCon` during a sweep — consistent
with the same document's finding that no instruction anywhere writes slot 46's state byte, and
that `numVC`'s only assignment is a hardcoded `'E'` at `0x46121c`.

That single fact explains every result in this file:

* file-seeded `VCCon` did nothing, in six probes, because the field is inert by design;
* the combo moved by arrow key DID change the chart instantly — it had just rewritten `Re`/`BL`;
* set-in-UI + save + restart shows the change, because the NEW `Re`/`BL` were saved;
* `Re *= numVC^2` is exactly the 4x at `numVC=2` measured as 12 ohm -> 48 ohm peak. **That
  measurement was RIGHT and was withdrawn in error.**

## WHAT OPENISD SHOULD DO — and it is not an engine change

There is no per-sweep coil handling to add. The engine is correct as it stands: it simulates
whatever `Re`/`BL` the driver holds. What is missing is the UI ACTION — when the user switches
the connection, rewrite `Re` and `BL` by the factors above.

`numVC` is genuinely inert on its own; it is only the multiplier that action uses. So the
registry line that started this ("OpenISD single-VC only") describes a missing EDITOR FEATURE,
not a missing calculation.

### RULING — TWO FIELDS, and the conversion lives in the file adapter (John, 2026-08-28)

*"make it two"*, and earlier: *"you can do a conversion during wdr/wpr write. dont polute the ui
or engine with bugger code."*

```
Re_per_coil    what the datasheet prints and the user types.  ENTERED, never rewritten.
Re_terminal    derived from Re_per_coil, numVC and the wiring. CALCULATED.
               (same split for BL)

  parallel :  Re_terminal = Re_per_coil / numVC     BL_terminal = BL_per_coil
  series   :  Re_terminal = Re_per_coil * numVC     BL_terminal = BL_per_coil * numVC
```

WinISD's own factors — `Re × numVC²`, `BL × numVC` — are the parallel→series RATIO between those
two states, which is why they appear squared. The physics is identical; only the bookkeeping
differs.

WHERE EACH PART LIVES:

| | |
| --- | --- |
| domain | both fields. Nothing is ever destroyed; the typed value survives every wiring change. |
| engine | UNCHANGED. It receives one effective `Re`/`BL` like any other driver and knows nothing about coils. |
| `.wdr`/`.wpr` writer | emits `Re_terminal`/`BL_terminal`, so the file is byte-compatible with WinISD. |
| `.wdr`/`.wpr` reader | recovers the per-coil values. **This is the hard part — see below.** |

THE READER PROBLEM, which no design removes: a `.wdr` has ONE `Re`, and WinISD's dropdown always
writes `VCCon=1` whatever is selected (`WINISD_PARITY.md` §12). So a file written by WinISD for a
series driver can carry an already-scaled `Re` beside a `VCCon` that says parallel. The file's own
wiring flag cannot be trusted; what CAN be trusted is that the file's `Re` is the EFFECTIVE value.
The reader needs an explicit, documented rule for that, and it is the one genuinely difficult
decision in this change.

### WHY THIS DEVIATES FROM WINISD — deliberately

WinISD multiplies a value the user TYPED by `numVC^2` and leaves it marked `E` (Entered). The
record then asserts the user entered 25.6 ohm when they entered 6.4 and the app quadrupled it.
Numerically nothing is wrong; the provenance is a lie, and this project round-trips and TESTS
`E`/`C`/`N` marks, so a lie there propagates into files and into the parity suite.

**THE CONSTRAINT THAT SHAPES THE FIX.** The obvious clean answer — leave `Re` alone and have the
engine apply the wiring at sweep time — breaks `.wdr` interop. WinISD's file stores the EFFECTIVE
`Re` (already scaled), so a file holding an unscaled per-coil `Re` plus a `VCCon` would be read by
WinISD as a driver with a quarter of the resistance. Compatibility requires storing what WinISD
stores.

So: **store the effective `Re`/`BL` exactly as WinISD does, and mark them CALCULATED, not
Entered.** Same numbers, same file, honest record. The user's own typed value is what it was
before the conversion; after it, the app owns those two fields and should say so.

Consequences worth carrying into any implementation:

* the rewrite is DESTRUCTIVE and unmarked — WinISD does not record that the numbers moved, so
  switching parallel->series->parallel is only lossless because the factors invert exactly;
* it fires on the CHANGE EVENT, so a driver loaded from a file is never re-scaled, whatever the
  file's `VCCon` says. Any OpenISD implementation must match that or it will disagree on load.

## Original symptom


A driver can be recorded as having two voice coils, and wired parallel or series, and **the
simulation is identical either way**. Both fields are stored, round-tripped and displayed; neither
changes a single number on any chart.

For a real dual-voice-coil driver that matters: two 8 Ω coils are 4 Ω in parallel and 16 Ω in
series. Impedance, drive current and therefore SPL all follow from that choice.

## Evidence, verified 2026-08-28

**`numVC` has exactly one mention in the whole engine — its own declaration:**

```
$ grep -rn "numVC" packages/design/engine/*.ts
packages/design/engine/types.ts:61:  numVC?: number;
```

Its own docstring already admits it: *"Voice-coil count. WinISD's default is 1, not absent
(`OpenISDDriver.toDriver()` supplies it) — no consumer in this package reads it yet."*

**`VCCon` never reaches the engine at all.** Every mention is `.wdr` serialisation
(`openisdYamlToWdr.ts`, `openisdDriver.ts`) — the wiring choice is written to file and read back,
and nothing between those two points consumes it.

## SETTLED BY PROBE, 2026-08-28 — WinISD does not simulate them either

`toys/qo96_dvc_probe.py`, data `runs/qo96_dvc/results.jsonl`. Four cases, identical in every
respect except the coil pair, each written DIRECTLY into the `.wpr` (never through the dropdown,
whose save bug is noted below), then loaded, forced to recompute with the two-edit recipe, saved,
and the whole `[Driver]` and `[Box]` block read back at 15 significant digits.

| field | 1 coil / par | 2 coil / par | 2 coil / series | 4 coil / par |
| --- | --- | --- | --- | --- |
| `Re` | 14.1525718647402 | 14.1525718647402 | 14.1525718647402 | 14.1525718647402 |
| `BL` | 6 | 6 | 6 | 6 |
| `Qes` | 0.480456407255705 | 0.480456407255705 | 0.480456407255705 | 0.480456407255705 |
| `Rme` | 2.54813709324311 | 2.54813709324311 | 2.54813709324311 | 2.54813709324311 |
| `USPL` | 102.242878733708 | 102.242878733708 | 102.242878733708 | 102.242878733708 |
| `no` | 0.180345391899866 | 0.180345391899866 | 0.180345391899866 | 0.180345391899866 |
| `SPLmax` | 121.715503711699 | 121.715503711699 | 121.715503711699 | 121.715503711699 |

**The ONLY fields that differ across the four are `numVC` and `VCCon` themselves.** Every derived
value is byte-identical. WinISD stores the coil configuration and computes nothing from it.

So OpenISD MATCHES WinISD, and this is not a divergence. Two coils in series do not double the
impedance in WinISD any more than they do here.

### ⚠ THE 12->48 MEASUREMENT IS IN DOUBT — read this before using the numbers below

A later run (`toys/qo96_law_final.py`, `runs/qo96_law_final/`) reached the SAME nominal state —
same golden, `numVC=2`, combo reading "Parallel", fresh load — and measured the peak at **48 ohm,
not 12**, with the axis PINNED to 0-100 via `settings.ini` so it is a real reading and not an
auto-scale artifact.

Same file, same settings, two different answers. The difference between the runs is TIMING: the
earlier one measured immediately after switching charts, this one waits longer. So the 12 -> 48
transition may have been **stale render -> settled render**, not parallel -> series.

**What still stands on human observation** (John, 2026-08-28): "par ser changes chart instantly",
"MAX POWER IS SENSITIVE TO PAR/SER", "impedance massive change", "numVC has massive effect on the
impedance chart but need to save and restart". WinISD reacts. That is not in question.

**What is NOT established: the LAW.** Six probes have now failed to measure it reliably, and the
one that appeared to succeed is explained equally well by a redraw race. No coefficient should be
implemented from anything below without a better instrument.

**The better instrument, per John's own suggestion: attach a debugger and read the curve arrays
directly**, the way the air pair was captured (`RE_GHIDRA_FINDINGS.md`, LIVE DEBUGGER CAPTURE).
Pixels off an auto-scaling, race-prone chart have now produced six wrong answers; the array is
the ground truth and does not need the UI to have settled.

### CONTROLLED TEST — the harness cannot reproduce the effect at all

`toys/qo96_discriminate.py`, `runs/qo96_disc/`. Everything held still: same golden, `numVC=2`,
impedance axis PINNED in `settings.ini` (the chart does NOT auto-rescale — John, 2026-08-28), a
4-second settle so a stale first frame cannot be measured, no driver-count bump, no combo
interaction. Only the file's `VCCon` differs.

| file `VCCon` | peak | high-frequency asymptote |
| --- | --- | --- |
| 1 (parallel) | 48.5 ohm | 6.5 ohm |
| 2 (series) | 48.5 ohm | 6.5 ohm |

Identical, and the asymptote is the STATED `Re` of 6.4 — i.e. no coil scaling is applied at all.

**This also retires the 12 -> 48 observation.** 12 ohm corresponds to `Re_eff` = 1.6 = `Re/4`, and
it appeared ONLY in a short-settle frame taken before any interaction. A controlled run never
reproduces it. It was a transient, not a state.

**THIS CONTRADICTS DIRECT HUMAN OBSERVATION** (John: "par ser changes chart instantly", "MAX POWER
IS SENSITIVE TO PAR/SER", "impedance massive change"). The observation is the reliable side; the
harness has now been wrong six times and is the thing to doubt.

**The most likely gap: how the value is SET.** Every probe hand-edits the `.wpr` and relaunches.
John changed it in WinISD's own UI, let WinISD save, and restarted. If the app only honours a
value its OWN save wrote — plausible given `WINISD_PARITY.md` §12 already documents its save path
mangling `VCCon` — then every probe here has been exercising a path the app ignores, and no
number produced by any of them means anything.

**Next instrument, not another wine probe:** attach a debugger and read the curve arrays, per
John's suggestion. Pixels off this UI have produced six wrong answers.

### SUPERSEDED — the impedance chart appeared to move by a FACTOR OF FOUR

`toys/qo96_vccon_live.py`, `runs/qo96_vccon_live/`. One driver, `numVC=2`, sealed box, connection
changed from Parallel to Series live, impedance chart read before and after:

| | Parallel | Series |
| --- | --- | --- |
| resonance peak | ~12 ohm | ~48 ohm |
| baseline | ~1.6 ohm | ~6.4 ohm |

Exactly the 4x two coils give when they go from parallel to series. `Maximum Power` did NOT move
in the same run, so the effect is not global to every chart — which is itself worth knowing.

**So OpenISD diverges.** `numVC` has one mention in the engine (its own declaration in
`types.ts:61`) and `VCCon` never reaches the engine at all, so OpenISD renders a dual-voice-coil
driver as though it were single-coil, and silently ignores the wiring the user chose.

### FOUR FAILED PROBES FIRST, and what each one got wrong

Recorded because the failures are more instructive than the result, and because each produced a
CONFIDENT NULL that looked like a finding:

1. **Blank chart.** Seeded from `runs/env_sample7.wpr`, which loads into an error state with an
   empty plot. Every hash was of a blank graph.
2. **Chart never switched.** Searched for a `TComboBox`; this build exposes `LCLComboBox`, and
   the chart selector is not a combo at all — it is the TOOLBAR popup. All captures were the
   same chart while claiming to be three.
3. **Wrong chart.** Menu row offset one row low, so "Impedance" selected *Impedance PHASE* — the
   one chart on which a pure resistance change is invisible.
4. **The control agreed and the app never heard.** The combo was set with `type_text("Series")`,
   which writes the combo's EDIT TEXT without raising a selection-changed event. The readback
   said "Series", which read as proof the input had taken. It had not. Arrow-key selection
   (`VK_DOWN` + Return) fires the notification and the chart moves instantly.

**The lesson worth carrying: a control reading back the value you set is NOT evidence the
application received it.** Assert the OUTPUT changed, never just the input.

### The load path ignores VCCon — `WINISD_PARITY.md` §12 is wrong

`toys/qo96_dvc_charts_probe.py`, `runs/qo96_dvc_charts/`. Same four cases, seeded from
`goldens/sealed-small.wpr` (a complete project WinISD itself wrote, which renders a real curve).

**ESTABLISHED — `numVC` does not change the transfer-function chart.** The plot area hashes
identically across all four cases (`35e4af7e3c9d6814`, 1078 ink pixels), and the input demonstrably
took: with `numVC=1` the "Voice coil connection" combo renders DISABLED, with `numVC=2` it renders
ENABLED. WinISD read the field and changed its UI; the curve did not move.

**NOT ESTABLISHED — the impedance and max-power charts.** Chart selection failed in every run:
this build's chart type is chosen from the TOOLBAR, not a combo (the only two `LCLComboBox`
controls on the main window are the driver-placement count and wiring). All 12 captures are the
same chart. Impedance is exactly where `Re` would show, so the interesting case is still untested.

It states: *"If `VCCon=2` is placed in
the file by hand-editing, WinISD opens it and correctly displays serial connection."* Re-verified
2026-08-28 and this did NOT happen. Case C's seed on disk is `numVC=2 VCCon=2`; the loaded UI shows
"Voice coil connection: **Parallel**" (`runs/qo96_dvc_charts/C_2coil_ser_Transfer.png`).

Consequence: **the VCCon arm of both probes is inconclusive.**

Stating that precisely, because an earlier draft of this file over-claimed it (John, 2026-08-28:
*"YOU HAVE NO EVIDENCE IT NEVER REACHED THE CHARTS AS YOU DIDN'T RUN THE CHARTS"*):

  * What IS evidenced: the combo DISPLAYS "Parallel" for a file that says `VCCon=2`.
  * What is NOT evidenced: that the value failed to reach the simulation. A UI control showing
    the wrong text and an internal value being wrong are two different failures, and only the
    first was observed. The display could be the only thing that is wrong.
  * What was never run at all: the impedance and max-power charts. Only the transfer-function
    chart was ever captured, so no statement about "the charts" is supported — singular or plural.

The earlier wording said the value "never reached the UI" and that the arm "tested nothing". Both
went further than the observation allows.

### What the FIELD probe does NOT prove

It shows no DERIVED, SAVED field moves. It cannot rule out WinISD applying the coil count at
CHART-RENDER time from a value it never persists — the way `nDrivers` scales SPL. `Re` is an
ENTERED field, so it would not be rewritten even if the charts internally used `Re/numVC`.

The evidence against that is decent but indirect: `Rme` and `USPL` are both derived FROM `Re`, and
neither moves, so WinISD's internal `Re` is untouched at derivation time. Settling the chart
question needs an SPL or impedance readout at a fixed frequency across the same four cases.

## Original question, now answered

**Whether WinISD itself simulates them.** `docs/research/WINISD_PARITY.md:251` lists
`Voicecoils/numVC` under "Miscellaneous" without stating either way — unlike `Znom`, which the doc
records as explicitly not-simulated on WinISD's own authority, and unlike the thermal trio, which
WinISD's help marks "not used yet in simulations".

This matters for the fix. If WinISD ignores them too, matching it is a PARITY decision and the
right move may be to say so in the field help rather than to build the model. If WinISD does
simulate them, OpenISD diverges on any DVC driver.

**Settle it by probe, not by reasoning** (`PROBE_METHOD.md` §"PROVENANCE"): enter a driver twice
with identical T/S parameters, once `numVC=1` and once `numVC=2` with `VCCon` parallel, and read
the saved impedance/SPL back. Note the known WinISD save bug first —
`WINISD_PARITY.md:916`: the UI dropdown always writes `VCCon=1`, but a hand-edited `VCCon=2` is
read correctly and preserved, so the probe must set it in the FILE, not through the dropdown.

## Also relevant

A user who enters the driver's Re for the wiring they intend already gets a correct answer — the
fields being inert only bites when someone expects the wiring dropdown to do the arithmetic for
them. That makes this a quiet wrong-answer rather than an obvious failure, which is the worse
kind.

## Fix

Not decided. Depends on the probe above, and on whether OpenISD should exceed WinISD here — the
system already supports N drivers wired series/parallel (`nDrivers`, `wiring` in `SweepParams`),
so the machinery for a wiring-dependent Re exists; it is simply not wired to the per-driver coils.
