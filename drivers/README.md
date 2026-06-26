# Driver library & federation

Related docs (AI agents must read these for driver-related tasks):
[`DRIVER_TYPES.md`](DRIVER_TYPES.md) — classification rules and chip labels ·
[`WDR_FILE_MODEL_AND_WORKFLOWS.md`](WDR_FILE_MODEL_AND_WORKFLOWS.md) — full field schema and data-quality rules ·
[`VENDOR-APIS.md`](VENDOR-APIS.md) — vendor API research for scrapers

---

Resonate's driver data is meant to be an open commons — but a commons doesn't
have to live in one place. Two ways drivers reach the tool:

1. **Bundled** — `.wdr` files in subfolders here. Each subfolder has a `meta.json` with provenance. The `mtg90/`
   collection (~429 files) is
   from [mtg90's AVS Forum post](https://www.avsforum.com/threads/common-sub-driver-winisd-files.2928258/).
2. **Federated** — links to *other people's* driver libraries, listed in
   [`sources.json`](sources.json). Resonate's in-app **driver browser** reads
   those sources and fetches `.wdr` files on demand, so we link instead of copy.
   No re-hosting, no staleness, the original maintainer stays in control.

You can also paste **any** GitHub repo of `.wdr` files into the browser to read
it ad hoc, without it being in the list.

## Add a federated source

Open a PR appending an entry to [`sources.json`](sources.json):

```json
{
  "name": "Your Library Name",
  "type": "github",
  "repo": "owner/repo",
  "branch": "main",
  "path": "subfolder-or-empty-string",
  "fileExtension": ".wdr",
  "url": "https://github.com/owner/repo",
  "description": "What's in it.",
  "license": "the source's license"
}
```

- `type` — currently `github` (the browser enumerates files via the GitHub API
  and fetches raw content; both allow cross-origin reads).
- `path` — `""` for repo root, or a subfolder like `"drivers"`.
- Only metadata lives here — the driver files stay in the source repo.

## Add a bundled driver

Create or use an appropriate subfolder (or `drivers/` root for one-offs), drop a
`.wdr` file there, add provenance to the subfolder's `meta.json`, and open a PR.
Import the spec sheet in the app first and sanity-check the curves.

## File format

`.wdr` is WinISD's driver format: INI-style text, a `[Driver]` section of
`Key=Value` lines in SI units. Resonate imports the core T/S set and re-derives a
self-consistent parameter set (scraped files are often internally inconsistent).

Spotted a wrong number? Open a PR — the point of an open commons is that anyone
can correct it.

### WDR field schema (derived from all bundled collections, 2026-06-24)

Every generated or scraped `.wdr` file **must** follow this schema exactly.
Wrong field names (e.g. `Z=` instead of `Znom=`, `Bl=` instead of `BL=`) will
cause silent import failures or wrong values in Resonate.

#### Provenance fields (always present — use empty string if unknown)

| Field           | Type     | Notes                                                                     |
|-----------------|----------|---------------------------------------------------------------------------|
| `Brand=`        | string   | Canonical manufacturer brand — see multi-word brands list below           |
| `Model=`        | string   | Manufacturer model number/name, verbatim from datasheet                   |
| `Manufacturer=` | string   | Full legal manufacturer name; often same as Brand; leave empty if unknown |
| `ProvidedBy=`   | string   | Data source, e.g. `SB Acoustics website (scraped 2026-06-24)`             |
| `Comment=`      | string   | Free text; include source URL and any caveats                             |
| `DateAdded=`    | YYYY-MM-DD | Date first added to this repo; empty if unknown                          |
| `DateModified=` | YYYY-MM-DD | Date data was last refreshed from source; empty if unknown               |

#### Core T/S parameters — SI units throughout

| Field   | Unit | Notes                                                                                 |
|---------|------|---------------------------------------------------------------------------------------|
| `Fs=`   | Hz   | Free-air resonance                                                                    |
| `Qts=`  | —    | Total Q factor                                                                        |
| `Qes=`  | —    | Electrical Q factor                                                                   |
| `Qms=`  | —    | Mechanical Q factor                                                                   |
| `Znom=` | Ω    | **Nominal impedance — `Znom=` NOT `Z=`**                                              |
| `Re=`   | Ω    | DC voice coil resistance                                                              |
| `Le=`   | H    | Voice coil inductance — **H not mH** (e.g. `0.0006` not `0.6`)                        |
| `BL=`   | T·m  | Force factor — **`BL=` NOT `Bl=`**                                                    |
| `Mms=`  | kg   | Moving mass — **kg not grams** (e.g. `0.0245` not `24.5`)                             |
| `Cms=`  | m/N  | Mechanical compliance — **m/N not mm/N** (e.g. `0.00142` not `1.42`)                  |
| `Rms=`  | kg/s | Mechanical resistance                                                                 |
| `Sd=`   | m²   | Effective piston area — **m² not cm²** (e.g. `0.0216` not `216`)                      |
| `Vas=`  | m³   | Equivalent compliance volume — **m³ not litres** (e.g. `0.094` not `94`)              |
| `Xmax=` | m    | **One-way** linear excursion — **m not mm, one-way not p-p** (e.g. `0.0065` not `13`) |
| `Pe=`   | W    | Rated power handling (RMS)                                                            |
| `SPL=`  | dB   | Sensitivity at 2.83 V/1 m; `0` if unknown                                             |

#### Extended WinISD fields (set to `0` if not available — do NOT omit)

| Field       | Notes                                                                                     |
|-------------|-------------------------------------------------------------------------------------------|
| `fLe=`      | Frequency for Le measurement; `0`                                                         |
| `KLe=`      | Le constant; `0`                                                                          |
| `Dia=`      | Nominal diaphragm diameter (m); `0` if unknown                                            |
| `Vd=`       | Peak volume displacement = Sd × Xmax (m³); compute if possible                            |
| `no=`       | Reference efficiency (dimensionless); `0` if unknown                                      |
| `Dd=`       | Effective diameter derived from Sd = π(Dd/2)²; `0` if unknown                             |
| `EBP=`      | Efficiency bandwidth product = Fs/Qes; `0` if unknown                                     |
| `numVC=`    | Number of voice coils; `1` unless specified otherwise                                     |
| `Hc=`       | Voice coil height (m); `0`                                                                |
| `Hg=`       | Gap height (m); `0`                                                                       |
| `SPLmax=`   | Maximum SPL (dB); `0` if unknown                                                          |
| `SPLmaxLF=` | Max low-frequency SPL (dB); `0`                                                           |
| `USPL=`     | Unweighted SPL; `0`                                                                       |
| `alfaVC=`   | Voice coil alpha; `0`                                                                     |
| `Rt=`       | Thermal resistance; `0`                                                                   |
| `Ct=`       | Thermal capacitance; `0`                                                                  |
| `gamma=`    | Computed WinISD parameter; `0`                                                            |
| `Rme=`      | Computed WinISD parameter; `0`                                                            |
| `Mpow=`     | Computed WinISD parameter; `0`                                                            |
| `Mcost=`    | `0`                                                                                       |
| `Gloss=`    | `0`                                                                                       |
| `VCCon=`    | Voice coil connection: `1`=series, `2`=parallel; use `2` as default                       |
| `c=`        | Speed of sound (m/s); use `343.68275625794`                                               |
| `roo=`      | Air density (kg/m³); use `1.20096171470853`                                               |
| `Thick=`    | `0`                                                                                       |
| `Depth=`    | `0`                                                                                       |
| `MagDepth=` | `0`                                                                                       |
| `Magnet=`   | `0`                                                                                       |
| `Basket=`   | `0`                                                                                       |
| `Outer=`    | `0`                                                                                       |
| `Vcd=`      | `0`                                                                                       |
| `DVol=`     | `0`                                                                                       |
| `ParState=` | WinISD bitmask string; use `EEECEENNEENEEEEEEEEEEECENNCCCNNNCCCCECNNNNNNNNECC` as default |

> **ParState is a fixed 49-character WinISD-internal state table** — always exactly 49 chars
> regardless of how many fields are in the file. Each character is `E` (user-entered),
> `C` (WinISD-calculated), or `N` (not active). It maps to WinISD's fixed internal parameter
> list, not to file line positions. Scraped files use a template string; the characters carry
> no information about which values were measured vs derived.
> See [`drivers/sample/PARSTATE_FINDINGS.md`](sample/PARSTATE_FINDINGS.md) for the full
> reverse-engineered spec (derived from real WinISD experiments).

#### Date semantics and duplicate sorting

`DateModified` is the key field for resolving duplicates. When the same driver appears in multiple
collections, the UI sorts the **most recently dated entry first** — so a fresh vendor scrape
automatically surfaces above an older community measurement.

Rules for setting dates:
- **Scrapers** must set both `DateAdded` (first scrape) and `DateModified` (each refresh) to the
  scrape date in `YYYY-MM-DD` format. The scraper updates `DateModified` on every refresh so the UI
  always shows the freshest data first.
- **Historic collections** (Matt/mtg90, loudspeakerdatabase, etc.) have no scrape date — leave
  `DateAdded` and `DateModified` empty. These will always sort below dated entries for the same
  driver, which is correct: a fresh vendor scrape is more authoritative than an undated community
  measurement.
- **Hand-entered files**: set `DateAdded` to the date you added it; update `DateModified` if you
  later correct the data.

Never use a fake date to artificially boost a file's ranking.

#### CRITICAL rule — never fabricate values

**Only write a field if the source document contained a value for it.**

- If the datasheet/webpage says `0` for a field → write `0`.
- If the datasheet/webpage doesn't mention the field at all → **omit it entirely**. Do NOT substitute `0`, a computed estimate, a "typical" value, or any other placeholder.
- This applies to T/S parameters AND to extended WinISD fields. Missing fields are preferable to fabricated ones — Resonate can handle missing data; it cannot detect silent fabrication.

#### Common mistakes — scrapers and AI agents must avoid these

| Wrong                    | Correct                   | Why                                           |
|--------------------------|---------------------------|-----------------------------------------------|
| `Z=8`                    | `Znom=8`                  | WinISD uses `Znom`; `Z=` is silently ignored  |
| `Bl=7.5`                 | `BL=7.5`                  | Case-sensitive; `Bl=` is not imported         |
| `Le=0.6`                 | `Le=0.0006`               | Must be in H not mH                           |
| `Mms=24.5`               | `Mms=0.0245`              | Must be in kg not grams                       |
| `Cms=1.42`               | `Cms=0.00142`             | Must be in m/N not mm/N                       |
| `Sd=216`                 | `Sd=0.0216`               | Must be in m² not cm²                         |
| `Vas=94`                 | `Vas=0.094`               | Must be in m³ not litres                      |
| `Xmax=13`                | `Xmax=0.0065`             | Must be in m, one-way (÷2 if p-p, then ÷1000) |
| `Name=foo`               | `Brand=foo` + `Model=bar` | No `Name=` field exists in WDR                |
| Omitting extended fields | Set to `0`                | Missing fields break WinISD compatibility     |

---

# Agent rules — importing and fixing `.wdr` files

The sections below apply to **all** bundled driver collections. Per-collection READMEs may add collection-specific rules
on top.

## Known multi-word brands

When splitting a full name into `Brand=` and `Model=`, check this list first. If the brand appears here, use the
canonical form listed — do not split on the first space.

| Filename prefix                 | Canonical `Brand=`             |
|---------------------------------|--------------------------------|
| `Aurum Cantus`                  | `Aurum Cantus`                 |
| `Dayton` / `Dayton Audio`       | `Dayton Audio`                 |
| `EAW`                           | `EAW (Eastern Acoustic Works)` |
| `eighteensound` / `18 Sound`    | `Eighteen Sound`               |
| `Faital Pro` / `Fatial Pro`     | `Faital Pro`                   |
| `mcm` / `MCM`                   | `MCM (MCM Audio Select)`       |
| `Peerless`                      | `Peerless by Tymphany`         |
| `PRV Audio`                     | `PRV Audio`                    |
| `SB Acoustics` / `SB acoustics` | `SB Acoustics`                 |
| `Silver Flute`                  | `Silver Flute`                 |
| `Stereo Integrity`              | `Stereo Integrity`             |
| `TC Sounds`                     | `TC Sounds`                    |
| `Tang Band` / `Tand Band`       | `Tang Band`                    |

If the brand is not in this list, split on the first space as a fallback and add quality **M** for a human to verify.

---

## Standard fixes — apply without raising a quality issue

These are mechanical, deterministic corrections. Apply them silently; note them in the collection-level `meta.json`
transformations log, not in per-file `_meta.json` scores.

| Problem                                                                                                       | Fix                                                                                                                                                                                                                    |
|---------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `Brand=` or `Model=` has leading or trailing whitespace                                                       | Trim it                                                                                                                                                                                                                |
| `Brand=` or `Model=` has leading numeric like `00` that isn't a genuine part or manufacturer prefix           | Trim it                                                                                                                                                                                                                |
| `Brand=` empty, full name is in `Model=`                                                                      | Check the known multi-word brands list above. Use the canonical brand name if found; otherwise split on first space and add quality **M**                                                                              |
| `Brand=` and `Model=` both empty, but filename unambiguously contains both (e.g. `Dayton Audio DCS205-4.wdr`) | Derive `Brand=` and `Model=` from the filename using the known multi-word brands list. Fill in silently — no meta needed if the derivation is unambiguous. If ambiguous, add quality **M**                             |
| `Model=` contains extra description after the model number (e.g. `DS115-8 4in Designer Series`)               | Strip everything after the model number                                                                                                                                                                                |
| Inch mark `"` in `Model=` or `Brand=` (e.g. `8"`)                                                             | Use the manufacturer's code verbatim — CHECK THE MANU WEBSITE. Do not substitute `in` for `"` or vice versa. Filenames only: replace `"` with `in` (OS constraint)                                                     |
| Filename separator mismatch (`_`, `-`, `/`)                                                                   | Use the manufacturer's own separator from their datasheet or website — CHECK THE MANU WEBSITE. `/` becomes `_` in filenames only (OS constraint). If the correct separator cannot be confirmed: add quality **M**      |
| `Brand=` empty or `00`, no name recoverable from fields                                                       | Attempt to derive the canonical manufacturer name from the filename. If derivable: set `Brand=` and `Model=` correctly, add quality **M** for human verification. If manufacturer cannot be derived: add quality **L** |
| Any source (datasheet, manufacturer page, aggregator) was consulted to verify or correct data                 | Set `boxbench_datasheet=<url>` in the WDR file. Prefer the manufacturer's own website over aggregators like speakerboxlite                                                                                             |
| `Model=` is a size/type description rather than a part number (e.g. `18in pro`)                               | Search the manufacturer's site or a reliable aggregator to identify the part number by matching T/S parameters. If confirmed: update `Model=` and set `boxbench_datasheet`. If unconfirmed: add `boxbench_quality=M` with `boxbench_detail` |
| Filename contains a year or version marker (e.g. `v2015`, `(2017)`)                                           | Set `boxbench_quality=H` and add `boxbench_community` explaining the marker, e.g. `"v2015 in filename = 2015 revision"`                                                                                               |
| Filename contains extra description beyond the model number (series name, size, `-subwoofer` suffix, etc.)    | Not an issue — filenames are source identifiers only, not used in the UI. No meta needed unless there is a separate data problem                                                                                       |

---

## Quality review and provenance

Quality metadata and all link references are stored **directly in the `.wdr` file** as `boxbench_` extension fields.
There are no separate `_meta.json` files — everything lives in one place.

**Why the datasheet link is critical:** Without the datasheet URL a reviewer has no way to sanity-check values, catch a
unit-conversion error, or confirm the model number. The datasheet link is the chain of custody for the data.

See [`WDR_FILE_MODEL_AND_WORKFLOWS.md`](WDR_FILE_MODEL_AND_WORKFLOWS.md) for the complete `boxbench_` field schema, link-field population rules, data-quality
checks, and exceptional paths.

### Minimum scraper obligation

Every scraper **must** write at minimum these fields into every `.wdr` it creates:

```
boxbench_datasheet=<manufacturer PDF URL — omit the line if not found>
boxbench_vendor_page=<manufacturer product page URL>
boxbench_source=<URL where T/S data was read from>
boxbench_quality=M
boxbench_issue=scraped_not_human_verified
boxbench_detail=Automatically scraped from <vendor> on <date>. Not human-verified.
```

For measurement data links (`boxbench_frd`, `boxbench_impedance`) — follow the
inspection workflow in `WDR_FILE_MODEL_AND_WORKFLOWS.md` before setting them. Never set `boxbench_frd`
to a URL without verifying the content is frequency-response data.

### Quality scores

| Score | Meaning |
|-------|---------|
| **H** | Manufacturer-sourced, human-verified |
| **M** | Scraped or otherwise unverified — default for all automated imports |
| **L** | Known data problem — values suspected wrong, incomplete, or internally inconsistent |

Scraped files are always **M** until a human verifies the T/S values against the datasheet.
