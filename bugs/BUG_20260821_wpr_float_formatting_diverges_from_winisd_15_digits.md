Status: OPEN

# `.wpr` writer's `num()` formats floats to JS's ~17 significant digits; WinISD (Delphi) writes ~15

## Symptom

`packages/winisd/src/classic/wpr.ts`'s `num()` formats every non-integer value with
`String(x)`, which gives the shortest decimal that round-trips to the same IEEE-754 double —
typically 16-17 significant digits. WinISD Pro (compiled Delphi, presumably `FloatToStr` or
similar) writes fewer digits, so a value this repo DERIVES (not copied from a golden) will not
byte-match the golden `.wpr` WinISD itself wrote for the same physical input.

## Evidence

`ventArea_m2()` (`packages/model/src/openisdProject.ts:321`, `π·(dia/2)²`) computed for the two
port diameters in the parity corpus:

```
Math.PI * (0.06 / 2) ** 2  → String() → '0.0028274333882308137'
Math.PI * (0.075 / 2) ** 2 → String() → '0.004417864669110647'
```

The corresponding goldens (`packages/winisd/test/fixtures/winisd-parity/goldens/`) carry:

```
vented-small.wpr  [VentRear].carea = 0.00282743338823081     (dia1=0.06)
bandpass4.wpr     [VentFront].carea = 0.00441786466911065    (dia1=0.075)
vented-b4.wpr     [VentRear].carea = 0.00441786466911065     (dia1=0.075)
```

Same divergence on `[Box].Sdfport`/`Sdrport` in the same goldens — those fields carry the
identical `ventArea_m2()` value and already exhibit the mismatch; it just was not caught
because no existing test derives that value and compares it byte-for-byte to a golden (the
existing `SdRear`/`Sdfport` assertions in `wpr.test.ts` feed the golden's own literal back in
as the test's input, so they prove pass-through formatting, not derivation parity).

`vented-small`: golden has 17 chars after `0.`, JS has 19 — JS's tail `...308137` extends past
where the golden's `...30 81` stops, i.e. JS is not simply rounding the same digit string,
it carries two more significant digits WinISD does not emit.

## Cause

Not established. Two candidates, neither traced to a specific Delphi runtime call yet:
1. WinISD formats floats to a fixed ~15 significant digits (Delphi `Extended`'s ~19-digit
   precision truncated by its `FloatToStr`/`Str` default, which is 15 significant digits unless
   overridden).
2. WinISD's own internal float type is `Double` (not `Extended`), so the SOURCE VALUE it holds
   already differs in the low bits from IEEE-754 double `Math.PI * (dia/2)**2` computed in JS,
   and the divergence is a precision difference in the value itself, not only its formatting.

Both need checking against the decompiled help / WINISD_WPR_FILE_SCHEMA.md's own notes on
numeric formatting (if any) before a fix is chosen.

## Impact

Any test asserting golden-derived byte-equality on a value this repo computes (rather than
copies from the golden as a literal) is unsound until this is resolved: it will only pass if
the test feeds the golden's own printed value back in as input, which proves formatting
pass-through, never derivation parity. The three new `wpr.test.ts` golden-equality tests added
for `bugs/BUG_20260821_wpr_writer_zeroes_fb_vb_carea_on_populated_vents.md` do exactly this for
`carea` — see that bug file's note.

Standing rule for future golden-parity tests: derive the test's input FROM THE SCENARIO
(`scenarios.json`'s own driver/box parameters, run through the real engine/model formula), never
from the golden's own output — otherwise the test can only ever prove the writer echoes a
number back unchanged, not that the derivation matches WinISD's.

## Fix

Not fixed — cause not established (see above).

## Verification

N/A — open.
