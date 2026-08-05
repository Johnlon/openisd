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
rename, not a rushed pass. Phased steps: [PLAN_DRIVER_ADT.md](PLAN_DRIVER_ADT.md).

## AD-7: Shared behaviour lives in a composable, never duplicated per skin

**Decision:** OpenISD ships three interchangeable skins (`classic`, `original`, `modern`,
`packages/ui/src/skins.ts`) over the same store and engine. Any behaviour more than pure
presentation — a commit boundary, a derivation, a load/save flow — is written **once**, in a
composable under `packages/ui/src/composables/`, and every skin calls it. A skin file must
never re-implement logic another skin already has; that is the bug, not a style preference.

**Rationale:**

- Three skins sharing one composable is one chance to get a commit boundary (STATE_MODEL.md
  rule 2/3) or a derivation right. Three skins each with their own copy is three chances to
  get it wrong, and a fix applied to one silently leaves the other two stale — exactly the
  divergence class STATE_MODEL.md's dialog rules exist to prevent.
- Matches AD-6's own layering: `winisd-ui` is already defined as "framework-agnostic glue...
  the only layer that knows a UI framework exists" — a composable is that layer's concrete
  form. AD-7 is AD-6's boundary applied specifically to the skin-multiplicity problem AD-6
  does not itself call out.

**Existing examples, not a hypothetical:** `useDriverSelection.ts` (draft → commit, shared by
all three skins' driver editors), `useVentGroup.ts` and `usePrGroup.ts` (the vent/PR
entered-set solvers, AD-8), `useDesignIO.ts` (save/export, shared by every skin's toolbar).

**Status:** Adopted, enforced by convention; no automated gate yet checking a skin file for
duplicated logic.

## AD-9: Strong typing over loose bags

**Decision (human, 2026-07-31):** No more untyped grab-bag types — an all-optional
interface accepting fields a given consumer never reads, a `Record<string, any>`, a shape
whose real contract is narrower than its declared type. Every type states exactly what it
holds and why; every boundary that can fail validates and reports, rather than accepting
anything and hoping. This governs AD-8 below and applies project-wide, not only to drivers.

**Evidence this is a real problem, not a style preference:** `DriverRaw`
(`packages/engine/src/types.ts`) is declared as ~40 all-optional fields — full T/S numerics
alongside `brand`/`comment`/four separate URL fields. `deriveDriver(d: DriverRaw)`
(`packages/engine/src/driver.ts:29`) takes the whole interface as its parameter type but
only ever reads a handful of the numeric fields. The metadata fields duplicate — without any
provenance — exactly what `OpenISDDriver` (AD-8) already models properly. `DriverRaw` is
retired under this decision; nothing inherits its shape unmodified.

## AD-8: the driver model — `OpenISDDriver` is the app; `WinISDDriver` is a serialiser

**Decision (human, 2026-07-31):** The application is built around `OpenISDProject` and
`OpenISDDriver`. `OpenISDDriver`'s on-disk form is `openisd.yml` — the same schema, byte
for byte; `.owdr` is the extension the browser app uses for the identical content when
reading or writing a single driver to local disk. There is one parse, not two, whether the
source is a library `openisd.yml` or a user's `.owdr`.

**`OpenISDDriver` owns the app.** It is the live, long-held in-memory model — every T/S
field, every derived value, all E/C/N provenance, all consistency-group derivation (Fs from
Mms+Cms, Cms from Fs+Vas+Sd, the whole family this session verified against real WinISD
behaviour). It is strongly typed against the real `openisd.yml` shape, confirmed against
`winisd_tools/scrapers/scrapers/lib/model_driver.py` and `model_openisd.py`'s `MetaFile` (the
actual `driver.yml → openisd.yml` projection) — **not one uniform envelope, four distinct
ones depending on what kind of field it is:**

- **`SpecEntry`** (T/S fields, inside `specs:` only) — no flat value. `origin` names the
  winning source; a required `readings` dict (≥1 source) carries each source's own
  `{actual_reading, read_value, read_precision}`; the number is only reachable at
  `readings[origin].read_value`.
- **`ScrapedField<T>`** (record-level metadata — `manufacturer`, `brand`, `model`) — has a
  flat `value: T`, plus `origin`, an *optional* `readings` (only populated when ≥2 sources
  disagreed), `definition`, `dq`.
- **`DerivedField<T>`** (pipeline-computed — `sku`, `name`) — `value: T` + `definition` +
  `grounds` (evidence list). No `origin`/`readings` — not read from a source, built.
- **`BookkeepingField<T>`** (pure pipeline fact — `uuid`) — just `value: T` + `definition`.

The flat `{value, origin, read_precision, definition}` shape stated in an earlier draft of
this decision was wrong and unverified — corrected here against the real pydantic models.

**`WinISDDriver` is solely a serialisation device.** A strongly-typed class with
validations — not a loose bag — but no app/calculation logic belongs on it, architecturally,
at all: it does not derive, does not hold live state, does not persist between calls.
- **Export:** `OpenISDDriver`'s already-resolved values populate a `WinISDDriver` instance
  immediately before it is serialised to `.wdr` text, then discarded.
- **Import:** `.wdr` text populates a `WinISDDriver` instance; those as-read values are then
  diffed against what `OpenISDDriver` would independently derive, surfacing any mismatch as
  a data-quality signal (e.g. a value hand-edited in classic WinISD outside the app) rather
  than silently overwriting.
- `.wdr` is therefore 100% derivable from `OpenISDDriver` — generated on demand, never
  stored. Same relationship upstream: `openisd.yml` is 100% derivable from `driver.yml`
  (`winisd_tools/DESIGN.md` §10b).

**Today's `Driver` class dies.** Checked, not assumed: its internal storage
(`#inputs: Record<string, number|string>`) is flat, the same shape as a parsed `.wdr`, and
none of `openisd.yml`'s per-field (`origin`/`read_precision`/`definition`) or record-level
(`quality`/`disposition`/`data_sources`) structure exists in it anywhere — it is WinISD's
data model wearing a neutral name, not `openisd.yml`'s. Per AD-4 (extract, do not rewrite),
its validated derivation *algorithms* are not thrown away — they move onto `OpenISDDriver`,
since that is where live edits happen and where "recompute the rest" has to live. But the
class itself, as a long-lived stateful object the app instantiates and holds, has no
remaining architectural role once `OpenISDDriver` takes that job. `WinISDDriver` does not
inherit `Driver`'s derivation machinery — under AD-9, it does not carry that logic at all.

**`DriverRaw` is retired — see AD-9.** The calc layer (`deriveDriver`, `sweep`) still needs
*some* flat numeric input to do arithmetic on, so a narrow successor type is needed at that
boundary — but it must be scoped to exactly what those functions read, typed under AD-9, not
a rename of `DriverRaw`'s current shape.

**Scope: the driver record only.** This decision covers `OpenISDDriver`/`WinISDDriver`
specifically. Box/vent/PR/filter/signal/UI-navigation state — the rest of live `AppState` —
has no fields in `openisd.yml` and none are added; that stays `OpenISDProject`'s
(`.owpr`'s) concern. The multi-layer state model (ground/baseline/committed/modified,
`STATE_MODEL.md`) is multiple COPIES of the one `OpenISDDriver` shape, not different shapes
of it.

**Blocking gap — must be fixed before "no data loss" is true:** `SPL` (a manufacturer's
directly PRINTED sensitivity figure, not derived) is a canonical spec field
(`CANONICAL_SPEC_FIELDS`, `winisd_tools/record_registries.py:273-284`) with no equivalent
anywhere in today's engine types. A record scraped with a printed `specs.woofer.SPL` value
has nowhere to go. Everything else checked matches cleanly — WDR-carried dimension fields
(`thick_mm`, `depth_mm`, `magnet_depth_mm`, `Hc_mm`, `Hg_mm`) map directly, and every
*calculated* field's absence from the schema (`no`/η₀, `Vd`, `SPLmax`, `SPLmaxLF`, `Mpow`,
`Mcost`, `Rme`, `gamma`) is correct under `winisd_tools/DESIGN.md` §10a, not a gap.

**Decision (human, 2026-07-31): `openisd.yml` is read and written EXCLUSIVELY by JS/TS code
owned by the OpenISD project — never by Python.** This settles the mechanism, not yet the
value, of the `origin`-for-a-live-edit question below. When `winisd_tools` needs an
`openisd.yml` produced from a `driver.yml`, it does not write one itself in Python — it
invokes the JS/TS code via an API (shape TBD) taking two arguments: the input `driver.yml`
path and the output `openisd.yml` path. The JS/TS side performs the actual read/write. This
extends `winisd_tools/DESIGN.md` §10b ("`openisd.yml` is 100% derivable from `driver.yml`")
with its mechanism, and matches the yml→wdr pattern already logged in `BACKLOG.md` ("Stop
reading `.wdr` in the app") — Python invokes JS as an external program in both directions,
so there is exactly one implementation of each transform, not two languages each carrying
their own copy. **Not yet designed:** the API's concrete shape (CLI subprocess call, as the
yml→wdr case already specifies, or something else) — needs its own plan alongside that item.

**Decision (human, 2026-07-31): resolved — the lifecycle of `origin` for a live edit.**
`data_sources` (and each field's `origin`) already carries through from `driver.yml` into
`openisd.yml`, confirmed against a real record (`fs10-20a8/openisd.yml`:
`data_sources: { value: { manufacturer_product_page: <url> } }`). The rule:

- A field's `origin` stays whatever it was extracted as (`manufacturer_datasheet`, etc.)
  until the human overwrites it in the UI, at which point it becomes `SourceRole.MANUAL`.
- Reset (STATE_MODEL.md's existing ground/baseline layering — no new mechanism) reloads the
  prior snapshot, which restores whatever `origin` it held before the edit. Nothing new
  needed here; this is what ground/baseline already does.
- A field that is normally *calculated* (§10a: never stored) and is then manually entered
  MUST be written to the `.owdr` with `origin: manual` — it is now an asserted fact, not
  something to silently re-derive. Clearing/resetting it reverts it to calculated and
  **removes it from storage again** — the same enter/clear pattern already proven this
  session on `useVentGroup.ts`/`usePrGroup.ts` (`enterVentField`/`clearVentField`) and
  already present in today's `Driver.enter()`/`.clear()`, ported onto `OpenISDDriver`'s
  nested shape rather than newly invented.

**Small remaining gap, mechanical not architectural:** for a `manual`-origin entry, what
happens to `read_precision` and `actual_reading` — omitted (no printed form has a rounding
half-width or a source string to echo), or synthesized somehow? Needs an answer before the
schema write is implemented, but does not block the rule above.

**Not yet implemented** — needs its own plan: the `OpenISDDriver` type and its YAML
reader/writer, the `WinISDDriver` class and its validations, and how `Driver`'s current
methods redistribute between them.
