# Plan: fix #512 (multi-coil wiring), clear the DQ warnings, keep finding issues (#512 / #513)

## Context
Issue #512: OpenISD reports false Qes/BL/Rme/Mpow inconsistencies for the Dayton MX6-22. Its datasheet says "All specifications measured with voice coils wired in series", and its figures agree with each other (Re 4.7 Ω, BL 12.3 Tm → Qes 0.373 against 0.37 stated). Tracing it found faults at every stage, plus a pipeline that ignored its own warnings:

| Stage | Fault | Where |
|---|---|---|
| OpenISD engine | Treats published Re/BL as one coil's, then converts | `packages/design/engine/driver/DriverEngine.ts:155` `toTerminalSpace`, `checkConsistency` |
| OpenISD domain | Defaults VCCon to Parallel and feeds that default into the maths | `domain/driver/openIsdDriverSpec.ts:391/395`, `domain/winIsdDriverImport.ts:56` |
| OpenISD export | `.wdr` writes the default VCCon marked E | `domain/driverRecordConverter.ts:338-347` |
| OpenISD bridge | Divides stated series figures to "per coil" and keeps them marked E (Visaton 6.2 → 3.1) | `domain/driverRecordConverter.ts:795` `#derivePerCoilVoiceCoilFields` |
| OpenISD UI | Help text contradicts the engine; the warning tells users to change correct datasheet values | `fields/field.ts:782, 1399-1403` |
| Scraper | Parses "wired in series" and then throws it away (rejected `no-numeric-value`) | `winisd_tools/scrapers/scrapers/lib/dual_coil_pair.py:35-50`, `plugins/dayton_audio/emit.py:358-362`, validator `lib/model_driver.py:307-318` |
| Process | 1,077 of 2,001 records ship with `dq.alert` warnings. No gate reads them. The 6 Nov full re-projection (`a48574efc`) was committed with no attention report | `openisd/scripts/sync-driver-snapshot.sh`, `winisd_tools/framework/record_attention.py` |

Outcome:
- every multi-coil driver checks out against its datasheet;
- the user can see the measured wiring and choose their own;
- every DQ warning is either fixed or a visible, ruled source inconsistency;
- gates and a whole-catalogue before/after scan catch the next problem.

## Decisions (John, 14 Nov 2026)
| ID | Decision |
|---|---|
| R1 | **openisd.json model:** Re/BL/Le/Znom stored **as published**. VCCon = the wiring the manufacturer measured in: `series` \| `parallel` \| unknown. No VCCon/numVC default. `.wdr` writes `VCCon=1` marked **C** when unknown, E when stated (overrides the 5 Oct "always E" ruling for the unknown case only) |
| R2 | **driver.json model:** a VCCon reading may carry `series`/`parallel` when an **approved phrase** states the wiring in words, with the quote kept verbatim. The phrase dictionary grows only with John's approval |
| R3 | "wiring diagram" is a pointer to an image. The text is kept and VCCon stays unknown. An LLM may describe the diagram for John's review only. SB `(par./ser.)` and Visaton per-wiring rows follow **LD-DVC-1 🔒** (`winisd_tools/DESIGN.md:2556`, series set + VCCon=2) and are correct. Only their VCCon quote must name the wiring ("(2) series"), not a bare "2" |
| R4 | Infer wiring **only when a per-coil nominal is printed** ("N Ohms Per Coil", "Dual N Ohm", "2 x N ohm", "-DN"): Re ≥ 1.5× → series; Re ≤ 0.6× → parallel; else unknown. Marked C, shown with its reason, used **only** for rewiring, overridden by any stated wiring |
| R5 | A warning may be cleared by a per-group "accepted source truth" ruling, only after reading the datasheet confirms the sheet is inconsistent beyond its printed precision. The record keeps a visible note and stays in the scan |
| R6 | The Gate A baseline only falls. A rise needs a named ruling |
| A1 | Supersede QO96/QO97's per-coil basis (`docs/FIELD_REFERENCE.md:89-103`, `docs/research/WINISD_PARITY.md` §11b). Keep its principle: a typed value is never rewritten, and derived values are marked C |
| A2 | Update goldens **only where the new value is independently confirmed** (hand calculation from datasheet figures, or the scan's own physics). Each changed golden names its check |
| A3 | Narrow regeneration (`--only-driver` per record). Allowed only after the old-vs-new whole-catalogue diff proves single-coil records change only in the VCCon mark and the version stamp |
| A4 | "My wiring" = **project** setting, `series` \| `parallel`. Defaults to the measured wiring. **Disabled** when the measured wiring is unknown |
| V4 | `schemaVersion` 3 → 4. The upgrade step (also for drivers embedded in projects), for numVC ≥ 2: VCCon E → multiply back by the wiring factor; VCCon C → leave the figures, VCCon becomes unknown; single coil untouched |
| DQ | numVC ≥ 2 and no stated wiring → DQ **warning** "measured wiring not stated". Inferred → **note**. Stated → clear. A multi-coil title with no numVC → warning |
| D1 | Work on this machine (the other one is broken). Install Python 3.14 + `../.venv` |
| D2 | Local board `/home/johnl/work/winisd/questions.yml` from **QO900**. These decisions are recorded verbatim and used as `ruling:` ids |

## How the wiring maths works after the fix
- T/S relations and consistency checks run on the stored, as-published figures. VCCon is **not read**.
- Conversion, the only reader of VCCon: measured M → user U, for N identical coils. Series → parallel: Re ÷ N², BL ÷ N. Parallel → series: Re × N², BL × N. Le and Znom scale like Re. Fs, Qes, Qms, Qts, Mms, Cms and Vas never change.
- Example: MX6-22 (series 4.7 Ω, 12.3 Tm) → parallel 1.175 Ω, 6.15 Tm, Qes still 0.373.
- The result feeds only the amplifier-side figures: impedance, SPL at a given voltage, excursion and power against voltage, and Rg loading.
- `.wdr` import: Re = the file's Re, M = the file's VCCon (QO97 kept). Charts are unchanged and the round trip is exact.
- `.wdr` driver export writes the stored figures with M. `.wpr` project export writes the U-converted figures with U.

---

## Test strategy (applies to every phase)
1. **TDD in both repos.** Write the failing test first at the cheapest layer (openisd `.claude/rules/tdd.md`; winisd_tools "test-first for transformation code"), watch it fail for the right reason, implement, watch it pass. Never edit a golden to match an output (A2).
2. **Test layers:**
   - unit (engine maths, upgrade steps, phrase table, exporters);
   - hook/UI-mocked (the "Measured wiring" / "My wiring" controls and the DQ list);
   - one browser spec per user-visible feature (edit the MX6-22, see no warnings, rewire, see the converted figures);
   - architecture gates already in place: `architecture-tests-never-pin-a-defect`, no-globals, no-casts, the seam guard, alias ban.
3. **Ground-truth fixtures** come from real datasheets, read and recorded per winisd_tools "Datasheet PDF reads are gold" (`<pdf-stem>_claude_<model>-<effort>.md`):
   - MX6-22 (series, explicit);
   - RSS265HO-44 (no statement, inferred parallel);
   - Bliesma W137A-854-4 (3 coils, configuration as published);
   - Visaton GF 250 (per-wiring rows, series set);
   - SB34SWPL76-3-DV (`(par./ser.)`);
   - a single-coil control (Dayton DA215-8, already an openisd fixture).
4. **Whole-catalogue regression (A3 proof):** a script runs the **old and new** openisd solver and exporters over all 2,001 records and the goldens, and diffs every solved value, every `openisd.json` field and every `.wdr` byte.
   - Pass: single-coil records differ only in the VCCon mark and the version stamp; multi-coil records differ only in the expected wiring fields.
   - Any other difference stops the work.
5. **Health-scan diff** after every phase (Phase 0 tool): `catalogue_health_scan.py diff old new` lists FIXED / NEW / CHANGED. No unexplained NEW findings.
6. **Gate tests:** each gate has a fixture that must be refused (one extra warning, a commit with no attention report) and one that must pass.
7. **Run discipline:** openisd `bash scripts/test.sh <spec>` targeted while iterating, the batch once at the end, `pr-gate` via `ship.sh`. winisd_tools `make test`, `make lint` (pyright, mypy, type hints).

---

## Phase S: Setup (no product code)
Steps:
1. Install Python 3.14 and create `/home/johnl/work/winisd/.venv` from `winisd_tools/requirements.txt` via `make setup`. Run `make prerequisites`.
2. Create the local board `questions.yml` (QO900+) recording R1–R6, A1–A4, V4, DQ, D1 and D2 verbatim with the date. The openisd task files cite `ruling: QO9xx`.
3. Write bug files at discovery (winisd_tools AGENTS.md "one file per bug"):
   - `winisd_tools/bugs/`:
     - stated wiring discarded;
     - Visaton/SB VCCon quote is a bare "2" / a BL line;
     - `dq.alert` and rejected maths fields never become attention items;
     - snapshot committed with no attention report.
   - `openisd/bugs/`:
     - engine per-coil basis (#512);
     - VCCon default feeds the maths;
     - `.wdr` default VCCon marked E;
     - bridge writes calculated per-coil values marked E;
     - help text contradicts the engine;
     - sync and bundle ignore `dq.alert`;
     - saved multi-coil projects need upgrading.
4. Post the #512 comment (datasheet quote, the maths, the decided fix). Open linked issues for the scraper and process bugs on `Johnlon/winisd_tools` and `Johnlon/openisd`.
5. Create `openisd/tasks/T<n>.yml` for each openisd change, with `ruling:` set.

**Verify:**
- `make prerequisites` exits 0;
- `../.venv/bin/python3 -c "import pydantic, pytest"`;
- `make test` on untouched main is green, to establish the baseline (any pre-existing red is recorded in a bug file, not fixed silently);
- in openisd, `bash scripts/quiet-test.sh npm run typecheck` is green on main;
- `gh issue view 512 --comments` shows the comment.

## Phase 0: Baseline health scan (read-only)
Steps:
1. Finish `winisd_tools/tools/catalogue_health_scan.py` (already drafted; first run at `reports/health/health_20261114_baseline.*`, 2,367 dirs, 6,216 findings):
   - flag `no-projection` only when a woofer or passive-radiator section exists (tweeters have no projection by design, `DESIGN.md:1613`);
   - classify rejected readings printed as `N/A` / `-` as source truth, apart from parse failures;
   - physics checks allow for each figure's printed precision (the interval check, as in the bridge);
   - add the new wiring DQ kinds ("not stated", "inferred");
   - for every disagreement, record the **shortfall**: how far the gap exceeds the printed-rounding allowance, as a %. Report the distribution per kind and brand, e.g. how many Fs warnings are within 1% beyond rounding. This is the evidence Phase 5 uses to decide, per relation, whether a modelling allowance is justified. No tolerance changes in Phase 1 (John's question, 14 Nov).
2. Tests for the scanner (`winisd_tools/tests/tools/test_catalogue_health_scan.py`): tiny fixture record dirs written in a pytest tmp dir. These are synthetic scanner inputs, not driver data, so the fabrication rule doesn't apply to the scanner's own tests. Each finding kind fires and stays quiet correctly; the diff reports FIXED / NEW / CHANGED and exits 1 on NEW.
3. Run through `../.venv/bin/python3`, then commit the scanner, tests and baseline report.

**Verify:**
- scanner tests green; `make lint` clean on the new files;
- spot-check 5 findings by hand against their records (MX6-22 `wdr` Re ×0.5, an MX6-22 dq Qes line, a Visaton projection E-not-printed, a tweeter N/A classified as source truth, an RSS265HO-44 wiring finding);
- re-running the scan gives a byte-identical `.jsonl` (deterministic).

## Phase 1: OpenISD engine, domain, UI and upgrade (#512 core)
Steps, each test-first:
1. **Engine** (`engine/driver/DriverEngine.ts`, `engine/solvers/driverQuantities.ts`, `engine/simulation/SimulationEngine.ts`):
   - remove `toTerminalSpace` from `solveValues` and `checkConsistency`, and the per-coil precision scaling;
   - amplifier-side `Re_terminal_ohm` / `BL_terminal_Tm` come only from the M → U conversion (equal to the stored figures when M is unknown or U = M);
   - `withAddedMass` and `enteredTerminalBL_Tm` use the stored figures.
2. **Domain:**
   - `openIsdDriverSpec.ts`: no VCCon/numVC default; null (N) stays null;
   - `winIsdDriverImport.ts`: no division by the wiring factor;
   - `driverRecordConverter.ts`: delete `#derivePerCoilVoiceCoilFields`; `wdrVCCon` writes C when unknown;
   - `voiceCoilWiring.ts`: remove `calcVCCon` / `calcNumVC` as defaults.
3. **Wiring inference (R4)** and **wiring DQ (DQ)**, in the consistency/issue layer: the "not stated" warning, the "inferred" note with its reason, the "multi-coil title without numVC" warning.
4. **Project setting "My wiring" (A4):** project schema field, conversion wired into the sweep, disabled state with its message.
5. **Upgrade (V4):** `schemaVersion.ts` 3 → 4 step for driver records and embedded project drivers.
6. **UI and help** (`fields/field.ts`, `DriverConsistencyList.vue` texts):
   - "Measured wiring" (from the datasheet), "My wiring" (the build);
   - Re/BL help: "as published, for the measured wiring";
   - the consistency message no longer tells users to change datasheet values.
7. **Docs:** rewrite `docs/FIELD_REFERENCE.md` §voice coils and `docs/research/WINISD_PARITY.md` §11b (A1). Record the numVC parity change in `WINISD_EQUIVALENCE.md` + README bullets (`.claude/rules/winisd-parity-summary.md`).

Tests, written first:
- **Engine unit:**
  - MX6-22: Qes 0.373, Rme 32.2, Mpow 5.67, Mpow² = Rme, no inconsistency issues;
  - Visaton GF 250 series set: consistent;
  - RSS265HO-44: consistent;
  - Bliesma W137A-854-4 (3 coils, M unknown): consistent, no conversion.
- **Conversion unit:** MX6-22 series → parallel → 1.175 Ω / 6.15 Tm; round trip back is exact; Qes/Rme/Mpow invariant; N = 3 refused (not identical coils) with a message.
- **Inference unit:** MX6-22 → series; RSS265HO-44 → parallel; Visaton (0.72–0.99×) → unknown; no printed per-coil nominal → unknown; a stated wiring overrides.
- **DQ unit:** the "not stated" / "inferred" / "clear" cases as in the DQ decision.
- **Upgrade unit:** v3 VCCon E series (Visaton 3.1 → 6.2); E parallel; C default (MX6-22 4.7 kept, VCCon → unknown); single coil unchanged; an embedded project driver; a v2 file through 2 → 3 → 4; a v5 file refused.
- **Exporter unit:**
  - `.wdr` VCCon C when unknown, E when stated;
  - driver `.wdr` writes the stored figures;
  - `.wpr` writes the U figures;
  - `scripts/roundTripGate.mjs` byte-identical on the fixtures.
- **Parity:** the `it.fails` cases in `driver-edit-parity-e150he-44.test.ts` / `driver-edit-parity-w5.test.ts` now pass → convert them to normal tests (BUG reference removed).
- **Hook/UI:** "My wiring" is disabled with the message when M is unknown; enabled and converting when M is known.
- **Browser (one):** open MX6-22 from the catalogue → no consistency warnings → set My wiring = parallel → the Placement read-out shows 1.175 Ω / 6.15 Tm.

**Verify:**
- all of the above green; `npm run typecheck` and `lint` clean;
- **A3 proof:** the old-vs-new whole-catalogue diff passes (single-coil: only the VCCon mark and the version stamp);
- **A2:** golden diff table, each changed value with its independent check, approved by John before saving;
- health-scan diff: the 31 multi-coil records' Qes/Rme/Mpow/BL warnings FIXED, the expected new "not stated" warnings NEW (listed), nothing else;
- check in the app at the task port: MX6-22, RSS265HO-44 and Bliesma W137A-854-4 behave as tested;
- ship through `ship.sh` with `ruling: QO9xx`.

## Phase 2: Gates (warnings can't be ignored again)
Steps:
1. **Gate A**, `openisd/scripts/sync-driver-snapshot.sh`:
   - count findings by kind (dq + scan) against a baseline file beside `scripts/driver-snapshot.pin`;
   - refuse when any count rises, printing the new lines;
   - the baseline is only lowered by the script on success, and raised only with `--ruling QO<n>`.
2. **Gate B**, the winisd_drivers snapshot commit (a hook in `winisd_tools/tools/hooks/` used by the snapshot commit path): refuse unless a run attention report covers the changed records with `clean: true` or every item dispositioned. Covers Stage-6-only re-projections.
3. **Attention items** (`winisd_tools/scrapers/scrapers/framework/record_attention.py`):
   - every `dq.alert` line;
   - rejected maths fields (Re/BL/Qes/Fs/Mms, VCCon when numVC ≥ 2);
   - multi-coil records without a stated wiring;
   - an accepted VCCon whose quote matches no approved phrase.
4. The rule "new gates apply retroactively": Gate A's first baseline is today's counts; the current backlog is recorded as Phase 5 work, with its first target date.

Tests:
- Gate A: fixture with +1 warning → refused, names it; equal → passes; fewer → passes and lowers the baseline; a raise without `--ruling` is refused.
- Gate B: a commit with no report → refused; undispositioned items → refused; clean → passes.
- Attention: each new item kind is raised and keeps `clean: false` until `attention_review.py` records a disposition.

**Verify:** the tests above; the gates run in a scratch copy end to end with real processes (openisd `.claude/rules/processes.md` rule 7) before being wired live.

## Phase 3: Scraper wiring fix (R2, R3)
Steps:
1. **Phrase candidates:** a read-only script mines cached datasheet and page text across all brands for wiring sentences (`series|parallel|wired|connect|per coil|dual … coil`), plus every rejected VCCon/numVC reading. It outputs a candidate list with counts, brands and URLs. John approves entries; today's known: Dayton sentences A and B → series.
2. **Phrase table** in `lib/dual_coil_pair.py`: an aligned table (`# fmt: off`) extending `_CONNECTION_PHRASE`; option-listing wordings never match.
3. **Reading seam:** a new `ConformedBy.STATED_CONNECTION` in `lib/model_driver.py` lets a VCCon reading on that seam carry the value. Add it to `tests/test_reading_construction_confined_to_parse_seams.py`. Ruling R2 is cited in the commit; the model gate is satisfied.
4. Stop discarding the parsed value at `plugins/dayton_audio/emit.py:358-362`.
5. **Visaton / SB quote:** the VCCon reading's `actual_reading` becomes the printed wiring label ("(2) series", "par./ser."), not a bare "2" or a BL line. Values are unchanged (LD-DVC-1).
6. **Regenerate (A3)** only the affected records with `--only-driver`: the 14 Dayton series-sentence records, 6 Visaton and 3 SB. Then Stage 6 for the same records.

Tests:
- one per approved real quote → value;
- negatives ("can be wired in series or parallel", "many wiring options", "Selectable 1, 2+2, or 4Ω", "wiring diagram") → no value;
- Dayton emit: VCCon = series with the quote;
- Visaton/SB emit: quote names the wiring, values unchanged;
- the seam guard passes;
- class-sweep (winisd_tools definition-of-done): the extractor over each affected vendor's full catalogue, checking that VCCon changed only where a phrase matched.

**Verify:**
- `make test` and `make lint` green;
- the run attention report is read and its items dispositioned;
- health-scan diff: the 14 Dayton "not stated" warnings FIXED; nothing NEW on single-coil records;
- `git diff` of the regenerated `driver.json` files touches only VCCon readings.

## Phase 4: Independent LLM check (reviewer only)
Steps:
1. Write `winisd_tools/tools/vccon_llm_audit.py`. For each multi-coil record, **Claude** (`claude -p`) and **agy** each get only the cached datasheet text, separately, without the scraper's answer. JSON out: the measured-wiring quote or "none stated", and the coil-count quote.
2. A quote is accepted only if it appears verbatim in the source. Disagreements (with the table or between the two) → attention items. Unmatched quotes → phrase candidates for John.
3. **Override proposals (QO912):** where a multi-coil datasheet states no wiring, OpenISD's inference (a C note) stays. The audit may also propose a `by: AI` entry in `winisd_drivers/override/<maker>/<model>/override.json` (mechanism QO393, `winisd_tools/scrapers/scrapers/lib/manual_override.py`, on main since 0a135351), with the evidence quote and the inference reason. **Every proposal is presented to John before use.** None is committed until he agrees.
4. Optional: for "wiring diagram" pages, a description of the diagram goes to John's review list, never into the data.
4. Head-to-head report: table vs Claude vs agy vs John's datasheet answers (MX6-22 series, RSS265HO-44 none stated, Bliesma none stated (as published), Visaton series row, SB par./ser.).

Tests:
- the verbatim validator rejects a paraphrased or invented quote (unit, with canned LLM outputs);
- the audit never writes under `winisd_drivers/`: a test asserts its output paths.

**Verify:** the report exists; every accepted quote passed the verbatim check; each disagreement is listed with its source URL; secrets aren't logged (zeroth law: no API keys or headers in output).

## Phase 5: Clear the DQ backlog (#513), group by group
For each scan group, largest first:
- Visaton Qes/Rme/Mpow;
- Tang Band Fs/Qes;
- Vas across brands;
- SEAS Qes and Rms;
- Purifi EBP;
- B&C, Faital, Morel;
- source disagreements;
- physical limits.

Steps per group:
1. Read 3–5 datasheet PDFs and record them as gold reads.
2. Name the cause.
3. Write the bug file and a GitHub issue linked to #513.
4. Fix test-first:
   - a scraper misread → scraper fix + narrow regeneration;
   - a check that's too strict → OpenISD check fix;
   - a datasheet that really is inconsistent → an R5 ruling per group.
5. Scan diff.

**Verify per group:**
- the group's findings are FIXED or carry a ruled note;
- no NEW findings;
- the Gate A baseline is lowered;
- the bug file is closed with its evidence (AGENTS.md lifecycle: logged → root-caused → fixed → data refreshed → verified → closed).

**DQ tolerance (John's question, 14 Nov):** there's no user setting today. `engine/driver/routes/ConsistencyCheck.ts:80` warns when the gap between the stated and implied values exceeds:
- the target's own printed precision;
- plus each other input's precision carried through the formula (first order);
- plus a per-relation `modelTolerance` (`Relation.ts`): 0 for exact equations, and 5% only for BL from Qes and Cms (`relations.ts:15`).

So any gap the printed rounding can't explain is a warning. In Phase 5 the per-relation `modelTolerance` is a **possible fix** for a group whose cause is a known modelling difference (e.g. the manufacturer's air constants for Vas, or Mms with or without air load). Each one needs evidence and a test, never just to make warnings go away.
- **Feature request, logged and not built in this plan:** a user display filter "hide disagreements smaller than X%" (default off), which never changes the DQ count or the gates. A bug/feature file goes in `openisd/bugs/` (feature) for John to prioritise.

## Phase 6: Sync, release, close
Steps:
1. `sync-driver-snapshot.sh` (passes Gate A) only after Phase 1 is on main.
2. Release through `scripts/release.sh` with an announcement (multi-coil drivers now match their datasheets; new My wiring setting; saved projects upgraded).
3. Update and close #512 when the app shows the MX6-22 with no warnings and rewiring works. Close #513 when Phase 5's scan shows zero unexplained warnings.

**Verify:**
- the offline catalogue test (`scripts/hosting/test/offline-catalogue.e2e.mjs`);
- the PWA upgrade from the previous worker (CLAUDE.md release rules);
- production build id = GitHub Latest release; production announcements Worker answers;
- live test vs production screenshots of the MX6-22 project, before and after, compared.

## Order
S → 0 → 1 → 2 → 3 → 4 → 5 (repeats) → 6. Phase 2 can run alongside 1. Phase 3 can start once R2 is recorded (it is). Phase 6 waits for Phase 1 on main.

## Housekeeping
- **Plan location:** decided 14 Nov 2026; this file is the plan of record (`openisd/docs/plans/`), indexed from `winisd_tools/DOCUMENTATION.md`. Plans never go in `brain/`.
- Archive the stale `winisd_tools/brain/DEFERRED_openisd_dvc_series_projection.md` (superseded).
- Commit rules: openisd commits everything in the worktree (CLAUDE.md). Never `git stash`.
