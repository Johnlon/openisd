# Processes — never stuck, never orphaned, never self-matching

John, 2026-10-07: "stuff should never get stuck or orphan or stupid errors like grep matching it's own
command"; "you can't rely on things cleaning up, you need robust automatic housekeeping".

These rules bind every script, hook and agent command in this repo. The repo enforces them (tests,
gates, the housekeeper), not any one agent.

1. **Never find a process by its command text.** No `pgrep -f`, `pkill -f`, `ps | grep` to locate,
   wait for or kill a process: the pattern matches the searching command itself. Use the pid or
   process group the run recorded when it started.
2. **Every run owns its children.** A run starts its own process group and kills it on any exit
   (`trap` on EXIT, INT, TERM, HUP), including Playwright's webServer Vite and Chrome.
3. **Every run is tagged.** A run registers (run id, owner pid and start time, clean copy, port,
   ticket) and exports `OPENISD_RUN_ID`; children inherit it.
4. **Housekeeping does not depend on the run.** `scripts/housekeeping.sh` runs at every queue entry
   and on a systemd user timer: any tagged process whose owner is dead is killed, and that run's
   ticket, clean copy, port reservation and temp dirs are removed. Untagged processes are never
   touched. Every action is logged to `build/test-logs/housekeeping.log`; a failed scan fails loudly.
5. **Every wait checks its owner is alive** (pid plus start time). A dead owner ends the wait. No
   hand-written `while/until … sleep` polling loops; slow runs wait in the queue
   (`scripts/slow-run/queue.sh`).
6. **The shared main moves only under a queue ticket.** No ff, merge or commit onto it from another
   worktree while a queued run is active.
7. **Infrastructure changes are proven before they go live**: an end-to-end test in a scratch repo
   with real processes and two concurrent runs, wired in only when no slow run is active. Live gate
   scripts are never edited in place.
