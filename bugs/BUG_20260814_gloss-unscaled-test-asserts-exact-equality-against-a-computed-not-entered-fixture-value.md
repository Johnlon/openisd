# BUG — Gloss "unscaled" test asserts exact equality against a WinISD-*computed* value, not the entered one

# Status
OPEN 2026-08-14

## Symptom

`packages/ui/test/ui/driver-editor-units.test.ts`, describe `Gloss — a FRACTION in the file, a
PERCENT on the panel`, it `the .wdr carries the fraction, and the model holds it unscaled`:

```
AssertionError: the parser must not scale — the model holds the file's fraction as written
- 1.72503712771898
+ 1.7250371277189789
```

## Evidence

Fixture: `drivers/sample/winisd/john-all-noncalc-fields-manually-entered.wdr`.

- Line 45: `Gloss=1.72503712771898` — the raw text IS in the file, as the test's first
  assertion (`stored === '1.72503712771898'`) already confirms.
- Line 57: `ParState=CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC` (49 chars).
- Gloss is ParState slot 37 (`packages/winisd/src/parstate.ts` `POS_TO_WDRKEY[37] === 'Gloss'`).
  `ps[37]` is `'C'` — verified by direct index: `'CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC'[37] === 'C'`.

## Cause

`Driver.fromWdr()` (`packages/winisd/src/driver.ts:351-361`) trusts the source ParState exactly,
by design: `const isE = pos < 0 || !ps ? true : ps[pos] === 'E';` — a field marked `C` by its own
source is correctly NOT written into `#inputs`, so `cell('loss')` (`driver.ts:184-195`) correctly
falls through to `fields['loss']`, openisd's own freshly-derived value from this fixture's entered
Rms/Mms/Fs/etc. This is expected: two independent implementations of the same loss formula
(WinISD's C++ and openisd's TS) agreeing to ~14 significant figures and differing in the 15th is
normal floating-point behaviour between two implementations, not a defect.

The fixture's own name — `john-all-noncalc-fields-manually-entered.wdr` — states the intent: every
field that is NOT normally calculated was manually entered. Gloss IS normally calculated, so it was
correctly left for WinISD to compute, and its ParState mark (`C`) correctly reflects that. The test
picked a fixture/field combination where Gloss is legitimately `C`, then asserted the returned value
byte-matches the FILE's stored number as though it were `E` — conflating "is Gloss present as text
in the file" with "is Gloss ENTERED", the exact distinction `driver.ts`'s own comment at line 352-355
warns about ("A present value is not necessarily ENTERED").

`driver.ts` has no bug here — `Driver.fromWdr()` behaves exactly as its own documented contract
states. The defect is the test's assertion, not the code under test.

## Fix

Rewrite the test to assert what it actually needs to prove — no `×100`/`÷100` scaling anywhere in
the parse path — without depending on Gloss being state `E` in this particular fixture:
1. Assert the field's actual state (`'C'` for this fixture), so the fixture's real nature is
   documented rather than silently assumed.
2. Compare the returned value against the file's stored fraction with a relative tolerance wide
   enough for independent-implementation float agreement (matching `winisd-parity.test.ts`'s own
   `REL_TOL = 1e-9`) but far too tight to hide a real 100× scaling bug — which is exactly the
   defect class this test exists to catch.

## Verification

`npx vitest run packages/ui/test/ui/driver-editor-units.test.ts` — green after the fix, 21/21.
