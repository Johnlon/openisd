# `Driver.fromWdr` marks a present carried field Entered, ignoring what the source ParState says

# Status
OPEN 2026-08-14


**Found** 2026-08-14, implementing Step 8 (`WinISDDriver`) and its comprehensive ParState fix —
surfaced by `driver-roundtrip.test.ts`'s "ParState must round-trip identically" test going red
against `drivers/sample/winisd/John-all-manu-populated.wdr` once `Driver.toWdr()` started
reading every slot's mark live from `cell().state` instead of echoing the source's own
ParState for the 34 slots `MODELED_SLOTS` never covered.

## Symptom

Loading `John-all-manu-populated.wdr` and re-exporting flips several carried-metadata slots
from the source's own mark to `E`, even though openisd computed or read nothing new:

    source ParState[29] (alfaVC) = N   →  re-exported = E   (file carries alfaVC=0)
    source ParState[30] (Rt)     = N   →  re-exported = E   (file carries Rt=0)
    source ParState[31] (Ct)     = N   →  re-exported = E   (file carries Ct=0)
    source ParState[38..45]      = N   →  re-exported = E   (Thick/Depth/.../DVol all 0)
    source ParState[37] (Gloss)  = C   →  re-exported = E   (file carries Gloss=1.72503712771898)

## Root cause

`Driver.fromWdr` (`packages/winisd/src/driver.ts`, the `WDR_META` carry loop) enters a numeric
carried field into `#inputs` whenever the raw text is present and parses to a finite number —
`0` included:

    for (const [wdrKey, field] of WDR_META) {
      if (!fromFile.has(wdrKey)) continue;
      const v = raw[wdrKey];
      if (v == null || v === '') continue;
      ...
      d.#inputs[field] = n;                 // unconditional — ignores the source ParState

This is the SAME class of bug as
`bugs/BUG_20260813_parstate-writer-emits-n-for-the-34-slots-the-driver-does-not-model.md`, on
the opposite side of the round-trip: that bug was the WRITER not asking every slot's real
state; this is the READER inventing a state (`E`) for a slot the source file explicitly marked
`N` (unset, WinISD's own `0` default) or `C` (WinISD calculated it, e.g. `Gloss` from
`Fs`/`Xmax`). Only `MODELED_SLOTS` (`fromWdr`'s T/S replay loop) already does this correctly,
consulting `ps[m.pos] === 'E'` when a source ParState exists; the `WDR_META` carry loop for
every OTHER field never looks at the source ParState at all.

## Fix

Gate `WDR_META`'s numeric-field entry by the source ParState exactly like `MODELED_SLOTS`
already does: a key with a `POS_TO_WDRKEY` slot is only entered when that slot reads `E` (or,
with no source ParState at all, presence is the only fallback, matching `MODELED_SLOTS`'
`ps ? ps[m.pos] === 'E' : raw[m.wdrKey] != null`). A key with no slot (`Xlim`, `VCCon`) keeps
presence-based entry — there is no ParState signal to consult for those.

## Consequence

Three genuinely irreducible gaps remain after the fix, all fields WinISD itself calculates by a
route openisd's engine does not implement (motor/leakage geometry, not the T/S set): `KLe`
(ParState[7]), `Hg` (ParState[25]) when WinISD derives it rather than reading it stated, and the
keyless `Xlim` slot (ParState[10], already documented). These are recorded as tolerances in
`driver-roundtrip.test.ts`, not fixed further — there is no formula in `@openisd/engine` for
any of the three, and inventing one is out of this bug's (and Step 8's) scope.
