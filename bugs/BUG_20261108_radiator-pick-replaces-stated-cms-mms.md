# BUG_20261108_radiator-pick-replaces-stated-cms-mms

**Status:** RESOLVED

## Symptom
Picking a bundled passive radiator throws away the Cms, Mms and Rms its datasheet states and shows
ones worked out from Vas, Fs and Qms instead. Accuton P173 on test (v20261107T2344Z): the datasheet
says Cms 1.01 mm/N and Mms 15 g; the wizard and the project page show Cms 1.0011 and Mms 15.05,
calculated (blue).

## Ruling
John, QO451, chat 8 Nov 2026: "a stated 1.01 should not get replaced by other numbers". Choice A:
a stated figure stays as stated; when stated pairs disagree, the conflict mark by the boxes says
so. This replaces the 31 Oct pick table in `bugs/archive/BUG_20261031_phone-pr-p173-cms-display.md`.

## Cause
`adoptDatasheetFigures` cleared Cms when the record stated Vas, Mms when it stated Fs, and Rms
when it stated Qms, so the project's resolve recalculated them (the 31 Oct table).

## Fix (T713)
- `adoptDatasheetFigures` keeps every stated figure; it only turns an Xlim into Xmax.
- Rms is kept the same way as Cms and Mms: the ruling covers any stated figure.
- Stated pairs past their rounding carry the conflict mark (existing check). P173's Cms 1.01 and
  Vas 24 L agree within their rounding, so neither is marked.
- A Vas typed over a kept Cms marks both; clearing Cms lets Vas drive the radiator again (the
  5 Oct 2026 "PR Vas is disconnected" ruling: the edit is never silent).
- The ≠W cue on Mms and Cms now says charts differ when a datasheet's Mms or Cms disagrees with its
  Fs or Vas.

## WinISD
WinISD has no Mms or Cms on its radiator tab: it works them out from Vas and Fs. A different
calculation by John's choice, no switch. Recorded in `docs/research/WINISD_PARITY.md` and
`docs/research/ACCURACY_IMPROVEMENTS.md`.

## Tests
- `packages/design/test/domain/pr-adopt-datasheet-figures.test.ts`
- `packages/ui/test/ui/new-project-radiator-eight-figures.browser.spec.ts` (P173, both skins, wizard and project)
