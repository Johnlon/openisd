# BUG_20260926_winisd-driver-mode-substitutes-mms-only

**Status:** RESOLVED 2026-09-26 — the flag substitutes Mms, Rms and BL; the entered BL still feeds CLe.

## Symptom

"Use WinISD driver calculations" is supposed to make the engine simulate a driver the way
WinISD does. On a driver whose entered `Mms`, `BL` and `Rms` disagree with its own `Fs`,
`Cms`, `Qes` and `Qms`, it does not: the flag swaps in a WinISD moving mass but leaves the
entered `BL` and `Rms` in the circuit, so the damping of the simulated curve is still
OpenISD's and not WinISD's.

## Evidence

- `packages/design/domain/openisdDomain.ts:1189-1194` — the flag's whole effect is one
  substitution, `Mms = 1/((2π·Fs)²·Cms)`. Nothing touches `BL_Tm` or `Rms_kg_per_s`.
- `packages/design/engine/circuit.ts:151-153` and `:145-147` — the acoustic branch is built
  from the entered values: `Ras = Rms/Sd²`, and `ZaE = Bl²/(Sd²·Zcoil)` off `BL_terminal_Tm`.
- Measured against real WinISD 0.7.0.950 under wine, 2026-09-26 (headless), driver
  `Fs=29, Cms=0.000693, Vas=0.142, Sd=0.038, Re=6.5, Qes=0.44, Qms=3.3` with contradictory
  `Mms=0.060, BL=8.0, Rms=1.5`, all marked Entered:
  - observed in the driver editor and in the saved `.wpr`: WinISD keeps all three
    unchanged and raises no consistency warning;
  - observed in the `.wpr` as `Box.Fr` (`Vb=0.021 m³`): `Fsc = 83.8886 Hz`, which is the
    `Fs=29` lossless `80.795 Hz` plus the known QL=10 shift — not the `68.764 Hz` the
    entered `Mms` implies;
  - observed on the Box tab (`Vb=0.020 m³`): `Qtc = 1.028`, against `1.105` lossless from
    the entered `Qes`/`Qms` and `1.99`–`2.74` from `BL=8`/`Rms=1.5`.
  - probes: `winisd_research/toys/probe_entered_mms_overwrite.py`,
    `winisd_research/toys/probe_sim_uses_which_mms.py`; artifacts in
    `winisd_research/runs/entered_mms_overwrite/`; write-up in
    `winisd_research/PROBE_FINDINGS.md`.

## Cause

WinISD's simulation is parameterised by `Fs`, `Vas`, `Qes`, `Qms`, `Sd` and `Re` — its
equivalent circuit (`docs/winisd_helpfiles/help/aboutequivalentcircuits.html`:
`Lmas = 1/((2π·Fs)²·Ccas)`, `Rae = 1/(2π·Fs·Qes·Ccas)`) names neither `BL` nor `Rms`.
OpenISD's circuit is parameterised by `Mms`, `Cms`, `Rms` and `BL`. The two agree exactly
on a self-consistent driver and diverge on any record where the stored values disagree.
The compatibility flag closes one of the three gaps.

## Fix

In `driverSolverParamsOf`, when `useWinisdDriverModel` is set, substitute the whole WinISD
set rather than `Mms` alone:

    Mms = 1/((2π·Fs)²·Cms)
    Rms = 2π·Fs·Mms/Qms
    BL  = √(2π·Fs·Mms·Re/Qes)

Each substitution applies only where its inputs are present and positive, as the existing
`Mms` one does. `Re` here is the per-coil `Re` the rest of `driverSolverParamsOf` already
uses, so the terminal `BL` keeps coming from `engine.terminalBL_Tm`.

## Scope of the substitution

The derived BL goes into the motor term only. WinISD's `CLe = S_d^2 L_e/BL^2` reads the ENTERED
BL (`fr_45e090` at 0x45e3ab, `winisd_research/GHIDRA_FINDINGS.md`), which is what makes the
W5-1138SMF's inductance roll-off deeper than a consistent driver's. `CircuitQuantities` therefore
carries both: `BL_terminal_Tm`, the motor term's BL, which this flag replaces, and
`BL_entered_Tm`, the stated one, which `winisdLeScale` divides by. Before this change the two
were always equal and `winisdLeScale` read `BL_terminal_Tm`.

## Verification

- A unit test over the probe's driver: with the flag set, the sealed sweep's resonance and
  Q match the WinISD-parameterised set, and with it clear they match the entered set.
- Golden fixtures must not move: every golden driver is self-consistent, so all three
  substitutions are identities there. Regenerate and diff to confirm.

Done 2026-09-26: `packages/design/test/domain/winisdDriverModel.test.ts` — with the flag set, the
probe's inconsistent driver sweeps identically to the consistent driver its Fs/Cms/Qes/Qms/Re
imply; with it clear the two differ; a self-consistent driver is unmoved by the flag. The W5
`winisdGyrator` case in `packages/design/test/engine/circuit.test.ts` still matches the traced
WinISD roll-off. Whole design suite: 2043 passed.

## Cms from Vas, and the flag's default

Raised by calc-bug 2026-09-26: WinISD takes `Cms` from `Vas`, worth 0.40 dB of passband SPL and a
0.9 Hz resonance shift on the W5 (debugger capture, `winisd_research` 4d818e2). Settled by the
README goal — by default OpenISD behaves 100% like WinISD — so `Cms = Vas/(ρ·c²·Sd²)` joined the
substitution set, ahead of the other three, which now derive off it. The same goal makes the flag
itself default ON; a project that does not state it reads as on.
