# JS UI testing rules — Vue components and Playwright

## The gate

Any change to a Vue component, template, CSS, store, or engine wiring → run `npx playwright test` before claiming it works. A UI change that renames a control, changes a binding, or alters a selector can silently break tests; the only way to know is to run them.

## Playwright fixture — mandatory

Every `packages/ui/test/*.browser.spec.js` **MUST** import `test`/`expect` from `packages/ui/test/fixtures.js`, NOT from `@playwright/test`. That module's `browserLog` auto-fixture runs for every test and:

- Captures `page.on('console', …)` errors + warnings (Vue emits `Duplicate keys found`, injection warnings, etc. as `warning`), `pageerror` uncaught exceptions, and failed/4xx/5xx same-origin (`localhost`) requests. External sources (github.com) are excluded.
- At teardown asserts every collector is empty — a green DOM assertion alone is NOT enough.
- On failure attaches the full console + network capture to the report.

Importing from `fixtures.js` is the whole contract — no per-test boilerplate. A test may call `browserLog.reset()` (add `browserLog` to its args) after initial navigation to re-baseline.

## Condition waits

Use `page.waitForFunction()`, never `page.waitForTimeout()` — the ESLint playwright rule forbids it and it makes tests flaky.

## Drive the bug into view

Drive the app into the state that makes a bug render — a check that never renders the broken state cannot see it. Example: `driver-search.browser.spec.js` searches a duplicate-named driver to force the key-collision the console check then catches.

## Post-deploy smoke test

After every `npm run build` or change handed to the user as "ready to check" — run all four steps before saying done:

1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/` → must be 200.
2. Confirm no `[vite] error` lines in the server output.
3. Use `mcp__claude-in-chrome__*` to visually confirm the changed element is present and correct — do not rely on source-file grep alone.
4. Inspect browser Console AND HTTP/Network logs. Read console errors, Vue warnings (duplicate keys, unhandled rejections), and failed same-origin network requests **first** before drawing any conclusion about probable cause. A passing DOM assertion is NOT enough — a `Duplicate keys found` warning can silently corrupt list rendering while the DOM looks fine.

Never say "it should work now — please check" without completing all four steps.

## Red→green TDD cycle

Same as JS core: write failing test first, watch it fail, fix, watch it pass, run full suite.

## Visual regression — SPL canvas

`test/visual.browser.spec.js` takes pixel-exact screenshots of the SPL graph panel for all four box types and compares against committed baselines in `test/visual.browser.spec.js-snapshots/`.

Run: `npm run test:visual`

Regenerate baselines only for intentional visual changes (CSS, layout, curve styling):

```
npm run test:visual -- --update-snapshots
```

Review with `git diff` to confirm only the intended panels changed, then commit the new PNGs.

**Do NOT regenerate** to paper over a failing test caused by a physics or engine change — investigate the cause first.

## micka.de oracle tests

`test/scenarios.js` is the source of truth for every UI test case. Each scenario defines driver/box inputs AND both tools' expected outputs (Resonate stat-bar values and micka.de table values).

Run `npm run test:crosscheck` when:

- Adding a new scenario to `scenarios.js`.
- Changing a formula in `packages/engine/src/` to re-validate frozen expected values.
- **NOT in normal CI** — these tests hit an external site and are slow (~15s each).

**SOP for a new test case:**

1. Add a scenario to `test/scenarios.js` with `driver:` and `box:` filled in; leave `micka:` and `resonate:` blank.
2. Run `npm run test:crosscheck` — read what micka.de reports and fill in `micka:`.
3. Map micka's values to Resonate's display format (apply the same `toFixed` precision the stat bar uses) and fill in `resonate:`.
4. Add the Resonate UI wiring test to `test/app.browser.spec.js` using the frozen `resonate:` values.
5. Commit. `npm run test:crosscheck` does not run in CI.
