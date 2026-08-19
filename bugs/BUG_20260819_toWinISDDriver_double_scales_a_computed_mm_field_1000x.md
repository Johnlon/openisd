# `OpenISDDriver.toWinISDDriver()` writes a COMPUTED mm-convention field 1000x too small

# Status
OPEN

## Symptom

`packages/winisd/test/wdr-openisd-round-trip.test.ts` — round-tripping `John-all-manu-populated.wdr`,
`John-all-manu-populated-init.wdr`, and `john-all-noncalc-fields-manually-entered.wdr` through
`WinISDDriver.fromWdrIni(text)` → `OpenISDDriver.fromWinISDDriver(wdr)` →
`driver.toWinISDDriver()` produces `Hg: WinISD 9.982, ours 0.009982` — exactly 1000x too
small — whenever `Hg` (`Hg_mm` in the record) is a COMPUTED (`C`), not entered, value.

## Evidence

```
AssertionError: these are values WinISD calculated and we calculated independently from the
same inputs — a disagreement is a difference in the physics, not in the file format
+ [ 'Hg: WinISD 9.982, ours 0.009982' ]
- []
 ❯ test/wdr-openisd-round-trip.test.ts:160:14
```
3 of 3 fixtures carrying a computed `Hg`/`Hg_mm` fail identically (ratio exactly 1000, i.e.
one spurious `1e-3` factor).

## Cause

`OpenISDDriver.cell(field)` (`packages/model/src/openisdDriver.ts:457-465`) returns two
DIFFERENT unit conventions depending on state:
- **ENTERED** (`entry` present): `winningReading(entry).read_value` — the record's OWN
  convention (millimetres, for an `_mm`-suffixed field like `Hg_mm`).
- **COMPUTED** (`entry` absent): `this.#derived().fields[engineName(field)]` — the ENGINE's
  SI value (metres) directly, with no conversion back to the record's mm convention.

`toWinISDDriver()`'s `SPEC_TO_WDR` loop (`openisdDriver.ts` ~line 268-280, ported verbatim from
the deleted `WinISDDriver.fromOpenISDDriver`) always does `cells.set(wdrKey, { value:
String(c.value * scale), state: c.state })` with `scale = 1e-3` for `Hg_mm`/`Hc_mm`/etc.,
assuming `c.value` is ALWAYS in record (mm) convention. For a COMPUTED `Hg_mm`, `c.value` is
already in SI (metres) — multiplying by `1e-3` again produces a value 1000x too small.

This asymmetry in `cell()` predates this session's refactor (the `SPEC_TO_WDR` scaling loop was
copied verbatim from the pre-existing `WinISDDriver.fromOpenISDDriver`); it was not introduced
by moving the code from `@openisd/winisd` into `@openisd/model`, but the move's test-suite pass
is what surfaced it, since `git stash` back to session start is not usable as a clean baseline
(this session already renamed `WinISDDriver.fromWdr` → `fromWdrIni` and other methods earlier,
so the stashed HEAD state fails to compile against its own tests for unrelated reasons).

## Fix

Not applied — reported per bug-first rule. The correct fix is in `cell()`: the COMPUTED branch
must convert the engine's SI value back to the record's own field-name convention (the inverse
of `TO_ENGINE_SCALE`) before returning it, the same way `enter()`/the ENTERED branch already
implicitly stores/returns record-convention values. `FROM_ENGINE`/`TO_ENGINE_SCALE` already
exist in `openisdDriver.ts` for the opposite direction; the missing piece is applying
`1 / engineScale(field)` (or equivalent) to the derived value in `cell()`'s `C` branch.

## Verification

Not yet — no fix applied.
