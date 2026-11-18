# Number boxes: values that turn the charts to NaN, found by a sweep of every box

Status: OPEN, phase 1 (finding only; no limit or app code changed). Task T915, the input-limits sweep (`tasks/T915.yml`).
Asked by John, 18 Nov 2026 (board general chat, 20:17 UTC): "ok look make the ap robust / and include proper limits on ui",
after the Peaking 2nd order highpass with a negative peak gain turned the charts to NaN (that one is fixed separately by T913,
the change that draws no curve for a negative peak gain, ruled QO951, which reached main during this sweep; the sweep
was re-run on it).

## What was done

Every number box a person can type into (the `NumberField` definitions in `packages/design/fields/field.ts`, desktop and
phone: the driver editor, the Box tab, every vent, the box losses, the passive radiator, the Signal tab, the Advanced tab's
air, the driver count, added mass and coil temperature rise, the chart range, and every parameter of every filter type) was
set, through the same domain cell its screen binds, to: its declared min, its declared max, 0, -1, -100, 1e-9, 1e9, and
empty where the screen offers a clear. Each was tried on real WinISD 0.7 projects of the W5-1138SMF from the test fixtures
(`packages/design/test/winisd/fixtures/`: `sealed-w5-dtvc20.wpr`, `vented-w5-2.wpr`, `pr-w5-1.wpr`, `bp4-w5-1.wpr`, and for the
two-chamber boxes' own boxes `bp6-w5-1.wpr`, `abc-w5-1.wpr`). After each set the project's sweep, max curves, peaks and
impedance peak were run and every NaN, Infinity, thrown exception and call slower than 2 s recorded, with the output that
carried it. A NaN the project already had before the edit is not counted. No AI judged any case.

- Sweep: `packages/design/test/fixtures/inputLimitsSweep.ts`.
- Unit test: `packages/design/test/domain/input-limits-sweep.test.ts` (3231 tests, 135 of them `it.fails`; each breaking case is an `it.fails` naming
  this file, so a fix turns it red and it moves to a plain test).
- WinISD crash list replay: `packages/design/test/domain/winisd-crash-replay.test.ts`.
- Report (the "Generated table" below): `npx vite-node packages/design/test/domain/input-limits-sweep-report.ts`.
- Hangs: each call is timed in the process; a call that never returns is caught by the suite's idle watchdog
  (`scripts/quiet-test.sh`). None was slow; the longest whole run is 35 s for 3229 cases.

## Counts

- 152 boxes swept (97 distinct number fields; the other 15 fields feed no engine call or cannot be typed, each listed with
  its reason in `NOT_SWEPT`), 3229 cases.
- 135 cases break: 103 NaN, 32 a thrown exception. 0 Infinity, 0 slow. (Before T913 reached main: 141, the other six being
  the Peaking 2nd order highpass Gpk at -60, -1 and -100 dB on the sealed and vented projects; they now pass.)
- 22 of the 135 are values the screen stores today. The other 113 are values the screen refuses, so they reach the engine only
  by another way (a loaded file, a calculated value); the sweep did not check which of those ways exist.
- 229 further cases the app refuses with a message and nothing breaks (a blank chart that says why).
- In every NaN case the app's own after-the-fact check (`classifyFiniteIssues`/`classifyMaxFinite`, used by `appState.ts`)
  says the sweep has no finite values, so the screen shows a message; it does not say which box caused it. The 32 throws are
  the drive-level guard (below) and show no message, but the screen refuses those values first.

## The breaking cases, grouped by box

"Screen" says whether the screen stores the value today. "Limit": **plain** where no real design could use the value;
**needs John** where a limit could cut off a real design. WinISD's own entry limits are not recorded in `winisd_research`
(searched `book/`, `spec/`, `0.50a7/`, `runs/`) except where cited.

| box (as the person sees it) | value | project | symptom | cause line | proposed limit and reason | kind |
|---|---|---|---|---|---|---|
| **Air density** (Advanced tab) | 0, -1, -100 kg/m³ | sealed; vented and bandpass4 at -1 and -100 | NaN in every chart (0, -100), NaN in the transfer function and port gain (-1). Screen: stores it (the box is `allow-out-of-range`, OriginalShell.vue:629) | `packages/design/domain/project/openISDProject.ts:835-837`: the sweep is blocked only by a temperature issue; the air solver's own issue for a ρ out of range (`engine/environment/airSolver.ts:17`) does not stop the sweep | Refuse ρ ≤ 0 on the screen and block the sweep on it: air with no density is not air | plain |
| **Air pressure** (Advanced tab) | 0, -1, -100 Pa | sealed; vented and bandpass4 at -100 | NaN in every chart (0) or in the transfer function and port gain. Screen: stores it (OriginalShell.vue:625) | same, `openISDProject.ts:835-837` | Refuse pressure ≤ 0, as above | plain |
| **Sound velocity** (Advanced tab) | 0 m/s (its declared min) | sealed | NaN in every chart. Screen: stores it (OriginalShell.vue:628) | same, `openISDProject.ts:835-837`; `airSolver.ts:199` divides by c² | Refuse c ≤ 0, as above | plain |
| Air pressure, sound velocity, air density | values inside the field band but far from air (pressure 1 kPa, c 1 m/s, ρ 10 kg/m³) | | not breaking | the boxes take any finite number and show a data-quality flag instead (`allow-out-of-range`) | Whether the declared bands (pressure 1-200 kPa, c 0-1000 m/s, ρ 0-10 kg/m³) become a hard refusal. WinISD 0.7 dies at 410 K, 60 % RH, 93000 Pa (`winisd_research/book/APPENDIX_D_WINISD_CRASHES.md` D10); OpenISD sweeps that air finite (replay D10) | needs John |
| **Tuning freq (Frc)** (Box tab, 6th-order bandpass and ABC) | 0 Hz (its declared min) | bandpass6, abc | NaN in every chart. Screen: stores it (`BOX_FRC_HZ` min 0, no floor, `fields/field.ts:1267`) | `engine/boxes/Bandpass6Box.ts:77` and `engine/boxes/AbcBox.ts:95`: Mapr = 1/(ωr²·Cabr) with Fr 0 is Infinity | Frc > 0 (floor "positive", as Fb and Ffc already have): a port tuned to 0 Hz is an infinitely long port | plain |
| **Slot width / Slot height / Vent length** of the ABC box's third port (the intra port) | any width or height, in band or not; height or length emptied; diameter 0; cross area at its min | abc | NaN in every chart. Screen: stores in-band values and the empty box | `engine/boxes/AbcBox.ts:41` and `:113`: Mai = ρ·LeffIntra/SpIntra with SpIntra or LeffIntra absent; `domain/project/projectSweep.ts:279-286`: the ABC sweep blockers check the rear and front ports only, never the intra port. The intra port has no tuning, so switching it to a slot leaves the other side unsolved | Not a limit: the sweep should refuse with "enter the intra port's height" (or the domain fill it) instead of drawing NaN | plain |
| **Volume** (Box tab) | 0 | sealed, bandpass4, bandpass6, abc | NaN in every chart. Screen: refuses (min 0.0001 m³) | `domain/project/projectSweep.ts:358`: the sweep is blocked only when the volume is empty; the engine's own "Box volume (Vb) must be greater than zero" (`engine/params.ts:457`) is shown but does not stop the sweep | Keep the screen min; block the sweep on Vb ≤ 0 with the engine's message: a box has volume | plain |
| **Vent length** (Vent panel, ports 1 and 2) | -1, -100 m | vented, bandpass4, bandpass6, abc | NaN in every chart. Screen: refuses (min 0.001 m) | `domain/box/ventWindow.ts:148`: `tuningIn_hz` checks the volume but not the length, so a negative length gives a negative effective length and the tuning's square root is NaN; `engine/boxes/port.ts:44` Map = ρ·Leff/Sp | Keep the screen min; length > 0 in the domain: a port has length | plain |
| **Leakage Ql, Absorption Qa, Port Qp, Interchamber Qicl** (Box losses) | 0 | bandpass4, bandpass6, abc (not sealed, vented or PR) | NaN in every chart. Screen: refuses (min 0.1) | `engine/boxes/Bandpass4Box.ts:62-74`, `Bandpass6Box.ts:78-92`, `AbcBox.ts:96-111`: a zero Q makes a zero or infinite resistance inside a parallel combination | Keep the screen min 0.1; the engine treats Q ≤ 0 as refused. WinISD's default is Ql 10, Qa 100, Qp 100 (help file, `docs/research/WINISD_PARITY.md` §5); its own lower limit is not recorded | plain |
| **Num. of PRs** | -100 | passive radiator | NaN in every chart. Screen: refuses (min 1) | `engine/boxes/PassiveRadiatorBox.ts:21`: `P.prNum \|\| 1` lets a negative count through | Keep the screen min 1; count ≥ 1 in the engine | plain |
| **Added mass to cone** (passive radiator) | -1, -100 kg | passive radiator | NaN in every chart. Screen: refuses (min 0) | `engine/boxes/PassiveRadiatorBox.ts:25`: negative mass makes Map negative | Keep the screen min 0; mass ≥ 0 in the engine | plain |
| **Num. of drivers** | -1, -100 | sealed, vented, passive radiator, bandpass4 | NaN in every chart. Screen: refuses (min 1) | `engine/simulation/SimulationEngine.ts:468` and `:548`: `P.nDrivers \|\| 1` lets a negative count through; Sd × -1 | Keep the screen min 1; count ≥ 1 in the engine | plain |
| **Series resistance** | -100 Ω | sealed, vented, passive radiator, bandpass4 | NaN in the transfer function and port gain. Screen: refuses (min 0) | `domain/project/projectSweep.ts:103` passes Rs unchecked; only the VA path clamps it (`SimulationEngine.ts:520`) | Keep the screen min 0; Rs ≥ 0 in the engine | plain |
| **Frequency range start / end** (chart) | -1, -100 Hz | all four | NaN in every chart, including the frequency axis. Screen: refuses (min 1 Hz) | `engine/simulation/SimulationEngine.ts:495`: `P.fmin \|\| default` lets a negative start through to the log grid | Keep the screen min 1 Hz; refuse a grid below 1 Hz in the engine | plain |
| **System input power / Driver input voltage** (Signal tab) | 0, -1, -100, 1e-9 | all four | thrown RangeError at the set, no message. Screen: refuses (min 0.01 W, 0.01 V) | `domain/project/projectSignal.ts:71` and `:126`: the 10 mV floor is a throw, not a refusal with a message | Keep the screen mins; the domain refuses with a message instead of throwing | plain |
| **Gpk** (Peaking 2nd order highpass) | -60 (its min), -1, -100 dB | sealed, vented | was NaN in every chart; finite since T913 reached main (plain tests now) | `engine/filters/PeakHighpassFilterModel.ts` | Already ruled, QO951 (John, 18 Nov 2026, "Yes" to: keep the value, draw no curve, say so on screen). No new limit | ruled |

### Found by the WinISD crash list replay

| user action | OpenISD today | cause line | proposed | kind |
|---|---|---|---|---|
| D4: a driver with Vas 0, then Duplicate project | the duplicate is refused: "edited.box.sealed.Qtc.value: Invalid input: expected number, received null"; `appState.ts:464` throws | `domain/project/openISDProject.ts` `toOwprText` writes a null Qtc that the strict reader `fromOwprText` refuses (`domain/openisdSchema.ts:684`); reopening from storage uses the repairing reader and works | Not a limit: the project's own text must read back | plain |

## WinISD crash list (winisd_research/book/APPENDIX_D_WINISD_CRASHES.md), replayed

| entry | what the person does | OpenISD | test |
|---|---|---|---|
| D1 | Peaking 2nd order highpass at -6 dB, 50 Hz | finite: draws no curve for that filter (T913) | plain |
| D2 | empty the passive radiator Vas box | finite | plain |
| D3 | driver with Mms, Cms, BL, Re, Qms, Sd only | sweeps finite; max SPL and max power are unbounded with "state Pe or Xmax" (QO143, John 15 Sep 2026) | plain |
| D4 | driver with Vas 0, save, reopen | reopen from storage works; Duplicate project refuses (above) | plain + `it.fails` |
| D5 | Hc = Hg, no Vd, no Xmax | quick and finite | plain |
| D6 | driver with nothing stated, Box tab | refused with a message | plain |
| D7 | driver editor on that driver | every box reads without NaN | plain |
| D8 | empty the passive radiator box Volume | finite | plain |
| D9 | Lowpass of order 12, typed and loaded from a `.wpr` line | finite (WinISD caps the editor at 10 because it overflows) | plain |
| D10 | air 410 K, 60 % RH, 93000 Pa | finite | plain |
| D11 | driver with only Re 123 | refused with a message, nothing throws | plain |
| D12 | driver editor closed, then the Signal tab (heap corruption in WinISD) | no native heap in OpenISD; the same sequence reads finite | plain |

## Proposed limits

- plain: 14 rows above (air density, air pressure, sound velocity, Frc, intra port, volume, vent length, losses, PR count, PR
  added mass, driver count, series resistance, chart range, drive level) plus the Duplicate project fix: 15.
- needs John: 1 (whether the air boxes' declared bands become hard refusals).
- already ruled: 1 (Gpk, QO951).

## Generated table

Output of `npx vite-node packages/design/test/domain/input-limits-sweep-report.ts` on main with T913 (20:38 UTC, 18 Nov 2026).

Swept 152 boxes (97 distinct number fields), 3229 cases.
Breaking cases: 135. Refused with a message, nothing broken: 229.
By symptom (a case can have more than one): NaN 103, throw 32.
Breaking cases the screen would store: 22.

| box (as labelled) | where | value | projects | symptom | engine output | screen stores it | app says so |
|---|---|---|---|---|---|---|---|
| Volume `box.volume` | Box tab (desktop) / Box tab (phone) | 0 | sealed, bandpass4, bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Tuning freq (Frc) `box.Frc` | Box tab (desktop) / Box tab (phone) | min | bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | yes | yes |
| Vent length `vent0.length` | Vent panel, port 1 (desktop) / Enclosure tab (phone) | -1 | vented, bandpass4, bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Vent length `vent0.length` | Vent panel, port 1 (desktop) / Enclosure tab (phone) | -100 | vented, bandpass4, bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Vent length `vent1.length` | Vent panel, port 2 (desktop) / Enclosure tab (phone) | -1 | bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Vent length `vent1.length` | Vent panel, port 2 (desktop) / Enclosure tab (phone) | -100 | bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Vent diameter `vent2.diameter` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | 0 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot width `vent2.width` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | min | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | yes | yes |
| Slot width `vent2.width` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | max | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | yes | yes |
| Slot width `vent2.width` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | 0 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot width `vent2.width` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | -1 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot width `vent2.width` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | -100 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot width `vent2.width` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | 1e-9 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot width `vent2.width` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | 1e9 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot width `vent2.width` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | empty | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | yes | yes |
| Slot height `vent2.height` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | min | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | yes | yes |
| Slot height `vent2.height` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | max | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | yes | yes |
| Slot height `vent2.height` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | 0 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot height `vent2.height` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | -1 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot height `vent2.height` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | -100 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot height `vent2.height` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | 1e-9 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot height `vent2.height` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | 1e9 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Slot height `vent2.height` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | empty | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | yes | yes |
| Vent length `vent2.length` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | empty | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | yes | yes |
| Cross area `vent2.area` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | min | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Cross area `vent2.area` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | -1 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Cross area `vent2.area` | Vent panel, port 3 (desktop) / Enclosure tab (phone) | -100 | abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Leakage Ql (first chamber) `loss0.Ql` | Box losses popup (desktop) / Enclosure tab (phone) | 0 | bandpass4, bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Absorption Qa (first chamber) `loss0.Qa` | Box losses popup (desktop) / Enclosure tab (phone) | 0 | bandpass4, bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Port Qp (first chamber) `loss0.Qp` | Box losses popup (desktop) / Enclosure tab (phone) | 0 | bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Leakage Ql (second chamber) `loss1.Ql` | Box losses popup (desktop) / Enclosure tab (phone) | 0 | bandpass4, bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Absorption Qa (second chamber) `loss1.Qa` | Box losses popup (desktop) / Enclosure tab (phone) | 0 | bandpass4, bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Port Qp (second chamber) `loss1.Qp` | Box losses popup (desktop) / Enclosure tab (phone) | 0 | bandpass4, bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Interchamber Qicl `loss.Qicl` | Box losses popup (desktop) / Enclosure tab (phone) | 0 | bandpass4, bandpass6, abc | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 13 more | no | yes |
| Num. of PRs `pr.count` | Passive radiator panel and editor (desktop) / Enclosure tab (phone) | -100 | passive radiator | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Added mass to cone `pr.addedMass` | Passive radiator panel and editor (desktop) / Enclosure tab (phone) | -1 | passive radiator | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Added mass to cone `pr.addedMass` | Passive radiator panel and editor (desktop) / Enclosure tab (phone) | -100 | passive radiator | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| System input power `signal.power` | Signal tab (desktop and phone) | 0 | sealed, vented, passive radiator, bandpass4 | throw (set) | powerDrive_W 0 W drives below the 10 mV minimum voltage. | no | no |
| System input power `signal.power` | Signal tab (desktop and phone) | -1 | sealed, vented, passive radiator, bandpass4 | throw (set) | powerDrive_W -1 W drives below the 10 mV minimum voltage. | no | no |
| System input power `signal.power` | Signal tab (desktop and phone) | -100 | sealed, vented, passive radiator, bandpass4 | throw (set) | powerDrive_W -100 W drives below the 10 mV minimum voltage. | no | no |
| System input power `signal.power` | Signal tab (desktop and phone) | 1e-9 | sealed, vented, passive radiator, bandpass4 | throw (set) | powerDrive_W 1e-9 W drives below the 10 mV minimum voltage. | no | no |
| Driver input voltage (each) `signal.voltage` | Signal tab (desktop and phone) | 0 | sealed, vented, passive radiator, bandpass4 | throw (set) | driveVoltage_V 0 V is below the 10 mV minimum. | no | no |
| Driver input voltage (each) `signal.voltage` | Signal tab (desktop and phone) | -1 | sealed, vented, passive radiator, bandpass4 | throw (set) | driveVoltage_V -1 V is below the 10 mV minimum. | no | no |
| Driver input voltage (each) `signal.voltage` | Signal tab (desktop and phone) | -100 | sealed, vented, passive radiator, bandpass4 | throw (set) | driveVoltage_V -100 V is below the 10 mV minimum. | no | no |
| Driver input voltage (each) `signal.voltage` | Signal tab (desktop and phone) | 1e-9 | sealed, vented, passive radiator, bandpass4 | throw (set) | driveVoltage_V 1e-9 V is below the 10 mV minimum. | no | no |
| Series resistance `signal.Rs` | Signal tab (desktop and phone) | -100 | sealed, vented, passive radiator, bandpass4 | NaN (sweep) | sweep.tfMag, sweep.rearPortGain, sweep.prTfMag, sweep.frontPortGain | no | yes |
| Air pressure `env.pressure` | Advanced tab, air (desktop and phone) | 0 | sealed | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 8 more | yes | yes |
| Air pressure `env.pressure` | Advanced tab, air (desktop and phone) | -1 | sealed | NaN (sweep) | sweep.tfMag | yes | yes |
| Air pressure `env.pressure` | Advanced tab, air (desktop and phone) | -100 | sealed, vented, bandpass4 | NaN (sweep) | sweep.tfMag, sweep.rearPortGain, sweep.frontPortGain | yes | yes |
| Sound velocity `env.c` | Advanced tab, air (desktop and phone) | min | sealed | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 8 more | yes | yes |
| Air density `env.rho` | Advanced tab, air (desktop and phone) | min | sealed | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 8 more | yes | yes |
| Air density `env.rho` | Advanced tab, air (desktop and phone) | -1 | sealed, vented, bandpass4 | NaN (sweep) | sweep.tfMag, sweep.rearPortGain, sweep.frontPortGain | yes | yes |
| Air density `env.rho` | Advanced tab, air (desktop and phone) | -100 | sealed, vented, bandpass4 | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 11 more | yes | yes |
| Num. of drivers `project.nDrivers` | Driver panel (desktop) / Driver tab (phone) | -1 | sealed, vented, passive radiator, bandpass4 | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 12 more | no | yes |
| Num. of drivers `project.nDrivers` | Driver panel (desktop) / Driver tab (phone) | -100 | sealed, vented, passive radiator, bandpass4 | NaN (sweep), NaN (maxCurves) | sweep.H.re, sweep.H.im, sweep.spl, sweep.phase and 11 more | no | yes |
| Frequency range start `chart.fmin` | Chart range (desktop and phone) | -1 | sealed, vented, passive radiator, bandpass4 | NaN (sweep), NaN (maxCurves) | sweep.fs, sweep.H.re, sweep.H.im, sweep.spl and 17 more | no | yes |
| Frequency range start `chart.fmin` | Chart range (desktop and phone) | -100 | sealed, vented, passive radiator, bandpass4 | NaN (sweep), NaN (maxCurves) | sweep.fs, sweep.H.re, sweep.H.im, sweep.spl and 17 more | no | yes |
| Frequency range end `chart.fmax` | Chart range (desktop and phone) | -1 | sealed, vented, passive radiator, bandpass4 | NaN (sweep), NaN (maxCurves) | sweep.fs, sweep.H.re, sweep.H.im, sweep.spl and 17 more | no | yes |
| Frequency range end `chart.fmax` | Chart range (desktop and phone) | -100 | sealed, vented, passive radiator, bandpass4 | NaN (sweep), NaN (maxCurves) | sweep.fs, sweep.H.re, sweep.H.im, sweep.spl and 17 more | no | yes |
