# BUG_20261017_visual-screens-depend-on-the-date

**Status:** FIXED (T260, F48)

## Symptom
After midnight UTC on 17 Oct 2026 the post-land run went red on one visual screen, desktop
tab-project (F48). The only difference was the Project tab's Created and Modified boxes: the baseline
showed 2026-10-16, the new shot 2026-10-17.

## Cause
Two clocks set those dates, and both were the wall clock:
- Modified: the page's own clock, when the app opens the sample project.
- Created: the machine's clock, stamped into both sample projects when the test fixture generator
  writes it (`packages/ui/test/fixtures/generateSample.ts`).

## Fix
One fixed date for the suite, `FIXTURE_DATE` (16 Oct 2026, midday UTC) in
`packages/ui/test/fixtures/sampleProject.ts`:
- the generator dates both sample projects with it (unit test `sample-project-date.test.ts`);
- every visual screen runs on it (`page.clock.setFixedTime`, timers still run).

The baseline was not re-shot and no box is masked. All 53 visual screens pass on 17 Oct against the
16 Oct baselines.
