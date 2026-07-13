# WinISD .wpr project file — inferred schema

Source corpus: 50 real `.wpr` files from `C:\Users\johnl\OneDrive\Documents\WinISD\projects`
(WinISD Pro, produced by the user's own WinISD sessions, `ModifyDate` values 2025-12-03 to
2026-07-05). Cross-checked against the official help files in `research/winisd/help/` (WinISD
Pro 0.7.0.950, already indexed in `WINISD.md` §15) and against `WINISD.md`'s existing `.wdr`
(driver-only) schema notes, which this file's `[Driver]` section matches field-for-field.

Three of the 50 files — `4th order band pass.wpr`, `6th order bandpass.wpr`, `ABC.wpr` — were
added on 2026-07-05 specifically to exercise the bandpass box types that the original 47-file
corpus never touched (all `BType ∈ {0, 1, 4}`). They resolve several previously-open questions
below; see §4.

**Confirmed against the WinISD Pro executable's own help, not just the `research/winisd/help/`
copy.** The installed app at `C:\Program Files (x86)\Linearteam\WinISD Pro\winisd.chm` was
decompiled (`7z x winisd.chm`) and diffed against `research/winisd/help/` — identical 21-file
set, same content, no additional or newer pages. So "not in the help files" below means
genuinely undocumented by WinISD itself, not just missing from this repo's copy.

Excluded from the corpus (confirmed junk, per the file owner): a scratch file the owner was
live-editing during this research (seen as `00_demo.wpr`, then `01_demo.wpr` after the owner
re-saved it from WinISD — the file kept changing name/content mid-session) and its throwaway
backup/typo siblings (`.wpr~`, `.wwpr`, `.un~`), which have been deleted from the source
directory as instructed. None of those are used as evidence anywhere below.

This distinguishes **confirmed** (directly observed in the file corpus or stated verbatim in
the help files), **inferred** (deduced from corpus patterns with supporting evidence), and
**⚠ unconfirmed / assumption** (plausible but not directly verified — no sample in this corpus
exercises the value, or no help-file text describes it).

## 1. Container format

**Confirmed:** Windows INI format — `[Section]` headers, `Key=Value` lines, **CRLF** line
endings, no quoting. `file(1)` identifies it as "Generic INItialization configuration".

Every file in the corpus has **exactly one** `[Driver]` section — a `.wpr` project models one
driver (or an isobaric pair of the same driver, see `Box.Nd`/`Box.Isobarik`) in one enclosure,
not a multi-way system. A file named "3 Way Epique.wpr" still has one `[Driver]` block; multi-way
crossover design is out of scope for the `.wpr` format itself (⚠ not otherwise verified —
inferred solely from the corpus containing no counter-example).

**Section order observed (always present, in this order), regardless of `Box.BType`:**

```
[ProjectInfo]
[Driver]
[Box]
[VentFront]
[VentRear]
[VentIntra]
[PlotSettings]
[SignalSource]
[Filters]
[PassiveRadiator]
[SimulatorOptions]
```

`[VentFront]`/`[VentRear]`/`[VentIntra]`/`[PassiveRadiator]` are written with placeholder/default
values even when the box type doesn't use them (e.g. a closed-box file still carries all three
vent sections, fully populated with the WinISD default port dimensions) — confirmed by diffing
`closed1.wpr` (`BType=0`) against `tb w5 ported.wpr` (`BType=1`).

## 2. `[ProjectInfo]`

| Field         | Confirmed meaning                                            |
| ------------- | ------------------------------------------------------------ |
| `Description` | Free-text project note (user-entered)                        |
| `Creator`     | Username string (matches Windows account name, e.g. `johnl`) |
| `CreateDate`  | `YYYYMMDD`, project creation date                            |
| `ModifyDate`  | `YYYYMMDD`, last save date                                   |

## 3. `[Driver]`

**Confirmed:** identical field set and meaning to the `.wdr` driver-file schema already
documented in `WINISD.md` §10/§13 (`Brand`, `Model`, `Manufacturer`, `ProvidedBy`, `Comment`,
`DateAdded`, `DateModified`, then the full T/S parameter block ending in `ParState`). A `.wpr`
project embeds a full driver record inline rather than referencing a `.wdr` file by path.

`ParState` is a 49-character `E`/`C`/`N` string (confirmed length via corpus sample) — see
`WINISD.md` §10/§12 for the full decode methodology; not re-derived here.

No new `[Driver]` fields were found beyond what `WINISD.md` already documents.

## 4. `[Box]` — the enclosure model

```
BType=<int>
Vf=<m³>       Ff=<Hz>       Qlf=<->  Qaf=<->  Qpf=<->    ; "front" chamber
Vr=<m³>       Fr=<Hz>       Qlr=<->  Qar=<->  Qpr=<->    ; "rear" chamber
Vc=<m³>       Fc=<Hz>       Qlc=<->  Qac=<->  Qpc=<->    ; a third ("center"?) chamber
Qiclfr=<->    Qiclfc=<->    Qiclcr=<->                    ; inter-chamber coupling losses
T=<K>         p=<Pa>        phi=<->  d=<m>                ; ambient / port-position params
Med=<int>     Nd=<int>      Angle=<deg>   Isobarik=<0|1>  ; driver placement
alfaVC=<1/K>  dTVC=<K>
Sdfport=<m²>  Sdrport=<m²>
Npr=<int>                                                  ; present only when BType=4
```

### `BType` — box type enum

**Confirmed from the corpus** (grep across all 50 files, cross-tabulated against filename intent
and, for the PR case, presence of a populated `[PassiveRadiator]` section):

| `BType` | Meaning                                                | Count | Evidence                                                                                                                                                                                                |
| :-----: | ------------------------------------------------------ | :---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   `0`   | Closed / sealed box                                    |  12   | Files named `*closed*`; no vent/PR activity (`Sdfport=Sdrport=0`, `[PassiveRadiator]` empty)                                                                                                            |
|   `1`   | Vented (bass-reflex) box                               |   9   | Files named `*ported*`/`*vented*`; `Sdrport` non-zero (port area), `[PassiveRadiator]` empty                                                                                                            |
|   `2`   | 4th-order bandpass                                     |   1   | `4th order band pass.wpr`; matches `technical/bp4.html`'s title ("4th order bandpass") in both `research/winisd/help/` and the decompiled `winisd.chm`. See below for topology.                         |
|   `3`   | 6th-order bandpass, type A                             |   1   | `6th order bandpass.wpr`; matches `technical/bp6a.html`'s title ("6th Order Bandpass type A"). See below for topology.                                                                                  |
|   `4`   | Passive radiator                                       |  26   | Files named `*passive*`/`*pr*`/`*PR*`; **only these files carry a `Box.Npr` field and a non-empty `[PassiveRadiator]` block** (`Vas`, `Qms`, `Fs`, `Sd`, `Xmax`, `Me`), always with `Sdfport=Sdrport=0` |
|   `5`   | Undocumented — not named anywhere in WinISD's own help |   1   | `ABC.wpr` (the user's own filename — they didn't know what box type they'd picked either). See below.                                                                                                   |

One file, `Tang w6 passive.wpr`, is misleadingly named — its actual `BType=0` (closed) with no
`[PassiveRadiator]` data. This is a user filenaming inconsistency, not a schema exception —
confirmed by reading its `[Box]`/`[PassiveRadiator]` sections directly.

**Confirmed: vented and passive-radiator are mutually exclusive per file — no file mixes both.**
Checked every one of the original 47 non-bandpass files for `Box.Sdfport`/`Box.Sdrport` (port
area) together with `[PassiveRadiator]` contents: every `BType=4` file has `Sdfport=0` and
`Sdrport=0` (no real port, despite `[VentFront]`/`[VentRear]`/`[VentIntra]` always being present
as boilerplate — see §5), and every `BType=1` file has an empty `[PassiveRadiator]` section. A
`.wpr` project is strictly one of closed / vented / PR / 4th-order bandpass / 6th-order bandpass
(type A or the undocumented `BType=5`) — never a hybrid; the three bandpass samples confirm this
holds for the bandpass types too (all have empty `[PassiveRadiator]`).

### Bandpass topology — confirmed from the three 2026-07-05 samples

`research/winisd/help/aboutequivalentcircuits.html` (and the decompiled `winisd.chm`, identical
content) states WinISD's supported enclosure types, in this order: _"Closed box, Vented box,
Passive radiator, 4th order bandpass, 6th order bandpass type A"_. That prose order does **not**
match the corpus-confirmed numbering (PR is listed 3rd in prose but is `BType=4` in real files),
so the doc order alone could never have been used to infer 2 vs 3 — this had to wait for real
bandpass samples, which now exist.

**`4th order band pass.wpr` (`BType=2`):** `Sdfport=0.00817128249198705` (front port open),
`Sdrport=0` (rear sealed). `[VentFront]` is fully populated (`Fb=81.8`, `Vb=0.00183`,
`carea=0.00817`, `len=1.92`); `[VentRear]` and `[VentIntra]` are boilerplate-zero. Matches
the classic 4th-order bandpass topology: driver sealed in the rear chamber, front chamber
vented to the outside — consistent with `boxdesign.html`'s "rear chamber is that which is
normally in rear of the driver."

**`6th order bandpass.wpr` (`BType=3`):** **both** `Sdfport` and `Sdrport` are
`0.00817128249198705` (equal, both ports open), and **both** `[VentFront]` and `[VentRear]`
carry real non-zero `Fb`/`Vb`/`carea`/`len` values (front: `Fb=25`, rear: `Fb=35` — two
different tuning frequencies, one per chamber). `[VentIntra]` stays boilerplate-zero. Matches
"type A" 6th-order bandpass: driver's rear chamber and the front chamber are each vented
directly to the outside world, no internal duct between them.

**`ABC.wpr` (`BType=5`) — undocumented:** topologically closest to the 6th-order file (same
`Sdfport`/`Sdrport` values, `0.00817128249198705` on both), but this is the **first file in
the whole 50-file corpus where `[VentIntra]` is not boilerplate**: `Fb=14.004`, `Vb=1`,
`carea=0.00817128249198705`, `len=0.05` — a real internal duct, in addition to both external
ports. Also distinct from the `BType=3` file: `Nd=2` (two drivers) vs `Nd=1`.

> ⚠ **Assumption — NOT directly verified.** `BType=5` does not appear in `aboutequivalentcircuits.html`,
> `boxtypes.html`, any `technical/*.html` page, or anywhere else in the official help — checked
> both this repo's copy and the decompiled `winisd.chm` from the installed app, which are
> identical. Given bandpass literature commonly distinguishes a "type B" 6th-order alignment
> (chambers coupled by an internal duct rather than both vented straight outside) from "type A"
> (both vented outside, confirmed as `BType=3` above), `BType=5` plausibly _is_ "6th order
> bandpass type B" — the internal-duct-plus-two-external-ports topology fits that name — but
> WinISD's own docs never use that term anywhere, and the `Nd=2`/`Isobarik=1` combination in
> this one sample is not enough to separate "this is what type B always looks like" from "this
> sample happens to also use an isobaric driver pair." Needs a second `BType=5` sample with
> `Nd=1` to isolate the two variables.
>
> Also note: `Isobarik=1` appears on **both** `6th order bandpass.wpr` (`Nd=1`) and `ABC.wpr`
> (`Nd=2`) — i.e. the flag is set even with a single driver, which contradicts the naive
> assumption that `Isobarik` implies a driver pair. Recorded as observed, not rationalized.

### Chamber triplet (f / r / c)

**Confirmed:** every file has three parallel parameter groups suffixed `f`, `r`, `c` — volume
(`V_`), tuning frequency (`F_`), and the three loss factors `Ql_`/`Qa_`/`Qp_` (same leakage /
absorption / port loss model documented for the single-chamber case in `WINISD.md` §5).

- **`r` ("rear") is the primary/only populated chamber for closed, vented, and PR designs** —
  in every non-bandpass sample, `Vf`/`Ff`/`Qlf`/`Qaf`/`Qpf` and `Vc`/`Fc`/`Qlc`/`Qac`/`Qpc` are
  all `0`, while `Vr`/`Fr` hold the actual box volume and tuning frequency.
- **Confirmed from the 2026-07-05 bandpass samples: both `f` and `r` populate for all three
  bandpass `BType`s (2, 3, 5)** — `4th order band pass.wpr` has `Vf=0.00183`/`Ff=81.8` (front,
  vented) and `Vr=0.0024`/`Fr=81.8` (rear, sealed — driver's own chamber, per the topology in
  §4 above); `6th order bandpass.wpr` and `ABC.wpr` both have distinct non-zero `Ff`/`Fr`
  (`25`/`35` — two different chamber tunings). Confirms `boxdesign.html`'s prose that bandpass
  boxes have two chambers, front and rear, and that "rear chamber is that which is normally in
  rear of the driver."
- **`c` ("center"?) triplet remains unused across every `BType` sampled so far — 0, 1, 2, 3, 4,
  and 5 — always `Vc=Fc=Qlc=Qac=Qpc=0`, including in all three bandpass samples.** Its purpose
  is still not named in any help file (this repo's copy or the decompiled `winisd.chm`). Ruled
  out: it is not simply "the bandpass second chamber" (front/rear already cover that for both
  `BType=2` and `BType=3`/`5`). ⚠ Still unconfirmed — may be for a box type never sampled, or
  unused entirely.
- `Qiclfr`, `Qiclfc`, `Qiclcr` — inferred to be **inter-chamber coupling losses** ("IC" = inter-
  chamber) between the front/rear, front/center, and center/rear chamber pairs respectively,
  by naming symmetry with the `Ql`/`Qa`/`Qp` loss triplet. **⚠ Still unconfirmed** — stayed at
  the same `Qiclfr=100`/`Qiclfc=0`/`Qiclcr=0` default in all three new bandpass samples,
  _including_ `ABC.wpr` where `[VentIntra]` is genuinely active — i.e. these fields did not
  change even when a real inter-chamber duct was in use, weakening (not confirming) the
  "coupling loss for the intra duct" theory. No help-file text names them.

### Ambient / placement fields

**Confirmed:**

- `T` (Kelvin, `293.15` = 20 °C) and `p` (Pascal, `101325` = 1 atm) — standard-condition
  air constants, paired with `Driver.c`/`Driver.roo` (speed of sound / air density), matching
  the environment-defaults mechanism described in `research/winisd/help/options.html`
  ("General Tab … Environment default values … used every time new project is created").
- `Nd` — number of drivers, and `Isobarik` — standard vs. isobaric-pair placement flag.
  Confirmed by `research/winisd/help/boxdesign.html`: _"you can choose how many drivers that
  you want to use in the same box, as well as whether they are to be in a 'Standard' or
  'Isobarik Pair' configuration."_ Always `Nd=1`, `Isobarik=0` in this single-driver corpus.

**⚠ Unconfirmed (no help-file text, always default value in corpus):**

- `Med` — always `0`. Presumed a medium/gas-type selector (0 = air) but not named anywhere.
- `Angle` — always `0`. Presumed a multi-driver mounting/array angle, relevant only when `Nd>1`.
- `d` — always `1`. Purpose not identified.
- `phi` — always `0.3`. Purpose not identified (possibly a port/box shape ratio).
- `alfaVC` / `dTVC` (Box-level, distinct from `Driver.alfaVC`) — thermal fields, always `0.0039`
  / `0`, mirroring the driver's own thermal coefficient; presumed to represent a box-air thermal
  correction but not documented.

### Port area fields

**Confirmed:** `Sdfport` / `Sdrport` (front/rear port cross-sectional area, m²) are `0` for
closed and PR boxes, and non-zero (matching `π·dia²/4` from the corresponding `[VentFront]`/
`[VentRear]` section) for vented boxes — e.g. `tb w5 ported.wpr`: `Sdrport=0.00196349540849362`
= `π×(0.05)²` for a 100 mm-diameter port (`VentRear.dia1=dia2` not present in that file's vent
block by that value, but the arithmetic matches a 50 mm port radius).

### `Npr` (passive-radiator count)

**Confirmed:** appears **only** when `BType=4`, as the last key in `[Box]`. Corresponds to
`numPR` in `WINISD.md`'s existing PR documentation (§3) — "WinISD accepts `numPR` as an input."
Observed values: `1` and `2` in this corpus.

## 5. `[VentFront]`, `[VentRear]`, `[VentIntra]`

Identical field set in all three sections:

```
Num=<int>            ; number of ports of this shape (always 1 in corpus)
Shape=<int>          ; port cross-section shape selector
Fb=<Hz>              ; always 0 in corpus (superseded by Box.Fr?)
Vb=<m³>              ; always 0 in corpus
dia1=<m>  dia2=<m>   ; port diameter(s) — equal in every sample (round port)
carea=<m²>           ; always 0 in corpus
len=<m>              ; always 0 in corpus
endcorrection=<->    ; always 0.732 in corpus
crosscalc=<0|1>      ; always 1 in corpus
```

**Confirmed:** `endcorrection=0.732` matches the flanged-port end-correction constant already
documented in `WINISD.md` §15's index of `research/winisd/help/portterminology.html`
("one-flanged+one-free=0.731" — the file's constant rounds to 0.732 vs. the help text's 0.731;
the small discrepancy is unexplained but both describe the same physical correction).

- `Shape=1` in every sample — presumed **round/circular port** (the only shape ever chosen in
  this corpus); ⚠ other `Shape` values (e.g. slot/rectangular ports) are not confirmed.
- **`VentFront`/`VentRear`** — confirmed by `boxdesign.html` prose ("front and rear" chambers,
  §4 above) and by `graphs.html`'s "Air velocity - front/rear port" / "Gain - front/rear port"
  graph descriptions, which name exactly these two port locations.
- **`VentIntra`** — **confirmed real and functional, not boilerplate**, by `ABC.wpr`
  (`BType=5`): `Fb=14.004`, `Vb=1`, `carea=0.00817128249198705`, `len=0.05` — the only
  non-default `VentIntra` values anywhere in the 50-file corpus. The word "intra" still does
  not appear anywhere in the 21 official WinISD help files (checked both this repo's copy and
  the decompiled `winisd.chm`), so its exact acoustic role (an internal duct connecting the two
  bandpass chambers, per the `boxdesign.html` front/rear structure) remains a plausible but
  ⚠ unconfirmed reading of the field name and its one populated sample. It stays boilerplate-zero
  in `4th order band pass.wpr` (`BType=2`) and `6th order bandpass.wpr` (`BType=3`) — only the
  undocumented `BType=5` sample exercises it.

For `BType ∈ {0, 1, 4}` (closed/vented/PR), none of the three vent sections need more than one
port location (`VentRear` for vented boxes), so `VentFront`/`VentIntra` stay corpus-wide
boilerplate there: `dia1=dia2=0.102`, `endcorrection=0.732`, `crosscalc=1`, everything else
zero. For bandpass types (`BType ∈ {2, 3, 5}`), `VentFront` (and, for `3`/`5`, `VentRear`) carry
real tuning data instead — see §4.

## 6. `[PlotSettings]`

```
Color=<int>   ; Win32 COLORREF: R + G×256 + B×65536 (e.g. 16711680 = 0x00FF0000 → pure blue)
Width=<int>   ; always 1 in corpus — plot line width
```

**Confirmed:** decimal values decode cleanly as standard Win32 `COLORREF` packing (verified
arithmetically against several sample values, e.g. `65280 = 0x00FF00` = pure green,
`255 = 0x0000FF` = pure red).

## 7. `[SignalSource]`

```
Rg=<Ω>   ; source/series resistance — always 0.1 in corpus
P=<W>    ; drive power in watts
```

**Confirmed:** matches `WINISD.md` §1/§6's documented default `Rs=0.1 Ω` and the
`Eg = sqrt(P × Re)` power convention. `P` values in the corpus are mostly non-round numbers
(e.g. `40.2617647058823`), consistent with a user having dragged/tuned power to hit a specific
target voltage or SPL rather than typing a round wattage.

## 8. `[Filters]`

```
Count=<int>                              ; number of filter slots actually in the chain (0–10 observed)
filter<N>type=<int>                      ; N = 0..9
filter<N>params=<;-delimited numeric list>
```

**Confirmed from `research/winisd/help/filtersimulator.html`:** WinISD's behavioral filter
simulator supports these filter families (order as listed in the help text):

1. Butterworth low/highpass, orders 1–10
2. Linkwitz-Riley low/highpass (4th order only)
3. Second-order section (SOS), user `fc`+`Q`
4. Bessel low/highpass, orders 1–10
5. Allpass (1st/2nd order)
6. Linkwitz transform
7. Parametric EQ (center freq, `Q`, gain)
8. Peaking second-order highpass (user peak-freq + peak-gain — "suits quite well to ported or
   passive radiator type boxes")
9. Static gain

**Corpus-observed `filter<N>type` values:** `0`, `1`, `7`.

- **`filter0type=0` with `params=0;1;2;50;0.707`** is the untouched-default value in **every**
  file that has `Count=10` (all ten slots present but disabled) — `2;50;0.707` reads as
  order=2, fc=50 Hz, Q=0.707 (textbook Butterworth 2nd-order constant), matching this being a
  template/placeholder rather than a user-configured filter.
- **`filter1type=7` in `Epique15 - pr.wpr`**, a passive-radiator project, has
  `params=0;1;100;0.333;6` — reading the last three tokens as freq=100 Hz, Q=0.333, gain=6 dB
  matches the help text's "Peak freq"/"Peak mag" description for filter type 7 almost exactly,
  **and** the help text explicitly calls this filter useful "for ported or passive radiator type
  boxes" — direct corroboration that this file (a PR project) uses it.
- **`filter0type=1`** appears in three ported/passive files with a single active filter
  (`Count=1`) and a tuned subsonic frequency (`30`/`35`/`40` Hz, all just below or near the
  box's own tuning frequency) — consistent with a user-configured subsonic/highpass filter.

> ⚠ **Assumption — NOT directly verified.** The exact integer-to-filter-family mapping (e.g.
> whether `type=1` is "Linkwitz-Riley" per the help text's list position, or a highpass/lowpass
> variant bit rather than a family index) is not confirmed — no WinISD source or config dump was
> consulted, only file-content pattern matching against help-file prose. The `params` field's
> per-token meaning likely depends on `type` (different filter families need different parameter
> counts — Parametric EQ needs 3, peaking-HP needs 2–3, Linkwitz transform needs 4), and only the
> two token layouts actually observed in this corpus (5-token Butterworth/HP-style, 5-token
> peaking-HP-style) are described above with any confidence.

## 9. `[PassiveRadiator]`

```
Vas=<m³>   Qms=<->   Fs=<Hz>   Sd=<m²>   Xmax=<m>   Me=<kg>
```

**Confirmed:** present (non-empty) only when `Box.BType=4`; empty/absent in closed and vented
files. Field set is an exact match for `WINISD.md` §2's already-documented WinISD PR input list —
`Vas, Qms, Fs, Sd, Xmax` plus `Me` (added mass, matching the doc's "added_mass"). This is
independent corroboration (real files vs. prior user-reported UI description) that the
documented PR field list is correct.

## 10. `[SimulatorOptions]`

```
VCInd=<0|1>
FlatResponse=<0|1>
TLPorts=<0|1>
```

**⚠ Unconfirmed — every sample in this corpus has all three at `0`**, so no behavioural
difference could be observed. Presumed meanings, by name and by cross-reference to `WINISD.md`
§9's circuit-model discussion, but **not verified**:

- `VCInd` — plausibly toggles whether voice-coil inductance (`Le`) is included in the acoustic
  simulation path (`WINISD.md` §9 documents WinISD's default circuit excludes `Le` from the
  acoustic side; this flag may be the "Full gyrator"-equivalent switch, if WinISD exposes one).
- `FlatResponse` — plausibly a normalized/flat-reference display mode for the SPL curve.
- `TLPorts` — plausibly enables transmission-line port modeling as an extension beyond the
  standard vented-box duct model.

## 11. Open questions

| #   | Question                                                                                                                                                                                                                                                     | Priority                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | ~~Numeric mapping for `Box.BType` 2 and 3~~ **Resolved 2026-07-05:** `2` = 4th-order bandpass, `3` = 6th-order type A. See §4.                                                                                                                               | Done                                                                                                                   |
| 1b  | What is `Box.BType=5` ("`ABC.wpr`")? Not named in any WinISD help file (repo copy or decompiled `winisd.chm`). Plausibly 6th-order type B, unconfirmed.                                                                                                      | Medium — needs a second `BType=5` sample with `Nd=1` to separate the box-type question from the isobaric-pair question |
| 2   | Purpose of the `c`-suffixed chamber triplet (`Vc`/`Fc`/`Qlc`/`Qac`/`Qpc`) — **narrowed 2026-07-05:** confirmed unused in all of `BType` 0/1/2/3/4/5, so it is not simply "the bandpass second chamber"                                                       | Medium — needs a box type never yet sampled, or WinISD source                                                          |
| 2b  | Purpose of the three `Qicl*` inter-chamber loss fields — **narrowed 2026-07-05:** stayed at default even in `ABC.wpr` where `VentIntra` is genuinely active, weakening the "intra-duct coupling loss" theory                                                 | Medium — same blocker as #2                                                                                            |
| 3   | ~~Confirm `VentIntra`'s role~~ **Resolved 2026-07-05:** confirmed real/functional, not boilerplate — populated with genuine non-zero values in `ABC.wpr` (`BType=5`). Exact acoustic role (internal duct between chambers) still ⚠ unconfirmed by help text. | Partially done                                                                                                         |
| 4   | `filter<N>type` full integer→family mapping and per-family `params` token layout                                                                                                                                                                             | Low — only affects reading/writing filter chains, none of which are exercised by OpenISD today                         |
| 5   | `SimulatorOptions` (`VCInd`/`FlatResponse`/`TLPorts`) actual behaviour                                                                                                                                                                                       | Low — never toggled in this corpus                                                                                     |
| 6   | `Box.Med`, `Angle`, `d`, `phi` exact meaning                                                                                                                                                                                                                 | Low — always default in this corpus                                                                                    |
| 7   | Why is `Isobarik=1` set on both `6th order bandpass.wpr` (`Nd=1`) and `ABC.wpr` (`Nd=2`) — does the flag mean something other than "driver pair" for bandpass boxes?                                                                                         | Low — cosmetic/UI-state field, not consumed by OpenISD                                                                 |

Resolving #1b, #2, #2b needs either more bandpass/`BType=5` `.wpr` samples or the WinISD source.
