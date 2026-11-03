# SPEC: Crossover "System" window

Task T613. Status: PROPOSAL (plan, not built). John, 3 Nov 2026: land as a plan/proposal. No app code until John approves section 5 (new file type).
Authority: `ui-gallery/QO307/PLAN.md` (http://lap:8000/winisd/ui-gallery/QO307/PLAN.md?html).
This spec adds detail; it does not contradict the plan. Where the plan is open, section 9 says so.

Reading guide: tables over prose; one requirement per line; section 9 is the list of things we
do not yet know.

---

## 1. Purpose and audience

OpenISD today models ONE driver in ONE box (low-frequency lumped model, valid to a few hundred Hz).
The System window turns "one bass box" into "a loudspeaker": several ways summed into one response.

| Who it is for | What they get |
|---|---|
| WinISD users (sub, woofer, PR builders) | same numbers, any device, WinISD bugs fixed |
| DIY first 2-way / 3-way builders with FRD/ZMA or REW files | see the sum before buying parts |
| Car and home-theatre sub builders | box size, tuning, excursion, port speed, max SPL, now inside a system |
| Phone and tablet users | nothing else in this space runs on a phone |
| DSP-amp owners (miniDSP, Hypex, plate amps) | a crossover exported as biquads |
| Teachers and learners | WinISD-vs-OpenISD cues show what the maths does |

| Not for (out of scope) | Why |
|---|---|
| Off-axis, directivity, baffle diffraction, room response, CTA-2034 | VituixCAD's ground |
| Taking measurements | REW / ARTA; we only read files |
| Horns, TL, tapped horns beyond WinISD | separate later question |
| Passive optimisers at XSim/VituixCAD level in release 1 | a simple one comes later |
| Driver makers, Klippel, FEM | not our users |

Reference tools: VituixCAD (reference), XSim (first-build scope). Both stay references, not code.
Our edge over XSim: the bass way comes from the box simulation (T/S, port, excursion limit), so
port roll-off, excursion and port speed are inside the sum.

---

## 1a. Use cases, in priority order

Things a human wants to do with the tool. Each: person, has, does, gets, phase.

| # | Use case | Detail | Phase |
|---|---|---|---|
| 1 | Sub builder (today's WinISD user) | Has T/S parameters. Enters one driver and one box. Gets box and port numbers. Already delivered; the System window must not make it harder. | Delivered |
| 2 | DSP two-way | Has a box-way woofer (existing project) and a tweeter FRD/ZMA file. Uses each way's Filters tab, picks the crossover frequency. Gets summed SPL and phase, and exports biquads for a miniDSP or plate amp. | 1-2 |
| 3 | DSP three-way with a mid file | Has woofer project, mid file and tweeter file. Sets per-way delay to align acoustic centres. Gets the summed SPL and phase. | 1-2 |
| 4 | Sub plus satellites | Has a sub box way and a measured full-range file. Sets low-pass and high-pass to meet at 80 Hz. Gets the sum, with sub excursion inside it. | 1-2 |
| 5 | Measured-only check | Has two FRD/ZMA files, no box. Adds both as ways. Gets sum and system impedance, as XSim users do today. | 1-2 |
| 6 | Passive two-way from a target | Has a DSP design as the target. Synthesises starting coils and caps, adds a Zobel, steps parts through E12/E24. Gets the real sum against the measured impedance. | 3 |
| 7 | Passive network from scratch | Draws coils, caps and resistors on a schematic. Gets the sum, plus power and current in each part. | 3 |
| 8 | Mid in a sub-enclosure | Has a mid file way. Adds an optional sealed-box low end. Gets the mid's real low roll-off in the sum. | 4 |
| 9 | Learner | Has the same drivers in DSP and passive systems. Compares both results and reads the difference cues. Gets to see what the maths does. | 4 |

---

## 2. Concepts

| Term | Meaning |
|---|---|
| System | an ordered list of 2 or more ways, one kind, one amplifier source, one name |
| Way | one driver path: a box way or a file way, plus delay, polarity, gain, mute |
| Box way | an existing OpenISD project (driver + box + filter chain); response and impedance come from its sweep |
| File way | an imported FRD (response) and optional ZMA (impedance); no box model |
| Kind | `dsp` or `passive`, chosen when the System is made, shown in its title |
| Delay | per way, entered in mm or ms (mm = path length at the speed of sound in the project's air) |
| Polarity | normal or inverted (a sign of -1 on the way's term) |
| Gain | per-way trim in dB (linear factor 10^(dB/20)) |
| Mute | removes the way from the sum, charts keep its row greyed |

### 2.1 Kind is a sum type

| Kind | Amplifier | Crossover | Way's Filters tab |
|---|---|---|---|
| DSP | one channel per way | each way's existing filter chain | on |
| Passive | one amp for all ways | R/L/C network between amp and drivers | off (greyed) |

Sum, charts and file are the same for both kinds. Release 1 builds DSP. Passive is phase 3.
Whether the kinds may mix in one System is open (section 9, item 2). Until settled: they do not mix.

### 2.2 What a way carries

| Field | Box way | File way |
|---|---|---|
| Response source | project sweep, complex pressure `H` | FRD (dB, degrees) |
| Impedance source | project sweep, `zmag`/`zph` | ZMA (ohm, degrees), else 8 ohm resistive (XSim default) |
| Filters | the project's own chain | none (DSP file ways take a chain later; open, item 4) |
| Delay, polarity, gain, mute | yes | yes |
| Minimum phase from magnitude | n/a | optional flag, with slopes |

---

## 3. Functional requirements

Shape: "The <Subject> MUST <visible behaviour> when <condition>" (`docs/TASK_LIST_FORMAT.md`).
Ids are for tracing only. Phase column: P1 design engine, P2 UI, P3 passive, P4 later.

### 3.1 System list and creation

| Id | Phase | Requirement |
|---|---|---|
| S1 | P2 | The Project list MUST show a "System" row above the projects when at least one System exists. |
| S2 | P2 | The New System dialog MUST ask for a name and a kind (DSP or Passive) when the New System button is pressed. |
| S3 | P2 | The System title MUST show its kind when the System is open. |
| S4 | P2 | The System window MUST open on the Ways tab when a System row is chosen. |
| S5 | P2 | The Project list MUST tell the user which projects are used by a System when a project row is shown. |

### 3.2 Ways tab

| Id | Phase | Requirement |
|---|---|---|
| W1 | P2 | The Ways list MUST show one row per way with name, type (Box or File), delay, polarity, gain and mute when the System opens. |
| W2 | P2 | The Add way picker MUST list the user's projects and an "Import measurement" entry when the Add way button is pressed. |
| W3 | P2 | The Ways list MUST add a box way row when a project is chosen in the Add way picker. |
| W4 | P2 | The Import dialog MUST accept an FRD file and an optional ZMA file when "Import measurement" is chosen. |
| W5 | P2 | The Import dialog MUST name the line and reason of the first unreadable row when a file cannot be parsed. |
| W6 | P2 | The Ways list MUST add a file way row when the import succeeds. |
| W7 | P2 | The delay field MUST accept mm or ms and show the other unit beside it when a number is typed. |
| W8 | P2 | The polarity switch MUST invert that way's curve on the Charts tab when pressed. |
| W9 | P2 | The Mute switch MUST remove that way from the summed curves when pressed, except the way's own curve stays drawn greyed. |
| W10 | P2 | The Ways list MUST ask for confirmation naming the way when Remove is pressed. |
| W11 | P2 | The Open project button on a box way row MUST open that project in the normal project view when pressed. |
| W12 | P2 | The System MUST refuse to be shown with fewer than 2 ways: the Charts tab MUST say "Add a second way" when only one way exists. |
| W13 | P2 | The way row MUST show a warning chip when the way's data does not cover the sum's frequency range (section 4.6). |
| W14 | P2 | The Ways list MUST show the way's embedded project as a copy and say so (embedded, not linked) when a box way is added. |

### 3.3 Network tab, DSP kind

| Id | Phase | Requirement |
|---|---|---|
| N1 | P2 | The Network tab MUST list each way with its existing filter chain, same editor as the project Filters tab, when the System kind is DSP. |
| N2 | P2 | The Network tab MUST show a one-line chain summary per way (for example "LR4 high-pass 2.5 kHz") when the way's chain is collapsed. |
| N3 | P2 | A change in a way's chain MUST redraw the Charts tab sum when the edit is committed. |
| N4 | P2 | The Network tab MUST say a file way has no filter chain yet when a file way is listed. |
| N5 | P4 | The Export button MUST write each way's chain as biquads (format open, item 14) when pressed. |

### 3.4 Network tab, passive kind (phase 3, marked as such)

| Id | Phase | Requirement |
|---|---|---|
| P1 | P3 | The Network tab MUST show a schematic with the amplifier, the parts and one driver symbol per way when the kind is Passive. |
| P2 | P3 | The schematic MUST add a coil, cap or resistor when the part is chosen from the palette and placed. |
| P3 | P3 | The part panel MUST show value, DCR (coil) or ESR (cap), and power rating when a part is selected. |
| P4 | P3 | The Up/Down arrow keys MUST step a selected part's value to the next E12 or E24 value when pressed. |
| P5 | P3 | The Short/Open switch on a part MUST replace it with a wire or a gap on the Charts tab when pressed. |
| P6 | P3 | The Helper menu MUST insert a Zobel, L-pad, notch or 2nd-order filter block when chosen. |
| P7 | P3 | The Charts tab MUST draw each part's power against its rating when the Part power chart is chosen. |
| P8 | P3 | The Network tab MUST show a plain-words error naming the loop or node when the network has no solution (floating node, no path to ground). |
| P9 | P3 | The Filters tab of every way in a Passive System MUST be greyed with a note when a project is opened from a Passive System. |

### 3.5 Charts tab

| Id | Phase | Requirement |
|---|---|---|
| C1 | P1/P2 | The summed SPL chart MUST draw the sum of all unmuted ways plus each way's own curve when the Charts tab opens. |
| C2 | P1/P2 | The per-way SPL chart MUST draw one curve per way in the way's colour, muted ways grey. |
| C3 | P1/P2 | The summed phase chart MUST draw the phase of the sum (degrees, unwrapped) when chosen. |
| C4 | P1/P2 | The system impedance chart MUST draw magnitude and phase seen by the amplifier when chosen (DSP kind: one curve per channel; passive kind: one curve for the network). |
| C5 | P1/P2 | The system group delay chart MUST draw the sum's group delay in ms when chosen. |
| C6 | P3 | The part power chart MUST draw power per part (passive kind). |
| C7 | P2 | The chart menu MUST list only the charts valid for the System's kind. |
| C8 | P2 | Every chart MUST use the existing axis, zoom and cursor of the project charts, with cursor readout of each curve, when the chart is shown. |
| C9 | P2 | The chart's frequency range MUST be 20 Hz to 20 kHz by default and follow the user's chart range options. |
| C10 | P2 | A per-way "difference from WinISD" cue MUST appear by a box way's curve when the way's response differs from its project chart (section 4.3 never should, so this guards a bug). |

### 3.6 Amplifier source

| Id | Phase | Requirement |
|---|---|---|
| A1 | P2 | The Signal tab of the System MUST offer the same drive entry as a project (volts or watts into the rated load) when the System opens. |
| A2 | P2 | For the DSP kind the Signal tab MUST show one drive level per way, default "all ways the same", when the kind is DSP. |
| A3 | P2 | For the Passive kind the Signal tab MUST show one drive level for the amplifier, with the network splitting it, when the kind is Passive. |
| A4 | P2 | The Signal tab MUST state the reference (what 0 dB means: 2.83 V or the entered level, at 1 m) beside the chart (section 9, item 6). |
| A5 | P2 | Each way's excursion, max SPL and port speed MUST remain shown in the Ways tab for a box way, at the voltage that way receives, when the System is open. |

### 3.7 Stepping, save, load

| Id | Phase | Requirement |
|---|---|---|
| E1 | P3 | A part value field MUST step through E12 when the arrow keys are pressed and series E12 is chosen; E24 likewise. |
| E2 | P3 | The Options dialog MUST offer E12, E24 and "free" as the stepping series on both skins. |
| F1 | P1/P2 | The Save button MUST write a `.owsy` file that reloads to the same System when pressed. |
| F2 | P2 | The Open command MUST open a `.owsy` file as a System when chosen. |
| F3 | P2 | The Open command MUST say in plain words why a `.owsy` file was refused (wrong version, damaged field) when it cannot be read. |
| F4 | P2 | The Save command MUST show a popup "Saved <name>.owsy" when it completes (every button shows a visible result: `.claude/rules/general.md` rule 4). |
| F5 | P2 | The System MUST autosave to browser storage like projects and MUST survive a page refresh. |
| F6 | P2 | The Open command MUST accept a `.owsy` made by an older build and upgrade it (migration policy, 5.4). |

### 3.8 Both skins

| Id | Phase | Requirement |
|---|---|---|
| K1 | P2 | The phone skin MUST offer every System function the desktop skin offers (rule: both skins, same system options). |
| K2 | P2 | The phone bottom bar MUST carry a System button that opens the Systems group when pressed. |
| K3 | P2 | The System window MUST show no clipped control and no unwanted scrollbar at phone width (374 x 705 CSS px) and at desktop sizes. |
| K4 | P2 | Option rows (stepping series, units, colours) MUST come from one list in the design package that both skins read. |

---

## 4. Maths

All maths lives in `packages/design`. The UI calls it and formats results via `packages/design/fields/format.ts`.
Reused: `packages/design/engine/complex.ts` (`cx cAdd cSub cMul cDiv cInv cAbs cArg cScale cPar`),
`SweepResult` in `packages/design/engine/types.ts`, `groupDelayAtMs` in `engine/simulation/SimulationEngine.ts`.

### 4.1 The complex sum with delay and polarity

For way `w`, frequency `f` (Hz):

```
P_w(f) = m_w * s_w * g_w * H_w(f) * exp(-j * 2*pi * f * tau_w)
P(f)   = sum over w of P_w(f)
SPL(f) = 20*log10(|P(f)|)  re. the chart reference (4.1.1)
phase(f) = arg(P(f))   (unwrapped for display)
```

| Symbol | Meaning |
|---|---|
| m_w | 1 if unmuted, else 0 |
| s_w | +1 normal, -1 inverted |
| g_w | 10^(gain_dB / 20) |
| H_w(f) | the way's complex pressure at the reference point, including its filter chain (box way: `SweepResult.H`; file way: FRD) |
| tau_w | delay in seconds (mm / c, or ms / 1000) |

XSim does the same (DECOMPILE_NOTES 1): complex rectangular sum, delay as a phase `-360*f*(master+driver)` degrees, gain linear.
Difference by choice: XSim implements polarity by swapping driver terminals in the circuit. For the DSP kind the circuit does not exist, so polarity is the sign `s_w`. For the passive kind, polarity stays a terminal swap in the netlist (the sign is applied to the driver voltage, so the load seen by the network is unchanged). Same result for the sum.

#### 4.1.1 Reference level

H_w for a box way has the project's drive baked in (power or volts into Re). The System keeps that: each way's term is "SPL this way makes at 1 m at the drive it gets". XSim normalises to 2.83 V (1/sqrt(8) factor). Open, item 6: pick one reference and show it on the chart.

#### 4.1.2 Master delay

The System has one master delay (default 0) added to every `tau_w`; it moves the whole sum in phase and does not change magnitude. Offered so the phase chart can be aligned to a measurement (XSim has the same).

### 4.2 FRD and ZMA parsing and interpolation

| Step | XSim (decompile) | OpenISD choice | Reason |
|---|---|---|---|
| Columns | freq, dB, degrees (FRD); freq, ohm, degrees (ZMA) | same; accept tab, space, comma; skip `*` and `#` comment lines (REW, ARTA headers) | real files vary |
| Convert | dB to linear, polar to rect | same | linear sum needs rect |
| Interpolate | re and im separately, linear-Hz x-axis, monotone cubic Hermite (Fritsch-Butland style) | re and im separately on log-f, monotone cubic Hermite; golden-test against XSim on its linear-Hz grid points | log-f is correct for audio; XSim's linear axis is a simplification. Tested to a stated tolerance (open, item 15) |
| Phase unwrap | none | none before interpolation; interpolate rect, so no wrap error arises | same as XSim |
| Below first point | pad 4 slots: -12 dB at f1/2, -36 dB at f1/4, phase -90 | same padding, written as named constants in the engine | matches XSim; a file way with a sealed-box low end replaces it later (item 5) |
| Above last point | linear extrapolation of re and im from the end segment | hold level and roll off at the user slope (default 42 dB/oct, as XSim's Hilbert upper slope) | linear extrapolation of re/im can swing in phase; roll-off is safer. Flagged as a deliberate difference |
| ZMA absent | 1/8 S (8 ohm resistive) | same | matches XSim |
| Output | a grid of N points | the System grid (4.6) | one grid for all ways |

Errors: a row with non-numeric or non-increasing frequency is a typed parse failure naming the line.

### 4.3 How a box way comes from the existing sweep

| Need | Source | Note |
|---|---|---|
| Complex pressure H_w(f) | `SweepResult.H` (Complex[] per frequency in `SweepResult.fs`) | check whether the filter chain is already inside `H` (item 7) |
| Magnitude cross-check | `SweepResult.spl` | the unit test asserts `20*log10(cAbs(H))` equals `spl` within 1e-9 dB |
| Impedance | `zmag`, `zph` (degrees; convert to Complex) | 1 driver; series/parallel wiring already in `voiceCoilWiring.ts` |
| Group delay | `gd` (ms) | for the sum, recomputed from P(f) with `groupDelayAtMs` |
| Excursion, port speed, max SPL | `exc`, `pv`, ... | shown per way, not summed |
| Range | the project's sweep range | the way is interpolated onto the System grid; outside its range the way is flagged (W13) |

The box way MUST be computed by the existing engine, not re-implemented. The System asks `SimulationEngine` for a sweep over the System grid frequencies (injected, section 7).

### 4.4 Minimum phase from magnitude (Hilbert via FFT)

Used for a file way given magnitude only (an FRD with no phase, or "Phase from Hilbert" ticked).

```
1. Resample ln|H| onto a uniform grid f_k = k * df, k = 0..N-1, N = 131072
2. x[k] = ln|H_k|;  mirror x[2N-k] = x[k]   (even sequence, length 2N = 262144)
3. X = FFT(x)                                 (real, even)
4. causal fold: for k=1..N-1  X[k] *= 2;  X[2N-k] = 0;  X[0], X[N] unchanged
5. Y = IFFT(X) (complex);  ln|H| + j*phi = Y  =>  phi_k = Im(Y_k)   (radians)
6. unwrap, convert to degrees, resample to the System grid
```

| Choice | XSim | OpenISD |
|---|---|---|
| Grid | 0 to 192 kHz, df = 1.46484375 Hz, N = 131072 | same constants (golden-comparable) |
| Extension below the data | user slope (default 24 dB/oct below 100 Hz) | same defaults, editable |
| Extension above the data | user slope (default 42 dB/oct above 16 kHz) | same defaults, editable |
| Step to 96 kHz | x1.01 steps | not needed; resample directly |
| Phase sign | not verified statically | settled by experiment (section 9, item 1); until then asserted only by comparison with a known minimum-phase analytic filter |

Self-check (unit test): the minimum phase of a 2nd-order Butterworth low-pass magnitude equals the analytic phase of that filter within a stated tolerance.

### 4.5 Passive ladder solve (phase 3)

Nodal analysis, one complex linear solve per frequency (XSim: sparse complex MNA; DECOMPILE_NOTES 4, 5).

Part impedance:

| Part | Z(w), w = 2*pi*f | XSim detail |
|---|---|---|
| Resistor | R | |
| Inductor | DCR + j*w*L | DCR is the part's ESR field |
| Capacitor | ESR - j/(w*C) | |
| Short | Y = 1e6 S | XSim constant |
| Open | Y = 1e-6 S | XSim constant |
| Way (load) | the way's complex impedance Z_w(f) (box way: zmag/zph; file way: ZMA) | stamped as Y_w = 1/Z_w |

Stamp: for a part between nodes a, b with admittance Y = 1/Z: `M[a][a] += Y; M[b][b] += Y; M[a][b] -= Y; M[b][a] -= Y`. Source: ideal voltage source of 1 V (or the drive level) between amp node and ground, as an extra row. Solve `M v = i`. Read node voltages.

| Output | How |
|---|---|
| Voltage across way w | `V_w = v[a_w] - v[b_w]` (a polarity swap exchanges a_w and b_w) |
| Way pressure term | `P_w = V_w * Hsens_w(f)` where `Hsens_w` is the way's pressure per volt (box way: `H / V_drive` with the project's drive; file way: FRD, taken as per 2.83 V) |
| System impedance | `Z_sys = V_source / I_source` |
| Part power | `|I_part|^2 * Re(Z_part)` (current from node voltages) |

Solver: dense complex Gaussian elimination with partial pivoting (systems are tens of nodes; no sparse library needed). Singular matrix returns a typed error naming the floating node (P8).

### 4.6 Frequency grid

| Item | Choice | Reason |
|---|---|---|
| Spacing | geometric (log) | XSim does the same |
| Range | 1 Hz to 100 kHz is XSim; we choose 5 Hz to 40 kHz | covers charts (20 Hz to 20 kHz) with margin; fewer points |
| Points | 769 points over 5 Hz to 40 kHz (about 64 per octave) | XSim default count; golden compare keeps XSim's 1 Hz to 100 kHz in a test-only grid |
| Source | one `SystemGrid` value passed to every way | all curves share it |
| Box way outside its sweep range | flagged (W13) and extended by the box model's own asymptote only if the engine provides it; else hold-and-roll-off | item 8 |

### 4.7 Group delay of the sum

`gd(f) = -d(phase)/d(omega)` from P(f), using the existing `groupDelayAtMs` (one definition shared with the project charts, `SimulationEngine.ts`). Not averaged across ways.

---

## 5. Data model and file

### 5.1 NEW FILE TYPE: needs John's approval first

This adds a persisted data shape: the `.owsy` System file. Hard rule: no data-model change without John.

| Decision John must make | Default proposed |
|---|---|
| Add the `.owsy` file type | yes; `.owpr` untouched |
| Embed ways' `.owpr` text inside the `.owsy` | yes (as WinISD `.wpr` embeds `.wdr`) |
| Version field from day one | yes, `schema: 1` |

No code, schema, repo or UI is written until this is answered on the board.

### 5.2 Domain types (TypeScript-shaped, in `packages/design/domain/system/`)

```ts
// Branded ids: validated once at construction.
type SystemId = string & { readonly __brand: 'SystemId' };
type WayId    = string & { readonly __brand: 'WayId' };

type Millimetres = number & { readonly __brand: 'Millimetres' };
type Seconds     = number & { readonly __brand: 'Seconds' };
type Decibels    = number & { readonly __brand: 'Decibels' };
type Polarity    = 'normal' | 'inverted';

// Delay is a sum type: the unit the user chose is kept, no optional bag.
type Delay =
  | { readonly unit: 'mm'; readonly mm: Millimetres }
  | { readonly unit: 'ms'; readonly s: Seconds };

interface WayCommon {
  readonly id: WayId;
  readonly name: string;
  readonly delay: Delay;
  readonly polarity: Polarity;
  readonly gain: Decibels;
  readonly muted: boolean;
}

type Way =
  | (WayCommon & { readonly type: 'box';  readonly owprText: string })   // embedded project
  | (WayCommon & { readonly type: 'file'; readonly frd: FrdData; readonly zma: ZmaData | NoZma;
                   readonly phase: PhaseSource });

type PhaseSource =
  | { readonly kind: 'file' }
  | { readonly kind: 'minimum'; readonly lowSlopeDbPerOct: number; readonly highSlopeDbPerOct: number };

type SystemKind =
  | { readonly kind: 'dsp' }                        // ways keep their filter chains
  | { readonly kind: 'passive'; readonly network: Network };   // phase 3

type Network = { readonly parts: readonly Part[]; readonly wires: readonly Wire[]; ... };
type Part =
  | { readonly type: 'resistor';  readonly ohms: number; readonly ratingW: number }
  | { readonly type: 'inductor';  readonly henries: number; readonly dcrOhms: number; readonly ratingW: number }
  | { readonly type: 'capacitor'; readonly farads: number;  readonly esrOhms: number; readonly ratingV: number };

interface System {
  readonly id: SystemId;
  readonly name: string;
  readonly kind: SystemKind;
  readonly ways: readonly Way[];            // length >= 2 to chart, >= 1 stored
  readonly masterDelay: Delay;
  readonly drive: SystemDrive;              // section 3.6
}
```

| Rule | How it is met |
|---|---|
| No optional-field bags | `kind`, `type`, `Delay`, `PhaseSource` are discriminated unions |
| Branded primitives | `SystemId`, `WayId`, units |
| Exhaustive matches | `switch` on `type`/`kind` with `never` check; compiler fails on a new variant |
| Parse at the boundary | `.owsy` text -> zod -> domain; nothing untyped inside |
| No casts, no `any` | architecture tests `architecture-no-casts.test.ts` already enforce |
| Ownership | one `SystemProject` facade (like `OpenISDProject`) holds the live state; the record layers `saved`, `edited` follow `docs/design/STATE_MODEL.md` (no what-if layer in release 1; open, item 17) |

### 5.3 The `.owsy` file

| Aspect | Spec |
|---|---|
| Format | JSON text, strict zod schema (`z.strictObject`, as `domain/openisdSchema.ts`) |
| Top level | `{ schema: 1, system: { id, name, kind, masterDelay, drive, ways: [...] } }` |
| Box way | carries the way's complete `.owpr` text in `owprText`; no link back to the source project |
| File way | carries FRD rows as arrays `[hz, db, deg]` and ZMA rows `[hz, ohm, deg]`; original file names as labels |
| Size | measured data embedded (XSim does the same); dedupe and compaction open (item 11) |
| Schema location | `packages/design/domain/system/owsySchema.ts`, private to the domain like `openisdSchema.ts`; a typed `SystemJson` parse function is the only public surface |
| Persistence | `SystemRepo` in `packages/persistence/src/repos/systemRepo.ts`, taking a `KeyValueStorage`; file open/save through `FileStorage` (naming: `docs/design/PERSISTENCE_NAMING_AND_PLACEMENT.md`) |
| Extension and MIME | `.owsy`, plain text |

### 5.4 Migration policy

| Rule | Detail |
|---|---|
| Version | integer `schema`; every stored `.owsy` carries it |
| Upgrade | text-to-text step per version, like `packages/persistence/src/repos/projectSchemaUpgrade.ts`; one validation boundary after |
| Newer than the build | refused with "made by a newer OpenISD", never silently read |
| Embedded `.owpr` | upgraded by the existing project upgrade path when the way is loaded |
| Backups | before any destructive write, the existing storage backup applies (`storageBackup.ts`) |
| Tests | each schema version keeps a frozen fixture file; the reader test loads all |

---

## 6. UI

Mocks (option A, recommended): `ui-gallery/QO307/mocks/` — `system-window.html` (live), `A-desktop.png`, `A-phone.png`, `today-desktop.png`, `today-phone.png`.
Index: http://lap:8000/winisd/ui-gallery/QO307/index.md?html . Mock B (XO tab in a project) and C (mode switch) are rejected by the plan; they are not built.
Mocks are made by agy (house rule); this spec does not ask for new ones until John approves the layout.

Both skins ship in the same task. The phone layout is designed and checked first for the DSP kind; the desktop layout first for the passive schematic (John, 29 Oct).

### 6.1 Desktop skin

| Part | Content |
|---|---|
| Project list | "System" row above projects (S1) |
| System window | tabs Ways / Network / Charts; Signal as a panel of the Ways tab (A1-A4) |
| Ways tab | table of ways (W1), Add way, Import, per-way inline delay/polarity/gain/mute |
| Network tab | DSP: per-way chain editors (N1); passive: schematic canvas + part panel (P1-P5) |
| Charts tab | chart menu (C7), chart, cursor readout, legend with way colours |

### 6.2 Phone skin

| Part | Content |
|---|---|
| Entry | bottom bar System button (K2); Systems group above projects in the project menu |
| Pages | Ways, Network, Charts as bottom-bar style pages inside the System, same order |
| Ways page | card per way (not a wide table); delay/polarity/gain/mute on the card |
| Network page DSP | one expandable section per way |
| Network page passive | schematic open question (item 13); fallback is a list of parts in series order with a read-only mini-diagram |

### 6.3 Rules for both

| Rule | Source |
|---|---|
| Both skins offer the same options, rows from one list in `packages/design` | `ui.md`-adjacent standing rule; K4 |
| `.vue` files are template + wiring only; one `*-hooks.ts` per component, injectable factory | `.claude/rules/ui.md` |
| UI does no maths, no `.toFixed(`, no constants | `.claude/rules/ui.md`; use `fields/format.ts`, `chart/axis.ts` |
| Delay and gain entry use the existing field API and spinner step (`fields/spinnerStep.ts`, `fields/field.ts`) | `packages/design/fields` |
| Dialogs never resize for a workflow; no clipped controls | house rules; K3 |
| Every button shows a visible result | `.claude/rules/general.md` |
| Colours of way curves come from a design-package list (new rows in the chart colour rows) | `chart/chartColorRows.ts` |

---

## 7. Architecture

### 7.1 Package ownership

| Package | Owns |
|---|---|
| `packages/design` | all maths and domain: grid, FRD/ZMA parse, interpolation, min-phase, sum, ladder solve, `System`/`Way` types, `.owsy` schema, System chart definitions, E-series table, format helpers |
| `packages/persistence` | `SystemRepo` (storage of `.owsy` text), import file reading through `FileStorage` |
| `packages/ui` | logic state (`systemState.ts`), hooks (`System*-hooks.ts`), Vue components for both skins |

Layer direction as today: ui -> persistence/design; design imports nothing from ui (`architecture-engine-has-no-ui-dependency.test.ts`).

### 7.2 Modules in `packages/design` (one sentence each, no "and")

| Module | One job |
|---|---|
| `system/SystemGrid.ts` | builds the shared log frequency grid |
| `system/frdParser.ts` | turns FRD text into typed rows or a typed failure |
| `system/zmaParser.ts` | turns ZMA text into typed rows or a typed failure |
| `system/Interpolator.ts` | resamples complex data onto a grid (monotone cubic Hermite) |
| `system/MinimumPhase.ts` | derives phase from magnitude (Hilbert by FFT) |
| `system/Fft.ts` | forward and inverse radix-2 FFT |
| `system/WayResponse.ts` | gives a way's complex pressure and impedance on the grid (a sum type switch on box vs file) |
| `system/SystemSum.ts` | sums unmuted ways with delay, polarity, gain |
| `system/LadderSolver.ts` | solves the passive network at one frequency (phase 3) |
| `system/ESeries.ts` | steps a value through E12/E24 |
| `system/SystemCharts.ts` | defines the System chart set and builds its curves |
| `domain/system/System.ts`, `Way.ts` | the types of 5.2 |
| `domain/system/owsySchema.ts` | the strict zod schema of 5.3 |
| `domain/system/SystemProject.ts` | the one facade that holds live System state and publishes changes |

### 7.3 Injection, no globals

| Collaborator | How it arrives |
|---|---|
| Sweep for a box way | `SystemProject` receives a `WaySweeper` interface (given a project text and a grid, returns `SweepResult`); the composition root wires it to `SimulationEngine` |
| Storage | `SystemRepo` receives `KeyValueStorage`; file ops get `FileStorage` |
| FFT, parser, interpolator | passed as constructor arguments to `MinimumPhase` / `WayResponse` |
| Clock, ids | `newUuid` pattern already in `domain/newUuid.ts` |
| UI | hooks are factories `createSystemWaysHook(deps)` (`ui.md`); components never import a singleton |

No module-level mutable state; `architecture-no-globals.test.ts` must pass unchanged.

### 7.4 Charts via the typed registry

`ChartId` and `CURVE_BUILDERS` (`packages/design/chart/series.ts`, `engine/box/BoxEngine.ts`) are keyed for one project. The System has its own closed union so a project chart id cannot leak in:

```ts
type SystemChartId = 'SysSPL' | 'SysWaySPL' | 'SysPhase' | 'SysZ' | 'SysGD' | 'SysPartPower';
const SYSTEM_CURVE_BUILDERS: Record<SystemChartId, (c: SystemCurveCtx) => CurveBuild> = { ... };
```

| Rule | Why |
|---|---|
| `Record<SystemChartId, ...>` | a new id without a builder is a compile error (as `CURVE_BUILDERS`) |
| One `parseSystemChartId` at the storage boundary | the only string-to-member step |
| Builders return the existing `CurveBuild` shape | the chart canvas, axes, cursor code are reused unchanged |
| Chart availability by kind via a typed method `chartsFor(kind)` | no string routing |

### 7.5 Architecture tests to add

| Test | Asserts |
|---|---|
| `architecture-system-no-ui-dependency.test.ts` | `design/system` imports nothing from ui or persistence |
| `architecture-system-chart-registry.test.ts` | every `SystemChartId` has a builder and a label |
| `architecture-system-one-facade.test.ts` | only `SystemProject` constructs live System state |
| extend `architecture-no-casts` and `architecture-no-globals` scopes | cover `system/` |
| `architecture-owsy-schema-is-strict.test.ts` | schema uses `strictObject` throughout |

---

## 8. Test plan

TDD (`TESTING_STRATEGY.md`): failing test first. Run through `bash scripts/test.sh <spec>`; typecheck through `bash scripts/quiet-test.sh npm run typecheck`. Never the full suite while iterating.

### 8.1 Tier 1: unit tests (`packages/design/test/system/`)

| Object | Tests |
|---|---|
| SystemSum | two equal ways in phase: +6.02 dB; in anti-phase: deep null; delay by half a period: null; polarity flip equals 180 degree shift; mute equals absent; gain 6 dB doubles |
| frdParser / zmaParser | REW header, ARTA header, tab/space/comma, bad row names its line, non-monotone frequency refused |
| Interpolator | passes through every node; monotone data stays monotone (no overshoot); equals XSim output on XSim's grid (golden) |
| MinimumPhase | Butterworth 2nd-order analytic phase; flat magnitude gives zero phase; golden against XSim's Hilbert output |
| WayResponse (box) | `20log10(|H|)` equals project `spl`; impedance equals `zmag`/`zph` |
| LadderSolver (P3) | RC divider against closed form; series L into R; part with DCR; short/open constants; singular network typed error; golden against XSim sum for the 2-way example |
| ESeries | E12/E24 sequences, step up/down across decades, snap of an off-series value |
| owsySchema | round trip; unknown key refused at its path; frozen v1 fixture loads |

### 8.2 Golden values from XSim

| Step | How |
|---|---|
| Run XSim | wine, headless; install record `winisd_research/xsim/INSTALL.md` (`WINEPREFIX=$HOME/.wine32-xsim`, display `:98`) |
| Inputs | the shipped `Example2Way.dxo` and a hand-made `.dxo` per case (one FRD, one ZMA, one part) |
| Capture | export each graph's data from XSim (File > save curve) or read the plotted curve through the Win32 agent in `lib/wine_agent.py`; store as CSV in `packages/design/test/fixtures/xsim/` with the input files and the XSim version (4.1.0) |
| Tolerance | stated per test: sum to 0.01 dB / 0.1 degree; interpolation to 1e-6 relative; min-phase to 0.5 degree. The tolerance and why go in the fixture's README line |
| Rule | hardcoded numbers come from the running tool, never hand-derived (`TESTING_STRATEGY.md` principle 7) |
| Also | a WinISD box-way golden: the System with one box way equals the project's own sweep |

### 8.3 Tier 2: hook tests (`packages/ui/test/hooks/`)

One hook test per `System*-hooks.ts`: state transitions with fakes for `WaySweeper` and `SystemRepo`. No DOM.

### 8.4 Tier 3: browser specs (`packages/ui/test/ui/`)

Rule: one spec per visible requirement id in section 3, named by the object (`system-ways-tab.browser.spec.ts`, `system-charts-tab.browser.spec.ts`, `system-file-open-save.browser.spec.ts`, ...). Each:

| Rule | Detail |
|---|---|
| Acts as a user | clicks controls, types, imports a real file through the file chooser; never reads or changes app state objects (`.claude/rules/general.md` rule 2) |
| Own initial state | opens the tab it tests; no assumptions about the default |
| No reload | except the spec whose job is autosave/reload (F5) |
| Layout check | assert no clipped control and no unwanted scroll at phone and desktop sizes (K3), by `scrollWidth`/bounding boxes |
| Both skins | each requirement's spec runs at desktop and phone size |
| Fixtures | a small FRD/ZMA pair and two project files in `packages/ui/test/fixtures/` |
| Reads the screen | chart assertions read the cursor readout text, not canvas internals |

---

## 9. Areas needing further investigation before expanding

Each item: Q = question; Why; How to settle; Blocks.

### 9.1 Items

| # | Q | Why it matters | How to settle | Blocks |
|---|---|---|---|---|
| 1 | What are XSim's 1/r term and piston (J1) term, and what is the final sign of the Hilbert phase? | Wrong sign or a missing 1/r mirrors phase or shifts levels between near/far ways | Wine experiment: single FRD, no network, set Hilbert on, read phase; compare to the analytic Butterworth. Trace `0x504e68`, `0x55f948` in Ghidra (GHIDRA_METHOD.md). Ask John only if XSim disagrees with theory | min-phase (4.4), any golden against XSim with offsets |
| 2 | May DSP and passive kinds mix in one System (a DSP chain feeding a passive per way)? | Changes the `SystemKind` type from a sum type of two to per-way kind | Ask John on the board (already open on the proposal page) | the type in 5.2; passive phase scope |
| 3 | Is the plain DSP kind really "each way's existing chain", or does the System need its own system-level chain? | Chains in projects get edited from two places | Decide with John; prototype showing a chain edit round trip | N1-N3 |
| 4 | Does a file way get a filter chain in the DSP kind? | A tweeter FRD is usually measured raw; a DSP crossover needs a high-pass on it | Ask John; reuse `FilterEngine` on a file way is cheap | N4 |
| 5 | How does a file way get an optional sealed-box low end? | A mid in a chamber rolls off by its box; pure FRD does not | Research: lumped sealed model with driver T/S entered for the way; compare to a measured mid in a box; see 8 | optional feature only |
| 6 | Is the summed SPL at 1 m / 2.83 V, or amp-voltage driven? | Box way uses project drive; file ways are per 2.83 V in XSim; a mismatch makes the sum wrong by dB | Decompile shows XSim divides by sqrt(8) (2.83 V reference). Decide: all ways to 2.83 V per way (DSP) or one amp voltage (passive). Ask John | A4, 4.1.1, sensitivity scaling in 4.5 |
| 7 | Does `SweepResult.H` already include the filter chain? | Double-applying chain corrupts the sum | Read `SimulationEngine.ts`; unit test: H with a known filter equals H without times filter response | 4.3 |
| 8 | How does the box way's sweep range (WinISD range) meet FRD data to 20 kHz? | Box model stops where cone is no longer a piston; the sum needs one grid | Check sweep range limits in `engine/simulation`; experiment: sum a box way with a flat-to-20k file way, view the junction. Choose: clip box way at a user-set top frequency, or roll it off | 4.6, W13 |
| 9 | What HF roll-off should the box model get (voice-coil inductance, cone breakup)? | Without it a box way at 5 kHz is too loud and the sum is wrong | Compare box model with a measured FRD of the same driver in the db (1473 .frd, 1469 .zma exist); decide a documented first-order Le roll-off; label it "OpenISD addition" | accuracy claims for crossover region |
| 10 | Coaxial tweeter section of driver records: how is it carried? | Some drivers have a second section; model is one driver | Inspect `drivers` db records; ask John | coaxial feature (P4) |
| 11 | `.owpr` embedding size and dedupe? | N ways with large embedded text, plus FRD rows, bloat autosave and share links | Measure a typical 3-way `.owsy`; test compaction (like `storedTextCompaction.ts`); decide dedupe by hash | F5, share link |
| 12 | Mid in a sub-enclosure (its own sealed chamber inside the main box) | The chamber sets the mid's low roll-off | Decide with item 5; may be the same feature | box way vs file way boundary |
| 13 | Phone layout for a schematic | A schematic does not fit 374 px | Mock by agy: pan/zoom canvas vs list view; John picks | phase 3 phone UI |
| 14 | Which biquad export format and sample rate? | miniDSP, Hypex, plate amps differ | Survey 3 targets' import formats; ask John which devices | N5 |
| 15 | Is log-f interpolation within tolerance of XSim's linear-Hz interpolation? | Golden tests compare to XSim | Experiment: same FRD, both methods, diff on XSim's grid | 4.2 choice |
| 16 | Which E-series and part databases? | Parts need ratings and DCR/ESR | Decide E12, E24 only for release; part database (real manufacturers) is later; ask John | E1, E2 |
| 17 | What does "power in each part" need from the solver? | Rating chart needs current per part, and a drive level (continuous vs music power) | Solver returns branch currents (4.5); decide the drive level with item 6; XSim shows power at the source's rated W | C6 |
| 18 | Is the minimum-phase sign convention the same as OpenISD's filter phase convention? | A mismatch flips a file way's phase against a box way | Compare `PassFilterModel.response` phase of a known high-pass against the min-phase output of its magnitude | 4.4 and C3 |
| 19 | Does the System need a what-if layer? | `STATE_MODEL.md` layers `#whatif` | Ask John; release 1 omits it | 5.2 |
| 20 | Where does the System live in the Project list (own group or mixed)? | Mock A says own row group | Confirmed by John's pick of A on QO307 | S1 |
| 21 | How do a simulated box way (SPL from the model at amp voltage) and a measured FRD (1 m at 2.83 V or 1 W on some rig) get onto one level? | A wrong reference puts one way dB off and the sum is wrong | Per-way level offset field plus one stated reference shown on the chart; experiment: sum a box way with the FRD of the same driver from the db and see the offset needed; links to item 6 | A4, 4.1.1, W1 |
| 22 | Half-space vs full-space: the box model is 2pi or 4pi, measured files are on-baffle (4pi below the baffle step, 2pi above) | The bass sum is off by up to 6 dB where they meet | Check which solid angle the engine assumes (`engine/air.ts`, sweep); experiment with a db driver FRD against the box model; decide a baffle-step option (off by default, stated) or a documented offset; ask John | box-way and file-way sums in the crossover region |
| 23 | Acoustic offset: delay in ms vs driver depth in mm and the listening axis; does listening distance matter? | Wrong offsets give wrong summing near the crossover | On-axis far field: delay only, no distance term (XSim derives geometry from X/Y/Z offsets, item 1); decide whether mm is just delay times c; experiment with two FRDs at different depths in XSim | W7, 4.1 |
| 24 | Source of FRD/ZMA: the driver db holds about 1500 pairs; a library picker beats a file dialog on a phone. Can maker data be bundled (licensing)? | A file dialog is poor on a phone; bundling unlicensed data is a legal risk | Count and map db FRD/ZMA to driver records; ask John on licensing and the origin of each file; prototype a picker | W4, W2, phone UI |
| 25 | Live link or copy: does editing a way's box from the System window edit the project or a copy inside the `.owsy`? (Mock B showed the copy problem) | Two copies that disagree confuse users; a link breaks the self-contained file | Rule needed from John; current spec says embedded copy (W14, 5.3); prototype an "update from project" action and a "differs from project" mark | W11, W14, 5.3 |
| 26 | Cloud sync and the projects list: a new file type must appear in the projects list, the open indicator, export-all, Google Drive sync and backups | A System that is missing from any of these is silently unsaved or unbacked-up | Audit each place that lists `.owpr` (`persistence/src/cloud`, `backupRepo.ts`, `storageKeys.ts`, project list hooks); list changes; one test per place | F5, S1, release |
| 27 | Phone performance: 769 points x N ways x filter chains recomputed on each slider move | A janky slider makes the phone skin unusable | Measure on John's Pixel 9 class device (374x705): time a 3-way recompute; set a budget (for example 50 ms); consider caching per-way responses and recomputing only the changed way | phase 2 UI work |
| 28 | Outputs beyond charts: export of the sum as FRD, biquads with sample rate, parts list for the passive kind, share link | Users need results out of the tool | List each output with format and owner; survey targets (see item 14); check share-link size against item 11 | N5, phase 4 |
| 29 | Goldens: XSim for sum and passive maths, VituixCAD for the DSP kind; how are reference curves produced by script? | Hand-made goldens are not allowed (testing principle 7) | XSim: wine plus Win32 agent export. VituixCAD: check it runs under wine or ask John for exports; script both into `test/fixtures/` with the input files and tool version | all golden tests in section 8.2 |
| 30 | Help text and difference cues: the System is outside WinISD so no not-equal-W cues, but every new control needs the help popups both skins carry | A control with no help is unfinished; wrongly adding cues misleads | Inventory the help popup mechanism used by existing controls; write a help text per new control; confirm with John that no cues apply | phase 2 done criteria |

### 9.2 Order of attack

| Order | Items | Why first |
|---|---|---|
| 1 | 7, 6, 1, 18, 15 | cheap; settle P1 maths and goldens |
| 2 | 8, 9, 11 | box way meets file way; size budget |
| 3 | 2, 3, 4, 19 | decisions for John, in one board page |
| 4 | 13, 14, 16, 17 | phases 3 and 4 |
| 5 | 5, 10, 12 | optional extras |

---

## 10. Phases and task split

From PLAN.md section 7. Tasks are cut only after John picks A and approves section 5. Each task line is in the mandatory shape; `done_test` is the spec that observes it.

### Phase 1: `packages/design` (no UI)

| # | Task line | done_test |
|---|---|---|
| 1.1 | The Frequency grid MUST give the same points to every way when a System is summed. | `packages/design/test/system/system-grid.test.ts` |
| 1.2 | The FRD import MUST name the line of the first unreadable row when a file cannot be parsed. | `.../frd-parser.test.ts` |
| 1.3 | The ZMA import MUST name the line of the first unreadable row when a file cannot be parsed. | `.../zma-parser.test.ts` |
| 1.4 | The File way curve MUST match XSim's curve within the stated tolerance when the same FRD is loaded. | `.../interpolator-golden.test.ts` |
| 1.5 | The File way phase MUST match XSim's within the stated tolerance when minimum phase is chosen. | `.../minimum-phase-golden.test.ts` |
| 1.6 | The Summed SPL MUST match XSim's sum within 0.01 dB when two file ways are summed with delay and polarity. | `.../system-sum-golden.test.ts` |
| 1.7 | A Box way in a System MUST show exactly its project's SPL and impedance when it is the only unmuted way. | `.../box-way-response.test.ts` |
| 1.8 | The System file MUST reload to an identical System when saved and opened. | `.../owsy-roundtrip.test.ts` |
| 1.9 | The System chart list MUST include summed SPL, per-way SPL, phase, impedance and group delay when the kind is DSP. | `.../system-chart-registry.test.ts` + `architecture-system-chart-registry.test.ts` |
| 1.10 | The Open command MUST refuse a `.owsy` made by a newer OpenISD, saying so, when its version is higher. | `.../owsy-version.test.ts` |
| 1.11 | The E-series stepper MUST give the next E12 or E24 value when asked. | `.../eseries.test.ts` |

Gate: items 7, 6, 1, 15, 18 of section 9 settled; John approved section 5.

### Phase 2: UI, both skins in one task

| # | Task line | done_test |
|---|---|---|
| 2.1 | The Project list MUST show a System row and open the System window when it is chosen. | `packages/ui/test/ui/system-project-list.browser.spec.ts` |
| 2.2 | The New System dialog MUST create a System of the chosen kind when confirmed. | `.../system-new.browser.spec.ts` |
| 2.3 | The Ways tab MUST list a box way when a project is added. | `.../system-ways-tab.browser.spec.ts` |
| 2.4 | The Import dialog MUST add a file way when a valid FRD is chosen, and MUST name the bad line when it is not. | `.../system-import-way.browser.spec.ts` |
| 2.5 | The delay, polarity, gain and mute controls MUST change the summed curve when used. | `.../system-way-controls.browser.spec.ts` |
| 2.6 | The Network tab MUST show each way's filter chain and redraw the sum when a chain changes. | `.../system-network-dsp.browser.spec.ts` |
| 2.7 | The Charts tab MUST draw the five charts of C1-C5 when each is chosen. | `.../system-charts-tab.browser.spec.ts` |
| 2.8 | The Signal panel MUST show the reference level beside the chart. | `.../system-signal.browser.spec.ts` |
| 2.9 | The Save and Open commands MUST show a result popup and keep the System when used. | `.../system-file-open-save.browser.spec.ts` |
| 2.10 | The System MUST survive a page refresh. | `.../system-autosave.browser.spec.ts` (the reload spec) |
| 2.11 | The phone skin MUST offer every System function and clip no control at 374 x 705. | `.../system-phone-layout.browser.spec.ts` |
| 2.12 | The Options dialog MUST offer the same System options on both skins. | `.../system-options-both-skins.browser.spec.ts` |

Gate: phase 1 landed; items 8, 9, 11 settled; layout mock approved by John (made by agy).

### Phase 3: passive kind

| # | Task line | done_test |
|---|---|---|
| 3.1 | The Ladder solver MUST give the system impedance of an RC divider within 1e-9 when solved. | `packages/design/test/system/ladder-solver.test.ts` |
| 3.2 | The Passive sum MUST match XSim's Example2Way within 0.05 dB when the same network is loaded. | `.../ladder-golden.test.ts` |
| 3.3 | The Schematic MUST place, move and delete a part when the user drags it. | `packages/ui/test/ui/system-schematic.browser.spec.ts` |
| 3.4 | The Part panel MUST step a value through E12/E24 when the arrow keys are pressed. | `.../system-part-panel.browser.spec.ts` |
| 3.5 | The Helper menu MUST insert Zobel, L-pad, notch or 2nd-order block when chosen. | `.../system-helpers.browser.spec.ts` |
| 3.6 | The Part power chart MUST draw each part's power against its rating. | `.../system-part-power.browser.spec.ts` |
| 3.7 | The Network tab MUST explain an unsolvable network in words when one is drawn. | `.../system-network-error.browser.spec.ts` |
| 3.8 | The Filters tab of a way MUST be greyed with a note when its project is opened from a Passive System. | `.../system-passive-filters-off.browser.spec.ts` |

Gate: items 2, 13, 16, 17 settled.

### Phase 4: later

| # | Task line | done_test |
|---|---|---|
| 4.1 | The Optimiser MUST move part values to match a target slope and frequency when Run is pressed. | `.../system-optimiser.browser.spec.ts` + unit golden |
| 4.2 | The Export button MUST write each way's chain as biquads in the chosen format when pressed. | `.../system-biquad-export.test.ts` |
| 4.3 | The Coaxial way MUST show two sections when a coaxial driver is chosen. | needs item 10 |
| 4.4 | The File way MUST accept an optional sealed-box low end when ticked. | needs items 5, 12 |
| 4.5 | The Compare view MUST show a measured sum over the simulated sum when a measurement is imported. | needs a design task |

---

## Appendix: what is reused, by path

| Reuse | Path |
|---|---|
| Complex maths | `packages/design/engine/complex.ts` |
| Sweep result with complex pressure | `packages/design/engine/types.ts` (`SweepResult.H`, `zmag`, `zph`, `gd`) |
| Group delay | `packages/design/engine/simulation/SimulationEngine.ts` (`groupDelayAtMs`) |
| Filter chain | `packages/design/engine/filters.ts`, `engine/filters/FilterEngine.ts`, `FilterSpec` (10 types) in `engine/types.ts` |
| Chart registry pattern | `packages/design/chart/series.ts` (`CURVE_BUILDERS`, `TAB_META`, `parseChartId`) |
| Chart ids | `packages/design/engine/box/BoxEngine.ts` (`ChartId`) |
| Signal and drive | `packages/design/engine/signal/SignalEngine.ts` |
| Project schema pattern | `packages/design/domain/openisdSchema.ts` |
| Project state pattern | `packages/design/domain/project/openISDProject.ts`, `docs/design/STATE_MODEL.md`, `docs/design/REACTIVITY.md` |
| Persistence pattern | `packages/persistence/src/repos/projectRepo.ts`, `projectSchemaUpgrade.ts`; `docs/design/PERSISTENCE_NAMING_AND_PLACEMENT.md` |
| Fields and format | `packages/design/fields/` (`format.ts`, `field.ts`, `spinnerStep.ts`) |
| Chart colours | `packages/design/chart/chartColorRows.ts` |
| XSim facts | `winisd_research/xsim/DECOMPILE_NOTES.md`, `FORMATS.md`, `INSTALL.md` |
