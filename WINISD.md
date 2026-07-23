# WinISD compatibility notes

This file records findings, assumptions, and open questions about how OpenISD's
behaviour compares to WinISD (Linear Team, http://www.winISD.com/). It distinguishes
between **confirmed** facts (user-observed, sourced), **inferred** conclusions
(deduced from data), and **unverified** assumptions (plausible but not confirmed).

## 1. SPL reference convention

### Observation (user-reported)

Same driver, same box: WinISD showed **92.6 dB**, OpenISD showed **94.4 dB** —
a fixed +1.8 dB offset.

### OpenISD's original formula

```
eg = sqrt(Pin × Re)
```

where `Pin` defaults to 1 W and `Re` is the driver's DC resistance.

For Re ≠ 8 Ω this diverges from the IEC sensitivity reference voltage of 2.83 Vrms.

### Inferred cause

If WinISD uses 2.83 Vrms fixed as its simulation voltage, the offset would be:

```
ΔdB = 20 · log10(sqrt(Re) / sqrt(8))  =  10 · log10(Re / 8)
```

For a 1.8 dB offset: `Re ≈ 12 Ω` (consistent with a nominal 16 Ω driver or a high-Re
voice coil).

### ✓ Confirmed: WinISD uses sqrt(Pin × Re) — Re only, not Re+Rs

**Initial (wrong) reading:** User observed WinISD showing 11.7 V at 40 W with Rs=0.1 Ω and
back-calculated Re+Rs ≈ 3.42 Ω. This briefly suggested WinISD included Rs in the voltage formula.

**Corrected by second observation (2026-06-24):**

- Same driver: Re=3.4 Ω, Rs=0.1 Ω, Pin=1 W
- WinISD displayed **1.8 V**
- `sqrt(Re + Rs) = sqrt(3.5) = 1.871` — does NOT round to 1.8
- `sqrt(Re) = sqrt(3.4) = 1.844` — rounds to **1.8** ✓
- Formula confirmed: `Eg = sqrt(Pin × Re)` — Rs is in the circuit but NOT in the voltage reference

Confirmed independently from WinISD help file (`research/winisd/help/plottypes.html`):

> "The power applied can be related to excitation voltage with following relation:
> **Eg = sqrt(P × Re)**, or P = Eg²/Re"

Forum corroboration (talkbass.com, thread "WinISD and sensitivity ratings"):

> "WinISD uses Re to calculate sensitivity" — Rick James

### Current OpenISD implementation (matches WinISD)

```
eg = sqrt(Pin × Re)          // Re only — matches WinISD convention
Zcoil = (Re + Rs) + jω·Le   // Rs still in the circuit, just not the voltage reference
```

Note: 2.83 V is the IEC 60268-5 sensitivity standard and is _not_ what WinISD uses.
WinISD's Re-based convention means its SPL curves are reference-power curves, not
IEC sensitivity curves.

### ✓ Confirmed: 2.83V IEC mode matches "2.83V/1m" datasheets for 8Ω drivers (2026-06-24)

Test driver: **Morel UW 1258** (8Ω nominal). Measured on IEC baffle, Brüel & Kjær 3144 mic.
Datasheet: **"Sensitivity 2.83V/1m 87 dB SPL"**

| Tool                   | Parameters                 | Voltage | SPL                 |
| ---------------------- | -------------------------- | ------- | ------------------- |
| OpenISD 2.83V IEC mode | OpenISD entry              | 2.83V   | **87.0 dB** ✓       |
| WinISD                 | Built-in Morel DB entry    | 2.83V   | 86.59 dB (−0.41 dB) |
| WinISD                 | .wdr exported from OpenISD | 2.83V   | **87.1 dB** ✓       |

The 0.41 dB gap with WinISD's built-in entry was a **parameter difference** (different T/S values in
WinISD's database vs the datasheet). With identical parameters (via .wdr export), both tools agree
to within 0.1 dB — rounding noise.

IEC baffle (1.2×1.2 m flat baffle) is half-space (2π sr) — identical to WinISD/OpenISD radiation model.
For 8Ω drivers with explicit "2.83V/1m" datasheet specs, the 2.83V IEC mode is correct.

### ⚠ Observed sensitivity offset vs datasheet (2026-06-24)

Test driver: Tang Band W5-1138SMF (Re ≈ 3.24 Ω, 4 Ω nominal). Datasheet: **82 dB 1W/1m**.

| Drive condition       | WinISD SPL | Spec                    |
| --------------------- | ---------- | ----------------------- |
| 1 W, 1.8 V (sqrt(Re)) | 79.75 dB   | 82.00 dB → **−2.25 dB** |
| 1.5 W, 2.3 V          | 82.3 dB    | 82.00 dB → **≈ match**  |

**Conclusion:** The datasheet "1W/1m" was measured at Z(1 kHz) ≈ 5.3 Ω, giving Vref = sqrt(5.3) ≈ 2.3 V.
WinISD uses sqrt(Re) = 1.8 V, which is lower, producing a ~2.25 dB systematic shortfall vs
manufacturer sensitivity specs for low-Re drivers.

**To match a datasheet sensitivity in WinISD/OpenISD:** set input power so that
`sqrt(Pin × Re) ≈ sqrt(Z_measurement_freq)`, i.e. `Pin = Z_meas / Re` watts.
For this driver: Pin ≈ 5.3 / 3.24 ≈ 1.63 W.

## 2. Passive radiator parameter entry

### User-reported WinISD PR input fields

WinISD takes the following for a passive radiator:

```
Vas, Qms, Fs, Sd, Xmax, numPR, added_mass
```

WinISD **outputs** "Fs with added mass" — the free-air resonance of the PR with the
added mass attached (no box).

### Derivation WinISD performs

WinISD does **not** ask for Mms directly. It derives it:

```
Cms = Vas / (Sd² × ρc²)
Mms = 1 / ((2π·Fs)² × Cms)
Rms = sqrt(Mms / Cms) / Qms
```

This is internally identical to entering {Mms, Cms, Rms} from a T/S datasheet — both
representations carry the same information.

OpenISD's WinISD entry mode implements these exact conversions.

### "Fs with added mass" (WinISD output)

WinISD reports the **free-air** resonance after adding mass, not the in-box tuning
frequency Fp:

```
Fs_loaded = 1 / (2π · sqrt((Mms + Madd) · Cms))
           = Fs · sqrt(Mms / (Mms + Madd))
```

OpenISD shows this as "Fs+mass" alongside the in-box Fp. They differ because the box
compliance in series with the PR compliance reduces the total system compliance, raising
the resonance: Fp > Fs+mass.

### ⚠ Assumption — NOT directly verified

> **WinISD's Fs input is the unloaded free-air resonance of the PR (no added mass).**

This is the natural interpretation and is consistent with the conversion formulas, but it
has not been confirmed by testing an actual WinISD session with a known PR.

## 3. Multiple passive radiators (numPR)

WinISD accepts `numPR` as an input. OpenISD implements this as `prNum` (default 1).

**Physical effect of n identical PRs in parallel:**

- Combined acoustic mass: `Map_total = Map_single / n`
- Combined acoustic compliance: `Cap_total = n × Cap_single`
- Tuning frequency Fp is **unchanged** (the n factors cancel under the square root)
- Effective PR branch acoustic impedance: `Zpr_total = Zpr_single / n`
- SPL contribution from PR branch increases because lower Zpr means more volume velocity
  through the PR branch at a given driver drive
- Per-PR excursion = total PR volume velocity / (n × Sd)

OpenISD implements this in `circuit.js` (scale `Zpr` by `1/n`) and `sweep.js`
(divide `excPR` by `n`).

### ⚠ Assumption

> **WinISD models n identical PRs as n acoustic elements in parallel.**

The physics is unambiguous; whether WinISD models it the same way has not been
cross-checked by comparing per-PR excursion curves.

## 4. T/S conversion formulas (confirmed)

These are standard acoustics and verified by the engine round-trip tests:

```
Cms [m/N]  = Vas [m³] / (Sd² [m⁴] × ρ [kg/m³] × c² [m²/s²])
Mms [kg]   = 1 / ((2π·Fs)² × Cms)
Rms [kg/s] = sqrt(Mms / Cms) / Qms
Fp  [Hz]   = 1 / (2π · sqrt((Mms + Madd) / Sd² × Cms × Sd²))
           = 1 / (2π · sqrt((Mms + Madd) × Cms))
```

Engine test `WinISD PR Fs/Qms/Vas round-trips` confirms these are exact inverses.

## 5. Box losses (Ql, Qa, Qp) — confirmed from help file

**Sources:**

- `research/winisd/help/boxdesign.html` (extracted from official WinISD 0.7 installer)
- `research/winisd/versions.txt` — 0.50alpha1: _"Added advanced settings (Ql, Qa, Qp) for chambers."_
- `research/winisd/versions.txt` — 0.50alpha7: _"Box alignment calculation now considers external resistance and
  reduction of Q as box has some absorption loss. Leak losses are not considered when calculating alignments."_ (
  confirms Ql and Qa are distinct; Ql excluded from alignment math)

WinISD models three independent box loss factors:

| Parameter | Meaning                                                   | WinISD default    | Typical range         |
| --------- | --------------------------------------------------------- | ----------------- | --------------------- |
| Ql        | Leakage losses (enclosure sealing, driver surround leaks) | **10**            | 5–20                  |
| Qa        | Absorption losses (stuffing material)                     | 100 (no stuffing) | 3–5 (heavily stuffed) |
| Qp        | Port losses (air friction in port)                        | 100               | —                     |

Combined: `1/Qlt = 1/Qa + 1/Ql + 1/Qp`

**Direct quote from help file:**

> "For reasonable quality box, WinISD pro uses Ql of **10** by default."

### UI location — confirmed from help file screenshots + direct user observation in 0.7.0.950

The losses control is an **"Advanced->" button at the bottom-left of the Box tab panel** —
NOT the top-level "Advanced" tab in the main window. Clicking it opens a popup listing
Ql / Qa / Qp with their current values; clicking any entry opens a small float window with
an editable field and a drag-square. Confirmed with screenshots in `research/winisd/help/`.

**Directly observed in WinISD 0.7.0.950 (2026-06-24):** Ql = 10.000, Qa = 100.000.
**Correction (2026-06-24):** Qp IS shown in WinISD 0.7 — it appears on the **ported (vented) box view**
specifically, not in the general box losses popup. Default: **100**. Earlier observation that
"Qp is not shown" was incorrect; it was observed in the sealed box view where the port loss
field does not apply.

OpenISD exposes `Ql` (default 10), `Qa` (default 100), and `Qp` (default 100), matching WinISD.
`Qp` is implemented in `circuit.js` (`portLoss()`) and applied for vented and bandpass4 boxes.
It must be exposed in the UI for vented/bandpass4 — currently missing from BoxPanel.vue.

**Practical Qa values (from DIYAudio community, thread 316996):**

- 100 — no stuffing (WinISD default)
- 20–50 — light stuffing
- 5–10 — heavy stuffing
- 3 — theoretical minimum; only achievable with a variovent

**Modelling limitation:** Real stuffing is not purely resistive. It also increases the apparent
box volume (velocity of sound is reduced in stuffed enclosures) and can modify driver Qms near
the driver cone. WinISD's resistive model (and OpenISD's) captures only the damping component.
Cut-and-try with an impedance measurement is the only reliable way to determine real Qa.

## 6. Signal / voltage reference — confirmed from help file

**Source:** `research/winisd/help/boxdesign.html` and `plottypes.html`

> "Term 'power' should more correctly be voltage. This term 'power' comes from definition by
> Richard Small, who defined the input power to be P=Eg²/Re … where Eg is RMS output voltage
> of your amplifier, and Re is DC resistance of voice coil."

> "The power applied can be related to excitation voltage with following relation:
> **Eg = sqrt(P × Re)**, or P = Eg²/Re"

Series resistance (default **0.1 Ω**): included in the electrical circuit model but NOT in the
power-to-voltage conversion. OpenISD matches this behaviour.

## 7. Group delay calibration

**Observation (2026-06-24):** Same driver + PR box, same parameters.

|                   | OpenISD (before) | OpenISD (after) | WinISD 0.7 |
| ----------------- | ---------------- | --------------- | ---------- |
| GD peak frequency | 58.9 Hz          | 60 Hz           | 61.9 Hz    |
| GD peak magnitude | 11.4 ms          | 12.1 ms         | 12.2 ms    |

**Root cause:** OpenISD's Ql default was 7; WinISD's confirmed default is 10. Higher loss
(lower Ql) damps the resonance, shifting the peak down in frequency and reducing its magnitude.

**Fix applied:** Changed Ql default to 10 in `P_DEFAULTS` and circuit fallback.

**Remaining offset after Ql fix:** ~1.9 Hz in frequency. Root cause identified and fixed —
see section 9 (circuit model). Le was included in OpenISD's acoustic circuit but WinISD
excludes it. Removing Le from the acoustic drive in WinISD mode resolved the offset.

**Final result (2026-06-24):** OpenISD WinISD mode → **61 Hz / 12 ms**, WinISD → **61.9 Hz / 12.2 ms**. Essentially
matched.

## 8. Driver volume / net vs gross Vb

**Confirmed by community consensus** (DIY Loudspeaker Project Pad, Facebook, post by Christopher Avery):

> WinISD does NOT account for driver displacement volume. The Vb entered is the **net acoustic volume**.

To size the physical enclosure, users must manually add to Vb:

- Driver motor/basket displacement
- Port volume (tube cross-section × length)
- Bracing volume
- Crossover/wiring hardware (if internal)

Stuffing (polyfill, fibreglass) is typically excluded because it is low-density and its
volume displacement is negligible, but it does reduce the effective speed of sound and increase
apparent Vb — a separate effect from its Qa damping contribution.

**Implication for OpenISD:** Vb is treated as net acoustic volume, consistent with WinISD.
The UI should make this explicit. The Vb label tooltip should note "net acoustic volume".

## 9. Circuit model — WinISD vs Full Gyrator

**Source:** `research/winisd/help/aboutequivalentcircuits.html` (from official WinISD 0.7 installer)

WinISD's acoustic simulation works entirely in the **acoustical domain** using a simplified
constant-element model. OpenISD implements both this model and a physically more complete one.

### WinISD model (default in OpenISD — "WinISD" mode)

Driver acoustic elements are **constants** derived from T/S parameters at resonance:

```
Ccas = Vas / (ρ·c²)
Lmas = 1 / ((2π·Fs)² · Ccas)          = Mms / Sd²
Rae  = 1 / (2π·Fs · Qes · Ccas)       = Bl² / (Re·Sd²)   ← constant, NO Le
Ram  = 1 / (2π·Fs · Qms · Ccas)       = Rms / Sd²
```

The drive source `Uad = Eg·Bl / (Re·Sd)` is also **constant** (Le excluded).

Le appears **only** when computing the electrical impedance plot, added back afterwards:

```
Ze = Re + jω·Le + Zem    where Zem = Bl²/(Sd²·Za)
```

Box loss resistors are described as "determined at resonance frequency of boxed driver."

Group delay is computed by WinISD as a centred finite difference on phase:

```
gd(ω) = −(arg H(f+δ) − arg H(f−δ)) / (2δ)
```

### Full gyrator model (OpenISD "Full gyrator" mode)

The electrical domain is fully modelled and coupled to the acoustic circuit via a gyrator:

```
Zcoil = (Re + Rs) + jω·Le          ← frequency-dependent
pg    = Eg·Bl / (Sd · Zcoil)       ← frequency-dependent drive
ZaE   = Bl² / (Sd² · Zcoil)        ← frequency-dependent electrical damping
```

Le feeds into every acoustic quantity (SPL, GD, excursion). Physically more complete
but diverges slightly from WinISD at frequencies where Le is non-negligible.

### Observed difference

With the demo 6.5" driver (Le = 0.7 mH, Re = 5.6 Ω) in a PR box:

| Mode                                          | GD peak freq | GD peak mag |
| --------------------------------------------- | ------------ | ----------- |
| WinISD 0.7.0.950 (observed)                   | 61.9 Hz      | 12.2 ms     |
| OpenISD — WinISD model (confirmed 2026-06-24) | **61 Hz**    | **12 ms**   |
| OpenISD — Full gyrator                        | 60.0 Hz      | 12.1 ms     |

At 60 Hz: `jωLe ≈ j0.26 Ω` (4.6% of Re). This reactive component in ZaE shifts the
effective electrical Q and coupled system resonance by ~1.9 Hz in the full gyrator model.

### OpenISD advantage over WinISD

| Feature                   | WinISD               | OpenISD                        |
| ------------------------- | -------------------- | ------------------------------ |
| Le in acoustic circuit    | No (constant Rae)    | Yes (full gyrator, switchable) |
| Box losses (Ql, Qa)       | Ql + Qa via UI       | Ql + Qa via UI                 |
| Series resistance Rs      | Yes (Signal tab)     | Yes                            |
| Filter / EQ chain         | Yes                  | Yes                            |
| Passive radiator mode     | Yes                  | Yes                            |
| Multiple drivers          | Yes                  | Yes                            |
| Browser-based, no install | No                   | Yes                            |
| Open source               | No                   | Yes                            |
| State persistence         | Project files        | localStorage (auto)            |
| Driver library            | Local .wdr files     | Bundled JSON + browse          |
| Compare designs           | No                   | Yes (pin + overlay)            |
| Cursor peak snap          | No                   | Right-click on graph           |
| Export                    | Print / project file | (planned)                      |

### Recommendation

Use **WinISD mode** (default) when cross-checking designs against WinISD.
Use **Full gyrator** when Le is large (>1 mH) or at higher frequencies where Le effects
are significant, accepting that results will differ slightly from WinISD.

## 10. WDR file format — consistency rules and parameter entry

**Source:** Parts Express TechTalk forum, thread "WinISD Pro frustrations, help please."
https://techtalk.parts-express.com/forum/tech-talk-forum/1318003-winisd-pro-frustrations-help-please
(retrieved 2026-06-25)

### Consistency check — Qts / Qms / Qes

WinISD internally calculates Qts from Qms and Qes to **3 decimal places** of precision:

```
Qts = (Qms × Qes) / (Qms + Qes)
```

> "When you enter Qms and Qes, WinISD will calculate Qts from these 2 parameters to a
> high level of accuracy (higher than what is shown as the calculated Qts). If you try
> to enter Qts as a parameter as well as Qms and Qes, it will show the error as the
> calculated value and your entered value will differ." — thekorvers

**Rule: never store Qts in a WDR file alongside Qms and Qes.** If all three are present,
WinISD computes Qts from Qms/Qes and compares to the stored value; any rounding difference
at the 3rd decimal place triggers "consistency check failed: Qts Qms Qes".

Spec sheets commonly round Qts, Qms, Qes to 2 decimal places. Even when arithmetically
consistent on paper, the 3rd-decimal recompute may differ.

**OpenISD fix:** WDR files must not contain Qts when Qms and Qes are both present.
Either omit Qts entirely, or ensure it is marked 'C' (calculated) in ParState.

### Recommended parameter entry sequence

From `thekorvers` (2,000+ WinISD sessions):

```
Qes, Qms, Fs, Vas, Re, Le, Sd, Xmax, Pe, Znom
```

WinISD then calculates: Qts, Dd, Cms, Mms, Rms, EBP, SPL, Vd, and all
box/port parameters.

> "Enter the first parameter and tab to the next. If it's blank, enter it and tab again.
> If it's filled in by WinISD, tab over it to the next." — Millstonemike

### Precision and rounding

> "WinISD is accurate to three decimal places, but many driver spec sheets round off some
> of them to two. That can result in WinISD calculating a different, more accurate result
> than the manufacturer data sheets, triggering an error." — billfitzmaurice

You can round primary measurements (e.g. Fs=30 instead of 29.8) as long as they don't
conflict with other already-entered specs.

### Pre-loaded driver file integrity

Old WDR files (pre-2006) may red-flag in current WinISD because they were saved at a
different internal precision than the current version expects. WDR files should be
regenerated from current datasheet values when this occurs.

### WDR field order and ParState

`ParState` is the last WinISD-native field in a WDR file. Fields after `ParState` are
ignored by WinISD. OpenISD's provenance metadata lives in the companion `_meta.yml` sidecar, not in the WDR.

`ParState` is a 49-character string: each position is `E` (user-Entered), `C` (Calculated
by WinISD from other entered values), or `N` (Not set). The mapping of positions to
parameter names has been reverse-engineered via single-parameter probes in `drivers/sample/`
and is documented in `drivers/sample/README.md`.

**The data pipeline's ParState builder** (sibling `winisd_tools` repo's
`scraper_lib.py:_parstate()`) dynamically constructs ParState based on which
fields were actually sourced from the datasheet:

- **E** — field is present and non-zero (user-entered or sourced from datasheet)
- **C** — field is computed from available dependencies (e.g., Vd from Sd+Xmax, EBP from Fs+Qes+Qms)
- **N** — field is absent or not relevant

This reflects the actual E/C/N state that WinISD would assign if a user entered the same fields.

### Fields to include in WDR files

**Primary T/S parameters** (sourced from datasheet):

```
Fs  Qes  Qms  Re  Le  Sd  Vas  Xmax  Pe  Znom  BL  Mms  Cms  Rms  SPL
```

**Derived T/S** (computed from primary parameters when dependencies available, else 0):

```
Vd  Dd  EBP
```

**Evidence:** Analysis of 411 real WinISD files in `drivers/matt/` (human-curated collection)
confirms this behaviour:

- **Vd** (Sd × Xmax): 402/411 computed, 9 zeros (missing when Xmax absent)
- **Dd** (√(4Sd/π)): 411/411 computed, 0 zeros (always derivable from Sd alone)
- **EBP** (Fs/Qes): 410/411 computed, 1 zero (missing when Qes absent)

**Structural** (required by WinISD):

```
numVC  VCCon  ParState
```

Fields written by OpenISD's `to_wdr()`:

```
Calculatable — computed from T/S when dependencies are available, otherwise 0:
  Vd (Sd × Xmax), Dd (2·√(Sd/π)), EBP (Fs/Qes)

Fields written only when extracted from source:
  fLe, KLe, Dia (and all other non-mandatory fields)

Air properties (standard 20°C, overridable via WinISD UI):
  c=343.684120962152
  roo=1.20095217714682

Physical dimensions (not currently extracted):
  Thick, Depth, MagDepth, Magnet, Basket, Outer, Vcd, DVol
  (See the sibling winisd_tools repo's SCRAPING_TODO.md: Physical dimension extraction gap)
```

**Do NOT store Qts** when Qms and Qes are both present — see consistency rule above.

## 11. Open questions

| #   | Question                                                                                                                                                                                                                                                                                                                                                                                                                                     | Priority |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | ~~Does WinISD use 2.83 V fixed or `sqrt(Pin × Z_nom)`?~~ **RESOLVED: uses `Eg = sqrt(P × Re)`** — confirmed in WinISD help file                                                                                                                                                                                                                                                                                                              | Closed   |
| 2   | ~~Does WinISD include Le in its acoustic circuit model?~~ **RESOLVED: No. Le only for impedance. Source: aboutequivalentcircuits.html**                                                                                                                                                                                                                                                                                                      | Closed   |
| 3   | ~~Does WinISD model box leakage (Ql)?~~ **RESOLVED: Ql=10, Qa=100, Qp=100; entry via "Advanced->" button in the Box tab panel (not the top-level Advanced tab). Confirmed by help file text + screenshots boxdes05/06.**                                                                                                                                                                                                                     | Closed   |
| 4   | ~~What radiation model does WinISD use?~~ **RESOLVED: half-space (infinite baffle). Formula `p(r) = ρ·ω·U0/(2π·r)` confirmed in `aboutequivalentcircuits.html`. OpenISD uses identical formula.**                                                                                                                                                                                                                                            | Closed   |
| 5   | ~~Does WinISD account for air load (radiation mass) on the PR separately from Mms?~~ **RESOLVED: No separate term added. `thielesmall.html` defines Mms as "including air load" for all drivers. For PRs, WinISD derives Mms from Fs+Vas via `Mms = 1/((2π·Fs)²·Cms)` — the measured Fs already encodes air-load implicitly. Neither WinISD nor OpenISD adds an extra radiation-mass term. Source: `research/winisd/help/thielesmall.html`** | Closed   |
| 6   | ~~Does WinISD's Qms in PR mode mean the same as T/S Qms?~~ **RESOLVED: Yes — standard T/S definition. `aboutequivalentcircuits.html` gives `Ram = 1/(2π·Fs·Qms·Ccas)` applied identically for drivers and PRs. Algebraically equivalent to OpenISD's `Rms = sqrt(Mms/Cms)/Qms`. Source: `research/winisd/help/aboutequivalentcircuits.html`**                                                                                                | Closed   |

## 12. VCCon — confirmed save bug (verified 2026-06-26)

**VCCon** is the voice coil connection field (parallel vs series). Its WDR encoding is:

| VCCon value | Meaning                                               |
| :---------: | ----------------------------------------------------- |
|      1      | Parallel (default; single-VC drivers always use this) |
|      2      | Series                                                |

**Save bug:** WinISD does not correctly persist the connection type on save. When you select serial in the UI and save,
the file is always written with `VCCon=1` (parallel) regardless of UI selection. Verified by creating two files — one
with serial selected, one with parallel — and observing identical byte output in both.

**Read is correct:** If `VCCon=2` is placed in the file by hand-editing, WinISD opens it and correctly displays serial
connection. Subsequent saves **preserve** the `VCCon=2` value — the bug only affects setting it via the UI dropdown.
Once `VCCon=2` is in the file, WinISD keeps it.

**ParState:** VCCon has **no ParState position** — confirmed by exhaustive single-param probe methodology (
drivers/sample/README.md). Even with all T/S params present and VCCon=1 in the file, no ParState position changes. VCCon
is pure WDR metadata, not part of WinISD's 49-position internal state machine.

**Implication for scraper:** Always write `VCCon=1`. Correct for all single-VC drivers and matches what WinISD writes.

**TODO — OpenISD WDR writer (future):** When OpenISD gains the ability to write WDR files, it must write `VCCon=2`
when the user has selected series wiring. The save bug is WinISD-specific — OpenISD's own writer should write the
correct value. See BACKLOG.md.

## 12b. Air Pressure field — clearing it triggers an unrecoverable crash loop (user-reported 2026-07-20)

**Bug:** In the environment inputs (Advanced pane / Options → General, where Air pressure is
entered, e.g. `101325.0` Pa), **clearing the Air Pressure field** puts WinISD into an
inescapable modal error loop reporting **"Cannot convert floating point number"**. The dialog
re-raises on every interaction, so the field can never be corrected — the only way out is to
**force-crash / kill the app**. An empty air-pressure value is evidently parsed as a float with
no empty-string guard, and the error handler re-enters the same parse.

**Source:** direct observation by the human (john), 2026-07-20. Not yet re-verified by an
automated probe here.

**Implication for OpenISD:** the equivalent field (`advPressure` in the field registry) must
guard an empty/blank entry — never parse a blank as a float and never leave the user trapped.
NumInput already reverts an invalid entry to the last valid value on blur; keep that behaviour
and cover it with a test so OpenISD cannot reproduce the WinISD trap.

## 12c. Thermal power-compression + driver added-mass ARE simulated (directly verified 2026-07-21)

The human ran controlled single-field tests in WinISD 0.7.0.950 (Driver pane → Advanced options),
watching the Impedance/SPL charts. This is **primary evidence** and overrides WinISD's own stale
help text (`thielesmall.html`) which claims the thermal params are "not used yet in simulations".

| Field changed                         | Observed                                          | Conclusion                                               |
| ------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| **Voice coil temp rise**              | Impedance floor rose ~21 → 23 Ω; SPL curve flexed | Hot `Re` is applied → **power compression is simulated** |
| **Voice coil resistance TC (AlfaVC)** | Impedance rose (with a temp rise set)             | AlfaVC scales the hot-`Re` term → **used**               |
| **Added mass to cone = 100 g**        | Impedance resonance peak moved 70 → 25 Hz         | Added straight into `Mms` → **used**                     |

The added-mass result also settles the **unit = grams**: `Fs ∝ 1/√Mms`, so 70→25 Hz means
`Mms` rose `(70/25)² = 7.84×`; a +100 g add implies `Mms_old ≈ 14.6 g` (a plausible cone mass).
100 kg would be nonsensical — confirms the field is grams, not kg (the screenshot transcription of
`view_1_driver_drivers_standard.md` wrongly reads "kg").

**Model:** `Re(hot) = Re·(1 + AlfaVC·ΔT)`, then all Re-dependent quantities (Qes, Qts, sensitivity,
impedance floor, Max-SPL) recompute from the hot Re. Added mass: `Mms += Madd`, then Fs/Qts/Vas-behaviour
follow. `R(t)`/`C(t)` (time-evolution of ΔT) were NOT tested and are bypassed when ΔT is entered directly.

**Implication for OpenISD:** these are genuine feature gaps, not WinISD-only inert inputs — OpenISD's
sweep assumes a cold, constant `Re` and ignores driver added-mass. See BACKLOG (power-compression model;
driver-side added mass). The field registry entries stay `modeled: false` until implemented.

### ⚠ Assumption — NOT directly verified

> **WinISD's Options → General "Environment" group (Temperature/Air pressure/Relative
> humidity) seeds a brand-new project's own Advanced-pane values.**

`docs/winisd/options_general.png` and `view_6_advanced.png` show identical values (293.15 K /
101325.0 Pa / 30.0000% / 343.68 m/s), consistent with the Options dialog's Environment group
being the app-level default that a new WinISD project's Advanced pane starts from. This has not
been confirmed by creating a fresh WinISD project after changing the Options dialog's values.

OpenISD implements the corresponding behaviour as its own design choice regardless of this
being unverified in real WinISD: `state.ui.envDefaults` (Options dialog → General → Environment)
seeds `OriginalShell.vue`/`ClassicShell.vue`'s local Advanced-pane refs on mount, replacing what
was a hardcoded literal — an already-open project's Advanced-pane values are never overwritten
by editing the Options dialog. See BACKLOG.md (Options dialog entry).

## 11. SpeakerBoxLite API — CORS finding

**Verified 2026-06-24** via curl.

The speakerboxlite.com REST API (`https://speakerboxlite.com/api/v1/speakers`) returns
`Access-Control-Allow-Origin: *` on **HEAD** requests but omits the CORS header entirely
on **GET** requests. Because browsers always use GET for `fetch()`, every browser-side
fetch to this API is blocked by the browser's CORS enforcement.

| Request type                     | CORS header present?                |
| -------------------------------- | ----------------------------------- |
| `HEAD /api/v1/speakers/count`    | ✅ `Access-Control-Allow-Origin: *` |
| `GET /api/v1/speakers/count`     | ❌ absent                           |
| `OPTIONS /api/v1/speakers/count` | ❌ absent                           |

This is a **server-side misconfiguration** on speakerboxlite.com — no client-side
workaround is possible. The site itself remains reachable (direct browser navigation works)
but JavaScript `fetch()` is blocked.

**OpenISD status:** SpeakerBoxLite is exposed as an opt-in button; clicking it immediately
hits this error. To re-enable, speakerboxlite.com would need to include
`Access-Control-Allow-Origin: *` on their GET responses, or OpenISD would need a CORS
proxy (introduces a server dependency).

## 13. Driver Editor UI — Complete field inventory

WinISD's driver editor has 4 tabs: General, Parameters, Advanced parameters, Dimensions.

### Screen 1: General Tab

1. Manufacturer
2. Brand
3. Model
4. Data provided by
5. Date added
6. Comment

### Screen 2: Parameters Tab

**Thiele/Small parameters:**

1. Qes (dimensionless)
2. Qms (dimensionless)
3. Qts (dimensionless)
4. Fs (Hz)
5. Vas (m³)

**Electro-Mechanical parameters:**

6. Mms (g)
7. Cms (mm/N)
8. Rms (Ns/m)
9. Re (ohm)
10. BL (Tm)
11. Dd (m)
12. Le (H)
13. Sd (cm²)
14. fLe (Hz)
15. KLe (mH*sqrt(Hz))

**Large-Signal parameters:**

16. Xmax (mm peak)
17. Hc (m)
18. Hg (m)
19. Vd (cm³)
20. Xlim (m)
21. Pe (W)

**Miscellaneous parameters:**

22. no (%)
23. Znom (ohm)
24. USPL (dB)
25. SPL (dB)
26. Voicecoils (count)
27. Connection (Parallel/Series)

### Screen 3: Advanced parameters Tab

**Thermal parameters:**

1. AlfaVC (1/K)
2. R(t) (K/W)
3. C(t) (J/K)

**Figure of merits:**

4. SPLmaxLF (dB)
5. SPLmax (dB)
6. Rme (Ns/m)
7. gamma (N/(A*kg))
8. Mpow (N/sqrt(W))
9. Mcost (Ns/m)
10. EBP (Hz)
11. Gloss (%)

**Environment parameters:**

12. c (m/s)
13. roo (kg/m³)

### Screen 4: Dimensions Tab

1. Thick (m)
2. Depth (m)
3. Magnet Depth (m)
4. Magnet (m)
5. Basket (m)
6. Outer (m)
7. VCd (m)
8. Dval (m³)

**Diagram labels:** Basket, Magnet, MagDpt, Outer, Thick, Depth

### 13.1 Field purposes — verified from WinISD help

Source: `research/winisd/help/thielesmall.html` (parameter explanations by Claus
Futtrup, in WinISD's own help), condensed. "OpenISD:" notes record how our engine
actually uses each field — verified against `packages/engine`.

**Thiele/Small**

- **Fs** — Free-air resonance frequency of the driver. _OpenISD: core input; every graph depends on it._
- **Qes** — Electrical Q (damping); ability to resonate at Fs by electrical means. Lower = more damped.
- **Qms** — Mechanical Q (damping); ability to resonate at Fs by mechanical means.
- **Qts** — Total damping = Qms ‖ Qes (parallel coupling). _Enter any 2 of the trio; the third is computed._
- **Vas** — Volume of air with the same compliance as the suspension (Cms). _Core input._

**Electro-mechanical**

- **Mms** — Moving mass of the vibrating parts including air load.
- **Cms** — Suspension compliance (inverse of spring stiffness).
- **Rms** — Mechanical damping (suspension friction + resistive part of the radiation load).
- **Re** — DC resistance of the voice coil. _OpenISD + WinISD power reference: P = V²/Re (see §1); Znom is NOT used._
- **BL** — Force factor: magnetic flux crossed with wire length in the gap.
- **Dd** — Diaphragm diameter (= our Cone ⌀; Sd = π·(Dd/2)²).
- **Le** — Voice-coil inductance. _OpenISD: only shapes the impedance plot — circuit.js keeps Le out of the acoustic path._
- **Sd** — Effective radiating (piston) area. _Core input._
- **fLe** — Frequency at which Le and KLe were measured (0 = standard Le model).
- **KLe** — Voice-coil semi-inductance [H·√Hz], Vanderkooy lossy-inductance model.

**Large-signal**

- **Xmax** — Max linear excursion, ≈ |Hc−Hg|/2, peak value. _OpenISD: cone-excursion limit + excursion-limited part of Max SPL._
- **Xlim** — Damage-limit excursion (peak). _WinISD field; not present in our WDR schema._
- **Hc** — Voice-coil winding height.
- **Hg** — Magnetic air-gap height.
- **Vd** — Volume displacement = Sd × Xmax (air moved in the linear range).
- **Pe** — Thermal-limited continuous power handling. _OpenISD: Max power + thermal-limited part of Max SPL._

**Miscellaneous**

- **no (η₀)** — Reference efficiency, %.
- **Znom** — Nominal impedance. **WinISD's own help: "(not used in simulation)."** _OpenISD matches exactly: label-only, written to the WDR, never simulated._
- **USPL** — Voltage sensitivity [dB/2.83 V]; closer to voltage-amplifier use, rises below 8 Ω.
- **SPL** — Power sensitivity [dB/W], 1 m, half-space (2π); directly related to η₀.
- **Voicecoils (numVC)** — Descriptive: number of voice coils (1 normal, 2 = dual-voice-coil).

**Thermal** — power-compression IS simulated (directly verified 2026-07-21, WinISD 0.7.0.950,
by the human — see §12c). WinISD's legacy `thielesmall.html` help text claims the thermal params are
"not used yet in simulations", but that text is **stale for this version**: the empirical test
below shows the impedance and SPL curves change when the thermal inputs change.

- **Voice coil temp rise** [K] (Driver pane → Advanced options) — the static coil ΔT above ambient.
  **USED**: raising it lifts hot `Re`, so the impedance floor rises and SPL drops (power compression).
- **AlfaVC** — VC resistance temperature coefficient [1/K]; copper ≈ 0.0039. **USED**: with a
  non-zero temp rise, `Re(hot) = Re·(1 + AlfaVC·ΔT)`; raising AlfaVC raises the impedance.
- **R(t)** — Thermal resistance, voice coil → ambient [K/W]. Governs how ΔT _evolves_ over time from
  power; **untested** — with temp rise set directly this is bypassed, so likely still inert.
- **C(t)** — Thermal capacity of the voice-coil assembly [J/K]. Same — time-domain dynamics, untested.

**Figure of merit** — all derived/read-only:

- **SPLmaxLF** — Loudness in a closed box/IB at max excursion at 20 Hz, half-space, 1 m.
- **SPLmax** — Max thermal-limited SPL at max Pe (assumes 3 dB compression), into 2π.
- **Rme** — Electromagnetic damping [N·s/m]; related to Qes as Rms is to Qms.
- **gamma** — Acceleration factor (per ampere) [m/(s²·A)].
- **Mpow** — Motor power factor [N/√W] (= √Rme); impedance-independent.
- **Mcost** — Motor "cost" factor [N·s/m] (T. L. Clarke extension of Rme).
- **EBP** — Efficiency-bandwidth product = Fs/Qes [Hz] (sealed < 50, vented > 100).
- **Gloss** — % of Xmax the cone sags if mounted horizontally (g = 9.80665 m/s²).

**Environment**

- **c** — Speed of sound [m/s]. _OpenISD: autofills to 343 m/s (state C), user-overridable._
- **roo (ρ)** — Air density [kg/m³]. _OpenISD: autofills to 1.2 (state C), user-overridable._

**Dimensions**

- **Thick** — Thickness of the basket flange plate.
- **Depth** — Overall driver depth.
- **Magnet Depth** — Magnet axial height/depth.
- **Magnet** — Magnet diameter.
- **Basket** — Basket diameter = the hole to cut in the baffle.
- **Outer** — Outer flange diameter = space to reserve on the baffle.
- **VCd** — Voice-coil diameter.
- **Dvol** — Driver displacement volume (box volume the driver occupies).

## 14. Suggested default units — frequency analysis from datasheets

Analysis of 411 driver datasheets identified the most common unit conventions per parameter.
This table shows WDR storage units (left) vs typical datasheet units (middle) and conversion factors.

| WDR param | WDR unit | Typical datasheet unit             | Conversion to WDR                    |
| --------- | -------- | ---------------------------------- | ------------------------------------ |
| Fs        | Hz       | Hz                                 | × 1                                  |
| Re        | Ω        | Ω                                  | × 1                                  |
| Znom      | Ω        | Ω                                  | × 1                                  |
| Pe        | W        | W                                  | × 1                                  |
| BL        | T·m      | Tm or T·m                          | × 1                                  |
| Qts       | —        | —                                  | × 1                                  |
| Qms       | —        | —                                  | × 1                                  |
| Qes       | —        | —                                  | × 1                                  |
| Le        | H        | mH                                 | ÷ 1,000                              |
| Xmax      | m        | mm                                 | ÷ 1,000                              |
| Mms       | kg       | g                                  | ÷ 1,000                              |
| Vas       | m³       | L (litres)                         | ÷ 1,000                              |
| Sd        | m²       | cm² (most) or m² (Tang Band)       | ÷ 10,000 if cm²                      |
| Cms       | m/N      | μm/N (Tang Band) or mm/N (some)    | ÷ 1,000,000 if μm/N; ÷ 1,000 if mm/N |
| Rms       | kg/s     | Rarely listed — derived            | —                                    |
| Dd        | m        | mm (voice coil diameter)           | ÷ 1,000                              |
| Vd        | m³       | Not listed — computed as Sd × Xmax | —                                    |

### Key gotchas

- **Cms** is the most dangerous — μm/N vs mm/N is a 1000× difference. SB Acoustics don't list Cms; Tang Band shows μm/N.
- **Sd:** Tang Band uses m² directly; SB Acoustics and most European drivers use cm².
- **Rms and Vd** are typically computed, not listed in datasheets — WinISD derives them internally.

### Unit cycle mapping — complete inventory (sorted by unit type)

| Field        | Unit Cycles                                    |
| ------------ | ---------------------------------------------- |
| Fs           | Hz / kHz                                       |
| fLe          | Hz / kHz                                       |
| EBP          | Hz / kHz                                       |
| Re           | Ω                                              |
| Znom         | Ω                                              |
| Qes          | —                                              |
| Qms          | —                                              |
| Qts          | —                                              |
| Dd           | m / mm / cm / in / ft / yd                     |
| Hc           | m / mm / cm / in / ft / yd                     |
| Hg           | m / mm / cm / in / ft / yd                     |
| Xmax         | m / mm / cm / in / ft / yd                     |
| Xlim         | m / mm / cm / in / ft / yd                     |
| Thick        | m / mm / cm / in / ft / yd                     |
| Depth        | m / mm / cm / in / ft / yd                     |
| Magnet Depth | m / mm / cm / in / ft / yd                     |
| Magnet       | m / mm / cm / in / ft / yd                     |
| Basket       | m / mm / cm / in / ft / yd                     |
| Outer        | m / mm / cm / in / ft / yd                     |
| VCd          | m / mm / cm / in / ft / yd                     |
| Vas          | cm³ / m³ / L / in³ / ft³                       |
| Vd           | cm³ / m³ / L / in³ / ft³                       |
| Dvol         | cm³ / m³ / L / in³ / ft³                       |
| Mms          | g / kg                                         |
| Sd           | m² / cm² / mm² / in² / ft² / yd²               |
| Cms          | m/N / μm/N / mm/N                              |
| Rms          | Ns/m / kg/s                                    |
| Rme          | Ns/m / kg/s                                    |
| Mcost        | Ns/m / kg/s                                    |
| Le           | mH / H / μH                                    |
| BL           | T·m                                            |
| KLe          | mH*sqrt(Hz) / H*sqrt(Hz)                       |
| Pe           | W                                              |
| Mpow         | N/sqrt(W)                                      |
| SPL          | dB                                             |
| SPLmaxLF     | dB                                             |
| SPLmax       | dB                                             |
| USPL         | dB                                             |
| c            | m/s / cm/s / ft/s / km/h / mph                 |
| roo          | kg/m³                                          |
| R(t)         | K/W                                            |
| C(t)         | J/K                                            |
| AlfaVC       | 1/K / 1000/K / 1/°C / 1000/°C / 1/°F / 1000/°F |
| gamma        | N/(A*kg)                                       |
| Gloss        | %                                              |
| no           | (unitless count)                               |
| Voicecoils   | (count)                                        |
| Connection   | Parallel / Series                              |

**Unit equivalence notes:**

- **gamma:** Both N/(A*kg) and m/(s²*A) are equivalent units. Proof: Start with T·m/kg, substitute Tesla (T = N/(A·m)) →
  N/(A·m) · m/kg = N/(A·kg), then substitute Newton (N = kg·m/s²) → (kg·m/s²) · 1/(A·kg) = m/(s²·A)

## 15. WinISD help file index

All 21 HTML files in `C:\ProgramData\winisd\help\` — read in full 2026-06-26.
Version: WinISD Pro 0.7 (Linearteam).

| File                                     | Key authoritative content                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `index.html`                             | Directory listing only                                                                    |
| `usingwinisd/gettingstarted.html`        | Project workflow, driver selection, EBP bar                                               |
| `usingwinisd/boxdesign.html`             | All box-design tabs; loss params (Ql/Qa/Qp); PR tab; Signal tab power convention          |
| `usingwinisd/newdriver.html`             | Driver entry, ParState colour coding, recommended entry order, Xmax = peak                |
| `usingwinisd/graphs.html`                | Every graph type; cone excursion modes (RMS/peak/p-p); port velocity limit 17 m/s         |
| `usingwinisd/plottypes.html`             | Duplicate of graphs.html (shorter form)                                                   |
| `usingwinisd/options.html`               | Options dialog: graph, general (env defaults), joystick                                   |
| `usingwinisd/filtersimulator.html`       | All filter types, Linkwitz transform, parametric EQ                                       |
| `usingwinisd/fsimexample.html`           | Subsonic filter for ported box; SOS with Q=1.5811 plate-amp example                       |
| `faq/faq.html`                           | Net vs gross box volume; port end correction 0.732; Vas air-dependence                    |
| `articles/thielesmall.html`              | Authoritative definitions of every T/S field (Claus Futtrup)                              |
| `articles/boxtypes.html`                 | Sealed/vented/PR/bandpass trade-offs                                                      |
| `articles/portterminology.html`          | End correction table: two-free=0.613, one-flanged+one-free=0.731, two-flanged=0.849       |
| `articles/crossovers.html`               | Passive/active crossover theory; cap/inductor formulas                                    |
| `articles/db_oct_hertz.html`             | dB, octave, hearing background                                                            |
| `technical/aboutequivalentcircuits.html` | Full equivalent circuit model; all key acoustical formulas; far-field pressure; impedance |
| `technical/closed.html`                  | Image only — closed box eq circuit diagram                                                |
| `technical/vented.html`                  | Image only — vented eq circuit diagram                                                    |
| `technical/pr.html`                      | Image only — passive radiator eq circuit diagram                                          |
| `technical/bp4.html`                     | Image only — 4th-order bandpass eq circuit diagram                                        |
| `technical/bp6a.html`                    | Image only — 6th-order bandpass type A eq circuit diagram                                 |

## 16. WDR fields that are non-functional in WinISD — historic parity only

These fields exist in the WDR format and are written by the data pipeline / OpenISD's own
writers for WinISD compatibility, but they have **no effect on any WinISD simulation output**. They are
present purely because real WinISD files contain them and omitting them could prevent correct
round-trip import. OpenISD includes them for historic parity with WinISD, not because they
drive any curve or calculation.

### Confirmed no simulation effect — WinISD help says so explicitly

| Field      | Source                                                                                         | What WinISD actually does with it                                                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Znom**   | `thielesmall.html`: _"not used in simulation"_                                                 | Label only — shown in the driver browser and editor as the nominal impedance rating. WinISD uses Re (not Znom) as the power/voltage reference throughout. OpenISD uses it for the 4Ω/8Ω/16Ω browser filter only. |
| **alfaVC** | WinISD legacy help text says _"not used yet"_ but **directly verified USED** 2026-07-21 (§12c) | VC resistance temperature coefficient. With a non-zero Voice-coil-temp-rise it scales hot `Re = Re·(1+AlfaVC·ΔT)` — raising it raises the impedance curve. WinISD's legacy help text is stale for 0.7.0.950.     |
| **Rt**     | `thielesmall.html`: _"not used yet in simulations"_ (untested)                                 | Thermal resistance (VC→ambient). Governs time-evolution of ΔT; bypassed when temp rise is set directly. Not re-tested.                                                                                           |
| **Ct**     | `thielesmall.html`: _"not used yet in simulations"_ (untested)                                 | Thermal capacity. Same time-domain dynamics — not re-tested.                                                                                                                                                     |

### Pure metadata — no functional role at all

| Field            | Notes                                                      |
| ---------------- | ---------------------------------------------------------- |
| **Manufacturer** | Separate from Brand; shown in the General tab editor only. |
| **ProvidedBy**   | Attribution text; shown in General tab only.               |
| **Comment**      | Free text note; shown in General tab only.                 |
| **DateAdded**    | Entry date; shown in General tab only.                     |
| **DateModified** | Last-edit date; shown in General tab only.                 |

### Physical dimensions — WinISD Dimensions tab, no simulation effect

All eight dimension fields (Thick, Depth, MagDepth, Magnet, Basket, Outer, Vcd, DVol) are
shown on the Dimensions tab for the builder's reference. **WinISD does not subtract driver
displacement (DVol) from box volume** — users must do that manually. Source: `faq.html`:
_"WinISD doesn't take driver displacement into account."_

These are written as `0` by the data pipeline because the data is not yet extracted from
datasheets. See the sibling winisd_tools repo's SCRAPING_TODO.md (Physical dimension extraction gap).

### Inert in practice — but WOULD affect output if entered

| Field       | What would actually change                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hc / Hg** | **Not truly inert.** When both are entered, WinISD computes `Xmax = \|Hc−Hg\|/2` (consistency group 19) and marks Xmax as C. That Xmax then affects the excursion limit line, the Xmax-limited part of the Max-SPL curve, and `Vd = Sd × Xmax`. These are an alternative, physically-grounded path to Xmax rather than entering it directly. In every file analysed they are 0 because engineers measure and enter Xmax directly. |
| **Mcost**   | Genuinely display-only. A figure-of-merit (T.L. Clarke motor cost factor) derived from Rme, Xmax, Hc, Hg. Appears in the Advanced parameters panel. No consistency group uses Mcost as an input to anything else — it does not feed back into any acoustic simulation curve. Zero in practice because it requires Hc/Hg to be populated.                                                                                          |
| **Dia**     | Superseded by Dd since WinISD alpha2 (2001). Still present in the canonical write order for legacy compatibility; Dd takes precedence. Source: `versions.txt alpha2`.                                                                                                                                                                                                                                                             |

### VCCon — sets UI dropdown; simulation effect for DVC unverified

VCCon (parallel/series) sets the connection-type dropdown when WinISD loads the file.
For **single-VC drivers** (VCCon=1, essentially all scraped files) this is a no-op — there
is only one configuration. For **dual-VC drivers** (numVC=2), the dropdown would logically
affect Re and BL (series doubles both; parallel halves Re), but whether WinISD actually uses
VCCon to adjust simulation calculations for DVC drivers **has not been verified** in our
primary-source testing. The save bug (§12) means VCCon=1 in all natively-saved WinISD files
anyway, so this path is never exercised by normal WinISD users.

## 17. SPL vs Transfer Function Magnitude charts — verified difference

**Source:** Screenshots captured from WinISD 0.7.0.950, project "Epique15 - pr", same cursor position (38.01 Hz, −9.896 dB shown top-right in both).

### Finding

Both charts display the **same underlying data series** (system frequency response). The only difference is Y axis reference:

| Chart                       | Y axis                         | Reference                                          |
| --------------------------- | ------------------------------ | -------------------------------------------------- |
| SPL                         | Absolute dB SPL at input power | Driver sensitivity + power offset                  |
| Transfer function magnitude | Relative dB                    | 0 dB = passband output; −3 dB reference line drawn |

The cursor readout (−9.896 dB at 38.01 Hz) is identical in both screenshots, confirming no separate computation.

### Implication for OpenISD

"Transfer function magnitude" is a **display mode on the SPL chart**, not a new engine series. Implementation: subtract the passband SPL reference level from the curve, draw 0 dB and −3 dB dashed reference lines, relabel Y axis from "dB SPL" to "dB".
