# The ParState writer emits `N` for the 34 slots the Driver does not model

**Found** 2026-08-13, bucketing `packages/winisd/test/winisd-parity.test.ts`.
**Severity** wrong provenance written to file. A `.wdr` openisd authors tells WinISD "nothing is
set" for every field openisd calculated.
**Status** OPEN — not fixed here. The fix is the `WinISDDriver` writer,
`docs/plans/OPENISD_TARGET_MIGRATION_PLAN.md` Step 8.

## Symptom

Driver built from the parity scenario `sealed-small` (a `.wdr` with 22 `[Driver]` keys and no
`ParState` line), then re-serialised:

    WinISD   EEEEEEEEEEEEEEEEEECEECCEEECCCEEECCCCECEEEEEEEEEEE
    openisd  EEENEENNEENEEEEEEENENNNNNNNNNNNNNNNNNNNNNNNNNNNNN

openisd emits `N` at 33 slots. Eleven of them are quantities openisd **did** calculate and can
name: slot 18 `Vd`, 21 `Dd`, 22 `no`, 26 `SPLmax`, 27 `SPLmaxLF`, 28 `USPL`, 32 `gamma`,
33 `EBP`, 34 `Rme`, 35 `Mpow`, 37 `Gloss`. WinISD marks every one of them `C`.

Slot 3 (`SPL`) is a separate defect and has its own record
(`bugs/BUG_20260813_wdr-spl-is-discarded-on-import-and-openisd-substitutes-its-own-computed-sensitivity.md`).

## The code

`packages/winisd/src/driver.ts:393-399`

    #buildParState(): string {
      const base = this.#parStateIn && this.#parStateIn.length === PARSTATE_LEN
        ? this.#parStateIn.split('')
        : new Array<string>(PARSTATE_LEN).fill('N');
      for (const m of MODELED_SLOTS) base[m.pos] = this.cell(m.field).state;
      return base.join('');
    }

`MODELED_SLOTS` (`packages/winisd/src/parstate.ts:84-100`) has 15 entries. Every other slot is
whatever the SOURCE file's ParState said, and `N` when the source had none.

## Root cause

The writer has exactly one rule — "copy the input's marks, overwrite the 15 I model" — and no
rule at all for a driver that did not come from a file carrying a ParState. Provenance for the
other 34 slots is not modelled anywhere, so there is nothing to write.

## What the correct rule looks like, from the evidence

Three WinISD-authored files, read directly:

| file | what it is | ParState |
| --- | --- | --- |
| `drivers/sample/winisd/john-all-defaults.wdr` | every key present, all 0, nothing entered | all `N` except slot 23 `E` and slots 47/48 `C` |
| `drivers/sample/winisd/s-gloss.wdr` | `Gloss=1.23` typed, rest 0 | slot 37 `E`, rest `N`/`C` as above |
| the eight parity goldens | 22 keys supplied, WinISD then calculated | `C` at the 11 derived slots, `E` everywhere else |

So WinISD's mark is a property of the VALUE — calculated ⇒ `C`, stated ⇒ `E`, absent ⇒ `N` —
for all 49 slots, exactly as `cell().state` already answers for the 15 modelled ones. The writer
needs the other 34 quantities to answer the same question, which is what Step 8's `WinISDDriver`
is for.

## Why it is not fixed here

`packages/winisd/src/driver.ts` is condemned by `ARCHITECTURE.md` §"`WinISDDriver` is solely a
serialisation device" and carries an explicit "do not extend" header. Building a 49-slot
provenance model inside it would be building it twice. The two defects fixed in this session
(`Gloss` fabrication, discarded `SPL`) are corrections to what it already does; this is new
behaviour it should never gain.

## Consequence for the parity suite, stated plainly

The eight `ParState` rows stay RED until Step 8 lands. They are not loosened, not excluded, and
not covered by a `divergences.json` entry — there is no deliberate difference here, only unbuilt
work, and a red row is the honest report of that.

## Reverified 2026-08-14

All 15 scenarios that have a golden (every scenario except `solve-from-mms-cms`, which has none —
`bugs/BUG_20260813_winisd-will-not-open-the-solve-from-mms-cms-parity-project-so-that-golden-cannot-be-captured.md`)
still fail `ParState` identically. `packages/winisd/src/driver.ts` and `packages/winisd/src/parstate.ts`
are both outside this session's authorised edit area (`packages/winisd/src/classic/` only), so the
fix specified below is left for whoever owns Step 8 / the `WinISDDriver` build:

- Extend `#buildParState()` to loop over every non-null `POS_TO_WDRKEY` slot (not only
  `MODELED_SLOTS`), resolving each slot's Driver field name via
  `MODELED_BY_WDRKEY[wdrKey]?.field ?? WDR_META.find(([k]) => k === wdrKey)?.[1] ?? wdrKey` (the
  same lookup order the fresh-authored path already uses) and setting `base[pos] = cell(field).state`.
  This resolves slots 18 (`Vd`), 21 (`Dd`), 22 (`no`), 24 (`Hc`), 25 (`Hg`), 26 (`SPLmax`),
  27 (`SPLmaxLF`), 28 (`USPL`), 32 (`gamma`), 34 (`Rme`), 35 (`Mpow`), 36 (`Mcost`, partially —
  see below), 37 (`Gloss`), 47 (`c`), 48 (`roo`) — all fields `cell()` already answers correctly
  for value, confirmed by every `DRIVER_FIELDS` test at those keys passing today.
- Slot 33 (`EBP`) needs a further, separate addition: `Driver` has no `EBP` cell at all (the
  parity suite reads it via the engine's standalone `ebp()` function, not `cell()` —
  `winisd-parity.test.ts:266-273`). The loop above cannot fix this slot by itself; `Driver` needs
  an `EBP` cell state of `C` when `Fs` and `Qes` are both determinable, else `N`.
- Even after both of the above, the following slots will legitimately keep differing (openisd
  correctly has no route to them from a synthetic scenario `.wdr` with no ParState line, while
  WinISD's own convention is to mark them `E` with a stub value regardless of the scenario) and
  belong in `divergences.json` as `scenario: "*"` rows, not as further code changes: 6 (`fLe`),
  7 (`KLe`), 10 (`Xlim` — "ParState-only, no WDR key" per this file's own `driver.ts` comment),
  20 and 46 (undentified — no `POS_TO_WDRKEY` mapping exists for either), 29 (`alfaVC`/`tc`),
  30 (`Rt`/`Rth`), 31 (`Ct`/`Cth`), 38–45 (`Thick`/`Depth`/`MagDepth`/`Magnet`/`Basket`/`Outer`/
  `Vcd`/`DVol`) — none of these keys is ever entered by any parity scenario, and none is derived
  by the engine from the T/S set, so `cell()` stays `N` for all 15 goldens regardless of the fix
  above. Measured directly against all 15 goldens today: these 16 slots (plus 6/7/10 already
  named) read `E` in every single one, never `C`, confirming they are WinISD's fixed
  "declined-but-defaulted" convention and not scenario-dependent.
- Slot 36 (`Mcost`) is `C` only for `gap-geometry` (the one scenario with `Hc ≠ Hg`) and `E` for
  the other 14 (`Hc = Hg = 0`, division by zero, matching the `winisdDeclined()` exemption the
  suite already applies to `Mcost`'s VALUE check at `winisd-parity.test.ts:152-156`) — the loop
  fix above correctly yields `N` for those 14 (nothing entered, formula undefined), which still
  will not match WinISD's `E`, and needs its own `divergences.json` row once the loop lands.
