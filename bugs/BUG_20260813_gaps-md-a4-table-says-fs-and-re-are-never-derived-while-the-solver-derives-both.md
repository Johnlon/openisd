# `GAPS.md` §A4 says OpenISD "never derives" Fs and Re, while the solver derives both

# Status
FIXED 2026-08-13


**Found** 2026-08-13, while landing QO39/QO40 (`questions.yml` QO40 §"ADJACENT STALENESS FOUND").
**Severity** documentation only — no runtime behaviour. It is recorded because it is the kind of
claim a later agent acts on: A4's stated recommendation is to build a group solver, and two of its
five rows say the group solver does not exist when it does.

## Symptom

`winisd_research/GAPS.md` §A4, the "Cleared / WinISD recomputes / OpenISD" table:

| line | row | claim |
| --- | --- | --- |
| 191 | `Fs` | `never derived — Fs is an input gate` |
| 193 | `Re` | `never derived` |

## What is actually true

Both are derived, in **both** modes of `solveConsistencyGroup`
(`packages/engine/src/driver.ts`), verified by Read on 2026-08-13:

| field | classic mode | full mode |
| --- | --- | --- |
| `Fs` | `:133` from `Mms`+`Cms` | `:167` from `Mms`+`Cms`; `:181` from `Rms`/`Qms`/`Mms`; `:188` from `Qes`/`Bl`/`Mms`/`Re`; `:229` from `no`/`Qes`/`Vas` |
| `Re` | `:136` from `Qes`/`Bl`/`Fs`/`Mms` | `:185` same relation; `:245` from `USPL`/`SPLref` |

The claim is true of exactly ONE path and false of the other, and the two paths are the ones the
app actually uses:

- **`deriveDriver`** rejects a record with no `Fs` or no `Re` (`:346`, `:347`) *before* it reaches
  `solveConsistencyGroup` at `:380`. On that path they are indeed never derived — not because no
  rule exists, but because validation refuses the record first. That is the "input gate" the row
  is describing.
- **The live editor path** never takes it. `Driver#derive()` calls
  `solveConsistencyGroup(entered, { full: true })` directly
  (`packages/winisd/src/driver.ts:426`) and `cell()` reports `'C'` for whatever the solve filled,
  so clearing `Fs` or `Re` in the driver editor does recompute it, marked calculated.

## Fix

Both rows restated per path, with the line citations above. No source file changed.

## Verification

Read of `packages/engine/src/driver.ts` and `packages/winisd/src/driver.ts` at the line numbers
quoted, on 2026-08-13, after that day's edits to `driver.ts`. The line numbers in QO40's original
note (`:145`, `:148`) had already moved by the time this was actioned — they are re-verified here,
not copied.
