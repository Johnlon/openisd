# BUG_20261017_watchdog-alerts-reach-no-agent

**Status:** FIXED (T333)

## Symptom
The watchdog's alerts (an open F, a hung post-land run, an unread zoo result, an infra F, and now a main folder
that cannot update) were typed into tmux windows of a session called `agents`. That session no longer exists, so
every alert fell back to a line in `zoo/ASK.md` that no agent reads. John, 17 Oct 2026: "if the land fails then
no one acts"; "our scripts cannot rely on tmux at all"; "only stuff we control or which is part of Claude can be
used"; "I don't want inbox full of useless signals".

## Fix
- The agent inbox: the watchdog writes each live problem as a file, `$OPENISD_RUNTIME_DIR/agent-alerts/<key>.alert`
  ("for <owner>: <text>"), re-written every tick while it lasts. No tmux, no ASK.md, nothing in John's inbox.
- The Claude Code PreToolUse hook (`_agent_files/bin/run_gates.py` with `agent_alerts.py`) hands every live alert
  to each agent session as `additionalContext`, at most every 5 min per session, at once when its text changes;
  the tool call still runs. An alert not re-written for 10 min is over.
- A held main folder (`sync-main-folder.sh`) is such an alert, for the leader, every tick until it is fixed.
- Found on the way: `sync-main-folder.sh` reported any failed rebase as a CONFLICT; a rebase git refuses for
  another reason is now reported as that.
- Tests: `scripts/land/test/watchdog.test.sh` (alert files; tmux never called; ASK.md never written; a held
  main folder alerts), `scripts/land/test/sync-main-folder.e2e.test.sh` case 8, `_agent_files/bin/agent_alerts_test.py`.
