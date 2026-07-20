# OpenISD — architecture decisions

Decisions that are hard to reverse and shape everything else. Record them here
so future contributors understand _why_, not just _what_.

**Domain:** openisd.app — purchased; served by GitHub Pages via a `CNAME` file
in the published site root (`packages/ui/public/CNAME`). The custom domain serves
at the root, so the Vite `base` is `/`.

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

**Implication:** Any feature that _requires_ a backend (e.g. user accounts,
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
serve `dist/`). The core (`packages/engine/src/*.js`) is still DOM-free and importable
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
packages/ui/src/main.ts          Vue app entry point — mounts the root component
src/App.vue          Root layout: header, side panel, graph area, overlays
packages/ui/src/components/*.vue UI components — DOM, event wiring, canvas; no physics
packages/ui/src/store.ts         Shared reactive state (Vue reactive/computed); no DOM, no physics
packages/ui/src/utils/*.js       Browser-side utilities — canvas drawing, plot data, persist,
                       flash messages, PR library CRUD, self-test; no physics
src/presets.js       Static presets (colour palettes, graph tab definitions)
packages/engine/src/*.js        Physics — T/S engine, alignments, .wdr I/O; pure functions, no DOM
```

**Component inventory** (`packages/ui/src/components/`):

| Component           | Responsibility                                                          |
| ------------------- | ----------------------------------------------------------------------- |
| `AppHeader.vue`     | Import / export / share / about actions                                 |
| `SidePanel.vue`     | Stacks the four side-panel fieldsets                                    |
| `DriverPanel.vue`   | Driver T/S parameter editor                                             |
| `DriverBrowser.vue` | Driver library search modal                                             |
| `BoxPanel.vue`      | Enclosure type, Vb, box losses, vented vent controls, alignment buttons |
| `PRPanel.vue`       | Passive radiator library, T/S editor, tuning controls                   |
| `SignalPanel.vue`   | Circuit model, drive voltage, multi-driver wiring                       |
| `FiltersPanel.vue`  | Filter chain (HP, LP, Linkwitz transform, parametric EQ)                |
| `GraphArea.vue`     | Composes toolbar + grid                                                 |
| `GraphToolbar.vue`  | Graph tab selection and compare-design controls                         |
| `GraphGrid.vue`     | Responsive N-column grid of graph panels                                |
| `GraphPanel.vue`    | Single canvas graph with crosshair and context menu                     |
| `StatBar.vue`       | Key derived stats (F3, Qtc, Fb/Fp, peak Z, etc.)                        |
| `NumInput.vue`      | Shared numeric input with unit scaling and precision                    |
| `Flash.vue`         | Transient notification overlay                                          |

**Utility inventory** (`packages/ui/src/utils/`):

| File           | Responsibility                                                                 |
| -------------- | ------------------------------------------------------------------------------ |
| `canvas.js`    | Canvas drawing — axes, curves, crosshair, readout                              |
| `series.js`    | Plot data builder — maps sweep output to series arrays; owns `TABS` definition |
| `persist.js`   | Serialise/deserialise full state to JSON; URL hash encode/decode               |
| `flash.js`     | Reactive flash-message state (shared singleton)                                |
| `prLibrary.js` | PR library CRUD backed by `localStorage`                                       |
| `selftest.js`  | Runtime self-test run once at startup                                          |

**Status:** Adopted. Extraction is in progress — see [PLAN.md](PLAN.md).

---

## AD-5: Runtime self-test — bundle verification distinct from build-time tests

**Decision:** A lightweight physics smoke-test (`packages/ui/src/utils/selftest.js`) runs
once on every page load, in the user's browser, against the live deployed bundle.
Its results are written to the browser console under `[OpenISD self-test]`.

**Why this exists alongside the Node.js test suite:**

The build-time tests (`npm run test:unit`) prove that the **source
code** is correct, running against source files in a Node.js V8 environment on
the developer's machine or in CI.

The self-test proves that the **deployed bundle** is correct, running in the
**exact environment** the end user experiences. They catch different failure
modes:

| Failure mode                          | Build tests | Self-test |
| ------------------------------------- | ----------- | --------- |
| Logic bug in source code              | ✓           | ✓         |
| Bundler/minifier corrupts code        | ✗           | ✓         |
| Tree-shaking drops a needed export    | ✗           | ✓         |
| Browser JS engine edge case           | ✗           | ✓         |
| Wrong constants after a config change | ✗           | ✓         |

**What it checks:** Three physics gates (same invariants as the first three
engine tests):

1. Sealed-box SPL matches the closed-form Thiele/Small transfer function to < 0.1 dB
2. Passband sensitivity matches the T/S radiation efficiency formula to < 0.5 dB
3. Vented box rolls off at ~24 dB/oct with two impedance peaks straddling Fb

**`window._selfTestDone` flag:** Set to `true` when the self-test completes.
Playwright (`test/app.browser.spec.js`) waits on this flag before running
browser-based integration tests — it is a synchronisation signal, not a result.

**Known limitations / future work:**

- Currently duplicates logic from `engine.test.mjs` — the three gates should
  share a single implementation imported by both.
- Results are console-only; a user who has a broken build has no visible
  indication. A future improvement would surface failures via the Flash
  notification system.
- Magic numbers in the current implementation violate the no-magic-numbers rule
  and should be replaced with named constants shared with the test suite.

**Status:** Adopted. Improvement to share constants with test suite is pending.

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

- Describe the _effect_, not just the label: `"Set to 2.83V — IEC 60268-5
sensitivity standard"` not `"2.83V button"`.
- For collapsible sections: `"Expand [section name] — [one-line summary of what's inside]"`.
- For destructive or irreversible actions: include the consequence,
  e.g. `"Remove this filter from the chain"`.

**Enforcement:** Any PR that adds a `<button>` without a `title` must be flagged
in review. Claude Code agent instructions (CLAUDE.md) enforce this at authoring time.

**Status:** Adopted 2026-06-24.

---

## UI-2: Box panel layout must be symmetric across all box types

**Rule:** Controls that apply to all box types (Type selector, Vb, box losses) must
occupy fixed positions shared by every box type. Box-type-specific controls (vent
diameter/length, PR parameters, bandpass front chamber) go in a conditional block
in the middle. All box types share the same structural skeleton:

```
[Type selector]
[Vb]
[Box losses toggle]   ← always here, applies to all types
── box-specific block (conditional) ──
[Alignment / tune buttons]
```

**Rationale:**

- Users switch between box types to compare results. If a control appears to belong
  to only one box type, they will be confused when it disappears on switching.
- Consistent layout reduces cognitive load — the user knows where to find box
  losses regardless of which box type is selected.
- Asymmetric layouts create an implicit (wrong) message that a feature doesn't
  apply to certain box types.

**Status:** Adopted 2026-06-24.

---

## UI-3: All docs, tooltips, values, and refs must cross-reference WinISD where relevant

**Rule:** Every tooltip, label, default value, doc section, and parameter description
must mention its WinISD equivalent wherever one exists. This includes:

- The name WinISD uses for the parameter
- WinISD's default value (if it has one)
- Where it appears in the WinISD UI (which tab, popup, or field)
- Any known difference in behaviour or convention between OpenISD and WinISD

**Rationale:**

- OpenISD's primary audience is WinISD users migrating to or cross-checking
  against an open, browser-based alternative. They arrive with WinISD mental models.
- Without cross-references, users spend time hunting for familiar controls or
  doubt whether OpenISD's results are comparable.
- WinISD is the canonical reference for compatibility — every parameter that has
  a WinISD counterpart should make that mapping explicit.

**Examples of correct application:**

- Tooltip: `"Leakage loss. WinISD default: Ql=10. Found in Box tab → Advanced→ popup."`
- Tooltip: `"Drive voltage. Called 'Driver input voltage (each)' in WinISD."`
- Default value comment: `// Ql=10, Qa=100 — WinISD 0.7.0.950 defaults`
- Doc section heading: `"Box losses (WinISD: Advanced→ Ql / Qa)"`

**Status:** Adopted 2026-06-24.

---

## UI-4: Intrinsic parameters are collapsible; tunable parameters are always visible

**Rule:** Distinguish two classes of parameters in every panel:

- **Intrinsic** — device datasheet specs that describe what a component _is_ (PR: Sd, Mms, Cms, Rms, Xmax, Fs; Driver: Fs, Qts, Vas, Re, Le, Xmax). These go inside a collapsible edit section (hidden by default). Users rarely change these after initial setup.
- **Tunable** — values the user actively adjusts during a design session (PR: added mass; Box: Vb, vent length, vent diameter, box losses). These must remain permanently visible outside any collapsible block so the user can tweak them without entering edit mode.

**Structural pattern (PR example):**

```
[Browse PR library]                    ← always visible
[PR name] [Edit ✎]                    ← always visible (summary)
[Sd · Fs · Qms · Xmax]               ← always visible (summary specs)
── edit section (collapsed by default) ──
  [PR name input, Sd, Xmax, Mms, Cms, Rms, Fs, Qms, Vas inputs]
  [Save]
── end edit section ──
[PR tuning] subsect                    ← always visible
[Added mass _______ g]                 ← always visible (tunable)
[Total Mms / Fp / Fs+mass readouts]   ← always visible
```

**Rationale:**

- Users routinely iterate on tunable parameters (e.g. adjusting added mass to shift Fp) but rarely need to re-enter intrinsic specs after initial setup.
- Hiding tunable controls inside an edit section forces an unnecessary modal interaction and hides the primary feedback loop.
- Keeping intrinsic specs collapsible reduces panel height once a component is configured.

**Status:** Adopted 2026-06-24.

---

## AD-6: Thin UI over a reusable core — separate WinISD interop from pure calc

**Decision:** Refine AD-3. The "core" is not one thing — split it, and keep the
UI-coupled code **as thin as possible**. Concretely, four layers, dependencies
pointing one way only (down):

```
calc        pure audio physics — deriveDriver, sweep, circuit, complex, alignments,
            filters, constants. ZERO WinISD concepts: no WDR, no ParState, no
            provenance, no file formats. Input = numbers, output = numbers/curves.
   ▲
winisd      headless WinISD interop — WDR parse/serialise, the ParState position map
            + E/C/N, the Driver model (enter/clear/state). Calls calc; no DOM.
   ▲
winisd-ui   framework-agnostic glue — reactive Driver wrapper, state orchestration,
            editor field wiring. The only layer that knows a UI framework exists.
   ▲
UI          thin Vue presentation only — layout, canvas, event wiring. Swappable.
```

**The goal, stated plainly:** UI-tainted code is kept minimal. Everything that
isn't presentation lives below the UI boundary and is framework-agnostic, so the
whole app can be **reskinned by replacing only the UI layer** — a mobile UI, an
alternate desktop skin, or a headless/CLI driver — reusing `calc` + `winisd` +
`winisd-ui` unchanged.

**Rationale:**

- Reusability: a second UI (mobile) is a new top layer, not a fork of the logic.
- `calc` becomes a genuinely publishable, WinISD-free physics library.
- WinISD file-format concerns (WDR/ParState) stop leaking into universal physics.

**Litmus test:** could you build a mobile or CLI front-end reusing `calc` + `winisd`
**unchanged**? If a piece of "logic" can't move down because it's entangled with Vue
or the DOM, that entanglement is UI-taint to push below the boundary.

**Implication:** `parseWdr` / `toWdr` / `parstate` and the Driver ADT move **out of
the engine** into `winisd`; `deriveDriver` stays in `calc`. The store's orchestration
is made as framework-agnostic as feasible. See
[docs/DRIVER_ADT_DESIGN.md](docs/DRIVER_ADT_DESIGN.md).

**Status:** Goal adopted. Migration pending — layered on top of the `@openisd`
rename, not a rushed pass. Phased steps: [archive/PLAN_DRIVER_ADT.md](archive/PLAN_DRIVER_ADT.md).
