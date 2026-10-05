# BUG_20261005_port-length-hand-vs-file

Status: FIXED 2026-10-05. The compat case was wrong; OpenISD's hand and file paths agree.

## Symptom
`bash scripts/compat.sh all` reported 2 of 100 cases DISAGREE: `vented port length` (1.92) and
`bp4 front port length` (1.94). Typing the port length moved the charts; writing the same `len` into
the `.wpr` and loading it moved nothing.

## Cause
There are two paths, the hand edit and the case's file edit. The hand edit sets the port length and
derives the tuning from it; the case's file edit wrote `[VentRear]`/`[VentFront] len` alone and left
`[Box] Fr`/`Ff` as they were. WinISD writes `len` as a readout and tunes from `Fr`/`Ff` on load
(Vents tab: "Vent length" is a disabled read-only box, `winisd_research/PROBE_FINDINGS.md`; debugger
fit "Map = 1/(ωb²·Cab), [VentRear] len is not used", `winisd_research/GHIDRA_FINDINGS.md`, vented and
bandpass4). The case therefore built a file WinISD never writes. OpenISD loads it as WinISD does.

A typed length saved by OpenISD writes the tuning it gives to `Fr`/`Ff`, so it loads back to the same
tuning and length (checked: worst chart difference 0).

## Steps
1. `bash scripts/compat.sh vents` before the fix: the two length rows DISAGREE.
2. Load `vented-small.wpr`, set `box.vented.vent.length_m` to 0.25, save, load: tuning 37.94 Hz and
   length 0.25 m both come back.

## Fix
- `packages/design/compat/consistency/harness.ts`: new `ReadoutConsistencyCase` for a field WinISD
  writes as a readout. Its file route is the hand-edited project saved to `.wpr` and loaded back.
- `areas/vents.ts`: the vented and bp4 front port length cases are readout cases.
- No product change. The ABC intra port's `len` stays an ordinary case: that port has no tuning, so
  its `len` is an input.

## Done
- `packages/design/test/winisd/winIsdProjectToOpenIsdProject.test.ts`, "a port length typed by hand
  vs the file's len": hand length save/load round trip (vented, bp4 front), and a lone `len` that
  contradicts `Fr` keeps `Fr`.
- `bash scripts/compat.sh all`: all cases agree.
