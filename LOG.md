# Resonate — change log (value-first)

**Purpose:** a record of meaningful changes — functional, quality, procedural — each stated by the benefit it delivered, then how it delivered it. Git holds the mechanics; this holds the reason a change was worth making.

**Entry format:** benefit first, then a terse how. Newest day at the top.

**Status:** the one sanctioned history file in the repo — see the "No history in documentation" exception in `CLAUDE.md`. Agents append the day's entries at end of session (`CLAUDE.md` "Value log" rule).

---

## 2026-07-02 — Chart zoom, Max-SPL/Power robustness

- **You can zoom the charts now.** A frequency-span dropdown in the graph toolbar (1–500 Hz up to 1–40 kHz) sets the X range for every chart at once; because the sweep regenerates over the chosen band, the vertical scale auto-fits the visible data. Both axes are also directly draggable on each chart: grab the left (level) or bottom (frequency) axis strip — drag the middle to pan, the ends to zoom, Shift-drag for symmetric zoom, double-click to reset (Y→auto-fit, X→1–20 kHz). Directional cursors (↕ / ↔ / resize arrows / grab hand) cue what each part of a strip does. Range persists across reload; the gestures are listed in the graph-help panel.
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
- **One reliable command to start/stop/test.** Physics moved to the `@resonate/engine` workspace package; script suite (`health-check`, `start/stop/kill-http`, `dev-4200`) with fixed port assignments.
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
