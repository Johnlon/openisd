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

## 2. The offline constraint dictates the module style

The README and manifesto promise: **open `index.html` and it runs, offline, with
no build step.** That promise decides how we modularise.

- **ES modules (`import` / `<script type="module">`) are forbidden** for the
  shipped app: browsers fetch modules with CORS semantics, and `file://` is an
  opaque origin, so `import` **silently fails when the file is double-clicked
  offline.** This would break the core promise invisibly.
- **Use classic `<script src>` includes** with a dual export so the same file
  runs in the browser *and* in Node tests:

  ```js
  // end of src/core/engine.js — no bundler, works on file://, works in Node
  const API = { solve, sweep, maxCurves, deriveDriver, parseWdr, /* … */ };
  if (typeof module !== 'undefined') module.exports = API;            // Node tests
  if (typeof window !== 'undefined') window.R = Object.assign(window.R||{}, API); // browser
  ```

- No build step, no bundler. `index.html` lists the core and UI scripts in order;
  Node tests `require()` the core directly. This **replaces** the current hack of
  string-slicing the engine out of `index.html` and `eval`-ing it.

> "No dependencies / no build" is a promise about the **shipped app** — users
> still open one page with co-located scripts. Test tooling in `devDependencies`
> behind `npm test` does not touch that promise.

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
- [ ] `index.html` still opens and runs from `file://` (offline)
- [ ] No new runtime dependencies; no build step introduced

---

## 5. Refactoring discipline (it's a live app)

The split from one-file-spike to three layers is **incremental, not a big bang**:

1. Extract one core area at a time into `src/core/*.js` with the dual export.
2. Keep the existing in-page self-test green at **every** step — it's the safety net.
3. **Go/no-go after the first extraction**, before continuing: does `index.html`
   still open and run from `file://`, **and** does `node --test` require the new
   module? Both pass → proceed. Either fails → stop and fix the approach.
4. Pure extraction only — identical behaviour, no UI reorg, no new features in the
   same pass.

---

## 6. Running things

```
npm test                 # unit suite (node:test) — once the core is extracted
npx playwright test      # functional suite (headless browser)
node test/engine.test.mjs # current interim engine gate (until migrated)
```

CI runs both suites on every push and pull request.
