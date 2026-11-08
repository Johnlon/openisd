# BUG_20261107_radiator-pages-miss-figures-the-datasheet-gives

**Status:** RESOLVED

## Symptom
1. The project's radiator page has no Rms box, so the Rms that gives an ASP190 its Qms cannot be seen or corrected.
2. The New Project wizard's radiator step has only Vas, Qms, Fs, Sd and Xmax, and calculates nothing. Pick SEAS SP22R, press Back: Qms and Fs are empty.
3. A Cms typed in the wizard over a record that states Vas is dropped when the project is created.

## Evidence
- John, 7 Nov 2026: fields must be "on display and editable or calcualedd so that a human can correct any record and all calcualedd fields have all their factors on display"; "don't you need the set on the wizard and the main page".
- Catalogue, 81 radiators: 65 state all seven T/S figures; ASP190 and ASP250 state Rms and no Qms; P173 states neither.

## Cause
1. The page never drew Rms.
2. The wizard's copy of the radiator was never resolved, and `UIFixedField` coloured every value as stated and refused an emptied box.
3. `configurePR` runs `adoptDatasheetFigures` again at creation, on the copy the person edited.

## Fix
- Both pages show Vas, Qms, Fs, Sd, Mms, Cms, Rms and Xmax.
- The wizard adopts the record once, at the pick, then resolves its copy after the pick and after every edit, in the app's air.
- `ProjectBuilder.editedRadiator` takes the copy as it stands. Main-page picks are unchanged.
- Typed is stated. Clearing a box goes back to calculated, or empty if nothing gives it. Two typed figures that contradict each other both stay and both carry the conflict mark, as on the main page.
- A stated Cms is still replaced at the pick when the record states Vas (John's 31 Oct ruling, to match WinISD).
- The Select PR button is blue on desktop as well as phone (John, 7 Nov 2026, QO284: "the select button should be blue at least in the mobile view there is blue").
- WinISD's radiator page has no Rms box. This is a trivial difference, so it gets no difference cue.

## Verification
- `packages/ui/test/hooks/OriginalNewProject-hooks.test.ts`: SP22R, ASP190, ASP250 and P173 records; typed Cms reaches the project; clearing recalculates.
- `packages/design/test/domain/pr-adopt-datasheet-figures.test.ts`: resolving a standalone radiator; the builder keeps what was typed.
- `packages/ui/test/ui/new-project-radiator-eight-figures.browser.spec.ts`: desktop and phone, nothing clipped, no sideways scroll.

## Open: two wizard tests reset in wide local runs
- Seen twice, both in local runs of many specs: `new-project-wizard-walk` (desktop radiator walk) and `new-project-wizard` (one footer on every step), each started within 4 s of the other.
- Page at failure: no dialog, "No projects yet", though the test had opened a project. So the app restarted mid-test, in both workers at once. No console, page or network errors.
- Both pass alone, and both passed in the two GitHub Actions runs of this task. No source file changed in the 25 s window. Cause not found.
