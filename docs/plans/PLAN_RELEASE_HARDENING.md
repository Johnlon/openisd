# Release-hardening plan — openisd production release

Current state as of 2026-08-28, HEAD `4ee14af` on `dev`. Supersedes the checklist in
`PROMPT_RELEASE_HARDENING.md`, which is retained only as a historical run-journal and is
**stale in two structural ways**: it is written against `packages/engine` (deleted at commit
`7bb1f55`) and predates `packages/design`/`packages/persistence` entirely.

High standards take priority over expedience: this is a production release and John wants no
new bugs. No workarounds, no renames to silence gates, no weakened tests. Finish the whole job.

Workspace: `/home/john/work/winisd/` — repos `openisd` (branch `dev`, primary),
`winisd_tools` (`main`), `winisd_drivers` (`main`), `winisd_research` (`master`).
Global behavioural rules auto-load from `~/.claude/`; they bind every agent spawned to work
this plan — copy the relevant ones into each agent prompt, since subagents inherit nothing.

## ⛔ The two hard gates on all work in this repo

1. **`packages/design` changes require John's explicit per-change approval** — see
   `packages/design/AGENTS.md`. The agent PROPOSES and STOPS; an unapproved change is reverted,
   not "noted and carried on". This overrides every rule elsewhere telling an agent to fix a
   defect on sight. Standing order in the same file: **DON'T INVENT** — build the named shape
   and nothing adjacent to it.
2. **`docs/design/` is owned by another agent concurrently** — do not read, edit, or write
   there from this plan's work.

## Non-negotiable working rules

- **NEVER `git push`.** Commits stay local. No branches, no worktrees, no force-push.
- **Full test suites run in the BACKGROUND, one at a time, never concurrent.** Playwright with
  `--workers=1` (concurrent workers killed the dev server → 84 false failures, QO10). Narrowest
  scope that answers the question; full suite once per milestone.
- **Record a bug file BEFORE fixing and before reporting it.** `bugs/BUG_<date>_<slug>.md`,
  current-state: Symptom / Evidence / Cause / Fix / Verification.
- **Re-verify every prior claim** — ledger answers, bug files, and this plan are claims about
  the world when written. Open the file, re-run the grep, then act. Line numbers drift; search
  by symbol. LSP (`ToolSearch("select:LSP")`) for symbol questions; grep for text only.
- **TDD.** Failing test first, then code. Among red tests, architecture tests are fixed first.
  Never delete or weaken a test to go green.
- **No historic comments** in any artifact ("used to", "previously", "replaces the old…") —
  justification lives in commit messages only. **This plan is an artifact**: keep it
  current-state, do not let a chronological journal grow back inside it. (That failure is
  exactly what made `PROMPT_RELEASE_HARDENING.md` unusable.)
- Discriminators are named string enums, never ints. The UI never touches a JSON shape.
- **QO86 — export discipline (John, 2026-08-23, verbatim):** *"generally nothing should be
  public or exported and that export * is a serious violation of control and arch, and we need
  an arch test to detect it and block it in favour of named selective intentional exports of own
  code and never a re-exported symbol."* Private by default; `export *` banned everywhere
  including package barrels; never a re-exported symbol.
- **QT72 — duplicated-logic elimination is a standing, high-priority practice.** Every review
  actively polices new duplication; shared helpers over per-file copies, always.
- `ALLOWED_GLOBALS` and every allow-list are HUMAN-EDIT-ONLY. PrivateAllow is DECOMMISSIONED as
  a grant mechanism: gates are owner-only + HUMAN_GRANTED pairs named in the gate itself.
  Widening an allow list is not an available answer anywhere.
- **`packages/design` globals**: no module-scoped state at all. The only approved globals are
  `NO_LOSSES`/`NO_VENT`/`NO_CHAMBER` in `domain/project.ts` (2026-08-27), enforced by
  `test/architecture-no-globals.test.ts`, whose APPROVED list must match `AGENTS.md`.

## Where the code lives now (the fact that invalidates the old plan)

| package | role |
|---|---|
| `packages/design` | **The new domain model + engine.** Started 2026-08-26. `domain/` (project, vent, cell, losses) + `engine/` (Engine.ts, air, sweep, consistency, filters, alignments…). Exports `.`, `./browser`, `./engine`. Its package.json states it "Replaces packages/model". |
| `packages/model` | The driver record + `OpenISDDriver`, its provenance, derivation, and `.wdr` bridge. Still live: **25 files** under `packages/ui` import it. **It depends on `@openisd/design`.** |
| `packages/persistence` | Repos + storage, extracted out of the UI (commit `4630989`). |
| `packages/ui` | The app. Imports **both** `@openisd/design` (19 files) and `@openisd/model` (25 files). |
| `packages/winisd` | `.wdr`/`.wpr` interop + the V8 bridge artifact. |
| `packages/engine` | **DELETED** (commit `7bb1f55`). Physics moved into `packages/design/engine/`. Verified: zero live imports, zero package.json deps, zero tsconfig paths — only prose mentions in comments remain. |

**These are not two rival models.** `packages/model` *depends on* `packages/design`, and the UI
imports both — `design` is being built underneath `model`, which is being hollowed out onto it.
The migration is mid-flight, not a fork. Any plan row phrased against `@openisd/engine` or the
pre-`design` layout must be re-targeted before it is worked.

## Rulings in force (re-verify against `questions.yml` before quoting as current)

Recent, and already implemented:

| ID | Ruling | State |
|---|---|---|
| QO86 | Export discipline: nothing public by default; `export *` banned; never a re-exported symbol; arch test required. | decided |
| QO88 | The calculated `c`/`roo` pair is **solely for the bridge's generated WinISD file**. The app uses the three air values in its settings pane to calculate initial `c`/`roo` for new drivers/projects. | decided |
| QO89 | Air settings page reset-to-defaults button. | decided, implemented |
| QO90 | Project save takes the OIP domain object (+ env) only. `.owpr` and autosave carry pure project data; view/UI prefs persist separately; **share links keep carrying the whole session** — links and files deliberately diverge. | decided, implemented (`3ed4e1a`) |
| QO93 | Settle `c`/`roo` by controlled probe, not by reading found files. `winisdAir()` now implements WinISD's actual model (Hyland-Wexler vapour pressure, no enhancement factor, molar-mass mixing, `rho = gamma*p/c^2`); the measured-ref constants and ratio-scaling are DELETED; `air.test.ts` asserts six measured environments at 50 ppb. | decided, implemented |

Older rulings still governing this plan's remaining rows: QO49 (ParState-less `.wdr`: presence
⇒ ENTERED, unconditionally — no special case), QO61/QO78 (FileIO Proposal B; file IO lives in
the owning domain module), QO62 (`.wdr`/`.wpr` read strict UTF-8 then whole-file CP1252, report
which; write stays UTF-8), QO65 (coax/tweeter is backlog, not a bug), QO77 (live-domain-object
editing is the standing pattern for every editor dialog), QO81 (My-Drivers storage-failure
package), QO82 (one unit-conversion mechanism), QO83 (the owner of the state serializes it),
QO84 (small precision fix now — see REFERENCE), QT48/QT49/QT54/QT56 (tools-side model rulings).

**Open, awaiting John — none blocks the rows below:**

| ID | Question |
|---|---|
| QO85 (deferred) | ABC needs 3 ports, not 1. Ruling: *"stays deferred / don't add bandpass6/abc yet"*. |
| QO87 | Big precision fix — port the full printed-precision interval model (see REFERENCE). |
| QO91 | OptionsModal preview and driver-editor reference `c`/`roo` still show the pure moist model (1.20096), not the WinISD-anchored one. |
| QO92 | Autosave was ripped out undesigned — persistence needs designing before it comes back. |
| QO94 | Field help: a `[?]` popover, or keep native `title` tooltips? |
| QO95 | WinISD air model is now the DEFAULT — QO7 reversed. |
| QT73 | B10 leftovers: 91 records not re-emitted (seas old-code dirs, delisted grs/visaton products). |
| QT75 (deferred) | Full per-driver census of the B10 sweep. |

## Hazards still live

- **H1 — ONE regeneration pass.** B10 has RUN. Any further model-shape change means another
  full re-emit, so batch shape changes rather than dripping them. QT73's 91 un-re-emitted
  records are the known remainder.
- **H3 — C/E/N persistence gap.** `Provenance` is derived at read time (a `specs` entry ⇒
  Entered); records carry no calculated-marker, so a pipeline-calculated value reads back as
  ENTERED. Per QT56 no calculated-marker is built — the guard is that pipeline-computed spec
  values must be unrepresentable (row B5a below).
- **H5 — a new project is deliberately unsized.** `prototypeBox()` returns zeros with
  `TODO(box-wizard)` markers; a fresh project shows Vb/Sp precondition errors. Ruled behaviour,
  not a regression — never "fix" it by reintroducing literals. Box wizard is out of scope
  (QO64).
- **H6 (NEW) — the release would ship a mid-flight migration.** `packages/design` is 2 days old
  and John-approval-gated per change; `packages/model` depends on it; the UI imports both (19
  files / 25 files). The suite is green, so this is not a correctness alarm — it is a scope
  question: does the release cut here, or after the migration completes? **John's call** — row
  X1.

## THE CHECKLIST

Work a task only when every blocked-by is met. Tick a box ONLY when done-criteria are verified
with actual quoted output. Any session can resume from the boxes alone. If a task needs
something unlisted, STOP, record it here, re-sequence — never improvise around it.

### Lane X — scope decisions that gate everything else (NEW, do first)

- [ ] **X1 — DECIDE WHERE THE RELEASE CUTS relative to the `design` migration.** Verified
      state: `packages/model` depends on `@openisd/design`; `packages/ui` imports `design` in 19
      files and `model` in 25; the full suite is green at 2119/2119. So shipping today is
      *possible* — the question is whether to cut now with the migration half-done, or finish
      hollowing `model` onto `design` first. This is an architecture decision and therefore
      **John's alone** — present both options with the work each implies, then STOP. Blocks: E1
      (so the comment sweep sees final code) and release-gate item 6.
- [ ] **X2 — Stale references to the deleted `@openisd/engine`.** Root `package.json:69`
      declares `"@openisd/engine": "*"` in a workspace/deps block, and
      `packages/winisd/package.json:5`'s description cites "@openisd/engine physics", but
      `packages/engine` was deleted at `7bb1f55`. Verified harmless today — zero live imports,
      zero per-package deps, zero tsconfig paths resolve to it — so this is tidy-up, not a
      release blocker. Prose mentions also survive in comments across `packages/model/src/*`,
      `packages/design/engine/Engine.ts:16`, `packages/design/domain/project.ts`,
      `packages/winisd/src/bridge.ts`. **`packages/design` files need John's approval
      (`AGENTS.md`) — propose, don't edit.** Done: no manifest names a non-existent package;
      comment references either updated or explicitly left.
- [ ] **X3 — `packages/design` is undocumented in the top-level docs.** Neither
      `ARCHITECTURE.md` nor `DOCUMENTATION.md` mentions `packages/design` (grep: zero hits),
      though it is the new central package. Not `docs/design/` work — these are root docs, in
      scope. Done: both docs describe the current package layout including `design` and
      `persistence`, and the deletion of `engine`.

### Lane A — arch gates (openisd)

- [x] A1–A5c Store un-exports, reactivity adapter, `state.P` elimination, PresentationState
      split, serialize's named inputs, the `OpenISDProject` class facade, `_version` deletion.
      All landed and reviewed.
- [x] **A6 (FileIO) — CLOSED, done-criteria met or moot** (verified 2026-08-28). The composable
      is `createApplicationIO` (`packages/ui/src/logic/useApplicationIO.ts:69`); the plan's `createFileIO`
      name never existed and `FileIO` greps to zero — that criterion was written against a name
      the implementation didn't adopt. `useApplicationIO.ts` imports **no** `OpenISDDriver` (value or
      type) — it takes `createFileSave` + the `FileStorage`/`ProjectRepo`/`FileNaming` types
      from `@openisd/persistence`. Residue carved out as A6b.
- [ ] **A6b — delete `isLegacyWinisdFormat` (QO67).** Still present in three files:
      `packages/ui/src/fileFormat.ts`, `packages/ui/src/logic/driverFileText.ts`,
      `packages/ui/test/logic/driverFileText.test.ts`. Done: grep-zero; format detection is one
      path; suites green.
- [x] **A7 (bundle/catalogue) — CLOSED** (verified 2026-08-28). `readMetaCell` and
      `readDisplayName` do not exist anywhere in `packages/`; the only `readCell` is an
      unrelated private constructor param in `packages/design/domain/cell.ts:42`. The private
      `_OpenISDDriverJson` is gone from `driverRepo.ts` (now
      `packages/persistence/src/repos/driverRepo.ts`) — it uses the **public** `OpenISDDriverJson`
      from `@openisd/model` at `:4`, typing `BundleRecord.record` (`:97`) and feeding
      `OpenISDDriver.fromJsonRecord` (`:525`). The gate-forced-floor-of-1 exception is therefore
      no longer a private-shape leak.
- [x] A8 UI stops importing storage — landed with `4a29bfc`; the `packages/persistence`
      extraction (`4630989`) completed the split.
- [ ] **A9 ❔ PARTIAL.** Landed and passing: `architecture-no-reexports.test.ts` (3 tests),
      `import-from-declarer-only.test.ts` (4 tests, incl. "every first-party import in the tree
      resolves to its declaring module"). The `a9-drafts` sources were removed once their tests
      landed (`430c321`), and `find -iname "*.draft"` is now zero — no un-landed drafts. NOT
      FOUND under their planned names: `no-private-type-laundering.test.ts` (only a fixture,
      `packages/ui/test/ui/fixtures/laundering-probe.ts.txt`, referenced by the re-exports test)
      and any `no-domain-value-through-component` gate. Done: establish whether those two jobs
      are covered by the gates that DID land under different names — if yes, say so here and
      tick; if no, land them.
- [x] **A10 — test criterion MET** (verified 2026-08-28): `npx vitest run` → **94 files passed,
      2119/2119 tests passed, 0 failures, 0 skips**, 41s wall. All seven arch gates green
      (43 tests): design's `architecture.test.ts` / `architecture-engine-boundary` /
      `architecture-no-globals`; ui's `architecture-no-reexports` / `architecture-notify` /
      `architecture-project-symmetry` / `architecture.test.ts`.
      **The row stays open only for its second half**, which is a governance check, not a test
      run: a diff showing every gate's assertions and allow-lists byte-identical to their state
      at run start except where John explicitly ruled. Standing instruction (John, verbatim):
      *"I am expecting them to be solve without you violating the arch ok"* — gates go green by
      moving CODE to the architecture, never the reverse. **Still owed:** QO86's `export *` /
      re-export gate, if `architecture-no-reexports` does not already discharge it.

### Lane B — winisd_tools model + regeneration

- [x] B1–B4, B6–B9 Field/projection guards, optional `read_value`/`read_precision`,
      `dq_status`→`corroboration`, derived disposition, `FieldEnvelope` deletion,
      `emit_from_seed` deletion, `OutOfScope`-at-build, the archive hook. All landed.
- [ ] **B5a** The one remaining B5 sub-item: a gate making pipeline-computed spec values
      unrepresentable in winisd_tools (H3's guard). Not located at the last audit — needs a
      dedicated pass, not an assumption of absence. Done: a gate exists and is proven to reject
      a pipeline-computed value stored as if entered.
- [x] B5b SI dimension names — `packages/model` declares bare SI names; the corpus was
      converted by B10; `bugs/BUG_20260819...si.md` resolved with model/corpus evidence
      (`bf5fd1a`).
- [ ] **B-post** QT57 residue (rating ⟺ disposition) — QT70 is now decided; re-read that ruling
      and close this row against it.
- [x] B10 **THE REGENERATION — RAN.** Corpus re-emitted. Remainder tracked as **QT73** (91
      records not re-emitted: seas old-code dirs, delisted grs/visaton products) and **QT75**
      (full per-driver census, deferred). Both are John's, not blockers here.
- [x] B11 Bundle rebuilt — `packages/ui/src/drivers-bundle.json`, 1,970 records, generated
      2026-08-24 (post-B10). Re-run if any further model-shape change lands.

### Lane C — encoding

- [x] C1–C4 All landed: strict-UTF-8-then-CP1252 read, the Selenium SW108 source-damage record
      (John's data call), phantom-vent fix, required `WprVent` Fb/Vb/carea.
      Spin-out still OPEN: `bugs/BUG_20260821_wpr_float_formatting_diverges_from_winisd_15_digits.md`
      (JS 17-digit `String()` vs WinISD's 15).

### Lane D — ruled UI items

- [x] D1–D8, D13, D16–D21 Landed: unit toggle, Znom tooltip, `modeled` deletion, coax ruling,
      the five Fs routes, single Q-group source, kebab `passive-radiator`, the DVol relation,
      Xmax handling, `disposition` deletion, the engine barrel, the η₀ relation, the air-constant
      ruling, the persistence vocabulary (`4a29bfc`), the QO81 storage-failure package
      (`7dc2858`, `a621ceb`).
- [x] D14 Unit-conversion + magic-number cleanup landed across OriginalShell/OgTune/
      OgNewProject/GraphPanel/PRBrowser/DriverEditorModal (`a55b3ba`). Verify no new instances
      have crept in since.
- [ ] **D9/D10 remainder** — live-domain-object editing (QO77) and the ONE unit-conversion
      mechanism (QO82). Re-scan for surviving hand-rolled conversions and dialogs that compute;
      `a55b3ba` covered much of this. Done: no hand-rolled `/1e4`, `/1000`, or `:scale=` unit
      maths outside `fields/units.ts` + fieldRegistry; every editor dialog writes through a live
      domain object.
- [ ] **D11** The AST gate banning erased-type/alias channels (`unknown` in exported/interface
      positions; aliases resolved back to private targets incl. `ReturnType<X['method']>`). The
      `DriverJSON` alias itself is gone. Composes with QO86's export gate — consider one gate,
      per QT72.
- [ ] **D12** Widen the approved-stores gate (QO75): AST match must see reactives wrapped in
      call arguments (`getOrInit(ns,k,() => ref(0))`) and must scan `.vue` script blocks.
- [ ] **D22** The serialization-doctrine register (QO83): every site handling domain internals
      is either sanctioned or has a task. Re-verify each row's state — several closed under A6/
      D14/D20/the persistence extraction. Native `#` privacy is the mechanism; `packages/model`
      (and `packages/design`) stay platform-free so the V8 bridge keeps working.

### Lane E — hygiene (LAST, after X1 settles which model ships)

- [ ] **E1 — nearly closed.** Swept in `8cfc8e9`; a fresh grep over `packages/ui/src` +
      `packages/model/src` for "used to / previously / no longer / was renamed / replaces the
      old / formerly" now returns only **7 hits, of which 5 are legitimate** — they describe
      present-tense runtime or domain state, not code history (`useApplicationIO.ts:92`
      "previously-picked file"; `OriginalShell.vue:217/:476/:1475`; `DriverBrowserWinisd.vue:89`).
      **Two are genuine historic-code narration and should go:**
      `packages/ui/src/ui/components/NumInput.vue:107` ("A case-tolerant fallback used to live
      here for `alfaVC`") and `packages/ui/src/logic/schemaUpgrade.ts:13` ("app used to write
      `v: 2`" — check first whether it is the only thing explaining why that field is never
      read; if so, rewrite it as a present-tense constraint rather than deleting outright).
      Blocked-by: X1 (so the final sweep sees the code that actually ships).

### Lane F — the V8 bridge

- [x] F1, F2, F3-support, F4 Landed. The bridge exports `openisdYamlToWdr` and the round-trip
      API; python's `.wdr` mapper and `semantic_dq` were deleted (`5e612173`) and semantic DQ
      rebuilt tools-side as an independent derivation phase (`80491578`); python's round-trip
      comparison removed now that the bridge self-validates (`0c6b6d94`).
- [ ] **F3 parity** Parity of the bridge output against the QT60 bar. If parity fails the ruled
      bar: STOP and report — never regenerate to paper over it.
- [ ] Spin-out OPEN: `bugs/BUG_20260822_bridge_bundle_emits_yaml_parser_warnings_into_an_unknown_host_console.md`.

### Lane P — project domain symmetry

- [x] P1–P5 Landed: vents[] with alignment-fixed arity (`b654c25`), the project solving its own
      groups with cells/provenance (`a4cb214`), every box question a named method (`2c9b7b8`),
      the PR datasheet keyed surface (`9cdde8f`), the symmetry AST gate (`4fc55d6`), and P4b-1's
      zero-interior-state completion (`df29244`).
- [ ] **P3-ABC** Blocked by QO85 (deferred — *"don't add bandpass6/abc yet"*). Do not start.

### Lane G — explicitly OUT of release scope

- Box wizard / alignment-driven sizing (H5): standing build request, ledger item **QO64**.
- Curve digitiser (QT7): deferred — "we can do curve scraping later".
- Precision-maths build-out (QP19/QO87): its own campaign (`MATH_MIGRATION.md`).
- The `packages/design` migration itself, unless X1 rules it into scope.

## Open bug backlog

27 bug files under `bugs/` are currently OPEN/PARTIAL/BLOCKED (of 89 total). Release gate item 4
requires every one either RESOLVED or carrying an explicit human DEFERRED ruling, so this set
needs a triage pass before sign-off. Newest three, all recorded 2026-08-27/28 and untracked:

- `BUG_20260827_domain_reports_a_LOSSLESS_sealed_resonance_where_WinISD_shows_a_lossy_one.md` —
  FIXED; introduced in `4ee14af` and caught by John immediately.
- `BUG_20260827_ignore_humidity_checkbox_tooltip_states_the_opposite_of_what_the_flag_does.md` —
  RESOLVED.
- `BUG_20260828_dual_voice_coil_fields_are_carried_but_never_simulated.md` — **NOT a defect**
  (WinISD does not simulate `numVC`/`VCCon` either, probed 2026-08-28); left OPEN as a FEATURE
  question: should OpenISD exceed WinISD here? John's call.

## Release gate (all verified with actual output quoted)

1. [x] `npx vitest run` — **94 files / 2119 tests, all green**, including all seven arch gates
   (verified 2026-08-28 at HEAD `4ee14af`). Re-run on the frozen tree before sign-off.
2. [ ] `npx eslint packages` — 0 problems. Typecheck — clean.
3. [ ] Full Playwright suite, background, `--workers=1`, ONCE — green. Must be a FROZEN tree
   (14 files are currently dirty).
4. [ ] Every `bugs/*.md` RESOLVED or carrying an explicit human DEFERRED ruling — **27 of 89
   currently open**. This is the largest remaining gate item.
5. [x] The regeneration ran ONCE after all model changes; bundle rebuilt (B10 ✓, B11 ✓ — 1,970
   records, 2026-08-24). Re-run B11 if any further shape change lands.
6. [ ] X1 settled: John has ruled where the release cuts relative to the `design` migration.
7. [ ] Reviewer sign-off against the architecture principles on the final tree.

Then report to John for the release decision. Never tag, publish, or push.

## Execution protocol

- **Impl agents: Sonnet.** One checklist task each; give each the working rules above, the two
  hard gates, the arch rules for its files, and the instruction to TDD and to STOP-and-report
  rather than work around anything.
- **Standing reviewer: Opus, adversarial.** Loads `~/.claude/skills/senior-architect-review`.
  Reviews every task's diff BEFORE its box is ticked: arch violations, weakened tests,
  convenience wrappers, historic comments, JSON leaks, calculation outside the engine, invented
  values, duplication (QT72), and done-criteria actually met. A finding BLOCKS the task. The
  reviewer writes no production code, ever.
  **AGENT ATTRIBUTION IS A BLOCKING FINDING**: any `Co-Authored-By: Claude`, `Claude-Session:`,
  or `Generated with [Claude` in an unpushed commit message blocks until rewritten clean.
- Decisions the rulings don't cover go to John, batched, recorded in the ledger (`inbox.py add`)
  the same turn they are raised.

## Git and final cleanup

Commit at regular intervals. Don't push. `dev` is currently **68 commits ahead of `origin/dev`**
— re-measure before assuming anything about what is or isn't pushed.

Attributed commits already in pushed history cannot be rewritten (that needs a force-push, which
is banned) and stay as-is unless John rules otherwise. Unpushed attributed commits are
rewritable at cleanup. winisd_drivers' push remains blocked on an HTTPS hang; next attempt is
SSH, John's call.

## REFERENCE — the precision plan (QO84 ruled: small fix now, big fix is QO87)

SMALL FIX (ruled, post-B10 — B10 has now run, so this is unblocked): `consistency.ts` seeds each
field's tolerance from the winning reading's `read_precision` where one exists
(`precisions[k] ?? halfUlp(resolved[k])`), `halfUlp` as fallback. Corpus-measured evidence: 96.8%
of records carry a divergent reading; three confirmed Q-group verdict flips; the too-tight
imperial-unit class is the release-damaging direction. Corroborated independently by
`winisd_tools/brain/PRECISION_DQ_PORT_QO84.md`.

BIG FIX (**QO87**, open, cycle 2+): port the full printed-precision interval model — values carry
their printed half-width end to end, comparisons are interval overlap, derived values propagate
widths through the formulas rather than perturbation deltas. Its first design decision is its own
open sub-question: is the symmetric half-width model itself right?
