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
