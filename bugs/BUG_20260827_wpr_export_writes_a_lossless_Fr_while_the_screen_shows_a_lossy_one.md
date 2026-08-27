# .wpr export writes a LOSSLESS sealed Fr while the screen shows a loss-model Fsc

> **DETERMINED, 2026-08-27, against measured WinISD data: `[Box] Fr` IS THE LOSSY Fsc.**
> WinISD writes the same number it displays, and that number MOVES with the loss model —
> 5.8 Hz for a `Ql` change at fixed volume. openisd's fallback writes the lossless
> `Fs·√(1+Vas/Vb)` instead, which is a value WinISD would never write and the app never showed.
> Evidence and citations under "How this was determined" below. THIS IS NOT A HYPOTHESIS.

**Where:** `packages/model/src/openisdProject.ts:734`, used at `:780` (sealed) and `:789`
(bandpass4 rear).

**Status:** CONFIRMED — cause known, fix known, NOT YET APPLIED.

Reported by John ("seems a bug if not used anywhere except creating wpr"). The question that was
open when this file was first written — what WinISD itself writes into `[Box] Fr` — is now
closed.

## What the code does

```ts
const peak = (driver && curve) ? findImpedancePeak(curve, driver.Re) : null;
const sealedFr = peak ? peak.Fsc : ((driver && sealedFc(driver, Vb)) ?? 0);
...
box.Fr = sealedFr;                    // :780 sealed
box.Fr = sealedFr;                    // :789 bandpass4 rear chamber
```

Two sources, chosen by whether an impedance curve is available:

- **peak present** — `peak.Fsc`, read off the swept impedance curve, so it reflects whatever loss
  model the sweep ran under.
- **peak absent** — `sealedFc(driver, Vb)`, which is `Fs·√(1 + Vas/Vb)`: the LOSSLESS formula,
  with no loss model applied at all.

## Why that is suspect

The screen shows a different number. The box panel reads
`ManagedProject.sealedResonance(lossMode, Rs, Ql, Qa)` (`packages/ui/src/logic/managedProject.ts:534`,
rendered at `OriginalShell.vue:135`), which dispatches on the user's chosen loss mode —
`Lossless`, `ConventionalLossy`, or `WinisdLossy`, the default.

So with the default loss mode and no impedance curve, the exported file states a resonance the
app never displayed.

**The same function already states the principle this violates.** For the VENTED case, thirty
lines below, `:782-784`:

> The record's solved tuning, not a recompute from the length: if BOTH Fb and length are entered
> (allowed), recomputing here would export a tuning contradicting the one on screen. The file is
> plain geometry either way; it should be the geometry the user sees.

The sealed fallback does exactly what that comment forbids for vented.

## How this was determined

No new probe was run, and none was needed: `winisd_research` already holds the measurement from a
prior session, and its own AGENTS.md requires checking the authoritative datasets before
collecting more. Two independent sources agree.

**Direct evidence, `winisd_research/runs/lossy_fsc_campaign.jsonl`.** Two rows, identical driver
(Fs 40, Qts 0.39, Vas 0.00747) and identical `Vr = 0.006`; only `Ql` differs:

| Ql             | UI `fsc` readout | saved `[Box] Fr`    |
| -------------- | ---------------- | ------------------- |
| 10000 (lossless) | 59.94          | 59.9360992579388    |
| 5                | 65.74          | 65.7386151055689    |

Two facts follow directly:

1. **`Fr` mirrors the on-screen `Fsc` readout**, to five decimal places, in both rows.
2. **`Fr` MOVES with the loss model** — 5.8 Hz for a `Ql` change alone, at the same volume. A
   lossless value could not move at all.

**Corroborated independently** by `winisd_research/PROBE_FINDINGS.md` "Finding 3" (2026-08-09),
over nine wizard-created alignments saved to nine `.wpr` files
(`runs/closed_alignments.jsonl`): *"the saved `Fr` is the LOSSY Fsc, not `Fs·√(1+Vas/Vr)`"* —
`Fr / Fc(Vr)` runs 1.030–1.048 across the set, peaking near α≈2, which is the QL=10 leakage
shift those projects carry by default.

**And which loss moves it:** the same finding records that leakage (`Ql`) shifts Fsc up while
absorption (`Qa`) does not.

## Verdict

`sealedFc(driver, Vb)` — the lossless `Fs·√(1+Vas/Vb)` — is the WRONG fallback. It writes a figure
WinISD would never write and the app never displayed.

The peak-based branch (`peak.Fsc`, read off the swept impedance curve) is loss-aware and is the
correct one; the bug is confined to what happens when no curve exists.

## Fix — not yet applied

Replace the fallback with the same loss-model calculation the screen uses:
`sealedResonance(lossMode, { Fs, Qts, Vas, Vb, Ql, Qa, ... })` from `engine/lossMode.ts`, which is
already what `ManagedProject.sealedResonance()` (`packages/ui/src/logic/managedProject.ts:534`)
calls for the box panel. That makes the exported `Fr` and the displayed `Fsc` the same number by
construction, which is the principle the vented branch already states thirty lines below.

**Still open:** how often the fallback fires. `peak` is null when there is no driver or no curve —
the state before a sweep has run — so the practical blast radius is unmeasured.
