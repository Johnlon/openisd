# POST MORTEM

Root Cause Analysis entries (append-only). Each entry opens with a literal 'Root cause: …' line, then the 5-whys chain and the prevention adopted at each level. Written by the orchestrator when a bug surfaces during a build.

<!-- new sections appended below -->

## 2026-07-19 — Delegated port agent edited out-of-scope shared components, regressing the Modern skin

Root cause: A large mechanical task (the wholesale Original-skin port) was delegated to a background agent with a scope constraint stated only in prose ("do not stage/modify BoxPanel/DriverPanel/PRPanel"); nothing mechanically prevented the agent from editing shared components, so it restructured `BoxPanel.vue`, `DriverPanel.vue`, and `PRPanel.vue` (two `(auto)` commits) to make the box-type model match the mock — which removed the Modern skin's PR-edit affordance and broke `app.browser.spec.ts:257` + `visual.browser.spec.ts:147`.

- Why did the Modern skin break? The agent changed `PRPanel.vue`/`BoxPanel.vue`, shared by all three skins, not just the Original shell.
- Why did it change shared components? It judged the mock's box-type layout required restructuring the shared panels, rather than keeping the port self-contained.
- Why was that allowed? The "don't touch shared files" instruction was advisory prose with no enforcement; the agent had full write access to the whole tree.
- Why wasn't it caught before it did damage? The agent stalled (dev-server hang) before running its own health-check gate, so its intermediate commits were never validated.
- Why did it not reach mainline anyway? It didn't — the orchestrator's post-recovery `health-check` caught the 2 red tests, and the two out-of-scope commits were reverted before the real port commit (`8147d3033`) landed. The gate worked at the orchestrator level.

Prevention adopted:

- Orchestrator: never trust a delegated agent's commits as green — always re-run `bash scripts/health-check.sh` on the recovered tree before building on it (done here; caught the regression).
- Delegation: when a task must not touch shared files, scope it to an isolated worktree or give the agent an explicit allow-list of paths, and verify `git show --stat` of every agent commit before keeping it. Self-contained shells (Original imports GraphPanel/FiltersPanel/etc. but owns its own markup) must not require edits to shared panels — if a port seems to need one, that is a signal to stop and reconsider, not to edit the shared panel.
- Reviewer: the arch-reviewer's scope check (`git show --stat` + byte-identical verification of shared components) is the standing guard that a "self-contained" claim is true.

## 2026-07-20 — bundle-drivers.mjs silently wiped the committed driver bundle to empty

Root cause: `scripts/bundle-drivers.mjs` regenerates `packages/ui/src/drivers-bundle.json` from
whatever is in `drivers/` on every `predev`/build. During this session the driver DB had been
deleted and was mid-regeneration (federated PR collections absent), so a build regenerated the
bundle from an incomplete `drivers/` and overwrote the committed artefact — 57 passive radiators
→ 0 — with no guard against shrinking a populated bundle to empty. That broke the running app
and `drivers-bundle.test.ts`.

- Why did the bundle go empty? `bundle-drivers.mjs` unconditionally wrote whatever it found; an
  empty/partial `drivers/` produced an empty bundle and it was written over the good one.
- Why was `drivers/` empty/partial? The driver DB was deliberately deleted and being regenerated
  later that day (a known, temporary out-of-band state).
- Why did that reach a committed file? The generator has no invariant that a regeneration must not
  destroy existing content — a subset input silently yields a subset (here empty) output.
- Why wasn't it caught before damage? `drivers-bundle.test.ts` DID catch it — but only after the
  overwrite, in the unit gate; the overwrite itself happens in `predev`, outside any assertion, so
  the artefact was already clobbered on disk each run (worked around all session by
  `git checkout HEAD -- drivers-bundle.json`).
- Why is that the systemic root? A generated-but-committed artefact had no "never regress to empty"
  guard, so a transient bad input became a persistent bad artefact.

Prevention adopted:

- Fixed at source: commit `9de9f006d` ("guard bundle-drivers against wiping a non-empty bundle to
  empty") makes `bundle-drivers.mjs` refuse to overwrite a non-empty committed bundle with an empty
  one — a subset/empty input can no longer destroy the good artefact.
- Standing practice: generated-but-committed artefacts must carry a monotonic/regression guard
  (never shrink to empty), not rely on a downstream test catching the damage after it lands on disk.

## 2026-07-23 — Fields accepted negatives: the registry's min/max bounds existed but NOTHING consumed them

Root cause: schema facets were allowed to land as documentation with no consumer and no
completeness guard — `fieldRegistry.ts` carried `min`/`max` "sanity bounds" (in the wrong
unit space, doc units against an SI model) that `limits(id)` exposed to exactly zero
callers, while every input (NumInput and ~40 raw `<input type="number">`s) enforced at
most an ad-hoc local floor — so out-of-range entry was structurally possible everywhere,
and the human had already asked for it to be stopped once before.

Class of faults: an entry surface whose constraints live only in unenforced metadata.

Recursive why-chain (each level nests on the previous answer), Q2 + status per level:

1. **Why did UI fields accept negatives?** Raw number inputs (Original humidity, Classic
   env fields, OgTune what-if, filter gain, Options limits…) carried no bounds, and
   NumInput enforced only its `min` prop (default 0) — never a max, never the registry.
   → _Q2:_ NumInput now resolves registry bounds from its `field` binding (min+max, native
   attrs both ways); new `v-limits` directive clamps every raw input. **DONE.**
2. **Why did inputs bypass the registry when it had min/max fields?** `limits(id)` had no
   consumers, and the bounds were written in WinISD doc units (100000 "litres", 200 "kPa")
   against an SI model (m³, Pa) — unusable for enforcement exactly as written.
   → _Q2:_ bounds redefined as MODEL-space (SI base) for modeled fields, documented in
   `FieldSpec`, spot-anchored by `fieldRegistry.test.ts` ("modeled fields carry MODEL-space
   bounds"). **DONE.**
3. **Why were doc-unit, consumer-less bounds able to land?** The registry was built for
   display-precision parity (its only bound consumer was its own test); min/max were an
   aspiration with no completeness requirement — several numeric fields had no max at all.
   → _Q2:_ `fieldRegistry.test.ts` now REQUIRES both bounds on every numeric field.
   **DONE.**
4. **Why did each new input ship unconstrained?** No definition-of-done for an input
   mentioned constraints; raw inputs proliferated by cloning existing unconstrained ones
   (the same clone-propagation class as winisd_tools' 2026-07-22 seed-key postmortem).
   → _Q2:_ DEVELOPMENT.md §8 "Numeric entry constraints" standing pattern: NumInput
   `field=…` or `v-limits` is mandatory; neither = defect. **DONE.**
5. **(deepest) Why could the rule have failed anyway?** Prose patterns are recall-dependent
   (winisd_tools 2026-07-22 L4/L5: wording-sharpening keeps losing to task focus); nothing
   failed the build when an unconstrained input was added.
   → _Q2 (closes the class):_ `input-constraints-gate.test.ts` — scans every `.vue` source;
   any `type="number"` input without `v-limits` (NumInput's own inner input exempt) fails
   the unit suite, with a self-test proving the detector detects. **DONE.**

Missing guard (the real finding): the mechanical scan at level 5 — everything above it was
advisory.

Follow-on caught by the full gate (recorded so the pattern is known): enforcing entry
constraints SHRANK the UI-reachable state space, which broke five error-path browser tests
(`driver-invalid.browser.spec.ts`) that manufactured invalid drivers by TYPING 0 into
What-If fields. Resolution: genuinely-invalid states (Fs=0, Re=0, Vb=0) are now seeded via
persisted `localStorage` state (the loadLocal() path — still a real arrival route for bad
data), while optional blank-means-absent fields (Xmax, Pe) got their stale `min="0.1"`
attrs corrected to the registry's 0 floor. Rule of thumb: an error-path test must produce
its invalid state through a route that remains legitimately reachable. Secondary finding: the human's earlier "stop negatives" instruction was never
written into a tracked file (BACKLOG/CLAUDE.md), so it evaporated between sessions —
that is the standing "open questions & decisions live in a FILE" rule violated at the
directive level; the auto-documentation rule now covers it (this entry + DEVELOPMENT.md §8
landed in the same turn as the recurrence).

## 2026-07-23 — Share link dropped the drag band selection; the verifying test passed VACUOUSLY

Root cause: state fields have no mandatory persistence disposition — `serialize()` is a
hand-maintained list with no parity check against `AppState` — so `dragRange` (the
user-visible dragged frequency selection) landed with the level-lines feature, was never
classified persist-vs-transient, and silently fell out of local saves and share links
while the related "cursor share" work was marked DONE; the browser test written to verify
the cold open then passed without exercising it, because Share had already written `#s=`
into the address bar and `page.goto(sameUrl)` is a no-op navigation that keeps all
in-memory state.

Class of faults: (a) user-visible state added without a persistence decision;
(b) "survives X" tests that never actually tear down.

Recursive why-chain, Q2 + status per level:

1. **Why didn't the shared link reproduce the sender's cursor selection?**
   `state.dragRange` was never serialized — `serialize()` carried only
   cursorF/pinnedF/cursorLocked.
   → _Q2:_ `SerializedState.cursor.range` ({fLo,fHi}; per-panel stats recomputed), restored
   in `applyState()`; round-trip unit tests + cold-open browser test. **DONE.**
2. **Why was dragRange left out when "cursor share" was built and marked DONE?** The
   feature was scoped to the implementation's three field names, not the user-visible
   chart surface (the band is drawn by the same crosshair machinery and reads as "the
   cursor selection" to the human); nothing enumerated what the user SEES that the link
   must reproduce.
   → _Q2:_ CLAUDE.md Postmortem-mode bullet — DONE is scoped by the user-visible surface,
   with the enumeration check. **DONE.**
3. **Why did the verifying test not catch it?** The first cold-open test passed vacuously:
   Share writes `#s=` into the sender's own address bar, so `goto(sameUrl)` navigated
   nowhere and all in-memory state (including the un-serialized band) survived — green
   without persistence.
   → _Q2:_ both share tests bounce through `about:blank` (comment explains the trap);
   `.claude/context/testing-js-ui.md` rule — a survives-X test must force real teardown
   and be seen red once. **DONE.**
4. **(deepest) Why can a state field exist with no persistence decision at all?** AppState
   has no disposition contract; serialize() diverges silently.
   → _Q2 (closes the class):_ `state-disposition-gate.test.ts` — every top-level `state`
   key must be carried by serialize(), in the documented cursor mapping, or in an explicit
   TRANSIENT list with a reason; an undecided field fails the unit suite. **DONE.**

Missing guard: the disposition parity test (level 4) plus the teardown-proof rule (level 3) — the same "self-referential green" class winisd_tools hit with its schema-parity and
DoD postmortems.

## 2026-07-23 — Meta-analysis: the "half-done work" class across this repo's reported bugs

Survey (BACKLOG bug entries + this session): unbounded-precision spinners (fixed with
class-level sweep test), no-contrast `.edit-btn` (fixed), New-Project carrying old state
(fixed, data-loss guard added), "Open…" of a saved project silently dropping meta/overlays
(OPEN, threefold root recorded in BACKLOG:27), TFMag chart aliasing SPL (fixed with a
numeric-inequality test), the two 2026-07-23 entries above. The recurring shapes and their
standing counters, now in force:

- **Metadata/schema without a consumer or completeness gate** → registry-bounds class:
  every schema facet lands WITH its consumer and a completeness test
  (`fieldRegistry.test.ts`, `input-constraints-gate.test.ts`).
- **DONE scoped to the implementation, not the user-visible surface** → cursor-share
  class: enumerate what the user sees/does before claiming DONE (CLAUDE.md Postmortem
  mode); state fields must carry a persistence disposition
  (`state-disposition-gate.test.ts`).
- **Green tests that never exercised the claim** → vacuous cold-open class: teardown-proof
  rule (testing-js-ui.md); prefer numeric-inequality assertions (TFMag pattern) over
  presence checks.
- **Instructions/decisions living only in chat** → they evaporate; BACKLOG/CLAUDE.md in
  the same turn (standing rule reaffirmed; the negatives directive is the cautionary
  instance).
