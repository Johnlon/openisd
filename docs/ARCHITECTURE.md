# Resonate — architecture decisions

Decisions that are hard to reverse and shape everything else. Record them here
so future contributors understand *why*, not just *what*.

---

## AD-1: Client-side only — no backend

**Decision:** The core simulator runs entirely in the browser for as long as
that remains feasible. No server, no account, no API calls required for the
physics engine or file operations.

**Rationale:**
- A backend costs money to run, introduces availability risk, and creates a
  natural pressure toward paywalling features. The project's purpose is an
  unconditionally free, community-owned tool.
- The Thiele/Small simulation model is pure mathematics — it needs no server.
- "Runs offline from a single HTML file" is a first-class feature (opens in
  a browser without an internet connection or a local server).
- Removing the backend removes an entire class of infrastructure maintenance
  from the contributor burden.

**Implication:** Any feature that *requires* a backend (e.g. user accounts,
cloud storage, collaborative editing) is a large, deliberate architectural
change that must be decided explicitly — it is not a default direction. Where
cloud features are desirable (e.g. Google Drive integration), they are strictly
opt-in additions that degrade gracefully; the core simulator must continue to
work without them.

**Status:** Adopted. If a feature genuinely cannot be delivered client-side,
that is a conscious decision to revisit this — not a default direction.

**Consequence: backend = auth stack.** The moment any backend infrastructure
exists, authn/authz is required — which means an IDP, session management, and
all the associated complexity. That is not a small add-on; it is a second major
project running in parallel. The preferred IDP, if and when this is ever needed,
is Google. This reinforces keeping the app client-side for as long as feasible.

---

## AD-2: The shipped app must work from `file://`

**Decision:** The built output must run when `index.html` is opened directly in
a browser (no local server, no internet). This is a runtime output constraint,
not a statement about the development workflow or build tooling.

**Rationale:**
- ES module `import` uses CORS fetch semantics and silently fails on a `file://`
  origin. The output therefore cannot use bare `import` statements.
- How we *produce* that output — build step, bundler, hand-written — is a
  separate concern and not decided here.

**Implication:** Whatever the build process produces, the output must load via
classic `<script src>` or equivalent, not ES module imports. Core modules also
expose a Node-compatible export for test use:

```js
const API = { /* public functions */ };
if (typeof module !== 'undefined') module.exports = API;          // Node tests
if (typeof window !== 'undefined') window.R = Object.assign(window.R||{}, API); // browser
```

**Status:** Adopted.

---

## AD-3: Three-layer separation — core has no DOM

**Decision:** Logic is split into three layers. The core (physics, file I/O,
state management) contains no DOM, no `window`, no `document`, no canvas. The
UI layer calls the core; the core never calls the UI.

**Rationale:**
- The core is the reusable product. Other UIs (mobile, third-party) must be
  able to build on it without pulling in browser coupling.
- DOM-free code is directly testable in Node without stubs or jsdom.
- The boundary makes the data contract explicit: core takes data in, returns
  data out. That contract is documented in [CONTRACT.md](CONTRACT.md) (once
  written).

**Layers:**

```
index.html       shell — <script src> includes only
src/ui/*.js      DOM build, canvas drawing, event wiring
src/core/*.js    physics, alignments, .wdr I/O, state — pure functions
```

**Status:** Adopted. Extraction is in progress — see [PLAN.md](PLAN.md).

---

## AD-4: Extract, do not rewrite

**Decision:** The re-architecture moves existing, validated engine code behind
clean module boundaries. It does not rewrite the physics from scratch.

**Rationale:**
- The engine is validated to < 0.03 dB against closed-form Thiele/Small
  physics. That correctness was paid for. A clean-room rewrite throws it away
  and re-introduces the same class of bugs.
- Extraction is behaviour-preserving and verifiable (golden-master tests);
  a rewrite is not.

**Status:** Adopted.
