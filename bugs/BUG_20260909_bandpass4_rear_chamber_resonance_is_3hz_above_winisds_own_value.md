# Bandpass4 rear-chamber resonance is 3 Hz above WinISD's own value

Status: RESOLVED 2026-09-09

## Symptom

For the design in `packages/design/test/winisd/fixtures/winisd-parity/goldens/bandpass4.wpr`
— rear 0.02 m³, front 0.035 m³, front tuning 60 Hz, the shared QO8 test driver — our rear
chamber resonance and WinISD's disagree:

```
bridge rear Fr=61.311243219623286  should be within 0.05 Hz of WinISD's own Fr=58.3392371416399
```

~2.97 Hz, about 5% at 58 Hz. For comparison, the sealed case's known air-model gap
(`BUG_20260907_sealed_resonance_ignores_envUseWinisdAirModel.md`) is ~0.044 Hz — this is roughly
**60× larger**, so the air model does not explain it.

## Example

```ts
// packages/design/domain/openIsdProjectToWinIsdProject.ts:131
const frc = box.bandpass4.chambers.rear.resonance_hz();
if (frc != null) v.Fr = frc;
```

The golden's own `[Box]` block, written by WinISD for the same design:

```
BType=2
Vf=0.035
Ff=60
Qlf=10
Qaf=100
Qpf=100
Vr=0.02
Fr=58.3392371416399
```

Suggestive, not established: a sealed chamber of 0.02 m³ with this driver resonates at
61.2670146589858 Hz — that IS `sealed-small.wpr`'s own Fr, and our bandpass4 rear value
(61.3112…) is within the sealed air-model gap of it. So our bandpass4 rear chamber appears to be
computed as if it were a plain sealed box, while WinISD's 58.34 Hz reflects something the
bandpass geometry contributes. Which term that is has NOT been determined — this needs the
physics checked against `docs/research/WINISD_PARITY.md`, not a guess.

## Impact

Every bandpass4 design exports a rear resonance ~3 Hz high, so a `.wpr` opened in WinISD does not
describe the box the user designed here — and the charts drawn from the same value are wrong by
the same margin.

It went unnoticed because the bandpass4 bridge test asserted only values it had itself fed in
(volumes and front tuning, which the bridge echoes), never the one field WinISD computed. That
tautology is `BUG_20260909_three_wpr_bridge_tests_name_a_golden_in_their_title_but_never_read_it.md`;
fixing it is what exposed this.

## Cause

The bandpass4 rear chamber reused the plain sealed box's private resonance method, which
hardcoded `LossMode.Default` (= `WinisdLossy`):

```ts
// openisdDomain.ts:552, before
resonance_hz: () => this.#sealedResonance_hz(focus(bp4Rear, 'volume_m3').get(), bp4RearLosses),
```

WinISD writes the LOSSLESS `Fs·√(1+Vas/Vr)` for a bandpass4 rear chamber, and the lossy value
for a sealed box. Run on the golden's own driver values:

| mode | Fsc |
|---|---|
| `WinisdLossy` (what we called) | 61.311243219623314 |
| `Lossless` | **58.33923714163979** |
| golden `bandpass4.wpr` `[Box].Fr` | **58.3392371416399** |

13 significant figures, the last digit being the file's own decimal round-trip. Inverting the
lossless formula against WinISD's value gives Vb = 0.019999999999999876 — exactly Vr, so the
front chamber contributes nothing.

The controlled comparison that settles it: `sealed-small.wpr` and `bandpass4.wpr` were written
by the same binary (winisd.exe 0.7.0.0, sha256 `a7dab233…`) 89 seconds apart with the identical
driver, identical Vr=0.02 and identical Qlr=10/Qar=100 (`fixtures/winisd-parity/provenance.json`).
Only `BType` differs:

| golden | BType | Fr | form |
|---|---|---|---|
| `sealed-small.wpr:73` | 0 | 61.2670146589858 | lossy |
| `bandpass4.wpr` `[Box]` | 2 | 58.3392371416399 | lossless |

That is a primary-source observation from two files WinISD itself wrote, not an inference about
its internals.

⚠ unverified: WHY WinISD uses the lossless form here — plausibly because the rear chamber's
damping is already carried by `Qlr`/`Qar`/`Qiclfr` in the bandpass circuit, making `Fr` a
display-only nominal. No source establishes it. Also unverified: whether WinISD's *simulation*
uses the lossless rear resonance or only writes it into the file.

## Fix

`#sealedResonance_hz` takes the loss mode as a parameter (defaulting to `LossMode.Default`, so
the sealed box is unchanged), and the bandpass4 rear passes `LossMode.Lossless`.

## Verification

```
npx vitest run packages/design/test/winisd/openIsdProjectToWinIsdProject.test.ts   5 passed
npx vitest run packages/design                                                     2286 passed
```

The bandpass4 parity assertion that was deliberately left red now passes against WinISD's own
`Fr`, and the sealed case's own golden test still passes on the lossy value — so the two box
types are distinguished rather than one being bent to fit the other.
