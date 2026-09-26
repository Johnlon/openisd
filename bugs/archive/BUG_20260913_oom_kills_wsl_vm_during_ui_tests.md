# OOM under the UI suite killed the whole WSL VM, not just a chrome process

Status: FIXED (worker-count throttling); root cause confirmed

## Symptom

Mid-suite, the WSL2 VM itself went down. `wsl.exe` afterward failed with a generic
`Catastrophic failure`, `Wsl/Service/E_UNEXPECTED` — no Playwright error, no test output, the
session just stopped responding and then dropped.

## Impact

This is the mechanism behind `BUG_20260909`'s open "why vite dies" question — that bug records
"Memory exhaustion during a long run is the leading candidate... but no OOM record has been
read" and leaves Part 2 unconfirmed. It is now confirmed, and the failure mode is worse than a
dead vite server: the guest kernel itself wedges, corrupts its own journal, and the VM is
forcibly torn down, taking every connection running through it down with it.

## Cause — CONFIRMED

Read from the previous boot's journal (`journalctl -b -1`) after the incident:

```
17:43:56  kernel: kworker/0:1 invoked oom-killer
17:43:56  kernel: Out of memory: Killed process 23241 (chrome) ...
17:46:40  kernel: kworker/0:1 invoked oom-killer
17:46:40  kernel: Out of memory: Killed process 23241 (chrome) ...   <- same PID again
17:49:25  kernel: kworker/0:1 invoked oom-killer
17:49:25  kernel: Out of memory: Killed process 23241 (chrome) ...   <- same PID a third time
```

The same PID being SIGKILLed three times over ~6 minutes without its memory being freed is
consistent with the process stuck in uninterruptible I/O wait — which lines up with the memory
state at the last kill: `active_anon` + `inactive_anon` ≈ 14.6 GB against the VM's 16 GB budget
(`.wslconfig`: `memory=16GB`), and **`Free swap = 0kB` of `Total swap = 4194304kB`** — the 4 GB
swap file was completely full. With swap saturated, reclaiming memory itself requires swap I/O,
so the kernel can wedge for minutes trying to kill something that won't die.

What followed, same timestamp window:

```
17:49:25  systemd-journald: File .../system.journal corrupted or uncleanly shut down
17:49:25  systemd-journald: File .../user-1000.journal corrupted or uncleanly shut down
17:49:25  Failed to connect to system scope bus via local transport
17:49:26  user@1000.service: Failed to spawn executor: Device or resource busy
17:49:26  Failed to start user@1000.service - User Manager for UID 1000
17:50:55  systemd[1]: init.scope: Stopping timed out. Killing.
17:51:58  (Hyper-V, Microsoft-Windows-Hyper-V-Worker-Admin, event 18508):
          VM "was shut down by the guest operating system"
```

Windows-side logs (System/Application event log, Hyper-V-Compute/Worker/VMMS-Admin channels)
show nothing in this window except that one Hyper-V-Worker-Admin entry — no Hyper-V fault, no
`WSLService` restart in Service Control Manager. The failure is entirely inside the guest: a
memory/swap exhaustion death spiral, not a Windows, Hyper-V, or `WSLService` bug.

Source of the pressure: the UI suite's own chromium workers. `playwright.config.js` sized
`workers` from CPU count alone (`Math.min(8, Math.ceil(os.cpus().length / 2))` — 5 workers on
this 10-core box), with no awareness of how much memory was actually free before launching that
many concurrent chromium instances.

## Fix

`playwright.config.js` — `computeWorkerCount()` now caps workers by **both** CPU count and
current available memory (`/proc/meminfo`'s `MemAvailable`, not `os.freemem()`, which reports
raw `MemFree` and undercounts reclaimable cache). Budget: 0.7 GB/worker (measured, see
Verification), 2 GB reserved for the OS/vite/anything else running, and a hard two-worker
ceiling for this WSL environment.

This throttles the *starting* worker count to what the machine can currently afford. It does
not react to memory pressure that appears after workers are already launched (Playwright has no
supported way to shrink a running worker pool) — so a machine that's fine at launch and then
gets squeezed by something else mid-run is not covered by this fix alone. It also doesn't
coordinate across independent processes: two agents launching test runs seconds apart can both
read the same "available" figure and each pick a worker count that's safe alone but not
together — see the "several agents at once" note under Still open.

## Verification

First pass measured actual chromium memory cost by summing `ps -eo rss,comm | grep chrome`
sampled every 2s during a `--workers=3` run: peak 3.28 GB across ~30-40 processes (~10-13
chromium subprocesses per worker: browser + GPU + renderer + utility + zygote), suggesting
~1.1 GB/worker. **This was wrong** — RSS is per-process and double-counts pages those
subprocesses share (Chromium's own binary text, `libGL`, `libc`), so summed RSS overstates real
physical usage by roughly however much sharing there is.

Redone with PSS (Proportional Set Size, `/proc/<pid>/smaps_rollup`'s `Pss:` field), which
divides each shared page's cost by how many processes map it — the correct measure of actual
physical memory:

```
$ npx playwright test packages/ui/test/ui/ --workers=3
# every 2s: for each chrome-related pid, sum Pss from /proc/<pid>/smaps_rollup
PEAK RSS_sum: 4196968 kB   (the old, wrong metric — 40 processes at that sample)
PEAK PSS_sum: 1803889 kB   <- actual physical memory, shared pages counted once
```

1.80 GB / 3 workers ≈ 0.6 GB/worker actual peak — about half the first-pass estimate. The app's
own production bundle is 11 MB (`packages/ui/dist`), confirming this cost is Chromium's own
per-instance overhead, not app weight. `MEM_PER_WORKER_GB = 0.7` is the PSS measurement rounded
up slightly for headroom.

Config load confirmed sane after the change:

```
$ node -e "import('./playwright.config.js').then(m => console.log('workers:', m.default.workers))"
workers: 5
$ free -g
              total  used  free  available
Mem:             15     5     9         10
```
(5 = the CPU cap; at ~10 GB available the memory cap independently computes to 5 too, so they
agree here — it only diverges once available memory drops.)

## Still open

- No mid-run downscaling: if memory pressure appears after the pool is already running, this
  fix does not respond to it.
- Several agents at once: this fix is per-process and reads memory once at its own launch. Two
  agents starting seconds apart can each read the same "available" figure and both pick a
  worker count that's safe alone but not together. Real fixes for that are cross-process:
  serialize the browser-test phase machine-wide (e.g. `flock` around the `playwright test`
  invocation), or share one long-lived browser server across agents (`playwright launch-server`,
  same idea as this config's own `webServer.reuseExistingServer: true` for vite) so the big
  per-instance cost is paid once instead of once per agent. Neither is implemented yet.
- Consider a cgroup/systemd `MemoryHigh` on the test process group as a *containment* backstop
  (soft-throttles instead of hard-killing once combined usage crosses a threshold) — separate
  from this fix, since it wouldn't reduce how many chromium instances get launched in the first
  place, and doesn't by itself solve the multi-agent race above either.
