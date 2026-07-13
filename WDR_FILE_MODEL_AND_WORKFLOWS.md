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

### `manu_page_url` and `vendor_page_url`

The directory a WDR lives in tells you what kind of site was scraped. Use that
to decide which field(s) to fill:

| Directory / scraped site                                                  | `manu_page_url`                                | `vendor_page_url`    |
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

For scraped drivers this is typically the same URL as `vendor_page_url`
or `manu_page_url` (whichever applies). It exists as a separate field to
cover sources that are neither vendor nor manufacturer listings — a GitHub repo
of community measurements, an AVS Forum post, a raw datasheet. In those cases
`vendor_page_url` and `manu_page_url` may be unset while
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
| Product page has no PDF link and no separate FRD file                  | Set `manu_page_url`, `vendor_page_url`, and `source`. Leave `datasheet_url` and `frd_url` unset                      |
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
