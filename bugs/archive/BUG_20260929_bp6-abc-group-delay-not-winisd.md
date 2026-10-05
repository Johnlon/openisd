# BUG_20260929_bp6-abc-group-delay-not-winisd

**Status:** RESOLVED — ABC: a WinISD calculation bug, fixed by default with an error switch
(BUG_20261005_winisd-abc-group-delay-driver-not-stepped). BP6: WinISD rounding noise, no code
change, no switch (John, 2026-10-05).

## Symptom
OpenISD's group delay for 6th-order bandpass and ABC boxes differs from WinISD's, while their
transfer function phase matches to 8e-12°. ABC is off by 7.1 ms at 1 Hz; BP6 by 0.11 ms at 4 kHz.

## Evidence
winisd_research runs/bp6-w5-base2 and abc-w5-base2 (2026-09-29) against OpenISD on WinISD's grid:

| Box | 1 Hz WinISD / OpenISD (ms) | 528 Hz WinISD / OpenISD (ms) | 12 kHz WinISD / OpenISD (ms) |
|-----|---------------------------:|-----------------------------:|-----------------------------:|
| BP6 | −38.4988 / −38.4987        | 0.0569 / 0.0407              | −0.0268 / 0.0005             |
| ABC | −40.988 / −33.888          | 0.00446 / 0.0559             | 1.5e-5 / 1.1e-4              |

Sealed/vented/BP4/PR group delay matches to ~7e-4 ms (the 1e-10 Hz step staircase,
GHIDRA_FINDINGS.md "Group delay").

## Cause
Decoded bit for bit (winisd_research commit 864d53a, `GHIDRA_FINDINGS.md` "Group delay of the
6th-order bandpass and ABC — chart byte 12 (2026-10-05)"; runs `bp6-w5-gd1`, `abc-w5-gd1`,
`abc-w5-gd2`; `scratch/gd_x87.py` replays case 12 in x87 extended and matches every H, arg and gd
value). Both boxes step f ± δ, δ = 1e-10 Hz, as every box does. They differ in H.

- **ABC** (`0x4591b0`): the box is stepped, the driver part is not:
  V = A·X·Zx(f')/(Zx(f') + B), with A, X, B at the chart frequency f;
  H = (V·Zf/(Zi+Zf)/Zcf + V/Zcr)(f')·jω(f). The group delay leaves out the driver's own phase slope
  and contradicts WinISD's own phase chart. A calculation bug.
- **BP6** (`0x5668c0`): load and driver part both at f'; `Ul = V/(Zr+Zf)`,
  H = (Ul·Zr/Zcr − Ul·Zf/Zcf)·jω(f). H equals the plotted transfer. Above ~200 Hz the two
  compliance currents nearly cancel (κ = |Ul·Zr/Zcr| / |H/jω|: 2.3 at 1 Hz, 19 at 200 Hz, 114 at
  528 Hz, 309 at 1.2 kHz, ~500 above 4 kHz), so one rounding of H moves the group delay by
  κ·2⁻⁵³/(4πδ): 0.01 ms at 528 Hz, 0.045 ms at 20 kHz. Observed: 1–3 such steps, worst 0.112 ms at
  4.0 kHz. Numerical noise only.

## Findings (2026-10-05)

| BP6 f (Hz) | WinISD (ms) | −dφ/dω, exact | OpenISD today (ms) |
|-----------:|------------:|--------------:|-------------------:|
| 1          | −38.498844  | −38.498704    | −38.498772         |
| 115.570    | 2.387140    | 2.387077      | 2.388201           |
| 528.39     | 0.056871    | 0.040653      | 0.043368           |
| 1242.41    | −0.025433   | 0.017760      | 0.034415           |
| 3996.92    | 0.034264    | 0.004314      | 0.052306           |

OpenISD differentiates in doubles with the same 1e-10 Hz step, so its BP6 group delay above ~200 Hz
is rounding noise of the same size as WinISD's, at other values. WinISD's noise cannot be copied.

## Fix
- ABC: correct by default; yellow error switch "Enable WinISD ABC group delay bug"
  (`winisdAbcGroupDelay`) reproduces WinISD. BUG_20261005_winisd-abc-group-delay-driver-not-stepped.
- BP6: no switch, no code change (John, 2026-10-05). Recorded as a WinISD accuracy issue in
  `docs/research/ACCURACY_IMPROVEMENTS.md` ("Not observable") and `docs/research/WINISD_PARITY.md` §22.

## Verification
`packages/design/test/engine/abc-group-delay-winisd.test.ts` (ABC off/on against the decoded values;
the switch leaves BP6 unchanged). Register: `docs/research/WINISD_EQUIVALENCE.md` Table 1 group
delay row.
