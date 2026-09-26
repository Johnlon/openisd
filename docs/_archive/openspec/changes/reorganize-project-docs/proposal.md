## Why

34 root/`docs/**` Markdown files plus 5 `bugs/*.md` (39 total) carry the project's
architecture, rules, and requirements, with no organizing principle governing where a file
lives — `docs/DRIVER_ADT_DESIGN.md` and root's `DRIVER_RECORD_MODEL.md`/`STATE_MODEL.md` are
the same *kind* of document (driver/state design) split across two locations for no
documented reason; `grep` for any documentation-structure rule in `AGENTS.md`/`ARCHITECTURE.md`
returns nothing. On top of the missing structure: three-to-four-way duplication of "how to
work on this repo" (`AGENTS.md`/`CONTRIBUTING.md`/`DEVELOPMENT.md`/`SDLC.md`, with a direct
factual contradiction between two of them — Windows-only vs. WSL2); `WINISD_OPENISD_COMPARISON.md`
and `docs/winisd/INPUT_PARITY.md` both independently compare openisd against WinISD at
different granularity; third-party competitor research duplicated across `FEATURES.md`,
`OTHER_TOOLS.md`; `docs/winisd/AUTOMATED_DIAGNOSTICS.md` duplicates content that lives, in far
more detail, in the sibling `../winisd_research/WINE_HARNESS.md`; and seven files are fully
executed plans, a frozen audit of code nobody may touch, a dead stub, or persuasive prose
rather than reference material. This session hit two of these costs directly this week — a
same-session mistake (an auto-clear mechanism that violated an already-ruled DQ-marking
policy) and a full architecture migration (`ARCHITECTURE.md` AD-8) decided 2026-07-31 and
never executed — both preventable with a concise, current, single-source, clearly-organized
doc set.

## What Changes

**A directory principle, applied to every remaining file, not just one cluster:**
- `docs/spec/` — precise interface/behavior contracts: `SPEC_ENGINE.md`, `SPEC_UI.md`.
  `CONTRACT.md` does **not** survive as a third file — checked directly, its "Equations"
  section duplicates `SPEC_ENGINE.md §1.1`'s formulas verbatim, minus the test citations
  `SPEC_ENGINE.md` already has. Its real unique content (typed Driver/Curves/MaxCurves/
  Filter[] shape tables, file I/O, constants) merges in as a new Data Shapes section, split
  between `SPEC_ENGINE.md` (engine-side) and `SPEC_UI.md` (chart-side); its `parseWdr`-throws
  error is fixed during that merge, not left for later.
- `docs/design/` — current-state architecture/data-model reference:
  `DRIVER_RECORD_MODEL.md`, `WINISD_SCHEMA.md`, `DRIVER_ADT_DESIGN.md` (archived-in-place —
  describes the `Driver` class `ARCHITECTURE.md` AD-8 condemns), `STATE_MODEL.md`.
- `docs/plans/` — phased executable migrations, active or historical-but-still-relevant:
  `PLAN_OPENISD_DRIVER_MODEL.md`, `PLAN_JS_CALC_CONSOLIDATION.md`, `PLAN_SBL_CROSSCHECK.md`,
  `MATH_MIGRATION.md`.
- `docs/research/` — investigative/comparison material, not authoritative reference:
  `WINISD_PARITY.md` (**new, single file** — merges `WINISD_OPENISD_COMPARISON.md` +
  `docs/winisd/INPUT_PARITY.md` + `WINISD.md`, all three independently covering openisd's
  relationship to WinISD; every claim verified row-by-row against live Original-skin code
  before merging — 7 confirmed wrong/partially-wrong corrections applied, not a plain
  concatenation), `COMPETITIVE_LANDSCAPE.md` (**new** — merges `OTHER_TOOLS.md` +
  `FEATURES.md`'s third-party-tool section + the misfiled SpeakerBoxLite section found inside
  `WINISD.md`), `REFERENCES.md`.
- **Root stays minimal** — only what a new reader/agent needs immediately:
  `README.md`, `AGENTS.md` (absorbs `CONTRIBUTING.md`/`DEVELOPMENT.md`/`SDLC.md`, resolving
  their Windows/WSL contradiction), `ARCHITECTURE.md`, `BACKLOG.md`, `WIP.md`, `FEATURES.md`
  (loses its competitor section, keeps the product feature list), `LOG.md`.
- `bugs/` — unchanged structure; the one entry already marked FIXED in the working tree is
  closed and removed.

**Deleted with content discarded** (no remaining role, nothing merges elsewhere):
`MANIFESTO.md`, `VIBE_CODING.md`, `PLAN.md` (target architecture already fully built),
`PLAN_DRIVER_ADT.md` (its own successor plan already calls it done), `CLASSIC-SKIN-review.md`
(audits code `AGENTS.md` forbids touching), `TODO.md` (dead stub), **`docs/winisd/AUTOMATED_DIAGNOSTICS.md`**
(duplicates `../winisd_research/WINE_HARNESS.md` in far less detail — does not belong in this
repo at all, not even relocated), and one FIXED `bugs/*.md` entry.

**Deleted with content merged elsewhere** (the file goes, the content doesn't — kept distinct
from the list above deliberately): `CONTRIBUTING.md`/`DEVELOPMENT.md`/`SDLC.md` (into
`AGENTS.md`), `OTHER_TOOLS.md` (into `COMPETITIVE_LANDSCAPE.md`),
`WINISD_OPENISD_COMPARISON.md`/`docs/winisd/INPUT_PARITY.md` (into `WINISD_PARITY.md`, with
the verified corrections below), `CONTRACT.md` (into `SPEC_ENGINE.md`/`SPEC_UI.md`, its
duplicate equations dropped in favor of `SPEC_ENGINE.md`'s already-cited version),
`WDR_FILE_MODEL_AND_WORKFLOWS.md` (into `BACKLOG.md` as a scoped future-feature note,
self-labeled unverified draft preserved).

**BREAKING** (to doc structure, not app behavior): every consolidated/moved file changes
path. Known cross-references that must update: `PLAN_OPENISD_DRIVER_MODEL.md` (cites
`ARCHITECTURE.md`, `docs/DRIVER_ADT_DESIGN.md`, `PLAN_DRIVER_ADT.md`), `STATE_MODEL.md`
(cites `docs/DRIVER_ADT_DESIGN.md`), `packages/winisd/src/driver.ts`'s OBSOLETE marker (cites
`STATE_MODEL.md`, `PLAN_OPENISD_DRIVER_MODEL.md`).

This does **not** touch calculation logic, physical constants, display precision, or any
result-affecting default — it is a documentation-only reorganization. No permission-gated
change is being made or requested here.

## Capabilities

### New Capabilities
(none — this change declares `skip_specs: true`; it changes documentation, not application
behavior, so no `specs/<capability>/spec.md` delta applies.)

### Modified Capabilities
(none)

## Impact

- **Affected**: every root-level `.md` file and `docs/**/*.md` (see `design.md` for the
  file-by-file target-path table). No `packages/**/src` or `packages/**/test` code changes.
- **Tooling**: `scripts/validate-openspec.py` enforces spec-traceability comments in test
  files against `openspec/specs/<capability>/spec.md` — unaffected, no spec deltas here.
- **`../winisd_research`**: not modified by this change — `docs/winisd/AUTOMATED_DIAGNOSTICS.md`'s
  deletion relies on `WINE_HARNESS.md` already existing there; verified present, not created
  by this change.
- **Out of scope, deliberately**: `MATH_MIGRATION.md`/`PLAN_JS_CALC_CONSOLIDATION.md`'s scope
  overlap (both active/live plans — relocating them is in scope, merging their content is not,
  since they're mid-flight, not stale); `BACKLOG.md`/`WIP.md`'s own internal organization.
