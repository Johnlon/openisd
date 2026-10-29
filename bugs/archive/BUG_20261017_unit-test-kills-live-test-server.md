# BUG_20261017_unit-test-kills-live-test-server

**Status:** FIXED (T308)

## Symptom
17 Oct 2026, 05:53Z. bob's full local UI browser run (port 4100, 05:45:54–05:53:54Z) lost its test
server. 12 what-if-panel specs failed with "DEV SERVER UNREACHABLE: FAILED http://localhost:4100/"
(ERR_CONNECTION_REFUSED). The same file passed 19 of 19 alone right after. There was no OOM kill, and
heavy.slice's throttle count did not move.

## Cause
`packages/ui/test/scripts/full-gate-stage.test.ts` runs the real `scripts/test-browser.sh` from a scratch
copy, with a scratch `OPENISD_RESERVATION_DIR`. The port lock is `$OPENISD_RESERVATION_DIR.port-<n>.lock`,
so the copy saw no live run and took port 4100. It then ran the real `kill-http.sh 4100`, which killed
whatever listened there. At 05:52:31Z another session (t271) ran `vitest run packages/ui/test …`, which
includes this test. bob's server died between his line-130 and line-143 specs, inside that run.

Proof: in a private network namespace (`unshare -rn`) with a stand-in server on 4100, running only this
test killed the stand-in. With the fix, the stand-in stays up.

## Fix
- The test gives its scratch copy a fake `kill-http.sh` that records its arguments. It asserts that
  `kill-http` is called with a pool port, then playwright.
- `scripts/kill-http.sh` (Linux) refuses to kill a listener tagged with another browser run's owner
  (`OPENISD_BROWSER_OWNER`) whose owner is alive: exit 1, naming the owner pid. This run's own listeners,
  those of dead owners, and untagged ones are killed as before.
- Test: `packages/ui/test/scripts/kill-http-live-run.test.ts`, each case on its own free port: a live other
  run's server is refused and stays up; a dead owner's server is killed; an untagged listener is killed.

- Architecture test `packages/ui/test/architecture/tests-never-touch-the-machine.test.ts` (fable, 17 Oct).
  It finds the machine scripts from their own text: any `scripts/**.sh` that kills, looks up ports, runs
  systemd or uses the runtime dir. A test that names one must:
  1. give it a scratch `OPENISD_RUNTIME_DIR` (with `mkdtempSync`);
  2. only ever write a fake of a port killer (lsof/fuser), never copy or run the real one;
  3. never run a machine script from the repo itself.

  The one exemption, with its reason, is `kill-http-live-run.test.ts`: it runs the real kill-http.sh only on
  ports the OS gives it. On main, `full-gate-stage.test.ts` breaks rules 1 and 2 (line 57 copies the real
  kill-http.sh), so this test would have refused it. Both tests now give their scripts a scratch runtime
  dir. It is the same kind of fault as the T254 runtime-dir bug.

## Bearing on BUG_20261017_laptop-suite-server-dies-mid-run
That bug was closed on heavy.slice's old 5G MemoryHigh, on the strength of a green repro under 13G. This
test is a second, proven way for a laptop suite's server to die mid-run whenever another session runs the
UI unit tests. Most likely it caused some or all of the F49–F51 deaths too. The full logs that could settle
it are gone. With this fix, neither cause remains.
