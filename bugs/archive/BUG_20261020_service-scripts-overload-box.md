# Service scripts can overload the box

**Status:** FIXED (T486)

## What happened
Load audit of 20 Oct 2026 (`_agent_files/briefs/AUDIT_load_openisd-services_20261020.md`): the systemd units and
the watchdog tick are sound, but the old start/kill/telemetry scripts bypass admission, heavy.slice and group
kills. 13 rows, one fix each.

## Rows
1. `kill-http.sh` kills every process with a socket on the port, clients too (browsers, curl), not only the listener.
2. `start-http.sh` defaults to port 4000 and kills the live openisd-preview unit's server.
3. `start-http.sh` and `dev-4200.sh` run lint, typecheck and the unit suite on every start, outside heavy.slice.
4. `run-ui-telemetry.sh` runs the full browser sweep outside heavy.slice, and its EXIT trap leaves playwright, vite and chrome running.
5. `start-http.sh` starts the server in the script's own process group, so `stop-http.sh` kills npm only.
6. `start-http.sh` has no EXIT/INT/TERM trap: killed during its wait, it leaves the server running with a stale pid file.
7. `housekeeping.sh` forks `tr` and `sed` twice per process on every tick: a fork storm during a pile-up.
8. `watchdog.sh` starts the untested-main post-land run outside heavy.slice.
9. `watchdog.service` has no `TimeoutStartSec`: a hung git leaves the watchdog silently dead.
10. `tidy-branches.sh` forks once per process in `in_use`, and deletes a peer's brand-new `<repo>-*` folder.
11. `housekeeping.sh` early exits log a START with no END.
12. `openisd-preview.service` has no `MemoryMax` and no start-limit tuning.
13. `measure-peak.sh` puts its scope in `measure.slice`, which has no ceiling.

## Cause
Scripts written before heavy.slice, admit.sh and the processes rules existed were never brought up to them.

## Fix
- 1: `lsof -ti :PORT -sTCP:LISTEN`. 2: start/stop/kill-http refuse 4000 and point at `scripts/preview-4000.sh`
  (`make start-4000` runs preview-4000.sh; `make stop` stops the unit).
- 3: start-http runs no checks. 4: playwright under `systemd-run --user --scope --slice=heavy.slice` in its own
  process group; the EXIT trap kills the group. 5/6: `setsid`, the group id is the pid file, EXIT/INT/TERM/HUP trap
  kills the group until the server is ready; stop-http does `kill -TERM -- -pgid`.
- 7: tag scan reads environ in-shell. 8: `--slice=heavy.slice`. 9: `TimeoutStartSec=300`.
- 10: one `find` for all cwds; only folders older than a day are removed. 11: EXIT trap writes END.
- 12: `MemoryMax=2G`, `RestartSec=10`, `StartLimitIntervalSec=300`, `StartLimitBurst=10`. 13: heavy.slice.

## Tests
`scripts/land/test/services-load.test.sh` (rows 1-9, 12, 13), `housekeeping.test.sh` (7, 11),
`tidy-branches.e2e.test.sh` (10), `watchdog.test.sh` (8).

## Added 20 Oct (land/test audit rows)
14. watchdog runs sync-main-folder and tidy-branches under `timeout 900`, logs and alerts on timeout.
15. tidy-branches reads every cwd once per run (one `find`). 16. `tree_cpu` is one `cat` + one awk pass.
17. every `lsof` in kill-http.sh is LISTEN-only. Tests: services-load.test.sh.
