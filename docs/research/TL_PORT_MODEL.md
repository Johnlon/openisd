# WinISD "Use transmission line model for port simulation"

T386, 18 Oct 2026. WinISD Advanced tab checkbox; `.wpr` `[SimulatorOptions] TLPorts`.

## What it does

- Off: the port is a lump of air, reactance ω·Map.
- On: the port is a lossless pipe, reactance (ρc/S)·tan(ωL/c).
  - S = port area (π·dia²/4).
  - L = Map·S/ρ − end correction·dia: the pipe length that tunes to Fb, **without** the end
    correction.
  - The port loss Rap and the box losses Ql, Qa stay fixed resistances taken at ωb, as when off.
- Result: the port gets its own pipe resonances. The port output dips where tan → ∞ (quarter
  wave, c/4L) and peaks where tan → 0 (half wave, c/2L).
- No radiation load, no loss along the pipe (tan, not tanh).

## Which boxes and charts

| Box | Reads the flag | WinISD routine |
|---|---|---|
| Vented | yes, its port | `0x457620` |
| 4th-order bandpass | yes, front port | `0x458b40` |
| 6th-order bandpass | yes, both ports | `0x567d10` |
| ABC | yes, both ports | `0x45a0d0` |
| Sealed | no port | — |
| Passive radiator | no | — |

Every chart of those boxes changes: SPL, transfer function, impedance, excursion, port velocity,
group delay, phase.

## Evidence

- Decompile (winisd_research `re_ghidra/dumps/tlports_*.out`):
  - `0x4672f0` is the checkbox handler: stores the tick in project byte `+0x52`, then recalcs
    (`0x463e10`). `.wpr` loader `0x4538c0` reads `TLPorts` into the same byte.
  - Each box load reads that byte. Off: j·ω·Map. On: j·(ρc/S)·tan(2πf·L/c), L and S from the
    vent object (`+0x48`, `+0x10`).
  - `0x4bd850` is tan (`fld; fptan; fstp st0`).
- Fit (29 Sep, `bugs/archive/BUG_20260928_tl-port-model-not-winisd.md`): complex impedance
  2e-15, TF 1e-12, port velocity 4e-11 on `runs/vented-w5-tlports`. This fixes L as above
  (the file's `len` alone fits only to 5e-3).
- Captures on one project (W5-1138SMF, 10 L, Fb 38 Hz, Ql 7, Qa 30, Qp 15, port 5 cm, 0.369 m;
  293.15 K, 30 % RH, 101325 Pa). The two `.wpr` files differ only in `TLPorts`:
  - off: winisd_research `runs/vented-w5-tloff`
  - on: winisd_research `runs/vented-w5-tlports`

| | Off | On |
|---|---|---|
| Impedance minimum (tuning) | 39.13 Hz | 40.26 Hz |
| Impedance peaks below 120 Hz | 27.9 Hz, 60.9 Hz | 28.9 Hz, 61.2 Hz |
| Pipe quarter / half wave | none | 232 Hz / 464 Hz |
| SPL difference at 462 Hz | — | 6.3 dB |

## Finding: ticking it retunes the box

WinISD's pipe drops the end correction, so its low-frequency mass is smaller than the Fb mass
Map. Ticking the box moves the tuning up by about 1.1 Hz on this project (impedance minimum
39.13 Hz to 40.26 Hz), while the Box tab still shows Fb 38 Hz. A real port's mouth mass (the end
correction) does not disappear when you model the duct as a pipe. Recorded as
`bugs/BUG_20261018_winisd-tl-port-no-end-correction.md`.

## OpenISD

- Has it: Advanced tab, same checkbox, same default (off), saved as `TLPorts` in `.wpr`.
- Matches WinISD on vented, bandpass 4, bandpass 6 and ABC to 1e-11 dB or better
  (`WINISD_EQUIVALENCE.md`, row "Transmission-line ports").
- Code: `winisdLinePortReactance` in `packages/design/engine/boxes/port.ts`.
- Not matched: a box with Ql and Qa both at the lossless limit (1e6). OpenISD then takes its separate
  `lossless` branch (own line, see T389 below), not WinISD's form.

## Done (T390, 18 Oct 2026)

- OpenISD keeps the end correction by default, so the pipe tunes at Fb (impedance minimum 38.69 Hz
  on this project; the pipe's tan() is a little heavier than the lumped mass).
- Yellow bug switch "TL port without end correction" (`winisdTlPortNoEndCorrection`) brings
  WinISD's pipe back. On, the fits above hold.
- A ≠W cue by the tickbox opens the "OpenISD and WinISD differences" entry, on desktop and phone.
- The lossless case: see T389.

## T389: the leftover error (18 Oct 2026)

Result: the leftover is an OpenISD fault, not a WinISD difference. WinISD uses the same tan form
with or without losses. OpenISD's `lossless` branch (Ql and Qa both >= 1e6, `engine/circuit.ts`
`loss`) does not. Bug: `bugs/BUG_20261018_tl-port-lossless-branch-not-winisd-form.md`.

Setup: `runs/vented-w5-tlports-lossless` (Ql = Qa = 1e6, Qp 15, TL on) against OpenISD with the
yellow no-end-correction switch on, on WinISD's own 2087-point grid; same probe on
`runs/vented-w5-tlports` (Ql 7, Qa 30) as the control. Worst relative error per chart:

| Chart | Control (Ql 7) | Lossless as is | Lossless, losses at 999999.9999 |
|---|---:|---:|---:|
| SPL | 3e-13 | 1.4e+1 (4 Hz), 2.6e-2 (10-50 Hz), 7e-2 (200-500 Hz) | 3e-14 |
| Impedance | 3e-15 | 2.7e-1 (30-50 Hz), 1.4e-1 (50-100 Hz), 1.6e-8 (>5 kHz) | 4e-15 |
| Rear port velocity | 3e-12 | 4.8 (200-500 Hz) | 3e-12 |
| TF magnitude | 3e-11 | 1.0e+2 (100-200 Hz) | 3e-11 |

- The error is largest at the tuning and at the pipe resonances (232 Hz quarter wave), and shrinks
  above 5 kHz in impedance. The earlier 0.5-0.9 % fit figure came from the closed-form fit
  (`toys/w5_tl_port_model_check.py`); the engine itself is off by far more, see the table.
- Candidate causes, one at a time:

| Candidate | Result |
|---|---|
| End correction / pipe length | ruled out: the lossless branch ignores the switch, so on and off give identical numbers; with losses 1e-12 is reached using WinISD's length. |
| Speed of sound / air density | ruled out: control matches at 1e-15 with the same air. |
| Frequency grid / interpolation | ruled out: same grid, control matches. |
| Rounding of shown inputs | ruled out: control matches at 1e-15. |
| Port count / flare | ruled out: one round port, no flare in this project; control matches. |
| Line termination (no radiation load, tan not tanh) | ruled out: same tan form fits the lossless capture once the branch is the lossy one. |
| Branch choice (own `portImpedance` line, tanh with Qp loss, mouth radiation, vs WinISD fixed-resistance form) | proven: sending the same project through the `winisd-lossy` branch (Ql = Qa = 999999.9999, no engine change) gives SPL 3e-14, impedance 4e-15, port velocity 3e-12, TF 3e-11 (all below 0.05 %, in fact machine level). Ql = Qa = 999999 gives 9e-12 / 6e-12 / 1e-11 / 9e-9. |

- Other captures are untouched: the bp4, bp6 and ABC `tlports` captures have Ql 7 and Qa 30, so
  they never enter the `lossless` branch; their 1e-11 fits stand.
- The lossless branches of bp4, bp6 and ABC were not captured with TL on. The bp6 one is
  documented in code as "OpenISD's own simple model (not WinISD-captured)". Not tested here.
- Not tested: TL off with Ql = Qa = 1e6 (no such capture).
- Fix (done, T430 below): in WinISD the `lossless` Q limit is no model switch; every box keeps its
  fixed-resistance form at omega-b. Route Ql, Qa >= 1e6 through the `winisd-lossy` form (resistances
  vanish as Q grows) for the TL-on case, then add a lossless test to
  `tl-port-model-winisd.test.ts` from the new capture.

## T430: fix (18 Oct 2026)

- `engine/circuit.ts`: vented box, TL port model on, Ql and Qa >= 1e6 now takes the `winisd-lossy` form.
- Test: lossless case in `tl-port-model-winisd.test.ts` from `runs/vented-w5-tlports-lossless`
  (SPL, impedance, port velocity, transfer function). Before: 4 of 4 fail (TF 1 Hz -129.3 vs -120.7 dB).
  After: all pass.
- Not changed, no capture: TL off with Ql = Qa = 1e6; the bp4, bp6, ABC and passive-radiator
  lossless branches with TL on.
