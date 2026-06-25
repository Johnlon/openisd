# Driver library data model

## File format — WDR

Each driver is a single `.wdr` file (WinISD Driver Record). The format is plain
`key=value`, one field per line, with a `[Driver]` section header. Standard fields
are defined by WinISD; unknown fields are silently ignored by WinISD and other
parsers, making the format safely extensible.

### Standard T/S fields

| Field | Unit | Notes |
|---|---|---|
| `Brand` | — | Manufacturer name |
| `Model` | — | Model number |
| `Fs` | Hz | Free-air resonant frequency |
| `Qts` | — | Total Q |
| `Qes` | — | Electrical Q |
| `Qms` | — | Mechanical Q |
| `Vas` | m³ | Equivalent acoustic compliance volume |
| `Sd` | m² | Effective piston area |
| `Re` | Ω | DC voice-coil resistance |
| `Le` | H | Voice-coil inductance |
| `BL` | T·m | Force factor |
| `Xmax` | m | Linear peak excursion (one-way) |
| `Mms` | kg | Moving mass including air load |
| `Cms` | m/N | Mechanical compliance |
| `Rms` | kg/s | Mechanical resistance |
| `Pe` | W | Rated power (RMS) |
| `Znom` | Ω | Nominal impedance |
| `Vd` | m³ | Peak displacement volume (= Sd × Xmax) |
| `Dd` | m | Effective piston diameter |
| `ProvidedBy` | — | Free-text credit for who supplied the data |
| `Comment` | — | Free-text notes |

---

## Extension fields — `boxbench_` prefix

All Resonate-specific metadata is stored in the same `.wdr` file using a
`boxbench_` prefix so it is clearly namespaced away from WinISD fields.
WinISD and other parsers ignore these lines.

### Defined `boxbench_` fields

#### Link fields

| Field | Type | What it MUST contain | What it must NOT contain |
|---|---|---|---|
| `boxbench_datasheet` | URL | Manufacturer PDF datasheet — the document that specifies the T/S parameters | A product web page, a retailer page, a ZIP, an image, or any non-PDF |
| `boxbench_manu_page` | URL | The manufacturer's own product page — set this when the **scraped site is the manufacturer** (SB Acoustics, Scan-Speak, Wavecor, Dayton Audio direct, etc.) | A retailer page, a brand homepage, a category page |
| `boxbench_vendor_page` | URL | The vendor/retailer product listing — set this when the **scraped site is a reseller** (Parts Express, SoundImports, etc.) | A brand homepage, a category page |
| `boxbench_source` | URL | Generic provenance: where the T/S numbers came from. For scraped drivers this is usually the same URL as `boxbench_vendor_page` or `boxbench_manu_page`. It diverges when data comes from a source that is neither a vendor nor a manufacturer — a GitHub repo, a forum post, a community measurement file. Always set; it is the chain of custody for the data. | — |
| `boxbench_frd` | URL | A file or archive that contains machine-readable **frequency response** data in FRD or tab-separated (freq / dB / phase) format. PEs `_data.zip` files qualify; they contain `.frd` and `.zma` files | A PDF graph, a CAD file, a 3D model, a spec sheet, an image, a general product ZIP that has not been inspected |
| `boxbench_impedance` | URL | A file or archive that contains machine-readable **impedance vs frequency** data (freq / Ω / °) — **only when this data is in a separate file from `boxbench_frd`** | Anything already covered by `boxbench_frd`; do not duplicate if the same ZIP holds both |

#### Metadata fields

| Field | Type | Description |
|---|---|---|
| `boxbench_quality` | `H` / `M` / `L` | Data confidence: **H** = manufacturer-sourced, human-verified; **M** = scraped or unverified; **L** = estimated or known-incorrect |
| `boxbench_issue` | string | Short snake_case tag for a known data issue (e.g. `scraped_not_human_verified`, `model_corrected`) |
| `boxbench_detail` | string | Human-readable explanation of the issue or provenance |
| `boxbench_dq_issue` | string | Data-quality problem flagged during automated DQ review (e.g. `Qts=97.33: physically impossible`). Files with this field must not be used without manual correction |
| `boxbench_corrections` | string | Notes on automated corrections applied post-scrape |
| `boxbench_community` | string | Community-contributed notes (version markers, revision history, etc.) |
| `boxbench_fetched_sku` | string | SKU actually used when the original SKU was discontinued and data was fetched from a successor |
| `boxbench_obsolete` | `true` | Driver is confirmed discontinued. Omit otherwise |
| `boxbench_reviewedBy` | string | Name or handle of the person who verified the T/S data against the datasheet. `null` until reviewed |

### Adding new fields

Use the `boxbench_` prefix and a `snake_case` name. Values must be single-line
(no newlines). Keep values concise — WDR files are plain text and must remain
human-readable.

---

## Link-field population workflow — rules for AI agents and scrapers

These rules apply every time a `boxbench_` link field is written, whether by a
scraper, a backfill script, or an AI agent working on an individual file. Follow
them in order. **Do not skip the inspection steps.**

### `boxbench_datasheet`

1. Obtain a candidate URL (from the product page, sitemap, or scraper output).
2. **Verify it resolves to a PDF.** The URL must end in `.pdf` or return
   `Content-Type: application/pdf`. If the server returns HTML, a ZIP, or a
   redirect to a product page → do not set this field.
3. Set the field to the internet URL. Also download the PDF to
   `<collection>/datasheets/` for local caching. The WDR holds the internet URL;
   the local copy is a cache only.
4. **If no PDF is found** → leave `boxbench_datasheet` unset. Set
   `boxbench_manu_page` so a human reviewer can find the datasheet later.

### `boxbench_manu_page` and `boxbench_vendor_page`

The directory a WDR lives in tells you what kind of site was scraped. Use that
to decide which field(s) to fill:

| Directory / scraped site | `boxbench_manu_page` | `boxbench_vendor_page` |
|---|---|---|
| `sb-acoustics/`, `scan-speak/`, `wavecor/` — manufacturer sells direct | ✓ set to scraped URL | leave unset |
| `parts-express/`, `soundimports/` — third-party retailer | leave unset (manu page unknown at scrape time) | ✓ set to scraped URL |
| `dayton-audio/` scraped from daytonaudio.com — manu who also sells direct | ✓ set to scraped URL | ✓ set to same URL |

Rules:
- Only set a field when the scraped site actually fulfils that role. Do not copy
  the retailer URL into `boxbench_manu_page` or vice versa.
- If a separate manufacturer page is discovered during a retailer scrape (e.g.
  the PE listing links to a Dayton Audio product page), set `boxbench_manu_page`
  to that URL as well.
- Do not set either field to a brand homepage or a category listing.

### `boxbench_source`

Generic provenance field — always set, regardless of site type.

For scraped drivers this is typically the same URL as `boxbench_vendor_page`
or `boxbench_manu_page` (whichever applies). It exists as a separate field to
cover sources that are neither vendor nor manufacturer listings — a GitHub repo
of community measurements, an AVS Forum post, a raw datasheet. In those cases
`boxbench_vendor_page` and `boxbench_manu_page` may be unset while
`boxbench_source` still records where the numbers came from.

**If in doubt:** `boxbench_source` = the URL you would give someone who asked
"where did you get these T/S numbers?"

### `boxbench_frd`

**This is the most abuse-prone field. Follow these steps exactly.**

1. Obtain a candidate URL.
2. **Fetch the URL.** If it returns a 404 or network error → do not set this
   field. A broken URL is worse than no URL.
3. **Determine the file type:**
   - URL ends in `.frd`, `.txt`, `.zma` → inspect the first few lines. It must
     look like whitespace-separated columns of numbers (freq, amplitude, phase).
     If it does → set `boxbench_frd` (or `boxbench_impedance` for ZMA/impedance).
     If it contains HTML, XML, or binary → do not set.
   - URL ends in `.zip` → **download and list the contents before setting
     anything.** A ZIP must contain at least one `.frd`, `.zma`, or tab-separated
     `.txt` measurement file to qualify. If the ZIP contains only:
     - `.igs`, `.step`, `.x_t`, `.stp`, `.dwg`, `.dxf` files → it is a CAD
       archive. Do not set `boxbench_frd`. No `boxbench_` field exists yet for
       mechanical/CAD files.
     - `.pdf`, `.jpg`, `.png` only → it is a graph archive, not raw data. Do not
       set `boxbench_frd`.
     - A mix of FRD data and other files → the ZIP qualifies; set `boxbench_frd`.
   - URL ends in `.pdf` → it is a datasheet, not measurement data. Set
     `boxbench_datasheet` instead. Never set `boxbench_frd` to a PDF URL.
4. Set the field to the **internet URL**. Cache the file locally alongside the
   WDR. Do not set the field to a local file path — ever.
5. **If the same ZIP contains both FRD and impedance data** → set `boxbench_frd`
   to the ZIP URL only. Do not also set `boxbench_impedance` to the same ZIP — it
   is redundant and misleading.

### `boxbench_impedance`

1. Same rules as `boxbench_frd` — verify the content before setting.
2. Only set if the impedance data is in a **separate** file or URL from
   `boxbench_frd`. If both are in the same ZIP → `boxbench_frd` covers it.
3. A valid impedance file has columns: freq (Hz) / impedance (Ω) / phase (°).

---

## Exceptional paths

| Situation | Correct action |
|---|---|
| Product page has no PDF link and no separate FRD file | Set `boxbench_manu_page`, `boxbench_vendor_page`, and `boxbench_source`. Leave `boxbench_datasheet` and `boxbench_frd` unset |
| ZIP found on vendor site — contents unknown | Download it, list contents (see `boxbench_frd` step 3), then decide. Never set `boxbench_frd` without inspection |
| ZIP contains CAD files only | Download and cache locally. Set no `boxbench_` field (no mechanical-file field is defined yet). Do not set `boxbench_frd` |
| FRD data is only available as a PDF graph (not raw data) | Do not set `boxbench_frd`. A rendered graph is not machine-readable data |
| Multiple off-axis FRD files (0°, 15°, 30°, 45°) | If they are all in one ZIP → `boxbench_frd` = ZIP URL. If individual `.frd` files → `boxbench_frd` = on-axis (0°) URL |
| Wavecor multi-model page (e.g. WF090WA01_02) — SPL TXT URL returns 404 | Do not set `boxbench_frd`. The multi-model URL pattern does not match individual model TXT filenames on Wavecor's server |
| Scraper downloads a file that already exists locally | Skip the download; still set the `boxbench_` field to the internet URL if the local file passes the content check |
| URL resolves but download fails (timeout, SSL error) | Do not set the field. Log the error. A cached file from a previous run is acceptable if it passes the content check |
| Manufacturer changes URL after field was set | During a scraper refresh, re-verify all link fields. Update stale URLs. Set `DateModified` to the refresh date |

---

## Provenance rules

- Every driver file must have `ProvidedBy=` set to the collection or individual
  that supplied the data.
- If the data was scraped automatically, set `boxbench_quality=M` and
  `boxbench_issue=scraped_not_human_verified` until a human verifies it.
- If a `boxbench_dq_issue` is present, the file is flagged for correction and
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

| Type | Primary criterion | Secondary checks |
|---|---|---|
| **Subwoofer** | Fs < 35 Hz | Sd large, Pe > 100 W, Xmax > 10 mm |
| **Woofer** | 35 Hz ≤ Fs < 100 Hz | Sd > 80 cm², Pe > 30 W |
| **Mid-bass** | 100 Hz ≤ Fs < 300 Hz | Sd 30–150 cm² |
| **Midrange** | 300 Hz ≤ Fs < 1000 Hz | Sd 5–50 cm² |
| **Full-range** | 80 Hz ≤ Fs < 600 Hz | Sd small (< 40 cm²), wide usable bandwidth |
| **Tweeter** | Fs ≥ 1000 Hz | Sd < 10 cm², Pe < 50 W |
| **Passive radiator** | No voice coil | Re = 0 or missing, no Qes |

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

| Nominal size | Typical Sd | Dd (derived) | f_beam |
|---|---|---|---|
| 4″ | 53 cm² | 82 mm | ~1340 Hz |
| 5¼″ | 87 cm² | 105 mm | ~1040 Hz |
| 6½″ | 134 cm² | 130 mm | ~840 Hz |
| 8″ | 214 cm² | 165 mm | ~665 Hz |
| 10″ | 346 cm² | 210 mm | ~520 Hz |
| 12″ | 506 cm² | 254 mm | ~430 Hz |

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

| SPL difference | Assessment |
|---|---|
| ≤ 2 dB | Excellent match |
| 2–4 dB | Good — minor padding or baffle step correction will align |
| 4–6 dB | Marginal — padding is needed; verify thermal power in the attenuated driver |
| > 6 dB | Poor — large L-pad raises impedance, complicates crossover design |

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

| EBP | Suggests |
|---|---|
| < 50 | Sealed (IB) — driver has high Qes and is better damped electrically in a sealed box |
| 50–100 | Either sealed or vented — designer's choice |
| > 100 | Vented — driver has low Qes and benefits from port tuning to restore bass extension |

⚠ EBP is a fast heuristic, not a substitute for modelling. A driver with EBP =
110 can still work well in a sealed box if cabinet size and desired extension
allow. Use it as the first-pass filter only.

---

### Passive radiator sizing rules

A passive radiator (PR) replaces the port in a vented alignment. Matching rules:

| Parameter | Rule |
|---|---|
| **Sd (PR)** | ≥ Sd of the active driver, ideally 1.0–2.0× ⚠ |
| **Mmd (PR)** | Tuned so the PR-box resonance fb ≈ port-tuned equivalent: `Mmd ≈ (ρ₀ × c² × Sd_pr² ) / (Vas × (2π×fb)²)`. In practice, PRs ship with adjustable mass rings. |
| **Qms (PR)** | Should be >> 3 (very low mechanical loss); a lossy PR damps the tuning peak and lowers output near fb. |
| **Fs (PR)** | Lower is better — ideally Fs_pr < fb so the PR moves freely at the tuning frequency. |

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
designer whether a pair *can* be crossed, not where to cross them. That choice
depends on room acoustics, baffle diffraction, and filter design, all of which
are outside the scope of T/S parameters alone.

---

## What replaced `_meta.json` files

Prior to 2026-06-25 each driver had a companion `DriverName_meta.json` file
holding quality, issue, detail, and datasheet URL. These were merged into the
`.wdr` file itself as `boxbench_*` fields and the JSON files deleted.
Benefits: one file per driver, no synchronisation risk, works with any WDR-aware
tool, and the bundle script only needs to read `.wdr` files.
