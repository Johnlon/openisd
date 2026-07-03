# References & prior art

External resources for OpenISD's engine and tests. Two uses: **theory** (what
the math should be) and **oracles** (known-good values to test against).

> Using these for reference is fine — reading equations and theory, and
> *cross-checking outputs*, carries no licence issue. Do **not** copy code from
> GPL/closed projects into OpenISD; cite them as reference and re-derive.

---

## 1. Theory canon — what our engine implements

OpenISD uses the **analogous-circuit (acoustical impedance analogy)** model with
controlled sources coupling the electrical → mechanical → acoustical domains. The
authoritative sources for exactly this approach:

- **W. Marshall Leach Jr — *Introduction to Electroacoustics & Audio Amplifier
  Design.*** Dedicated chapters on analogous circuits, closed-box and vented-box
  systems, acoustic impedance and pressure transfer functions. This is the closest
  textbook match to our `circuit`/`sweep` model.
  Legacy course material: <https://leachlegacy.ece.gatech.edu/audiotext/>
- **Leach — "Electroacoustic Design with SPICE", JAES Vol. 39 No. 7/8 (1991).**
  The vented-box loudspeaker as a SPICE circuit — directly comparable to our
  per-frequency solve.
- **Vented-box design notes (Leach, Georgia Tech):**
  <https://leachlegacy.ece.gatech.edu/ece4445/downloads/ventedbox.pdf>
- **A. N. Thiele (1971) and R. H. Small (1972–73) — the original JAES papers**
  on closed-box and vented-box systems and their alignments. The primary source
  for the alignment tables (see §3).
- **Klippel — small-signal lumped parameters** (parameter definitions):
  <https://www.klippel.de/know-how/measurements/transducer-parameters/small-signal-lumped-parameters.html>
- **Thiele/Small parameters — Wikipedia** (quick formula reference):
  <https://en.wikipedia.org/wiki/Thiele/Small_parameters>

---

## 2. Open-source implementations — cross-check / sanity only

Useful to compare curve shapes and catch gross errors. **Agreement ≠ correctness**
— these are sanity checks, not ground truth.

- **scimpy** (Python) — sealed + vented SPL and group delay, alignment optimisation
  (B2 / QB4 / B4 / C4). Closest peer to OpenISD.
  <https://github.com/maqifrnswa/scimpy>
- **jmpolom/Vented** (Python) — vented-box frequency response from the Thiele &
  Small papers. <https://github.com/jmpolom/Vented>
- **be1/qspeakers** (C++/Qt) — enclosure designer with volume optimisation.
  <https://github.com/be1/qspeakers>
- **srjh/speaker-driver-parameters** (Python) — T/S extraction from a measurement.
  <https://github.com/srjh/speaker-driver-parameters>

---

## 3. Test oracles — tiered by trustworthiness

A wrong baseline institutionalises a bug, so rank fixtures by provenance:

**Tier 1 — closed forms (exact, self-evident).** Already in use:
- Sealed: `fc = Fs·√(1+Vas/Vb)`, `Qtc = Qts·√(1+Vas/Vb)`; |G|² closed form.
- Passband asymptotes to reference sensitivity.

**Tier 2 — manufacturer datasheets (trustworthy).**
- **Tang Band W6-1139SIF** datasheet is a ready-made, internally-consistent
  `driver`-module fixture (Fs 35, Qts 0.40, Qes 0.47, Vas 11.78 L, Sd 0.0140 m²,
  Bl 8.47, Xmax 11.5 mm, Re 3.6, Mms 39.91 g, Cms 598.98 µm/N). Add more.

**Tier 3 — alignment tables (verify before enshrining).**
- Vented alignment families (B4, QB3, SBB4, C4, Bessel, Chebyshev): Fb/Fs, Vb/Vas,
  F3/Fs vs Qts.
- **Action: confirm the actual numbers against a *primary* source — Small's JAES
  paper or Dickason's *Loudspeaker Design Cookbook* — not a web snippet.** e.g. the
  commonly-quoted B4 anchor "Qts ≈ 0.4048, Fb/Fs = F3/Fs = 1 at Ql = 7" must be
  verified before it becomes a test assertion.
- Collections to check against (then trace to primary): Leach vented-box PDF (§1);
  DIY Loudspeaker Design alignment tables
  <https://sites.google.com/site/diyloudspeakerdesign/home/box-design/alignments/alignment-tables>.

**Tier 4 — cross-tool agreement (sanity only).** scimpy / Vented outputs (§2).

**Box types without a clean closed form (PR, bandpass):** pin with the *physical
sanity oracles* already established this session, not a single magic number:
- output volume velocity → 0 as ω→0 (no DC reinforcement),
- low-end rolloff ≈ 24 dB/oct (vented/PR) / bandpass shape,
- two impedance peaks straddling Fb (vented), Fp between peaks (PR).
The plan should state explicitly that these modules are **less tightly pinned**
than sealed/vented.

---

## 4. Driver data sources (for the library, not the engine)
- loudspeakerdatabase.com — per-driver export to WinISD `.wdr` (and other tools);
  no public API. Already the de-facto `.wdr` source.
  **Search tip:** Google `site:loudspeakerdatabase.com <model name>` to find a driver's
  page directly, e.g. `site:loudspeakerdatabase.com RS180-8`. The database has no
  programmatic search but Google indexes it well.
- Federated repos via `drivers/sources.json` (e.g. MWisBest/WinISDDrivers).
- **Parts Express product search API** (undocumented internal NetSuite SCA API,
  discovered 2026-06-24 by inspecting browser network requests on a product page):

  ```
  GET https://www.parts-express.com/api/items?q={QUERY}&fieldset=details
  ```

  `q` accepts a part number (`295-305`) or model name (`DS115-8`). Multi-value
  comma-separated queries return 0 results — query one item at a time. No auth
  required from same-origin; treat as unofficial and check for breakage. Verified
  by cross-checking returned values against the rendered product page spec table.

  **T/S and acoustic fields** (all verified against DC160-8 / DS115-8):

  | Field | T/S param | API unit | WDR unit | Conversion |
  |---|---|---|---|---|
  | `custitem_pe_resonant_frequency_fs` | Fs | Hz | Hz | — |
  | `custitem_pe_total_q_qts` | Qts | — | — | — |
  | `custitem_pe_electromagnetic_q_qes` | Qes | — | — | — |
  | `custitem_pe_mechanical_q_qms` | Qms | — | — | — |
  | `custitem_pe_dc_resistance_re` | Re | Ω | Ω | — |
  | `custitem_pe_voice_coil_inductance_le` | Le | mH | H | ÷ 1000 |
  | `custitem_pe_bl_product_bl` | BL | T·m | T·m | — |
  | `custitem_pe_diaphragm_mass_airload` | Mms | g | kg | ÷ 1000 |
  | `custitem_pe_mech_comp_suspension` | Cms | mm/N | m/N | ÷ 1000 |
  | `custitem_pe_surface_area_of_cone_sd` | Sd | cm² | m² | ÷ 10 000 |
  | `custitem_pe_compliance_equiv_volume` | Vas | ft³ | m³ | × 0.0283168 |
  | `custitem_pe_max_linear_excursion` | Xmax | mm | m | ÷ 1000 |
  | `custitem_pe_impedance` | Znom | Ω | Ω | — |
  | `custitem_pe_power_handling_rms` | Pe (RMS) | W | W | — |
  | `custitem_pe_power_handling_max` | Pe (peak) | W | — | — |
  | `custitem_pe_sensitivity` | SPL sensitivity | dB 2.83 V/1 m | — | not in WDR |

  **Physical / mechanical fields**:

  | Field | Meaning | Unit |
  |---|---|---|
  | `custitem_pe_baffle_cutout_diameter` | Baffle cutout diameter | inches (string) |
  | `custitem_pe_bolt_circle_diameter` | Bolt circle diameter | inches |
  | `custitem_pe_overall_outside_diameter` | Overall outside diameter | inches (string) |
  | `custitem_pe_depth` | Mounting depth | inches |
  | `custitem_pe_nominal_diameter` | Nominal driver size (e.g. `"6-1/2"`) | inches (string) |
  | `custitem_pe_voice_coil_diameter` | Voice coil diameter | inches |
  | `custitem_pe_no_mounting_holes` | Number of mounting holes | integer |
  | `custitem_pe_cone_material` | Cone material (e.g. `"Treated Paper"`) | string |
  | `custitem_pe_surround_material` | Surround material (e.g. `"Rubber"`) | string |
  | `custitem_pe_basket_frame_material` | Basket / frame material | string |
  | `custitem_pe_magnet_material` | Magnet material (e.g. `"Ferrite"`) | string |
  | `custitem_pe_voice_coil_former` | Voice coil former material | string |
  | `custitem_pe_voice_coil_wire_material` | Voice coil wire material | string |
  | `custitem_pe_frequency_response` | Frequency response range | string e.g. `"30 to 4,000"` (Hz) |

  **Box-tuning hints** (PE's own recommended enclosures — not T/S derived):

  | Field | Meaning | Unit |
  |---|---|---|
  | `custitem_pe_sealed_f3` | Suggested sealed box −3 dB point | Hz |
  | `custitem_pe_sealed_volume` | Suggested sealed box volume | ft³ |
  | `custitem_pe_vented_f3` | Suggested vented box −3 dB point | Hz |
  | `custitem_pe_vented_volume` | Suggested vented box volume | ft³ |

  **Product identification fields**:

  | Field | Meaning |
  |---|---|
  | `internalid` | NetSuite internal item ID (integer) |
  | `itemid` | Part number e.g. `"295-305"` |
  | `custitem_pe_brand` | Brand name |
  | `storedisplayname2` | Full product display name |
  | `urlcomponent` | URL slug e.g. `"Dayton-Audio-DC160-8-6-1-2-Classic-Woofer-295-305"` |
  | `custitem_pe_webabccode` | Stock priority tier (`A`/`B`/`C`) |
  | `custitem_pe_reviewcount` | Number of customer reviews |
  | `custitem_pe_reviewrating` | Average star rating |
  | `custitem_msrp` | MSRP price |
  | `custitem_pe_prop65` | California Prop 65 warning required (bool) |
  | `custitem_pe_bullethighlight1`–`7` | Marketing bullet points |

  **`custitem_itemcategoryfacet` — category discriminator**

  This field identifies the product type and can be used to filter API results:

  | Value | Driver type | Include in library? |
  |---|---|---|
  | `"Woofers"` | Woofers | ✓ |
  | `"Subwoofer Drivers"` | Subwoofer drivers | ✓ |
  | `"Tweeters"` | Tweeters | ✓ |
  | `"Passive Radiators"` | Passive radiators | ✓ |
  | `"Midrange / Midbass Drivers & Full-Range Speakers"` | Midrange, midbass, full-range | ✓ |
  | `"Planar / Ribbon Transducers"` | Planar / ribbon tweeters | ✓ |
  | `"Car Audio Tweeters"` | Car audio tweeters | ✓ |
  | `"Car Audio Midbass Speakers"` | Car audio midbass | ✓ |
  | `"Car Subwoofer Speakers"` | Car audio subwoofers | ✓ |
  | `"Pro Woofers, Subwoofers & Midrange Speakers"` | Pro audio woofers / subs | ✓ |
  | `"Horn Loaded Tweeters & Midranges"` | Horn-loaded drivers | ✓ |
  | `"Horn Drivers"` | Compression drivers | ✓ |
  | `"Pro Coaxial Full-Range Speakers"` | Pro coaxials | ✓ |
  | `"Guitar Speakers & Bass Guitar Speakers"` | Guitar / instrument speakers | ✗ |
  | `"Exciters & Tactile Transducers"` | Exciters — no standard T/S | ✗ |
  | `"Speaker & Subwoofer Kits"` | Complete kits | ✗ |
  | `"Replacement Diaphragms & Baskets"` | Parts, not complete drivers | ✗ |
  | `"Refurbished, Restocked & Open Box Products"` | Duplicates of existing SKUs | ✗ |
  | `"Horns & Waveguides"` | Physical horns (no T/S) | ✗ |

  Useful when a model-name query returns mixed results (e.g. `q=E180HE` returns a
  PR, a woofer, and a kit — use `custitem_itemcategoryfacet` to select the right one).

  **Passive radiator fields**

  PRs have no voice coil, so electrical parameters (Re, Qes, BL, Le) are absent.
  Only mechanical/acoustical parameters are present. Data completeness varies — some
  PRs have full mechanical T/S, others have only nominal diameter.

  Example with full data: DSA270-PR (295-552). Example with minimal data: E180HE-PR
  (295-1140, only `custitem_pe_nominal_diameter`).

  | Field | T/S param | API unit | WDR unit | Notes |
  |---|---|---|---|---|
  | `custitem_pe_resonant_frequency_fs` | Fs | Hz | Hz | free-air resonance of PR suspension |
  | `custitem_pe_mechanical_q_qms` | Qms | — | — | suspension losses only (no Qes/Qts) |
  | `custitem_pe_diaphragm_mass_airload` | Mms | g | kg | ÷ 1000 |
  | `custitem_pe_mech_comp_suspension` | Cms | mm/N | m/N | ÷ 1000 |
  | `custitem_pe_surface_area_of_cone_sd` | Sd | cm² | m² | ÷ 10 000 |
  | `custitem_pe_compliance_equiv_volume` | Vas | ft³ | m³ | × 0.0283168 |
  | `custitem_pe_max_linear_excursion` | Xmax | mm | m | ÷ 1000 |

  Example response (DSA270-PR, SKU 295-552):

  ```json
  {
    "itemid": "295-552",
    "custitem_itemcategoryfacet": "Passive Radiators",
    "storedisplayname2": "Dayton Audio DSA270-PR 10\" Designer Series Aluminum Cone Passive Radiator",
    "custitem_pe_resonant_frequency_fs": 21.9,
    "custitem_pe_mechanical_q_qms": 5.26,
    "custitem_pe_diaphragm_mass_airload": 88.4,
    "custitem_pe_mech_comp_suspension": 0.6,
    "custitem_pe_surface_area_of_cone_sd": 353,
    "custitem_pe_compliance_equiv_volume": 3.74,
    "custitem_pe_max_linear_excursion": 11,
    "custitem_pe_baffle_cutout_diameter": "10.23",
    "custitem_pe_surround_material": "Rubber",
    "custitem_pe_nominal_diameter": 10
  }
  ```

  **Tweeter-specific fields** (present on tweeters, absent on woofers):

  | Field | Meaning | Unit |
  |---|---|---|
  | `custitem_pe_tweeter_type` | Tweeter topology e.g. `"Soft Dome"`, `"Ring Dome"` | string |
  | `custitem_pe_cone_dome_diameter` | Dome/cone diameter | inches |
  | `custitem_pe_cutout_diameter` | Panel cutout diameter (used on tweeters; woofers use `custitem_pe_baffle_cutout_diameter` instead) | inches (string) |

  **Fields absent on tweeters** (present on woofers): `custitem_pe_bl_product_bl`,
  `custitem_pe_diaphragm_mass_airload`, `custitem_pe_mech_comp_suspension`,
  `custitem_pe_surface_area_of_cone_sd`, `custitem_pe_compliance_equiv_volume`,
  `custitem_pe_max_linear_excursion`, `custitem_pe_baffle_cutout_diameter`,
  `custitem_pe_surround_material`, `custitem_pe_magnet_material`,
  `custitem_pe_sealed_f3`, `custitem_pe_sealed_volume`,
  `custitem_pe_vented_f3`, `custitem_pe_vented_volume`.

  Tweeters do return `Fs` (free-air dome resonance, typically 600–1500 Hz),
  `Qts`, `Qes`, `Qms`, `Re`, `Le`, `Znom`, `Pe`, and `sensitivity`.

  **Example — tweeter: DC28F-8 (part number 275-070)**

  Query: `GET /api/items?q=DC28F&fieldset=details` — returns 4 results (DC28F, DC28FS,
  DC28F-8RD diaphragm, DC28FT); use `itemid` to select the exact variant.

  ```json
  {
    "itemid": "275-070",
    "storedisplayname2": "Dayton Audio DC28F-8 1-1/8\" Silk Dome Tweeter",
    "custitem_pe_resonant_frequency_fs": 834,
    "custitem_pe_total_q_qts": 0.5,
    "custitem_pe_electromagnetic_q_qes": 1.33,
    "custitem_pe_mechanical_q_qms": 0.81,
    "custitem_pe_dc_resistance_re": 5.4,
    "custitem_pe_voice_coil_inductance_le": 0.09,
    "custitem_pe_impedance": 8,
    "custitem_pe_power_handling_rms": 50,
    "custitem_pe_sensitivity": 89,
    "custitem_pe_tweeter_type": "Soft Dome",
    "custitem_pe_cone_dome_diameter": 1.125,
    "custitem_pe_cutout_diameter": "2.91",
    "custitem_pe_frequency_response": "1,300 to 20,000"
  }
  ```

  **Fields that are always blank for loudspeakers** (shared schema fields used by
  other product categories):
  `custitem_pe_cable_rating`, `custitem_pe_capacity`, `custitem_pe_contact_rating_voltage`,
  `custitem_pe_hard_drive_capacity`, `custitem_pe_input_rating`,
  `custitem_pe_luminous_intensity`, `custitem_pe_preamp_outputs`,
  `custitem_pe_resolution`, `custitem_pe_terminal_stud_size`, `custitem_pe_throughput`,
  `custitem_pe_tube_code`, `custitem_pe_value`, `custitem_pe_cabinet_dimensions`.

  **Pagination**: API returns 50 items per page. Use `&offset=N` to page through results.
  The `links[].href` field in each response contains a pre-built `next` URL.
  Total result count is in `d.total`.

  **Refreshing the driver library — `scripts/refresh-pe-catalog.mjs`**

  This script sweeps all known brands against the PE API and writes/updates WDR
  files in `drivers/parts-express/`. Run with Node.js 18+ (no npm install needed):

  ```
  # Add new files only (skip existing):
  node scripts/refresh-pe-catalog.mjs

  # Re-fetch and overwrite all existing files (e.g. after a T/S correction):
  node scripts/refresh-pe-catalog.mjs --force

  # Preview what would change without writing anything:
  node scripts/refresh-pe-catalog.mjs --dry-run
  ```

  The script queries every brand in the `BRANDS` array (30 brands as of 2026-06-24),
  paginates through all results, filters to driver-only categories (woofers, subwoofers,
  tweeters, midrange/full-range, passive radiators, planar/ribbon, car audio, pro audio,
  horn drivers, guitar speakers), requires `Fs` to be present, applies all SI unit
  conversions, derives Rms/Dd/Vd, and applies a Cms sanity check (rejects ≥ 100 mm/N).

  **Expected runtime**: ~3–5 minutes for a full sweep (30 brands × avg 100 items × 100 ms delay).

  **To add a new brand**: append it to the `BRANDS` array in `scripts/refresh-pe-catalog.mjs`
  and re-run. The brand string must match the PE API `custitem_pe_brand` field exactly
  (case-sensitive). Verify by running:
  ```
  node -e "fetch('https://www.parts-express.com/api/items?q=BrandName&fieldset=details',
    {headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}})
    .then(r=>r.json()).then(d=>console.log(d.total, [...new Set(d.items.map(i=>i.custitem_pe_brand))]))"
  ```

  **Note on the old script** (`scripts/fetch-pe-specs.mjs`): This was the original
  HTML product-page scraper written before the JSON API was discovered. It visits
  individual product page URLs stored in WDR Comment fields. It still works for
  any WDR file with a PE product URL but is ~10× slower than the API approach.
  Use `refresh-pe-catalog.mjs` for bulk operations.
