## Context

Inventory of every root/`docs/**` Markdown file (34 total) plus `bugs/*.md` (5): no
documentation-structure rule exists anywhere in the repo (`grep` confirms), role duplication
across 4 files for "how to work on this repo" including a live factual contradiction, driver-
data-model content split between root and `docs/` with no visible reason, WinISD-parity
comparison duplicated at two granularities, third-party-competitor research duplicated across
2 files, one file (`docs/winisd/AUTOMATED_DIAGNOSTICS.md`) duplicating content that lives in
more detail in a sibling repo, and 7 files that are fully executed plans, a frozen audit, a
dead stub, or persuasive prose. `AGENTS.md` is a recognized special filename Claude Code
auto-loads every session — not a candidate for renaming, only for absorbing content.

## Goals / Non-Goals

**Goals:**
- One directory tier per document *role* — spec, design, plan, or research — not one file per
  investigation that produced content on a topic, and not an accident of when a file was
  written.
- Every file's tier is inferable from its path alone, without opening it.
- Root holds only what a new reader/agent needs in the first few minutes.
- No two files claim the same "living reference" role for the same subject, at any tier.

**Non-Goals:**
- Not creating new specs for `OpenISDDriver`/`WinISDDriver` or `store.ts`'s governed-function
  surface — real gaps, flagged, but new authorship is follow-up work, not this reorg.
- Not merging `MATH_MIGRATION.md`/`PLAN_JS_CALC_CONSOLIDATION.md`'s overlapping scope — both
  are active, mid-flight plans; relocating them to a consistent tier is in scope, editing
  their content is not.
- Not touching `BACKLOG.md`/`WIP.md`'s internal organization, or `REFERENCES.md`'s content.
- Not modifying `../winisd_research` — `docs/winisd/AUTOMATED_DIAGNOSTICS.md`'s deletion
  depends on `WINE_HARNESS.md` already existing there (verified present), not on creating
  anything there.

## Decisions

**1. Four `docs/` tiers, defined by role, not subject:**

| Tier | Question it answers | Contents after this change |
|---|---|---|
| `docs/spec/` | "What must this interface/behavior do, precisely?" | `SPEC_ENGINE.md`, `SPEC_UI.md`, `CONTRACT.md` |
| `docs/design/` | "What is the current architecture/data model?" | `DRIVER_RECORD_MODEL.md`, `WINISD_SCHEMA.md`, `DRIVER_ADT_DESIGN.md`, `STATE_MODEL.md` |
| `docs/plans/` | "What phased work is executing this?" | `PLAN_OPENISD_DRIVER_MODEL.md`, `PLAN_JS_CALC_CONSOLIDATION.md`, `PLAN_SBL_CROSSCHECK.md`, `MATH_MIGRATION.md` |
| `docs/research/` | "What did we find out, that isn't itself a contract?" | `WINISD_PARITY.md`, `WINISD.md`, `COMPETITIVE_LANDSCAPE.md`, `REFERENCES.md` |

Alternative considered: keep the existing ad-hoc root-vs-`docs/` split and only fix file
duplication, not placement. Rejected — the user explicitly asked for "clean and consistent,"
and a file-count fix that leaves `docs/DRIVER_ADT_DESIGN.md` (design) sitting next to
`docs/spec/SPEC_ENGINE.md` (spec) with no boundary between them reproduces the exact
no-visible-principle problem being fixed, one level down.

**2. `CONTRACT.md` merges into `SPEC_ENGINE.md` + `SPEC_UI.md` and is deleted — not kept as a
third file, even relocated.** First draft of this decision said "move it into `docs/spec/`,
same role, no merge" — checked directly and that's wrong: `CONTRACT.md`'s "Equations" section
(lines 58-68: `Qts`/`Cms`/`Mms`/`Rms`/`Bl`) restates the *exact same formulas* as
`SPEC_ENGINE.md §1.1` — except `SPEC_ENGINE.md` cites its verifying tests
(`consistency.test.ts`, `driver.test.ts`) and `CONTRACT.md` cites one unsourced Wikipedia
link. Genuine duplicate content, not just adjacent role — the same "wordy, imprecise
restatement" pattern this whole reorg exists to remove, one level deeper than the file list.
`CONTRACT.md`'s real unique value — the typed `RawDriver`/`Driver`/`Curves`/`MaxCurves`/
`Filter[]` input/output tables, File I/O section, physical constants, versioning — is real and
worth keeping, so it's folded in as a **Data Shapes** section: engine-side shapes (Driver,
Sweep, MaxCurves, Filter[], constants) into `SPEC_ENGINE.md`; chart/UI-facing shapes (Curves
consumption, Series) into `SPEC_UI.md`. The duplicate equations are dropped in favor of
`SPEC_ENGINE.md`'s already-cited version, not kept twice. The `parseWdr` "throws" claim
(`CONTRACT.md:~200`) is corrected during the merge, not left for later — it must not survive
into either target file wrong.

**3. `WINISD_OPENISD_COMPARISON.md` + `docs/winisd/INPUT_PARITY.md` merge into
`docs/research/WINISD_PARITY.md`.** Correction from this proposal's first draft, which
grouped `WINISD_OPENISD_COMPARISON.md` with third-party competitor research — wrong: WinISD is
the parity oracle (`AGENTS.md`'s own framing), not a competitor, and its comparison content
belongs with the other WinISD-comparison file, not with SpeakerBoxLite/Sonella/etc.
**Every claim in `INPUT_PARITY.md` was verified row-by-row, directly, against the live
Original skin** (the only skin this doc is applicable to — Classic is mothballed and not a
parity target). Of roughly 25 checkable rows, 6 are confirmed wrong, 1 is confirmed
partially wrong, and the rest confirmed accurate:

- **Added mass to cone (driver)** — claimed ❌ ("only PR added-mass exists"); actually live
  and engine-wired: `OriginalShell.vue:1177` `state.P.driverAddedMass` →
  `packages/engine/src/sweep.ts:126` `withAddedMass()`, WinISD-verified in
  `packages/ui/src/logic/fields/fieldRegistry.ts:431` (+100g on a ~14.6g cone shifts Fs
  70→25 Hz).
- **Voice coil temp rise (K)** — claimed ❌ ("no thermal/power-compression input"); actually
  live and engine-wired: `OriginalShell.vue:1175` `state.P.vcTempRise` → `circuit.ts:117`
  `hotRe(drv.Re, P.alfaVC, P.vcTempRise)`.
- **Environment defaults (App Options)** — claimed the section doesn't exist at all; it does,
  full temp/pressure/humidity fields (`OptionsModal.vue:182-192`, `envDefaults.{tempK,
  pressurePa,humidityPct}`). Corrected to ⚠️ (UI exists, calc wiring incomplete — matching
  what the doc's own Advanced-pane row already correctly says about the same gap), not ❌.
- **Box pane — PR-box Fh formula** — describes a since-fixed bug: claims the PR box shows the
  sealed-box formula instead of WinISD's PR system tuning. `OriginalShell.vue:134-142` now
  calls `prTuning(state.P)` specifically, with a comment citing the exact discrepancy
  (72.25 Hz vs. sealed's wrong 194.87 Hz) as the reason it's separate. Stale for the PR case —
  **but the same row's plain-vented-box claim is CONFIRMED STILL TRUE**: `boxResonance`
  (`OriginalShell.vue:143-144`, `selectedBox.value === 'pr' ? prFh.value : rearResonance.value`)
  falls through to `rearResonance` — the sealed-box `Fsc` — for every non-PR box, vented
  included. Only half this row is stale; the other half is a real, still-open bug and the
  merge must say so precisely, not mark the whole row resolved.
- **Project pane — Creator/Created/Modified/Description** — claimed the fields don't exist.
  **Confirmed wrong**: all five are live `v-model` bindings in Original —
  `OriginalShell.vue:1385-1388` (Name/Creator/Created/Modified text inputs),
  `:1392` (Description textarea) — auto-populated on project creation
  (`:271-274`, `:316-321`) and stamped on save (`:780`). Corrects to ✅, not ⚠️.
- **Charts — EQ/Filter transfer-function/phase curves** — claimed OpenISD lacks "the EQ/Filter-
  and PR-specific transfer-function/phase curves." **The EQ/Filter half is confirmed wrong**:
  `FltMag`/`FltPhase`/`FltGD` are real `ChartTabId` members (`types.ts:22-24`, comment-labeled
  "WinISD's '(EQ/Filter)' charts") with working curve builders (`series.ts:189,201,212`), not
  stubs. The PR-specific half is confirmed accurate — no PR-variant chart type exists anywhere
  in `ChartTabId`. Corrects to ⚠️ (PR-specific missing, EQ/Filter present), not a flat ❌.

Six rows confirmed wrong, one confirmed partially wrong. The added-mass/temp-rise/
environment-defaults errors share one root cause: the doc's original author appears to have
checked the Classic skin (where the added-mass field is a disabled `0.00000` stub) rather
than Original.

**Everything else checked is confirmed accurate**, independently, directly against the code —
not assumed: `Simulate voice coil inductance` (`fieldRegistry.ts:281-283`), `Force flat
response`/`Rg at driver side`/transmission-line port (`store.ts:50`, `circuit.ts:116-117,123`),
`SPL graph Xmax-limited` (`fieldRegistry.ts:301-303`), `Xlim`/`c`/`roo`/figure-of-merit
fields/`Dvol` (all `modeled: false` in `fieldRegistry.ts`), Filters — all-pass/DLP raised-
cosine/static-gain absent, the rest present (`FilterType`, `engine/types.ts:137`, a closed
union with none of the three), Charts — VA load/port Gain/intrachamber velocity genuinely
absent (`OriginalShell.vue:222,231,233,234`, `tab: null`), and units metric↔imperial — no
global toggle exists anywhere, only per-field `UnitToggle` components. This is not a
wholesale rewrite: it's seven specific, verified corrections during the merge into
`WINISD_PARITY.md`, against a base of roughly 18 rows that were already right.

**3b. `WINISD.md` merges fully into `WINISD_PARITY.md` — one file, not two (human ruling,
overrides this document's earlier "keep separate" call).** Checked directly:
`WINISD.md` has 18 numbered sections (with a genuine pre-existing defect — two different
sections are both numbered "§11," "Open questions" and "SpeakerBoxLite API"). Most of it is
derivation/investigation narrative that can't collapse into a comparison-table row without
losing the "how we confirmed this" reasoning. Two specific problems found while checking,
folded into the merge rather than carried over as-is:
- **§13 "Driver Editor UI — Complete field inventory"** substantially duplicates
  `INPUT_PARITY.md`'s per-tab field tables — its content is absorbed into
  `WINISD_PARITY.md`'s existing tables during the merge, not kept as separate prose.
- **§11 "SpeakerBoxLite API — CORS finding"** is misfiled — competitor-tool research, not
  WinISD-parity research. Moves to `COMPETITIVE_LANDSCAPE.md` during the same pass.
The duplicate "§11" numbering is fixed as part of touching the file regardless of the merge
decision. Net result: `docs/research/` holds one `WINISD_PARITY.md` (comparison tables +
investigation narrative + the corrected findings from §3 above), not two files on the same
subject — closing the exact "which file has the current answer" problem this reorg exists to
fix, applied to the one place it survived my first pass.

**4. `docs/winisd/AUTOMATED_DIAGNOSTICS.md` is deleted, not relocated.** It documents the
Wine automation harness at a summary level; `../winisd_research/WINE_HARNESS.md` documents
the *same* harness in far more depth, with `file://` line-linked references to the actual
scripts, and is actively maintained (dated same week). The openisd copy's own text admits the
harness "is located under `winisd_research/` (outside the openisd repository root)" — it was
never describing anything that lives in this repo. Alternative considered: move it into
`docs/research/` alongside `WINISD_PARITY.md`. Rejected — it would still be a strictly inferior
duplicate of a file that already exists and is better; deleting is honest, moving is not.

**5. `WINISD.md` (957 lines) gains a status legend, doesn't merge with `WINISD_PARITY.md`.**
It's a different *shape* of content — individual narrative findings/bugs, not a structured
comparison table — so merging would produce one unwieldy file mixing two formats. Its actual
problem (flagged in the original inventory, not fixed by relocation alone) is that it mixes
closed and open investigations with nothing distinguishing them; this change adds an explicit
✅ Resolved / 🔴 Open marker per section as part of moving it, so relocating it without also
fixing the thing that made it unreliable would be moving the mess, not fixing it.

**6. Third-party competitor research merges into `docs/research/COMPETITIVE_LANDSCAPE.md`,
scoped to non-WinISD tools only** (SpeakerBoxLite, SpeakerDesign.dev, Sonella, 00 Simulator,
LoudspeakerLab) — `OTHER_TOOLS.md` + `FEATURES.md`'s competitor section. `FEATURES.md` keeps
its own product feature list and gains a pointer to the new file.

**7. Retire-by-deletion, not an `archive/` folder** (unchanged from the first draft): git
history already preserves every retired file; a project `archive/` directory is a second
place for stale content to accumulate.

**8. `AGENTS.md` absorbs `CONTRIBUTING.md`/`DEVELOPMENT.md`/`SDLC.md`** (unchanged from the
first draft): one file makes a second contradictory copy of "how to work here" structurally
impossible, which cross-links already failed to prevent once. `DEVELOPMENT.md`'s architecture
diagram and Windows-only claim are corrected against the real tree and the verified-current
WSL2-primary environment before merging, not carried over wrong.

## Risks / Trade-offs

- **[Risk]** A merge silently drops a fact one source file had that the other didn't (e.g. a
  specific parity finding only in `INPUT_PARITY.md`, not in `WINISD_OPENISD_COMPARISON.md`).
  → **Mitigation**: every merge in `tasks.md` is a read-through of both full source files
  before either is deleted, not a pick-one-and-discard; `INPUT_PARITY.md`'s claims were
  already spot-checked during this design pass specifically to reduce this risk before
  committing to the merge decision.
- **[Risk]** Deleting a file some other doc or code comment still links to produces a dead
  link. → **Mitigation**: `tasks.md` includes a repo-wide grep for every retired/moved
  filename before deletion; the known hits are already named in proposal.md's What Changes.
- **[Trade-off]** This is a larger single change (4 new directories, ~20 file operations)
  than the first draft. Accepted — a docs-only change, easy to review as one diff, and
  splitting a structural reorg into several changes would leave the repo in a
  half-migrated, arguably worse-than-before state between them.
