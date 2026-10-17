# BUG_20261017_post-land-never-closes-a-fixed-f

**Status:** FIXED (T295)

## Symptom
On 17 Oct, F51 stayed open after main was green on GitHub Actions at 1cab899cf0. land.sh refused every
landing that was not labelled fixes, so bob, maryu and two of fable's agents were blocked until someone
closed F51 by hand in a fixes landing. The same had happened with F48, F49 and F50.

## Cause
On a green, post-land recorded the last green and stopped. Only a person closed an F.

## Fix
On a green, `close_fixed` in `scripts/land/post-land/run.sh` closes each open F whose red commits (`sha:`
and every `also_red` `sha:`) are all in the tested commit's history. It sets `status: done`, adds a
`closed_note` naming the green, and pushes the close to main with the same race retry as a red. An F with
no sha (an infra F) stays open. A failed push of the close leaves the run green.

Test: `scripts/land/test/post-land-red-base.test.sh` case 5. A red, then a green on top: the F is
closed. An F with a red sha outside the history stays open, and so does an infra F.

## Also fixed here: the F's failing list named every spec
F52's `failing:` list held about 200 lines, mostly passing tests. T254's per-test `TEST START`/`TEST END`
markers match the spec-name pattern, Playwright's list reporter can run a marker onto the end of a ✘
line, and vitest's FAIL line kept its colour codes. The markers and colour codes are now removed before
the match (test: case 4, "the F lists only the failing specs").
