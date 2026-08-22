# E1 worklist — historic-comment sweep (openisd), adjudicated

Inventory: opus1, 2026-08-22 18:16 BST, tree at 48b3d0b + sonnet1's in-flight edits (line
numbers WILL have drifted — re-locate by quoted text, not line). Full per-hit detail is in
opus1's report (session record); this file carries the counts, the adjudications, and the
policy rulings E1's executor applies.

## Scale

24 VIOLATIONS accepted as inventoried (each with a disposition: delete, or rewrite keeping a
named live constraint), across: engine/driver.ts (3), model/openisdDriver.ts + openisdDerive.ts
(2), ui logic (persist ×2, series, units, useVentGroup, wprMapping, myDrivers, types) (8),
ui components (UnitToggle, GraphPanel, DriverEditorModal ×2, expoStep) (5), scripts/
test-browser.sh (1), test files (persist ×2, three browser specs ×4 hits, architecture.test.ts
:844 — the sharpest: it points readers at git history for a deleted comment) (7 hits),
docs (STATE_MODEL.md two blocks, DRIVER_ADT_DESIGN.md parenthetical) (3).

## Policy rulings (orchestrator, 2026-08-22 — these decide every UNSURE class)

1. **Regression-test comments naming the pinned defect** (5 engine test files): the comment
   states the guarded failure mode as a PRESENT-TENSE COUNTERFACTUAL plus the bug-file cite —
   "guards vXmax=0 → maxspl=−Infinity when Xmax=0 (BUG_xxx)" — never "used to". The defect's
   story lives in the bug file; the test names what it PINS.
2. **The bare word "historic(al)"** on a subject that exists (engine/types.ts, ui/types.ts,
   presentationState.ts): delete the word, keep the sentence — provenance noise, not a
   non-thing.
3. **store.ts's ventL passage: LEGITIMATE, keep** — it describes foreign input arriving at the
   persistence boundary today and argues why that is not a second model; that is exactly the
   comment the doctrine wants.
4. **Rejected-alternative guards** (projectFile.ts, scripts/test.sh, DriverEditorModal ×2,
   NumInput, OriginalShell): keep the guard, rewrite tense-only to the hypothetical —
   "a stricter rule WOULD…", "a plain `&&` CANNOT work because…".
5. **whatif-panel-shots.browser.spec.ts: legitimate** — the injected rule exists in the running
   test; the method constraint is live.
6. **PERSISTENCE_NAMING_AND_PLACEMENT.md:43 "superseded": keep** — a live precedence statement
   between two standing documents, not a reference to a deleted thing.
7. opus1's two grep false-positives ("used to <verb>" = purpose) confirmed non-violations.

## Execution

E1 runs after A8 per the plan. Executor: re-locate each hit by its quoted text, apply the
disposition, then re-run opus1's marker grep to prove zero VIOLATION-class residue; the
UNSURE classes are settled above, no per-hit judgement calls remain.
