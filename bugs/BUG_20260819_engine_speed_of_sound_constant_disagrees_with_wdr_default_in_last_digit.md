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

Not investigated — two independent transcriptions of the same WinISD-measured value, likely
copy-pasted from different sources/sessions, one of which has a typo or rounding difference in
the last digit. Given `deriveOpenISDFields` (`packages/model/src/openisdDerive.ts:45`) uses the
engine's `C` for any driver whose `c` was never entered, while `WinISDDriver`'s
`NUMERIC_DEFAULTS` uses the other value for a `.wdr`'s own unwritten-key default, a driver's
displayed `c` (via `OpenISDDriver.cell('c')`) and the same driver's exported `.wdr` `c=` line
can genuinely disagree by 1e-12 relative — currently masked in tests only because no existing
assertion compares the two constants directly against each other.

## Fix

Not applied — reported per bug-first rule. Pick the correct value (re-derive from the original
WinISD probe evidence, not a guess) and make one of the two files import the other's constant
rather than keep two independent literals — `winisdDriver.ts` importing `@openisd/engine`'s `C`
would be the natural fix given `winisd` already depends on `@openisd/engine`.

## Verification

Not yet — no fix applied.
