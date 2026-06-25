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
| `boxbench_vendor_page` | URL | The manufacturer's own product page for this **specific** driver model | A brand homepage, a category page, a retailer page |
| `boxbench_source` | URL | The page or repo where the T/S data was actually obtained (PE listing, SoundImports page, GitHub repo, etc.) | — (may equal `boxbench_vendor_page` for direct vendor scrapes) |
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
   `boxbench_vendor_page` instead. Do not use a product page URL as a datasheet
   substitute.

### `boxbench_vendor_page`

1. Must be the manufacturer's own page for **this specific model** — not a brand
   homepage, not a category listing.
2. For direct-vendor scrapers (SB Acoustics, Scan-Speak, Wavecor, etc.) the
   scraped URL is the vendor page.
3. For retailer scrapers (Parts Express, SoundImports) the scraped URL is
   `boxbench_source`, not `boxbench_vendor_page`. The vendor page is the
   manufacturer's site and may not be known — leave empty if unknown.

### `boxbench_source`

1. Set to the URL of the page or resource where the T/S parameters were read.
2. For direct-vendor scrapers: same as `boxbench_vendor_page`.
3. For retailer scrapers: the retailer product page (PE, SoundImports, etc.).
4. Never leave empty for scraped files — it is the chain of custody for the data.

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
| Product page has no PDF link and no separate FRD file | Set `boxbench_vendor_page` and `boxbench_source` only. Leave `boxbench_datasheet` and `boxbench_frd` unset |
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

## What replaced `_meta.json` files

Prior to 2026-06-25 each driver had a companion `DriverName_meta.json` file
holding quality, issue, detail, and datasheet URL. These were merged into the
`.wdr` file itself as `boxbench_*` fields and the JSON files deleted.
Benefits: one file per driver, no synchronisation risk, works with any WDR-aware
tool, and the bundle script only needs to read `.wdr` files.
