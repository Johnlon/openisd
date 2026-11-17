# SDLC policy — rules every agent follows

John's standing orders. Each rule names its date and his words. Background and history: [`SDLC.md`](SDLC.md);
the normal path to main: [`DEV_PROCESS.md`](DEV_PROCESS.md).

## 1. Main broken: fix first, fix only (John, 31 Oct 2026; queue QO481, 10 Nov 2026)

Pull requests run only the fast gates, so a browser break can reach main; the full suite runs there after each merge and a red
opens a `main-red` issue (QO501, John 10 Nov 2026, "pick A"). When main is red (that issue, the
deploy fails, a release is blocked, John says so), the fix is a pull request labelled `fixes`, first in the queue.

- Do **only** the fix. No visual baseline re-takes, no coverage baselines, no bookkeeping, tidying or other
  housekeeping until main works ("you wasted even more time taking visual baselines when we're broken ... This must
  be something that you have to stop doing"). A generated file in conflict takes main's side; it is regenerated
  after the emergency.
- Prove the fix with its own failing specs first (§2), then `bash scripts/ship.sh T<n>`.
- Main moves only through the merge queue (`.claude/rules/processes.md` rule 6).

## 2. Failing tests: one spec, then a cluster, then the suite (John, 7 and 31 Oct 2026)

> "no you run just that one test to make sure it works before running other tests" — "don't run full suite until
> all individuals work then try running a small cluster 2 or 3 around it, then the suite, be smart and efficient"

A full suite costs ~9 min on GitHub (it runs on main after each merge, not on pull requests). Climb the ladder, never skip a rung:

1. Each failing spec alone: `bash scripts/test.sh <spec>`. Fails alone → real defect: fix it, red first.
2. A cluster of 2–3 neighbouring specs (same area, shared state) together. A pass alone but a fail here →
   interaction bug: fix it.
3. Only then the full suite (on main after the merge, `suite.yml`).

Never re-push a pull request or re-run the suite on a red before rungs 1 and 2 pass locally. A spec that passes alone and on
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

## 6. The update popup is written for users (John, 17 Nov 2026)

> "this is too obvious what it should do already so make it all sound like new features since last prod release";
> "1 is boring"; "boring remove"; "make this popup stuff users care about"; "they don't give a shit about fonts";
> "or buttons"; "simplify"; "they don't care about bugs like this ... edge case"; "terrible" (of "With several drivers, the impedance chart
> matches WinISD"); "you have to be more salesman"; "too repetitive and the datasheet comment is
> irritating delete it"; "come on get it right and then update the Claude SDLC docs for these messages so I don't have to explain again"

The update popup (`cloudflare/announcements/src/index.js`, one entry per release) is what a user reads after an update.
Every line answers "what can I do now, or what works better for me", in a designer's words.

- Lead with what the user gets: a result in their design, a job made quicker, a wrong answer put right.
- No buttons, menus, tabs, pages, dialogs or where a control sits ("the All button beside Data", "on the Driver page").
  Say what the user can do, not which control does it.
- No fonts, layouts, help texts, internal checks, task ids, or how it was built.
- No dull or obvious lines ("passive radiators have Select, Info and Edit").
- No narrow technical lines that need the reader to know a chart or WinISD's behaviour to see why they matter
  ("With several drivers, the impedance chart matches WinISD").
- No edge-case bug fixes (a value stuck after an extreme entry): users never met them. They go in the release notes
  only. A fix goes in the popup only when many users saw the wrong result in normal use (false warnings on dual-coil
  drivers).
- The catalogue line gives the counts ("Now 1,923 drivers and 86 passive radiators from 21 makers"), counted from the live
  catalogues of production and test, and names the makers that are new since the last production release, not
  drivers (John: "give a counter of new drivers or manus"; "no name the manus not the drivers"; "the new manus since prod").
- Sell it: the title is the headline benefit; say what OpenISD now does for the user, true and checked against the
  build (never claim a feature that is only planned).
- Talk about OpenISD, not WinISD: no line names WinISD or what it gets wrong (John, 17 Nov 2026: "don't talk about
  WinISD talk about OpenISD - standard rule"). Say the effect a user sees in plain words: "so high frequencies stay
  right", not "the top end" (John: "just say high freq and what's wrong").
- No line repeats the title or another line; no "now matches its datasheet" lines (users expect that already).
- Short, plain sentences: one fact per line, about 12 words at most, no colon followed by an explanation. Say the
  benefit, not the mechanism: "now match their datasheets", not "no more false 'values disagree' warnings".
- Six lines at most; the title names the two or three things users care about most.
- The release notes (`release.sh --notes-file`) can be fuller; the popup cannot.
- The lead drafts the popup and shows John the full text before it is merged; John's words win.

Worked example (7.0.960, after "be more salesman"): title "Dual-coil drivers, done right"; summary "Wire any dual-coil driver
in series or parallel and get the real answer."; lines "Impedance, inductance and BL follow the wiring, so high frequencies stay
right." / "Export every chart in one click." / "Now 1,362
woofers and 86 passive radiators from 21 makers, with CSS and RS Speakers new." / "Works better on phones."
