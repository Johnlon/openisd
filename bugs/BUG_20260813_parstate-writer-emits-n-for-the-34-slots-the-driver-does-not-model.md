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
