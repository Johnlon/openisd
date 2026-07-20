# OpenISD — development practices

OpenISD started as a spike. Before it grows, it needs a real testing foundation
and an architecture that supports one. This document is the contract.

**The headline rule: every change ships with tests, and both test suites must
pass in CI. Physics changes must keep the validation gates green.**

---

## 1. Architecture — three layers

```
┌─────────────────────────────────────────────┐
│ index.html        shell + <script src> only  │
├─────────────────────────────────────────────┤
│ UI layer          DOM build, canvas drawing,  │
│  (src/ui/*.js)     event wiring               │
├─────────────────────────────────────────────┤
│ CORE (no DOM)     physics + data, pure        │
│  (packages/engine/src/*.js)   functions only             │
└─────────────────────────────────────────────┘
```

**Core** — the electro-acoustical engine (`solve`, `sweep`, `maxCurves`,
`deriveDriver`), alignment math, passive-radiator math, `.wdr` parse/serialize,
and state serialize / apply / URL-encode.

**The one inviolable rule: the core contains no DOM, no `window`, no `document`,
no canvas.** It takes data in and returns data out. That boundary is what keeps
the core unit-testable forever. If a function needs the DOM, it belongs in the UI
layer.

**UI** — everything that touches the page: building the sidebar, drawing graphs
to canvas, wiring events. It _calls_ the core; the core never calls it.

---

## 2. Offline support via PWA

The app is built with Vite and Vue 3, so ES modules and a build step are the
normal development workflow. Offline use is delivered by the Vite PWA plugin
(Workbox), which caches all built assets in a service worker — not by a
downloadable single file.

The core (`packages/engine/src/*.js`) has no DOM and no Vue dependencies, so it can be
imported directly in Node for testing without stubs or jsdom.

---

## 3. Testing strategy — two suites, both required

Python testing for the driver data pipeline (parsing/extraction `pytest` unit
tests) lives in the sibling [`winisd_tools`](../winisd_tools) repo, not here —
see its `testing-python.md`.

### JS core tests — Vitest + `node:assert`

For everything in `packages/engine/src/`. Fast, deterministic, no browser.

- Physics gates (sealed≡closed-form, sensitivity, vented rolloff + twin Z-peaks), `.wdr` parse/serialize round-trips, alignment + PR math, driver dedup.
- Run: `npm run test:unit`

Rules: `.claude/context/testing-js-core.md`

### Browser tests — Playwright (headless browser)

**jsdom / no-op stubs prove "the script didn't throw" — they do NOT prove a curve was drawn.** A headless browser is the only way to verify the actual app.

All `packages/ui/test/*.browser.spec.js` must import from `packages/ui/test/fixtures.js` (not `@playwright/test` directly) — that module's `browserLog` auto-fixture captures and asserts on console errors, Vue warnings, and failed network requests for every test. A green DOM assertion is not enough.

Run: `npx playwright test`

Rules: `.claude/context/testing-js-ui.md`

**Tooling is deliberately minimal: Vitest + Playwright, nothing else.** Do not add another test runner (Jest / Mocha / etc.).

---

## 4. Definition of done (PR checklist)

- [ ] Core logic has **no DOM references**
- [ ] New core logic has Vitest unit tests; new UI behaviour has a Playwright browser test
- [ ] `npm run test:unit` passes (JS core tests)
- [ ] `npx playwright test` passes (browser tests)
- [ ] `npm run lint` is 0 errors
- [ ] Physics validation gates still green
- [ ] `npm run build` succeeds and the built app works in a browser
- [ ] PWA / offline still works (service worker caches all assets)

---

## 5. Refactoring discipline (it's a live app)

Keep changes incremental:

1. One area of `packages/engine/src/` at a time — identical behaviour, no UI reorg, no new
   features in the same pass.
2. Keep the engine tests green at every step — they are the safety net.
3. Pure extraction only: if a function needs the DOM, it belongs in a component,
   not in core.

---

## 6. Platform — Windows + Git Bash only

This project has been developed exclusively on **Windows 11 with Git Bash**. Other operating systems (macOS, Linux) have not been considered yet — support may be added in future. Git Bash is placed first in the Windows `PATH` so `bash` resolves to Git Bash, not WSL or any other shell.

**The SDLC has not yet been made cross-platform.** Running scripts in the wrong shell (WSL, PowerShell, cmd) causes errors and confusion. To prevent this, every script in `scripts/` asserts it is running in Git Bash at startup — it checks for `$MSYSTEM` (set by Git Bash to `MINGW64`/`MINGW32`, absent in WSL and PowerShell) and exits immediately with a clear error if the assertion fails. Any new script added to `scripts/` must include this guard.

---

## 7. Running things

Always use the project scripts — do not run `npm run dev`, `vite`, or ad-hoc commands directly.

```bash
bash scripts/dev-4200.sh      # agent dev server: health checks then Vite at http://localhost:4200
bash scripts/stop-http.sh 4200  # stop the agent dev server
bash scripts/preview-4000.sh  # human lightweight preview at http://localhost:4000 (no health checks)
bash scripts/health-check.sh  # full gate: lint + typecheck + JS unit + browser tests
bash scripts/build-release.sh # GITHUB_PAGES production build → packages/ui/dist/
```

Individual gates:

```bash
# JS core unit tests
npm run test:unit

# Browser tests
npx playwright test

# Lint
npm run lint
```

CI runs lint, unit tests, and Playwright on every push.

---

## 8. Standing coding patterns (merged from CODING_PATTERNS.md, 2026-07-20)

This section maintains version-controlled coding patterns and design systems for the OpenISD application.

### Domain-Specific Testing

- Core TS logic (`packages/engine/src/`): unit tests in vitest (`npm run test:unit`)
- UI and E2E integration: Playwright tests (`npx playwright test`)
