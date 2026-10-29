# BUG_20261008_vent-pair-both-entered-after-owpr-edit

**Status:** RESOLVED 2026-10-09 (T016)

## Symptom
A `.owpr` file whose record states BOTH a port's tuning and its vent length as `E` loads as two entered values
that disagree (e.g. 44 Hz and a length that needs 22 Hz). Both survive every recalc, a volume change included.
Nothing is flagged and nothing is repaired. Affects all six pairs: vented box, bandpass4 front, bandpass6
rear and front, ABC rear and front. The ABC intra port has no tuning and is not affected.

## Evidence
Checked 2026-10-08, by a throwaway design test (not committed, it would pin the defect): build a project,
enter the tuning, save with `toOwprText()`, edit the text so the length entry is `{"state":"E","value":<twice the implied length>}`
in both `saved` and `edited`, load with `OpenISDProject.fromOwprText`.
- State read back is E/E for all six pairs. Neither side wins: tuning stays as written, length stays as written.
- After `volume_m3.set(...)` both are still E/E and unchanged.
- `packages/design/engine/vent/VentEngine.ts:106,125`: `solve` only writes a side when the other side
  `!entered`, so with both entered it writes neither.
- Normal editing cannot reach this: `pairedField.commitPair` (`packages/design/domain/cell.ts`) writes one side
  and removes the other in one record write.

## Cause
The `.owpr` loader (`openisdSchema.ts`) accepts any pair of entries; nothing enforces "at most one side of a
pair is `E`". Only hand-edited or foreign-written files carry it.

## Fix
John ruled "tuning" (QO178, 2026-10-09). On load, a pair with both sides `E` keeps the tuning entered and loses the length entry, so the solver calculates the length. `packages/design/domain/project/singleEnteredVentPairs.ts`, called from both `.owpr` parsers; the repairing loader lists each dropped length field. Proved by `vent-pair-states.test.ts`, all six pairs.
