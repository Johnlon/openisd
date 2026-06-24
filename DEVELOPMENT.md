# Resonate — development practices

Resonate started as a spike. Before it grows, it needs a real testing foundation
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
│  (src/core/*.js)   functions only             │
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
to canvas, wiring events. It *calls* the core; the core never calls it.

---

## 2. Offline support via PWA

The app is built with Vite and Vue 3, so ES modules and a build step are the
normal development workflow. Offline use is delivered by the Vite PWA plugin
(Workbox), which caches all built assets in a service worker — not by a
downloadable single file.

The core (`src/core/*.js`) has no DOM and no Vue dependencies, so it can be
imported directly in Node for testing without stubs or jsdom.

---

## 3. Testing strategy — two suites, both required

### Unit tests — `node:test` + `node:assert` (zero deps)
For everything in the core. Fast, deterministic, no browser.

- Physics gates (the existing sealed≡closed-form, sensitivity, vented rolloff +
  twin Z-peaks) become real unit tests requiring the core module.
- Plus: `.wdr` parse/serialize round-trips and malformed-input handling;
  state serialize/apply/URL round-trip; alignment + PR math; the driver
  dedup/same-model detector.
- Run: `node --test test/unit/`

### Functional tests — Playwright (headless browser)
This is the gap. **jsdom / no-op stubs prove "the script didn't throw" — they do
NOT prove a curve was drawn.** A headless browser is the only way to verify the
actual app, and it automates the rendering check we currently push onto the user.

Functional tests load the built `index.html` and assert real behaviour:
- the multi-graph grid renders the expected number of panels and non-blank canvases
- the driver panel collapses to a summary and expands on Edit
- a `.wdr` import loads and the SPL curve changes
- "Share link" → reopen the URL → identical design restored
- the federated driver browser lists files (mock the network)

Run: `npx playwright test`

**Tooling is deliberately minimal: `node:test` + Playwright, nothing else.** Do
not add Jest / Vitest / Mocha.

---

## 4. Definition of done (PR checklist)

- [ ] Core logic has **no DOM references**
- [ ] New behaviour has unit tests (core) and/or a functional test (UI)
- [ ] `npm test` (units) and `npx playwright test` (functional) both pass
- [ ] Physics validation gates still green
- [ ] `npm run build` succeeds and the built app works in a browser
- [ ] PWA / offline still works (service worker caches all assets)

---

## 5. Refactoring discipline (it's a live app)

Keep changes incremental:

1. One area of `src/core/` at a time — identical behaviour, no UI reorg, no new
   features in the same pass.
2. Keep the engine tests green at every step — they are the safety net.
3. Pure extraction only: if a function needs the DOM, it belongs in a component,
   not in core.

---

## 6. Running things

```
npm run dev              # dev server at http://localhost:5173
npm run build            # production build → dist/
npm test                 # engine unit tests + Playwright browser tests
npx playwright test      # browser tests only
```

CI runs both suites on every push and pull request.
