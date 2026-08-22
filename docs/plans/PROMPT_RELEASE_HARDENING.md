# Release-hardening run — mission prompt + checklist

You are the ORCHESTRATOR for preparing OpenISD for a production release. High standards are
paramount and take priority over expedience: the human is releasing to production and wants no
new bugs. Act with integrity at all times — no workarounds, no renames to silence gates, no
weakened tests, nothing left to fall between the cracks. Finish the whole job.

Workspace: `/home/john/work/winisd/` — repos `openisd` (branch `dev`, primary),
`winisd_tools` (`main`), `winisd_drivers` (`main`), `winisd_research` (`master`).
The global behavioural rules auto-load from `~/.claude/`; they bind you and every agent you
spawn (copy the relevant ones into each agent prompt — subagents inherit nothing).

## Non-negotiable working rules

- **NEVER `git push`.** Commits stay local. Commit `--no-verify` only when the human says
  commit. No branches, no worktrees, no force-push.
- **Full test suites run in the BACKGROUND, one at a time, never concurrent.** Playwright with
  `--workers=1` (concurrent workers killed the dev server → 84 false failures, QO10). Narrowest
  scope that answers the question; full suite once per milestone.
- **Record a bug file BEFORE fixing and before reporting it.** `bugs/BUG_<date>_<slug>.md`,
  current-state: Symptom / Evidence / Cause / Fix / Verification.
- **Re-verify every prior claim** — ledger answers, bug files, plan text, and this prompt
  itself are claims about the world when written. Open the file, re-run the grep, then act.
  Line numbers in notes are stale; search by symbol. LSP (`ToolSearch("select:LSP")`) for
  symbol questions; grep for text only.
- **TDD.** Failing test first, then code. Among red tests, architecture tests are fixed first.
  Never delete or weaken a test to go green; a changed test keeps assertions at least as strong.
- **No historic comments** in any artifact ("used to", "previously", "replaces the old…") —
  justification lives in commit messages only.
- Discriminators are named string enums, never ints. The UI never touches a JSON shape.
  Calculations live in `@openisd/engine` only, reached through domain getters that do
  entered-override → calculated fallback.
- `ALLOWED_GLOBALS` in `store.ts` and every PrivateAllow list are HUMAN-EDIT-ONLY. Never widen
  one to make a red test pass.

## Read first, in this order

1. `ARCHITECTURE.md` (openisd) — its `FileIO` block is known-stale; see item 4.
2. `docs/plans/PLAN_QO60_LAYERING_REMEDIATION.md` — the layering plan. Objective 5 is STRUCK
   (target file deleted). Task R4 strikes its "QO56 hazard" clause (single writer, ruled).
3. `docs/design/REACTIVITY.md` — the delegate-free reactivity design (unblocks A3).
4. `docs/design/FILEIO_API_PROPOSALS.md` — Proposal B is RULED. It is A6's interface and lists
   the three `ARCHITECTURE.md` corrections.
5. `questions.yml` in openisd, the workspace root, and winisd_tools — the `answer:` blocks
   carry the human's verbatim rulings of 2026-08-21 and are the authority for every decision
   below. Two remain OPEN by design: QO65 (coax, task D4) and QO64 (the box-wizard build
   request, Lane G).
6. `bugs/*.md` in openisd and winisd_tools.
7. `winisd_research/COMMENT_ENCODING.md` and `winisd_research/PARSTATE_ABSENT.md` — measured
   facts from the real WinISD under wine (2026-08-21). PARSTATE_ABSENT.md **confirms** the
   QO49 ruling: a ParState-less `.wdr` gets a 49-slot all-`E` ParState from WinISD itself, and
   `Gloss=0` is a stated value WinISD never recomputes. QO49 is UNCONDITIONAL — build nothing
   that special-cases it.

## State when this prompt was written (2026-08-21 — RE-VERIFY, do not trust)

- `npx vitest run`: **1840 / 1844.** The 4 red are `architecture.test.ts` gates, red by design
  pending the layering work — **for this release they are the release blockers.**
- eslint 0 problems; typecheck (tsc ×3 + vue-tsc) clean.
- Last commits: openisd `9c0f26e`, winisd_tools `00a8fdf9`, winisd_research `20747a6`,
  winisd_drivers `340cbbca5`. All four trees clean; R1 is done.
- Ledger ids are UNIQUE again (repaired 2026-08-21): the human's open coax question is QO65,
  the wizard build request is QO64. `inbox.py add` is STILL BROKEN — it collided a third time
  (minted QO63 over an existing QO63) — task R3.

## The rulings of 2026-08-21 (the ledger answers are authoritative)

| ID | Ruling (one line) |
|---|---|
| QO49 | ParState-less `.wdr`: presence ⇒ ENTERED, uniformly. CONFIRMED by PARSTATE_ABSENT.md. No special case. |
| QO51 | ADD the Ns/m ↔ kg/s toggle (`resistance` unit group, factor 1) on Rms/Rme/Mcost; defaults stay WinISD's spellings. |
| QO61 | FileIO = Proposal B (per-format methods, bytes in/out, domain objects out, separate `FileStore` port). |
| QO62 (closed, encoding) | `.wdr`/`.wpr` READ: strict UTF-8; on failure decode the whole file as CP1252 and report which was used. WRITE stays UTF-8. Ruled, NOT yet built. |
| QO63 | Single writer — no session-coordination mechanism; strike the plan's QO56-hazard clause. |
| QP19 | YES to runtime deps for precision maths (mirrors winisd_tools' `uncertainties`). The engine's "zero dependencies" claim is rewritten in the same change. |
| QT8 | `_workingout/` diagnostics: harvest EVERY run's bubble artifacts before discard; retention needs a rule. |
| QT12 | DELETE `accuton/emit.py::emit_from_seed` + its tests; repoint scenario stage 6 at the production IoC path. |
| QT18 | ONE policy: non-drivers refused at build with `OutOfScope`. Migrate the 11 discovery-filter plugins; then delete `is_non_driver_slug`. Rewrite the `discovers_count: 23` scenario comment, not just its number. |
| QT47 | SPLIT disposition: store only `no_ts_published`; derive the rest from `missing`/`parse_errors`. Annotate QT37/QT40 as overturned. |
| QT48 | `read_value: Optional[float]` permitted ONLY with `rejected` set; add `RejectedRead.NO_NUMERIC_VALUE`; "N/A" preserved verbatim in `actual_reading`. |
| QT49 | RENAME `dq_status`→`corroboration`, `dq`→`dq_marks`; land `DQStatus` as a real Enum in the same change. |
| QT50 | DELETE `FieldEnvelope.__eq__` and `_unpack`; `_check_readings` gets an explicit unwrap. |
| QT54 | Build the V8 bridge — **IN RELEASE SCOPE (human, 2026-08-21)**. Export `openisdYamlToWdr` and `driverYamlToOpenisdYaml` from openisd; migrate winisd_tools onto them. |
| QT7 | Curve digitiser DEFERRED; `extracted_data_path` stays declared. |
| QO34/QO42 | Brand-primary definition fixed in source; `provided_by`/`comment`/`added` added in winisd_tools (reopen QT20 row D as overturned). Both land via the regeneration gate. |

## Hazards the checklist encodes

- **H1 — ONE regeneration pass.** B1–B5 all change the emitted record shape. ALL land first,
  then a SINGLE emit re-run reformats every record (human: "once any tools changes are made
  then rerun the emit phase to refomat all files"). Regenerating early bakes today's defects
  into ~2,016 records. The V8 bridge (stream F) is an implementation swap verified by PARITY —
  byte-identical output — so it does NOT require a second regeneration; if parity is not
  byte-identical, STOP and raise it.
- **H3 — C/E/N persistence gap.** `Provenance` is derived at read time (`cell()` ⇒ Entered iff
  a `specs` entry exists); records carry no calculated-marker, so a pipeline-calculated value
  stored in `openisd.yml` reads back as ENTERED. The model fix (B5) must precede B10.
- **H4 — sequencing inside the layering stream.** A3 needs A2 (the reactivity adapter). A6
  needs A5 (the OpenISDProject facade) and the ruled FileIO interface. A8 is last.
- **H5 — a new project is deliberately unsized.** `prototypeBox()` returns zeros with
  `TODO(box-wizard)` markers; a fresh project shows Vb/Sp precondition errors. Ruled behaviour,
  not a regression — never "fix" it by reintroducing literals. The box wizard is out of scope
  (stream G).

---

# IN-FLIGHT STATE (updated 2026-08-22 ~00:40 — for resume-after-restart; re-verify, don't trust)

- **A5** — impl done, review BLOCKed, REWORK IN FLIGHT (5 items: delete
  OpenISDProject.toJsonRecord (live-#record backdoor, zero consumers); brand the class
  against structural assignment to _OpenISDProjectJson + @ts-expect-error pin;
  ARCHITECTURE.md :354/:1102 corrections; REACTIVITY.md:21-25 channel prose (QO69
  authorises); report restatements). openisd tree is UNCOMMITTED with A5's facade + QO70/71
  edits + D7's two tests in openisdDriver.test.ts (ride A5's commit with a message note).
- **B6** (QT50 envelope deletion), **B8** (QT18 OutOfScope) — impl agents mid-work in
  winisd_tools (clean base 16492ffc). Reviews not yet dispatched.
- **F1** (openisdYamlToWdr export), **F2** (driverYamlToOpenisdYaml port; python
  model_openisd.py at 16492ffc is the spec; parity vs FRESH python output, not the lagging
  corpus) — impl agents mid-work. Reviews not yet dispatched.
- **Review protocol state**: every finished task above needs its Opus adversarial review
  before ticking; reviewers re-check reworks until PASS.
- **Playwright**: full-suite runs ONLY on a frozen tree (no agent editing packages/* during
  the run) — two collapses recorded in
  bugs/BUG_20260821_milestone_playwright_run_166_failures_after_a3_wave.md. Release-gate run
  pending, after A-lane settles.
- **PEER session**: owns the accuton quality bug
  (winisd_tools bugs/BUG_20260821_accuton_quality_out_of_range_test_fails.md) — fix
  authorised since 16492ffc landed. Do not duplicate.
- **Queued next**: A5c (after A5), A6 (carries the QO67 ruling; after A5+A4 — A4 landed
  f0b5d26), A7, A8, A9, A10; B10 (after B5b verification + B6 + B8; B5b's emitter-side
  SI check still unverified — fold into B10's pre-flight), B11; F3 (after F1+F2+B10), F4;
  E1; the release gate.
- **Open ledger items**: QO73 (DriverJSON alias — human), QO74 (deferred DVol trigger),
  QT58/QT59 (post-B10), QO69 (REACTIVITY.md sample — being consumed by A5's rework).

# THE CHECKLIST

Rules of use: work a task only when every `blocked-by` is checked. Tasks in different lanes
touch disjoint files and may run in parallel; tasks inside a lane are ordered. Tick a box ONLY
when the done-criteria are verified with actual output. Any session can resume from the boxes
alone. If a task turns out to need something unlisted, STOP, record it here, and re-sequence —
never improvise around it.

## Lane R — repo & ledger hygiene (immediate, small, mostly independent)

- [x] **R3 — DONE 2026-08-21** (~/.claude commit `0c8867e`: mint = max over ALL entries; demo minted QO66 after the ledger sat at next:64 with QO65 present). Fix `~/.claude/bin/inbox.py` id minting:
      `add` minted duplicate ids twice on 2026-08-21 (QO61, QO62). Every lane raises ledger
      questions through this tool, so a broken minter corrupts the ledger for the whole run.
      Diagnose the actual cause (read the minting code — do not guess; likely it scans only
      open entries or one ledger). Next id must be max over ALL entries, open and closed, in
      the target ledger. Record the defect before fixing (commit message in `~/.claude` at
      minimum). Done: `add` after a close mints a fresh id; demonstrate once. It has now
      collided THREE times (QO61, QO62, QO63 — the third while adding the wizard item), so the
      failure reproduces on demand.
- [x] **R1** Commit the wine-probe results in `winisd_research` — DONE, commit `20747a6`.
- [x] **R2** DONE 2026-08-21: the coax question is `QO65`, the wizard build request `QO64`;
      every QO id verified unique.
- [x] **R4** DONE 2026-08-21: QO56-hazard clause struck from PLAN_QO60_LAYERING_REMEDIATION.md;
      useDesignIO.ts QO55-citing comment deleted (QO57 pointer kept, one line). Both greps empty.
- [x] **R5** DONE 2026-08-21, review PASS after one fix cycle. All 21 appendix rows applied
      with fresh evidence; review spot-checks corrected two (q_group REOPENED — a second
      `['Qts','Qes','Qms']` declaration survives at `driverRepo.ts:226`, now task D6;
      disposition evidence renumbered to the YAML-parsed truth, and the 410 archive records'
      second disposition shape recorded as
      `winisd_tools/bugs/BUG_20260821_archive_records_carry_disposition_in_a_second_shape.md`).
      Seven RESOLVED files' bodies aligned with their Status. CARRY-OVER for the release gate
      item 4: run one header-vs-body consistency pass over BOTH repos' full bug sets (the F7
      class was found outside the original 21).

## Lane A — the four red arch gates (openisd; HOT FILES, strictly serial)

- [x] **A1** DONE 2026-08-21, review PASS (offences 44→34, vue-tsc clean, ALLOWED_GLOBALS +
      gate byte-identical). Objective 1: un-export the 10 dead `store.ts` exports (`enterPrField`,
      `clearPrField`, `prFieldState`, `prTargetUnreachable`, `loadDriverRecord`,
      `driverMetaCell`, `driverWarnings`, `curveIssues`, `restoreProblems`, `unitLabelOf`) —
      verified dead 2026-08-21 (see the corrected
      `bugs/BUG_20260819_store_ts_45_exports_not_on_ALLOWED_GLOBALS_ready_for_review.md`).
      Done: typecheck clean; the globals gate's offence list shrinks by 10.
- [x] **A2** DONE 2026-08-21, review PASS after one fix cycle (commit `00a25ad`):
      `createLiveRef` via shallowRef+triggerRef — the design's computed() sample is proven
      broken on Vue 3.5.38 (QO69 raised for the doc fix); every ManagedOpenISDProject mutator
      now notifies unconditionally, exactly-once both modes probe-verified; the what-if driver
      bridge deleted (it detached on every mutate() re-materialisation — bug recorded and
      RESOLVED); AST notify gate in architecture-notify.test.ts (architecture.test.ts
      untouched). Spin-outs: displaced-meta-lost bug (OPEN), QO70 (ARCHITECTURE.md
      contradiction), QO71 (consumerless OpenISDDriver.subscribe).
- [x] **A3** DONE 2026-08-21, review PASS after one major fix cycle: state.P + 19 accessors +
      P_DEFAULTS + 9 store wrappers + prMode deleted; ~40 facade getters/setters (all
      notify-gated); toUiParams()/loadUiParams(Partial) the ONE wire shape with a 41-field
      lossless round-trip test; NO per-field wrappers in components (twoWay and every
      re-declared wrapper deleted — templates bind direct per REACTIVITY.md); filter chain
      gets per-filter mutators (no live mirror); vent/PR transactions coalesce to one solve
      (pinned); module-globals offences 34→25; ui suite 226 green + the 4 pre-existing arch
      reds. presentationState.ts split to A3b. Spin-outs:
      BUG_20260821_vent_group_auto_solve... (RESOLVED, with the coarse-watch mutating-solver
      design risk recorded OPEN), BUG_20260821_input_power_inverse_computed_inline_in_shell...
      (OPEN, pre-existing). Frc stubbed per ruling.
- [x] **A3b** DONE 2026-08-21, review PASS after two fix cycles (final round verified by the
      orchestrator after the reviewer stalled on box contention): PresentationState store
      (typed initialiser, dead skin/defineOpen deleted), 13 view fields + UiState migrated,
      unit-token functions moved off store.ts (module-globals offences 25→22), namespaced
      hmrSingleton, SerializedState wire shape byte-identical, share-link doc claims aligned
      to the 2026-08-14 ruling, three browser-spec sites repointed. Spin-outs: QO72 (gate
      scope, human's edit); BUG_20260821_original_skin_spec_reads_state_p... (9 pre-existing
      sites, task A3c).
- [x] **D7** (added and DONE 2026-08-21, ruled by QO65, review PASS): `passive_radiator` is
      the ONLY spelling — python enum snake, 154 live db records migrated by
      `scrapers/bin/fix_passive_radiator_spelling.py` (idempotent, archive untouched, both
      record kinds validated), openisd dual-accept deleted. Spin-out:
      bugs/BUG_20260821_sectionfor_cannot_distinguish_invalid_driver_type_from_woofer.md
      (OPEN — undeclared values silently read the woofer section; vocabulary lives in a
      package the model cannot see).
- [x] **A3c** DONE 2026-08-21 (orchestrator-verified: grep zero `state.P`, vue-tsc/eslint
      clean; assertion values unchanged; getter names confirmed against managedProject).
      The single-spec probe's 54 launch crashes are the frozen-tree/dev-server issue recorded
      in BUG_20260821_milestone_playwright_run_166_failures... — the release-gate run happens
      on a frozen tree.
- [x] **A4** DONE 2026-08-22, review PASS after one fix cycle (commit `f0b5d26`): serialize
      takes five named inputs (no AppState — verified a pure function of its parameters);
      history.replaceState exists ONLY in urlAppState.ts; wire shape byte-identical to the
      2026-08-14 nothing-stripped ruling with project meta now pinned by the round-trip test;
      test fixtures inline, AppState cast gone. Spin-out: QO73 (DriverJSON alias gate hole,
      pre-existing, human's call). Follow-up noted for later: stateToUrl/loadFromHash still
      in persist.ts (doc assigns them to UrlAppState — surface with A6/A8, not scope-crept).
- [x] **A5** DONE 2026-08-22, review PASS after one fix cycle (commit `7d4cb16`): class facade
      with detached copies; mutation flows only through mutate()/notify (reviewer-audited);
      structural assignability to _OpenISDProjectJson closed via a required driver key
      (+ts-expect-error pin — the reviewer's brand suggestion was empirically disproven and
      withdrawn); consumerless toJsonRecord deleted; QO71 channel deleted; QO70 ARCHITECTURE.md
      + REACTIVITY.md aligned. PrivateAllow project-shape offences: ZERO. Model 58/58 (67
      with F1/D8). Follow-ups: 4 remaining edit-draft doc refs (E1 sweep); QO69's sample
      still the human's item.
- [ ] **A5c** (added 2026-08-22, peer-suggested, design-conformant) DELETE store.ts's
      `_version` bridge — the parallel second reactivity adapter (`const _version`, the
      `md.subscribe(() => _version.value++)` hookup, every `void _version.value` dependency
      touch) — and repoint each reader onto `createLiveRef` from logic/liveProject.ts: ONE
      adapter, zero duplicates, identical behaviour (same subscribe channel). Also sweep the
      stale `_prototypeProject` comment mention at store.ts:386. Blocked-by: A5. Before A8.
- [ ] **A6** Objective 6 — NOW CARRIES THE QO67 RULING (human, 2026-08-21: distinct
      driver/project pathways; the project REUSES the driver-subsection serialisation the
      driver path uses; combine into ONE fileformat file and dedupe to the greatest extent;
      one [Driver]-block serialiser for .wdr and .wpr; DELETE isLegacyWinisdFormat in the
      same change — closing QO67). Implement `FileIO` per Proposal B + the `FileStore` destination port
      (`docs/design/FILEIO_API_PROPOSALS.md`); split `useDesignIO.ts` accordingly; PR inverse
      formulas to `@openisd/engine`; `.wpr` parsing raw-only in `@openisd/winisd`; apply the
      three `ARCHITECTURE.md` corrections. Blocked-by: A5, C1. Done: `createFileIO` exists and
      is constructed only in `main.ts`; useDesignIO's `OpenISDDriver` value import gone;
      wpr/useDesignIO suites green.
- [ ] **A7** Objective 4: catalogue index built on demand, env-keyed; bundle emits canonical
      `_OpenISDDriverJson` verbatim (fixes
      `BUG_20260820_drivers_bundle_ships_a_shape_openisddriver_cannot_read`); delete
      `readCell`/`readMetaCell`/`readDisplayName`; measure resident memory of 1,526 live
      drivers and record the number. Independent of A2–A6; touches `db/`, `scripts/`. Done:
      picker browser spec green; no `_OpenISDDriverJson` in `driverRepo`/`myDrivers`/
      `driverLibrary`/`driverSelection`.
- [ ] **A8** Objective 7: the UI stops importing storage — `.vue` files take domain facades or
      services; `OriginalShell.vue` (21 names) last. Blocked-by: A1–A7. Done: driver-value and
      containment gates green.
- [ ] **A9** Objective 11: the three new arch gates (re-export ban; import-from-declarer-only;
      no domain VALUE passing through a component) — AST checks, never prose greps. Blocked-by:
      A8. Done: gates exist and are green on the finished tree.
- [ ] **A10** RELEASE BLOCKER CHECK: all four original arch gates green in the FULL suite.
      **The human's standing instruction (2026-08-21, verbatim): "I am expecting them to be
      solve without you violating the arch ok" — the gates go green by moving the CODE to the
      architecture, never the reverse.** Any edit to a gate's own assertions, its scan set, an
      ALLOWED_GLOBALS entry, or a PrivateAllow list is a HUMAN decision, raised to the human
      with the reasoning — an agent making such an edit to reach green is falsifying the
      result. Blocked-by: A8. Done: `npx vitest run` ≥ 1844/1844 with actual output quoted,
      and a diff check showing `architecture.test.ts`'s assertions and every allow-list are
      byte-identical to their state at run start except where the human explicitly ruled.

## Lane B — winisd_tools model + the regeneration gate (serial: all touch `model_driver.py`)

- [x] **B1** DONE 2026-08-21, review PASS after one fix cycle (fields + projection + order
      guards + FIELD_DEFINITIONS completeness assertion — which exposed and deleted a dead
      `name` entry — + yyyy-mm-dd constraint; 72/72; QT20 row D overturn noted). Spin-outs:
      openisd `name?: _DerivedField` now producer-less
      (bugs/BUG_20260821_openisd_name_field_declared_but_inert.md); model_wdr.py's hardcoded
      ProvidedBy/DateAdded recorded in QO42 notes (fix rides Lane F's TS mapper).
- [x] **B2** DONE 2026-08-21, review PASS after two fix cycles: read_value AND read_precision
      Optional[float], null together, licensed ONLY by RejectedRead.NO_NUMERIC_VALUE (all 9
      validator states probe-verified incl. the contradiction rejection); "N/A" verbatim in
      actual_reading; explicit _reading_value/_reading_precision narrowing at every consumer
      (pyright 0); 171+24 green. NOT independently releasable — QT48's "must land as one"
      makes B10 the gate (producer wiring + openisd null read-side ride the regeneration).
      Spin-out: BUG_20260821_no_number_classifiers_disagree... (OPEN, pre-B10 blocker for the
      factory wiring). Orchestrator also closed the repo-wide bug-ledger evidence gate (7
      files → 15/15).
- [x] **B3** DONE 2026-08-21, review PASS after two fix cycles: dq_status→corroboration,
      dq→dq_marks, DQStatus a real Enum (plain Enum per house convention), 23 raw-string
      comparison sites swept, the one-dq-verdict gate now catches BOTH spellings (probed),
      test module renamed, verdict_for's dead dict arm recorded-then-deleted with the spec()
      pre-validation ordering fixed (typed ValidationError restored), reading_value/
      reading_precision made public. pyright 0; full touched set 303 passed / 1 pre-filed
      accuton failure. On-disk records now refuse (expected; B10 regenerates).
- [x] **B4** DONE 2026-08-21, review PASS after one fix cycle (and the reviewer WITHDREW its
      own count finding on re-measurement — 253+112 exact, archive excluded). disposition
      derived (no_ts_published wins; else missing|parse_errors → incomplete; else ok), the
      contradictions unrepresentable at load; set_disposition/model_copy-hole/
      recompute_dispositions/_THIN_RECORD_DISPOSITIONS/constraint-7 deleted with an
      import-time totality guard + parametrized test replacing constraint 7's job;
      constraint 12 re-targeted; 18 emitters keyword-ised; exemplar corrected; 1173 lib green;
      pyright 0. Spin-outs: QT58 (post-B10 refusal), QT57 verdict (peer-recorded,
      re-verify), B-post checklist item.
- [ ] **B5b** SI DIMENSION KEYS — **CRITICAL (human, 2026-08-21: "SI migration is critical
      make sure its done")** (prod blocker,
      `bugs/BUG_20260819_record_stores_dimension_fields_in_mm_litres_instead_of_si.md`): the
      TS side reads SI field names but real on-disk records still carry the old mm/litre keys
      and `fromJsonRecord` does no remap — 10 dimension fields silently lost on read. Fix
      direction: the EMITTER writes SI (verify), the regeneration (B10) converts the corpus,
      and openisd gains NO remap shim (one-model rule: an undeclared key is invalid, full
      stop). Interim reads of old records stay lossy until B10 — that is why B10 is a release
      gate item. Done: post-B10 spot-check shows SI keys; a fixture read carries all 10 fields.
- [ ] **B5** RULED 2026-08-21 (QT56, verbatim in the ledger): the DQ split is ADOPTED — py =
      structural DQ + cross-source corroboration; oid = all relation-math DQ live. The
      workability amendment (read_value optional) ALREADY LANDED as B2/QT48. NO calculated
      marker is built (grounds proposal retired). Remaining B5 work, now unblocking B10:
      (a) a gate making pipeline-computed spec values unrepresentable (winisd_tools);
      (b) py's relation-math deletion (model_wdr.py:454-657 + 3 DQ_RULES) rides Lane F4;
      (c) oid's EBP relation gap = the filed bug; (d) .wdr [DQ] export rewires to live
      checkConsistency in the F-lane writer. Only (a) blocks B10.
      Original item — H3: persist the calculated-marker — the record shape gains what is needed so a
      pipeline-CALCULATED value does not read back as ENTERED; openisd's reader honours it.
      Cross-repo: design first, show the human the shape before building. Blocked-by: B4.
      Done: a calculated fixture value reads back Calculated in openisd.
- [ ] **B6** QT50: delete `FieldEnvelope.__eq__` + `_unpack`; explicit unwrap in
      `_check_readings`; migrate the ~64 assertions to `.value ==`. Verify the call-site count
      with findReferences before deleting. Blocked-by: B4 (same file). Done: `_unpack` gone;
      pytest green.
- [x] **B7** DONE 2026-08-21, review PASS (coverage for all four deleted behaviours confirmed
      on the production path; stage 6 drives FrameworkRunner.run_stage_5_emit; goldens
      unchanged; scenarios 9/9; two history comments removed by the orchestrator). Follow-ups
      in QT12 notes: SCRAPING.md stale emit_from_seed prose; identity.resolve's dead
      distributor_url param. QT12: delete `accuton/emit.py::emit_from_seed` +
      `test_emit_metadata.py`; scenario stage 6 now runs the IoC path.
- [ ] **B8** QT18: migrate the 11 discovery-filter plugins to `OutOfScope`-at-build (faitalpro,
      bc_speakers, scanspeak, accuton, purifi, volt, tangband, morel, bliesma, visaton,
      wavecor — tangband is in both camps, unify it); delete `is_non_driver_slug` +
      `NON_DRIVER_SLUG_PATTERNS` when unreferenced; rewrite the `discovers_count: 23` comment
      and expectation (becomes 25 discovered, 2 refused at build). Blocked-by: B7 (scenario).
      Done: grep for the deleted names returns nothing; scenarios green.
- [x] **B9** DONE 2026-08-21, review PASS after three fix cycles: archive hook in
      unit_pool.settle() (domain-agnostic, typed ArchiveFn), wired at all 5 stages (AST-pinned);
      finally-based drain settles+archives every still-live unit on abort AND SIGINT (real-
      signal red-first test), guarded so a settle failure never masks the abort; archive runs
      after harvest so status labels are final; single derivation authority
      (FrameworkRunner._workingout_root). 36+8+7 green. Retention ruling + hardlink/Ctrl-C-
      latency options recorded in QT8 for the human.
- [ ] **B-post** (added 2026-08-21; ride or follow B10, per rulings) QT58: after the re-emit,
      `disposition=` construction input becomes non-constructible (the load tolerance must not
      outlive the regeneration). QT57 (John delegated; verdict recorded by the peer session —
      RE-VERIFY the ledger before acting): MEASURE whether rating ⟺ disposition over the
      corpus INCLUDING the crosscheck/apply_fielddq mutation axis; isomorphic → DELETE rating;
      wider-evidence → derive it like disposition; genuine human-judgement counter-examples →
      STOP and present them.
- [ ] **B10** **THE REGENERATION (H1)** — single emit re-run over every record. The whole of
      Lane B is the programme recorded in
      `winisd_tools/bugs/BUG_20260821_emitted_records_lag_the_openisd_model_and_the_cohort_needs_re_emission.md`:
      the emit phase is made COMPATIBLE with the latest openisd model, then the cohort is
      re-emitted ONCE (human, 2026-08-21). Blocked-by: B1, B2, B3, B4, B5, B5b and B6–B8
      landed. Done: 0 records carry the old brand-"decides the record's folder" string (was
      3,989); a randomly sampled regenerated record loads through
      `OpenISDDriver.fromJsonRecord` with ZERO dropped fields (all 10 dimension fields present
      under SI keys); new meta fields present; pytest + db-conformance green.
- [ ] **B11** Rebuild openisd's drivers bundle (collects B10 and QT52's pending 1912→1526
      reduction). Blocked-by: B10, A7 (bundle shape). Done: bundle loads; picker spec green.
      HAZARD (from D7's review): scripts/bundle-drivers.mjs:104 `specSection()` duplicates
      sectionFor's job in JS with NO passive-radiator branch — PR records would resolve by
      accident via Object.values(specs)[0]. Today no PR is bundled (disposition gate), but
      B4's derivation may flip PR records to `ok`, making that path load-bearing. A7/B11 must
      reconcile specSection with the model's resolution before the rebuild.

## Lane C — encoding (small, early: A6 depends on it)

- [x] **C1** DONE 2026-08-21, review PASS after one fix cycle (encoding enum + {text,encoding}
      result; CP1252 fallback gated to .wdr/.wpr only, our own formats fail loudly; sweep over
      all bundled non-UTF-8 files; ¤-loss pinned as accepted; 20/20 + 1260/1260 green; UI
      surfacing of the encoding recorded as outstanding in QO62; QO67 raised for format-model
      unification). QO62 ruling: `wdrBytesToText` decodes strict UTF-8 (fatal); on failure decodes the
      WHOLE file as CP1252; the caller learns which encoding was used and the UI can say so.
      Write stays UTF-8. Tests: `drivers/winisd/Selenium SW108 .wdr` reads back with `•`/`®`/
      `±`/`½` intact; the unicode goldens still byte-round-trip. Done: tests green; the
      FF FF/E6 splice is NOT used as an oracle.
- [x] **C3** DONE 2026-08-21, review PASS after one fix cycle (whole-block golden assertions;
      revert shows all four keys red; wpr suite 14/14). Uncovered a NEW defect, now task C4.
      PHANTOM VENT (prod blocker,
      `bugs/BUG_20260820_wpr_writer_emits_phantom_vent_for_a_passive_radiator_project.md`):
      the `.wpr` writer emits a vent section even for a passive-radiator project. Re-verify
      against a WinISD-written PR golden (`goldens/passive-radiator.wpr`), then fix the writer
      to match what WinISD itself emits. Done: PR export matches the golden's section set;
      wpr suite green.
- [x] **C4** DONE 2026-08-21, review PASS after one fix cycle: Fb/Vb proven a redundant copy
      of the owning chamber's [Box] tuning/volume (bandpass4 discriminates); WprVent gained
      REQUIRED Fb/Vb/carea (no evidenced default → the type forces call sites); whole-block
      golden equality on all three populated-vent goldens; 18/18. Spin-outs:
      bugs/BUG_20260821_wpr_float_formatting_diverges_from_winisd_15_digits.md (OPEN — JS
      17-digit String() vs WinISD's 15; carea/Sdfport/Sdrport literal-fed until resolved;
      standing rule recorded: parity tests derive inputs from scenarios, never from the
      golden's output). Backlog: make WprVent.dia/len required too (no live hole today).
      Original item: Fb/Vb/carea zeroed on POPULATED vents
      (`bugs/BUG_20260821_wpr_writer_zeroes_fb_vb_carea_on_populated_vents.md`): every
      vented/bandpass `.wpr` export carries a zeroed port area and untuned per-vent Fb/Vb.
      `WprVent` has no such fields, so the interface must gain them; `carea = π·(dia/2)²` is a
      derivation that belongs in `@openisd/engine`; establish from the goldens/engine whether
      per-vent Fb/Vb are redundant with `[Box].Fr` or independent state — if the evidence is
      inconclusive, raise to the human instead of guessing. Blocked-by: C1 (same package's
      test files in flight). Done: populated-vent whole-block equality against the vented and
      bandpass goldens green; no derivation outside the engine.
- [x] **C2** DONE 2026-08-21: recorded as
      `winisd_drivers/bugs/BUG_20260821_selenium_sw108_wdr_mid_word_byte_splice_source_damage.md`
      with xxd evidence (splice at 0xF1); owner: John (data fix or upstream report).

## Lane D — ruled UI items (registry/units files; disjoint from Lane A until A8)

- [x] **D1** DONE 2026-08-21, review PASS (27/27 unit tests; layout spec 29/29 with
      --workers=1; factor-1 traced label-only end to end; defaults Rms/Rme=Ns/m, Mcost=kg/s
      verified against WINISD_PARITY.md + UNIT_BOUNDARY_AUDIT.md; registry-bounds side effect
      pinned by a ceiling test). Open items spun out: QO51 note (inert unitGroup — registry-
      vs template-driven mechanism, human's call);
      bugs/BUG_20260821_rme_mcost_numinput_precision_defaults_to_2_not_registry_5.md.
- [x] **D2** DONE 2026-08-21, review PASS. Refined verdict: "label only" was false (Znom is
      derived from Re when not entered, matching the engine formula exactly), but "not used in
      simulation" is TRUE (nothing in the engine reads Znom as a formula input — verified).
      Tooltip corrected in DriverEditorModal.vue AND DriverBrowserWinisd.vue; `'Z'` removed
      from NO_FORMULA (dead entry — the sweep keys on 'Znom'); sweep 10/10 green; QO51 note
      recorded.
- [x] **D3** DONE 2026-08-21, review PASS after one doc-fix cycle: `modeled` deleted from
      FieldSpec + all 94 entries (77 true / 17 false; zero readers re-verified, no doc claims
      a consumer — UNIT_BOUNDARY_AUDIT.md:160 shows the flag was false for three
      engine-derived fields); registry doc paragraphs rewritten to the true bounds/unit rule;
      UNIT_BOUNDARY_AUDIT F4/F8 updated; vue-tsc clean, 27/27.
- [x] **D5** DONE 2026-08-21, review PASS after two fix cycles: five Fs routes in WinISD's
      priority order (rels 11>14>2>4>12), spurious Rms·Qms route deleted, per-pass lockout
      proven identical to WinISD's own guard chain (Ghidra evidence independently verified),
      all adjacent priority pairs pinned; driver.test.ts 36/36, engine 370/370, parity
      436/436. Spin-outs recorded: bugs/BUG_20260821_cms_route_order_inverted_vs_winisd.md
      (pre-existing, factor-2 Cms divergence), bugs/BUG_20260821_consistency_relations_miss_
      the_ebp_fs_route.md. FS ROUTES — **CRITICAL (human, 2026-08-21: ordered fixed)** (prod blocker,
      `bugs/BUG_20260817_engine_is_missing_two_of_winisds_fs_routes_and_has_one_winisd_does_not.md`):
      the engine's Fs derivation misses two of WinISD's routes, has one WinISD does not, and
      orders priorities differently — a round-tripped `.wdr` can invent or omit Fs marks.
      Re-verify the route inventory against the bug's evidence, implement the missing routes in
      `@openisd/engine` (nowhere else), delete the spurious one, and pin with parity tests.
      Done: parity suite green on the Fs scenarios.
- [x] **D6** DONE 2026-08-21, review PASS after one fix cycle (engine `qGroupIsIncomplete`
      single source; exactly one Q-triple declaration repo-wide; `driverHasDqIssues` gained
      its first direct tests, 15, threshold pinned both sides of 2; commit `40daae8`).
      (added 2026-08-21, from R5's review) q_group redeclared:
      `packages/ui/src/db/driverRepo.ts:226` carries `(['Qts','Qes','Qms'] as const)` and the
      `qCount < 2` completeness rule — the second declaration of a domain rule the engine owns
      (`bugs/BUG_20260821_q_group_redeclared_in_ui...md`, reopened OPEN). Route it through the
      engine's single source; then re-flip the bug. Done: exactly one Q-group declaration
      repo-wide; bug RESOLVED; narrow suites green. (Run BEFORE A7 touches driverRepo.ts.)
- [x] **D4** DONE 2026-08-21 — proposal delivered (docs/design/COAX_QO65_PROPOSAL.md) and the
      human RULED (QO65, verbatim in the ledger): tweeter modelling is NOT a bug — no current
      intent, future support is backlog; coax bug flipped WONTFIX. The ruling's REAL finding
      became task D7. Original item — COAX (the human's open question, `QO65`): `OpenISDDriver` locks to the
      woofer section only. INVESTIGATE and propose: what breaks for a coax record (tweeter/
      passive-radiator sections), what the model change is, and whether it is release scope —
      then ASK THE HUMAN. Do not build without the ruling. Done: proposal delivered, ruling
      recorded in the ledger.

- [ ] **D8** (added 2026-08-22, QO74 promoted to plan work by the human: "add QO74 to the
      plan as a suffix to the main work - of if it fits in to a spare gap then do it")
      Build the DQ detector for a stale carried DVol disagreeing with the §3.10.1 derivation
      (deliberately not built with the DVol lock, HEAD 102979c). Engine-only
      (consistency.ts territory), TDD, no weakened gates. Done: detector pinned by tests over
      agree/disagree/absent cases; consistency suite green; QO74 closed with the outcome.

## Lane E — hygiene (run LAST before the release gate, to avoid conflicts with A/B edits)

- [ ] **E1** The 49 historic comments (27 in `packages/ui`; rest docs/) — READ each, delete
      those whose subject no longer exists, keep constraint-explaining comments. Blocked-by:
      A8 (so the sweep sees final code). Done: re-grep shows only justified survivors, each
      defensible.

## Lane F — the V8 bridge (QT54 — IN SCOPE; openisd side parallel to A, tools side after)

- [x] **F1** DONE 2026-08-22, review PASS after one fix cycle (commit `7d4cb16`): exported
      from @openisd/model (the only cycle-free home); Result contract held via an
      ACKNOWLEDGED interim try/catch — the real boundary fix (fromJsonRecord →
      Result<OpenISDDriver>, 6 call sites incl. DriverEditorModal.vue) is recorded OPEN in
      bugs/BUG_20260822_openisddriver_getters_throw...md and sized for A-lane; the fixture
      test is a real pin (Fs/full ParState/pre-B10 key forcing regeneration at B10). 16/16 +
      58/58 + typechecks. Reviewer reports for John: every new export lands as an
      ALLOWED_GLOBALS offence by design (his grant); the harness-vs-project attribution
      conflict needs the project git-actions override (interim: the orchestrator suppresses
      trailers on every commit).
- [x] **D8** DONE 2026-08-22 (commit `7d4cb16`): rel-25 DVol geometry lock in the engine's
      RELATIONS (§3.10.1 formula, house half-ULP tolerance, degenerate geometry skipped by
      the file's own pattern); 5 inline-data cases red-first; engine 385/385; QO74 closed.
- [ ] **F2** Implement + export `driverYamlToOpenisdYaml(yamlText) → Result<string>` — the
      `driver.yml → openisd.yml` projection currently existing ONLY in Python
      (`model_openisd.py::from_metadata`). Largest new TS work in this stream; port from the
      Python as the spec, with fixture parity tests against real records. Done: parity on a
      representative record set.
- [ ] **F3** winisd_tools: embed a JS engine (choose per `DESIGN.md` §12's due-diligence notes),
      call F1/F2, and run PARITY against the Python mappers — byte-identical output on the full
      corpus. Blocked-by: F1, F2, B10 (parity against post-regeneration records). If parity is
      not byte-identical: STOP, report — do NOT regenerate again to paper over it. Done: parity
      report quoted.
- [ ] **F4** Delete the Python mapping half per `DESIGN.md` §12.8: `model_wdr.py`'s mapping,
      `wdr_ini_file.py`, the pinned tests (`toys/` and `test_ts_formula_parity.py` are ALREADY
      gone — do not chase them). DQ half moves out first, in its own change, per the design.
      Blocked-by: F3. Done: pytest green with the deletions.

## Lane G — explicitly OUT of release scope (one line each, do not start)

- Box wizard / alignment-driven sizing (H5): feature gap; standing build request recorded as
  ledger item **QO64** (2026-08-21) with the full scope and the reverse-engineer-first
  constraint — it stays open until built, so it cannot fall between the cracks.
- Curve digitiser (QT7): human deferred — "we can do curve scraping later".
- Precision-maths migration build-out (QP19): dependency ruling made; the migration itself is
  its own campaign (`MATH_MIGRATION.md`) — only the engine "zero dependencies" text change
  rides this release IF a precision dep actually lands, which it does not by default.

---

# APPENDIX — Phase-0 bug sweep results (measured 2026-08-21; re-verify before acting)

## Prod-blockers found (all now have checklist tasks)
| bug | task |
|---|---|
| record_stores_dimension_fields_in_mm_litres_instead_of_si — 10 fields silently lost on read | B5b + B10 |
| drivers_bundle_ships_a_shape_openisddriver_cannot_read — 1,526 drivers | A7 + B11 |
| engine_is_missing_two_of_winisds_fs_routes — Fs marks invented/omitted on round-trip | D5 |
| wpr_writer_emits_phantom_vent_for_a_passive_radiator_project | C3 |
| new_project_invents_box_and_vent_values — box wizard absent | Lane G (human's scope call) |

## Stale Status lines to correct (task R5) — file says / actually
parstate-writer-emits-n: OPEN / FIXED (Step 8, 436/436 parity) ·
uspl-and-splmax-use-formulas: BLOCKED / FIXED (ruled+implemented 2026-08-21) ·
winisd-compatibility-air-returns-truncated-rho-and-c: BLOCKED / FIXED (superseded) ·
driver-fromwdr-marks-a-present-carried-field-entered: OPEN / FIXED (Step 8) ·
openisddriver-passes-mm-named-dimension-fields: OPEN / FIXED (_SpecSection SI-native) ·
winisd-compatibility-air-does-not-scale: BLOCKED / ruling received, probe tracked elsewhere ·
tune_panel_shows_N_for_Mms_and_Qms: OPEN / test-fixture gap only (its own reinvestigation says so) ·
wdr-round-trip-is-not-byte-identical: OPEN / RESOLVED (509/509) ·
architecture_sweep_calc_in_store: 4 open / V2+V3 resolved, V1+V4 open ·
fromOpenISDRecord_does_not_exist: BLOCKED / RESOLVED (method removed) ·
managedproject_edit_draft_lifecycle: OPEN / RESOLVED (dead code deleted) ·
pr_formulas_and_air_constants_duplicated: DEFERRED / mostly resolved, remainder in a named plan ·
vent_area_formula_duplicated_four_times: OPEN / RESOLVED (ventArea_m2 single source) ·
engine_speed_of_sound_constant_disagrees: OPEN / RESOLVED (constants removed, 14/14) ·
prFsWithMassDisplay_exported_but_never_called: OPEN / RESOLVED (called in PREditModal.vue) ·
private_type_return_gate_has_no_same_file_owner_exemption: PARTIAL / RESOLVED (0 offences) ·
private_type_return_gate_misses_computed_generic_arguments: OPEN / RESOLVED ·
q_group_redeclared_in_ui: OPEN / RESOLVED (isQGroupField from engine) ·
wpr_import_fabricates_sixteen_driver_and_box_values: OPEN / RESOLVED (numOrAbsent) ·
winisd_tools disposition-says-ok-on-every-record: OPEN / RESOLVED (3 distinct values live) ·
winisd_tools the-conformed-name-field-is-optional: OPEN / RESOLVED by field deletion

## Still-live non-blockers, by lane
Lane A: address-bar-no-live-state; arch-sweep V1 (`eg` in store) + V4 (file-wide
eslint-disable); CellState owned by winisd pkg; readcell builds-and-discards; syncedp `eg`;
syncedp filters deep-copy; exportWpr seven-fragment assembly; driver-record-as-currency;
store 45-exports review. Lane D/F: coax sectionFor (D4). Lane E: restoreProblems never read;
use-prefix non-composables; winisd tests assert model behaviour; historic comments (E1).
Lane F (one-offs, non-blocking): mms-cms golden UNCAPTURABLE; winisdAir temp-scaling +
compat-mode fidelity; DVol relation unimplemented (2 files, duplicates); sealed-fsc locator
ambiguity; inbox duplicate-id (R3 — DONE); s-roo oracle exclusion; seven air wrappers;
wpr-export Count=0 remainder; ohm-glyph 2 records; scanspeak text-layer; live-queues
residuals 2+3; rme-formula tolerance; epique15 fixture Xmax mm (re-triaged: openisd data).
EXTERNALLY BLOCKED (2026-08-21, why they wait): ohm-glyph/scanspeak-text-layer/rme-formula
need datasheet re-reads or a live WinISD install; queue seeds wait on the no-rebuilds rule,
superseded by B10's regeneration. ASSIGNED OUT: the accuton quality-test bug
(BUG_20260821_accuton_quality_out_of_range_test_fails.md) → the PEER session, diagnosis
read-only until this run's winisd_tools wave commits, then it may fix.

## Release gate (all verified with actual output quoted)

1. `npx vitest run` — fully green INCLUDING all architecture gates (≥1844/1844). [A10]
2. `npx eslint packages` — 0 problems. Typecheck ×4 — clean.
3. Full Playwright suite, background, `--workers=1`, ONCE — green.
4. Every `bugs/*.md` RESOLVED or carrying an explicit human DEFERRED ruling. [R5 + fixes]
5. The regeneration ran ONCE, after all model changes; bundle rebuilt. [B10, B11]
6. Reviewer sign-off (Fable) against the six principles on the final tree.
Then report to the human for the release decision. Never tag, publish, or push.

## Execution protocol

- **Impl agents: Sonnet.** One checklist task each; give each the working rules above, the arch
  rules for its files, and the instruction to TDD and to STOP-and-report rather than work
  around anything. Update this file's checkboxes as tasks verify.
- **Standing reviewer: Opus, adversarial.** Loads `~/.claude/skills/senior-architect-review`.
  Reviews every task's diff BEFORE its box is ticked: arch violations, weakened tests,
  convenience wrappers, historic comments, JSON leaks, calculation outside the engine,
  invented values, and done-criteria actually met. A finding BLOCKS the task; the impl agent
  fixes; re-review until clean. The reviewer writes no production code, ever.
  **AGENT ATTRIBUTION IS A BLOCKING FINDING (human, 2026-08-22):** every review checks the
  repo's recent commit messages in its scope (`git log --format="%B"` over the commits since
  the task began) for `Co-Authored-By: Claude`, `Claude-Session:`, `Generated with [Claude`,
  or any agent/Anthropic attribution — any hit BLOCKS until the (unpushed) message is
  rewritten clean. The orchestrator writes all commits with no attribution.
- **Fable reviews twice:** this plan before implementation starts, and the final release-gate
  sign-off. Those two reviews are where subtle misses ship — do not economise there.
- Decisions the rulings don't cover go to the human, batched, and are recorded in the ledger
  (`inbox.py add`) the same turn they are raised.

## Git and Final cleanup 

Commit at regular intervals.
Dont push.
Check the git commits for any agent attributions in the git log and rewrite these entries to
remove refs to the agent. MEASURED 2026-08-22: this run's own commits are clean; 48 OLDER
unpushed commits on openisd `origin/dev..dev` (prior sessions) carry
`Co-Authored-By: Claude`/`Claude-Session:` trailers — the cleanup rewrite covers those
(unpushed, so rewritable without violating the never-force-push rule). Sweep winisd_tools/
winisd_drivers/winisd_research unpushed ranges the same way at cleanup time.
