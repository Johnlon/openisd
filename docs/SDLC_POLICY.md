# SDLC policy — rules every agent follows

John's standing orders. Each rule names its date and his words. Background and history: [`SDLC.md`](SDLC.md);
the normal landing path: [`DEV_PROCESS.md`](DEV_PROCESS.md).

## 1. Main broken: fix main, directly (John, 31 Oct 2026)

> "If main is broken, you fix main. You don't create new branches that just cause further delay. The emergency is
> main must be fixed." — "If you don't work on main when it's an emergency, you end up with conflicts and other
> matters, which means that you have to do yet more builds and more merges. Just get it onto main."

Main is broken when the suite on main's head is red, an `F` fix is open, the deploy fails, a release is blocked on
a fix, or John says so.

- Commit the fix and push it straight to main (`git push origin HEAD:main`). No new branch, no PR, no `land.sh`
  candidate run first.
- If main moved under you, **merge** it (`git merge origin/main`), never rebase: one conflict round, not one per
  commit.
- Do **only** the fix. No visual baseline re-takes, no coverage baselines, no bookkeeping, tidying or other
  housekeeping until main works ("you wasted even more time taking visual baselines when we're broken ... This must
  be something that you have to stop doing"). A generated file in conflict takes main's side; it is regenerated
  after the emergency.
- Prove the fix with its own failing specs first (§2), then push.
- After the push, check main's exact head with the full suite without blocking main:
  `git push -f origin <sha>:refs/heads/land/<task>` runs `suite.yml` on that sha. Red → fix on main again (§2).
- Outside an emergency, main moves only through `scripts/land.sh` (`.claude/rules/processes.md` rule 6).

## 2. Failing tests: one spec, then a cluster, then the suite (John, 7 and 31 Oct 2026)

> "no you run just that one test to make sure it works before running other tests" — "don't run full suite until
> all individuals work then try running a small cluster 2 or 3 around it, then the suite, be smart and efficient"

A full suite costs ~9 min on GitHub and ~30 min per landing retry. Climb the ladder, never skip a rung:

1. Each failing spec alone: `bash scripts/test.sh <spec>`. Fails alone → real defect: fix it, red first.
2. A cluster of 2–3 neighbouring specs (same area, shared state) together. A pass alone but a fail here →
   interaction bug: fix it.
3. Only then the full suite (`land.sh`, or the `land/<task>` push in §1).

Never re-run a landing or the suite on a red before rungs 1 and 2 pass locally. A spec that passes alone and on
the cluster but fails again in a full run is a flaky test: it gets a bug file and a task, never a silent rerun.

## 3. Release first (John, 31 Oct 2026)

> "my number one priority is getting the release out with the update and bug fixes, not new work"

While a release is being got out, agents do release fixes only: the fixes the release claims, their tests
(every claimed fix has its own test), and anything blocking deploy. New features, refactors, coverage and gate work
wait. Release work stays on one integrated branch (`CLAUDE.md` "Release work stays integrated").

## 4. Agent sessions run in tmux under the keeper (John, 31 Oct 2026)

> "the auto handover process isn't working, we see the doc generated and then no auto clear" — "this needs to be
> automatic"

Auto handover only clears a session that runs in a tmux pane. The tmux server died on 30 Oct; for a day every
session ran outside tmux and no handover was cleared.

- Every agent session runs in tmux session `claude` with Remote Control on, started by
  `zoo/handover/start_session.sh` (workspace repo).
- `agents-keeper.timer` (systemd user, every minute) restarts any agent on the roster `zoo/handover/agents.yml`
  that is not running; `agents-tmux.service` owns the tmux server. Remove a name from the roster to retire an
  agent. Details: `zoo/handover/SKILL.md`.
- A session found running outside tmux is logged in `~/.claude/handover/keeper.log`; restart it in tmux.

## 5. A restarted agent is out of date (John, 31 Oct 2026)

> "the agents are all out of date" — "tell them no to proceeding" — "they need to coordinate with you on any work"

An agent resumed from an old transcript takes no action on its old work. Before any work it tells the coordinating
session what it means to do and waits for an ok. The keeper's resume prompt says this.
