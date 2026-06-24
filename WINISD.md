# WinISD compatibility notes

This file records findings, assumptions, and open questions about how Resonate's
behaviour compares to WinISD (Linear Team, http://www.winISD.com/).  It distinguishes
between **confirmed** facts (user-observed, sourced), **inferred** conclusions
(deduced from data), and **unverified** assumptions (plausible but not confirmed).

---

## 1. SPL reference convention

### Observation (user-reported)
Same driver, same box: WinISD showed **92.6 dB**, Resonate showed **94.4 dB** —
a fixed +1.8 dB offset.

### Resonate's original formula
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

### Current Resonate implementation (matches WinISD)
```
eg = sqrt(Pin × Re)          // Re only — matches WinISD convention
Zcoil = (Re + Rs) + jω·Le   // Rs still in the circuit, just not the voltage reference
```

Note: 2.83 V is the IEC 60268-5 sensitivity standard and is *not* what WinISD uses.
WinISD's Re-based convention means its SPL curves are reference-power curves, not
IEC sensitivity curves.

### ✓ Confirmed: 2.83V IEC mode matches "2.83V/1m" datasheets for 8Ω drivers (2026-06-24)

Test driver: **Morel UW 1258** (8Ω nominal). Measured on IEC baffle, Brüel & Kjær 3144 mic.
Datasheet: **"Sensitivity 2.83V/1m 87 dB SPL"**
Resonate 2.83V IEC mode: **87 dB** ✓ — exact match (confirmed directly in Resonate, not via WinISD).

IEC baffle (1.2×1.2 m flat baffle) is half-space (2π sr) — identical to WinISD/Resonate radiation model.
For 8Ω drivers with explicit "2.83V/1m" datasheet specs, the 2.83V IEC mode is correct.

---

### ⚠ Observed sensitivity offset vs datasheet (2026-06-24)

Test driver: Tang Band W5-1138SMF (Re ≈ 3.24 Ω, 4 Ω nominal). Datasheet: **82 dB 1W/1m**.

| Drive condition | WinISD SPL | Spec |
|---|---|---|
| 1 W, 1.8 V (sqrt(Re)) | 79.75 dB | 82.00 dB → **−2.25 dB** |
| 1.5 W, 2.3 V | 82.3 dB | 82.00 dB → **≈ match** |

**Conclusion:** The datasheet "1W/1m" was measured at Z(1 kHz) ≈ 5.3 Ω, giving Vref = sqrt(5.3) ≈ 2.3 V.
WinISD uses sqrt(Re) = 1.8 V, which is lower, producing a ~2.25 dB systematic shortfall vs
manufacturer sensitivity specs for low-Re drivers.

**To match a datasheet sensitivity in WinISD/Resonate:** set input power so that
`sqrt(Pin × Re) ≈ sqrt(Z_measurement_freq)`, i.e. `Pin = Z_meas / Re` watts.
For this driver: Pin ≈ 5.3 / 3.24 ≈ 1.63 W.

---

## 2. Passive radiator parameter entry

### User-reported WinISD PR input fields
WinISD takes the following for a passive radiator:
```
Vas, Qms, Fs, Sd, Xmax, numPR, added_mass
```
WinISD **outputs** "Fs with added mass" — the free-air resonance of the PR with the
added mass attached (no box).

### Derivation WinISD performs
WinISD does **not** ask for Mms directly.  It derives it:
```
Cms = Vas / (Sd² × ρc²)
Mms = 1 / ((2π·Fs)² × Cms)
Rms = sqrt(Mms / Cms) / Qms
```
This is internally identical to entering {Mms, Cms, Rms} from a T/S datasheet — both
representations carry the same information.

Resonate's WinISD entry mode implements these exact conversions.

### "Fs with added mass" (WinISD output)
WinISD reports the **free-air** resonance after adding mass, not the in-box tuning
frequency Fp:
```
Fs_loaded = 1 / (2π · sqrt((Mms + Madd) · Cms))
           = Fs · sqrt(Mms / (Mms + Madd))
```
Resonate shows this as "Fs+mass" alongside the in-box Fp.  They differ because Fp is
lowered further by the box compliance.

### ⚠ Assumption — NOT directly verified
> **WinISD's Fs input is the unloaded free-air resonance of the PR (no added mass).**

This is the natural interpretation and is consistent with the conversion formulas, but it
has not been confirmed by testing an actual WinISD session with a known PR.

---

## 3. Multiple passive radiators (numPR)

WinISD accepts `numPR` as an input.  Resonate implements this as `prNum` (default 1).

**Physical effect of n identical PRs in parallel:**
- Combined acoustic mass: `Map_total = Map_single / n`
- Combined acoustic compliance: `Cap_total = n × Cap_single`
- Tuning frequency Fp is **unchanged** (the n factors cancel under the square root)
- Effective PR branch acoustic impedance: `Zpr_total = Zpr_single / n`
- SPL contribution from PR branch increases because lower Zpr means more volume velocity
  through the PR branch at a given driver drive
- Per-PR excursion = total PR volume velocity / (n × Sd)

Resonate implements this in `circuit.js` (scale `Zpr` by `1/n`) and `sweep.js`
(divide `excPR` by `n`).

### ⚠ Assumption
> **WinISD models n identical PRs as n acoustic elements in parallel.**

The physics is unambiguous; whether WinISD models it the same way has not been
cross-checked by comparing per-PR excursion curves.

---

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

---

## 5. Box losses (Ql, Qa, Qp) — confirmed from help file

**Sources:**
- `research/winisd/help/boxdesign.html` (extracted from official WinISD 0.7 installer)
- `research/winisd/versions.txt` — 0.50alpha1: *"Added advanced settings (Ql, Qa, Qp) for chambers."*
- `research/winisd/versions.txt` — 0.50alpha7: *"Box alignment calculation now considers external resistance and reduction of Q as box has some absorption loss. Leak losses are not considered when calculating alignments."* (confirms Ql and Qa are distinct; Ql excluded from alignment math)

WinISD models three independent box loss factors:

| Parameter | Meaning | WinISD default | Typical range |
|-----------|---------|---------------|--------------|
| Ql | Leakage losses (enclosure sealing, driver surround leaks) | **10** | 5–20 |
| Qa | Absorption losses (stuffing material) | 100 (no stuffing) | 3–5 (heavily stuffed) |
| Qp | Port losses (air friction in port) | 100 | — |

Combined: `1/Qlt = 1/Qa + 1/Ql + 1/Qp`

**Direct quote from help file:**
> "For reasonable quality box, WinISD pro uses Ql of **10** by default."

### UI location — confirmed from help file screenshots + direct user observation in 0.7.0.950

The losses control is an **"Advanced->" button at the bottom-left of the Box tab panel** —
NOT the top-level "Advanced" tab in the main window. Clicking it opens a popup listing
Ql / Qa / Qp with their current values; clicking any entry opens a small float window with
an editable field and a drag-square. Confirmed with screenshots in `research/winisd/help/`.

**Directly observed in WinISD 0.7.0.950 (2026-06-24):** Ql = 10.000, Qa = 100.000.
**Qp is NOT shown in the popup** — port losses appear to be either removed or hardcoded internally in 0.7.
The 0.50 alpha help file described Qp as a third entry; this no longer appears in the 0.7 UI.

Resonate exposes `Ql` (default 10), `Qa` (default 100), and `Qp` (default 100), matching WinISD.

**Practical Qa values (from DIYAudio community, thread 316996):**
- 100 — no stuffing (WinISD default)
- 20–50 — light stuffing
- 5–10 — heavy stuffing
- 3 — theoretical minimum; only achievable with a variovent

**Modelling limitation:** Real stuffing is not purely resistive. It also increases the apparent
box volume (velocity of sound is reduced in stuffed enclosures) and can modify driver Qms near
the driver cone. WinISD's resistive model (and Resonate's) captures only the damping component.
Cut-and-try with an impedance measurement is the only reliable way to determine real Qa.

---

## 6. Signal / voltage reference — confirmed from help file

**Source:** `research/winisd/help/boxdesign.html` and `plottypes.html`

> "Term 'power' should more correctly be voltage. This term 'power' comes from definition by
> Richard Small, who defined the input power to be P=Eg²/Re … where Eg is RMS output voltage
> of your amplifier, and Re is DC resistance of voice coil."

> "The power applied can be related to excitation voltage with following relation:
> **Eg = sqrt(P × Re)**, or P = Eg²/Re"

Series resistance (default **0.1 Ω**): included in the electrical circuit model but NOT in the
power-to-voltage conversion. Resonate matches this behaviour.

---

## 7. Group delay calibration

**Observation (2026-06-24):** Same driver + PR box, same parameters.

| | Resonate (before) | Resonate (after) | WinISD 0.7 |
|---|---|---|---|
| GD peak frequency | 58.9 Hz | 60 Hz | 61.9 Hz |
| GD peak magnitude | 11.4 ms | 12.1 ms | 12.2 ms |

**Root cause:** Resonate's Ql default was 7; WinISD's confirmed default is 10. Higher loss
(lower Ql) damps the resonance, shifting the peak down in frequency and reducing its magnitude.

**Fix applied:** Changed Ql default to 10 in `P_DEFAULTS` and circuit fallback.

**Remaining offset after Ql fix:** ~1.9 Hz in frequency. Root cause identified and fixed —
see section 9 (circuit model). Le was included in Resonate's acoustic circuit but WinISD
excludes it. Removing Le from the acoustic drive in WinISD mode resolved the offset.

**Final result (2026-06-24):** Resonate WinISD mode → **61 Hz / 12 ms**, WinISD → **61.9 Hz / 12.2 ms**. Essentially matched.

---

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

**Implication for Resonate:** Vb is treated as net acoustic volume, consistent with WinISD.
The UI should make this explicit. The Vb label tooltip should note "net acoustic volume".

---

## 9. Circuit model — WinISD vs Full Gyrator

**Source:** `research/winisd/help/aboutequivalentcircuits.html` (from official WinISD 0.7 installer)

WinISD's acoustic simulation works entirely in the **acoustical domain** using a simplified
constant-element model. Resonate implements both this model and a physically more complete one.

### WinISD model (default in Resonate — "WinISD" mode)

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

### Full gyrator model (Resonate "Full gyrator" mode)

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

| Mode | GD peak freq | GD peak mag |
|------|-------------|-------------|
| WinISD 0.7.0.950 (observed) | 61.9 Hz | 12.2 ms |
| Resonate — WinISD model (confirmed 2026-06-24) | **61 Hz** | **12 ms** |
| Resonate — Full gyrator | 60.0 Hz | 12.1 ms |

At 60 Hz: `jωLe ≈ j0.26 Ω` (4.6% of Re). This reactive component in ZaE shifts the
effective electrical Q and coupled system resonance by ~1.9 Hz in the full gyrator model.

### Resonate advantage over WinISD

| Feature | WinISD | Resonate |
|---------|--------|----------|
| Le in acoustic circuit | No (constant Rae) | Yes (full gyrator, switchable) |
| Box losses (Ql, Qa) | Ql + Qa via UI | Ql + Qa via UI |
| Series resistance Rs | Yes (Signal tab) | Yes |
| Filter / EQ chain | Yes | Yes |
| Passive radiator mode | Yes | Yes |
| Multiple drivers | Yes | Yes |
| Browser-based, no install | No | Yes |
| Open source | No | Yes |
| State persistence | Project files | localStorage (auto) |
| Driver library | Local .wdr files | Bundled JSON + browse |
| Compare designs | No | Yes (pin + overlay) |
| Cursor peak snap | No | Right-click on graph |
| Export | Print / project file | (planned) |

### Recommendation

Use **WinISD mode** (default) when cross-checking designs against WinISD.
Use **Full gyrator** when Le is large (>1 mH) or at higher frequencies where Le effects
are significant, accepting that results will differ slightly from WinISD.

---

## 10. Open questions

| # | Question | Priority |
|---|----------|----------|
| 1 | ~~Does WinISD use 2.83 V fixed or `sqrt(Pin × Z_nom)`?~~ **RESOLVED: uses `Eg = sqrt(P × Re)`** — confirmed in WinISD help file | Closed |
| 2 | ~~Does WinISD include Le in its acoustic circuit model?~~ **RESOLVED: No. Le only for impedance. Source: aboutequivalentcircuits.html** | Closed |
| 3 | ~~Does WinISD model box leakage (Ql)?~~ **RESOLVED: Ql=10, Qa=100, Qp=100; entry via "Advanced->" button in the Box tab panel (not the top-level Advanced tab). Confirmed by help file text + screenshots boxdes05/06.** | Closed |
| 4 | ~~What radiation model does WinISD use?~~ **RESOLVED: half-space (infinite baffle). Formula `p(r) = ρ·ω·U0/(2π·r)` confirmed in `aboutequivalentcircuits.html`. Resonate uses identical formula.** | Closed |
| 5 | Does WinISD account for air load (radiation mass) on the PR separately from Mms? | Low |
| 6 | Does WinISD's Qms in PR mode mean the same as T/S Qms? | Low |
