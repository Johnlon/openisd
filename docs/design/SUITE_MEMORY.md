# Heavy-job memory: measured costs and admission

Every heavy job (browser run, unit run, lint, typecheck, the post-land suite) states its memory cost in
[`scripts/budget.conf`](../../scripts/budget.conf) and is admitted by `scripts/budget.sh` only when that cost
fits its pool. Otherwise it waits, announced, on a blocking `flock`; no polling. F45 (16 Oct 2026) was the
failure this replaces: every job shared one 5 GB throttle, two full lints (3.3 GB each) sat above it, and the
suite's browsers timed out.

| Pool    | Draws                          | Size    | Why                                            |
|---------|--------------------------------|---------|------------------------------------------------|
| suite   | the post-land suite only       | 1400 MB | reserved first; no agent job can take it       |
| small   | typecheck, changed-file lint   | 4000 MB | start at once: one typecheck and two lints     |
| general | browser runs, unit runs, full lint | 5100 MB | wait their turn, in arrival order          |

Budget 10500 MB = 15.6 GB less 4.6 GB for the agent sessions, the desktop and the kernel (the processes outside
the slices summed to 3.9 GB of PSS on 16 Oct 2026, plus 20% and 0.5 GB).

## Measured, 16 Oct 2026

| Job                                   | Peak   |
|---------------------------------------|--------|
| browser worker (5 specs)              | 0.39 to 0.64 GB; cost used 0.70 |
| playwright runner + vite              | about 0.3 GB |
| post-land suite, 2 workers            | 1.04 GB; cost used 1.4 |
| full unit suite, 4 workers            | 2.29 GB |
| one unit file                         | 0.28 GB |
| full eslint (with or without --cache) | 3.31 GB |
| eslint over 1 and 12 changed files    | 0.51 and 0.80 GB |
| typecheck (tsc design, tsc persistence, vue-tsc ui in parallel) | 0.65 + 0.42 + 0.86 = 1.93 GB |

## Re-measuring

- `bash scripts/measure-peak.sh <label> <command…>` prints a command's peak.
- `--reporter=./scripts/test-reporters/spec-memory-playwright.mjs` writes each spec file's worker-tree peak to
  `build/spec-memory.json`.
- `scripts/land/test/budget-conf.test.sh` fails when the figures stop fitting together.
- The post-land log prints heavy.slice's `memory.events` at the start and end of each run, and
  `suite throttled: sizing bug` if `high` rose during the run: that is a figure to re-measure, not a code red.

heavy.slice (`scripts/systemd/heavy.slice`) has no `MemoryHigh` any more, only a `MemoryMax=13G` backstop above the
admitted total. Jobs started while the suite holds the browser lock also run under `nice -n 15` and `ionice -c3`
(`scripts/yield-to-suite.sh`).
