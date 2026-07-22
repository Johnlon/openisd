# OpenISD — change log (value-first)

**Purpose:** a record of meaningful changes — functional, quality, procedural — each stated by the benefit it delivered, then how it delivered it. Git holds the mechanics; this holds the reason a change was worth making.

**Entry format:** benefit first, then a terse how. Newest day at the top.

**Status:** the one sanctioned history file in the repo — see the "No history in documentation" exception in `CLAUDE.md`. Agents append the day's entries at end of session (`CLAUDE.md` "Value log" rule).

---

## 2026-07-22 — Real per-field unit conversion (all skins)

Click a field's unit and the value now actually converts — before, the unit label rotated
(cm → mm → in) but the number sat unchanged, so a vent length read "10.20" relabelled as mm,
silently wrong. Clicking now rescales the shown value and its decimal places, and typing in the
new unit is converted back. Trustworthy on every control with a real alternate unit — volume, length, area, frequency, mass,
and (via affine conversion) absolute temperature K/°C/°F and pressure Pa/kPa/atm — across all
skins. The underlying model is always SI regardless of the unit on screen, so the physics is
never affected by a display choice: switching the room temperature to °C leaves the simulated
sound velocity identical. The chosen unit sticks per field across a page refresh, and is kept
out of shared links (a recipient keeps their own units, like their own skin). Built as one
reusable piece — a `display = SI × factor + offset` registry plus a `UnitToggle` label and
unit-aware `NumInput` — so temperature needed no special case and new fields opt in with three
props instead of copy-pasted scale factors. Dimensionless and electrical cells (Q, Ω, V, W, …)
stay fixed — they have no meaningful second unit. Two more conversions followed the same
pattern: a coil temperature RISE (a difference, K/°F — no offset, distinct from absolute
temperature) and the coil resistance coefficient (1000/K, %/K, 1/K). Also fixed: converting a
high-precision base unit into a coarser one (grams → kilograms) was piling up meaningless
trailing zeros (0.00000000 kg) — every derived precision is now capped.

## 2026-07-21 — Power compression + driver added-mass (WinISD parity)

Two effects WinISD simulates but OpenISD ignored now work — verified against a live WinISD
session, not guessed. Voice-coil power compression: set a coil temperature rise (with the
resistance TC) and the impedance floor lifts while SPL sags, because the hot coil resists more
current — the reason a real speaker gains less than +3 dB when you double the power. Driver
added-mass: weight the cone and the resonance drops (Mms up → Fs down), matching WinISD's
70→25 Hz for +100 g. Both default to off (exact no-ops), so every existing design is unchanged;
the three fields on the Original Driver pane's Advanced options are now live inputs, not greyed
placeholders. Engine functions `hotRe` and `withAddedMass` with their own tests; the field
registry documents each field's model, units, coupling, and no-op behaviour.

Along the way, corrected our own notes: WinISD's legacy help text calls these thermal params
"not used yet in simulations", but the empirical test proves that text is stale for 0.7.0.950 —
recorded in WINISD.md §12c as directly-verified evidence.

## 2026-07-20 — Original skin: truthful what-if + New-Project + spinner fixes

Preview a driver tweak without lying about the save state. STATE_MODEL Increment 2 adds a
driver what-if overlay: the charts and the Tune panel preview a live copy while the committed
design — and so the Unsaved indicator — stays put until you press Keep. Cancel discards it.

"New Project" now actually starts fresh. It previously kept the old design's filters, compare
traces, power and vents; now it resets to defaults, warns before discarding unsaved changes,
and asks for a project name first (shown in the titlebar and Project tab).

Refreshing the page keeps your place. The design, active tab, and selected chart already
survived a reload; now an open Tune with unsaved what-if values is restored too, reopened
mid-edit exactly as you left it — without dirtying the project.

Share a link that opens on the same page. A share link now carries the view context (active
tab + selected chart) alongside the design, so the recipient lands where you were — while
still keeping their own skin and not inheriting your half-finished edits.

Spinners hold their precision, robustly. Every number field — via the shared NumInput and the
v-expo-step directive — keeps its fixed decimal places while you spin and steps on a tidy grid
that is never finer than the field can show, so values below 1.0 no longer sprout extra
decimals and the down-arrow no longer sticks near zero. A class-wide test spins every field in
every box type to keep it that way. Verified across Modern and Classic too (shared code).

Series resistance now reads to 3 dp (0.100 ohm) like WinISD. One place decides every field's
decimal places. A typed field registry (packages/ui/src/fields/fieldRegistry.ts) is the source
of truth the Original skin reads its NumInput precision from — no more per-field literals to
drift — and a unit test anchors it back to the WinISD-screenshot evidence in
docs/winisd/INPUT_PARITY.md. Each entry also carries the field's unit, provenance
(entered/calculated), and — for calculated fields — its formula and dependencies, seeding a
small knowledge graph of the design's quantities.

Edit voltage OR power on the Signal tab. Driver input voltage is now editable and drives
System input power (P = V²/Re), matching WinISD's bidirectional pair.

One place defines every field. `fieldRegistry.ts` is now the canonical catalogue of every
field on the WinISD screens — description, derivation, dependencies, unit, precision, and
min/max sanity bounds — split into what OpenISD models vs. WinISD-only reference. Skins, tests,
UI design, and data-quality checks all read from it instead of hardcoding. Decimal places are
sourced from the WinISD screenshots (vent diameter corrected to 2 dp; humidity/pressure given
sane values with the divergence documented).

Physics lives in the engine, not five copies. The PR Vas/Fs/Qms, drive-voltage, and
sound-velocity formulas that were pasted across five components are now single engine functions
with their own tests — no drift, identical results in every skin.

Logged a WinISD crash: clearing its Air Pressure field traps the app in a "Cannot convert
floating point number" loop; OpenISD's equivalent field must guard empty input.

## 2026-07-05 — .wpr project file schema documented

Contributors building `.wpr` import/export (the gap called out in `COMPARISON.md`) now have a
starting map instead of a blank page. `WINISD_WPR_FILE_SCHEMA.md` reverse-engineers the WinISD
project-file format from 48 real user project files cross-checked against the official WinISD
help text: confirms `Box.BType` 0/1/4 = closed/vented/passive-radiator, the always-present-but-
often-inert vent/PR sections, and the filter-chain encoding — with every unconfirmed field (the
two unseen bandpass `BType` values, the `f`/`c` chamber triplet, `VentIntra`) explicitly flagged
rather than guessed at.

## 2026-07-04 — Cross-platform visual test baselines

SPL graph visual tests now pass on any OS, not just Windows. The canvas axis labels and app UI hardcoded `Segoe UI` (a Windows-only system font); on Linux the browser silently fell back to a different font with different glyph widths, shifting pixels enough to fail the screenshot comparison — unrelated to any physics change. Bundled `Inter` (self-hosted via `@fontsource/inter`, SIL OFL licensed) so every OS renders identical glyphs, added a `document.fonts.ready` redraw so the canvas never bakes in a fallback-font first paint, and dropped Playwright's per-OS snapshot suffix (`sealed-spl-win32.png` → `sealed-spl.png`) so one baseline set now covers Windows, Linux, and macOS.

Honest, current view of the competitive field. Contributors can now see where OpenISD actually stands against the live browser-based rivals — not just the discontinued WinISD. `COMPARISON.md` gained a five-part web-alternatives matrix (access, box types, graphs, data/formats, construction/crossover) covering 00 Simulator, SpeakerDesign.dev, SpeakerBoxLite and Sonella, every competitor cell marked ⚠ unverified because it is sourced from each tool's own site/roadmap rather than our own testing; `OTHER_TOOLS.md` (since merged into `FEATURE_COMPARISON.md`) and `REFERENCES.md` carry the per-tool research notes and a reference index (adding SpeakerDesign.dev, Sonella, 00 Simulator and closed-beta SoundForm). Makes the gaps (construction output, amplifier-load graph, `.wpr` import) and the uncontested edges (open source + open federated driver commons + CI-proven physics) explicit instead of implied.

## 2026-07-03 — Rebrand to OpenISD; safe-tool tooling

Project is now **OpenISD**, served at a real domain. Renamed everything user- and contributor-facing — app title/header/about, PWA manifest, package scope (`@openisd/*`), WDR `ProvidedBy`, docs, and the README (new banner using the app's own SPL/impedance curves). Physics terms (resonator/resonant) deliberately untouched.

Rebrand now complete — no brand remnants. Every remaining `Resonate` string was removed: the legacy localStorage read-fallbacks dropped (keys are `openisd_*` only), plus `LICENSE`, the dev-server log line, the demo drivers' `Manufacturer`/`ProvidedBy`, the federated source catalogue, and doc prose. Only the not-yet-renamed git repo URL (`github.com/Johnlon/resonate`) still carries the old name; the physics verb "resonate" is left alone.

Real domain, correct hosting. `openisd.app` set via a `CNAME` file with Vite `base` back to `/`, so the custom apex domain serves at root.

Fewer permission prompts without widening access. `grep_local` — a read-only grep locked to the project tree (relative paths, whitelisted flags, symlink-resolved containment, no `-exec`) — is safe to blanket-allow; the `safe-tools` skill captures the pattern so more such tools get built the same way.

Answers the "vibe-coded" jab head-on. `VIBE_CODING.md` reframes the old self-flagellating doc: it asks the accuser to define the term, then hands over the public trait-by-trait scorecard (tests, guardrails, and the rows still red) and lets the reader judge.

Code-review docs show only open work. Resolved findings are deleted from `CODE_REVIEW.md` (the repo's delete-on-resolve rule, numbers left as gaps so surviving `§N` stay stable), the `VIBE_CODING.md` scorecard is rewritten to describe current state rather than "§X resolved" history, and the stale references in the remediation/engine-hardening docs are repaired — no dangling pointers to removed findings.

## 2026-07-02 — Engine hardening: degenerate input never a silent blank chart

- **Impossible Q combinations are rejected, not silently turned to garbage.** A driver with `Qms ≤ Qts` (or `Qes ≤ Qts`) used to divide by zero deriving the third Q → `Infinity` → a blank chart with no reason given. It's now a clear blocking error naming the offending parameter.
- **A numerical singularity mid-sweep is explained, not mysterious.** The sweep output is classified for finiteness: an isolated bad point keeps the curve (drawn with a gap) and adds an amber note naming the frequency; a wholly non-finite result shows a red "can't simulate" issue instead of an unexplained empty graph. Communicated through the same issue list as driver errors — no exceptions thrown.

## 2026-07-02 — CI/deploy repaired, docs caught up to the monorepo

- **CI actually runs again.** The workflow had been calling pre-monorepo test paths (red since the engine was extracted); it now runs lint → type-check → unit (Vitest) → browser → build. The deploy workflow was publishing the wrong directory (`./dist` vs the real `packages/ui/dist`) — fixed.
- **Docs match the code.** ~17 docs still pointed at `src/core/…js` and `node --test`; updated to `packages/engine/src/…ts` and `npm run test:unit` so the run/test instructions you and contributors follow are correct.

## 2026-07-02 — Whole codebase migrated to strict TypeScript

- **Every source and unit-test file is now strict TypeScript.** The engine package, the Vue UI (all 18 components + store + utils), and the unit tests moved from plain JS to `.ts`/`<script setup lang="ts">` under `strict: true`. Types are modeled from the real runtime shapes, so the compiler now catches the whole class of missing-field / null-propagation bugs that used to surface only as blank graphs (the same family as the `Pe=0` bug).
- **Provably unchanged behaviour.** Done as a behaviour-preserving migration, not a rewrite: the golden-master fixtures still match byte-for-byte, all 162 unit tests pass, and the 30-test Playwright suite passes against the built app (self-test physics gates green, stat-bar values exact). No formula, constant, or calculation was touched.
- **Faster, type-aware test loop.** Test runner moved to Vitest (native `.ts`, watch mode, golden folded in); `npm run typecheck` (tsc for the engine, vue-tsc for the UI) is now a health-check and pre-commit gate, so a type error can't land.

- **You can zoom the charts now.** A frequency-span dropdown in the graph toolbar (1–500 Hz up to 1–40 kHz) sets the X range for every chart at once; because the sweep regenerates over the chosen band, the vertical scale auto-fits the visible data. Both axes are also directly draggable on each chart: grab the left (level) or bottom (frequency) axis strip — drag the middle to pan, the ends to zoom, Shift-drag for symmetric zoom, double-click to reset (Y→auto-fit, X→1–20 kHz). Directional cursors (↕ / ↔ / resize arrows / grab hand) cue what each part of a strip does. Range persists across reload; the gestures are listed in the graph-help panel.
- **Cursor controls decluttered.** Removed the 🔒/🔓 lock toggle and ✕ clear buttons. Clicking a graph now toggles the lock (click to lock the crosshair, click again to unlock and resume hover); the ◄ ► arrows flanking the Hz box step the cursor ±1% and lock it; the Hz box and right-click snap also lock. One gesture, no extra buttons.
- **SPL and Max-SPL auto-scale now show the whole curve.** These charts used a fixed window anchored at the peak (45 / 40 dB tall), so a deep low-frequency rolloff fell off the bottom of the frame. Auto-scale now extends downward to include the visible minimum (keeping that window as a floor, capped at 90 dB so the passband isn't squashed).
- **Xmax=0 no longer blanks the Max-SPL and Max-power charts.** A zero/absent Xmax used to force max-SPL to −∞ and max-power to 0 (empty charts, no axis). It's now treated as "no excursion limit", so the Pe (thermal) limit bounds the curve; the `1e9` magic sentinel became `Infinity`, matching the Pe branch. Golden output byte-identical for valid drivers; regression test added.

## 2026-07-01 — Invalid-driver handling, no-throws contract

- **A bad driver parameter no longer crashes the app.** Setting Fs (or any required T/S value) to 0/blank used to throw an uncaught error and blank every graph. Now each chart that can't be computed shows a plain message naming what to fix, the rest of the UI stays alive, and the state round-trips through reload so you can correct it.
- **Charts never draw incomplete data silently.** A chart is drawn only when every value it uses is valid: a missing _required_ param blocks the whole chart (with a message); a missing _optional_ line (Pe→thermal limit, Xmax→excursion limit) draws the real curve and lists the missing line as a dismissable issue. No half-curves presented as if complete.
- **One issue list, colour-coded by severity.** The driver panel now lists every active issue — red for "can't simulate", amber for "a reference line is missing" — each dismissable.
- **Calculations never throw; they return `{value, errors}`.** `deriveDriver`/`parseWdr` now report field-level, human-readable problems instead of throwing or silently producing NaN. Documented as a hard rule in `js-patterns.md` (third-party throwers must be wrapped); `buildPlotData` follows the same contract so the view never inspects store internals to decide what to draw.

## 2026-07-01 — WDR field documentation, _ directory convention

- **Max-SPL curves no longer lie when Pe is absent.** Removed the silent 50 W fabrication in `sweep.js`; curves now show only the Xmax limit, and a dismissible warning flags the gap to the user.
- **WinISD's non-functional WDR fields documented.** §16 added to `WINISD.md`: which fields do nothing in WinISD (Znom, alfaVC, Rt, Ct), which are metadata only, which would change output if entered (Hc/Hg), and VCCon's unverified DVC path.
- **`_` prefix is now the one rule for cache directories.** `bundle-drivers.mjs`, Vite's watch list, `.gitignore`, and all three scraper libs now treat any `_`-prefixed directory as excluded — no more named exceptions to maintain.

## 2026-07-01 — Driver editor rebuild, test guardrail

- **Editor shows what each field is and which graph it feeds.** 3-column grouped form, WinISD-style dimensions diagram, graph↔field legend, "what each graph needs" expander with click-to-highlight, field-purpose tooltips from one source.
- **Editor honest about missing vs derived.** Datasheet values stick, derived fields stay editable, required-but-missing turn red, disabled graphs flagged when an optional field is blank.
- **Try it in one click.** Bundled demo drivers load on open; reset-to-demo button; sweep defaults to the full band (10 Hz–20 kHz).
- **Silent UI corruption can't hide.** Fixed a duplicate `v-for` key (phantom search matches); console+network guardrail retrofitted into every browser test via a shared fixture; mattpocock TDD skill added.

## 2026-06-30 — Script suite, mobile

- **First step toward phone support (still rough — a prototype).** Responsive layout, Controls/Graphs tab switcher, two-colour MaxSPL curve.
- **One reliable command to start/stop/test.** Physics moved to the `@openisd/engine` workspace package; script suite (`health-check`, `start/stop/kill-http`, `dev-4200`) with fixed port assignments.
- **Branch safety and releases codified.** dev/main branch model + `release-drivers` skill; `--no-verify` tech debt removed.
- **Wrong-shell failures are loud, not silent.** Windows + Git Bash requirement documented; `MSYSTEM` guard in every script.
- **DQ output legible and actionable.** `dq_check` live progress, reliable TTY detection, clickable `file://` report links.

## 2026-06-29 — Scraper re-architecture

- **Library regenerable from scratch in one pass.** Enrichment pipeline dropped; scrapers write `driver_type` and frequency range directly, removing a second authority that had been drifting from the first.
- **Every driver shows where its numbers came from.** Unified `specs:` block with provenance across 4,844 drivers; schema hardened (coaxial support).
- **Link fields unambiguous.** URL fields given a consistent `_url` suffix; canonical field order.

## 2026-06-26 — Schema docs, CI coverage

- **WDR format documented and defensible.** Inferred schema with sources; WinISD legacy reference files.
- **Every test runs on every change.** All tests wired into CI; BACKLOG audited for honest impl/test status.
- **Long scripts no longer look hung.** Progress/monitoring rule strengthened.

## 2026-06-25 — Driver types + data-quality tooling

- **Find the right kind of driver fast.** Multi-label type system (Bass/Sub/Woofer/Mid/Tweet/Full-range/PR), type chips, Fs/Sd/Z filters, source filter, datasheet links.
- **More collections, traceable sourcing.** Scan-Speak, Wavecor; datasheet URLs across 1,639 SoundImports; `boxbench_` field standard.
- **Bad data caught systematically.** `dq_check.py` as single source of truth; many Vas/Fs/Sd/URL corrections; batch-fix SOP; interactive Vas verifier.
- **Data honesty protected by rule.** Hard rule: no "human-verified" language without permission; WinISD-internal fields stripped.

## 2026-06-24 — Circuit calibration + driver library

- **SPL matches the tools designers already trust.** Circuit model calibrated to WinISD; cursor tools, box-losses UI, legend, linked W/V + 2.83 V (IEC) button; power→voltage fixed to use Re.
- **Library large enough to be useful.** Parts Express grown to 1,673; SB Acoustics added (201); vendor-scraper infrastructure.
- **Browser opens instantly.** WDRs bundled at build; token-based search.
- **Every scraped file traceable to origin.** Provenance watermark on all scraped WDRs.
- **Tests read as scenarios.** Human-readable unit suite; button-tooltip and WinISD cross-ref rules enforced.

## 2026-06-23 — ES-module core, Vue/Vite/PWA

- **Physics testable in isolation.** Engine extracted to `src/core/` as native ES modules; `file://` constraint dropped.
- **Regressions caught in CI, not by users.** Playwright browser tests wired into CI.
- **Fast load, installable, works offline.** Vue 3 + Vite + PWA; GitHub Pages deploy on push.
- **Shape the response, not just the box.** Filter/EQ chain: high-pass, low-pass, Linkwitz, parametric.
- **Formulas checkable against sources.** Verified Wikipedia + AES citations in core modules.

## 2026-06-22 — Inception

- **Box simulation in the browser — no backend, no account, no cost.** Shipped the initial client-side simulator.
- **Start from real drivers, not hand-typed T/S values.** Federated sources + in-app browser, seeded with ~430 de-duped drivers from WinISD community libraries.
- **Compare competing box designs at once.** Multi-graph grid, design-compare, collapsible driver panel.
- **Work survives reloads and is shareable.** URL state, design export/import, persistence; SPL driven by power (W).
- **Shared understanding before code diverges.** FEATURES survey, TODO backlog, DEVELOPMENT practices, PLAN, ARCHITECTURE (four hard decisions).
