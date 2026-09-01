# WinISD parity goldens

Every file in `goldens/` is a WinISD project file **WinISD itself saved**, copied out
unmodified. Nothing in openisd produced any number in them. `../../winisd-parity.test.ts`
runs openisd over the same scenarios and diffs against these.

---

## Curve data as text — the answer, and the evidence

**WinISD cannot emit a plotted curve as text, and its plot control exposes nothing to read
one out of.** So this suite covers **field calculations only**. Charts are out of scope until
that changes — reading a chart off a screenshot is not an acceptable golden.

Four independent checks, all against `winisd.exe` 0.7.0.0:

1. **No chart component exists to query.** `EnumChildWindows` over the whole main window
   returns 23 `Window`, 7 `Edit`, 3 `Button`, 2 `LCLComboBox`, 1 `SysTabControl32` and
   1 `LCLCheckListBox` — and no chart control of any kind. The plot is a custom-drawn canvas
   inside `pnlPlotFrame`. Probe and full dump:
   `winisd_research/toys/probe_curve_text_channel.py`, `winisd_research/runs/curve_text_channel.json`.
2. **The two cursor read-outs have no window handle.** The binary declares
   `lblPlotFrequency` (hint "Cursor frequency") and `lblPlotValue` (hint "Cursor value")
   inside `pnlPlotFrame`, which looks like a text channel. Neither appears in the
   enumeration above: they are LCL `TLabel`s, i.e. `TGraphicControl`s, painted onto the
   parent's canvas with no HWND, so `WM_GETTEXT` cannot reach them. Reading them means
   cropping and OCR-ing pixels — the very thing ruled out.
3. **There is no export command anywhere in the program.** Neither top-level window returns
   an `HMENU` — WinISD has no menu bar at all — and the binary contains exactly three
   `TPopupMenu`s: `popPlotType` (the plot-type chooser), `popProject` (project-list
   right-click) and `popHelpMenu`. The only file-dialog filter strings in the entire
   executable are `WinISD project files (*.wpr)` and `WinISD driver file [*.wdr]`; there is
   no `*.csv`, `*.txt` or `*.dat` filter, so no "save data" dialog exists to open.
4. **The official help says the same by omission.** The 21 extracted help pages under
   `docs/winisd_helpfiles/help/`, including `graphs.html`, contain no occurrence of
   *export*, *clipboard* or *csv*.

What still guards the curves: `packages/engine/test/golden.test.ts`, which pins openisd's own
sweep output byte for byte. That is a different guarantee — it proves openisd has not changed,
not that it agrees with WinISD.

---

## What produced these goldens

| | |
|---|---|
| Program | `winisd.exe`, FileVersion **0.7.0.0**, ProductName WinISD, Juha Hartikainen |
| Binary | 2 473 472 bytes, sha256 `a7dab233…6df386ae` — the exact fingerprint is in `provenance.json` |
| Runs under | wine 10.0 on WSLg, prefix `~/.wine`, no VM |
| Harness | `winisd_research/scripts/qo8_parity_generator.py` on `winisd_research/lib/wine_control.py` |
| Harness commit | recorded per run in `provenance.json` (`harnessCommit`, plus `harnessWorkingTreeDirty`) |

The About box cannot be quoted for a build number: it reads one from `version.ini`, which is
absent from this install — that is why the title bar says `WinISD -error-`. The PE version
resource is the authority instead.

`winisd_research/` is git-ignored by the parent repo and is its own repository, so
`harnessCommit` refers to **that** repo, not to openisd.

---

## How a golden is made

A WinISD project holds every derived driver field at ~15 significant digits, but getting a
*fresh* one written takes two edits, in this order. Each does exactly half the job, and either
alone yields a silently useless file (measured 2026-08-13,
`winisd_research/WINE_HARNESS.md` §"Reading COMPUTED DRIVER fields"):

1. **A Driver-editor edit fires the derived-field pass** — `Gloss`, `SPLmaxLF`, `Mcost`,
   `Rme`, `gamma`, `Mpow`, `EBP`, `SPLmax`, `USPL`, `no`, `Dd`, `Vd`. A Box-tab edit does not:
   it saves a file in which every one of those reads `0`.
2. **A Box-tab edit dirties the project.** A driver-editor edit alone does not, so the
   toolbar Save is a no-op and the file is never rewritten.

Both edits **retype a value as itself, spelled differently** — `0.00050` over `0.0005`,
`0.020` over `0.0200`. WinISD recalculates on keystrokes, so the pass fires, while the number
it recalculates from is the scenario's own. `Le` is the driver-side trigger because it appears
in none of WinISD's 22 consistency groups, so it cannot perturb anything under test; the box
volume is the box-side trigger for the same reason.

The generator stops on the first scenario WinISD will not answer and records it as failed. It
never substitutes a computed value: a golden synthesised from openisd would make this suite a
tautology that can only ever pass.

---

## Refreshing them

```bash
cd /home/john/work/winisd/winisd_research
python3 scripts/qo8_parity_generator.py            # only scenarios with no golden yet
python3 scripts/qo8_parity_generator.py --force    # all of them, from scratch
python3 scripts/qo8_parity_generator.py --only env  # id substring filter
```

Then run the comparison:

```bash
cd /home/john/work/winisd/openisd
npx vitest run --project winisd packages/design/test/winisd/winisd-parity.test.ts
```

**One WinISD at a time.** The harness attaches to the app by window title, so a second
instance — another agent's probe campaign, or a second copy of this generator — makes both
runs address the wrong window. Check with `pgrep -f winisd/winisd.exe` before starting.

Each scenario costs one launch, about 25–40 s. The whole set is minutes, not hours.

---

## `scenarios.json` — what every parameter means

Keys are **WinISD's own** `.wdr`/`.wpr` key names, so the generator writes them straight into a
project file and the goldens read back in the same vocabulary.

Scenarios are **parameterised by explicit values and name no driver from the database**. A
fixture that said "Dayton RS180-8" would silently re-baseline itself the next time the scraper
pipeline regenerated that record; one that says `Fs=37.2, Qts=0.3718…, Vas=0.02918…, Re=6.4`
does not.

### `driver` — only the fields ENTERED into WinISD

Everything absent is left for WinISD's own consistency solver, which is the thing under test.

| key | meaning | unit |
|---|---|---|
| `Fs` | free-air resonance | Hz |
| `Qts` `Qes` `Qms` | total / electrical / mechanical Q | — |
| `Cms` | suspension compliance | m/N |
| `Mms` | moving mass including air load | kg |
| `Rms` | mechanical loss | N·s/m |
| `BL` | motor force factor | T·m |
| `Re` | voice-coil DC resistance | Ω |
| `Le` | voice-coil inductance | H |
| `Sd` | piston area | m² |
| `Vas` | equivalent compliance volume | m³ |
| `Xmax` | linear one-way excursion | m |
| `Hc` `Hg` | voice-coil winding height, magnet gap height | m |
| `Pe` | thermal power handling | W |
| `SPL` | reference sensitivity, 1 W / 1 m | dB |
| `Znom` | nominal impedance — a label, not used in simulation | Ω |
| `numVC` | voice-coil count | — |
| `VCCon` | voice-coil connection code | — |

### `box`

| key | meaning |
|---|---|
| `BType` | **0** sealed · **1** vented · **2** 4th-order bandpass · **4** passive radiator |
| `Vr` `Fr` | rear (main) chamber volume m³, and its frequency — for a sealed box WinISD **writes the computed Fsc back into `Fr`** |
| `Vf` `Ff` | front chamber volume m³ and tuning Hz — bandpass only |
| `Qlr` `Qar` `Qpr` | rear-chamber leakage / absorption / port Q |
| `Qlf` `Qaf` `Qpf` | the same for the front chamber |

### `ventRear` / `ventFront`

`Num` vent count · `Shape` 1 = round · `Fb` tuning Hz · `Vb` chamber m³ · `dia1`/`dia2` end
diameters m · `carea` cross-section m² (0 = derive from diameter) · `len` duct length m ·
`endcorrection` end-correction coefficient per open end · `crosscalc` 1 = the cross-section
was calculated rather than typed.

### `passiveRadiator`

`Vas` m³ · `Qms` · `Fs` Hz · `Sd` m² · `Xmax` m · `Me` added mass kg.

### `environment`

`T` kelvin · `p` pascal · `phi` relative humidity as a **fraction** (WinISD's own unit —
openisd's `humidityPct` is a percentage, and the single conversion lives at the `.wpr`
boundary).

### `signal`

`Rg` source resistance Ω (WinISD's default is 0.1, and its sealed Fsc/Qtc read-outs are
computed with `Re+Rg`, not bare `Re`) · `P` drive power W.

---

## `divergences.json` — differences the suite EXPECTS

A recorded divergence is asserted to **still differ**. If openisd and WinISD come back into
agreement on a listed field, the test fails and tells you to delete the entry — a stale
exemption is how a suite quietly stops testing anything.

Every entry names a mechanism and cites where the decision lives. "They just differ" is not a
cause.

---

## The tolerance, and why it is that number

`1e-9` relative, with a `1e-12` absolute floor for values at or near zero.

**The floor it has to clear.** WinISD writes each value as ~15 significant decimal digits, so
the file itself costs up to ~`1e-15` relative on the round trip, and both programs evaluate in
IEEE-754 doubles (eps `2.2e-16`) over at most a few dozen operations — generously `1e-14` of
accumulated rounding. `1e-9` is five orders above that, so no difference in evaluation order
or associativity between two implementations of the same formula can trip it.

**The ceiling it has to stay under.** The smallest thing that actually matters is a different
*formula*, and every such difference measured in this codebase is far bigger: `Rme`'s two
candidate routes differ by `3.1e-3` relative on a real record; WinISD's frozen air versus
physically derived air is 0.077 dB of SPL, `8.6e-4`; the 6-significant-figure truncation of
`RHO`/`C` in `packages/engine/src/constants.ts` is `1.8e-6`. `1e-9` is three orders below the
smallest of those.

The band between float noise and a real difference is about five orders wide, and `1e-9` sits
in the middle of it. Looser would hide the constant truncation; tighter would start reporting
decimal round-trip as a defect.

---

## Environment mode — the suite runs WinISD-compatible

openisd **uses** humidity and pressure by default; WinISD's parity mode swaps in its own air
model from the active app-level Options values (ledger QO7, settled against seven
human-produced sample projects). The comparison therefore runs openisd with
`useWinisdAirModel: true`. With it off, the suite would report a permanent ~0.07 dB divergence
at 30 °C and teach everyone to ignore it.

That switch covers the air model only. openisd still scales ρ and c with temperature in that
mode, and WinISD does not scale them with anything — see `divergences.json` for the
temperature leg.
