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
