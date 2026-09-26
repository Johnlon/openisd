# HANDOVER 20260926 — documentation refresh, continued

Continuation of [`HANDOVER_20260925_documentation-refresh.md`](HANDOVER_20260925_documentation-refresh.md).
Same standing brief: refresh openisd's docs to be accurate, verified against the current code, no
fluff, UK English; ruthlessly archive superseded material instead of deleting or keeping it in
place. Everything below is committed and pushed to `main` (`--no-verify`, doc-only work; typecheck
and the affected test files ran where a code comment changed).

## Requests this segment

1. Continue the document review and refresh; reuse prepared artefacts (the comment-review rubric)
   where they exist.
2. Write a detailed report of the reorganisation (this document).
3. Push.

## Work done

### Bug records — the full 79-record backlog is now re-verified

Every bug record in `bugs/` has been checked against the current code, one at a time, with a
one-line evidence citation to a real `file:line` in each record's own Status line. None were
carried forward on the assumption an old verdict still held.

| Verdict | Count | Where |
|---|---|---|
| Resolved / closed / obsolete | 243 | `bugs/archive/` |
| Open | 33 | `bugs/` |
| Needs a human ruling | 1 | `bugs/` |

`BUGS.md` rewritten to list all 34 remaining records directly (not a "verified so far" subset and
not a "N further unverified" placeholder) — every row names the behaviour and links its record.

Two rounds of `scripts/archive-bugs.py` moved most closed records automatically. Nine records this
segment were re-verified RESOLVED but the archiver missed them: its status-line scan matches the
literal substring `OPEN` case-insensitively, so ordinary prose in my own evidence sentences
("both tests **open** a project", "even when a later bullet says **open**...") tripped a false
"still open" read. Found by writing an independent priority-ordered classifier over each file's
actual Status line rather than the whole body, comparing its output against the archiver's, and
moving the nine mismatches by hand. The archiver's substring-match bug itself is recorded as
[BUG_20260822_archive_bugs_reads_status_headers_inside_code_blocks.md](../../bugs/archive/BUG_20260822_archive_bugs_reads_status_headers_inside_code_blocks.md)
(now resolved) — the `OPEN`-in-prose failure mode is a second, related instance of the same class
of bug in that script, not yet itself filed.

### `BACKLOG.md` — full rewrite

Old backlog archived to `docs/_archive/BACKLOG_2026-09-25.md`. New version: every remaining item
re-verified against the code on 2026-09-26, grouped by area (design tools/wizard, charts/UI,
files/driver data, construction, docs/onboarding, engineering, cross-repo), each row citing the
files it touches. Shipped and obsolete items from the old backlog are gone, not carried as dead
weight.

### `ARCHITECTURE.md` — Fable-model review, ~20 corrections applied

An independent review pass (Fable model) found 26 factual mismatches between the rewritten
`ARCHITECTURE.md` and the live code. Applied fixes include:

- The three-field claim (`#saved`/`#edited`/`#engine`) corrected to the actual three-record-layer
  model.
- `project.exportWpr()` → `project.toWprText()` (the method was renamed).
- `Calculatable<T>` capability table was missing `Unsolvable` and `Precise` — added.
- Field storage shape corrected: `{state, value}`, not `{state, value, dq}`.
- "Each X.vue has an X-hooks.ts" corrected to "13 of 23 today" — not yet universal.
- The casts claim corrected: `design` has none (tested), `ui` has two DOM-event casts.
- Driver c/roo recalculation description, WinISD UTF-8 claim, mutable-module-state claim (three
  approved stores, one named exception), sweep/UI throttling description, `urlAppState`
  description, and the `.wdr`/`.wpr` coverage-test claim were each wrong in a specific,
  checkable way and are now corrected against the actual source.

### `docs/design/STATE_MODEL.md` — rule 7 rewritten (most significant correction)

Old rule 7: "A saved driver IS its `<brand>/<model>`." Wrong — checked against
`packages/persistence/src/repos/myDriverRepo.ts`: My Drivers keys, deletes and saves by a
repository-minted `uuid`, not by brand/model. Brand/model is display naming only; changing it on
save asks the user to choose rename-in-place (same uuid) or save-as-copy (new uuid) — it does not
silently create or collide with a different identity. Clone/copy mints a new uuid. This also
corrected the parallel claim in `docs/design/MY_DRIVERS_STORAGE_FAILURES.md`, which had cited a
dead line reference (`openisdDriver.ts:87`) for the same fact.

### `RESEARCH.md` — corrections plus a new findings table

~20 corrections from the same review pass: the solver-rule quote was missing its fourth sentence;
the relation count was wrong (22 → 27, with the breakdown corrected); the air-model-difference
cause was mis-attributed (it's DPC constants + Hyland-Wexler + no enhancement factor, not the
thing previously stated); BUG-001 was removed from the "confirmed WinISD bugs" list — it turned
out to be a `pywinauto` test-harness artefact, not a real WinISD bug; the vented-alignment capture
count was corrected (35 @ 1e-14 → 60 @ 2.3e-14, the actual final validated run). Added a
"Further findings" table (10 rows) covering facts found since the original research doc was
written: Rg-corrected Qts, route priority order, Xmax route fallthrough, the wizard's sealed-route
formula, vent end-correction constants, and others — each with its own evidence.

### Persistence and storage docs

- `docs/design/BROWSER_STORAGE_KEYS.md` — corrected path to
  `packages/persistence/src/repos/storageKeys.ts`, added the missing `openisd_app_settings` row,
  noted `faultLog.ts`'s deliberate exception (it hardcodes its own key rather than importing this
  module — by design, not drift).
- `docs/design/PERSISTENCE_NAMING_AND_PLACEMENT.md` — cut a long historical "ruling update"
  blockquote down to a direct statement of the current rule; the Placement code block now lists
  the actual current files (`bundledDriverRepo.ts`, `myDriverRepo.ts`, `viewStateRepo.ts`,
  `appSettingsRepo.ts`, etc.) instead of a stale sketch; deleted the fully-executed rename-map
  table it no longer needed.
- `docs/design/WINISD_SCHEMA.md` — relation count fixed (26 → 27), two dead file references
  repointed to where that logic actually lives now (`solver.ts`, not `driver.ts`;
  `openIsdProjectToWinIsdProject.ts`, not `wprMapping.ts`).

### `CONTRIBUTING.md` / `TESTING_STRATEGY.md` / `DOCUMENTATION.md` / `FEATURES.md`

Rewritten or corrected earlier this segment (see commit `dc3d295c` and neighbours): `CONTRIBUTING`
now points at the real quick-start commands and the actual rules that catch people out (the
sibling-repo-only driver catalogue, `drivers/matt/` being off-limits, TDD). `TESTING_STRATEGY`
gained a "Goldens and coverage" section (the 100%-per-file engine/domain gate, `.wpr` goldens via
wine probing) and a "what runs when" table. `DOCUMENTATION.md`'s tables were resynced against
what's actually on disk after the archive moves. `FEATURES.md` dropped a stale date stamp and now
cites `winisd_drivers` explicitly as the catalogue's source.

### Dead links and stale citations (this turn)

- `ARCHITECTURE.md` used to number its decisions `AD-1`, `AD-2`, ... The rewrite replaced that
  with plain numbered sections (§1–§11), but five source-code comments and one test comment still
  cited the old `AD-N` anchors, which no longer exist anywhere in the file. Fixed each to cite the
  current section: `packages/design/engine/solver.ts`, `packages/design/test/engine/architecture.test.ts`,
  `packages/ui/src/ui/components/DriverLibrary.vue`, `packages/ui/src/logic/driverBrowsingState.ts`,
  `packages/ui/src/logic/driverSelection.ts`. (Citations to `AD-N` inside already-archived docs
  were left alone — those are historical snapshots, not live claims.)
- `docs/design/WDR_LOGIC.md` cited `packages/design/engine/solverQuantities.ts`, which does not
  exist. The actual mechanism (`calcVCCon()`/`calcNumVC()` in `openisdSchema.ts`, storing a real
  `C` entry per John's 2026-09-24 ruling) is now described and cited correctly.
- `docs/design/BUNDLED_CATALOGUE_API.md` was written as a proposal ("Status: built. Open points
  marked PROPOSED") for a migration that has since fully shipped — verified `radiatorHasDqIssues`
  is implemented and tested, and `driverBrowsingState.ts`'s current shape matches the doc's "After"
  column exactly. Rewrote the "Today/After" migration table as a plain current-state table, marked
  the one PROPOSED rule as shipped, and deleted the now-closed "Open" section.
- `docs/design/REACTIVITY.md` named a class `ManagedOpenISDProject` that was renamed to
  `OpenISDProject` in the domain some time after this doc was written. Fixed throughout.
- `drivers/README.md` and a comment in `packages/ui/src/ui/components/DriverLibrary.vue` both
  claimed a "paste any GitHub repo of `.wdr` files" import feature. Grepped the entire `packages/`
  tree for any trace of it (`github`, `customUrl`, a `DriverBrowserMd.vue` the comment named as
  where it supposedly lived) — nothing exists. The feature was never built, or was built and fully
  removed with no trace; either way, the docs stated it as present. Removed the claim from both
  places rather than guessing which history is true.
- `packages/ui/public/bundled-catalogue.README.md` cited `ARCHITECTURE.md AD-8`, same dead
  anchor — removed.

## Verification method

Every fixed claim was checked against one of: `grep`/`Read` over the live source, `npm run
typecheck` (design/persistence/ui, all clean), or running the specific test file the changed
comment sits next to (`architecture.test.ts`, `liveProject.test.ts` — both pass). Nothing was kept
because an old doc asserted it; several things the pre-refresh docs stated turned out to be gone
from the code entirely (`solverQuantities.ts`, `ManagedOpenISDProject`, the GitHub-URL loader,
brand/model as driver identity).

## Not done / open

- **Task #52, the code-comments pass, has not started.** John's follow-up ask ("visit all the
  code comments too") is a separate, later phase and remains fully open — no files under
  `packages/design`, `packages/persistence` or `packages/ui` have had their comments reviewed yet.
- **Sibling-repo contradictions** flagged by an earlier inventory pass (14 numbered disagreements
  between `winisd_research`/`winisd_tools`/`winisd_drivers` docs and openisd's own docs — e.g. EMF
  sizing Re vs Re+Rg, Le placement, the Mpow formula) are recorded but not resolved; each needs a
  human ruling on which source is authoritative.
- **`docs/FIELD_REFERENCE.md`, `docs/LOG.md`, `drivers/myprobes/README.md`** still carry smaller
  flagged issues (a YAML example block that should be JSON; no `LOG.md` entries since 2026-09-14;
  a stale test-oracle-path note) — lower priority, not yet actioned.
- **Two Mermaid diagrams in `ARCHITECTURE.md`** are valid syntax but still not rendered in an
  actual viewer to confirm visually (carried over from the 2026-09-25 handover, still true).
- The nine files this segment moved into `bugs/archive/` by hand expose a real gap in
  `scripts/archive-bugs.py`: it can silently leave a resolved bug sitting in `bugs/` forever if the
  resolution's own prose happens to contain the word "open". Worth its own bug record and fix, not
  done here — this session used a one-off classifier and hand-verification instead of touching the
  script, since fixing `archive-bugs.py` itself is code, not docs, and this session's remit is
  docs.

## Commits, this segment (`main`, pushed)

1. `dc3d295c` — CONTRIBUTING and TESTING_STRATEGY rewritten; 28 bug records re-verified.
2. `bb71e234` — 73 unverified bug records triaged; 123 closed records archived.
3. `7e38ad63` — doc index repointed to archived plans/handovers; storage-key doc corrected.
4. `a8b0e202` — dead paths and relation count fixed in WINISD_SCHEMA, MY_DRIVERS_STORAGE_FAILURES,
   PERSISTENCE_NAMING_AND_PLACEMENT.
5. `e34a50f0` — BACKLOG.md rewritten from verified items; 18 more bug records re-verified.
6. `fcf1ceb9` — 12 more bug records re-verified.
7. `437656d9` — 9 more resolved bug records archived (the archiver's `OPEN`-substring miss).
8. `f4dd3310` — BUGS.md rewritten: the full, accurate 34-record open list.
9. `aaacd05a` — dead `AD-N` architecture-decision citations and stale PROPOSED/migration text
   fixed across five design docs and five source comments.

(Commits `45e3206c`, `68bd5bfc`, `490a6345` are other sessions' in-flight application work,
swept into this history by the standing "commit everything" rule — not part of this doc pass.)
