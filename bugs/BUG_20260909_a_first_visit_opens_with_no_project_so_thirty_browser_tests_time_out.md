# A first visit opens with no project, so thirty browser tests time out

Status: OPEN

## Symptom

`npx playwright test --workers=1` — 30 tests across four specs fail, every one of them in
`beforeEach`, with the same timeout:

```
Test timeout of 60000ms exceeded while running "beforeEach" hook.
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('.project-nav li').filter({ hasText: 'Driver' })
```

The page snapshot captured at the timeout shows what is actually on screen:

```yaml
- generic [ref=e3]:
  - paragraph [ref=e4]: No project is open.
  - button "Start a new project" [ref=e5] [cursor=pointer]
```

Failing specs, by count of failing tests:

| Spec | Tests |
|---|---|
| `packages/ui/test/logic/driver-editor-mandatory-*.browser.spec.ts` | 11 |
| `packages/ui/test/logic/driver-editor-solver.browser.spec.ts` | 10 |
| `packages/ui/test/logic/driver-editor-provenance.browser.spec.ts` | 6 |
| `packages/ui/test/logic/consistency-dq.browser.spec.ts` | 3 |

## Example

```ts
// packages/ui/test/logic/driver-editor-solver.browser.spec.ts:32
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');

  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
```

`localStorage.clear()` then reload is a first-visit simulation. On a first visit the app now
renders the empty state, so `.project-nav` — which only exists once a project is open — never
appears, and the click waits out the full 60 s. Each test then retries once, so the suite
spends roughly two minutes per failing test.

## Impact

Every driver-editor browser test is dead: the solver suite, the mandatory-field suite, the
provenance suite, and the data-quality suite. Those are the functional tests that prove the
editor's wiring reaches the DOM at all — exactly the layer `AGENTS.md` requires a browser test
for. They are currently proving nothing while looking like a red suite with one cause.

It also makes the full browser suite take over an hour instead of minutes, because 30 tests
each burn 2 × 60 s of timeout.

## Cause

The app is behaving as ruled; the specs were never updated to match.

`packages/ui/test/logic/no-seed-project.test.ts` records the ruling verbatim — John,
2026-09-08: *"there is either selected project or not selected project"*, *"there is only
focusedProject() which is nullable - thats it"* — and asserts `focusedProject()` is null at
startup with no `seedProject` / `openBlankProject` export.

`App.vue:52` `onMounted` matches that: it restores from the share-link hash, or failing that
applies view preferences only. Nothing creates a project. So after `localStorage.clear()` and
a reload there is no project, and `App.vue:78`'s `v-if="project"` renders the empty state
instead of the shell.

The 15 failing specs each open with the same three lines and then wait for an element that
lives INSIDE that `v-if`:

```ts
await page.goto('/');
await page.evaluate(() => localStorage.clear());
await page.goto('/');
await page.locator('.original-root').waitFor({ state: 'visible' });   // inside v-if="project"
```

`.original-root` and `.project-nav` are both inside the gate, so neither can ever appear on
that path. The specs predate the no-seed ruling and assume a fresh load yields a shell.

## Fix

Each affected spec opens a project explicitly after clearing storage, the way the empty
state's own recovery action does and the way `original-skin.browser.spec.ts:1166` already
drives it:

```ts
await page.locator('.no-project-open button', { hasText: 'Start a new project' }).click();
```

That is a change to test setup to match a ruled behaviour, not a loosened assertion — the
tests' own subjects (the solver, the mandatory-field rules, the tune panel, the driver
picker) are unchanged and still asserted against a real shell.

## Verification

Reproduced by `npx playwright test --workers=1`; 60 result directories under `test-results/`
(30 tests × original + retry).
