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
- Not matched: a box with Ql and Qa both at the lossless limit (1e6). OpenISD then uses its own
  line, `portImpedance` (tanh with loss, mouth radiation, end correction kept), not WinISD's.
  Capture `runs/vented-w5-tlports-lossless` (winisd_research 57f444e): WinISD keeps its tan form
  there too, fit 8.8e-3 (best lumped 7.7e-2). With losses the same fit is 5.1e-3. Neither is
  machine precision; T389 finds the residual.

## Done (T390, 18 Oct 2026)

- OpenISD keeps the end correction by default, so the pipe tunes at Fb (impedance minimum 38.69 Hz
  on this project; the pipe's tan() is a little heavier than the lumped mass).
- Yellow bug switch "TL port without end correction" (`winisdTlPortNoEndCorrection`) brings
  WinISD's pipe back. On, the fits above hold.
- A ≠W cue by the tickbox opens the "OpenISD and WinISD differences" entry, on desktop and phone.
- Still open (T389): the lossless case and the 0.5–0.9 % fit residual (see above).
