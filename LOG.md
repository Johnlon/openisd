# OpenISD — change log (value-first)

**Purpose:** a record of meaningful changes — functional, quality, procedural — each stated by the benefit it delivered, then how it delivered it. Git holds the mechanics; this holds the reason a change was worth making.

**Entry format:** benefit first, then a terse how. Newest day at the top.

**Status:** the one sanctioned history file in the repo — see the "No history in documentation" exception in `CLAUDE.md`. Agents append the day's entries at end of session (`CLAUDE.md` "Value log" rule).

---

## 2026-08-10 — Fsc/Qtc lossy calculation, auto-calculate toggle, and parameter provenance inspector

- **Calculated system resonance (Fsc) and Q (Qtc) match WinISD's lossy physical models.** Implemented `findImpedancePeak` analyzing simulated electrical impedance magnitude curve to extract actual resonance frequency and Q-factor under box leakage losses (Ql).
- **Toggle consistency solver to prevent unsolicited auto-calculations.** Added a checkbox option in the Driver Editor ("Auto calculate unknowns") that can disable automatic parameters solving, preserving exact driver records on export.
- **Understand how driver parameters derive through interactive visual feedback.** Added a "Inspect Provenance" toggle to the Driver Editor which highlights input/derived dependency relationships on parameter fields and opens an interactive Equation Inspector popup displaying relevant calculation paths.
- **Enforced bidirectional traceability between specs and tests.** Retrofitted OpenSpec format with `openspec/project.md` and capability specifications mapping all 72 test files, backed by an automated validator script integrated into the health check and git pre-commit hook.

## 2026-08-08 — Exact Transfer Function chart normalization parity with WinISD

- **Transfer Function Magnitude chart 0 dB reference level.** Fixed Transfer Function Magnitude normalization in `packages/ui/src/utils/series.ts` to anchor 0 dB to the high-frequency passband asymptote (`sw.spl[sw.spl.length - 1]`) instead of the curve's peak, preventing vertical curve offsets on resonant alignments and matching WinISD's plot behavior.
- **Documented Transfer Function normalization contract.** Updated `WINISD.md` to formally document high-frequency passband asymptote normalization for relative dB charts.

## 2026-08-05 — My Drivers is the one destination for a driver you made

- **Unified 4th-order bandpass vents horizontal layout.** Replaced the tall, single-column vertical vent layout for 4th-order bandpass with the 3-column horizontal layout (Config, Dimensions, Readouts) matching standard vented views.
- **Editable ABC and 6th-order bandpass tuning frequencies.** Enabled editing for both tuning frequencies on the Box tab when 6th-order bandpass or ABC box type is selected, rendering them as editable `NumInput` fields labeled `Tuning freq (Frc)` (rear chamber) and `Tuning freq (Ffc)` (front chamber).
- **Editable bandpass 4th order front chamber tuning.** Made the front chamber tuning frequency in a 4th-order bandpass box type editable (labeled `Tuning freq (Ffc)`) rather than read-only. The system now solves for the front chamber vent length using the front volume `Vf` (instead of `Vb`).
- **Clarification of automatic vent length calculation.** Added a clear hint on the Vents page to clarify that physical port length is solved automatically to satisfy the target box/chamber tuning frequency (`Fb`) defined on the Box tab.
- **Save incomplete drivers without lockouts.** OK, Save, and Copy buttons remain enabled for incomplete driver profiles, allowing users to preserve incomplete driver data while displaying a warning strip detailing what is missing for simulation.
- **Brand/Model presence validation popup.** Replaced silent disabled buttons with an active dialog popup explaining that Brand and Model are required, transferring caret focus to the empty field on dismiss.
- **Slotted vent support.** Added support for width and height dimensions of slotted vents in the original shell, adjusting the effective Helmholtz resonance and vent calculations accordingly.
- **Type safety in Vue templates.** Shifted TypeScript type assertions from Vue template event bindings to script helpers, preventing ESLint parser misfires that caused false positive unused variable warnings.
- **Vent group provenance stability.** Restored the non-eviction locking behavior in `enterVentField` so that entering both `Fb` and `ventL` locks both as entered rather than deleting the other.
- **Derived parameters (Mms, Cms, Rms, Bl) are editable in the editor.** They were previously read-only text fields, which prevented overriding or recalculating them. They now use `NumInput` elements and bind to `cellVal` so they can be edited (state E) or cleared to calculate (state C) just like in the Define Driver modal.
- **Unentered fields show as blank instead of 0.00.** Bindings to `driverRaw` optional/derived fields used to default to `?? 0`, which displayed as `0.00` and caused validation warnings/DQ alerts. All fields now bind to `cellVal` to properly show as empty/blank when not entered.
- **Fixed Qts not calculating when Qms and Qes are set.** Pre-populating unentered fields with `0.00` caused the consistency solver to treat them as entered values of `0`, skipping total Q calculation. Removing the zero defaults allows `Qts` to automatically derive.
- **Every way of creating a driver now ends in the same place.** Add new Driver, Clone driver, Load File… and saving a `.wdr` then loading it back all land in My Drivers, so a driver you made is somewhere you can find it again. Loading a file used to drop the driver straight into the project and store it nowhere, which meant the only copy was the design you then edited over.

- **Clone driver exists in the WinISD picker.** It forked a driver in the Modern skin only; the Classic and Original skins had no way to copy a driver at all. One implementation now serves both pickers, forking as `brand` + "Copy of <model>" — a distinct identity, so the copy stands beside its source instead of replacing it.
- **Edit is offered only where it can work.** The WinISD picker's summary carries an Edit button that is live for a driver from My Drivers and visibly disabled for a library record, which cannot be changed from there.
- **"Add new Driver" starts genuinely blank.** It pre-filled the brand with the word `custom`, which a user then had to notice and delete. OK stays disabled until brand and model are supplied, so nothing can be saved without the identity it will be filed under.
- **A driver file carrying no brand or model still gets an identity** — taken from the file's own name — instead of being saved as an unnameable, undeletable row.
- **The Original skin stopped hijacking the driver editor.** Opening the editor on a new or a saved driver silently re-pointed it at the project's driver, so OK overwrote the open design instead of saving the driver. `bugs/BUG_20260805_original-shells-editor-restore-watcher-hijacks-every-editor-open.md`.
- **One function writes My Drivers.** Six places implemented "save this driver" with their own copy of the identity-collision rule; they call `upsertMyDriver` now, so the rule cannot differ depending on which button was pressed.
- **The driver file formats are an enum, not a pair of loose strings.** `.wdr` / `.owdr` carry their own label, MIME type and file-input `accept` list, so the save dialog, the loader and the format picker cannot drift apart.
- **Group delay reads zero rather than negative zero** for a flat phase response — no such delay exists, and the sign leaked into equality comparisons.

## 2026-08-04 — Choosing a driver embeds it; a driver IS its brand/model

- **Mandatory brand, model, and core parameter input validation in the editor.** Enforces validation with visual cues (bold borders by default, turning red when empty) and disables saving/exporting on Brand, Model, Fs, Vas, Re, and Sd to prevent incomplete drivers from corrupting project state.
- **"Add new Driver" opens the full driver editor.** The flow is streamlined by opening the full driver editor pre-seeded with `brand='custom'` and `model` blank, letting the user define a custom driver directly inside the main editor instead of hitting a secondary T/S parameters wizard.
- **Support for loading both .wdr and .owdr formats.** The file input in the editor and file loader in the browser now accept both legacy `.wdr` and native `.owdr` files, parsing and converting WinISD parameter sets on demand.
- **Visual DQ indicators for bad or missing data.** High-priority data quality alerts (warnings) display next to core fields when a required field is entered with a suspect value (e.g. value ≤ 0) or is missing required values like a model name on custom drivers.
- **Quick-fix data quality buttons.** An inline "clear" button allows users to strip bad values directly from a field to instantly let the engine auto-calculate them from other parameters.
- **Data quality warning badges in selector list.** An amber warning triangle ⚠ displays next to any driver in the library browser that is missing core simulation parameters or has faulty inputs, notifying users of issues before they embed the driver.
- **Choosing a driver puts you back in the project.** It used to open the driver editor on a proposal and leave the picker behind it, so picking a driver meant dismissing two dialogs before seeing the result. Choosing now copies the driver into the project and closes the picker — WinISD's model, where the driver manager and the project are separate things.
- **A project owns its driver outright.** Editing it changes the project's copy and nothing else: not the library record, not the saved driver it came from. Previously an edit could reach back into My Drivers, which made "try these numbers" quietly rewrite a stored driver.
- **A saved driver is identified by `<brand>/<model>`** — the same scheme the driver database uses for its folders, brand first because that is what a driver is sold as. Save overwrites the driver with that identity and adds one when there is none, so editing brand or model saves a new driver and editing anything else updates it in place. Clone forks deliberately, as "Copy of …".
- **Deleting a saved driver works for every driver.** Deletion compared display names, and an entry with no `name` compared equal to every other unnamed one — so the ✕ removed the wrong row or none at all. It keys on identity now.
- **A saved driver with no explicit name is visible at all.** My Drivers rendered and searched the raw `name` field, so an entry carrying only brand and model — the normal shape when saved from a record — drew a blank row that no search could match.
- **The driver editor says which driver you are editing**, and carries a "Copy to My Drivers" button that takes an independent copy of what is on screen.
- **One place knows where saved drivers live.** The storage key and its read/write were duplicated across three components; they share `utils/myDrivers.ts`.
- **The driver picker's source reads "OpenISD".** Shorter than "OpenISD driver database" in the source filter, where the column is narrow.

## 2026-08-03 — Scraping stack removed; `_meta.yml` gone; bundle reads `openisd.yml`

- **One project owns scraping again.** openisd carried a second, unused scraping pipeline — six vendor scrapers, a scraper library, a pydantic schema module and a DQ CLI, none of them reachable from any script, hook or workflow. Deleted; winisd_tools is the only scraper, as the workspace architecture says.
- **The dead sidecar format is fully gone.** `_meta.yml` had been superseded by `openisd.yml` but survived in ~90 references across 20 documents plus 438 orphaned data files. All removed. A reader now finds one answer to "where does provenance live", not two.
- **The driver bundle matches the architecture.** `bundle-drivers.mjs` reads `openisd.yml` records only — never `.wdr`, never `.owdr` — so the bundle can no longer disagree with AD-8 about what a driver record is. `.wdr` stays what it always was: a WinISD import/export format the app converts in memory.
- **The health check is honest about what it runs.** It listed six gates including two Python steps; one scanned zero files and the other only kept deleted code importable. Four real gates now: lint, typecheck, unit, browser.
- **Transient files have one home.** `build/` is the scratch space, enforced by tests over `.gitignore` and Vite's watcher, replacing a cache-directory convention that existed only for the deleted scrapers.

## 2026-08-02 — Default skin changed to Original & unfinished skin warnings

- **Original skin is now the default skin.** Swapped the default UI skin from modern to the classic WinISD-ported `original` skin for a fresh application load.
- **Unfinished skins display warnings when active.** Added a warning banner and flash toast when switching to or displaying unfinished skins (modern/classic) to advise users of incomplete work.
- **Playwright browser tests stabilized and pass on WSL2.** Resolved headful/headless Chromium launch crashes on WSL2 by adding GPU-disabling arguments, and avoided test breaks by dynamically defaulting to the modern skin in the test environment (port 4100).

## 2026-07-29 — Complete retro skin alignment & advanced parameters

- **All advanced and physical driver parameters are fully modelled and editable.** Wired all previously disabled/placeholder fields in `DriverEditorModal.vue` to active input components, enabling complete roundtrip editing of metadata, electrical figures of merit, and physical dimensions.
- **Modals styled with classic Win32 theme in both retro skins.** Aligned all modals (Options, Catalog Browser, Editor, Box Losses, and Project Wizard) under both `Original` and `Classic` skins to render with retro blue titlebars and square gray layouts.
- **Trace color customization wired in the Classic skin.** Clicking the **Color** button in the Classic skin now cycles the design trace color across the swatch and graph curves, matching original WinISD functionality.

## 2026-07-04 — Cross-platform visual test baselines

SPL graph visual tests now pass on any OS, not just Windows. The canvas axis labels and app UI hardcoded `Segoe UI` (a Windows-only system font); on Linux the browser silently fell back to a different font with different glyph widths, shifting pixels enough to fail the screenshot comparison — unrelated to any physics change. Bundled `Inter` (self-hosted via `@fontsource/inter`, SIL OFL licensed) so every OS renders identical glyphs, added a `document.fonts.ready` redraw so the canvas never bakes in a fallback-font first paint, and dropped Playwright's per-OS snapshot suffix (`sealed-spl-win32.png` → `sealed-spl.png`) so one baseline set now covers Windows, Linux, and macOS.

Honest, current view of the competitive field. Contributors can now see where OpenISD actually stands against the live browser-based rivals — not just the discontinued WinISD. `COMPARISON.md` gained a five-part web-alternatives matrix (access, box types, graphs, data/formats, construction/crossover) covering 00 Simulator, SpeakerDesign.dev, SpeakerBoxLite and Sonella, every competitor cell marked ⚠ unverified because it is sourced from each tool's own site/roadmap rather than our own testing; `OTHER_TOOLS.md` and `REFERENCES.md` carry the per-tool research notes and a reference index (adding SpeakerDesign.dev, Sonella, 00 Simulator and closed-beta SoundForm). Makes the gaps (construction output, amplifier-load graph, `.wpr` import) and the uncontested edges (open source + open federated driver commons + CI-proven physics) explicit instead of implied.

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
- **Calculations never throw; they return `{value, errors}`.** `deriveDriver`/`parseWdr` now report field-level, human-readable problems instead of throwing or silently producing NaN. Documented as a hard rule in `CODE_REVIEW/ENGINE_HARDENING.md` (third-party throwers must be wrapped); `buildPlotData` follows the same contract so the view never inspects store internals to decide what to draw.

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
