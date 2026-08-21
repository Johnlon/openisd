Status: OPEN

# New Project invents box volumes, tunings and vent geometry that WinISD DERIVES from driver + box type + alignment

## Symptom

OpenISD creates a project by writing literal box volumes, a bandpass front tuning and a 50 mm
vent into every alignment at once. WinISD asks the user to choose the alignment, then the box
size and tuning FOR THAT ALIGNMENT, and derives the vent length from what they entered.

The values OpenISD invents are also wrong against WinISD's own: the vent is 50 mm where WinISD
uses 4″ (102 mm), and vent LENGTH is stated as an independent value where WinISD computes it
read-only from volume + tuning + diameter + end correction.

## Evidence

`packages/model/src/openisdProject.ts`, `prototypeBox()`:

```ts
const vent = prototypeVent();
const ventedFb = tuningFromLength(0.030, vent.length_m, Math.PI * (vent.diameter_m / 2) ** 2, vent.endCorrection);
return {
  active: 'vented',
  sealed: { volume_m3: 0.030 },
  vented: { volume_m3: 0.030, Fb_hz: ventedFb, vent },
  bandpass4: { rearVolume_m3: 0.020, frontVolume_m3: 0.015, Ff_hz: 60, frontVent: prototypeVent() },
  passiveRadiator: { volume_m3: 0.040, Fp_hz: 0, count: 1, addedMass_kg: 0 },
  Ql: 10, Qa: 100, Qp: 100,
};
```

and `prototypeVent()`:

```ts
return { shape: 'round', diameter_m: 0.05, width_m: 0.10, height_m: 0.05,
         length_m: 0.10, endCorrection: 0.732 };
```

Invented, with no user input and no source: `0.030` m³ sealed, `0.030` m³ vented, `0.020`/`0.015`
m³ bandpass chambers, `Ff_hz: 60`, `0.040` m³ PR, `count: 1`, and the whole vent — 50 mm
diameter, 100 mm length, 100×50 mm slot dimensions.

**What WinISD does instead** (John, 2026-08-21):

**WinISD CALCULATES the box volume and tuning from three inputs — (1) driver type, (2) box
type, (3) alignment (QB3, BB4, …).** These are the classic Thiele/Small alignment tables: given
the driver's `Qts`/`Vas`/`Fs` and a named alignment, `Vb` and `Fb` FOLLOW. The user chooses the
alignment; the numbers are derived from the driver in front of them.

In the New Project wizard:

1. The user SELECTS an alignment. One alignment is configured, not four.
2. Box size and tuning are then CALCULATED for that alignment and that driver — they are not
   literals, and they differ per alignment.
3. The vent is **4 in (10.2 cm)** diameter, end correction **0.732**.
4. Vent **length is READ-ONLY** — calculated from the volume, tuning, diameter and end
   correction.

So the gap is not "we should ask the user for a volume". It is that **OpenISD has no
alignment-driven box sizing at all**, and `prototypeBox()`'s literals stand in for a whole
missing feature: a driver-and-alignment → `Vb`/`Fb` calculation.

Two of these OpenISD gets backwards. `endCorrection: 0.732` matches. `diameter_m: 0.05` does
not — WinISD's is 0.102. And `length_m: 0.10` is stated as an independent input, then
`prototypeBox` runs `tuningFromLength(...)` to derive `Fb` FROM the length — the inverse of
WinISD, which derives length from tuning.

The comment defends the direction it chose ("a derived value, not an independent literal, so the
default design cannot state a vent and a tuning that disagree") — internally consistent, but it
solves for the wrong unknown: the length is the output in WinISD, not the input.

## Cause

There is no New Project wizard. `prototypeBox()` has to return a complete, simulatable box with
no user input, so it invents one for every alignment simultaneously. The invented values are
plausible, so nothing has flagged them.

## Fix

Not fixed — this is a FEATURE GAP, not a small correction, and it is recorded for the backlog
rather than patched:

- Alignment-driven box sizing: given the driver's T/S and a named alignment (QB3, BB4, SBB4,
  C4, …), CALCULATE `Vb` and `Fb`. This is the missing feature; the wizard is its UI.
- A New Project flow that asks for driver type → box type → alignment, then shows the
  calculated volume and tuning, and builds ONLY the chosen alignment.
- Vent length becomes DERIVED and read-only, from volume + tuning + diameter + end correction,
  matching WinISD. `tuningFromLength` stays for the reverse direction where the user does enter
  a length; the DEFAULT direction inverts.
- The default vent diameter becomes 0.102 m (4″), WinISD's own.
**Partially applied 2026-08-21 (John's ruling): the invented literals are GONE.** Every value
`prototypeBox()`/`prototypeVent()` used to state is now `0` — this codebase's unset marker —
with a `TODO(box-wizard)` comment on each line naming what will supply it. A new project is
therefore visibly unsized rather than plausibly-but-wrongly sized. The FEATURE (alignment-driven
sizing) is still missing; only the fabrication is fixed.

`Ql: 10, Qa: 100, Qp: 100` STAY and are not fabricated: WinISD itself writes those three —
verified in `packages/winisd/test/fixtures/winisd-parity/goldens/bandpass4.wpr:69` (`Qlf=10`,
`Qaf=100`, `Qpf=100`). The citation is now in the code beside them.

Also deleted: the comment `/** A vent with WinISD's own defaults: round, 5 cm, one-flanged end
correction. */`. 5 cm was never WinISD's — it was invented, and the comment asserted a source
that did not exist. Only the 0.732 in that sentence was right, and by coincidence.

Note this interacts with the entered/calculated model: with length derived, `ventL` must read
CALCULATED rather than ENTERED on a new project, and `Fb` must read ENTERED.

## The apparent contradiction with BACKLOG.md — RESOLVED

`BACKLOG.md` E.2 (b) says "WinISD has no alignment tool, ruled out three ways. OpenISD is ahead
here". That and the account above are BOTH true, of different places (John, 2026-08-21):

- **WinISD HAS alignment selection in the New Project wizard** — at creation time, where it
  drives the initial box volume and tuning.
- **WinISD has NO alignment tool inside an open project** — you cannot re-apply QB3/BB4 to a
  design you are already editing.

So E.2 (b)'s claim holds for the in-project case and OpenISD's in-project alignment buttons do
stay. What OpenISD lacks is the CREATION-time half.

**OpenISD can have both**, and should: alignment-driven initialisation at project creation
(this bug), AND the in-project alignment tool it already has (which WinISD lacks). E.2 (b)
should be narrowed to say "no in-project alignment tool" rather than "no alignment tool",
because as written it reads as covering the wizard too.

## Reverse-engineering required before building this

How WinISD initialises a project's attributes from the wizard's selections is NOT known and must
not be guessed. Run the wine harness (`winisd_research/`, per `WINE_HARNESS.md`) over the New
Project wizard and record, for a FIXED driver:

1. every alignment the wizard offers, per box type;
2. for each (driver, box type, alignment) triple: the resulting `Vb`, `Fb`, and — for bandpass —
   both chamber volumes and the front tuning;
3. the vent it initialises (diameter, end correction, and whether length is read-only);
4. which fields the wizard marks ENTERED vs CALCULATED afterwards, read from the saved `.wpr`
   and its ParState.

5. **The PASSIVE-RADIATOR arm.** WinISD's wizard asks for the PR's own `Vas`/`Qms`/`Fs`/`Sd`/
   `Xmax`, and states it can calculate alignments FOR A PR (John, 2026-08-21). So the PR is a
   second input to the alignment calculation, not just an output: probe how `Vb` and `Fp` come
   out for a fixed driver across several PR parameter sets, and record which PR alignments the
   wizard offers.

Vary the driver across at least three distinct `Qts` values, since the alignment tables are
functions of `Qts`/`Vas`/`Fs` — one driver cannot separate "computed from the driver" from
"a constant for that alignment". Vary the PR similarly for the PR arm.

**OpenISD's PR step goes further than WinISD's**: WinISD only takes typed PR parameters, whereas
OpenISD should offer EITHER selecting a PR from its library OR entering one from scratch — the
same choice its driver step gives. The alignment calculation behind both is identical; only the
input path differs.

The output is a matrix in `winisd_research/runs/`, in the same style as the c/roo probe matrix,
which then pins the formulas. Do NOT implement from a textbook alignment table and assume WinISD
agrees — the point is parity with WinISD, and its own values are the oracle.

## Verification

N/A — open. Afterwards: creating a project asks the user for the alignment and its size/tuning;
the vent length field is read-only and its value follows from the entered tuning; and no
alignment the user did not choose carries invented dimensions.
