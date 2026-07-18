# WDR Schema

**Authoritative reference for the WDR file format and the `_meta.yml` provenance sidecar.**

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

WDR files contain only WinISD-native fields. All provenance and quality metadata lives in
the companion `_meta.yml` sidecar (see §9).

Source for structural claims: direct analysis of 423 `drivers/matt/` files plus 53 WinISD-generated single-field probe files from `drivers/sample/` (2026-06-28).

## 2. Canonical field order

All 423 `drivers/matt/` files and all 53 WinISD probe files use this order — observed universally consistent. WinISD always writes in this order on save. Whether it enforces order on read is untested; because WinISD loads short-format files (27–29 fields) correctly, it likely reads by key name.

| Pos | Field        | Group                  |
| --- | ------------ | ---------------------- |
| 1   | Brand        | Metadata               |
| 2   | Model        | Metadata               |
| 3   | Manufacturer | Metadata               |
| 4   | ProvidedBy   | Metadata               |
| 5   | Comment      | Metadata               |
| 6   | DateAdded    | Metadata               |
| 7   | DateModified | Metadata               |
| 8   | Qts          | T/S parameters         |
| 9   | Znom         | T/S parameters         |
| 10  | Fs           | T/S parameters         |
| 11  | Pe           | T/S parameters         |
| 12  | SPL          | T/S parameters         |
| 13  | Re           | T/S parameters         |
| 14  | Le           | T/S parameters         |
| 15  | fLe          | T/S parameters         |
| 16  | KLe          | T/S parameters         |
| 17  | BL           | T/S parameters         |
| 18  | Xmax         | T/S parameters         |
| 19  | Cms          | T/S parameters         |
| 20  | Qms          | T/S parameters         |
| 21  | Qes          | T/S parameters         |
| 22  | Rms          | T/S parameters         |
| 23  | Mms          | T/S parameters         |
| 24  | Sd           | T/S parameters         |
| 25  | Vas          | T/S parameters         |
| 26  | Dia          | T/S geometry           |
| 27  | Vd           | Computed by WinISD     |
| 28  | no           | Computed by WinISD     |
| 29  | Dd           | Computed by WinISD     |
| 30  | EBP          | Computed by WinISD     |
| 31  | numVC        | Computed by WinISD     |
| 32  | Hc           | Computed by WinISD     |
| 33  | Hg           | Computed by WinISD     |
| 34  | SPLmax       | Computed by WinISD     |
| 35  | SPLmaxLF     | Computed by WinISD     |
| 36  | USPL         | Computed by WinISD     |
| 37  | alfaVC       | Computed by WinISD     |
| 38  | Rt           | Computed by WinISD     |
| 39  | Ct           | Computed by WinISD     |
| 40  | gamma        | Computed by WinISD     |
| 41  | Rme          | Computed by WinISD     |
| 42  | Mpow         | Computed by WinISD     |
| 43  | Mcost        | Computed by WinISD     |
| 44  | Gloss        | Computed by WinISD     |
| 45  | VCCon        | VC connection          |
| 46  | c            | Environmental constant |
| 47  | roo          | Environmental constant |
| 48  | Thick        | Physical dimensions    |
| 49  | Depth        | Physical dimensions    |
| 50  | MagDepth     | Physical dimensions    |
| 51  | Magnet       | Physical dimensions    |
| 52  | Basket       | Physical dimensions    |
| 53  | Outer        | Physical dimensions    |
| 54  | Vcd          | Physical dimensions    |
| 55  | DVol         | Physical dimensions    |
| 56  | ParState     | Parameter state string |

## 3. Field reference

Sources: WinISD help files (`articles/thielesmall.html`, `usingwinisd/newdriver.html`,
etc.) read directly 2026-06-26; winisd.exe binary strings extracted 2026-06-26;
direct analysis of 423 WDR files from `drivers/matt/` (human-curated, authoritative). All values are SI units.

### 3.1 Metadata (positions 1–7)

| Field        | Type   | Format   | Description                                                                                        |
| ------------ | ------ | -------- | -------------------------------------------------------------------------------------------------- |
| Brand        | string |          | **Mandatory.** Manufacturer brand name. See multi-word brands list in `drivers/README.md`.         |
| Model        | string |          | **Mandatory.** Driver model number/name verbatim from datasheet.                                   |
| Manufacturer | string |          | Left blank by scrapers. WinISD-native field; present in the file as `Manufacturer=` with no value. |
| ProvidedBy   | string |          | Data source attribution, e.g. `SB Acoustics website (scraped 2026-06-27)`.                         |
| Comment      | string |          | Free text. OpenISD scrapers use this for source URL and caveats.                                   |
| DateAdded    | string | YYYYMMDD | Date driver was added; no separators (e.g. `20260627`). See §5.4 for date rules.                   |
| DateModified | string | YYYYMMDD | Date of last refresh; no separators. Updated by scrapers on each run.                              |

### 3.2 T/S parameters (positions 8–25)

All user-entered in the WinISD UI. Units are SI throughout — see §6 for conversion factors.

| Field | Unit    | Description and key notes                                                                                                                                                                                                                                                                                                                              |
| ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Qts   | —       | Total damping. Qts = (Qms × Qes)/(Qms + Qes). **Do not enter Qts manually when Qms and Qes are both present** — write Qts=C in ParState and let WinISD compute it. See §5.1.                                                                                                                                                                           |
| Znom  | Ω       | Nominal impedance. **Descriptive only — not used in WinISD simulation.** Source: thielesmall.html. Always enter explicitly; WinISD sometimes assumes the wrong value.                                                                                                                                                                                  |
| Fs    | Hz      | **Mandatory for woofers and midranges.** Free-air resonance frequency. AMT tweeters and compression drivers may legitimately omit Fs — the schema does not require it; the scraper must log its absence as a problem for human review.                                                                                                                 |
| Pe    | W       | Thermal limited max. continuous power handling. If driven above Pe continuously, driver will fail. Source: thielesmall.html.                                                                                                                                                                                                                           |
| SPL   | dB/W/1m | Power sensitivity. `0` if not set. If user enters SPL → ParState pos 4 = E. If WinISD computes it internally → stores the computed value with pos 4 = C. Source: plottypes.html, §8.4.                                                                                                                                                                 |
| Re    | Ω       | DC voice coil resistance (measured with ohmmeter).                                                                                                                                                                                                                                                                                                     |
| Le    | H       | Voice coil inductance. Used only for impedance curves; not included in the acoustic circuit. Source: aboutequivalentcircuits.html.                                                                                                                                                                                                                     |
| fLe   | Hz      | Frequency at which Le and KLe were measured. `0` = use standard Le model only.                                                                                                                                                                                                                                                                         |
| KLe   | H·√Hz   | Voice coil semi-inductance (Vanderkooy model). `0` = model not active.                                                                                                                                                                                                                                                                                 |
| BL    | T·m     | Force factor. **Case-sensitive: `BL=` not `Bl=`** — WinISD imports `BL=` only.                                                                                                                                                                                                                                                                         |
| Xmax  | m       | **One-way PEAK linear excursion in metres.** Not RMS, not peak-to-peak. WinISD uses the raw value — no correction factors applied (some references multiply by 1.15 or 0.87; WinISD does not). Some manufacturers publish the damage limit (Xlim) instead of the linear limit — always use the linear limit. Source: thielesmall.html, plottypes.html. |
| Cms   | m/N     | Mechanical compliance (inverse of stiffness). Most dangerous unit — SB Acoustics doesn't list Cms; Tang Band uses μm/N (÷1,000,000).                                                                                                                                                                                                                   |
| Qms   | —       | Mechanical Q. Higher Qms = less mechanical damping = sharper resonance.                                                                                                                                                                                                                                                                                |
| Qes   | —       | Electrical Q. Higher Qes = less electromagnetic damping.                                                                                                                                                                                                                                                                                               |
| Rms   | kg/s    | Mechanical damping from friction and radiation load. Rarely listed in datasheets — usually computed by WinISD from Qms, Mms, Fs.                                                                                                                                                                                                                       |
| Mms   | kg      | Moving mass including air load.                                                                                                                                                                                                                                                                                                                        |
| Sd    | m²      | Effective piston radiating area.                                                                                                                                                                                                                                                                                                                       |
| Vas   | m³      | Equivalent compliance volume. Source: faq.html.                                                                                                                                                                                                                                                                                                        |

### 3.3 Dia (position 26)

| Field | Unit | Description                                                                                               |
| ----- | ---- | --------------------------------------------------------------------------------------------------------- |
| Dia   | m    | Voice coil diameter. Superseded by Dd (position 29) in WinISD alpha2 (2001). Source: versions.txt alpha2. |

### 3.4 Calculatable fields (positions 27–44)

| Field    | Unit     | Formula / Notes                                                                                                                                                                                                                                                                                                              |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vd       | m³       | Volume displacement. **Display unit:** WinISD shows Vd in cm³ in the UI (e.g. `Vd=0.0002` displays as `200 cm³`). Confirmed 2026-06-28.                                                                                                                                                                                      |
| no       | fraction | Limit efficiency η₀ — the theoretical efficiency the driver approaches at infinite frequency. **Stored as fraction, displayed as % in WinISD UI** (e.g. `0.000754` = 0.0754%). The Transfer function magnitude plot shows gain in dB relative to η₀. `0` when not computed. Source: thielesmall.html, plottypes.html.        |
| Dd       | m        | Effective piston diameter.                                                                                                                                                                                                                                                                                                   |
| EBP      | Hz       | Efficiency bandwidth product. Rule of thumb: < 50 → sealed; > 100 → vented.                                                                                                                                                                                                                                                  |
| numVC    | integer  | Number of voice coils. `1` for most drivers; `2` for dual-voice-coil.                                                                                                                                                                                                                                                        |
| Hc       | m        | Height of voice coil winding.                                                                                                                                                                                                                                                                                                |
| Hg       | m        | Height of magnetic airgap.                                                                                                                                                                                                                                                                                                   |
| SPLmax   | dB       | Max thermal SPL at Pe. `0` when SPL not set. Source: winisd.exe relation group.                                                                                                                                                                                                                                              |
| SPLmaxLF | dB       | Max excursion-limited SPL at 20 Hz in a closed box, half-space. **Does not apply to vented or other assisted enclosures.** `0` when SPL not set. Source: thielesmall.html, winisd.exe relation group.                                                                                                                        |
| USPL     | dB/2.83V | Voltage sensitivity. More application-relevant than SPL for voltage-amplifier use. `0` when SPL not set. Source: thielesmall.html.                                                                                                                                                                                           |
| alfaVC   | 1/K      | Voice coil resistance temperature coefficient. Copper ≈ 0.0039 1/K. Source: thielesmall.html + alpha7 changelog.                                                                                                                                                                                                             |
| Rt       | K/W      | Thermal resistance, voice coil to ambient air. Source: thielesmall.html.                                                                                                                                                                                                                                                     |
| Ct       | J/K      | Thermal capacity of voice coil assembly. Source: thielesmall.html.                                                                                                                                                                                                                                                           |
| gamma    | m/(s²·A) | Acceleration factor. **NOT the adiabatic index** (common confusion from the Greek symbol). Source: winisd.exe strings, relation group "Gamma, Bl, Mms". Old YAML description ("adiabatic index") was an AI inference error; corrected 2026-06-26.                                                                            |
| Rme      | N·s/m    | Electromagnetic damping factor. Analogous to Rms but for the motor system. Source: winisd.exe strings + thielesmall.html (Claus Futtrup). Old YAML description ("motional mass ratio") was wrong; corrected 2026-06-26.                                                                                                      |
| Mpow     | N/√W     | Motor power factor. Linear measure in Newtons, independent of impedance level. Source: thielesmall.html (Claus Futtrup) + winisd.exe relation groups "Mpow, Bl, Re" and "Mpow, Rme". Old YAML description ("power-related parameter") was too vague; corrected 2026-06-26.                                                   |
| Mcost    | N·s/m    | Motor cost factor. Expresses motor power relative to Rme, Xmax, Hc/Hg. Source: thielesmall.html (T.L. Clarke) + winisd.exe strings.                                                                                                                                                                                          |
| Gloss    | fraction | Cone sag fraction when driver is mounted horizontally. **Stored as fraction of Xmax** (multiply by 100 for %). Drivers with Gloss > 0.05 (5% of Xmax) should not be mounted horizontally. Gravity constant: 9.80665 m/s². Old YAML label "Loss factor" was wrong; corrected from versions.txt alpha6 + help file 2026-06-26. |

### 3.5 Voice coil connection (position 45)

| Field | Type    | Values                   | Notes                                                                                                                                                                                                           |
| ----- | ------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VCCon | integer | 1 = parallel, 2 = series | **Save bug:** WinISD always writes `VCCon=1` on save regardless of UI selection. `VCCon=2` can only be set by hand-editing the file; subsequent saves preserve it. Source: verified 2026-06-26 (WINISD.md §12). |

**Project rule for scrapers:** Write `VCCon=1`. This matches what WinISD natively writes and is correct for all single-VC drivers.

### 3.6 Environmental constants (positions 46–47)

Present in all 423 `drivers/matt/` files. WinISD stores them for simulation reproducibility —
SPL and efficiency depend on air properties. **Do not omit these fields.**

Values vary slightly across files because they reflect the WinISD environment settings
(temperature/pressure) at the time of saving. The most common values:

| Field | Unit  | Most common value  | Notes                                                                       |
| ----- | ----- | ------------------ | --------------------------------------------------------------------------- |
| c     | m/s   | `343.684120962152` | Speed of sound at ~20°C, 1 atm. Other observed: `343.68`, `343.68275625794` |
| roo   | kg/m³ | `1.20095217714682` | Air density at ~20°C, 1 atm. Other observed: `1.20095`, `1.20096171470853`  |

Source: plottypes.html — "Because driver's efficiency is related to ambient conditions,
changing for example the project's temperature, will change the calculated SPL level."

### 3.7 Physical dimensions (positions 48–55)

User-entered on the WinISD Dimensions tab. Not derived from T/S parameters. Dimension data appears as text in some datasheets and as engineering drawings or images in most — scrapers currently write `0` because this data is not yet extracted. DVol is computed by WinISD from the other dimension fields.

| Field    | Unit | WinISD UI label | Description                                                                           |
| -------- | ---- | --------------- | ------------------------------------------------------------------------------------- |
| Thick    | m    | Thick           | Basket plate thickness                                                                |
| Depth    | m    | Depth           | Overall driver depth                                                                  |
| MagDepth | m    | Magnet Depth    | Magnet height/thickness (cylinder height)                                             |
| Magnet   | m    | Magnet          | Magnet diameter                                                                       |
| Basket   | m    | Basket          | Basket diameter (hole to cut in baffle)                                               |
| Outer    | m    | Outer           | Outer flange diameter (space needed on baffle)                                        |
| Vcd      | m    | VCd             | Voice coil diameter. Note WDR field is `Vcd=` (lowercase d), WinISD UI shows "VCd".   |
| DVol     | m³   | Dval            | Driver displacement volume (box volume occupied by mounted driver with magnet inside) |

### 3.8 Parameter state (position 56)

See §8 for the complete ParState specification.

## 4. Consistency-check groups

Source: 15 groups confirmed from winisd.exe binary ASCII strings at offset ~8894, immediately
preceding the `TfrmParErrors` form definition; the remaining 7 are inferred from WinISD's
dependency structure and observed behaviour. Group 18 is explicitly ⚠ inferred.

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

| #   | Fields in group          | Formula / relationship                                                                                          |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 1   | Qms, Fs, Cms, Rms        | `Rms = 2π·Fs·Mms/Qms` (Mms implicit via `Cms = 1/(Mms·(2π·Fs)²)`)                                               |
| 2   | BL, Fs, Mms, Re, Qes     | `Qes = 2π·Fs·Mms·Re / BL²`                                                                                      |
| 3   | Rme, BL, Re              | `Rme = BL² / Re`                                                                                                |
| 4   | Rme, Fs, Mms, Qes        | `Rme = 2π·Fs·Mms / Qes` (alternate path to same Rme)                                                            |
| 5   | **Qts, Qms, Qes**        | `Qts = (Qms · Qes) / (Qms + Qes)` — **the group that fires when Qts is entered manually alongside Qms and Qes** |
| 6   | Sd, Dd                   | `Dd = 2·√(Sd/π)`                                                                                                |
| 7   | Mcost, Rme, Hc, Hg, Xmax | `Mcost = f(Rme, Hc, Hg, Xmax)` — always 0 in practice because Hc/Hg are never populated                         |
| 8   | Mpow, BL, Re             | `Mpow = BL / √Re`                                                                                               |
| 9   | Mpow, Rme                | `Mpow = √Rme`                                                                                                   |
| 10  | Cms, Vas, Sd             | `Vas = ρ₀ · c² · Sd² · Cms`                                                                                     |
| 11  | Fs, Mms, Cms             | `Fs = 1 / (2π·√(Mms·Cms))`                                                                                      |
| 12  | EBP, Fs, Qes             | `EBP = Fs / Qes`                                                                                                |
| 13  | gamma, BL, Mms           | `gamma = BL / Mms`                                                                                              |
| 14  | no, c, Fs, Qes, Vas      | `η₀ = (4π²/c³)·Fs³·Vas/Qes`                                                                                     |
| 15  | no, Sd, BL, Mms, Re      | `η₀ = (ρ₀/(2π·c))·BL²·Sd²/(Mms²·Re)` (alternate efficiency route)                                               |
| 16  | SPLmax, Pe, SPL          | `SPLmax = SPL + 10·log10(Pe)`                                                                                   |
| 17  | USPL, SPL, Re            | `USPL = SPL + 10·log10(8/Re)` where 8 = 2.83²                                                                   |
| 18  | no, SPL, roo, c          | `SPL = 10·log10(η₀) + 10·log10(ρ₀·c²/(2π)) + 109` ⚠ inferred — converts efficiency to sensitivity               |
| 19  | Xmax, Hc, Hg             | `Xmax = abs(Hc − Hg) / 2` — only active when Hc and Hg are entered                                              |
| 20  | Vd, Sd, Xmax             | `Vd = Sd · Xmax`                                                                                                |
| 21  | Gloss, Fs, Xmax          | `Gloss = f(Fs, Xmax)` — exact formula unknown; Fs and Xmax bound cone displacement range at resonance           |
| 22  | SPLmaxLF, roo, Vd        | `SPLmaxLF = f(ρ₀, Vd)` — exact formula unknown; excursion-limited SPL at 20 Hz                                  |

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

## 6. Unit conventions

All WDR fields use SI units — the canonical unit for each field is in §3. Scrapers
must convert from datasheet units before writing. See the sibling
[`winisd_tools`](../winisd_tools) repo's `SCRAPING_RULES.md` for the full
conversion table and per-manufacturer Xmax conventions.

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
internal parameter list, which is not publicly documented (WinISD is closed-source).

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

VCCon has **no ParState position** — confirmed by exhaustive single-parameter probe
methodology (see `drivers/sample/PARSTATE_FINDINGS.md`). Even with all T/S params present
and `VCCon=1` in the file, no ParState position changes. VCCon is pure WDR metadata, not
part of WinISD's 49-position internal state machine. Source: WINISD.md §12.

### 8.4 Position mapping

**Fully confirmed** from single-parameter probe experiments in `drivers/sample/` — see
`drivers/sample/README.md` for full methodology and probe file list. 47 of 49 positions
confirmed; 2 unknown (pos 21 and 47, 1-indexed — always N, never reached by any probe).

`drivers/sample/README.md` uses **0-indexed** positions (0–48). This table uses **1-indexed**
(1–49) — subtract 1 to get the README index.

| Pos | Field    | Probe file        | Notes                                                                                                 |
| --- | -------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Znom     | s-znom            |                                                                                                       |
| 2   | Fs       | s-fs              |                                                                                                       |
| 3   | Pe       | s-pe              |                                                                                                       |
| 4   | SPL      | s-spl             | C when WinISD computes from T/S; E when user enters directly                                          |
| 5   | Re       | s-re              |                                                                                                       |
| 6   | Le       | s-le              |                                                                                                       |
| 7   | fLe      | s-fle             | E when set; N when not entered (standard Le model applies)                                            |
| 8   | KLe      | s-kle             | E when set; N when not entered                                                                        |
| 9   | BL       | s-bl              |                                                                                                       |
| 10  | Xmax     | s-xmax            |                                                                                                       |
| 11  | Xlim     | s-xlim            | **ParState-only** — WinISD internal; no `Xlim=` WDR key; always N                                     |
| 12  | Cms      | s-cms             |                                                                                                       |
| 13  | Qms      | s-qms             |                                                                                                       |
| 14  | Qes      | s-qes             |                                                                                                       |
| 15  | Qts      | s-qts             | **WDR writes Qts first; ParState puts it at pos 15** (after Qms=13, Qes=14). Write C not E — see §5.1 |
| 16  | Rms      | s-rms             |                                                                                                       |
| 17  | Mms      | s-mms             |                                                                                                       |
| 18  | Sd       | s-sd              |                                                                                                       |
| 19  | Vd       | s-vd              | C when computed (Sd × Xmax)                                                                           |
| 20  | Vas      | s-vas             |                                                                                                       |
| 21  | **???**  | always N          | Never observed as E or C in any probe including full-entry. Unknown field.                            |
| 22  | Dd       | s-dd              | C when computed                                                                                       |
| 23  | no (η₀)  | s-no              | C when computed from T/S; N when nothing set; E when typed directly                                   |
| 24  | numVC    | s-voicecoils      | **Always E** — WinISD initialises to 1 even in a blank driver                                         |
| 25  | Hc       | s-hc              | N unless voice coil geometry entered                                                                  |
| 26  | Hg       | s-hg              | N unless airgap height entered                                                                        |
| 27  | SPLmax   | s-splmax          | C when SPL computable; N when SPL=0                                                                   |
| 28  | SPLmaxLF | s-splmaxlf        | C when SPL computable; N when SPL=0                                                                   |
| 29  | USPL     | s-uspl            | C when SPL computable; N when SPL=0                                                                   |
| 30  | alfaVC   | s-alfavc          | N in practice                                                                                         |
| 31  | Rt       | s-r-t             | N in practice                                                                                         |
| 32  | Ct       | s-c-t             | N in practice                                                                                         |
| 33  | gamma    | s-gamma           | C when computable (BL/Mms)                                                                            |
| 34  | EBP      | s-ebp             | C when computable (Fs/Qes). **Note: EBP is at pos 34, not adjacent to Rme/Mpow in WDR write order**   |
| 35  | Rme      | s-rme             | C when computable (BL²/Re)                                                                            |
| 36  | Mpow     | s-mpow            | C when computable (BL/√Re)                                                                            |
| 37  | Mcost    | s-mcost           | N in practice (Hc/Hg never entered)                                                                   |
| 38  | Gloss    | s-gloss           | C when computable                                                                                     |
| 39  | Thick    | s-thick           | N unless physical dims entered                                                                        |
| 40  | Depth    | s-depth           | N unless physical dims entered                                                                        |
| 41  | MagDepth | s-magnetdepth     | N unless physical dims entered                                                                        |
| 42  | Magnet   | s-driver-12345678 | N unless physical dims entered                                                                        |
| 43  | Basket   | s-basket          | N unless physical dims entered                                                                        |
| 44  | Outer    | s-outer           | N unless physical dims entered                                                                        |
| 45  | Vcd      | s-vcd             | N or E when physical dims entered                                                                     |
| 46  | DVol     | s-dvol            | C or E when computable/entered                                                                        |
| 47  | **???**  | always N          | Never observed as E or C. VCCon has no ParState slot (§8.3), but its position here is unconfirmed.    |
| 48  | c        | s-c               | C at standard conditions; E when explicitly overridden                                                |
| 49  | roo      | s-roo             | C at standard conditions; E when explicitly overridden                                                |

**Coverage: 47/49 confirmed.** Positions 21 and 47 (1-indexed) are always N; their field
identity is unknown.

**Key non-obvious mappings (WDR write order ≠ ParState order):**

- Qts is written first in WDR but is at ParState pos 15 (after Qms=13, Qes=14)
- EBP appears near dims in WDR write order but is at ParState pos 34
- VCCon appears in WDR between Gloss and c but has **no ParState slot** (§8.3)

Source: `drivers/sample/README.md` (single-parameter probe methodology, WinISD 0.7.0.950,
2026-06-26). Supersedes the inferred table previously in this section and the position data
in `drivers/sample/PARSTATE-FINDINGS.md` (which carries a WARNING that its positions are wrong).

Conclusion: The field ordering is independent of the ParState, which is reasonable as this
is a K/V pair file format order should not matter.

## 9. Provenance sidecar — `_meta.yml`

Each WDR file has a companion `<stem>_meta.yml` in the same directory. The sidecar holds all
provenance, quality, and data-quality metadata. WDR files contain no provenance data — they
end at `ParState=` and are schema-identical to a native WinISD export.

**Metadata-complete design:** The _meta.yml is the canonical complete record of all extracted
datasheet data. The WDR file is a **subset** of _meta.yml — it contains only the T/S parameters
needed for WinISD simulation (and thus is WinISD-importable). For composite drivers like coaxials,
the _meta.yml captures the complete multi-component spec set while the WDR contains only the
primary component (e.g., woofer T/S for a coaxial).

**Example:** A coaxial driver SB12PFC25-4-COAX has two acoustic components:

- **WDR file** (`SB12PFC25-4-COAX.wdr`): Woofer T/S only (Fs=58 Hz, Qts=0.33, Vas=4.8L, etc.) — for WinISD enclosure design
- **\_meta.yml** (`SB12PFC25-4-COAX_meta.yml`): Complete metadata including both woofer and tweeter T/S under `specs.woofer` and `specs.tweeter` keys — the human-readable record

**Schema and field definitions:** The sibling `winisd_tools` repo's
`phase3_extract/scripts/model_openisd.py` — `MetaFile` (Pydantic v2) — is the single source of
truth for `_meta.yml`. Reading it IS reading the `_meta.yml` schema. It defines all fields
(including `discovered_at`, `data_source`), validation rules, and field ordering. `MetaFile` is
a projection of `phase3_extract/scripts/model_metadata.py`'s `MetadataFile` — the internal
`metadata.yml` database record produced by the extraction pipeline, which is the SSOT for all
extracted data (superset of `_meta.yml`, see §9.1). `MetaFile.from_metadata()` builds a
`_meta.yml` from a `MetadataFile` record.

### 9.1 `scraper_meta` — scraper-method metadata bag (internal-only, non-canonical)

`scraper_meta` is an optional, namespaced dict for metadata specific to the **scraper method**
that produced the file, kept separate from canonical data (`specs`, `_sources`). It is
**never** read by the app and **never** holds T/S values — it is provenance/debugging only.
Its contents are free-form per method; a scraper may present a concrete object or a plain dict
on the shared write API and it is serialised here verbatim. Example (AI extraction method):

```yaml
scraper_meta:
  method: ai
  model_id: claude-opus-4-8
  effort: high
  read_record: reads/12P80NdV2_claude_opus-4-8.md
```

`scraper_meta` lives ONLY in `metadata.yml` (the `MetadataFile` record) — it is **not**
serialized into `_meta.yml`. `MetaFile.from_metadata()` explicitly drops the key when
projecting, so the app-facing sidecar never carries it. Because `MetadataFile` and `MetaFile`
are both `extra="forbid"`, every method's bag lives under this one key in `metadata.yml` rather
than adding method-specific top-level fields — the canonical schema stays method-agnostic.

### 9.2 Special URL/Link Placeholders

The metadata URL/link fields (`datasheet_url`, `frd_url`, `zma_url`, etc.) are defined as `Optional[str]` in the schema and accept standard HTTP URLs. However, they also officially support and record two descriptive special-case strings to explain a resource's absence:

* **`CHECKED_NON_EXISTENT`**: Strictly reserved for cases where we have exhaustively searched the official manufacturer page, ran high-priority search-engine sweeps, checked all deterministic URL construction patterns, and verified that absolutely no matching resource or curve diagram exists. This explicitly documents total absence across all possible sources and stops future redundant crawler searches.
* **`SEE DATASHEET DIAGRAM`**: Recorded in `frd_url` or `zma_url` fields when the manufacturer does not publish raw computer-readable `.frd`/`.zma` data files (or they cannot be located), but the datasheet PDF *does* physically contain the visual frequency response and/or impedance curve diagrams. This documents the lack of raw text files while acting as a direct reminder that the curves are available and can be manually or programmatically extracted from the visual datasheet drawings later.


## 10. WinISD simulation model — key facts

Brief summary of WinISD's acoustic model relevant to interpreting WDR parameter values.
See `WINISD.md` for full detail and source citations.

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
