# `@openisd/engine`'s `C` constant and `winisdDriver.ts`'s `.wdr` default for `c` disagree by 1 ULP-ish (last digit)

# Status
OPEN

## Symptom

Two supposedly-identical WinISD-measured constants for the speed of sound, in two files, differ
in the last decimal digit:

```
packages/engine/src/constants.ts:20:
  export const C   = 343.684120962153;  // speed of sound      m/s     (20 °C — WinISD, full precision)

packages/winisd/src/winisdDriver.ts:92 (NUMERIC_DEFAULTS):
  ['c', 343.684120962152], ['roo', 1.20095217714682],
```

`...962153` vs `...962152`. `roo`/`RHO` (`1.20095217714682` in both files) agrees exactly — only
`c`/`C` disagrees.

## Cause

Not a copy-paste typo — investigated 2026-08-19 and found a genuine conflict between two
sources both claiming to be WinISD ground truth:

1. **`packages/engine/src/air.ts:23-25`**'s own comment: "WinISD's own saved files hold
   `ρ·c² = γ·p` with γ = 1.4 to **1.2e-15** relative (`1.20095217714682 ×
   343.684120962153² = 141855.00000000017`, `1.4 × 101325 = 141855.0` —
   `winisd_research/CALC_FINDINGS_FOR_REVIEW.md`)." This is `constants.ts`'s `...153`, verified
   against the ideal-gas `ρc² = γp` identity to extremely high precision.

2. **`packages/winisd/test/openisdToWdr.test.ts:10-15`**'s own `🔒 ORACLE RULE` (SPEC_ENGINE
   §4.7): "the ONLY oracle is `drivers/sample/winisd/`, prepared by johnl out of WinISD itself.
   An oracle `.wdr` is one WinISD ITSELF wrote." Every fixture there (`inconsistency-test-
   saved-q-3.wdr`, `s-bl.wdr`, `s-dia-natural.wdr`, others) holds `c=343.684120962152` — the
   OTHER value, one digit different, and this is `winisdDriver.ts`'s `...152`.

Both sources are declared, in-repo, as authoritative WinISD-measured values, and they disagree.
`winisd_research/CALC_FINDINGS_FOR_REVIEW.md` was not read as part of this investigation — it
may explain the discrepancy (a different WinISD build/version, a different Advanced-pane state,
rounding in how the finding was transcribed) but that requires actually reading it, not
guessing.

## Fix

**Not applied — this needs a human decision, not an agent pick.** Choosing between two
components each citing their own "this is real WinISD's own value" evidence, backed by
different documents, is exactly the kind of physics-correctness call this project's own oracle
rules exist to gate rather than leave to agent judgement. Whichever value is wrong, the fix
converges on the same shape once decided: make `winisdDriver.ts` import `@openisd/engine`'s `C`
instead of keeping an independent literal (both already agree this is right), and correct
whichever of `constants.ts`/`CALC_FINDINGS_FOR_REVIEW.md`/the `drivers/sample/winisd/` fixture
set is the actual outlier.

## Verification

Not yet — no fix applied. Currently red: `npx vitest run
packages/winisd/test/openisdToWdr.test.ts` — 1/14 fails, "default for c",
`drivers/sample/winisd/*.wdr` vs `constants.ts`'s `C`.
