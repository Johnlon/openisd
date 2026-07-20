# WDR Schema

**Authoritative reference for the WDR file format and the `_meta.yml` provenance sidecar.**

## 1. File format

`.wdr` is WinISD Pro's driver file format. It is a plain-text INI-style file.

| Property            | Value                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section header      | `[Driver]` — must be the first line; no other sections                                                                                                                     |
| Field separator     | `=` with no spaces (`Key=Value`)                                                                                                                                           |
| Decimal separator   | `.` (period)                                                                                                                                                               |
| Encoding            | **UTF-8** — VERIFIED: `drivers/sample/driver-with-unicode-text.wdr` stores `Model=…Euro € Kanji 漢字` etc. as valid UTF-8 (€ = `E2 82 AC`, 漢字 = `E6 BC A2 E5 AD 97`) and WinISD reads it back correctly. See §1.1. |
| Line endings        | **CRLF between fields** — VERIFIED across the `drivers/sample/*.wdr` set. (An in-field newline is NOT CRLF — see §1.1.)                                                     |
| Field order         | **Observed consistent** across 423 `drivers/matt/` files and 53 WinISD-generated probe files — whether WinISD enforces order on read is untested                           |
| Total native fields | 56 (7 metadata + 48 numeric/string + 1 ParState) — WinISD always writes all 56 on save; scraper-generated files may have only 27–29 (core T/S block) and WinISD loads them |
| Custom fields       | Observed after `ParState=` only — not verified that WinISD ignores pre-ParState unknowns                                                                                   |

WDR files contain only WinISD-native fields. All provenance and quality metadata lives in
the companion `_meta.yml` sidecar (see §9).

Source for structural claims: direct analysis of 423 `drivers/matt/` files plus 53 WinISD-generated single-field probe files from `drivers/sample/` (2026-06-28).

### 1.1 Text encoding and the in-field newline (`0xA4`)

Two properties, both VERIFIED against WinISD-written samples in `drivers/sample/`
(`driver-with-unicode-text.wdr`, `driver-with-latin-text.wdr`), not assumed:

- **Unicode is supported — field values are UTF-8.** A `Brand`/`Model`/`Manufacturer`/
  `Comment` may carry any Unicode text; WinISD stores it as UTF-8 and reads it back
  intact. Example (byte-verified): `Model=driver with unicode text Euro € Kanji 漢字`
  where `€` = `E2 82 AC`, `漢` = `E6 BC A2`, `字` = `E5 AD 97` — i.e. correct UTF-8.

- **A newline WITHIN a field value is encoded as a single `0xA4` byte** — NOT a CRLF
  (CRLF separates *fields*; a literal newline mid-value would break the line-per-field
  INI structure). This is WinISD's own convention and is **independent of Unicode**:
  - unicode sample, Comment `Euro €`⏎`Kanji 漢字`⏎ → `Comment=Euro €<A4>Kanji 漢字<A4>`
  - latin sample, Comment `multi line`⏎`comment `⏎`in plain ascii` → `Comment=multi line <A4>comment <A4>in plain ascii`

  There is one `0xA4` byte per embedded newline (including a trailing one). Because a
  bare `0xA4` is not valid UTF-8, a `.wdr` that contains a multi-line field value is
  **UTF-8 for all its text except those `0xA4` newline markers** — i.e. not strictly
  UTF-8-decodable as a whole. Readers must treat `0xA4` as a newline within a value;
  writers must emit the raw single byte `0xA4` (note: `U+00A4` in UTF-8 is the two-byte
  `C2 A4`, which is WRONG — the on-disk marker is the single byte `A4`).

  The OpenISD scraper implements exactly this in `winisd_tools`
  `scrapers/scrapers/lib/model_openisd.py` (`WdrFile.to_bytes()` / `_wdr_field()`):
  it carries an in-field newline as a private-use sentinel through serialisation and
  lowers it to the raw `0xA4` byte at the final encode.

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

---

## Appendix — file model & link-field workflows (merged from WDR_FILE_MODEL_AND_WORKFLOWS.md, 2026-07-20)

# Driver library data model

## File format — WDR

Each driver is a single `.wdr` file (WinISD Driver Record). The format is plain
`key=value`, one field per line, with a `[Driver]` section header. Standard fields
are defined by WinISD; unknown fields are silently ignored by WinISD and other
parsers, making the format safely extensible.

### Standard T/S fields

> _Field-definition table dropped in this merge (2026-07-20): it duplicated this
> file's own field spec — see §2 "Canonical field order" and §3 "Field reference"
> above for the canonical field definitions. WDR_SCHEMA's version is kept._

---

## Link-field population workflow — rules for AI agents and scrapers

These rules apply every time a link field is written to `_meta.yml`, whether by a
scraper, a backfill script, or an AI agent working on an individual file. Follow
them in order. **Do not skip the inspection steps.**

### `datasheet_url`

1. Obtain a candidate URL (from the product page, sitemap, or scraper output).
2. **Verify it resolves to a PDF.** The URL must end in `.pdf` or return
   `Content-Type: application/pdf`. If the server returns HTML, a ZIP, or a
   redirect to a product page → do not set this field.
3. **Check the PDF filename contains the model number** (or a recognisable
   abbreviation of it). If the filename contains a clearly different model
   number, stop — you have the wrong PDF. This is a hard gate; do not skip it.
   > Real failure: `Dayton Audio PA460-8` had its datasheet set to a
   > parts-express URL for the `RSS460HO-4` — a different product. The PDF
   > filename `295-472-dayton-audio-rss460ho-4-specifications.pdf` would have
   > caught this immediately.
4. **Check the PDF is product-specific, not a manufacturer catalog.** Reject any
   URL whose filename matches catalog patterns: `*catalog*`, `*Catalog*`,
   `*catalogue*`, `*Catalogo*`, `-WEB.pdf`. A catalog covers many products and
   is not a datasheet. If only a catalog is available, leave `datasheet_url`
   unset and set `manu_page_url` instead.
   > Real failure: 14 SICA drivers, 4 HiVi Swan, and 2 PRV Audio drivers had
   > their `datasheet_url` set to full manufacturer catalog PDFs scraped from
   > SoundImports. None were product-specific.
5. **If the PDF URL is from a different domain than the scraped source**, apply
   extra scrutiny. Verify the filename matches the current product's model
   before setting the field.
   > Real failure: the PA460-8 `corrections` field (AI-written) stated
   > "confirmed against Dayton Audio PA460-8 datasheet" while the URL it stored
   > was for the RSS460HO-4 — a different product on a different domain. The AI
   > agent asserted a verification step it did not actually perform. **A
   > `corrections` note claiming verification is not evidence of
   > verification.** The filename check in step 3 is the real gate.
6. **Duplicate URL check:** if the same PDF URL already exists in another WDR
   for a different model in the same collection, it is almost certainly a
   catalog or wrong product. Do not reuse it.
7. Set the field to the internet URL. Also download the PDF to
   `<collection>/datasheets/` for local caching. The WDR holds the internet URL;
   the local copy is a cache only.
8. **If no PDF is found** → leave `datasheet_url` unset. Set
   `manu_page_url` so a human reviewer can find the datasheet later.

### `manu_page_url` and `distributor_page_url`

The directory a WDR lives in tells you what kind of site was scraped. Use that
to decide which field(s) to fill:

| Directory / scraped site                                                  | `manu_page_url`                                | `distributor_page_url` |
| ------------------------------------------------------------------------- | ---------------------------------------------- | -------------------- |
| `sb-acoustics/`, `scan-speak/`, `wavecor/` — manufacturer sells direct    | ✓ set to scraped URL                           | leave unset          |
| `parts-express/`, `soundimports/` — third-party retailer                  | leave unset (manu page unknown at scrape time) | ✓ set to scraped URL |
| `dayton-audio/` scraped from daytonaudio.com — manu who also sells direct | ✓ set to scraped URL                           | ✓ set to same URL    |

Rules:

- Only set a field when the scraped site actually fulfils that role. Do not copy
  the retailer URL into `manu_page_url` or vice versa.
- If a separate manufacturer page is discovered during a retailer scrape (e.g.
  the PE listing links to a Dayton Audio product page), set `manu_page_url`
  to that URL as well.
- Do not set either field to a brand homepage or a category listing.

### `source`

Generic provenance field — always set, regardless of site type.

For scraped drivers this is typically the same URL as `distributor_page_url`
or `manu_page_url` (whichever applies). It exists as a separate field to
cover sources that are neither vendor nor manufacturer listings — a GitHub repo
of community measurements, an AVS Forum post, a raw datasheet. In those cases
`distributor_page_url` and `manu_page_url` may be unset while
`source` still records where the numbers came from.

**If in doubt:** `source` = the URL you would give someone who asked
"where did you get these T/S numbers?"

### `frd_url`

**This is the most abuse-prone field. Follow these steps exactly.**

1. Obtain a candidate URL.
2. **Fetch the URL.** If it returns a 404 or network error → do not set this
   field. A broken URL is worse than no URL.
3. **Determine the file type:**
   - URL ends in `.frd`, `.txt`, `.zma` → inspect the first few lines. It must
     look like whitespace-separated columns of numbers (freq, amplitude, phase).
     If it does → set `frd_url` (or `zma_url` for ZMA/impedance format).
     If it contains HTML, XML, or binary → do not set.
   - URL ends in `.zip` → **download and list the contents before setting
     anything.** A ZIP must contain at least one `.frd`, `.zma`, or tab-separated
     `.txt` measurement file to qualify. If the ZIP contains only:
     - `.igs`, `.step`, `.x_t`, `.stp`, `.dwg`, `.dxf` files → it is a CAD
       archive. Do not set `frd_url`. No `_meta.yml` field exists yet for
       mechanical/CAD files.
     - `.pdf`, `.jpg`, `.png` only → it is a graph archive, not raw data. Do not
       set `frd_url`.
     - A mix of FRD data and other files → the ZIP qualifies; set `frd_url`.
   - URL ends in `.pdf` → it is a datasheet, not measurement data. Set
     `datasheet_url` instead. Never set `frd_url` to a PDF URL.
4. Set the field to the **internet URL**. Cache the file locally alongside the
   WDR. Do not set the field to a local file path — ever.
5. **If the same ZIP contains both FRD and impedance data** → set `frd_url`
   to the ZIP URL only. Do not also set `zma_url` to the same ZIP — it
   is redundant and misleading.

### `zma_url`

1. Same rules as `frd_url` — verify the content before setting.
2. Only set if the impedance data is in a **separate** file or URL from
   `frd_url`. If both are in the same ZIP → `frd_url` covers it.
3. A valid impedance file has columns: freq (Hz) / impedance (Ω) / phase (°).

---

## Exceptional paths

| Situation                                                              | Correct action                                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Product page has no PDF link and no separate FRD file                  | Set `manu_page_url`, `distributor_page_url`, and `source`. Leave `datasheet_url` and `frd_url` unset                      |
| ZIP found on vendor site — contents unknown                            | Download it, list contents (see `frd_url` step 3), then decide. Never set `frd_url` without inspection               |
| ZIP contains CAD files only                                            | Download and cache locally. Set no `_meta.yml` field (no mechanical-file field is defined yet). Do not set `frd_url` |
| FRD data is only available as a PDF graph (not raw data)               | Do not set `frd_url`. A rendered graph is not machine-readable data                                                  |
| Multiple off-axis FRD files (0°, 15°, 30°, 45°)                        | If they are all in one ZIP → `frd_url` = ZIP URL. If individual `.frd` files → `frd_url` = on-axis (0°) URL          |
| Wavecor multi-model page (e.g. WF090WA01_02) — SPL TXT URL returns 404 | Do not set `frd_url`. The multi-model URL pattern does not match individual model TXT filenames on Wavecor's server  |
| Scraper downloads a file that already exists locally                   | Skip the download; still set the field in `_meta.yml` to the internet URL if the local file passes the content check |
| URL resolves but download fails (timeout, SSL error)                   | Do not set the field. Log the error. A cached file from a previous run is acceptable if it passes the content check  |
| Manufacturer changes URL after field was set                           | During a scraper refresh, re-verify all link fields. Update stale URLs. Set `DateModified` to the refresh date       |

---

## Automated DQ check

A WDR/`_meta.yml` file must pass the shared DQ check before being treated as
authoritative — it scans every file and flags physically impossible or highly
suspicious T/S values by rule ID. The tool and its rule set (thresholds, known
false-positive calibration, root causes) live in the sibling
[`winisd_tools`](../winisd_tools) repo's `dq_check.py` — run it against this
repo's own `drivers/matt/` with `--root ../openisd/drivers` (see that repo's
`README.md`).

## Provenance rules

- Every driver file must have `ProvidedBy=` set to the collection or individual
  that supplied the data.
- If the data was scraped automatically, set `quality=M` and
  `issue=scraped_not_human_verified` until a human verifies it.
- If a `dq_issue` is present, the file is flagged for correction and
  must not be treated as authoritative.

---

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

---

## Provenance sidecar — `_meta.yml`

Each driver has a companion `DriverName_meta.yml` YAML file holding all provenance
and quality metadata. See `WDR_SCHEMA.md` §9 and the sibling `winisd_tools` repo's
`wdr_meta_schema.py` for the authoritative field list and schema.

**Key fact:** This metadata is kept entirely out of the `.wdr` file — WDR files end at
`ParState=` and contain no non-WinISD fields. The sidecar is the sole location for
provenance; the WDR is schema-identical to a native WinISD export.

## Scripts reference

All tooling lives in `scripts/`. Run from the repo root.

| Script                         | Purpose                                                                                                               | When to run                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `bundle-drivers.mjs`           | Bundles all WDR files under `drivers/` → `src/drivers-bundle.json` for the UI                                         | After any WDR add/edit/delete, before committing                |
| `link-driver-repo.sh`          | Symlinks the federated collections into `drivers/` from a sibling `winisd_drivers` checkout, for local dev/DQ         | Local dev setup only — untracked, not needed by the running app |
| `restore_matt_from_archive.py` | Restores the human-curated `drivers/matt/` collection from archive with only its approved transformations (AI-locked) | See `drivers/matt/README.md`                                    |

The driver collections themselves (`dayton-audio`, `sb-acoustics`, `scan-speak`,
`soundimports`, `wavecor`, `parts-express`, `loudspeakerdatabase`) are produced and
maintained by an external scraping/data-quality pipeline in the sibling
[`winisd_tools`](../winisd_tools) repo, writing into [`winisd_drivers`](../winisd_drivers) —
see that repo's `README.md` for the scrape/enrich/DQ toolchain and workflow.
