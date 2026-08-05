# Driver library data model

## File format — WDR

Each driver is a single `.wdr` file (WinISD Driver Record). The format is plain
`key=value`, one field per line, with a `[Driver]` section header. Standard fields
are defined by WinISD; unknown fields are silently ignored by WinISD and other
parsers, making the format safely extensible.

### Standard T/S fields

| Field        | Unit | Notes                                      |
| ------------ | ---- | ------------------------------------------ |
| `Brand`      | —    | Manufacturer name                          |
| `Model`      | —    | Model number                               |
| `Fs`         | Hz   | Free-air resonant frequency                |
| `Qts`        | —    | Total Q                                    |
| `Qes`        | —    | Electrical Q                               |
| `Qms`        | —    | Mechanical Q                               |
| `Vas`        | m³   | Equivalent acoustic compliance volume      |
| `Sd`         | m²   | Effective piston area                      |
| `Re`         | Ω    | DC voice-coil resistance                   |
| `Le`         | H    | Voice-coil inductance                      |
| `BL`         | T·m  | Force factor                               |
| `Xmax`       | m    | Linear peak excursion (one-way)            |
| `Mms`        | kg   | Moving mass including air load             |
| `Cms`        | m/N  | Mechanical compliance                      |
| `Rms`        | kg/s | Mechanical resistance                      |
| `Pe`         | W    | Rated power (RMS)                          |
| `Znom`       | Ω    | Nominal impedance                          |
| `Vd`         | m³   | Peak displacement volume (= Sd × Xmax)     |
| `Dd`         | m    | Effective piston diameter                  |
| `ProvidedBy` | —    | Free-text credit for who supplied the data |
| `Comment`    | —    | Free-text notes                            |

---

## Future feature: driver type classification and matching

This section documents the community rules that will underpin two planned
features:

1. **Type-based filtering** in the driver browser (tweeter / midrange / woofer /
   subwoofer / passive radiator / full-range)
2. **Matching assistant** — given a loaded driver, suggest complementary drivers
   from the library (e.g. "tweeters that pair well with the DS115-8")

> **⚠ UNVERIFIED DRAFT — for discussion only.**
> The rules below are written from general DIY and small-signal loudspeaker
> design understanding. No primary sources (textbooks, AES papers, or
> authoritative community references) were fetched or verified during this
> session. Every threshold and formula should be cross-checked before this
> section is treated as authoritative. Citations are TBD. Do not implement
> algorithms based on the numbers here without verification.

---

### Driver type classification

A driver's type is not stored in the WDR format. It must be inferred from T/S
parameters. The following heuristics are proposed for the browser filter:

| Type                 | Primary criterion     | Secondary checks                           |
| -------------------- | --------------------- | ------------------------------------------ |
| **Subwoofer**        | Fs < 35 Hz            | Sd large, Pe > 100 W, Xmax > 10 mm         |
| **Woofer**           | 35 Hz ≤ Fs < 100 Hz   | Sd > 80 cm², Pe > 30 W                     |
| **Mid-bass**         | 100 Hz ≤ Fs < 300 Hz  | Sd 30–150 cm²                              |
| **Midrange**         | 300 Hz ≤ Fs < 1000 Hz | Sd 5–50 cm²                                |
| **Full-range**       | 80 Hz ≤ Fs < 600 Hz   | Sd small (< 40 cm²), wide usable bandwidth |
| **Tweeter**          | Fs ≥ 1000 Hz          | Sd < 10 cm², Pe < 50 W                     |
| **Passive radiator** | No voice coil         | Re = 0 or missing, no Qes                  |

These thresholds are approximate. Many drivers (especially full-range) overlap
multiple categories. The classification should be a best-guess label, not a hard
gate. ⚠ thresholds need validation against the actual library contents.

Note: `Fs ≥ 1000 Hz` alone is a weak tweeter discriminator — many dome tweeters
have Fs in the 500–1000 Hz range and would be misfiled as midrange. `Sd < 10 cm²`
(small piston) is the stronger primary criterion for tweeters; `Fs` should be
used as a secondary check only.

---

### Crossover matching rules

The following rules define whether a given tweeter (or midrange) is a
reasonable crossover partner for a given woofer. All rules must be satisfied
simultaneously for a "good match" — a driver that passes only some is flagged as
a "marginal match."

#### Rule 1 — Tweeter minimum crossover (Fs constraint)

A tweeter should not be crossed below a multiple of its free-air resonance:

```
f_cross_min = k × Fs_tweeter
```

where **k = 3** is the minimum (⚠ some designers use 4). Crossing closer to Fs
causes elevated harmonic distortion and risks mechanical damage from over-excursion
near resonance.

Example: a tweeter with Fs = 1200 Hz must not be crossed below ~3600 Hz.

#### Rule 2 — Woofer maximum crossover (beaming constraint)

A direct-radiator piston begins to beam (narrows its horizontal dispersion) when
the acoustic wavelength approaches the piston circumference. Above this frequency
the off-axis response falls relative to on-axis, producing a narrow "listening
window." The onset frequency is approximately:

```
f_beam ≈ c / (π × Dd)
```

where **c = 344 m/s** (speed of sound) and **Dd** is the effective piston
diameter (m) derived from Sd: `Dd = 2 × √(Sd / π)`.

⚠ Convention matters: different communities pick different thresholds. `c/(π·Dd)`
is the ka=1 onset (circumference = wavelength), the most conservative limit. A
less conservative rule uses λ=Dd → `c/Dd` (~3× higher — e.g. 6½″: ~2650 Hz
instead of ~840 Hz). Switching conventions shifts the ceiling by a factor of 3,
so the choice is load-bearing. Treat the table values as conservative guidance
only; real drivers also deviate from an ideal rigid piston, and baffle width and
listening axis add further variation.

| Nominal size | Typical Sd | Dd (derived) | f_beam   |
| ------------ | ---------- | ------------ | -------- |
| 4″           | 53 cm²     | 82 mm        | ~1340 Hz |
| 5¼″          | 87 cm²     | 105 mm       | ~1040 Hz |
| 6½″          | 134 cm²    | 130 mm       | ~840 Hz  |
| 8″           | 214 cm²    | 165 mm       | ~665 Hz  |
| 10″          | 346 cm²    | 210 mm       | ~520 Hz  |
| 12″          | 506 cm²    | 254 mm       | ~430 Hz  |

The crossover must be set below `f_beam` to avoid a sudden on-axis peak at the
crossover frequency (the region where the woofer is still contributing but
beaming, while the tweeter has not yet taken over fully).

#### Rule 3 — Valid crossover window

Rules 1 and 2 define a window:

```
f_cross_min  (tweeter Fs × 3)  <  f_cross  <  f_cross_max  (woofer f_beam)
```

If the window is negative (tweeter Fs × 3 > woofer f_beam), the pair **cannot**
be crossed compatibly — the tweeter's minimum safe crossover is above the
woofer's beaming limit. Flag as incompatible.

If the window exists but is less than one octave, flag as "tight — requires
care."

#### Rule 4 — Sensitivity matching

The nominal SPL sensitivity of the two drivers at the crossover frequency should
be close. A large mismatch requires resistive padding (L-pad) on the louder
driver, which wastes power and raises the effective source impedance.

| SPL difference | Assessment                                                                  |
| -------------- | --------------------------------------------------------------------------- |
| ≤ 2 dB         | Excellent match                                                             |
| 2–4 dB         | Good — minor padding or baffle step correction will align                   |
| 4–6 dB         | Marginal — padding is needed; verify thermal power in the attenuated driver |
| > 6 dB         | Poor — large L-pad raises impedance, complicates crossover design           |

⚠ This rule applies at the crossover frequency, not at 1 W / 1 m. If a woofer
has rising response near its crossover and a tweeter has a peak around its Fs,
the effective sensitivity mismatch at the crossover frequency may differ from the
nominal SPL figures. Full FRD data is needed for accurate assessment.

#### Rule 5 — Power handling at the crossover frequency

The tweeter power rating must be adequate for the signal power that passes
through a high-pass filter at the chosen crossover frequency. For a 2nd-order
(12 dB/oct) Linkwitz-Riley filter, the power above the crossover is
approximately half the total amplifier power (⚠ simplified — actual depends on
programme content and filter shape).

A conservative guide: tweeter Pe should be ≥ 20% of the total system rated
power for a 2-way system at a moderate crossover slope. Higher-order filters
(24 dB/oct, 4th-order L-R) offer better tweeter protection.

---

### EBP as a box-type guide

The Efficiency Bandwidth Product `EBP = Fs / Qes` is a widely used heuristic
for which box type suits a woofer:

| EBP    | Suggests                                                                            |
| ------ | ----------------------------------------------------------------------------------- |
| < 50   | Sealed (IB) — driver has high Qes and is better damped electrically in a sealed box |
| 50–100 | Either sealed or vented — designer's choice                                         |
| > 100  | Vented — driver has low Qes and benefits from port tuning to restore bass extension |

⚠ EBP is a fast heuristic, not a substitute for modelling. A driver with EBP =
110 can still work well in a sealed box if cabinet size and desired extension
allow. Use it as the first-pass filter only.

---

### Passive radiator sizing rules

A passive radiator (PR) replaces the port in a vented alignment. Matching rules:

| Parameter    | Rule                                                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sd (PR)**  | ≥ Sd of the active driver, ideally 1.0–2.0× ⚠                                                                                                               |
| **Mmd (PR)** | Tuned so the PR-box resonance fb ≈ port-tuned equivalent: `Mmd ≈ (ρ₀ × c² × Sd_pr² ) / (Vas × (2π×fb)²)`. In practice, PRs ship with adjustable mass rings. |
| **Qms (PR)** | Should be >> 3 (very low mechanical loss); a lossy PR damps the tuning peak and lowers output near fb.                                                      |
| **Fs (PR)**  | Lower is better — ideally Fs_pr < fb so the PR moves freely at the tuning frequency.                                                                        |

---

### Proposed matching algorithm (future implementation)

Given a loaded driver D, a matching query returns candidate partners ranked by
suitability. Steps:

1. **Classify D** using the type heuristics above.
2. **Compute D's crossover constraint**:
   - If D is a woofer/mid-bass: `f_cross_max = c / (π × Dd_D)`
   - If D is a tweeter: `f_cross_min = 3 × Fs_D`
3. **For each candidate C in the library:**
   a. Classify C.
   b. Skip if C is the same type as D (woofer–woofer pairs are not relevant here).
   c. Compute the crossover window (Rule 3). Skip if window is negative.
   d. Score:
   - Window width in octaves (wider = better)
   - Sensitivity delta (smaller = better, > 6 dB = fail)
   - Power handling (Pe_tweeter vs system power estimate)
4. **Sort by score, return top N.**

The algorithm intentionally does not pick the crossover frequency — it tells the
designer whether a pair _can_ be crossed, not where to cross them. That choice
depends on room acoustics, baffle diffraction, and filter design, all of which
are outside the scope of T/S parameters alone.
