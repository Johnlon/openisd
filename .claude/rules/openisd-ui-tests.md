---
paths:
  - "packages/ui/src/**/*"
  - "packages/ui/test/**/*"
---

# openisd — UI test rules, Vue and Playwright

## The gate

Any change to a Vue component, template, CSS, store, or engine wiring → run
`npx playwright test` before claiming it works. A change that renames a control, alters a
binding, or moves a selector can silently break tests; running them is the only way to know.
The suites and the commands around them are in `openisd/AGENTS.md`
§"Quality gates — non-negotiable".

## Playwright fixture — mandatory

Every `packages/ui/test/**/*.browser.spec.ts` **MUST** import `test`/`expect` from
`packages/ui/test/fixtures.ts` (specifier `'../fixtures.js'` from a spec subdirectory), not
from `@playwright/test`. That module's `browserLog` auto-fixture runs for every test and:

- captures `page.on('console', …)` errors and warnings (Vue emits `Duplicate keys found`,
  injection warnings and the like as `warning`), `pageerror` uncaught exceptions, and
  failed/4xx/5xx same-origin (`localhost`) requests — external sources such as github.com and
  `net::ERR_ABORTED` cancellations are excluded;
- asserts at teardown that four categories are empty — console errors, uncaught page errors,
  same-origin network failures, and the `/duplicate key/i` subset of console warnings. Every
  other console warning is captured and reported but does NOT fail the test;
- attaches the full console and network capture to the report on failure.

Importing from `fixtures.ts` is the whole contract — no per-test boilerplate. A test may call
`browserLog.reset()` (adding `browserLog` to its args) after initial navigation to re-baseline.

## Condition waits

Use `page.waitForFunction()`, never `page.waitForTimeout()` — the ESLint playwright rule
forbids it and it makes tests flaky.

## Drive the bug into view

Drive the app into the state that makes a bug render; a check that never renders the broken
state cannot see it. `test/db/driver-search-interactive.browser.spec.ts` seeds
`openisd_my_drivers` in `localStorage` with a driver carrying no `name`, then searches for it,
so the derived-label path is the one actually rendered and asserted. The `v-for :key`
collision that corrupts list rendering is guarded upstream instead, by
`test/db/drivers-bundle.test.ts`, which fails on any duplicate driver identity in the bundle.

## Red→green cycle

As for JS core: write the failing test first, watch it fail, fix, watch it pass, run the full
suite.

## Post-deploy smoke test

After every `npm run build`, and before any change is handed to the user as "ready to check",
run all four steps:

1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/` → must be 200. 4000 is the
   only app port (`openisd/AGENTS.md` §"4000 IS THE ONLY APP PORT"); the build is served by
   `bash scripts/preview-4000.sh`, and `bash scripts/verify-preview.sh` runs this check plus
   the served-asset-hash comparison.
2. Confirm there are no `[vite] error` lines in the server output.
3. Drive a real browser to confirm visually that the changed element is present and correct —
   a grep over source files is not confirmation.
4. Inspect the browser Console **and** the HTTP/Network log. Read console errors, Vue warnings
   (duplicate keys, unhandled rejections) and failed same-origin requests **before** drawing
   any conclusion about probable cause. A passing DOM assertion is not enough — a
   `Duplicate keys found` warning can silently corrupt list rendering while the DOM looks fine.

Never say "it should work now — please check" without completing all four.

## Visual regression — SPL canvas

`test/ui/visual.browser.spec.ts` takes pixel-exact screenshots of the SPL graph panel for all
four box types (sealed, vented, bandpass4, passive radiator) and compares them against the
committed baselines in `test/ui/visual.browser.spec.ts-snapshots/` — the location
`playwright.config.js` `snapshotPathTemplate` resolves to. Run:

```
bash scripts/test-browser.sh packages/ui/test/ui/visual.browser.spec.ts
```

Regenerate baselines only for an intentional visual change (CSS, layout, curve styling):

```
bash scripts/test-browser.sh packages/ui/test/ui/visual.browser.spec.ts --update-snapshots
```

Review with `git diff` to confirm only the intended panels changed, then commit the new PNGs.
**Do not regenerate** to paper over a test failing because of a physics or engine change —
investigate the cause first.

## micka.de oracle tests

`test/scenarios.ts` is the source of truth for the micka.de crosscheck cases. Each scenario
defines the driver and box inputs and both tools' expected outputs — OpenISD stat-bar values
and micka.de table values. Its only consumers are
`test/logic/micka-crosscheck.browser.spec.ts` and `test/gen-scenarios.ts`; every other UI spec
carries its own inputs.

`micka-crosscheck.browser.spec.ts` matches the default `testMatch` in `playwright.config.js`
and there is no `testIgnore`, so it runs in every full browser suite — including
`bash scripts/health-check.sh`. It hits an external site (~25s per scenario), so a failure
there is as likely to be micka.de or the network as it is OpenISD; check which before treating
it as a physics regression. To run it alone:

```
bash scripts/test-browser.sh packages/ui/test/logic/micka-crosscheck.browser.spec.ts
```

Run it deliberately when adding a scenario to `scenarios.ts`, or when changing a formula in
`packages/design/engine/` to re-validate the frozen expected values.

Adding a test case:

1. Add a scenario to `test/scenarios.ts` with `driver:` and `box:` filled in, leaving `micka:`
   and `openisd:` blank.
2. Run the crosscheck spec, read what micka.de reports, and fill in `micka:`.
3. Map micka's values to OpenISD's display format — applying the same `toFixed` precision the
   stat bar uses — and fill in `openisd:`.
4. Add the OpenISD UI wiring test to `test/ui/app.browser.spec.ts` using the frozen `openisd:`
   values.
