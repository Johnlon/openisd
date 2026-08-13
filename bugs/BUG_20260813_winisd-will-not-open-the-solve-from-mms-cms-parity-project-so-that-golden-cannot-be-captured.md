# WinISD will not open the `solve-from-mms-cms` parity project, so that golden cannot be captured

**Found** 2026-08-13, capturing the nine missing WinISD parity goldens.
**Severity** one of 16 parity scenarios has no oracle. 29 rows of
`packages/winisd/test/winisd-parity.test.ts` stay RED, plus the two guard tests that count
goldens and provenance rows.
**Status** OPEN. **Left failing deliberately** — a golden is only ever WinISD's own output, and
a missing measurement is reported as missing, never substituted.

## Symptom

`python3 scripts/qo8_parity_generator.py --only solve-from-mms-cms` (winisd_research) fails on
every attempt. WinISD's process starts; its main window never becomes usable:

    attempt 1 failed: RuntimeError: agent op attach failed:
        RuntimeError: no ready window titled 'WinISD'* within 30.0s (found=True)
    attempt 2 failed: RuntimeError: no WinISD X window found (expect=(0, 0, 0, 0))

**Six attempts, three separate runs** (20:12, 20:32, 20:38 on 2026-08-13). Never once succeeded.
`found=True` on the first shape means the window exists and never reaches a ready state — the
program is hung on load, not absent.

Not a harness fault and not load-related: in the same batch, on the same wine prefix and the
same `winisd.exe` (0.7.0.0, sha256 `a7dab233…6df386ae`), the other eight scenarios captured
first-attempt in 15–23 s each, including `solve-from-q-pair`, `gap-geometry` and
`inconsistent-fs`.

## What is distinctive about this input

`packages/winisd/test/fixtures/winisd-parity/scenarios.json`, scenario `solve-from-mms-cms`:
the consistency solver in REVERSE — `Fs`, `Qes`, `Qts`, `Rms` and `Vas` are all OMITTED and
must be derived from `Mms`, `Cms`, `BL`, `Re`, `Qms` and `Sd`. It is the only scenario that
leaves `Fs` absent.

Its twin `solve-from-q-pair` — the FORWARD direction, `Qts`/`Cms`/`Mms`/`Rms`/`BL` omitted with
`Fs` present — captured cleanly at 15.4 s. So the difference between "opens" and "hangs" is
which side of the group is missing, and the absent `Fs` is the obvious suspect.

⚠ **Unverified hypothesis:** that WinISD's project loader requires `Fs` and hangs rather than
solving for it. Nothing here observed WinISD's internals — only that six loads of this file
never produced a ready window while eight loads of its siblings did. Settling it means one
probe: the same scenario with `Fs` supplied and everything else unchanged.

## Consequence for the parity suite

| | |
| --- | --- |
| goldens present | **15 of 16** |
| rows red from this cause | 29 scenario rows + `every scenario has a golden` + `provenance … covers every scenario` |

The two guard tests are doing exactly their job: they exist so a missing measurement is loud
rather than silently skipped. Neither is loosened.

## Next step, when someone picks this up

1. Author the same scenario with `Fs` present and confirm it opens — that isolates the trigger.
2. If confirmed, the reverse-solve direction is still worth an oracle: find an input shape
   WinISD will open that still leaves the reverse routes to it (e.g. omit `Vas` and `Rms` only,
   keeping `Fs`), and add it as a scenario alongside — not instead of — this one.
