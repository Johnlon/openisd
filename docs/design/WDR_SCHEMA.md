# WDR Schema

**Authoritative reference for the WDR file format.**

> ## PROVENANCE — THIS DOCUMENT IS OUR OWN RESEARCH
>
> **Everything here was reverse-engineered by us** — from observing WinISD Pro's behaviour,
> reading `.wdr` files it wrote, and inspecting ASCII strings in `winisd.exe`. **It is NOT
> official documentation, NOT derived from WinISD source, and NOT independently verified by
> any third party.** "Authoritative" above means _this is the one place we state our
> understanding_, not _this has been confirmed by someone else_.
>
> Four consequences a reader must hold on to:
>
> 1. **It cannot VERIFY our own implementation.** Checking our code against this document is
>    circular — these are our notes about the very thing the code implements. Independent
>    confirmation has to come from outside: the theory canon (Thiele/Small, Leach, Klippel),
>    independent implementations, or datasheets that print both an equation's inputs and its
>    result. See `../winisd_tools/CALCULATIONS.md` §4.1.
> 2. **Confidence varies per row and is stated per row.** Some facts carry an empirical
>    verification date; others are marked "assumption", "inferred", or "exact formula
>    unknown". **An unmarked claim is observed-but-unproven, not fact.**
> 3. **WinISD cannot be driven automatically** — a Windows GUI with no CLI and no API. Every
>    observation here was made BY HAND, one driver at a time, in a dated session. That is the
>    ceiling on how much of this can ever be confirmed, and why the per-row dates matter.
>    Automating it would mean driving the `.exe` UI (Wine + input automation, or a Windows VM
>    with pywinauto/AutoHotkey) — a real project, not a test harness we have.
> 4. **Where WinISD deviates from textbook acoustics, the `.wdr` must match WINISD.** It is
>    the consumer. This document records what WinISD DOES, which is not always what the
>    theory says it should do.

## 1. File format

`.wdr` is WinISD Pro's driver file format. It is a plain-text INI-style file.

| Property            | Value                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section header      | `[Driver]` — must be the first line; no other sections                                                                                                                     |
| Field separator     | `=` with no spaces (`Key=Value`)                                                                                                                                           |
| Decimal separator   | `.` (period)                                                                                                                                                               |
| Encoding            | UTF-8 (⚠ assumption — not directly verified from WinISD source code)                                                                                                       |
| Line endings        | CRLF (⚠ assumption — Windows application)                                                                                                                                  |
| Field order         | **Observed consistent** across 423 `drivers/matt/` files and 53 WinISD-generated probe files — whether WinISD enforces order on read is untested                           |
| Total native fields | 56 (7 metadata + 48 numeric/string + 1 ParState) — WinISD always writes all 56 on save; scraper-generated files may have only 27–29 (core T/S block) and WinISD loads them |
| Custom fields       | Observed after `ParState=` only — not verified that WinISD ignores pre-ParState unknowns                                                                                   |

WDR files contain only WinISD-native fields. Provenance and quality metadata is not
carried in a WDR at all — it lives in the driver record (`openisd.yml`).

Source for structural claims: direct analysis of 423 `drivers/matt/` files plus 53 WinISD-generated single-field probe files from `drivers/sample/` (2026-06-28).

## 2. Canonical field order

All 423 `drivers/matt/` files and all 53 WinISD probe files use this order — observed universally consistent. WinISD always writes in this order on save. Whether it enforces order on read is untested; because WinISD loads short-format files (27–29 fields) correctly, it likely reads by key name.

```
Brand, Model, Manufacturer, ProvidedBy, Comment, DateAdded, DateModified
Qts, Znom, Fs, Pe, SPL, Re, Le
fLe, KLe, BL, Xmax, Cms, Qms, Qes
Rms, Mms, Sd, Vas, Dia, Vd, no
Dd, EBP, numVC, Hc, Hg, SPLmax, SPLmaxLF
USPL, alfaVC, Rt, Ct, gamma, Rme, Mpow
Mcost, Gloss, VCCon, c, roo, Thick, Depth
MagDepth, Magnet, Basket, Outer, Vcd, DVol, ParState
```

**That is all this order is good for.** Key order carries no meaning in an INI file, so it
groups nothing and implies nothing. What each field MEANS, its unit, its ParState position and
how WinISD calculates it are in §3, grouped by what the quantity is.

## 3. Field reference

Sources: WinISD help files (`articles/thielesmall.html`, `usingwinisd/newdriver.html`,
etc.) read directly 2026-06-26; winisd.exe binary strings extracted 2026-06-26;
direct analysis of 423 WDR files from `drivers/matt/` (human-curated, authoritative). All values are SI units.

**Grouped by what the quantity IS**, not by where it lands in the file — key order in an INI
file is arbitrary and tells you nothing (§2). A field sits with the fields it is physically
related to and calculated from.

**The `Calculated by` column is in firing order, and that order is a priority.** WinISD's
calculation engine is one linear sequence of guarded compute sites, re-run until a pass changes
nothing. Within a pass the sites run in a fixed order, so where a field lists several forms,
**the first one whose inputs are all available wins** — they are numbered `1.`, `2.`, … in that
order. A field showing one form has exactly one route; a field showing none is entered or absent
and WinISD will never fill it.

### <a id="grp-meta"></a>3.1 Identity and provenance

| Field        | Type   | Format   | Description                                                                                        |
| ------------ | ------ | -------- | -------------------------------------------------------------------------------------------------- |
| Brand        | string |          | **Mandatory.** Manufacturer brand name. See multi-word brands list in `drivers/README.md`.         |
| Model        | string |          | **Mandatory.** Driver model number/name verbatim from datasheet.                                   |
| Manufacturer | string |          | Left blank by scrapers. WinISD-native field; present in the file as `Manufacturer=` with no value. |
| ProvidedBy   | string |          | Data source attribution, e.g. `SB Acoustics website (scraped 2026-06-27)`.                         |
| Comment      | string |          | Free text. OpenISD scrapers use this for source URL and caveats.                                   |
| DateAdded    | string | YYYYMMDD | Date driver was added; no separators (e.g. `20260627`). See §5.4 for date rules.                   |
| DateModified | string | YYYYMMDD | Date of last refresh; no separators. Updated by scrapers on each run.                              |

### <a id="grp-electrical"></a>3.2 Electrical

The voice coil as the amplifier sees it. `Le`, `fLe` and `KLe` shape the impedance curve only — they are not in the acoustic circuit.

| Field | Unit    | ParState | Calculated by                                                                                                                                                                 | Probe          | Description                                                                                                                                                                                                                                      |
| ----- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Re    | Ω       | 5        | 1. `Re = (ρ₀/(2π·c))·BL²·Sd² / (Mms²·no)` [15](#rel-15)<br>2. `Re = Qes·BL² / (2π·Fs·Mms)` [2](#rel-2)<br>3. `Re = (BL/Mpow)²` [8](#rel-8)<br>4. `Re = BL² / Rme` [3](#rel-3) | `s-re`         | DC voice coil resistance (measured with ohmmeter).                                                                                                                                                                                               |
| Znom  | Ω       | 1        | `Znom = 2·round_half_to_even(0.75·Re)` [23](#rel-23)                                                                                                                          | `s-znom`       | Nominal impedance. **Descriptive only — not used in WinISD simulation**, but **CALCULATED from `Re`** when left blank (§4.2). Enter it explicitly to pin a value the rule would not give — WinISD never corrects an entered `Znom` against `Re`. |
| Le    | H       | 6        | never — input to [24](#rel-24) only                                                                                                                                           | `s-le`         | Voice coil inductance. Used only for impedance curves; not included in the acoustic circuit. Source: aboutequivalentcircuits.html.                                                                                                               |
| fLe   | Hz      | 7        | never — input to [24](#rel-24) only                                                                                                                                           | `s-fle`        | Frequency at which Le and KLe were measured. `0` = use standard Le model only.                                                                                                                                                                   |
| KLe   | H·√Hz   | 8        | `KLe = Le·√(2π·fLe)` [24](#rel-24)                                                                                                                                            | `s-kle`        | Voice coil semi-inductance (Vanderkooy model). `0` = model not active.                                                                                                                                                                           |
| numVC | integer | 24       | never — entered or absent                                                                                                                                                     | `s-voicecoils` | Number of voice coils. `1` for most drivers; `2` for dual-voice-coil.                                                                                                                                                                            |
| VCCon | integer | 47       | never — entered or absent                                                                                                                                                     | `(binary)`     | `1` = parallel, `2` = series. **Save bug:** WinISD always writes `VCCon=1` on save regardless of UI selection. `VCCon=2` can only be set by hand-editing the file; subsequent saves preserve it. Verified 2026-06-26.                            |

### <a id="grp-moving"></a>3.3 Moving system

Mass, compliance and the resonance they set — the driver as a spring-mass system, independent of the motor. `Vas` is `Cms` restated as a volume of air; `Gloss` is what gravity does to that spring.

| Field | Unit     | ParState | Calculated by                                                                                                                                                                                                                        | Probe     | Description                                                                                                                                                                                                                                                    |
| ----- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fs    | Hz       | 2        | 1. `Fs = 1 / (2π·√(Mms·Cms))` [11](#rel-11)<br>2. `Fs = ∛(no·c³·Qes / (4π²·Vas))` [14](#rel-14)<br>3. `Fs = Qes·BL² / (2π·Mms·Re)` [2](#rel-2)<br>4. `Fs = Rme·Qes / (2π·Mms)` [4](#rel-4)<br>5. `Fs = EBP·Qes` [12](#rel-12)        | `s-fs`    | **Mandatory for woofers and midranges.** Free-air resonance frequency. AMT tweeters and compression drivers may legitimately omit Fs — the schema does not require it; the scraper must log its absence as a problem for human review.                         |
| Mms   | kg       | 17       | 1. `Mms = 1 / ((2π·Fs)²·Cms)` [11](#rel-11)<br>2. `Mms = BL·Sd·√(ρ₀ / (2π·c·no·Re))` [15](#rel-15)<br>3. `Mms = Qes·BL² / (2π·Fs·Re)` [2](#rel-2)<br>4. `Mms = Rme·Qes / (2π·Fs)` [4](#rel-4)<br>5. `Mms = BL / gamma` [13](#rel-13) | `s-mms`   | Moving mass including air load.                                                                                                                                                                                                                                |
| Cms   | m/N      | 12       | 1. `Cms = Vas / (ρ₀·c²·Sd²)` [10](#rel-10)<br>2. `Cms = 1 / ((2π·Fs)²·Mms)` [11](#rel-11)                                                                                                                                            | `s-cms`   | Mechanical compliance (inverse of stiffness). Most dangerous unit — SB Acoustics doesn't list Cms; Tang Band uses μm/N (÷1,000,000).                                                                                                                           |
| Vas   | m³       | 20       | 1. `Vas = no·c³·Qes / (4π²·Fs³)` [14](#rel-14)<br>2. `Vas = ρ₀·c²·Sd²·Cms` [10](#rel-10)                                                                                                                                             | `s-vas`   | Equivalent compliance volume — `Cms` restated as the volume of air with the same springiness. Source: faq.html.                                                                                                                                                |
| Gloss | fraction | 38       | 1. `Gloss = g / ((2π·Fs)²·Xmax)` [21](#rel-21)<br>2. `Gloss = g / ((2π·Fs)²·Xmax)` [21](#rel-21)                                                                                                                                     | `s-gloss` | Cone sag when the driver is mounted horizontally, as a **fraction of `Xmax`** (multiply by 100 for %). Drivers with Gloss > 0.05 should not be mounted horizontally. Gravity constant 9.80665 m/s². Corrected from versions.txt alpha6 + help file 2026-06-26. |

### <a id="grp-damping"></a>3.4 Damping

How the resonance is damped, mechanically and electrically. The three Q factors and the two resistances are five views of the same thing: `Qms`/`Rms` are the mechanical loss, `Rme` the motor loss, `Qes` its Q, and `Qts` the two Qs in parallel.

| Field | Unit  | ParState | Calculated by                                                                                                                                                                                                                | Probe   | Description                                                                                                                               |
| ----- | ----- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Qms   | —     | 13       | 1. `Qms = 1 / (2π·Fs·Cms·Rms)` [1](#rel-1)<br>2. `Qms = (Qts·Qes) / (Qes − Qts)` [5](#rel-5)                                                                                                                                 | `s-qms` | Mechanical Q. Higher Qms = less mechanical damping = sharper resonance.                                                                   |
| Qes   | —     | 14       | 1. `Qes = 2π·Fs·Mms·Re / BL²` [2](#rel-2)<br>2. `Qes = 2π·Fs·Mms / Rme` [4](#rel-4)<br>3. `Qes = (4π²/c³)·Fs³·Vas / no` [14](#rel-14)<br>4. `Qes = (Qts·Qms) / (Qms − Qts)` [5](#rel-5)<br>5. `Qes = Fs / EBP` [12](#rel-12) | `s-qes` | Electrical Q. Higher Qes = less electromagnetic damping.                                                                                  |
| Qts   | —     | 15       | `Qts = (Qms·Qes) / (Qms + Qes)` [5](#rel-5)                                                                                                                                                                                  | `s-qts` | **Do not enter Qts manually when Qms and Qes are both present** — write `Qts=C` in ParState and let WinISD compute it. See §5.1.          |
| Rms   | kg/s  | 16       | `Rms = 1 / (2π·Fs·Cms·Qms)` [1](#rel-1)                                                                                                                                                                                      | `s-rms` | Mechanical damping from friction and radiation load. Rarely listed in datasheets — usually computed by WinISD from Qms, Mms, Fs.          |
| Rme   | N·s/m | 35       | 1. `Rme = 2π·Fs·Mms / Qes` [4](#rel-4)<br>2. `Rme = BL² / Re` [3](#rel-3)<br>3. `Rme = Mpow²` [9](#rel-9)<br>4. `Rme = Mcost / (1 + Xmax/min(Hc, Hg))` [7](#rel-7)                                                           | `s-rme` | Electromagnetic damping factor. Analogous to Rms but for the motor system. Source: winisd.exe strings + thielesmall.html (Claus Futtrup). |

### <a id="grp-motor"></a>3.5 Force factor and motor figures of merit

`BL` is the primary motor quantity; the rest are figures of merit derived from it and are largely unique to WinISD — most datasheets do not print them.

| Field | Unit     | ParState | Calculated by                                                                                                                                                                                                                                                             | Probe     | Description                                                                                                                                             |
| ----- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BL    | T·m      | 9        | 1. `BL = √(ρ₀·c²·Sd²·Re / (2π·Fs·Qes·Vas))` [27](#rel-27)<br>2. `BL = (Mms/Sd)·√(2π·c·no·Re / ρ₀)` [15](#rel-15)<br>3. `BL = √(2π·Fs·Mms·Re / Qes)` [2](#rel-2)<br>4. `BL = gamma·Mms` [13](#rel-13)<br>5. `BL = Mpow·√Re` [8](#rel-8)<br>6. `BL = √(Rme·Re)` [3](#rel-3) | `s-bl`    | Force factor. **Case-sensitive: `BL=` not `Bl=`** — WinISD imports `BL=` only.                                                                          |
| Mpow  | N/√W     | 36       | 1. `Mpow = BL / √Re` [8](#rel-8)<br>2. `Mpow = √Rme` [9](#rel-9)                                                                                                                                                                                                          | `s-mpow`  | Motor power factor. Linear measure in Newtons, independent of impedance level. Source: thielesmall.html (Claus Futtrup) + winisd.exe relation groups.   |
| gamma | m/(s²·A) | 33       | `gamma = BL / Mms` [13](#rel-13)                                                                                                                                                                                                                                          | `s-gamma` | Acceleration factor. **NOT the adiabatic index** (common confusion from the Greek symbol). Source: winisd.exe strings, relation group "Gamma, Bl, Mms". |
| EBP   | Hz       | 34       | `EBP = Fs / Qes` [12](#rel-12)                                                                                                                                                                                                                                            | `s-ebp`   | Efficiency bandwidth product. Rule of thumb: < 50 → sealed; > 100 → vented.                                                                             |
| Mcost | N·s/m    | 37       | `Mcost = Rme · (1 + Xmax/min(Hc, Hg))` [7](#rel-7)                                                                                                                                                                                                                        | `s-mcost` | Motor cost factor. Expresses motor power relative to Rme, Xmax and the coil/gap heights. Source: thielesmall.html (T.L. Clarke) + winisd.exe strings.   |

### <a id="grp-radiating"></a>3.6 Radiating area and excursion

How much air the cone moves. `Dia` and `Xlim` are the two fields the UI cannot round-trip — see §3.6.1.

| Field | Unit | ParState | Calculated by                                                                                                                                                                              | Probe        | Description                                                                                                                                                                                                                                                                                                                                            |
| ----- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sd    | m²   | 18       | 1. `Sd = π·Dd² / 4` [6](#rel-6)<br>2. `Sd = Vd / Xmax` [20](#rel-20)<br>3. `Sd = (Mms/BL)·√(2π·c·no·Re / ρ₀)` [15](#rel-15)<br>4. `Sd = √(Vas / (ρ₀·c²·Cms))` [10](#rel-10)                | `s-sd`       | Effective piston radiating area.                                                                                                                                                                                                                                                                                                                       |
| Dd    | m    | 22       | `Dd = 2·√(Sd / π)` [6](#rel-6)                                                                                                                                                             | `s-dd`       | Effective piston diameter.                                                                                                                                                                                                                                                                                                                             |
| Dia   | m    | 21       | never — entered or absent                                                                                                                                                                  | `(binary)`   | The DIAPHRAGM diameter, superseded by `Dd` — **NOT the voice coil diameter**, which is `Vcd` (§3.6). See below.                                                                                                                                                                                                                                        |
| Xmax  | m    | 10       | 1. `Xmax = abs(Hc − Hg) / 2` [19](#rel-19)<br>2. `Xmax = Vd / Sd` [20](#rel-20)<br>3. `Xmax = min(Hc, Hg) · (Mcost/Rme − 1)` [7](#rel-7)<br>4. `Xmax = g / ((2π·Fs)²·Gloss)` [21](#rel-21) | `s-xmax`     | **One-way PEAK linear excursion in metres.** Not RMS, not peak-to-peak. WinISD uses the raw value — no correction factors applied (some references multiply by 1.15 or 0.87; WinISD does not). Some manufacturers publish the damage limit (Xlim) instead of the linear limit — always use the linear limit. Source: thielesmall.html, plottypes.html. |
| Xlim  | m    | 11       | never — entered or absent                                                                                                                                                                  | `s-xlim-123` | Damage-limited excursion. **No WDR key** — the value is discarded on save and only the ParState mark survives (§3.6.1).                                                                                                                                                                                                                                |
| Vd    | m³   | 19       | 1. `Vd = Sd·Xmax` [20](#rel-20)<br>2. `Vd = 10^(SPLmaxLF/20) · (2π·√2) · 20µPa / (ρ₀·(2π·20)²)` [22](#rel-22)                                                                              | `s-vd`       | Volume displacement. **Display unit:** WinISD shows Vd in cm³ in the UI (e.g. `Vd=0.0002` displays as `200 cm³`). Confirmed 2026-06-28.                                                                                                                                                                                                                |

Two first-party sources, and they agree:

- `research/winisd/versions.txt`, **0.50alpha3 [01.01.2002]**, under _Fixes_:
  _"Tiny driver parameter window: "dia" replaced by Dd."_ That is the ONLY mention of either
  `dia` or `Dd` anywhere in the changelog.
- `research/winisd/help/thielesmall.html` glosses **`Dd` = "Diameter of Diaphragm"** and,
  separately, **`VCd` = "Voice coil diameter."**

So `dia` → `Dd` is a diaphragm-diameter field being renamed, which is what "dia" is short for.
The voice coil diameter is `Vcd` (control `edVcd`, UI label "VCd"), a
different field that still works — so `Dia` cannot be it, and a `Dia` row reading "Voice coil
diameter" contradicts the help file.

**Save bug:** `Dia` is written to every WDR — always as `0`, because its editor control
`eddia` is a `TEdit` with **`Visible = False`** (position table, row 21), so the field cannot be
reached and nobody can enter one. Nothing computes it either, which is why slot 21 is `N` in
every WinISD-authored file.

It is not inert, though. A `Dia` already present in the file **survives a load-and-save**:
`s-dia-roundtrip-123.wdr` carries `Dia=123`, added by hand and then cycled through WinISD, which
read it, kept it and wrote it back. `s-dia-natural.wdr` is the same driver without one, recording
that the condition cannot be produced through the UI at all. Verified 2026-08-16.

Same family as the `VCCon` save bug (§3.2) and the `Xlim` bug below: a field the UI cannot set
correctly, whose hand-written value WinISD nonetheless preserves across saves.

#### 3.6.1 `Dia` and `Xlim` — one slot each, one half broken each

Both have a ParState slot AND a registered editor control. They fail in opposite halves:

|        | ParState slot | editor control                     | WDR key  | net effect                                                              |
| ------ | ------------- | ---------------------------------- | -------- | ----------------------------------------------------------------------- |
| `Xlim` | 11            | `edXlim`, **visible and editable** | **none** | you can type a value; the SAVE throws it away and keeps only the mark   |
| `Dia`  | 21            | `eddia`, **`Visible = False`**     | `Dia=`   | the value saves fine; you can never type one, so the mark is always `N` |

So one is a live control with nowhere to write, and the other is a writable key with no reachable
control. Neither is a slot-without-a-field or a field-without-a-slot — that framing is wrong. Both
are fully wired inside WinISD: each has its own storage, its own ParState slot and its own editor
control. `Xlim` is simply absent from the list of keys the save routine writes.

**Xlim save bug:** `s-xlim-123.wdr` (Xlim set to 123, then saved) contains no `Xlim=` line and
every numeric line still `0`, with slot 11 = `E`. Compare `s-fs.wdr`, the same experiment on a
field that works: `Fs=123` written AND slot 2 = `E`. The `.wpr` behaves the same way —
`docs/winisd/sample_project_Epique15_-_pr.wpr` has no `Xlim=` key in its `[Driver]` section
either, though that sample's slot 11 is `N`, so it is not a positive test. Verified 2026-08-16.

### <a id="grp-coilgap"></a>3.7 Voice coil and gap geometry

The coil-and-gap dimensions. All three sit on the WinISD Dimensions tab but they are motor quantities, not mounting ones: `Hc` and `Hg` set `Xmax` ([relation 19](#rel-19)) and `Vcd` shapes the displaced volume (§3.10.1).

| Field | Unit | ParState | Calculated by                                                                                                                                  | Probe   | Description                                                                                                                                                                                                             |
| ----- | ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hc    | m    | 25       | 1. `Hc = 2·Xmax + Hg   (branch taken when Hg ≤ 2·Xmax)` [19](#rel-19)<br>2. `Hc = Hg − 2·Xmax   (branch taken when Hg > 2·Xmax)` [19](#rel-19) | `s-hc`  | Height of voice coil winding.                                                                                                                                                                                           |
| Hg    | m    | 26       | 1. `Hg = Hc − 2·Xmax   (branch taken when Hc ≥ 2·Xmax)` [19](#rel-19)<br>2. `Hg = 2·Xmax + Hc   (branch taken when Hc < 2·Xmax)` [19](#rel-19) | `s-hg`  | Height of magnetic airgap.                                                                                                                                                                                              |
| Vcd   | m    | 45       | never — input to [25](#rel-25) only                                                                                                            | `s-vcd` | Voice coil diameter — `help/thielesmall.html`: _"VCd — Voice coil diameter."_ The WDR key is `Vcd=` (lowercase d) while the WinISD UI shows "VCd". NOT to be confused with `Dia` (§3.5), which is a diaphragm diameter. |

### <a id="grp-sensitivity"></a>3.8 Sensitivity and output limits

How loud it goes. Everything here except `Pe` descends from `SPL`, so all of it reads `0` until `SPL` is established.

| Field    | Unit     | ParState | Calculated by                                                                                                                                                           | Probe        | Description                                                                                                                                                                                                                                                                                        |
| -------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPL      | dB/W/1m  | 4        | `SPL = 10·log₁₀(no) + 10·log₁₀(ρ₀·c²/(2π)) + 109` [18](#rel-18)                                                                                                         | `s-spl`      | Power sensitivity. `0` if not set. Source: plottypes.html.                                                                                                                                                                                                                                         |
| no       | fraction | 23       | 1. `no = (4π²/c³)·Fs³·Vas / Qes` [14](#rel-14)<br>2. `no = (ρ₀/(2π·c))·BL²·Sd² / (Mms²·Re)` [15](#rel-15)<br>3. `no = 10^((SPL − 109)/10) · 2π / (ρ₀·c²)` [18](#rel-18) | `s-no`       | Limit efficiency η₀ — the theoretical efficiency the driver approaches at infinite frequency. **Stored as fraction, displayed as % in the WinISD UI** (e.g. `0.000754` = 0.0754%). The transfer-function magnitude plot shows gain in dB relative to η₀. Source: thielesmall.html, plottypes.html. |
| USPL     | dB/2.83V | 29       | `USPL = SPL + 10·log₁₀(8/Re)` [17](#rel-17)                                                                                                                             | `s-uspl`     | Voltage sensitivity. More application-relevant than SPL for voltage-amplifier use. Source: thielesmall.html.                                                                                                                                                                                       |
| SPLmax   | dB       | 27       | `SPLmax = SPL + 10·log₁₀(Pe) − 3` [16](#rel-16)                                                                                                                         | `s-splmax`   | Max thermal SPL at `Pe`. Source: winisd.exe relation group.                                                                                                                                                                                                                                        |
| SPLmaxLF | dB       | 28       | `SPLmaxLF = 20·log₁₀(ρ₀·(2π·20)²·Vd / (2π·√2) / 20µPa)` [22](#rel-22)                                                                                                   | `s-splmaxlf` | Max excursion-limited SPL at 20 Hz in a closed box, half-space. **Does not apply to vented or other assisted enclosures.** Source: thielesmall.html, winisd.exe relation group.                                                                                                                    |
| Pe       | W        | 3        | `Pe = 10^((SPLmax − SPL + 3)/10)` [16](#rel-16)                                                                                                                         | `s-pe`       | Thermal limited max. continuous power handling. If driven above Pe continuously, the driver will fail. Source: thielesmall.html.                                                                                                                                                                   |

### <a id="grp-thermal"></a>3.9 Thermal model

Voice-coil heating. WinISD reads these three and **computes none of them** — all three are entered or absent, with no third option.

| Field  | Unit | ParState | Calculated by             | Probe      | Description                                                                                                      |
| ------ | ---- | -------- | ------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| alfaVC | 1/K  | 30       | never — entered or absent | `s-alfavc` | Voice coil resistance temperature coefficient. Copper ≈ 0.0039 1/K. Source: thielesmall.html + alpha7 changelog. |
| Rt     | K/W  | 31       | never — entered or absent | `s-r-t`    | Thermal resistance, voice coil to ambient air. Source: thielesmall.html.                                         |
| Ct     | J/K  | 32       | never — entered or absent | `s-c-t`    | Thermal capacity of voice coil assembly. Source: thielesmall.html.                                               |

### <a id="grp-mounting"></a>3.10 Mounting dimensions and displaced volume

What the driver occupies in and on the box. Dimension data appears as text in some datasheets and as drawings in most — scrapers currently write `0` because it is not yet extracted.

**Four of these seven are locked together by one equation (§3.10.1); three are not in it at all.** Split below on that line, not on file order.

**In the DVol equation — `Depth`, `MagDepth`, `Magnet` and `DVol` are not independent of each other:**

| Field    | Unit | ParState | Calculated by                                                                      | Probe               | Description                                                                                             |
| -------- | ---- | -------- | ---------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| Depth    | m    | 40       | `Depth = [ π·MagDepth·(S − 3·Magnet²) + 12·DVol ] / (π·S)` [25](#rel-25)           | `s-depth`           | Overall driver depth. UI label "Depth".                                                                 |
| MagDepth | m    | 41       | `MagDepth = [ π·S·Depth − 12·DVol ] / (π·(S − 3·Magnet²))` [25](#rel-25)           | `s-magnetdepth`     | Magnet height, the cylinder height in §3.10.1. UI label "Magnet Depth".                                 |
| Magnet   | m    | 42       | `Magnet = √( [ 12·DVol − π·S·(Depth − MagDepth) ] / (3π·MagDepth) )` [25](#rel-25) | `s-driver-12345678` | Magnet diameter. UI label "Magnet".                                                                     |
| DVol     | m³   | 46       | `DVol = (π/4)·[ S·(Depth − MagDepth)/3 + Magnet²·MagDepth ]` [25](#rel-25)         | `s-dvol`            | Driver displacement volume: the box volume a mounted driver occupies, magnet included. UI label "Dval". |

**Not in the equation — appear nowhere in the formula, never calculated, entered or absent only:**

| Field  | Unit | ParState | Calculated by             | Probe      | Description                                                               |
| ------ | ---- | -------- | ------------------------- | ---------- | ------------------------------------------------------------------------- |
| Thick  | m    | 39       | never — entered or absent | `s-thick`  | Basket plate thickness. WinISD UI label "Thick".                          |
| Basket | m    | 43       | never — entered or absent | `s-basket` | Basket diameter — the hole to cut in the baffle. UI label "Basket".       |
| Outer  | m    | 44       | never — entered or absent | `s-outer`  | Outer flange diameter — the space needed on the baffle. UI label "Outer". |

#### 3.10.1 The DVol relation — one equation, four solve directions

WinISD models the volume a mounted driver steals from the box as **a truncated cone plus a
cylinder**: the cone tapers from the diaphragm diameter `Dd` down to the voice-coil diameter
`Vcd` over the height `Depth - MagDepth`, and the cylinder is the magnet, diameter `Magnet`
and height `MagDepth`.

```
DVol = (pi/4) * [ (Dd^2 + Dd*Vcd + Vcd^2) * (Depth - MagDepth) / 3  +  Magnet^2 * MagDepth ]
```

**WinISD solves this single equation in four directions** — for `DVol`, `Depth`, `MagDepth` or
`Magnet`, whichever one is left blank. Each inverse is algebraically exact, not an
approximation. The four expressions are in the catalogue: [relation 25](#rel-25).

Each fires only when **all five** other participants are non-zero and the target is zero. That
is why the ParState positions for `Depth` (40), `MagDepth` (41) and `Magnet` (42) can carry
`C` — they are outputs of this relation — while `Thick` (39), `Basket` (43) and `Outer` (44)
never can, because they appear nowhere in it.

`Vcd` (45) and `Dd` (22) are the two participants WinISD will **not** solve for here. `Dd` is
still calculable, but by a different route ([relation 6](#rel-6)). `Vcd` has no route
at all — entered or absent, full stop.

Source: WinISD's own calculation engine, 2026-08-16. The constants `12`, `3`, `1/4` and `pi`
are read directly, and the four expressions cross-check against each other exactly. Not yet
verified against live WinISD runs — worth doing before relying on the inverses.

### <a id="grp-environment"></a>3.11 Environment

Ambient air properties, present in all 423 `drivers/matt/` files — WinISD stores them because SPL and efficiency depend on them. **Do not omit these fields.** Values vary slightly between files because they record the environment settings at the time of saving.

| Field | Unit  | ParState | Calculated by                                            | Probe   | Description                                                                                                      |
| ----- | ----- | -------- | -------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| c     | m/s   | 48       | `c = f(roo, pressure)` [26](#rel-26)                     | `s-c`   | Speed of sound. Most common value `343.684120962152` (~20 °C, 1 atm); also observed `343.68`, `343.68275625794`. |
| roo   | kg/m³ | 49       | `roo = f(temperature, pressure, humidity)` [26](#rel-26) | `s-roo` | Air density. Most common value `1.20095217714682` (~20 °C, 1 atm); also observed `1.20095`, `1.20096171470853`.  |

### <a id="grp-editstate"></a>3.12 Edit state

| Field    | Unit   | ParState | Calculated by | Probe | Description                                                   |
| -------- | ------ | -------- | ------------- | ----- | ------------------------------------------------------------- |
| ParState | string | —        | —             | —     | The 49-character edit-state string. Full specification in §8. |

## 4. Consistency-check groups

26 relations. Relations 1–22 come from `winisd.exe` ASCII strings at offset ~8894, immediately
preceding the `TfrmParErrors` form definition — 15 confirmed there, the rest inferred from the
dependency structure and observed behaviour, with 18 explicitly ⚠ inferred. Relations 23–26
were read out of the calculation engine itself. §4.3 carries the per-relation detail: canonical
form, every field it writes, and the exact expression for each.

Note: the binary uses field name variants that differ from WDR keys — `Bl` vs `BL`,
`fs` vs `Fs`, `Gamma` vs `gamma`. The WDR field name is what matters for file format;
the binary name is the source of evidence.

**`TfrmParErrors` trigger — empirically unresolved (2026-06-28):** The dialog "Parameter
error list" / "Consistency check on following parameter groups failed." exists in the binary
but was never observed firing in direct testing: loading files with deliberate inconsistencies
produced no warning, saving produced no warning, and WinISD has no menu option to trigger a
manual check. WinISD resolves inconsistencies via the C/E mode system (see §5.1) rather than
warnings. These groups document WinISD's internal parameter dependency graph — which fields
it treats as computable from which others — not a runtime validation dialog.

| #             | Fields in group                                    | Canonical form                                                                           |
| ------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [1](#rel-1)   | `Qms`, `Fs`, `Cms`, `Rms`                          | `Rms = 1 / (2π·Fs·Cms·Qms)`                                                              |
| [2](#rel-2)   | `BL`, `Fs`, `Mms`, `Re`, `Qes`                     | `Qes = 2π·Fs·Mms·Re / BL²`                                                               |
| [3](#rel-3)   | `Rme`, `BL`, `Re`                                  | `Rme = BL² / Re`                                                                         |
| [4](#rel-4)   | `Rme`, `Fs`, `Mms`, `Qes`                          | `Rme = 2π·Fs·Mms / Qes`                                                                  |
| [5](#rel-5)   | `Qts`, `Qms`, `Qes`                                | `Qts = (Qms · Qes) / (Qms + Qes)`                                                        |
| [6](#rel-6)   | `Sd`, `Dd`                                         | `Sd = π·Dd² / 4`                                                                         |
| [7](#rel-7)   | `Mcost`, `Rme`, `Hc`, `Hg`, `Xmax`                 | `Mcost = Rme · (1 + Xmax / min(Hc, Hg))`                                                 |
| [8](#rel-8)   | `Mpow`, `BL`, `Re`                                 | `Mpow = BL / √Re`                                                                        |
| [9](#rel-9)   | `Mpow`, `Rme`                                      | `Mpow = √Rme`                                                                            |
| [10](#rel-10) | `Cms`, `Vas`, `Sd`                                 | `Vas = ρ₀ · c² · Sd² · Cms`                                                              |
| [11](#rel-11) | `Fs`, `Mms`, `Cms`                                 | `Fs = 1 / (2π·√(Mms·Cms))`                                                               |
| [12](#rel-12) | `EBP`, `Fs`, `Qes`                                 | `EBP = Fs / Qes`                                                                         |
| [13](#rel-13) | `gamma`, `BL`, `Mms`                               | `gamma = BL / Mms`                                                                       |
| [14](#rel-14) | `no`, `c`, `Fs`, `Qes`, `Vas`                      | `η₀ = (4π²/c³) · Fs³ · Vas / Qes`                                                        |
| [15](#rel-15) | `no`, `Sd`, `BL`, `Mms`, `Re`                      | `η₀ = (ρ₀ / (2π·c)) · BL² · Sd² / (Mms² · Re)`                                           |
| [16](#rel-16) | `SPLmax`, `Pe`, `SPL`                              | `SPLmax = SPL + 10·log₁₀(Pe) − 3`                                                        |
| [17](#rel-17) | `USPL`, `SPL`, `Re`                                | `USPL = SPL + 10·log₁₀(8/Re)`                                                            |
| [18](#rel-18) | `no`, `SPL`, `roo`, `c`                            | `SPL = 10·log₁₀(η₀) + 10·log₁₀(ρ₀·c²/(2π)) + 109`                                        |
| [19](#rel-19) | `Xmax`, `Hc`, `Hg`                                 | `Xmax = abs(Hc − Hg) / 2`                                                                |
| [20](#rel-20) | `Vd`, `Sd`, `Xmax`                                 | `Vd = Sd · Xmax`                                                                         |
| [21](#rel-21) | `Gloss`, `Fs`, `Xmax`                              | `Gloss = g / ((2π·Fs)² · Xmax),  g = 9.80665`                                            |
| [22](#rel-22) | `SPLmaxLF`, `roo`, `Vd`                            | `SPLmaxLF = 20·log₁₀( ρ₀·(2π·20)²·Vd / (2π·√2) / 20µPa )`                                |
| [23](#rel-23) | `Znom`, `Re`                                       | `Znom = 2 · round_half_to_even(0.75 · Re)`                                               |
| [24](#rel-24) | `KLe`, `Le`, `fLe`                                 | `KLe = Le · √(2π·fLe)`                                                                   |
| [25](#rel-25) | `DVol`, `Depth`, `MagDepth`, `Magnet`, `Dd`, `Vcd` | `DVol = (π/4) · [ S·(Depth − MagDepth)/3 + Magnet²·MagDepth ],  S = Dd² + Dd·Vcd + Vcd²` |
| [26](#rel-26) | `c`, `roo`                                         | `roo = f(temperature, pressure, humidity),  c = f(roo, pressure)`                        |
| [27](#rel-27) | `BL`, `Fs`, `Qes`, `Re`, `Sd`, `Vas`               | `BL = √(ρ₀·c²·Sd²·Re / (2π·Fs·Qes·Vas))`                                                 |

### 4.1 How the solver actually behaves — ONE rule

Established 2026-08-05 by a human driving WinISD through ~15 states and recording each.
Every observation below was reproduced arithmetically.

> Repeat until nothing changes: for each relation, if exactly ONE member is unknown and every
> other member has a value — **entered OR already calculated** — fill it. An entered value is
> never recomputed and never questioned. A field is never filled from a value that was itself
> derived from it.

That is the whole model: constraint propagation to a fixpoint. It is not precedence and it is
not recency — both were proposed here earlier and both are wrong.

**What follows from it:**

- **Entered pins.** `Dd := 300` re-derived `Sd` (blank) but left `Vd` at its typed 200, even
  though `Sd × Xmax` then implied 35343. Delete `Vd` and it fills with 35343.
- **A field in two relations is served by whichever has a single hole.** `Sd` sits in row 6
  (`Sd = π·Dd²/4`) and row 20 (`Sd = Vd/Xmax`). With `Dd` entered, row 6 fires and `Sd` ignores
  `Xmax` entirely. Delete `Dd` and row 6 has two unknowns, so row 20 takes over and `Sd` starts
  tracking `Vd`/`Xmax` — with `Dd` now derived _from_ `Sd`.
- **Calculated values DO feed further calculations, but never in a cycle.** `Vd, Xmax → Sd → Dd`
  propagates two hops. What it will not do is derive a field from a value that descends from it:
  deleting `Hg` blanked `Xmax` rather than falling back to `Vd/Sd`, because `Vd` had itself been
  calculated from `Sd × Xmax`.
- **Fill every member and the app goes inert.** Nothing recomputes because nothing is unknown.
  It looks like the calculations have broken; there is simply no hole left to fill.
- **Contradiction is invisible.** `Sd = 1.0` entered beside `Dd = 300` entered — off by 14× —
  produces no warning, no mark, no correction. Neither can be recomputed, so neither is ever
  compared. This is why the `TfrmParErrors` "consistency check failed" dialog in the binary has
  never been observed firing: by construction there is never a conflict to report.

**Where two relations could both fill the same hole, row 20 (`Vd = Sd × Xmax`) LOSES.** It is
the fallback, used only when nothing else can supply the field:

| hole   | competing routes                                            | winner        |
| ------ | ----------------------------------------------------------- | ------------- |
| `Xmax` | [19](#rel-19) `abs(Hc − Hg) / 2` vs [20](#rel-20) `Vd / Sd` | [19](#rel-19) |
| `Sd`   | [6](#rel-6) `π·Dd² / 4` vs [20](#rel-20) `Vd / Xmax`        | [6](#rel-6)   |

Physically consistent: `Dd` and `Hc`/`Hg` are measured geometry, while `Vd` is a displacement
volume derived FROM geometry. WinISD treats row 20 as producing `Vd` and runs it backwards only
as a last resort — which is why `Xmax` takes `Vd/Sd` when `Hc`/`Hg` are blank, and takes the
geometry answer as soon as they are not.

**`Xmax`'s tie-break, settled by direct observation** — seven WinISD runs driving the real
binary: six leave `Xmax` blank and watch which route fills it, and the seventh (`D`) supplies an
`Xmax` that agrees with neither route, as a control on whether anything overrides it. Recorded in
[`runs/xmax_route.jsonl`](http://localhost:8000/winisd/winisd_research/runs/xmax_route.jsonl)
(`toys/campaign_xmax_route.py`). Each run states which fields are ENTERED via the project's
`ParState` line, fires the derived pass with one typed `Le` edit, and reads the saved file back:

Each row is one driver: the four route inputs as typed, what each route would therefore
produce, and what WinISD actually returned. `Hc`, `Hg` and `Xmax` in mm, `Vd` in cm³,
`Sd` in cm² — the file itself is SI (§3), these are scaled for reading.

| case              | `Hc` mm | `Hg` mm | `Vd` cm³ | `Sd` cm² | `Xmax` typed | [19](#rel-19) gives | [20](#rel-20) gives | WinISD produced | fired                 |
| ----------------- | ------- | ------- | -------- | -------- | ------------ | ------------------- | ------------------- | --------------- | --------------------- |
| `A_hchg_only`     | 15      | 3.4     | —        | 220      | blank        | 5.8                 | —                   | **5.8 mm** `C`  | [19](#rel-19)         |
| `B_vdsd_only`     | —       | —       | 407      | 220      | blank        | —                   | 18.5                | **18.5 mm** `C` | [20](#rel-20)         |
| `C_all_four`      | 15      | 3.4     | 407      | 220      | blank        | 5.8                 | 18.5                | **5.8 mm** `C`  | [19](#rel-19)         |
| `D_all_four_xmax` | 15      | 3.4     | 407      | 220      | **9.3 mm**   | 5.8                 | 18.5                | **9.3 mm** `E`  | neither — **control** |
| `E_all_four_b`    | 11      | 1       | 980      | 350      | blank        | 5                   | 28                  | **5 mm** `C`    | [19](#rel-19)         |
| `F_all_four_swap` | 3.4     | 15      | 407      | 220      | blank        | 5.8                 | 18.5                | **5.8 mm** `C`  | [19](#rel-19)         |
| `G_hchg_equal`    | 12      | 12      | 407      | 220      | blank        | 0                   | 18.5                | **18.5 mm** `C` | [20](#rel-20)         |

Five consequences, each carried by a case above:

- **Both routes are live.** `A` and `B` each fire alone, so `Xmax` is a CALCULATED field by
  either path — not an input-only one.
- **Row 19 beats row 20** whenever both can fire (`C`, `E`, `F`), at two different magnitudes.
- **`abs()` is real.** `F` swaps `Hc` and `Hg` against `C` and gets the same `0.0058`.
- **A zero row-19 answer falls through to row 20.** `G` sets `Hc = Hg`, so row 19 yields 0 and
  WinISD wrote `Vd/Sd` instead. **Row 19 wins only when it produces a non-zero value** — that is
  the observation, and it holds in all seven cases.
  ⚠ **The MECHANISM behind it is INFERRED, not observed.** Two readings fit every case run: (a)
  row 19 DECLINES to fire when `Hc == Hg`; (b) row 19 fires, produces 0, and that 0 is treated as
  still-unset so row 20 fills. The discriminating case — `Hc = Hg` with **no** `Vd`, where
  `Xmax = 0` marked `C` means (b) and `N` means (a) — **hangs WinISD**, twice, recorded in
  `winisd_research/WINE_HARNESS.md` §"Known HANG". Nothing depends on the answer: the guard
  openisd needs is the same either way.
- **An entered `Xmax` pins against both.** `D` is the control: it supplies `0.0093` while BOTH
  routes are computable and both disagree with it (`0.0058` and `0.0185`). WinISD used neither
  and returned the typed value still marked `E`. `neither` is the expected result here, not a
  gap — it is the strongest available test of "an entered value is never recomputed", because
  two live routes had to be declined rather than one.

**openisd's engine matches all seven cases.** `packages/engine/src/driver.ts:194-195` runs
`abs(Hc − Hg)/2` before `:203-204` runs `Vd/Sd`, reproducing `A`, `B`, `C`, `E` and `F`; the
first route additionally requires `Hc !== Hg`, so on `G` it produces nothing, leaves `Xmax` null,
and row 20 supplies `0.0185` — the zero fall-through WinISD performs.

**These are not independent groups but one connected GRAPH.** `Dd ↔ Sd ↔ {Vd, Xmax}` is a
single component, so an edit to `Dd` can propagate as far as `Xmax`, two hops away.

**`Hc`/`Hg` flip `C`↔`N` while holding no value.** `|Hc − Hg|/2 = Xmax` is one equation in two
unknowns, so at most one of them is ever reachable — and the `abs()` leaves even that ambiguous
(`Hg = Hc ± 2·Xmax`). The mark states whether the field is reachable, not whether it holds
anything, which is why one can read `C` while blank (`DISCOVERIES.md` BUG-005).

**openisd reproduces this.** `DRIVER_RECORD_MODEL.md` §5 states the model side; this section is
the observation the model and the parity suite are both held against.

### 4.2 `Znom` from `Re`

```
Znom = 2 · round_half_to_even(0.75 · Re)
```

Probed 2026-08-13 under wine: 18 drivers, 18 exact matches
(`winisd_research/runs/znom_state.jsonl`, `toys/campaign_znom_state.py`). `Znom` is an integer,
so a match is exact or it is nothing.

**What it uses.** `Re`, and nothing else. A driver whose `Re` says 8 while its `Qes`/`Qts`/`Rms`
describe a driver with `Re=27` still gets `Znom=12`, not 40. An `Re` that WinISD calculated
works the same as one you typed.

**Which way it runs.** One way only. `Re` is never worked back out of a `Znom`, and a `Znom` you
typed is never corrected against `Re`.

**Zero is a real answer.** `Re=0.6` gives `Znom=0` marked `C`. That is a calculated zero, and it
is a different thing from the `0` marked `N` in a blank driver.

| what you do                   | mark                               |
| ----------------------------- | ---------------------------------- |
| type a `Znom`                 | `E` — never corrected against `Re` |
| leave it blank                | `C` — calculated from `Re`         |
| type one, then delete it      | back to `C`, and it recalculates   |
| no `Re` anywhere to work from | `N`                                |

#### 4.2.1 Getting the rounding right

Two separate rules, and both only matter when `0.75 · Re` lands on a `.5`:

1. **Round `.5` to the nearest EVEN number.** Not upward. JavaScript's `Math.round`, Python's
   `round()` on floats, and most languages' defaults do something else.
2. **Multiply at better than `double` precision.** WinISD is Delphi and works in 80-bit
   Extended, where `0.75 · Re` usually lands a hair off `.5` rather than on it. In `double` the
   same multiplication can land exactly on `.5`, and then rule 1 has to break a tie that should
   never have existed.

| `Re`               | `0.75 · Re`            | WinISD            | rule 1 wrong  | rule 2 wrong          |
| ------------------ | ---------------------- | ----------------- | ------------- | --------------------- |
| 6                  | `4.5` exactly          | 4 → **`Znom` 8**  | 5 → `Znom` 10 | —                     |
| 10                 | `7.5` exactly          | 8 → **`Znom` 16** | 8 → `Znom` 16 | —                     |
| 2                  | `1.5` exactly          | 2 → **`Znom` 4**  | 2 → `Znom` 4  | —                     |
| 7.333333333333333  | `5.49999999999999975`  | 5 → **`Znom` 10** | —             | `5.5` → 6 → `Znom` 12 |
| 3.3333333333333335 | `2.500000000000000125` | 3 → **`Znom` 6**  | —             | `2.5` → 2 → `Znom` 4  |

The first three rows are the ties that pin rule 1, and no single one of them does it alone:
`Re=6` rules out rounding up, `Re=10` rules out rounding down, `Re=2` is consistent with either.
The last two rows are the ones that need rule 2.

openisd's `nominalImpedance()` does both, and returns WinISD's answer on every row here.

**Not probed:** an `Re` entered with nothing else, which is the shape of
`drivers/sample/winisd/s-re.wdr` (`Re=123`, `Znom=0`, mark `N`) and which this rule alone does
not explain. Both attempts killed WinISD with `c000008e` (FLT_DIVIDE_BY_ZERO) before any value
could be read — the BUG-003 degenerate-driver crash. Whether a driver too sparse to solve
switches the `Znom` calculation off is UNTESTED.

### 4.3 Relation catalogue

One subsection per relation. **Members** lists every field the relation involves; the table lists only those WinISD actually WRITES from it, with the engine address of the compute site. A member missing from that table is an input and is never solved from this relation.

Relations are numbered as WinISD numbers its consistency groups, and that numbering is NOT an evaluation order. The engine is one linear sequence of guarded compute sites re-run until a pass changes nothing, so within a pass the sites execute in a fixed order and, for a field with several routes, **the first route whose guard passes wins**. Where a field lists more than one form below they are given in that firing order, lowest number first.

**Provenance.** Every row exists because a compute site in WinISD writes that field — the input set is measured, never inferred from membership. Expressions marked ✔ were read out of the code instruction by instruction; the rest are the relation's algebra over a measured input set, so the inputs are certain and only the arrangement is not. The compute-site addresses, the disassembly and the extraction method are in `winisd_research/RE_GHIDRA_FINDINGS.md` §"ParState decompiled" — this document states the findings, not the machine code behind them.

#### <a id="rel-1"></a>1. Mechanical damping

**Members:** `Qms`, `Fs`, `Cms`, `Rms`

```
Rms = 1 / (2π·Fs·Cms·Qms)
```

| Writes         | Exact form                  | Read from code |
| -------------- | --------------------------- | -------------- |
| `Qms` (pos 13) | `Qms = 1 / (2π·Fs·Cms·Rms)` |                |
| `Rms` (pos 16) | `Rms = 1 / (2π·Fs·Cms·Qms)` |                |

The `Mms` in the textbook form `Rms = 2π·Fs·Mms/Qms` cancels against `Cms = 1/(Mms·(2π·Fs)²)`, leaving a relation over these four alone. Only `Qms` and `Rms` are solved here — `Fs` and `Cms` have routes through [11](#rel-11) instead.

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-2"></a>2. Electrical damping

**Members:** `BL`, `Fs`, `Mms`, `Re`, `Qes`

```
Qes = 2π·Fs·Mms·Re / BL²
```

| Writes         | Exact form                   | Read from code |
| -------------- | ---------------------------- | -------------- |
| `BL` (pos 9)   | `BL = √(2π·Fs·Mms·Re / Qes)` |                |
| `Fs` (pos 2)   | `Fs = Qes·BL² / (2π·Mms·Re)` | ✔              |
| `Qes` (pos 14) | `Qes = 2π·Fs·Mms·Re / BL²`   |                |
| `Mms` (pos 17) | `Mms = Qes·BL² / (2π·Fs·Re)` |                |
| `Re` (pos 5)   | `Re = Qes·BL² / (2π·Fs·Mms)` |                |

Third priority for `Fs` — see [relation 11](#rel-11) for the full chain.

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-3"></a>3. Motor resistance from BL

**Members:** `Rme`, `BL`, `Re`

```
Rme = BL² / Re
```

| Writes         | Exact form       | Read from code |
| -------------- | ---------------- | -------------- |
| `BL` (pos 9)   | `BL = √(Rme·Re)` |                |
| `Re` (pos 5)   | `Re = BL² / Rme` |                |
| `Rme` (pos 35) | `Rme = BL² / Re` |                |

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-4"></a>4. Motor resistance from Qes

**Members:** `Rme`, `Fs`, `Mms`, `Qes`

```
Rme = 2π·Fs·Mms / Qes
```

| Writes         | Exact form                | Read from code |
| -------------- | ------------------------- | -------------- |
| `Fs` (pos 2)   | `Fs = Rme·Qes / (2π·Mms)` | ✔              |
| `Qes` (pos 14) | `Qes = 2π·Fs·Mms / Rme`   |                |
| `Mms` (pos 17) | `Mms = Rme·Qes / (2π·Fs)` |                |
| `Rme` (pos 35) | `Rme = 2π·Fs·Mms / Qes`   |                |

Fourth priority for `Fs` — see [relation 11](#rel-11) for the full chain.

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-5"></a>5. Total Q

**Members:** `Qts`, `Qms`, `Qes`

```
Qts = (Qms · Qes) / (Qms + Qes)
```

| Writes         | Exact form                      | Read from code |
| -------------- | ------------------------------- | -------------- |
| `Qts` (pos 15) | `Qts = (Qms·Qes) / (Qms + Qes)` |                |
| `Qes` (pos 14) | `Qes = (Qts·Qms) / (Qms − Qts)` |                |
| `Qms` (pos 13) | `Qms = (Qts·Qes) / (Qes − Qts)` |                |

This is the equation that trips people up: type a `Qts` of your own while `Qms` and `Qes` are also present and it stops tracking them. See §5.1.

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-6"></a>6. Cone area and diameter

**Members:** `Sd`, `Dd`

```
Sd = π·Dd² / 4
```

| Writes        | Exact form         | Read from code |
| ------------- | ------------------ | -------------- |
| `Sd` (pos 18) | `Sd = π·Dd² / 4`   |                |
| `Dd` (pos 22) | `Dd = 2·√(Sd / π)` |                |

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-7"></a>7. Motor cost factor

**Members:** `Mcost`, `Rme`, `Hc`, `Hg`, `Xmax`

```
Mcost = Rme · (1 + Xmax / min(Hc, Hg))
```

| Writes           | Exact form                             | Read from code |
| ---------------- | -------------------------------------- | -------------- |
| `Xmax` (pos 10)  | `Xmax = min(Hc, Hg) · (Mcost/Rme − 1)` |                |
| `Rme` (pos 35)   | `Rme = Mcost / (1 + Xmax/min(Hc, Hg))` |                |
| `Mcost` (pos 37) | `Mcost = Rme · (1 + Xmax/min(Hc, Hg))` |                |

**`Hc` and `Hg` do get calculated — but by [19](#rel-19), not by this one.**

Here they only ever appear inside `min(Hc, Hg)`. Knowing the smaller of two numbers does not tell you which one it was, so there is no way to work back to either height from this equation.

`Mcost` usually reads `0`, because `min(Hc, Hg)` is on the bottom of the fraction and most drivers never have the two heights filled in.

**Worked examples.** Ten runs varying `Hc`, `Hg`, `Xmax` and `BL`. The pair that matters is `wide_over`/`wide_under`: they swap which height is the smaller one while leaving `min(Hc, Hg)` unchanged, and WinISD returns the same `Mcost` both times. Only the minimum can do that.

| run                          | `Rme`   | `Hc` mm | `Hg` mm | `Xmax` mm | formula gives | WinISD showed |
| ---------------------------- | ------- | ------- | ------- | --------- | ------------- | ------------- |
| `mcost_hc0.012_hg0.006_bl6`  | 2.54371 | 12      | 6       | 3         | 3.81556       | **3.81556**   |
| `mcost_hc0.008_hg0.014_bl6`  | 2.54371 | 8       | 14      | 3         | 3.49760       | **3.49760**   |
| `mcost2_wide_over`           | 2.54371 | 30      | 5       | 12.5      | 8.90298       | **8.90298**   |
| `mcost2_wide_under`          | 2.54371 | 5       | 30      | 12.5      | 8.90298       | **8.90298**   |
| `mcost_hc0.012_hg0.006_bl11` | 8.54968 | 12      | 6       | 3         | 12.82452      | **12.82452**  |

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-8"></a>8. Motor power from BL

**Members:** `Mpow`, `BL`, `Re`

```
Mpow = BL / √Re
```

| Writes          | Exact form        | Read from code |
| --------------- | ----------------- | -------------- |
| `BL` (pos 9)    | `BL = Mpow·√Re`   |                |
| `Re` (pos 5)    | `Re = (BL/Mpow)²` |                |
| `Mpow` (pos 36) | `Mpow = BL / √Re` |                |

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-9"></a>9. Motor power from Rme

**Members:** `Mpow`, `Rme`

```
Mpow = √Rme
```

| Writes          | Exact form    | Read from code |
| --------------- | ------------- | -------------- |
| `Rme` (pos 35)  | `Rme = Mpow²` |                |
| `Mpow` (pos 36) | `Mpow = √Rme` |                |

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-10"></a>10. Equivalent compliance volume

**Members:** `Cms`, `Vas`, `Sd`

```
Vas = ρ₀ · c² · Sd² · Cms
```

| Writes         | Exact form                  | Read from code |
| -------------- | --------------------------- | -------------- |
| `Cms` (pos 12) | `Cms = Vas / (ρ₀·c²·Sd²)`   |                |
| `Vas` (pos 20) | `Vas = ρ₀·c²·Sd²·Cms`       |                |
| `Sd` (pos 18)  | `Sd = √(Vas / (ρ₀·c²·Cms))` |                |

`ρ₀` and `c` behave as constants here. They come from the ambient settings ([26](#rel-26)) and are never worked back out of this equation.

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-11"></a>11. Resonance from mass and compliance

**Members:** `Fs`, `Mms`, `Cms`

```
Fs = 1 / (2π·√(Mms·Cms))
```

| Writes         | Exact form                 | Read from code |
| -------------- | -------------------------- | -------------- |
| `Fs` (pos 2)   | `Fs = 1 / (2π·√(Mms·Cms))` | ✔              |
| `Cms` (pos 12) | `Cms = 1 / ((2π·Fs)²·Mms)` |                |
| `Mms` (pos 17) | `Mms = 1 / ((2π·Fs)²·Cms)` |                |

This is one of five routes to `Fs`, and they have a strict priority — proven both from the code and live against the real binary (RE_GHIDRA_FINDINGS.md "Fs priority settled STATICALLY" / "CONFIRMED in the UI"). Each block re-tests `Fs == 0` before firing, so once an earlier block writes `Fs`, every later one is skipped:

| priority | relation      | fires when                       |
| -------- | ------------- | -------------------------------- |
| 1st      | [11](#rel-11) | `Cms`, `Mms` present             |
| 2nd      | [14](#rel-14) | `no`, `Qes`, `Vas` present       |
| 3rd      | [2](#rel-2)   | `Qes`, `BL`, `Mms`, `Re` present |
| 4th      | [4](#rel-4)   | `Rme`, `Qes`, `Mms` present      |
| 5th      | [12](#rel-12) | `EBP`, `Qes` present             |

**Worked examples.** Four runs, one per rung of the priority chain, each disabling the routes above it by zeroing one exclusive input in the FILE (never in the editor — an editor blank self-heals, since WinISD refills a cleared field from `Fs` through whatever route reaches it before the next field is touched). Every run reads `Fs = 60` — the tuned leader, never the 40 every other route agrees on.

| run                    | setup                                                          | Fs after blanking | winner      |
| ---------------------- | -------------------------------------------------------------- | ----------------- | ----------- |
| `prio_11_beats_rest`   | nothing disabled — only rel 11 tuned to 60, everything else 40 | **60.00**         | relation 11 |
| `prio_14_beats_2_4_12` | rel 11 disabled (`Cms=0`) — rel 14 tuned to 60, 2/4/12 at 40   | **60.00**         | relation 14 |
| `prio_2_beats_4_12`    | rel 11,14 disabled — rel 2 tuned to 60, 4/12 at 40             | **60.00**         | relation 2  |
| `prio_4_beats_12`      | rel 11,14,2 disabled — rel 4 tuned to 60, rel 12 at 40         | **60.00**         | relation 4  |

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-12"></a>12. Efficiency bandwidth product

**Members:** `EBP`, `Fs`, `Qes`

```
EBP = Fs / Qes
```

| Writes         | Exact form       | Read from code |
| -------------- | ---------------- | -------------- |
| `Fs` (pos 2)   | `Fs = EBP·Qes`   | ✔              |
| `Qes` (pos 14) | `Qes = Fs / EBP` |                |
| `EBP` (pos 34) | `EBP = Fs / Qes` |                |

Fifth and last priority for `Fs` — see [relation 11](#rel-11) for the full chain.

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-13"></a>13. Force factor per unit mass

**Members:** `gamma`, `BL`, `Mms`

```
gamma = BL / Mms
```

| Writes           | Exact form         | Read from code |
| ---------------- | ------------------ | -------------- |
| `BL` (pos 9)     | `BL = gamma·Mms`   |                |
| `Mms` (pos 17)   | `Mms = BL / gamma` |                |
| `gamma` (pos 33) | `gamma = BL / Mms` |                |

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-14"></a>14. Reference efficiency from T/S

**Members:** `no`, `c`, `Fs`, `Qes`, `Vas`

```
η₀ = (4π²/c³) · Fs³ · Vas / Qes
```

| Writes         | Exact form                      | Read from code |
| -------------- | ------------------------------- | -------------- |
| `Fs` (pos 2)   | `Fs = ∛(no·c³·Qes / (4π²·Vas))` | ✔              |
| `Qes` (pos 14) | `Qes = (4π²/c³)·Fs³·Vas / no`   |                |
| `no` (pos 23)  | `no = (4π²/c³)·Fs³·Vas / Qes`   |                |
| `Vas` (pos 20) | `Vas = no·c³·Qes / (4π²·Fs³)`   |                |

Second priority for `Fs` — see [relation 11](#rel-11) for the full chain.

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-15"></a>15. Reference efficiency from motor

**Members:** `no`, `Sd`, `BL`, `Mms`, `Re`

```
η₀ = (ρ₀ / (2π·c)) · BL² · Sd² / (Mms² · Re)
```

| Writes         | Exact form                             | Read from code |
| -------------- | -------------------------------------- | -------------- |
| `BL` (pos 9)   | `BL = (Mms/Sd)·√(2π·c·no·Re / ρ₀)`     |                |
| `Mms` (pos 17) | `Mms = BL·Sd·√(ρ₀ / (2π·c·no·Re))`     |                |
| `no` (pos 23)  | `no = (ρ₀/(2π·c))·BL²·Sd² / (Mms²·Re)` |                |
| `Sd` (pos 18)  | `Sd = (Mms/BL)·√(2π·c·no·Re / ρ₀)`     |                |
| `Re` (pos 5)   | `Re = (ρ₀/(2π·c))·BL²·Sd² / (Mms²·no)` |                |

The second route to `η₀`, independent of [14](#rel-14).

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-16"></a>16. Maximum SPL from power

**Members:** `SPLmax`, `Pe`, `SPL`

```
SPLmax = SPL + 10·log₁₀(Pe) − 3
```

| Writes            | Exact form                        | Read from code |
| ----------------- | --------------------------------- | -------------- |
| `SPLmax` (pos 27) | `SPLmax = SPL + 10·log₁₀(Pe) − 3` | ✔              |
| `Pe` (pos 3)      | `Pe = 10^((SPLmax − SPL + 3)/10)` | ✔              |

**The −3 dB is real — do not drop it.** WinISD's own list of field groupings gives the field names and no arithmetic, so a formula copied from that list comes out 3 dB too loud.

`SPL` appears in this equation but is never calculated from it. [18](#rel-18) is the only thing that produces an `SPL`.

**Worked examples.** Fifteen runs sweeping `SPL` and `Pe` separately and together. **`Pe = 1` is the one that settles the −3**: `log₁₀(1)` is zero, so `SPLmax` shows the offset by itself — `90 − 3 = 87.00`. The `Pe` column then confirms the `10·log₁₀` slope (each ×10 adds 10 dB) and the `SPL` column confirms the plain sum (each dB in, one dB out).

| run                    | `SPL` | `Pe` W | without the −3 | formula gives | WinISD showed |
| ---------------------- | ----- | ------ | -------------- | ------------- | ------------- |
| `splmax_spl90_pe1`     | 90    | 1      | 90.00          | 87.00         | **87.00**     |
| `splmax_spl90_pe2`     | 90    | 2      | 93.01          | 90.01         | **90.01**     |
| `splmax_spl90_pe25`    | 90    | 25     | 103.98         | 100.98        | **100.98**    |
| `splmax_spl90_pe1000`  | 90    | 1000   | 120.00         | 117.00        | **117.00**    |
| `splmax_pe100_spl75`   | 75    | 100    | 95.00          | 92.00         | **92.00**     |
| `splmax_pe100_spl96.5` | 96.5  | 100    | 116.50         | 113.50        | **113.50**    |
| `splmax_spl80_pe5`     | 80    | 5      | 86.99          | 83.99         | **83.99**     |
| `splmax_spl88.5_pe63`  | 88.5  | 63     | 106.49         | 103.49        | **103.49**    |

_Read from WinISD's calculation engine, then confirmed by a 15-run sweep over `SPL` and `Pe` — every value exact._

#### <a id="rel-17"></a>17. Voltage sensitivity

**Members:** `USPL`, `SPL`, `Re`

```
USPL = SPL + 10·log₁₀(8/Re)
```

| Writes          | Exact form                    | Read from code |
| --------------- | ----------------------------- | -------------- |
| `USPL` (pos 29) | `USPL = SPL + 10·log₁₀(8/Re)` |                |

`8` is `2.83²` — the reference voltage squared. Only `USPL` is ever calculated here; `SPL` and `Re` are inputs.

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-18"></a>18. Sensitivity from efficiency

**Members:** `no`, `SPL`, `roo`, `c`

```
SPL = 10·log₁₀(η₀) + 10·log₁₀(ρ₀·c²/(2π)) + 109
```

| Writes        | Exact form                                        | Read from code |
| ------------- | ------------------------------------------------- | -------------- |
| `SPL` (pos 4) | `SPL = 10·log₁₀(no) + 10·log₁₀(ρ₀·c²/(2π)) + 109` |                |
| `no` (pos 23) | `no = 10^((SPL − 109)/10) · 2π / (ρ₀·c²)`         |                |

⚠ The canonical form is INFERRED, not read from the binary — treat both solved forms as unconfirmed. `roo` and `c` are supplied by [26](#rel-26).

_Inferred._

#### <a id="rel-19"></a>19. Excursion from coil and gap heights

**Members:** `Xmax`, `Hc`, `Hg`

```
Xmax = abs(Hc − Hg) / 2
```

| Writes          | Exact form                                           | Read from code |
| --------------- | ---------------------------------------------------- | -------------- |
| `Xmax` (pos 10) | `Xmax = abs(Hc − Hg) / 2`                            | ✔              |
| `Hc` (pos 25)   | `Hc = 2·Xmax + Hg   (branch taken when Hg ≤ 2·Xmax)` | ✔              |
| `Hc` (pos 25)   | `Hc = Hg − 2·Xmax   (branch taken when Hg > 2·Xmax)` | ✔              |
| `Hg` (pos 26)   | `Hg = Hc − 2·Xmax   (branch taken when Hc ≥ 2·Xmax)` | ✔              |
| `Hg` (pos 26)   | `Hg = 2·Xmax + Hc   (branch taken when Hc < 2·Xmax)` | ✔              |

**Type any two of the three, get the third.**

| you type        | you get                                                      |
| --------------- | ------------------------------------------------------------ |
| `Hc` and `Hg`   | `Xmax = abs(Hc − Hg) / 2`                                    |
| `Xmax` and `Hc` | `Hg = abs(Hc ± 2·Xmax)` — see the table above for which sign |
| `Xmax` and `Hg` | `Hc = abs(Hg ± 2·Xmax)` — see the table above for which sign |

Nothing else in the driver is involved: an otherwise empty driver with only `Xmax` and `Hc` typed in will fill in `Hg`.

`Hc == Hg` gives `Xmax = 0`, and `Xmax` then comes from `Vd/Sd` ([20](#rel-20)) instead. Any other time these heights beat `Vd/Sd`. See §4.1.

**Worked examples.** Seven runs. Six leave `Xmax` blank to see which equation fills it; the seventh types an `Xmax` in, to see whether anything overrides it. Full table in §4.1.

| run               | `Hc` mm | `Hg` mm | formula gives mm | WinISD showed                                      |
| ----------------- | ------- | ------- | ---------------- | -------------------------------------------------- |
| `A_hchg_only`     | 15      | 3.4     | 5.8              | **5.8** `C`                                        |
| `F_all_four_swap` | 3.4     | 15      | 5.8              | **5.8** `C` — `abs()` confirmed                    |
| `G_hchg_equal`    | 12      | 12      | 0                | **18.5** `C` — zero falls through to [20](#rel-20) |

The two height directions, which the campaign above does not exercise because every run enters `Hc` and `Hg`. These come from the branch conditions read out of the engine. Each row is the whole driver — `Xmax` and one height, nothing else entered — and openisd's engine returns the same four answers:

| given                          | branch condition | expression         | result mm |
| ------------------------------ | ---------------- | ------------------ | --------- |
| `Xmax` 10 mm, `Hc` 1 mm → `Hg` | `Hc` < 2·`Xmax`  | `Hg = 2·Xmax + Hc` | **21**    |
| `Xmax` 10 mm, `Hg` 1 mm → `Hc` | `Hg` ≤ 2·`Xmax`  | `Hc = 2·Xmax + Hg` | **21**    |
| `Xmax` 3 mm, `Hg` 14 mm → `Hc` | `Hg` > 2·`Xmax`  | `Hc = Hg − 2·Xmax` | **8**     |
| `Xmax` 3 mm, `Hc` 14 mm → `Hg` | `Hc` ≥ 2·`Xmax`  | `Hg = Hc − 2·Xmax` | **8**     |

_Read directly from WinISD's calculation engine._

#### <a id="rel-20"></a>20. Displacement volume

**Members:** `Vd`, `Sd`, `Xmax`

```
Vd = Sd · Xmax
```

| Writes          | Exact form       | Read from code |
| --------------- | ---------------- | -------------- |
| `Vd` (pos 19)   | `Vd = Sd·Xmax`   |                |
| `Xmax` (pos 10) | `Xmax = Vd / Sd` |                |
| `Sd` (pos 18)   | `Sd = Vd / Xmax` |                |

The fallback relation: where another relation could fill the same hole, this one LOSES. See §4.1.

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-21"></a>21. Static cone sag

**Members:** `Gloss`, `Fs`, `Xmax`

```
Gloss = g / ((2π·Fs)² · Xmax),  g = 9.80665
```

| Writes           | Exact form                    | Read from code |
| ---------------- | ----------------------------- | -------------- |
| `Gloss` (pos 38) | `Gloss = g / ((2π·Fs)²·Xmax)` |                |
| `Xmax` (pos 10)  | `Xmax = g / ((2π·Fs)²·Gloss)` |                |
| `Gloss` (pos 38) | `Gloss = g / ((2π·Fs)²·Xmax)` |                |

`Gloss` is a FRACTION of `Xmax`, not a distance — the WinISD panel shows it as a percentage. WinISD tries this calculation twice, once early and once late in a pass, which is why the same field appears twice above.

`Fs` appears in the equation but is never calculated from it.

**Worked examples.** `Gloss` is stored as a fraction but shown as a percentage, which is what the last two columns are.

| run                     | `Fs`  | `Xmax` mm | formula gives % | WinISD showed % |
| ----------------------- | ----- | --------- | --------------- | --------------- |
| `gloss_fs25_xmax0.002`  | 25 Hz | 2         | 19.8724         | **19.8724**     |
| `gloss_fs40_xmax0.0067` | 40 Hz | 6.7       | 2.3172          | **2.3172**      |
| `gloss_fs40_xmax0.019`  | 40 Hz | 19        | 0.8171          | **0.8171**      |

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-22"></a>22. Excursion-limited LF output

**Members:** `SPLmaxLF`, `roo`, `Vd`

```
SPLmaxLF = 20·log₁₀( ρ₀·(2π·20)²·Vd / (2π·√2) / 20µPa )
```

| Writes              | Exact form                                                | Read from code |
| ------------------- | --------------------------------------------------------- | -------------- |
| `Vd` (pos 19)       | `Vd = 10^(SPLmaxLF/20) · (2π·√2) · 20µPa / (ρ₀·(2π·20)²)` |                |
| `SPLmaxLF` (pos 28) | `SPLmaxLF = 20·log₁₀(ρ₀·(2π·20)²·Vd / (2π·√2) / 20µPa)`   |                |

The loudest a driver can go at 20 Hz, 1 m, half space, before it runs out of travel. `ρ₀` comes from the ambient settings ([26](#rel-26)).

**Worked examples.** `Vd` drives this, and these runs reach `Vd` as `Sd · Xmax` with `Sd` held at 220 cm² — so it is really a sweep over excursion. `ρ₀ = 1.20095` as WinISD reported it.

| run                     | `Xmax` mm | `Vd` cm³ | formula gives dB | WinISD showed dB |
| ----------------------- | --------- | -------- | ---------------- | ---------------- |
| `gloss_fs25_xmax0.002`  | 2         | 44       | 73.43            | **73.43**        |
| `gloss_fs40_xmax0.0067` | 6.7       | 147.4    | 83.93            | **83.93**        |
| `gloss_fs40_xmax0.019`  | 19        | 418      | 92.99            | **92.99**        |

_Group confirmed from `winisd.exe` strings preceding `TfrmParErrors`._

#### <a id="rel-23"></a>23. Nominal impedance

**Members:** `Znom`, `Re`

```
Znom = 2 · round_half_to_even(0.75 · Re)
```

| Writes         | Exact form                             | Read from code |
| -------------- | -------------------------------------- | -------------- |
| `Znom` (pos 1) | `Znom = 2·round_half_to_even(0.75·Re)` | ✔              |

**One direction only.** The rounding cannot be undone, so `Re` is never worked back out of a `Znom`. See §4.2.

**Worked examples.** Twenty-one runs over `Re`. Three of them land exactly on a `.5`, and together they pin the rounding to half-to-EVEN — `Re=6` rules out rounding up, `Re=10` rules out rounding down, `Re=2` agrees with both.

| run                   | `Re` Ω            | `0.75·Re`           | rounds to | formula gives | WinISD saved                          |
| --------------------- | ----------------- | ------------------- | --------- | ------------- | ------------------------------------- |
| `Z_absent_re6`        | 6                 | 4.5 (tie)           | 4 — even  | 8             | **8** `C`                             |
| `Z_tie_re10.`         | 10                | 7.5 (tie)           | 8 — even  | 16            | **16** `C`                            |
| `Z_tie_re2.`          | 2                 | 1.5 (tie)           | 2 — even  | 4             | **4** `C`                             |
| `Z_tie_re7.333333`    | 7.333333333333333 | 5.49999999999999975 | 5         | 10            | **10** `C`                            |
| `Z_absent_re123`      | 123               | 92.25               | 92        | 184           | **184** `C`                           |
| `Z_tie_re0.6`         | 0.6               | 0.45                | 0         | 0             | **0** `C` — a computed zero           |
| `Z_entered_znom4_re6` | 6                 | 4.5                 | 4         | 8             | **4** `E` — typed value wins          |
| `Z_cleared_from8_re6` | 6                 | 4.5                 | 4         | 8             | **8** `C` — cleared, so it recomputes |

_Read directly from WinISD's calculation engine._

#### <a id="rel-24"></a>24. Semi-inductance

**Members:** `KLe`, `Le`, `fLe`

```
KLe = Le · √(2π·fLe)
```

| Writes        | Exact form           | Read from code |
| ------------- | -------------------- | -------------- |
| `KLe` (pos 8) | `KLe = Le·√(2π·fLe)` | ✔              |

**One direction only.** `KLe` is the semi-inductance that behaves like a plain `Le` at the frequency `fLe`. Nothing anywhere calculates `Le` or `fLe`, which is why both are always either typed in or absent.

_Read directly from WinISD's calculation engine._

#### <a id="rel-25"></a>25. Displaced volume geometry

**Members:** `DVol`, `Depth`, `MagDepth`, `Magnet`, `Dd`, `Vcd`

```
DVol = (π/4) · [ S·(Depth − MagDepth)/3 + Magnet²·MagDepth ],  S = Dd² + Dd·Vcd + Vcd²
```

| Writes              | Exact form                                                           | Read from code |
| ------------------- | -------------------------------------------------------------------- | -------------- |
| `DVol` (pos 46)     | `DVol = (π/4)·[ S·(Depth − MagDepth)/3 + Magnet²·MagDepth ]`         | ✔              |
| `Magnet` (pos 42)   | `Magnet = √( [ 12·DVol − π·S·(Depth − MagDepth) ] / (3π·MagDepth) )` | ✔              |
| `Depth` (pos 40)    | `Depth = [ π·MagDepth·(S − 3·Magnet²) + 12·DVol ] / (π·S)`           | ✔              |
| `MagDepth` (pos 41) | `MagDepth = [ π·S·Depth − 12·DVol ] / (π·(S − 3·Magnet²))`           | ✔              |

The driver is modelled as a cone plus a cylinder: the cone tapers from the diaphragm `Dd` down to the voice coil `Vcd` over a height of `Depth − MagDepth`, and the cylinder is the magnet, `Magnet` across and `MagDepth` deep. `S` is shorthand for `Dd² + Dd·Vcd + Vcd²`.

Leave any one of `DVol`, `Depth`, `MagDepth` or `Magnet` blank and WinISD works it out from the others — but only when all five of the rest have values.

**`Dd` and `Vcd` are inputs here and are never calculated from this equation.** `Dd` comes from [6](#rel-6); `Vcd` is only ever typed in. See §3.10.1.

_Read directly from WinISD's calculation engine._

#### <a id="rel-26"></a>26. Air density and speed of sound

**Members:** `c`, `roo`

```
roo = f(temperature, pressure, humidity),  c = f(roo, pressure)
```

| Writes         | Exact form                                 | Read from code |
| -------------- | ------------------------------------------ | -------------- |
| `roo` (pos 49) | `roo = f(temperature, pressure, humidity)` | ✔              |
| `c` (pos 48)   | `c = f(roo, pressure)`                     | ✔              |

Neither comes from any driver field — both are read from the project's ambient settings (temperature, pressure, humidity). That is why a brand-new empty driver already shows these two as calculated. The two formulas themselves have not been recovered; only their inputs are known.

_Read directly from WinISD's calculation engine._

#### <a id="rel-27"></a>27. Force factor without the mass (fused)

**Members:** `BL`, `Fs`, `Qes`, `Re`, `Sd`, `Vas`

```
BL = √(ρ₀·c²·Sd²·Re / (2π·Fs·Qes·Vas))
```

| Writes       | Exact form                               | Read from code |
| ------------ | ---------------------------------------- | -------------- |
| `BL` (pos 9) | `BL = √(ρ₀·c²·Sd²·Re / (2π·Fs·Qes·Vas))` | ✔              |

**This is not one of WinISD's own field groupings.** WinISD chains three of them together in a single step — [10](#rel-10) to reach `Cms`, [11](#rel-11) to reach `Mms`, then [2](#rel-2) for `BL` — so it can produce a `BL` while `Cms` and `Mms` are both still blank. Substitute the three and it collapses to [2](#rel-2): no new physics, just more reach.

_Read directly from WinISD's calculation engine._

## 5. Constraints and rules

### 5.1 Qts consistency

`Qts = (Qms × Qes) / (Qms + Qes)`

WinISD manages Qts via the C/E mode system — empirically verified 2026-06-28 using
`drivers/sample/inconsistency-test*.wdr`:

| Qts ParState         | Behaviour                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------- |
| C or N (not entered) | Recalculates Qts **live and instantly** as Qms or Qes change; also written correctly on save |
| E (user entered)     | Qts is pinned — changing Qms or Qes has no effect; no warning issued                         |

Some forum posts suggest WinISD shows a consistency-check warning for mismatched Qts/Qms/Qes — this does not occur in practice (human-tested 2026-06-28). See §4 for how WinISD actually handles parameter dependencies.

**Reverting a pinned Qts:** if the user has typed Qts (making it E/green), they can revert
it to calculated by selecting the field and pressing Delete — WinISD immediately recalculates
Qts from Qms/Qes and marks it C. Confirmed 2026-06-28.

Source: direct WinISD 0.7.0.950 testing 2026-06-28.

### 5.2 Field order

All 56 native fields must appear in the canonical order from §2. Do not reorder, skip, or
insert extra fields within the native block. WinISD likely parses by position/sequence.

### 5.3 ParState placement

`ParState=` must be the last native WinISD field. Confirmed across all 423 `drivers/matt/` files — no WinISD-native fields appear after `ParState=`.

### 5.4 c and roo

`c=343.684120962152` (m/s) and `roo=1.20095217714682` (kg/m³) — WinISD environment constants
at ~20°C, 1 atm — must be present in every WDR file. WinISD uses these for SPL calculation;
their absence may cause WinISD to apply different defaults.

**They are per-DRIVER and EDITABLE, not global constants stamped on output.** WinISD offers
both for editing on the driver, saves what is typed, and MARKS IT AS ENTERED.
`s-roo-set400-and-c-set2.wdr` states `c=400` and `roo=2` with **ParState slots 48 and 49 = `E`**
— every other file in the corpus ends `CC`. So the default pair is WinISD's own computation
from its environment defaults, and a typed value overrides it as a stated fact. The `.wpr`
agrees: in `docs/winisd/sample_project_Epique15_-_pr.wpr`
they appear at lines 53-54, **inside the `[Driver]` section**, not in `[ProjectInfo]`,
`[SimulatorOptions]` or any other project-level section.

What they MEAN per driver is not documented in any WinISD material held here. The plausible
reading is the conditions that driver's figures were measured or computed at — which would make
them provenance rather than simulation input — but that is a hypothesis, not a finding. Not
resolved. Verified per-driver, editable and E-marked 2026-08-16.

## 6. Unit conventions

All WDR fields use SI units — the canonical unit for each field is in §3. A producer
of WDR files converts from datasheet units before writing.

## 7. Common mistakes

| Wrong                        | Correct                                     | Why                                                                                            |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Z=8`                        | `Znom=8`                                    | WinISD uses `Znom=`; `Z=` is silently ignored                                                  |
| `Bl=7.5`                     | `BL=7.5`                                    | Case-sensitive; `Bl=` is not imported                                                          |
| `Name=foo`                   | `Brand=foo` + `Model=bar`                   | No `Name=` field exists in WDR                                                                 |
| Manually entering Qts        | Enter Qms + Qes only, set Qts=C in ParState | WinISD computes Qts; a manually pinned Qts (ParState=E) will not update when Qms or Qes change |
| Entering Vas directly        | Enter Mms+Cms+Sd+BL+Re                      | Computed Vas is internally consistent with environment; entered Vas may not match              |
| Xmax in p-p for SB Acoustics | Xmax ÷ 2 then ÷ 1000                        | SB Acoustics labels are p-p; WinISD needs one-way peak in metres                               |
| Stripping `c=` and `roo=`    | Always include both                         | Genuine WinISD fields; stripping may change simulation results                                 |

## 8. ParState

### 8.1 Overview

`ParState` is a fixed 49-character string encoding WinISD's internal view of how each
parameter was set. Introduced in alpha7 (2004).

Source: versions.txt alpha7 — "Added parameter tracking to the driver editor. Now driver
editor tracks which parameters were entered and which were calculated."

Each character:

| Char | Meaning                                                            |
| ---- | ------------------------------------------------------------------ |
| E    | User **Entered** the value in the WinISD UI                        |
| C    | WinISD **Calculated** from other entered params                    |
| N    | **Not set** (parameter not applicable or never entered/calculated) |

The 49 positions do **not** correspond to WDR file line positions — they map to WinISD's
internal parameter list. That list is recovered in full in §8.4.

**How WinISD treats the `ParState=` line itself** (all four rules read out of `winisd.exe`):

| Situation                         | What WinISD does                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| No `ParState=` line in the file   | Defaults every one of the 49 positions to **`E`** — a file with no `ParState` is read as "the human typed all of this", so nothing recalculates |
| String longer than 49             | Truncated to the first 49; the excess is discarded                                                                                              |
| String shorter than 49            | Copied character-for-character; the remaining positions keep whatever they already held (`N` on a fresh driver)                                 |
| Characters other than `E`/`C`/`N` | Stored verbatim, no validation                                                                                                                  |

The first row is the dangerous one for a writer: **omitting `ParState` is not neutral**, it is
the strongest possible statement, pinning all 49 fields against recalculation.

### 8.2 Observed ParState values

**Source of truth:** `drivers/sample/` (single-parameter probe experiments, real WinISD
0.7.0.950) and `drivers/matt/` (real WinISD files from human data entry). See §8.4 for the
confirmed position map and `drivers/sample/README.md` for probe methodology.

**Blank driver** — nothing entered (`drivers/sample/john-all-defaults.wdr`):

```
NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNNNNNNNNNNCC
```

numVC (pos 24, 1-indexed) always E; c (pos 48) and roo (pos 49) always C.

**Typical real WinISD entry** — most common pattern in `drivers/matt/` when user enters
Qms, Pe, Re, Le, BL, Xmax, Cms, Mms, Sd and WinISD computes the rest:

```
CCECEENNEENEECCCEECCNCCENNCCCNNNCCCCNCNNNNNNNNNCC
```

**All T/S params entered** (`drivers/sample/john-all-noncalc-fields-manually-entered.wdr`):

```
CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC
```

**Minimum entry — only Qms and Qes** (`drivers/sample/inconsistency-test-saved-q.wdr`,
empirically produced 2026-06-28):

```
NNNNNNNNNNNNEECNNNNNNNNENNNNNNNNNNNNNNNNNNNNNNNCC
```

WinISD computed Qts=C from Qms=E + Qes=E on save.

**Bad scraper pattern — do not copy fixed template strings:**
A scraper that writes a fixed ParState for every driver (regardless of which fields were actually scraped) will mark computed fields like Qts, Vd, Dd as E — permanently pinning them and preventing WinISD from managing them. Scrapers must build ParState dynamically based on which fields were actually sourced.

### 8.3 VCCon and ParState

`VCCon` **owns pos 47**, the slot no probe could ever move. It cannot be moved because
**nothing in WinISD ever writes that position** — not the editor, not the calculation engine,
not the Clear button. Its control is a combo box, and combo boxes are wired straight to the
value with no state marking; every text field on the panel is wired to both.

So pos 47 carries the `N` a blank driver starts with, or verbatim whatever the loaded file
said. A hand-authored `E` there survives a load-and-save untouched, which is what
`drivers/sample/winisd/inconsistency-test-saved.wdr` records.

`numVC` (pos 24) is the same species. It is an integer spin control, likewise wired without
state marking, so its only assignment anywhere is the hardcoded `E` that WinISD stamps when it
initialises a blank driver alongside `numVC = 1`. That is the whole reason it reads `E` while
the UI never colours it as user-entered.

**Consequence for a writer:** positions 24 and 47 cannot be derived from the data. Echo what
the source file said, and use `E` at 24 / `N` at 47 when there is no source.

### 8.4 Position mapping

**The map is in §3**, one column of the field tables, so that each field is described once. The
probe file that established each position is the column beside it; `—` marks the two positions
no probe can reach, which came from `winisd.exe` instead (see §8.3).

`drivers/sample/README.md` uses **0-indexed** positions (0–48); §3 uses **1-indexed** (1–49).
Subtract 1 to get the README index.

**All 49 positions are confirmed.** Three orderings exist in this format and none can be derived
from another — the file write order (§2), the ParState order (§3), and the engine's evaluation
order (§3 intro). `Qts` is written first in the file but sits at ParState 15; `EBP` is written
among the dimensions but sits at 34; `VCCon` is written between `Gloss` and `c` but takes 47,
the last of the run beginning at `Thick` (39), leaving 48 and 49 for `c` and `roo`. From
position 39 onward ParState order stops tracking WinISD's internal storage order, so no
position past 38 can be extrapolated.

Source: `drivers/sample/README.md` (single-parameter probe methodology, WinISD 0.7.0.950,
2026-06-26) and the engine itself. Method and per-position evidence:
`winisd_research/RE_GHIDRA_FINDINGS.md` §"ParState decompiled".

### 8.5 Where the emit rules live

How openisd decides each field's ParState character when it writes a `.wdr` — and what its
own `driver.yml` / `openisd.yml` records do and do not store — is DESIGN, not an observation
about WinISD, so it is not in this document. See `DRIVER_RECORD_MODEL.md`.

## 9. WinISD simulation model — key facts

Brief summary of WinISD's acoustic model relevant to interpreting WDR parameter values.
See `docs/research/WINISD_PARITY.md` for full detail and source citations.

| Fact                                                                                             | Source                                           |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Voltage drive: WinISD uses `Eg = √(Pin × Re)`, not fixed 2.83V                                   | WinISD help `aboutequivalentcircuits.html`       |
| Le is NOT included in the acoustic circuit — used only for impedance curves                      | `aboutequivalentcircuits.html`                   |
| Box losses: Ql=10 (default), Qa=100, Qp=100. Entry via "Advanced->" in Box tab                   | WinISD help boxdes05/06                          |
| Radiation model: half-space (2π, infinite baffle). All SPL assumes 1m, 2π                        | `plottypes.html`, `aboutequivalentcircuits.html` |
| Znom: not used in simulation — descriptive only                                                  | `thielesmall.html`                               |
| Box volume: WinISD shows net volume only. Driver/brace/port displacements must be added manually | `faq.html`                                       |
| Valid frequency range: 20–300 Hz (pistonic range only; results beyond 300 Hz unreliable)         | `faq.html`                                       |
| Xmax convention: one-way peak                                                                    | `plottypes.html`                                 |
| Port end correction: one flanged + one free end; default factor 0.732                            | `faq.html`                                       |
| Mms definition: includes air load for all driver types                                           | `thielesmall.html`                               |
| Port air velocity: keep peak below 5% of speed of sound (~17 m/s) to avoid chuffing              | `plottypes.html`                                 |

### 10.1 Parameter entry order

Enable **Auto calculate unknowns** before entering any parameters. Official recommended
order (source: `usingwinisd/newdriver.html`):

1. Mms + Cms → gives Fs. If unavailable, enter Fs and one of the two.
2. Sd + BL + Re → gives most derived fields except Qms, Qts, Vas.
3. Rms **or** Qms — either works; Qms preferred (directly measurable).
4. Hc + Hg + Pe. If Hc/Hg unavailable, enter Xmax directly.
5. numVC — number of voice coils.
6. Correct Znom if necessary.

**Minimum viable entry** (basic graphs only): Qts + Vas + Fs.
