# P173: Cms looked missing on the phone passive-radiator tab

## Report

On the `test.openisd.app` phone UI, Accuton P173 appeared not to show its Cms value.

## What was actually on screen (John's screenshot, 31 Oct 2026)

Cms was there: 1.0011 mm/N, blue (calculated). Mms 15.05 g, blue. Qms empty.
A ⚠ sat on Qms, Mms and Cms. The ⚠ on Cms read as "Cms has a problem"; that is the report.

## Cause

P173's record has no Qms and no Rms (the datasheet prints 0 for both; the importer rejects
them). Rms = √(Mms/Cms)/Qms cannot be worked out. The "can't calculate" ⚠ marks every field
in that formula, so Mms and Cms get it although both have values. Only Qms is actually missing.

Reproduced in a unit test (`packages/design/test/domain/zz-p173-probe.test.ts`, T628): after
`configurePR(P173)`, Cms = 0.0010011 with dq `missing-dependencies`; Rms null.

## Generic bugs found (none is P173-specific)

1. **E→C flip on pick.** `OpenIsdPassiveRadiatorSpec.deriveFromWinisdFigures` copies a record's
   Mms, Cms, Rms as entered, then flips them to calculated when Fs, Vas, Sd can give them. The
   datasheet figures are overwritten. John, 31 Oct 2026: "which is a bug btw"; "remove the evil
   C-E".
2. **"Can't calculate" ⚠ on boxes that have values.** `PrEngine.firstMissing` lists every field
   of the formula in `fields`, not only the missing ones. Shared code; drivers may do the same.
3. **Unknown Rms is quietly 0.** `PassiveRadiatorBox` uses `P.prRms || 0`: a radiator with no
   Qms is modelled lossless and nothing on screen says so.
4. **Air "not available" is accepted** by `resolve`/`solveSpec` and blanks values. John, 31 Oct
   2026: "it is impossibl for air to be absent"; "this is illegal state - sw error". Separate
   bug file and task.

## Rulings (John, 31 Oct 2026)

- Fix in T628 and land on main (T607 is already shipped in T618).
- No E→C step. On pick, each mechanical figure is either copied as entered or left out (N):

  | Figure | Left out when the record has | Otherwise   |
  |--------|------------------------------|-------------|
  | Cms    | Vas                          | kept, E     |
  | Mms    | Fs                           | kept, E     |
  | Rms    | Qms                          | kept, E     |

  Resolve fills the left-out ones as calculated. Same screen as today; nothing flips.
  Editing Vas still moves Cms (ruling of 5 Oct 2026, "PR Vas is disconnected", holds).
- The "can't calculate" ⚠ goes only on the empty box. For P173: Qms only. Its text says Rms is
  unknown, so the charts assume no losses until a Qms is typed. Same fix for drivers.
- Unknown Rms: keep drawing the charts as lossless, with that ⚠ on Qms.
- Phone: no Rms row, as WinISD.

## Facts

- 80 bundled radiators: 67 state Qms and Rms, 9 Qms only, 0 Rms only, 4 neither (P173 is one).
- A radiator's four independent figures: Sd, plus one of each pair Vas/Cms, Fs/Mms, Qms/Rms.
- The flip was added 3 Oct 2026 (`c873907de`) with no reason in the commit message.

## Work (T628, 31 Oct 2026)

- Bug 1 fixed: `deriveFromWinisdFigures` removed; `adoptDatasheetFigures` drops Cms, Mms, Rms
  on pick when the record states Vas, Fs, Qms. Test: `pr-adopt-datasheet-figures.test.ts`.
- Bug 2 fixed: `missingDependencies.fields` is the target plus the missing inputs only; the PR
  Rms route adds "Until then the charts take the radiator as lossless." Driver marks change the
  same way (a Qts needing Qms no longer marks a stated Qes).
- Bug 3 (lossless by default) is covered by that sentence on the Qms warning.
- Bug 4 (air "not available"): own bug file, not in T628.
