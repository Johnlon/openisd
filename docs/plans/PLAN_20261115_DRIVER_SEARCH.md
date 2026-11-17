# PLAN 2026-11-15 — Driver library search: size, text, sort, brand, impedance, enclosure (openisd #516)

Status: slice 1 built (T796, size search from Sd, search only; John approved). Slices 2-5 not started. Checked against `portingle/main` a5a731de (after T790/T791). Owner repo: openisd (`docs/plans/PLAN_20261115_DRIVER_SEARCH.md`
once moved there). Cross-repo part: winisd_tools (nominal size must reach `openisd.json`), indexed from there.
Rules obeyed: openisd `CLAUDE.md`, `.claude/rules/{tdd,ui,typescript,field-layout}.md`; offline rule (everything from the
precached catalogue); scraper-does-no-calcs (the derived size is computed in the app, marked C, never stored).

Scope (John, 2026-11-14, not reopened): text search + sort by any column; brand filter; nominal-impedance filter incl.
multi-coil as stored; enclosure suitability (sealed / vented / either, from EBP); Fs filter already exists; size search
(printed nominal where printed, else a size class from Sd, search only, never shown as the maker's nominal).

## 1. What exists today

### Components and state (the whole library is one component on two skins)
- `packages/ui/src/ui/components/DriverLibrary.vue` (1120 lines) is THE library body for both skins. It takes
  `phone?: boolean` (line 30). Phone: search row + "Filters" button (`dl-searchrow`, 93-99), the folded filters sit
  behind `filtersOpen` (33, 100, 197). Desktop: search box (99) and the same filters always shown.
- Hosts: desktop overlay `ui/components/DriverBrowser.vue` (modal, 770 x 535 px, `DriverBrowser.vue:106-108`);
  phone pane `ui/shells/mobile/MobileManageDriversTab.vue` (+ `hooks/MobileManageDriversTab-hooks.ts`); the New Project
  wizard step 1 (`OriginalNewProject.vue`, `MobileNewProject.vue`) also hosts it.
- Filter controls today (template 100-197): type chips `Chip.ALL` (101-109), `✕ clear`, `?` help; param row: Fs min/max
  (131-138), stated Range from/to + "include unstated" (140-157), Sd min/max cm2 (159-166), Z chips 4/8/16 (168-173);
  scope rotor (All / Bundled / My Drivers) and Favorites (175-195); "Filters on:" pill row (205, desktop) and
  "Clear filters" (202, phone).
- State: `packages/ui/src/logic/driverBrowsingState.ts` — `filterQ` (222), `criteria()` (326), `filteredDrivers` (349),
  `filteredMyDrivers` (364), `activeFilters` (377), `clearAllFilters` (318). The list is sorted by name only
  (`localeCompare`, line 354-356); the stated-range "unstated" rows are moved below the matches (`matchesBeforeNotStated`, 95).
  `DISPLAY_LIMIT = 200` rows shown (100).
- The filter MODEL lives in the UI package, not design: `packages/ui/src/logic/driverDisplay.ts` — `SearchCriteria`
  (20), `SearchSubject` (37), `searchSubjectOfDriver/IndexRow` (56, 62), `statedRangeResult` (139), `matchesCriteria`
  (155), `activeFilterLabels` (211). `packages/design/filter/` holds only the vocabulary: `driverType.ts` (`Chip`,
  `DriverType`, enums per typescript.md) and `index.ts`.
- Text search today: whitespace tokens, each must be a substring of the lowercased display name (brand + model), nothing
  else (`driverDisplay.ts:156-158`). Phone placeholder "Brand or model" (`design/fields/phoneText.ts:441`).
- Z filter: chips 4/8/16, match if `|Znom - z| < 1.5` (`driverDisplay.ts:181`); 90 drivers (Znom 2, 3, 6, 10, 12, 14, 50
  ...) can never be matched by a chip.
- Enclosure suitability exists as logic: `DriverEngine.ebpSuitability(EBP_hz)` at
  `packages/design/engine/driver/DriverEngine.ts:362` (EBP < 50 sealed, > 100 vented, else either; type
  `EbpSuitability` at `engine/types.ts:76`); `OpenISDDriver.ebp()` / `.ebpSuitability()`
  (`design/domain/driver/openISDDriver.ts:217`). Only the driver editor shows it; the library does not.

### Catalogue and index
- `scripts/bundle-drivers.mjs` opens each record as a domain object and writes `drivers-index.json` through
  `bundledDriverIndexRowOf` (`packages/ui/src/logic/bundledIndexRows.ts:18`); `scripts/catalogueBundle.mjs` joins index rows +
  records into one `catalogue.json` precached with the shell; `packages/persistence/src/repos/catalogueBundle.ts` is the typed boundary
  (build-stamp check); `bundledDriverRepo.ts:14-27` parses each row (strict: a missing field is a problem);
  `persistence/src/repos/bundledIndex.ts:36-51` declares `BundledDriverIndexRow`.
- Row fields now: uuid, path, name, dq, datasheet, productPage, listingPage, chips[], canonical, Fs_hz, Sd_m2, Xmax_m,
  Vd_m3, Znom_ohm, freq_low_hz, freq_high_hz. Index file is 904 KB for 1,818 rows.
- Staleness gate: `packages/ui/test/scripts/bundled-index-artifacts.test.ts` recomputes rows for the reference records and holds
  them against the tracked index; `packages/ui/test/logic/bundledIndexRows.test.ts` tests the row function.
- Existing tests to extend: `packages/ui/test/logic/driverFilters.test.ts` (criteria, labels, flow through
  `createDriverBrowsingState`), `ui/test/ui/driver-browser.browser.spec.ts`, `my-drivers-filtering.browser.spec.ts`,
  `mobile-driver-browser.browser.spec.ts`. Surface manifest entry `driver-search-filters` (`mobileSurfaceManifest.ts:48`).
- `packages/design/domain/slimModel.ts:34` drops `nominal_size_cm`. Worse, the source `openisd.json` does not carry it at all:
  it exists only in the scraper's `driver.json` (checked: `dayton-audio/ds270-8/openisd.json` has no such key). So
  printed nominal size needs a winisd_tools change before OpenISD can read it.

### Measured coverage (bundled catalogue, 1,818 driver rows; passive radiators are a separate index of 80)
Counted from `packages/ui/public/drivers-index.json` and `public/drivers/*/*.json`; printed nominal from
`winisd_drivers/snapshot/datasheets/<path>/driver.json` (`nominal_size_cm.value`, joined by row path).

| Field (real name) | Where | Have | Of 1,818 |
|---|---|---|---|
| Nominal size `nominal_size_cm` | scraper `driver.json` only (not in `openisd.json`) | 277 | 15% |
| Sd `Sd_m2` | index row | 1,706 | 94% |
| (nominal AND Sd both) | | 275 | 15% |
| Sd but no printed nominal | the derived-size population | 1,431 | 79% |
| Neither Sd nor nominal | no size possible | 110 | 6% |
| Znom `Znom_ohm` | index row (calc from Re when not printed) | 1,811 | 99.6% |
| Znom within 1.5 ohm of 4 / 8 / 16 | what the Z chips can reach | 1,721 of 1,811 | 95% |
| Fs `Fs_hz` | index row | 1,810 | 99.6% |
| EBP `EBP_hz` (C, Fs/Qes) | record `specs.woofer` | 1,706 | 94% |
| Brand `brand.value` | record | 1,818 | 100%, 19 distinct (Dayton 228, Visaton 203, B&C 177) |
| numVC > 1 (multi coil; stored Znom/Re are the published figures for the measured wiring, T791) | record `numVC` | 43 | 2.4% |
| Outer `Outer_m` | record (frame outer, NOT nominal) | 537 | 30% |
| Basket `Basket_m` / Depth / Thick | record | 792 / 539 / 351 | 44% / 30% / 19% |
| Weight `weight_kg` | record | 1,487 | 82% |
| `OuterX_m` / `OuterY_m` (rectangular frame; shown on the Dimensions tab, T790) | record | 56 in the snapshot | 3% |

Reading: Outer, OuterX and OuterY are too sparse to search on, and mean frame size not cone size; ignore them. The scope decision (printed
nominal else Sd-derived) is right: derived size reaches 1,706 drivers, printed only 277.

Derived size checked against the 275 drivers that have both: with `Dd = 2*sqrt(Sd/pi)` (the app already calculates `Dd_m` this way)
the printed nominal diameter is about Dd / 0.833 (median ratio 0.8333; e.g. 8" nominal gives Dd 16.5 cm, 10" gives 21 cm,
15" gives 33.5 cm). Snapping Dd/0.833 to the nearest standard class (1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6.5, 8, 10, 12, 15, 18, 21 in)
gives the same class as the printed size for 237 of 275 (86%). Every miss is one class off and sits in the small
sizes (2.5-5"), where makers use many half-sizes; 6.5" and up are essentially exact.

## 2. Design

### 2.1 Pure logic goes in packages/design (UI does no maths)
New files under `packages/design/filter/` (exported from `filter/index.ts`), Java-style enums for closed sets per typescript.md:
- `sizeClass.ts` — `SizeClass` enum (members 1.5", 2", ... 21"; `inches`, `label`, `nominalCm`), `SizeClass.ofNominalCm(cm)` and
  `SizeClass.ofSd(Sd_m2)`. The Sd rule: `Dd = 2*sqrt(Sd/pi)`, equivalent nominal = `Dd / 0.833` (constant named and
  sourced in the file, with the 275-pair measurement in the comment), snap to nearest class by ratio (log distance). Pure,
  no I/O. Returns `{class: SizeClass, source: SizeSource.Printed | SizeSource.FromSd}`; `SizeSource` is an enum
  with `label` ("nominal" / "size class from Sd") and `marker` ("C" for FromSd).
- `driverSearch.ts` — MOVE `SearchCriteria`, `SearchSubject`, `matchesCriteria`, `statedRangeResult`, `activeFilterLabels` here from
  `ui/src/logic/driverDisplay.ts` (the filter model belongs in design; leave no forwarding re-export, per the no-forwards
  gate; update importers). Add the new criteria below. Add `DriverSort` (enum of sort keys, `compare(a, b)`) and
  `EnclosureFit` enum (Sealed / Vented / Either, wire strings equal to `EbpSuitability`).
- The UI hook only holds the user's choices (refs) and calls these; no maths in `.vue` or templates.

### 2.2 Index row fields added at bundle time (offline: all from the precached catalogue)
`BundledDriverIndexRow` (persistence `bundledIndex.ts`) + `bundledDriverIndexRowOf` + reader `bundledDriverRepo.ts` gain:
- `brand: string` — record `brand.value`; for the brand filter and text search (name is brand + model today).
- `sizeFromSd_in: number | null` (slice 1, built) — `SizeClass.ofSd(Sd)`, else null; the name says it is derived. Slice 4 adds the printed
  `nominalSize_cm` and a source field. Stored in the INDEX row as a search key only (index 925,753 to 960,153 bytes, +34 KB). The record
  itself never gets a derived size; the driver info/editor shows only the printed nominal (slice 4), never the derived value as a datasheet figure.
- `nominalSize_cm: number | null` — printed value, only once the record carries it (slice 4; null before).
- `EBP_hz: number | null` and `enclosure: 'sealed' | 'vented' | 'either' | null` — from `driver.ebp()` / `driver.ebpSuitability()`
  (calls `DriverEngine.ebpSuitability`; no second threshold list). EBP_hz kept so a later numeric EBP filter needs no re-bundle.
- `Qts`, `Vas_m3` are NOT added now (outside John's scope); sort by any column uses the columns the list already shows
  (Fs, Sd, Znom, Xmax, Vd) plus size and brand.
Cost: about 6 more small fields x 1,818 rows, roughly +100 KB on a 904 KB index (measure in slice 1; the catalogue is
precached once, so this is acceptable but must be reported). The staleness gate and `bundledIndexRows.test.ts` pin the
new fields; regenerate with `npx vite-node scripts/bundle-drivers.mjs` (tracked artefacts).
Same fields for My Drivers: `searchSubjectOfDriver` computes them from the domain object by the SAME design functions, so
bundled and My Drivers rows answer every filter identically (existing rule, `driverFilters.test.ts`).

### 2.3 Size from Sd: computed and labelled
- Computed only in `SizeClass.ofSd` (design), at bundle time into the index row, and at runtime for My Drivers. Never stored in
  any record or `openisd.json`; never written into `nominal_size_cm`.
- Row/summary text: a printed size reads `8"` (E, as printed); a derived one reads `≈ 8 in (from Sd)` with the C
  marker and a tooltip "Worked out from Sd. The maker prints no nominal size." The filter label reads "Size 8"" for either
  source; a small `~` on derived matches in the list. Texts live in one design class (`PhoneDriverListText`-style), both skins read it.
- Matching is by class: a driver matches a size chip if its class equals it. Printed wins over derived. Because the derived
  class is 86% exact (misses are one class off, small sizes), exact class only, no adjacent-class toggle (decided, QO923).

### 2.4 Enclosure suitability
`EnclosureFit` filter: Sealed / Vented / Either chips (multi-select; picking Sealed admits drivers whose suitability is
`sealed` or `either`, and likewise Vented — "can I build this type" — see Q3). Rule source is
`DriverEngine.ebpSuitability` (50 / 100 Hz, `DriverEngine.ts:362`), reached via the index row's `enclosure`. A driver
with no EBP (112 of 1,818) is excluded when the filter is on and listed after the matches ("not stated", the same
treatment as the stated-range filter, reusing the below-the-matches placement).

### 2.5 Text search semantics
Keep the token-AND model; widen what a token matches: brand, model/name, and the size label ("8", "8in", "8\"", "200mm"
parse as a size query and match the size class), plus Znom ("8ohm"). Case-insensitive, diacritics folded, punctuation
folded so `W5-1138` finds `W5 1138` (done in design `normaliseSearchText`, tested). A token matches if it is a substring of
the normalised name OR is a recognised size/impedance token. No fuzzy matching, no ranking surprises: results stay in
sort order. Not matching description/series (not in the index; keeps the row small).

### 2.6 Brand and impedance
- Brand: a multi-select of the 19 brands (+ My Drivers' own brands), built by design from the rows (`brandsOf(rows)`), counts shown.
- Impedance: the 4/8/16 chips stay; add an "Other" chip for the ~90 drivers none of them reach (Znom 2, 3, 6, 10, 12, 14...) and
  keep the existing 1.5 ohm tolerance. The filter reads the stored Znom as is: since T791/T794 it is the published figure for the measured
  wiring (a print of "2 + 2 ohm" is stored as 4 for series), so no per-coil wording.

### 2.7 Sort
`DriverSort` enum: Name (default, today's behaviour), Brand, Size, Fs, Sd, Znom, Xmax, Vd; each with `ascending` toggle; a driver
missing the key sorts last in both directions. The stated-range "unstated" rows still follow the matches (existing rule).
State holds `sortKey` + `sortDescending` in prefs like the other kept filters (follow how `typeStates` is persisted).

## 3. UI on both skins (same system options on both, per ui.md; one set of rows from design)
All logic from `driverBrowsingState.ts` (via the one hook surface DriverLibrary already uses) so the template only binds refs.
- Desktop (770 x 535 modal): add a SIZE chip row under the type chips (one chip per class, scrolls sideways, with an
  "Any" reset); add a second param row: Brand dropdown, Enclosure chips (Sealed / Vented / Either), and a Sort dropdown + direction
  toggle at the right of the statusrow (where the count shows). Z chips gain "Other". The modal is fixed height, so
  the list must keep at least its current height: if the new rows overflow, the filters block scrolls, the list does not.
- Phone (374 px): the search box stays; sort moves next to "Filters" as a compact dropdown; inside the folded Filters panel add
  Size (wrapping chips), Brand (dropdown), Enclosure (3 chips), Z "Other". The Filters button count includes the new filters.
  Row line 2 gains the size label (`≈ 8 in (from Sd)`) after Fs / Sd.
- Field layout (`field-layout.md`, cast in stone): every new dropdown and number box goes through the common field, labels share
  one left edge, values one width and height, nothing clipped, nothing overlapping, 4 px gap before spinners, long values
  never cut. The brand names ("Dayton Audio", "B&C Speakers") and the size label must fit at 374 x 705 and 1280 x 720. The
  gate `field-layout-rules.browser.spec.ts` must stay green with the filter panel OPEN (add the open-panel view to the manifest
  entry `driver-search-filters`); no `test.fails` and no exemptions.
- Screenshots: John needs before/after screenshots of the library on BOTH skins for every UI slice (phone 374 x 705, panel closed
  and open; desktop 1280 x 720, default and with size + brand + enclosure active). Take "before" at the start of slice 1.
  A second model reviews every picture before they go to John (field-layout rule 9).

## 4. Slices (each shippable alone; unit test first, watch it fail, then implement)

### Slice 1 — Search by size (smallest visible win; size from Sd only)
Failing tests first:
1. design unit `packages/design/test/filter/sizeClass.test.ts`: `ofSd(0.0161)` gives 6.5" FromSd (Accuton AS168, a 7" nominal; the one-class-off case) and, from measured pairs,
   the Sd of an 8" gives 8, a 10" gives 10, a 15" gives 15; null/0/negative Sd gives null; `ofNominalCm(25.4)` gives 10 Printed; snapping is by ratio;
   a table test over a fixture of the 275 measured pairs asserts >= 86% exact and none worse than one class off (keeps the constant honest).
2. design unit `driverSearch.test.ts`: `matchesCriteria` with `sizeClasses: ['8']` keeps/loses subjects by `sizeFromSd_in`; empty list is off;
   `activeFilterLabels` says `Size 8", 10"`.
3. ui logic `bundledIndexRows.test.ts`: the row carries `sizeFromSd_in`; staleness gate fails until the index is regenerated.
4. ui logic `driverFilters.test.ts`: `createDriverBrowsingState` with size chip chosen narrows `filteredDrivers`; My Drivers narrow the same way.
5. one browser spec per skin, sparingly: click "8"", the list shrinks, a row shows `≈ 8 in (from Sd)`.
Files: `design/filter/sizeClass.ts`, `design/filter/driverSearch.ts` (the move) + `index.ts`; `persistence/.../bundledIndex.ts`,
`bundledDriverRepo.ts`; `ui/src/logic/bundledIndexRows.ts`, `driverDisplay.ts` (subject builders), `driverBrowsingState.ts`;
`DriverLibrary.vue`; `design/fields/phoneText.ts` (texts); regenerated `public/drivers-index.json`; docs index entry.
done_test: `bash scripts/test.sh packages/design/test/filter/sizeClass.test.ts` and the new size cases in `driverFilters.test.ts` pass; the field-layout gate passes with the
Size row open on both skins; before/after screenshots both skins.

### Slice 2 — Sort by any column + brand filter
Tests first: `DriverSort.compare` per key, direction, nulls last, stable ties by name; `brandsOf` counts; `matchesCriteria` brand include set;
`bundledIndexRows` carries `brand`; `driverFilters` sort changes `filteredDrivers` order and keeps the "unstated" rows last; sort + brand persisted
and cleared by `clearAllFilters` (brand yes, sort no — sort is not a filter). Files: `driverSearch.ts`, index row (+`brand`), `driverBrowsingState.ts`,
`DriverLibrary.vue`, phone/desktop texts. done_test: new unit tests + a browser spec that sorts by Fs on phone and desktop.

### Slice 3 — Impedance (Other chip) and enclosure suitability
Tests first: `EnclosureFit` admits per the rule against `ebpSuitability` (49.9 sealed, 50 either, 100 either, 100.1 vented; null EBP not stated);
index row `EBP_hz` and `enclosure` equal `driver.ebpSuitability()` for reference records; the Z "Other" chip admits Znom 6 / 10 and rejects 4 / 8 / 16;
Files: `driverSearch.ts`, index row/reader, `DriverLibrary.vue`, texts.
done_test: unit + `mobile-driver-browser` and `driver-browser` specs extended; screenshots.

### Slice 4 — Printed nominal size (cross-repo) and the info line
Needs John's ruling (Q1) and a winisd_tools change: the converter writes `nominal_size_cm` (E, as printed) into `openisd.json`. Then
`slimModel.ts:34` stops dropping it (remove from `DROPPED_DEVICE_KEYS`), the schema type gains it, `driver.nominalSize_cm()` is exposed, the index row
`nominalSize_cm` is filled, `SizeClass` uses Printed first. Tests first: slimModel keeps the key (the dropped-keys test inverts); schema round trip;
`bundledIndexRows` prefers printed over Sd; the info line shows `Nominal size 10" (E)` and for a record without it shows nothing (rule: a box the
datasheet never states stays empty) while the list shows the derived `~` label; a gate asserting the derived size is never written into any record file.
Files: `design/domain/slimModel.ts`, `openisdSchema.ts`, driver class, `bundledIndexRows.ts`, `driverDisplay.ts` (`previewSpecsOf`), winisd_tools converter (its own repo and tests).
done_test: the printed-wins unit test + the record-never-holds-derived gate; coverage goes from 0 to 277 printed in the index.

### Slice 5 — Text search widening
Tests first: `normaliseSearchText` (case, accents, punctuation); token `8in`, `8"`, `200mm` parse to a size class and match; `8ohm` matches Znom 8; brand-only
token; mixed `dayton 8` returns Dayton 8" drivers; unknown junk returns none; a token never matches a derived size by accident of substring (`"8"` alone as text still name-matches).
Files: `design/filter/driverSearch.ts` (+ `searchText.ts`), phone placeholder text ("Brand, model or size"). done_test: unit tests + one browser spec typing `dayton 8"`.

Order rationale: 1 gives the headline ask with no cross-repo dependency; 2 and 3 are index-field additions in one regenerate each (batch if John prefers one
index regeneration, since each regenerates the 900 KB tracked index); 4 waits on the ruling and winisd_tools; 5 is last because it reuses 1-3.

## 5. Open questions for John (recommended default if no answer)
- Q1. Restore `nominal_size_cm` into the OpenISD model, as printed (E state), written by winisd_tools into `openisd.json`?
  Default: yes (it is only 277 drivers today; slice 4 waits). The scraper-side coverage work (#516 item 1) is separate.
- Decided by the coordinator for John (QO923): Q2 exact class only, no toggle; Q3 Sealed includes "either"; Q5 sort persists and Clear filters does not reset it; Q4 dropped (impedance uses the stored Znom as is).
