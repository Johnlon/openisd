# BUG_20260918_signal-commits-spec-never-navigates-so-de-modal-can-never-exist

Status: RESOLVED (re-verified 2026-09-26) — both tests open a project and assert on the Signal pane.

## Symptom
Both tests in `packages/ui/test/ui/signal-commits-as-blur-notification.browser.spec.ts` fail on
every run: the first locator waits on the driver editor (`.de-modal`) and times out after 2 s.

## Evidence (re-checked right now, isolation run `--workers=1`)
- `bash scripts/test-browser.sh packages/ui/test/ui/signal-commits-as-blur-notification.browser.spec.ts --workers=1`
  → 2 failed, both `TimeoutError: locator.waitFor: Timeout 2000ms exceeded` on `.de-modal`
  (error-context.md confirms).
- The spec body never calls `page.goto(...)` nor `openAProject(page)` — like
  `driver-editor-provenance.browser.spec.ts`, it relies on the editor being present on a
  fresh contact page. Playwright's `use.baseURL` only sets the prefix for `goto`; it does not
  navigate. On `about:blank` there is no `.de-modal`, so the wait can never resolve.
- `playwright.config.js` has no storageState / auto-navigation; `fixtures.ts` navigation is
  test-driven (`page.goto('/')`, `openAProject`).
- Unrelated to commit `2134f56` (which only converted the two fill+Tab pairs to `fillAndCommit`).

## Cause
The spec was authored against a boot state (app loads and opens the driver editor on its own)
that this runner never provided. The blur-commit law it encodes (V is an OUTPUT; blurring a
modified cell notifies) is separately tracked in BUG_20260916_signal-pane-blur-must-notify / QO153
and covered by signal-pane-blur-must-notify.browser.spec.ts, which navigates properly.

## Fix
Give the spec a real page and an open editor before asserting, e.g. `page.goto('/')` then
switching to the Signal pane of the open driver editor (or `driverEditDialog`-style setup), OR
delete the spec as a duplicate of signal-pane-blur-must-notify per a human ruling — it must not
stay in its current never-runnable state.

## Verification
Both tests green on a standalone run, or the file removed after a human ruling on the duplicate
question.