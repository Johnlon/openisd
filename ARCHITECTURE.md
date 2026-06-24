# Resonate — architecture decisions

Decisions that are hard to reverse and shape everything else. Record them here
so future contributors understand *why*, not just *what*.

**Domain:** resonate-sim.io — purchased, currently redirecting to
https://johnlon.github.io/resonate/


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
exists, authn/authz is required — which means an IDP and session management.
The preferred IDP, if and when this is ever needed, is Google.

---

## AD-2: Offline support via PWA, not `file://`

**Decision:** Offline use is delivered by the Vite PWA plugin (Workbox service
worker), which caches the built app in the browser. The `file://` double-click
constraint from the pre-Vite era no longer applies.

**Rationale:**
- The Vue 3 + Vite build produces a standard ES-module bundle; ES modules require
  a server origin and cannot be served from `file://`.
- A service worker provides the same "works without internet" guarantee with a
  better user experience (installable, auto-updates).

**Implication:** The dev workflow requires `npm run dev` (or `npm run build` +
serve `dist/`). The core (`src/core/*.js`) is still DOM-free and importable
directly in Node for testing.

**Status:** Adopted (replaced the file:// constraint after the Vue 3 + Vite migration).

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
src/main.js          Vue app entry point
src/components/*.vue DOM, canvas drawing, event wiring (Vue SFCs)
src/core/*.js        physics, alignments, .wdr I/O, state — pure functions, no DOM
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

---

## UI-1: Every button and interactive control must have a tooltip

**Rule:** Every `<button>` and every nav-like interactive element (toggle chips,
icon-only controls, collapsible section headers) **must** carry a `title`
attribute. No exceptions.

**Rationale:**
- Users discover features by hovering. A button with no tooltip is a black box —
  it may be ignored entirely or clicked by accident without understanding the effect.
- Tooltips are especially important for abbreviated labels (e.g. `+ HP`, `2.83V`,
  `▸`) where the label alone is ambiguous.
- Screen-reader accessibility falls back on `title` when no `aria-label` is set.

**Format:**
- Describe the *effect*, not just the label: `"Set to 2.83V — IEC 60268-5
  sensitivity standard"` not `"2.83V button"`.
- For collapsible sections: `"Expand [section name] — [one-line summary of what's inside]"`.
- For destructive or irreversible actions: include the consequence,
  e.g. `"Remove this filter from the chain"`.

**Enforcement:** Any PR that adds a `<button>` without a `title` must be flagged
in review. Claude Code agent instructions (CLAUDE.md) enforce this at authoring time.

**Status:** Adopted 2026-06-24.

---

## UI-2: All docs, tooltips, values, and refs must cross-reference WinISD where relevant

**Rule:** Every tooltip, label, default value, doc section, and parameter description
must mention its WinISD equivalent wherever one exists. This includes:
- The name WinISD uses for the parameter
- WinISD's default value (if it has one)
- Where it appears in the WinISD UI (which tab, popup, or field)
- Any known difference in behaviour or convention between Resonate and WinISD

**Rationale:**
- Resonate's primary audience is WinISD users migrating to or cross-checking
  against an open, browser-based alternative. They arrive with WinISD mental models.
- Without cross-references, users spend time hunting for familiar controls or
  doubt whether Resonate's results are comparable.
- WinISD is the canonical reference for compatibility — every parameter that has
  a WinISD counterpart should make that mapping explicit.

**Examples of correct application:**
- Tooltip: `"Leakage loss. WinISD default: Ql=10. Found in Box tab → Advanced→ popup."`
- Tooltip: `"Drive voltage. Called 'Driver input voltage (each)' in WinISD."`
- Default value comment: `// Ql=10, Qa=100 — WinISD 0.7.0.950 defaults`
- Doc section heading: `"Box losses (WinISD: Advanced→ Ql / Qa)"`

**Status:** Adopted 2026-06-24.
