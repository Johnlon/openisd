# Three `.wpr` bridge tests name a golden in their title but never read it

Status: PARTIALLY RESOLVED 2026-09-09

## Symptom

```
packages/design/test/winisd/openIsdProjectToWinIsdProject.test.ts
  29:7  error  'VENTED_SMALL_WPR' is assigned a value but never used
  30:7  error  'BANDPASS4_WPR' is assigned a value but never used
  31:7  error  'PASSIVE_RADIATOR_WPR' is assigned a value but never used
```

Three of the four box-type tests announce a golden file in their own titles:

```
vented box: BType=1, rear chamber volume/tuning match vented-small.wpr
bandpass4 box: BType=2, rear (sealed) and front (vented) volumes/tuning match bandpass4.wpr
passive-radiator box: BType=4, [PassiveRadiator] matches passive-radiator.wpr exactly
```

None of them opens the file. Each asserts against numbers written into the test beside the
inputs that produced them:

```ts
const VENTED_VOLUME_M3 = 0.02;
const VENTED_TUNING_HZ = 45;
const project = aProject((p) => p.vented().volume_m3(VENTED_VOLUME_M3).tuning_hz(VENTED_TUNING_HZ).build());
...
assert.ok(text.includes('Vr=0.02'), 'rear chamber volume');
assert.ok(text.includes('Fr=45'), 'rear chamber tuning target');
```

The sealed test, by contrast, does read its golden and compares against a value taken from it.

## Impact

These are the WinISD parity tests — the goldens ARE the oracle, WinISD's own output for the same
design. Asserting that the bridge echoes a number the test just fed it proves only that the value
survived the round trip; it cannot detect the bridge writing a correct-looking but WinISD-
incompatible field, which is the entire failure mode the goldens exist to catch.

Three of the four box types are therefore unverified against WinISD, while their titles state
they are.

## Fix

Each test reads its golden and takes its expected values from the file, as the sealed test does.
Where the bridge legitimately differs from the golden, the tolerance and the reason are stated in
the test (the sealed test's air-model gap is the pattern).

## Verification

All three tests now read their goldens through one helper, `goldenField(file, section, key)`, so
no expected value is transcribed into the test.

```
npx vitest run packages/design/test/winisd/openIsdProjectToWinIsdProject.test.ts
```

That alone did NOT make them oracle checks, and the probe proves it: corrupting a golden's
`Vf=0.035` → `0.099` left all five green. A test that feeds the golden's value in AND asserts it
comes back agrees with itself whatever the file says — the tautology moved rather than went.

The fix that matters is asserting a field WinISD COMPUTED rather than echoed:

| Test | Computed field available | Asserted |
|---|---|---|
| sealed | `[Box] Fr` | yes, already was |
| bandpass4 | `[Box] Fr` (rear resonance) | yes — added, and it FAILED, see below |
| passive-radiator | none: `Vr`, `Fr` and every `[PassiveRadiator]` value are inputs to this fixture | no — nothing in the golden this test does not itself supply |
| vented | none: `Vr` and `Fr` are both inputs | no |

Adding the bandpass4 rear-Fr assertion immediately exposed a real parity defect — our 61.31 Hz
against WinISD's 58.34 Hz — recorded as
`bugs/BUG_20260909_bandpass4_rear_chamber_resonance_is_3hz_above_winisds_own_value.md` and raised
as QO133. That test is left RED rather than given a 3 Hz tolerance.

Still open: the vented and passive-radiator cases have no computed field in their goldens to
check against, so they remain echo tests. Giving them real oracle value needs either a golden
carrying a WinISD-computed quantity for those box types, or a different comparison entirely —
a decision, not a mechanical change.
