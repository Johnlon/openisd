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
| QT54 | Build the V8 bridge — **IN RELEASE SCOPE (human, 2026-08-21); SUPERSEDED 2026-08-22 (human, verbatim in ledger)**: export `openisdYamlToWdr` ONLY — `driverYamlToOpenisdYaml` is not needed (python creates driver.yml exclusively; openisd never knows about it). The dangling `driverYamlToOpenisdYaml` re-export was removed from `packages/model/src/index.ts` in A6 (the module never existed). |
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

# IN-FLIGHT STATE (updated 2026-08-22 ~10:15 — for resume-after-restart; re-verify, don't trust)

- **SCHEMA RULINGS (John, this morning, in chat — recorded in winisd_tools DESIGN.md
  §"Per-source reading scenarios" + QT59/QT62 ledger items, commits a28c6bbc/fdc9a07f/985508c3):**
  the nine reading scenarios are the ruled design. Mandatory expected-field emission;
  value-less rejected-only entries; actual_reading Optional (omitted = nothing to read);
  single-entry readings lists LEGAL (≥2 constraint removed — every scraped field carries
  readings); co-presence rule (value/origin/corroboration together or not at all). STILL
  OPEN: which fields are "expected" (recommended _SPEC_TS_FIELDS 23 vs all 39 — John's
  call). These rulings are B-lane model work (constraint 5 rewrite, emit seam) and change
  B10's output shape substantially — B-lane peer must implement before B10.
- **Milestone Playwright run** launched ~10:10 (background bhntxlbg8, --workers=1, quiet
  tree with A6+A7 uncommitted work). Expected red: driver-selection.browser.spec.ts (8,
  bug filed — spec seeds retired flat shape). Classify on completion.

- **A6 — QO78 RULED (option d, verbatim in ledger): file IO MOVES into the owning domain
  module (project IO → managedProject.ts; driver IO → managedProject.ts or a new
  managedDriver.ts, gate-licensed by the ruling); wrappers + get driver() deleted
  (ownership, not exemption). FINAL REWORK DISPATCHED to the A6 child, folding in QO73/D11
  (alias deletion + no private value in ui/ + the AST anti-alias/anti-erasure gate).
  Review-then-commit follows. Prior state: Three review
  cycles done: cycle-3's verify pass BLOCKed on 3 comment/doc findings, all fixed by the
  orchestrator directly and verified (grep 0, suites 13/13, typecheck clean): ARCHITECTURE.md
  `.owpr` self-contradiction resolved at :519/:950-table/:982 (current shape = SerializedState,
  A8 decides narrowing), openisdYamlToWdr.ts task-scope narration removed (constraint kept),
  useDesignIO what-if ordering made structural (snapshot/record hoisted to first statement in
  projectJsonText + shareLink; header comment states the real mechanism), purity-test comment
  scoped to what the regex actually guards. `as unknown as FileSystemFileHandle` in
  fileStore.test.ts adjudicated ACCEPTED (test fake of wide DOM interface, repo precedent).
  Remaining before A6 commit: John rules QO78 → apply his option → quick final review →
  commit (note: pre-commit hook runs the full suite; the pre-existing winisd-parity 1-test red
  must be resolved or the hook will refuse — investigate at commit time). Reviewer's noted
  sniff deltas (JSON array → error; unparseable driver record → error, was raw load) are
  accepted strictness increases, recorded here.
- **B6/B8** — DONE via peer commits `a7b513e2` + `3d2a3aa5` (winisd_tools); reviewed, blockers
  fixed and verified (AGENTS.md revert read directly; evidence gate 19/20, sole red = open
  runlogger bug's own field). Peer `yaml-divergence-wdr-refactor` resumes B-lane on
  model_driver.py; peer `add-title-filter-tests` holding (its no_tmp-guard settings.json fix is
  a DRAFT proposal in the bug file — needs sign-off, it's a security guard).
- **inbox.py flock verified** 2026-08-22: 4-way concurrent mint stress test → unique ids, no
  dupes; the peer's reported collision predated the flock commit.
- **Queued next**: A6 re-review+commit → F3-support bundle build → A7 (carries the disposition
  bug `BUG_20260822_openisd_reads_disposition...`), A8 (last), A9, A10; B10 (pre-flight SI
  check; QT59/QT62 rulings), B11; E1; frozen-tree full Playwright; release gate; final
  attribution-trailer rewrite of unpushed commits.
- **A7 (catalogue/bundle)** — implementation + adversarial review done; cycle-2 fixes running
  (child). Derivation VERIFIED correct (mirrors python stamp_disposition; corpus keys stale —
  564 store 'ok' against non-empty missing, 239 the reverse; stale-corpus bug being filed in
  winisd_tools). Commit HELD on QO79 (bundle gate criterion: new gate yields 1197 vs 1526,
  564 dropped drivers ALL simulatable — product call). QO80 filed: 18 new export names
  (A6's 17 + A7's recordStandingIsOk) need John's ALLOWED_GLOBALS grants. readCell/
  readMetaCell/readDisplayName deletion deferred — live callers in driverRepo/driverLibrary;
  needs the A6-held openisdDriver.ts or a QO73/QO75-adjacent ruling. Pre-existing
  driver-selection.browser.spec.ts red has its own bug file (spec seeds a flat shape
  myDrivers no longer tolerates).
- **archive-bugs.py** — classifier rewritten (any OPEN line anywhere keeps the file in
  bugs/), probe-verified; fix in tree, rides next code commit (bug record committed d537e9b).
- **Morning queue for John** (unacked): QO73, QO75, QO77, QO78, QO79 (holds A7+B11),
  QO80 (ALLOWED_GLOBALS grants), QT58, QT59, QT62, QT63, QT64.
- **Standing rules in force**: adversarial review before every tick; agent attribution = a
  blocking review finding (this run's commits clean; 48 legacy unpushed openisd commits carry
  trailers — final-cleanup rewrite); full Playwright only on a frozen tree.

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
- [x] **A5c** DONE 2026-08-22, review PASS after one fix cycle (commit `3596c6c`): _version
      bridge deleted, watches take the LIVE REF directly (the review caught — with executed
      proof — that a getter-source watch returning an identical reference never refires: the
      PR auto-solve watch was dead; fixed + pinned by a lower-bound solve test);
      createLiveRef now disposes with its owning scope (component leak recorded+RESOLVED);
      grep-zero _version; 56 narrow + ui 230/234 (the 4 pre-existing arch reds). Spin-out:
      QO75 (approved-stores gate blind to wrapped reactives + .vue files — human's gate).
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
- [ ] **A7** NOW ALSO CARRIES (2026-08-22):
      bugs/BUG_20260822_openisd_reads_disposition_which_post_b10_records_no_longer_carry.md —
      post-B10 records carry NO quality.disposition/no_ts_published (John's REWORK ruling);
      bundle-drivers.mjs's `disposition === 'ok'` gate and driverHasDqIssues must switch to a
      SHARED local derivation from missing/parse_errors before B11. Objective 4: catalogue
      index built on demand, env-keyed; bundle emits canonical
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
- [x] **B6** DONE 2026-08-22 (peer session `yaml-divergence-wdr-refactor`, winisd_tools
      `a7b513e2` + review-fix `3d2a3aa5`): `FieldEnvelope.__eq__`/`_unpack` deleted, explicit
      unwrap in `_check_readings` (dead `comparable` param also deleted in the fix commit),
      assertions migrated. Orchestrator post-commit review raised 2 BLOCKs (unauthorized
      AGENTS.md carve-out widening — reverted verbatim to 2026-07-20 wording; bug-file evidence
      headings — fixed, gate 19/20 green, sole red is the open runlogger bug's own field) — both
      verified fixed by direct read of AGENTS.md + gate run 2026-08-22.
- [x] **B7** DONE 2026-08-21, review PASS (coverage for all four deleted behaviours confirmed
      on the production path; stage 6 drives FrameworkRunner.run_stage_5_emit; goldens
      unchanged; scenarios 9/9; two history comments removed by the orchestrator). Follow-ups
      in QT12 notes: SCRAPING.md stale emit_from_seed prose; identity.resolve's dead
      distributor_url param. QT12: delete `accuton/emit.py::emit_from_seed` +
      `test_emit_metadata.py`; scenario stage 6 now runs the IoC path.
- [x] **B8** DONE 2026-08-22 (same peer commits `a7b513e2` + `3d2a3aa5`): plugins migrated to
      `OutOfScope`-at-build; `is_non_driver_slug`/`NON_DRIVER_SLUG_PATTERNS` deleted; scenario
      count re-measured to 23 with comments rewritten; DSP distributor coverage restored in the
      fix commit (`'dsp'` in `_DISTRIBUTOR_COMPONENT_PATTERNS`) after review flagged its loss.
      Scenario suite green per peer report; evidence gate verified by orchestrator.
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
- [ ] **D9** (added 2026-08-22, QO77 ruled option-b-strengthened; his verbatim: "writes
      through the live managed project — GOOD — THIS IS THE EXPECTED PATTERN - apply
      elsewhere"): PRDefineModal edits a live PR DOMAIN OBJECT (reaching parent container
      and project via internal refs); the dialog computes NOTHING — unit conversion and
      physics inversion live in the domain layer; direct prCanonicalFromDatasheet call +
      field-by-field setPrField writes replaced. The PR-formulas bug stays PARTIAL until
      this lands. STANDING PATTERN: live-domain-object editing is the expected shape for
      every editor dialog — check on review of any dialog work.
- [ ] **D10** (added 2026-08-22, QO82 raised by the human): (1) rename `UiParams` + real
      docstring — it is the engine-facing snapshot from `toUiParams()`, never stored;
      (2) EVERY UI input converts unit-toggle→SI through the ONE mechanism
      (`fields/units.ts` fromDisplay + fieldRegistry) — `prCanonicalFromDatasheet`'s
      hand-rolled /1e4 and /1000 are the offending precedent to delete. Composes with D9.
- [ ] **D11** (added 2026-08-22; QO73 ruled + handed to THIS session end-to-end by John
      via winisd_tool_fix, whose attempted `unknown`-channel fix he rejected — "your role
      is not to hack around my rulings"; its edits are fully reverted, tree verified clean,
      typechecks green; its `OpenISDProject.setDriver(driver)` addition KEPT as the
      real-API direction). Scope: (1) delete the DriverJSON alias with a design in which
      the UI never holds the private record value — no naming, no alias, no erased type,
      no structural clone (§ENCAPSULATION IS ABSOLUTE, global); the model owns the
      persisted driver payload end-to-end; HELD until QO78 rules (same design knot — what
      currency the UI holds). (2) AST arch gate (NEW file, A9-style): resolve type
      aliases back to private targets incl. ReturnType<X['method']> indirection, AND ban
      erased-type channels — John 2026-08-22: "I also want an arch check prohibiting use
      of any types". Enforcement split: `any` already banned repo-wide (tseslint
      recommended no-explicit-any); `unknown` in exported/interface positions via
      no-restricted-syntax AST selector or gate assertion; alias resolution is the
      bespoke gate (extend the :703 typeNodeNames() approach). store.ts:19's direct
      `_OpenISDDriverJson` import (its own violation, not PrivateAllow-covered) resolves
      in the same design.
- [ ] **D22** SERIALIZATION DOCTRINE — QO83 CLOSED, both PrivateAllow grants REFUSED; the
      human ruled the architecture instead. ONE RULE: **THE OWNER OF THE STATE SERIALIZES AND
      PERSISTS IT.** The `KeyValueStore` is injected INTO the model/managed layer, which
      saves and loads itself; NO ui module ferries record strings. Consequence by design:
      `_OpenISDDriverJson` never crosses the model package boundary and every PrivateAllow
      entry for it becomes deletable — the allow-list shrinks to empty by restructure, never
      by grant.
      **⛔ OPACITY IS NOT A LICENCE (human, emphatic 2026-08-22):** *"I dont want the internal
      state leaking out of the component at all - there are no exceptions and the grant that
      the sharing facility is given a memo ... may in no way be interpreted by the AI as a
      weakening of that rule. There is no situation where I want even an opaque version of
      that state being passed around."* Making state a `string`/`unknown` does NOT make it
      stop being that component's state. Precedent: A6 retyped `SerializedState.driver` to
      `string`, declared the boundary closed, and a consumer immediately did
      `JSON.parse(...) as _OpenISDDriverJson` — same bytes, same coupling, now invisible to
      every gate. The ONE sanctioned opaque handoff in the app is the share-link memo, and it
      travels owner → sink → SAME owner only.
      **Native `#` privacy is the mechanism** (human's insight): `OpenISDDriver` already holds
      `readonly #record`. Serialisation moving INSIDE the class reads `#record` directly and
      the runtime — not a gate, not a convention — enforces the rest. BOUNDARY: serialisation
      moves in, BROWSER ACCESS DOES NOT. `packages/model` is verified platform-free (no
      `localStorage`/`window`/`document` in any src file) and the V8 bridge bundles it into
      mini-racer where `localStorage` does not exist; a storage call inside the model breaks
      the bridge at runtime and makes the model untestable without a browser. The repo keeps
      the call and holds only strings + domain objects: `kv.set(driver.uuid, driver.toJsonText())`.
      Same shape for `.oip` projects and passive radiators — one rule, not three special cases.
      **AUDIT — every site handling domain internals outside the ruled places** (peer-run,
      RE-VERIFY each at implementation):
      - **`driverSelection.ts` — SINGLE-RESPONSIBILITY VIOLATION, human-found 2026-08-22
        ("there is no reason for the driver selector to ask for an empty driver").** The
        selector does THREE jobs: selecting a driver (its own), HOLDING THE EDITOR'S DRAFT
        (`editorDraft`, `:129`), and BROKERING THE EDITOR'S LIFECYCLE (`editorSeed()`,
        `acceptDriverEdit()`, `openNewDriver()`). Jobs 2 and 3 belong to the editor, and
        holding them is what CAUSES the leaks here: `:239` `JSON.stringify(editorDraft)` is a
        non-owner producing serialised state, `:148` re-serialises a record to talk to the
        domain, and `:121` declares `acceptDriverEdit(json: _OpenISDDriverJson)` — the private
        record in a UI-layer public interface.
        RULED SHAPE: the EDITOR owns its own draft. Then `editorDraft` leaves the selector;
        `editorSeed()` and both stringify sites die; `acceptDriverEdit`'s record parameter
        disappears (the editor commits through the domain API); `openNewDriver()` becomes the
        editor opening in new mode, constructing its own blank via `OpenISDDriver.empty()`
        (which correctly returns an INSTANCE — human: "empty() must not return json");
        `_emptyDriverRecord()` (`openisdDriver.ts:833`, body = `empty().toJsonRecord()`) is
        DELETED for want of a caller, together with the permission comment at `:826` naming who
        may use it — a grant for a deleted symbol is the stale-grant case the gate fails on.
        Its one test caller round-trips driver→record→driver and becomes `OpenISDDriver.empty()`.
        Both `driverSelection` PrivateAllow offences die with it (7 → 5 → 3).
        NOTE: A6's `editorSeedDriverText()` was justified as "text because the editor is the one
        file licensed to hold a live driver" — that holds only while the SELECTOR is an
        intermediary. With the editor owning its draft there is no intermediary, so that method
        goes too rather than surviving as a sanctioned text hand-off.
      - `DriverEditorModal.vue:335/:341/:389/:462` — **human's ruling, verbatim: "the driver
        editor should work against the domain api and it should never touch the json - it
        should hand the domain api to the save api and oid save has been granted access to oid
        internal already"**, and on the register's wording: "what json preview - wth ... there
        are no exceptions". CORRECTION: there IS no JSON preview — an earlier register row said
        so and was wrong. `:462` is the `.owdr` FILE-SAVE path, hand-rolling
        `JSON.stringify(draftDriver.value.toJsonRecord(), null, 2)` — which is byte-for-byte
        `OpenISDDriver.toOwdrText()`, already on the model at `openisdDriver.ts:520-522`. So no
        exception and no new API: `:335`/`:341`/`:389` pass the DOMAIN OBJECT to
        `myDrivers.upsert`/`acceptDriverEdit`, `:462` calls `draftDriver.value.toOwdrText()`,
        and the dialog never calls `toJsonRecord()` at all.
      - `OriginalShell.vue:467/:477` — hand-rolled `_ground` checkpoint stringifying
        `{box, UiParams, driver, project}`: a proto-memo built by the shell. Remediate with
        the memo pattern (owners produce/consume). Confirms the human's vibe-code suspicion.
      - `driverLibrary.ts` — types itself in records + its re-export offence; model API instead
      - `fileFormat.ts:124` — format-sniffing `JSON.parse` moves into the model with the
        file-IO completion
      - `store.ts` `_OpenISDDriverJson` import — A6 claims removal; VERIFY at commit
      - `prLibrary.ts` stores `UiParams` bags (also D14 item 5)
      Sanctioned and clean: `bundle-drivers.mjs` (build-time), `prefs.ts` (UI's own state).
      NOTE: the strengthened QO73 gate already catches more of these — a probe run shows
      `MyDriverRepo.list()`/`createMyDriverRepo()` resolving to hidden `_SpecEntry`/`_Specs`/
      `_ScrapedField` etc. Those are db/ files, so they land here, not in A6.
      Share-link audit: `docs/design/SHARE_LINK_MEMENTO_AUDIT.md` (8 of 9 payload fields are
      NOT mementos; `v: 2` is dead; `stateToUrl` reads `location` globals).

      **THE REGISTER — every site owned (human directive: "I want every single one of these
      either directly sanctioned by me OR with a documented remediation plan - stop pissing
      about").** Source of truth: `docs/design/SERIALIZATION_DOCTRINE.md` §register, 12 rows.
      LIVE DOCUMENT: any newly found site gets a register row AND a plan mapping the day it is
      found — no quiet passes. Mapping of every REMEDIATE row to the task that closes it:

      | register row | closed by | state |
      |---|---|---|
      | `logic/managedDriver.ts` — file IO into the model classes | **A6** (in its running rework; the two refused PrivateAllow rows must disappear) | in flight |
      | `logic/store.ts` — private-type import removed | **A6** — VERIFY at its commit, do not take the claim | in flight |
      | `logic/driverSelection.ts:148,239` — model API, stringify path deleted | **A6** (same files, same cycle) | in flight |
      | `fileFormat.ts:124` — sniffing into the model | **A6** (rides the file-IO completion) | in flight |
      | `db/myDrivers.ts` — domain-owned persistence | **D21** (QO81 package: uuid keying, upgrade chain, broken rows) | scheduled |
      | `db/driverRepo.ts` — one composition-root seam | **D22** (this row) | scheduled |
      | `logic/driverLibrary.ts` — model API; re-export dies | **D15** (re-export gate) + **D22** | scheduled |
      | `DriverEditorModal.vue:335,341,389,462` — domain object to the save API, preview via `toJsonText()` | **D22**, human-ruled verbatim above | scheduled |
      | `OriginalShell.vue:467,477` — `_ground` checkpoint → memo pattern | **D22** (with the share-link memento work — same pattern, same owners) | scheduled |
      | `db/prLibrary.ts` — `UiParams` bags → PR domain objects | **D14 item 5** + **D9** (QO77 live-domain-object pattern) | scheduled |
      SANCTIONED, no work: `scripts/bundle-drivers.mjs` (build-time, edge 2), `db/prefs.ts`
      (UI's own state), and the share-link memo as the ONE opaque-string handoff.
- [ ] **D20** PERSISTENCE VOCABULARY — one uncompromising rule, ruled by the human 2026-08-22
      ("I want logic and consistency in the code - and not misdirection ... make them single
      responsibility and dont fudge it"). FULL STRATEGY:
      `docs/design/PERSISTENCE_NAMING_AND_PLACEMENT.md`. Three concepts, three words, three
      homes, one role per module: **STORE** = dumb port onto a medium (no domain vocabulary at
      all); **REPO** = domain access to exactly ONE collection, takes a store, returns records;
      **STATE** = live reactive truth, never called a store. Banned as names: `library`,
      `bucket`, `db`.
      Layout: `persistence/stores/{keyValueStore,fileStore}.ts` +
      `persistence/repos/{driver,myDriver,pr,prefs}Repo.ts`; `logic/{appState,
      presentationState,driverBrowsingState}.ts`.
      Renames (symbols, files AND prose in one pass): `db/kv.ts`→`stores/keyValueStore.ts`;
      `logic/fileStore.ts`→`stores/fileStore.ts` (it IS a store, never was logic);
      `db/myDrivers.ts`→`repos/myDriverRepo.ts`; `db/prLibrary.ts`→`repos/prRepo.ts`;
      `db/prefs.ts`+`PrefsStore`/`createPrefsStore`→`repos/prefsRepo.ts`+`PrefsRepo`/
      `createPrefsRepo` (it takes a store and returns domain values — it is a REPO, and this is
      the one true structural misnaming); `logic/store.ts`→`logic/appState.ts` (frees "store"
      for the port — the collision is the actual defect, since ARCHITECTURE.md:534 says repos
      "never touch the store" meaning app state one paragraph after describing repos that take
      a store meaning the port); `logic/driverLibrary.ts`→`logic/driverBrowsingState.ts`
      (uses `ref()`, so STATE not persistence).
      Plus: an AST gate `no-persistence-vocabulary-drift` (5 shape-based checks, never prose
      greps) so it cannot rot back, and ARCHITECTURE.md's §532 paragraph + module table
      rewritten to the ruled vocabulary.
      MECHANICS: `ts-morph` (a repo devDependency) for every symbol rename so references move
      via the AST, not text matching; verify after with `LSP.findReferences` plus a literal
      grep for each old name. BLOCKED-BY: A6 (it owns fileStore.ts/store.ts/persist.ts right
      now) and A7 (owns db/**). Schedule immediately after both commit, BEFORE A8 — A8's "UI
      stops importing storage" work would otherwise be written against names about to change.
      Note QO81's storage-failure work also lands in these files; sequence D20 first so that
      work is written in the ruled vocabulary rather than migrated twice.
- [ ] **D18** (η₀ blocker dissolved 2026-08-22): add a `no`/efficiency relation to
      `packages/engine/src/consistency.ts` (today: zero `efficiencyConstant` references).
      The engine ALREADY computes η₀ correctly — `efficiency.ts:31-33`,
      `efficiencyConstant(c)·Fs³·Vas/Qes`, live in `driver.ts:194/:281/:292` and
      `sweep.ts:214` — so no constant is unresolved; only the RELATIONS entry is missing.
      Evidence: a Wine probe of real WinISD (Beyma 10BR60V2,
      `winisd_research/scripts/probe_rme_beyma.py`) matched this exact form to 0.000000%
      against WinISD's saved `no`. Python's `model_wdr.py:471` form is wrong (uses `Mms`
      where the textbook form uses `Vas`; error ratio `Vas·roo·BL²/Mms`, driver-dependent,
      NOT a constant) — deliberately NOT repaired: lane F retires python's `.wdr`
      projection. `docs/design/DQ_SPLIT_QT56_INVENTORY.md` corrected (its "unresolved
      constant" blocker was stale). Pairs with the EBP relation bug — both are ordinary
      work, neither blocks the QT56 DQ split.
- [ ] **D21** (QO81 storage-failure package — design doc
      `docs/design/MY_DRIVERS_STORAGE_FAILURES.md`). HOLD LIFTED 2026-08-22, package complete.
      ADDED in the final items: **My Drivers UPGRADE CHAIN** — My-Drivers storage carries a
      format version; every breaking shape change ships an upgrade function; on load the chain
      applies in order stored-ver → app-ver and the upgraded object SAVES OVER the old one in
      place, SAME identity (fresh-uuid is FILE IMPORT only). Scoped to My Drivers alone —
      bundled drivers ship current with the dist. Entries still failing AFTER the chain get the
      broken-row treatment. Also: identity keyed on record uuid is now ruled (option 3, with
      rename-asks). Earlier items: (1) bucket unavailable (private
      mode) → empty list + visible notice; (2) unreadable bucket (bad JSON/not a list) → the
      app goes READ-ONLY on it, one visible "your saved drivers could not be read" state, with
      Export (raw string as text) and Delete; delete NEVER automatic and challenges the user if
      they have not exported; (3) CROSS-CUTTING HARD RULE: any such corruption is a hard stop —
      a decision modal with only real actions, NO cancel, app does not progress until the user
      chooses; (4) a non-conforming ENTRY is preserved untouched and surfaced as a broken row
      with Export/Delete — this RATIFIES A7's preservation and REJECTS its console.warn
      invisibility, so that warn becomes a visible surface; (6) RULED: file import ALWAYS mints
      a fresh uuid, a file's own uuid is never adopted as store key (no accidental overwrites;
      import-twice = two entries), the original surviving as provenance only. UNDER DISCUSSION,
      not final: (5) keying My Drivers on record uuid (openisdDriver.ts:87 carries it, the app
      never reads it, empty()/fromWdr() seed `uuid:''` so the app would mint at save) — solves
      same-name duplicates and flips rename semantics (rename = same driver, Clone = new uuid),
      flagged to John as a conscious reversal; (7) idea only: stuff `.wdr` export's Comment
      field with uuid + openisd facts having no INI slot (0xA4 sentinel mechanics, best-effort
      carrier, provenance-not-identity on re-import). Sequence AFTER D20 so it is written in
      the ruled persistence vocabulary rather than migrated twice.
- [ ] **D19** (air constants, John verbatim: "these are calculated values in the UI in
      openisd not constants"): `c`/`roo` are OUTPUTS of `packages/engine/src/air.ts::airFor(env)`
      from temperature/humidity/pressure — verified by running it: reference conditions
      (293.15K, 30%, 101325Pa) give c=343.6826980479399, rho=1.2009621215255684, while a
      WinISD-saved `.wdr` holds 343.684120962152/1.20095217714682 — the 5th-significant-figure
      drift IS the proof they track an environment, not a constant. Consequences: (a) they
      never enter a driver RECORD (a datasheet states neither; presence-is-assertion; and
      `OPENISD_YML_FORMAT_CHANGES_PENDING_B10.md:77` already bars projection-computed values
      from records) — advised to the winisd_tools peer, no record change; (b) if a `.wdr`
      emitter needs them it defines an ENVIRONMENT and computes the pair, never hardcodes
      digits — and via the lane-F bridge it calls `airFor()`, so cross-repo divergence is
      structurally impossible. TO CHECK HERE: whether any literal `345.0`/`1.184` pair
      survives in openisd (`winisd_research/README.md` lists it as an open item, but frames
      343.68/1.20095 as "the correct constants" — same category error, correct the framing).
- [ ] **D16** (QT58 ruled, John verbatim: "field level stuff is good - disposition is bad -
      tell main-exec it needs killing"): `disposition` is DELETED OUTRIGHT. winisd_tools side
      (peer-owned, greenlit by this session): Disposition enum, DispositionField envelope +
      detail templates, `disposition_of`, the stamp-on-validation machinery, their tests.
      SURVIVES: all field-level facts — `missing`, `parse_errors`, per-reading N/A evidence,
      `no_ts_published` as the vendor-emit input. **openisd side (MINE, verified 2026-08-22
      by grep over packages/ui/src + packages/model/src + scripts — 3 real code sites, not
      1 as an earlier note implied):** `openisdDriver.ts:97` the `disposition:
      DispositionField` declaration, `:340` `empty()`'s seeded block, `:465` the `.wdr`
      import path's `{value:'ok'}` seed — plus the `DispositionField` type itself if nothing
      else uses it. All three are in the file the A6/QO78 rework is editing RIGHT NOW —
      SCHEDULE AFTER A6 LANDS, never concurrently. No reader remains (A7/QO79 removed the
      bundler's last read), so deletion is safe on the openisd side.
- [ ] **D17** (QO80 ruling): `packages/engine/src/index.ts` → `engine.ts` — John: "its more
      obvious if that's where calcs live". The old dead `engine.ts` was deleted at his order
      by the peer (verified unreferenced beforehand). Mechanics: one edit to
      `packages/engine/package.json`'s `exports` (both `types` and `default` →
      `./src/engine.ts`); consumers import `@openisd/engine` through the exports map, so
      zero import churn. PAIR WITH: the D15 re-export gate's barrel exemption must read each
      package's exports-map TARGET rather than hardcoding `index.ts` — that removes the
      hardcoded filename and makes this rename safe. Do both in one change.
- [ ] **D15** (QO80 ruling, John verbatim: "rexports are expreslly forbideen"): the gate
      `packages/ui/test/ui/architecture-no-reexports.test.ts` is IN TREE, untracked, born
      RED by design (authored by a John-dispatched background agent; ts-morph AST — export-
      from / export * / export type-from / specifier-less `export {X}` of an import binding;
      scans packages/*/src .ts + .vue script blocks; exempts package barrels
      `packages/*/src/index.ts` — that exemption is docstring-flagged as John-pending).
      Run from REPO ROOT (`npx vitest run packages/ui/test/ui/architecture-no-reexports.test.ts`)
      — a packages/ui cwd breaks the root custom-reporter path. 10 offences:
      - `engine/src/engine.ts:1` — VERIFIED DEAD, no ruling needed: package.json's exports
        map names ONLY `./src/index.ts`, and a repo-wide grep finds ZERO importers of
        engine.ts. It is an unreferenced one-line `export * from './index.js'` — delete the
        file. (The peer raised this as an "which entry point wins" question for John; the
        evidence answers it — index.ts is the sole entry point and always was.)
      - `ui/src/types.ts:346` — five engine type names re-exported (EngineDriver, BoxType,
        SweepParams, SweepResult, MaxCurvesResult): consumers import from `@openisd/engine`
        directly; folds into D10/D11's UI-layer work.
      - `ui/src/logic/fileIO.ts:47` — cleared by the A6/QO78 rework in flight.
      - `ui/src/logic/driverLibrary.ts:20`, `ui/src/logic/environment.ts:40`,
        `ui/src/logic/series.ts:6` — re-verify at implementation, then repoint importers.
      Gate goes green as A6 + D10/D11 land; commit it with whichever change clears the last
      offence, never before (a red gate in the tree is the honest state until then).
- [ ] **D12** (QO75 ruled "A widen it", agent-under-review authorized): widen the
      approved-stores gate — AST match sees reactives wrapped in call arguments
      (`getOrInit(ns,k,() => ref(0))`) AND .vue script blocks get scanned. Queued behind
      the milestone Playwright run (test-file edits break the frozen tree).
- [ ] **D13** (QO79 addendum, John's correction 2026-08-22): the sim USES Xmax optionally
      (the excursion-graph limit line) — a missing optional-use field DEGRADES THE DISPLAY
      (omit the limit line), never the catalogue and never an error. Verify the excursion
      graph renders cleanly with Xmax absent (many of the 564 newly-shipped drivers lack
      it); fix any code that assumes Xmax presence. Standing principle for all
      optional-use fields.
- [ ] **D14** (QO77 follow-through): peer scan complete 2026-08-22 — 28 violations across
      9 of 21 .vue files + 2 logic helpers; 12 files clean. Classes: (1) physics/derivation
      in the view, (2) hand-rolled unit conversion, (3) state writes around the domain,
      (4) private-shape contact. EVERY file:line below is a peer-scan claim — RE-VERIFY at
      implementation before acting (line numbers drift; the A6/A7 reworks are moving these
      files). Each fix gets the D9 treatment (live domain object; dialogs compute nothing).
      1. PRDefineModal.vue:32-47 [1] prCanonicalFromDatasheet + five setPrField writes (=D9)
      2. logic/prWinIsdFields.ts:86,:90 [2] /1e4, /1000 by hand
      3. PREditModal.vue:31-48 [1+3] toUiParams() snapshot mutated by free fns, copied back
      4. PREditModal.vue:102,:107 [2] :scale="1e4"/"1000" instead of NumInput unit binding
      5. PREditModal.vue:58 [4] whole UiParams bag as prLibrary.save storage currency
      6. OgTune.vue:30-51,67,79 [2] local scale table; divides typed value pre-enterDriverField
      7. OgTune.vue:85-89 [2] scaledLimits multiplies registry SI bounds by hand
      8. OgNewProject.vue:47-48 [2] vol/1000, frontVol/1000 inline
      9. OgNewProject.vue:45 [3] state.project.name written directly
      10. OgNewProject.vue:46 [3] state.box assigned directly
      11. OriginalShell.vue:104,:469 [3] state.box assigned directly (watcher + selectProject)
      12. OriginalShell.vue:245-250 [3] created/modified/creator written on mount
      13. OriginalShell.vue:740 [3] isModified watcher stamps state.project.modified
      14. OriginalShell.vue:1377-1384 [3] five v-model bindings onto state.project fields
      15. OriginalShell.vue:391-585 (5 ranges) [3] multi-project rows = toUiParams()
          snapshots + driverRecord.value as project state
      16. OriginalShell.vue:467-478 [3+4] JSON deep-clone row → Object.assign(state.project)
          → private record through loadDriverRecord
      17. OriginalShell.vue:2,385,458,544,551,559 [4] no-explicit-any disable + ref<any[]>/
          p:any erasing project rows
      18. OriginalShell.vue:647-650 [1] driveV setter computes P=V²/R in the view (||8 lit)
      19. OriginalShell.vue:1267 [2] prVas_l()/1000 inline in template
      20. OriginalShell.vue:660-665 [3] advTemp/advHumidity/advPressure shadow project env
      21. OriginalShell.vue:357-372 [1?] cursorVal interpolates plotted series in component
      22. DriverEditorModal.vue:51,335,341,389,409,462 [4] dialog trafficks in
          _OpenISDDriverJson (seed.json/toJsonRecord)
      23. DriverEditorModal.vue:75 [4-minor] driverRaw Record<string,unknown> indexing
      24. DriverEditorModal.vue:174-177 [4-minor] Proxy over unchecked keys
      25. DriverEditorModal.vue:673,:768 [2] :scale="100" fraction→percent outside units.ts
      26. PRBrowser.vue:58 [2] tooltip *1e4/*1000/*1000 by hand
      27. App.vue:32 [4] root passes driverRecord.value + raw state.project into serialize
      28. GraphPanel.vue:127-141 [1?] rangeStats computes peak/trough/ripple/average locally
      Clean (12): AdvancedOptions, DiagnosticsModal, DriverBrowserWinisd,
      DriverDimensionsDiagram, EquationInspectorModal, ExportMenu, Flash, NumInput (its raw
      `scale` prop is the escape hatch items 4/6/25 abuse — delete the prop under D10),
      OptionsModal, ToolbarIcon, UnitToggle, OgFilters. Items 22/27 overlap D11 (private
      shape); 2/4/6/7/8/19/25/26 fold into D10's one-mechanism sweep; 18/21/28 need an
      engine/domain home for the math.
- [x] **F2** DONE 2026-08-22, review PASS after one fix cycle (commit `3596c6c`; the reviewer
      also RETRACTED its fixture finding on re-probing — three of four were provably
      mechanical). Pure select+join+reorder port pinned to winisd_tools 16492ffc; flow styles
      fixed at the ROOT (the silenced TS2367 was the diagnosis — ownerKey(path) now, guard
      live); flowCollectionPadding matched to PyYAML (closes one of QT60's three byte gaps);
      6 real-record parity fixtures incl. a faithful no-ts-published case; 12/12 + 70/70.
      QT60 (the F3 byte-identical bar: folding+quoting remain) awaits the human before F3.
      SUPERSEDED 2026-08-22 (QT54 ruling update, verbatim in the ledger): python keeps the
      driver.yml→openisd.yml projection — the port was DELETED as dead surface (commit
      `0a8ebe9`). The work stands as review-hardened history only.
- [ ] **F3** RESCOped 2026-08-22 (QT54 supersession): winisd_tools embeds a JS engine and
      calls ONLY `openisdYamlToWdr`; parity vs the python .wdr mapper per the QT60 bar (bar
      ruling pending). OWNED BY the yaml-divergence-wdr-refactor peer session (John-directed);
      main-exec supplies the openisd bridge artifact on request (openisd read-only for the
      peer). Blocked-by: F1 (done), B10 (parity against post-regeneration records), QT60.
      If parity fails the ruled bar: STOP, report — never regenerate to paper over it.
- [ ] **F4** RESCOped 2026-08-22 (QT54 supersession): delete ONLY the .wdr mapping half —
      `model_wdr.py`'s mapping + `wdr_ini_file.py` + their pinned tests; `model_openisd.py`
      SURVIVES (python keeps the driver.yml→openisd.yml projection). DQ half moves out first,
      in its own change, per the design (note: QT56 deferred the relation-math-DQ deletion —
      re-read the QT56 notes before touching semantic_dq). Blocked-by: F3. Done: pytest green
      with the deletions. NOTE (peer, 2026-08-22): test_ts_formula_parity.py — F4-slated —
      currently red on test_uselib_ts_carries_ebp_formula (openisd's useDriverLibrary.ts no
      longer carries EBP=Fs/Qes after the A-lane rework); dies with F4, chase nothing.

- [ ] **F3-support** (owed BY main-exec to the yaml-divergence-wdr-refactor peer per QT61,
      John: "the openisd agent will create the v8 bundle... assume it will exist"): after A6
      lands, build the V8-loadable bridge bundle — `npm run build:bridge` emitting an IIFE,
      ES2020, yaml-inlined `dist/openisd-bridge.js` exposing `globalThis.openisdYamlToWdr`
      ONLY (QT54 supersession; correct DESIGN.md §12.5's two-function text in the same
      change). Message the peer the artifact path. Done: bundle builds reproducibly; a node
      smoke-run evaluates it and converts a fixture.

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
