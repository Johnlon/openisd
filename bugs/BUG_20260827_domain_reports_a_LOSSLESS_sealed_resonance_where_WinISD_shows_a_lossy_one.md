# The domain reports a LOSSLESS sealed resonance where WinISD shows a lossy one

**Where:** `packages/design/domain/project.ts`, `OpenISDBox.#sealedResonance_hz()`.

**Status:** FIXED 2026-08-27. INTRODUCED BY ME, 2026-08-27, in commit 4ee14af while wiring the domain to the
engine. John caught it immediately: *"record a bug that you have introduced that its lossless - it
must be lossy"*.

## The defect

```ts
return this.#engine.sealedResonanceFromCompliance(
  LossMode.Lossless,          // <- WRONG
  { Fs_hz, Qts: 0, Sd_m2, Cms_m_per_N: Cms, volume_m3, Ql: ..., Qa: ... },
  air,
);
```

`box.sealed.resonance_hz()` and `bandpass4.chambers.rear.resonance_hz()` return the lossless
`Fs·√(1 + Vas/Vb)`. WinISD displays — and saves into `.wpr`'s `[Box] Fr` — the LOSSY figure.

**The gap is not small and not academic.** Measured on the real binary
(`winisd_research/runs/lossy_fsc_campaign.jsonl`, recorded as FINDING-007): same driver, same
`Vr = 0.006`, only `Ql` differing —

| Ql               | WinISD `fsc` |
| ---------------- | ------------ |
| 10000 (lossless) | 59.94        |
| 5                | 65.74        |

5.8 Hz at one volume. Across nine wizard alignments the lossy/lossless ratio runs 1.030–1.048.

So the number the domain reports is one the user would never see in WinISD, and the same class of
error that was just fixed in the `.wpr` writer
(`BUG_20260827_wpr_export_writes_a_lossless_Fr_while_the_screen_shows_a_lossy_one.md`) — fixed
there and re-introduced here, in the same session.

## Why I wrote it

`sealedResonance(WinisdLossy | ConventionalLossy, …)` needs `Qts`. `packages/design`'s
`SpecSection` declares six fields — `Fs_hz`, `Sd_m2`, `Cms_m_per_N`, `Mmd_kg`, `Rms_Ns_per_m`,
`Xmax_m` — and none of them is `Qts`. Passing `Qts: 0` into a lossy model yields `NaN`, which a
test caught, and I switched the call to `Lossless` because that is the one mode whose `Fsc` does
not read `Qts`.

**That was the wrong move.** It made a test pass by changing what the code claims, and it shipped a
figure that disagrees with the reference implementation. The honest response to "the record cannot
express this" is to fix the record, not to compute a different quantity and report it as if it
were the same one.

## The real cause

`packages/design`'s `SpecSection` is a SKETCH. It was written as an illustrative six-field
placeholder — the comment in it still reads "...one ScrapedField per T/S parameter in that
section" — and never grew into the actual `openisd.yml` spec section it is supposed to model.

John, 2026-08-27: *"this is stupid the design was just a draft and we are building it. You need to
extend the api of the spec section to cover all the fields in SpecSection ... create a reusable
component SpecSection and add fields `.spec.woofer` and `.spec.tweeter` to the OpenIsdDriver -
don't forget that our OpenIsdDriver is modelling openisd.yml"*.

## The fix

1. `SpecSection` becomes a real, reusable component carrying EVERY field the `openisd.yml` spec
   section holds — `Qts` among them — not a six-field sample.
2. `OpenISDDriver` exposes `.spec.woofer` and `.spec.tweeter`.
3. `#sealedResonance_hz` passes the driver's real `Qts` and uses a LOSSY mode.

## Verification when fixed

The domain's sealed resonance must MOVE when `Ql` changes at a fixed volume — that is the property
that distinguishes lossy from lossless, and the property real WinISD demonstrably has. A test
asserting only "greater than Fs" passes under both models and would not have caught this; the
current test suite is exactly that weak, which is why the defect survived to a commit.

## Fixed

`SpecSection` now carries every `openisd.yml` field, `Qts` among them, and
`#sealedResonance_hz` passes the driver's real `Qts` to `LossMode.Default` — which IS
`WinisdLossy` (`engine/lossMode.ts:35`). John's ruling: *"In - default is winisd = Lossy"*.

Guarded by `test/domain.test.ts` → *"the sealed resonance is the LOSSY one — it moves when only
the leakage changes"*: two identical 30-litre boxes, `Ql`=5 against `Ql`=10000, asserted to
disagree. The lossless formula cannot see `Ql`, so it returns one number for both and the test
fails. 329 tests pass.
