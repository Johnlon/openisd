## 1. Retire files with no remaining role (design.md decision 1)

- [x] 1.1 Delete `MANIFESTO.md` and `VIBE_CODING.md` (persuasive prose, no reference content)
- [x] 1.2 Delete `PLAN.md` (target architecture already fully built — confirm no code still
      matches its described pre-monorepo shape before deleting)
- [x] 1.3 Delete `PLAN_DRIVER_ADT.md` (superseded by `PLAN_OPENISD_DRIVER_MODEL.md`, which
      already says so in its own header)
- [x] 1.4 Delete `CLASSIC-SKIN-review.md` (audits code `AGENTS.md` forbids touching)
- [x] 1.5 Delete `TODO.md` (dead stub pointer to `questions.yml`)
- [x] 1.6 Close the `bugs/*.md` entry already marked FIXED in the working tree per this
      project's normal bug-closing convention, then remove the file

## 2. Consolidate operating rules into `AGENTS.md` (design.md decision 2)

- [x] 2.1 Correct `DEVELOPMENT.md`'s architecture diagram and platform claim against the real
      tree (`packages/engine`, `packages/ui/src/components/*.vue`) and the verified-current
      WSL2 primary environment, before merging anything from it
- [x] 2.2 Merge `SDLC.md`'s Human/Agent/Tooling role table and port assignments into
      `AGENTS.md`, deduping against `AGENTS.md`'s existing port section (one table, not two)
- [x] 2.3 Merge `CONTRIBUTING.md`'s human quick-start into `AGENTS.md` as a short section
- [x] 2.4 Merge `DEVELOPMENT.md`'s corrected content into `AGENTS.md`
- [x] 2.5 Delete `CONTRIBUTING.md`, `DEVELOPMENT.md`, `SDLC.md`

## 3. Create the four `docs/` tiers and move files into them (design.md decision 1)

- [x] 3.1 Create `docs/spec/`, `docs/design/`, `docs/plans/`, `docs/research/`
- [x] 3.2 Confirm `SPEC_ENGINE.md`, `SPEC_UI.md` are in `docs/spec/` (already there — no-op)
- [x] 3.3 `CONTRACT.md` does NOT move as a file — see task group 7, it merges and deletes
- [x] 3.4 Move `DRIVER_RECORD_MODEL.md`, `WINISD_SCHEMA.md`, `docs/DRIVER_ADT_DESIGN.md`,
      `STATE_MODEL.md` into `docs/design/`
- [x] 3.5 Move `PLAN_OPENISD_DRIVER_MODEL.md`, `PLAN_JS_CALC_CONSOLIDATION.md`,
      `PLAN_SBL_CROSSCHECK.md`, `MATH_MIGRATION.md` into `docs/plans/`
- [x] 3.6 Confirm `DRIVER_RECORD_MODEL.md` and `WINISD_SCHEMA.md` still state their own
      design-vs-facts division of labor accurately after the move; no content merge
- [x] 3.7 Add an archived-in-place header to `docs/design/DRIVER_ADT_DESIGN.md` pointing to
      `docs/plans/PLAN_OPENISD_DRIVER_MODEL.md`, matching the pattern already on
      `packages/winisd/src/driver.ts`'s `Driver` class
- [x] 3.8 Move `WDR_FILE_MODEL_AND_WORKFLOWS.md`'s content into `BACKLOG.md` as a scoped,
      clearly-labeled future-feature note (driver type classification/matching), preserving
      its existing "UNVERIFIED DRAFT" caveat; delete the standalone file

## 4. Build `docs/research/WINISD_PARITY.md` — ONE file merging all three WinISD sources,
      with corrections, not a plain concatenation (design.md decisions 3 and 3b)

- [x] 4.1 Read `WINISD_OPENISD_COMPARISON.md`, `docs/winisd/INPUT_PARITY.md`, and `WINISD.md`
      in full; merge into `docs/research/WINISD_PARITY.md`, applying these verified
      corrections as the content is written, not after:
  - [x] 4.1.1 Added mass to cone (driver) → ✅, engine-wired (`OriginalShell.vue:1177`,
        `sweep.ts:126`), not ❌
  - [x] 4.1.2 Voice coil temp rise (K) → ✅, engine-wired (`OriginalShell.vue:1175`,
        `circuit.ts:117`), not ❌
  - [x] 4.1.3 Environment defaults (App Options) → ⚠️ exists but calc-incomplete
        (`OptionsModal.vue:182-192`), not ❌ doesn't-exist
  - [x] 4.1.4 Box pane Fh — PR case → ✅ fixed (`OriginalShell.vue:134-142`,
        `prTuning()`); **vented case → still ⚠️ WRONG, confirmed unfixed**
        (`OriginalShell.vue:143-144` falls through to the sealed formula) — do not mark
        this row fully resolved
  - [x] 4.1.5 Project pane Creator/Created/Modified/Description → ✅ live bindings
        (`OriginalShell.vue:1385-1392`), not ❌ don't-exist
  - [x] 4.1.6 Charts — EQ/Filter transfer-function/phase curves → ✅ real and working
        (`FltMag`/`FltPhase`/`FltGD`, `types.ts:22-24`, `series.ts:189,201,212`); PR-specific
        curves → confirmed still ❌ absent. Split this into two separate verdicts, not one
        combined ❌.
  - [x] 4.1.7 `WINISD.md` §13 "Driver Editor UI — Complete field inventory" → absorbed into
        the merged file's existing per-tab field tables, not kept as separate prose
  - [x] 4.1.8 `WINISD.md`'s duplicate "§11" numbering (two different sections both numbered
        11: "Open questions" and "SpeakerBoxLite API") → fixed as part of the merge
  - [x] 4.1.9 `WINISD.md`'s remaining 17 sections (formula derivations, confirmed/assumption
        investigation narrative) → carried into the merged file as its narrative/derivation
        portion, distinct from the comparison tables but in the same file
- [x] 4.2 Delete `WINISD_OPENISD_COMPARISON.md`, `docs/winisd/INPUT_PARITY.md`, `WINISD.md`

## 5. Merge competitor research into `docs/research/COMPETITIVE_LANDSCAPE.md`
      (design.md decision 6 — third-party tools only, WinISD excluded)

- [x] 5.1 Create `docs/research/COMPETITIVE_LANDSCAPE.md` covering every tool in
      `OTHER_TOOLS.md`, `FEATURES.md`'s competitor section, AND `WINISD.md`'s misfiled §11
      "SpeakerBoxLite API — CORS finding" (SpeakerBoxLite, SpeakerDesign.dev, Sonella,
      00 Simulator, LoudspeakerLab) — read-through merge, verify no fact from any source is
      dropped
- [x] 5.2 Remove the competitor section from `FEATURES.md`, replace with a pointer to
      `docs/research/COMPETITIVE_LANDSCAPE.md`
- [x] 5.3 Delete `OTHER_TOOLS.md`

## 6. `docs/research/` remainder (design.md decision 4)

- [x] 6.1 Delete `docs/winisd/AUTOMATED_DIAGNOSTICS.md` — verify
      `../winisd_research/WINE_HARNESS.md` still exists and covers the same ground
      immediately before deleting, not from memory of this design pass
- [x] 6.2 Move `REFERENCES.md` into `docs/research/`

## 7. Merge `CONTRACT.md` into `SPEC_ENGINE.md`/`SPEC_UI.md` and delete it (design.md decision 2)

- [x] 7.1 Read `CONTRACT.md` in full. Its "Equations" section (Qts/Cms/Mms/Rms/Bl) duplicates
      `SPEC_ENGINE.md §1.1` — dropped, not carried into either target file
- [x] 7.2 Added `SPEC_ENGINE.md` §4 "Data Shapes & Public API": `DriverRaw`/`Driver` (§4.1,
      flagged AD-8/AD-9 obsolete), physical constants (§4.2, corrected — `RHO=1.20095`,
      `C=343.68`, not CONTRACT.md's `1.2041`/`343.21`), `SweepParams`/`SweepResult` (§4.3,
      corrected defaults — `Rs` default is 0 not 0.1, `Ql` is 10 for every box type not
      7-for-vented as `SPEC_ENGINE.md §2.1` itself wrongly claimed; also fixed that stale
      claim in place — plus every field CONTRACT.md never documented: `tempK`,
      `driverAddedMass`, `vcTempRise`/`alfaVC`, `rgAtDriverSide`, `tlPortModel`,
      `forceFlatResponse`/`flatMaxBoostDb`), `MaxCurvesResult` (§4.4), alignment helpers
      (§4.5, corrected — `prTuning`/`prMassForFp` take one params object, not 5 positional
      args, and have no `prNum` field), File I/O (§4.6, corrected — see 7.4)
- [x] 7.3 Added `SPEC_UI.md` §3 "Data Shapes — Chart Input & Filter Chain": `SweepResult`
      fields charts consume (§3.1) and `Filter[]`/`FilterType` (§3.2, corrected — real union
      is `'highpass'|'lowpass'|'linkwitz'|'peaking'|'lowshelf'|'highshelf'`, not
      `'hp'|'lp'|'peak'`; real fields are `fc/Q/f0/Q0/fp/Qp/gain`, not `order`)
- [x] 7.4 `parseWdr` no longer exists at all (confirmed by repo-wide grep) — replaced by
      `Driver.fromWdr(text): Driver` (`@openisd/winisd`), which never throws and is
      best-effort, not a `Result{value,errors}` return as originally guessed. Documented in
      §4.6. Closed and deleted
      `bugs/BUG_20260805_contract-md-declares-parsewdr-throws-contradicting-the-live-result-contract.md`
- [x] 7.5 Deleted `CONTRACT.md`

## 8. Fix cross-references and verify

- [x] 8.1 Grepped the whole repo (docs, code comments, `openspec/`) for every filename
      retired or moved in tasks 1-6/7; fixed every hit — markdown links, HTTP-served links,
      and code-comment mentions (including moved files' own relative links back to
      root-level docs like `ARCHITECTURE.md`, which broke the same way). Deleted-with-no-
      merge-target files (`PLAN.md`, `VIBE_CODING.md`, `PLAN_DRIVER_ADT.md`,
      `CLASSIC-SKIN-review.md`) got their citations dropped or rephrased, not redirected.
      Also caught and fixed along the way: two BACKLOG.md items citing dead docs were
      themselves stale-complete (P0 Phase 2 / Driver-as-ADT) — corrected their status, not
      just their links; `SPEC_ENGINE.md §2.1`'s box-leakage-loss default (`Ql=7` for vented)
      was wrong against `circuit.ts:146` (uniformly 10) — fixed while merging CONTRACT.md's
      overlapping claim in task 7. Excluded as out of scope: `CODE_REVIEW/*` (never named in
      this change's design.md), `LOG.md`/`questions.yml` (explicitly historical/ledger)
- [x] 8.2 Confirmed no application code, test, or spec-traceability comment was touched —
      every `.ts`/`.vue` edit is a one-line comment-text or help-string swap (verified via
      `git diff --stat`/`git diff`, 32 files, no logic/assertion lines touched); `.claude`
      rule §"No Removal of Domain Tests" and the `skip_specs: true` boundary both hold
- [x] 8.3 Read all 20 remaining files' openings (7 root, 2 `docs/spec`, 4 `docs/design`,
      4 `docs/plans`, 3 `docs/research`). Every one states its current-vs-historical status
      clearly — `LOG.md` is the sole intentional changelog; `docs/design/DRIVER_ADT_DESIGN.md`
      correctly self-flags as "archived in place, accurate for today, not the target" rather
      than reading as either pure-current or pure-history. Every file's tier is inferable
      from its path alone: `docs/spec` = interface contracts, `docs/design` = current
      architecture reference, `docs/plans` = phased executable migrations, `docs/research` =
      investigative/non-authoritative, root = top-level governance/status. `WIP.md` (not
      part of the original 39-file count) is a live in-progress tracker, correctly at root
