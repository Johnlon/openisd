# `.wpr` import discards vent cross-section provenance; re-export can silently overwrite it

## Status
FIXED — both sides, by removing the narrowing that caused the whole class of loss.

## Symptom

A real WinISD-authored `.wpr` states, per vent section, whether its cross-sectional area was
CALCULATED from the diameter (`crosscalc=1`) or ENTERED directly (`crosscalc=0`, the case for a
slot/rectangular port). Importing that file into OpenISD loses this fact unconditionally. If the
imported project is ever re-exported, the written file can state the opposite of what the
original file said — a provenance flag flipped with no user action and no signal.

## Evidence

`packages/winisd/src/winisdProject.ts`'s `readWpr()` (the `.wpr` parser) extracts only three
fields per vent:

```ts
ventFront: {
  dia: numOrAbsent(ventFrontSec, 'dia'), len: numOrAbsent(ventFrontSec, 'len'),
  endCorrection: numOrAbsent(ventFrontSec, 'endCorrection'),
},
```

`crosscalc` and `carea` are never read, and `WprRawParse`'s vent type (`{ dia?, len?,
endCorrection? }`) has no field to carry them even if they were.

`packages/model/src/openisdProject.ts`'s `fromWinISDProject()` — the ONE place a raw `.wpr` parse
becomes a domain record — sets exactly `vent.diameter_m`, `vent.length_m`, `vent.endCorrection`
from the parsed vent and nothing else. There is no line anywhere that sets
`entered.ventCrossArea` (or any provenance) from an import.

On the write side, `packages/ui/src/logic/wprMapping.ts` computes the OUTGOING flag as
`crossCalculated: !P.entered.ventCrossArea` — read straight from OpenISD's own domain state,
never from what a prior import stated. Since import never populates that state, a re-exported
project always writes `crossCalculated: true`, regardless of what the original file said.

The write side's own `WprVent.crossCalculated` doc comment already anticipated half of this
risk ("a slot vent is entered as W×H... hardcoding true would then write a false provenance flag
into a WinISD file with nothing to catch it") but attributed it to OpenISD not yet supporting
slot-vent entry. The actual gap is earlier: the READ side cannot carry the flag through even for
a file OpenISD never touches except to round-trip it.

## Cause

`readWpr()`/`WprRawParse` were built to capture only what `fromWinISDProject()`'s CURRENT
consumers use. `crosscalc`/`carea` were never added because nothing reads them yet — not because
the value doesn't matter.

## Fix

Not applied — scope decision needed. Two parts:

1. `WprRawParse`'s vent shape gains `crossCalculated?: boolean` (and optionally `carea?: number`
   for a value WinISD wrote but did not derive), read by `readWpr()` from `crosscalc`/`carea`.
2. `OpenISDProject.fromWinISDProject()` sets the domain's own entered-provenance for the vent's
   cross-section from that value on import, so a re-export reflects what was actually read.

## Verification

Import a `.wpr` with `[VentRear] crosscalc=0`, re-export without editing the vent, and assert the
written file also states `crosscalc=0`. Today this fails: the re-export always writes `1`.

## Second finding: the write side's flag is dead code, not a live read of provenance

`wprMapping.ts` computes the outgoing flag as `crossCalculated: !P.entered.ventCrossArea`. That
key is never written anywhere in the codebase — confirmed by grep for an assignment to
`entered.ventCrossArea` or `entered['ventCrossArea']` across `packages/ui/src`: zero hits. So
`P.entered.ventCrossArea` is always `undefined`, and `crossCalculated` is always `true`.

This means a design authored ENTIRELY inside OpenISD — no `.wpr` import involved — with a
slotted vent (`vent.shape === 'slotted'`, entered as width × height via the wired `ventW`/`ventH`
fields, `managedProject.ts:715,765`) already exports `crosscalc=1` (calculated), which is false:
a slotted vent's area is BY DEFINITION entered, not derived from a diameter.

The domain object already carries the real signal — `vent.shape`, fully wired end to end
(`OriginalShell.vue`'s width/height inputs → `managedProject.ts:765` → the stored record). The
`entered.ventCrossArea` indirection is unnecessary: the write side should read `vent.shape`
directly instead of a flag nothing sets.

## Revised fix

Write side (fixes today's OpenISD-authored exports immediately, no schema change): replace
`crossCalculated: !P.entered.ventCrossArea` with a derivation from `vent.shape` —
`crossCalculated: vent.shape !== 'slotted'`. Delete the dead `entered.ventCrossArea` read.

Read side (fixes imported-WinISD-file round-tripping): the `.wpr` format itself has no
width/height fields — `WprVent`'s own contract is `dia1 = dia2, round port`, so a slot vent's
actual dimensions are not recoverable from the file. Only the boolean can be recovered:
`WprRawParse`'s vent gains `crossCalculated?: boolean`, read from `crosscalc`, and
`fromWinISDProject()` sets `vent.shape` from it where OpenISD's own shape concept allows —
`'round'` when `crossCalculated` is true, and otherwise the import at least does not claim
`'round'` for a vent the source file says was entered. Reconstructing real `width_m`/`height_m`
for an imported slot vent is out of scope: the file does not state them.


## Fix (applied 2026-08-23)

The root cause was structural: `readWpr()` parsed every key generically, then narrowed the
result into `WprRawParse` — so every key the narrow type did not name was destroyed on read, by
construction. `crosscalc` was one instance; `[Box] Qlr/Qar/Qpr` (chamber losses, read under the
invented key `Ql`) and `Npr` (PR count, read as lowercase `npr`) were two more found in the same
pass — both silently never imported.

Per John's ruling (2026-08-23): one class per format, in/out through it, no side objects.

- `WinISDProject` is now the single in/out object for `.wpr`, exactly as `WinISDDriver` is for
  `.wdr`: a generic section→key→value store that keeps EVERY key on read, `build()` taking the
  file's own vocabulary, `toWpr()` rendering from a template of WinISD's own defaults, and
  `value()`/`number()`/`driverWdrText()` accessors. `WprInput`, `WprRawParse`, `WprVent`,
  `WprBox` and `WprPr` are deleted — with no narrowing type there is nothing to drop into.
- `WinISDDriver` got the same no-drop guarantee: a key it does not know is carried through and
  written back by `toWdr()`.
- The physics moved to the domain: `OpenISDProject.toWinISDProject()` derives box/vent tuning
  from its own record (`wprMapping.ts` deleted), and writes `crosscalc` from `vent.shape` —
  the dead `entered.ventCrossArea` read is gone. `fromWinISDProject` reads `crosscalc` and sets
  `vent.shape = 'slotted'` when the file says the area was entered; the slot's real sides are
  not in the file and are not invented.

## Verification

`packages/model/test/openisdProjectWinIsdMapping.test.ts` "toWinISDProject — the write-side
twin": crosscalc=0 in → crosscalc=0 out, crosscalc=1 stays 1, Qlr/Qar/Qpr round-trip through the
per-chamber keys, phi crosses percent→fraction exactly once, and [PassiveRadiator].Vas
round-trips in m³ (the BUG_20260817 unit, now pinned from both directions). All 12 pass;
winisd + model suites 1356 green; typecheck and lint clean across winisd/model/ui.
