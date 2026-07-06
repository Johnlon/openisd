# Human review queue

Items that require a human to make a judgment call. All are from the `matt/`
collection unless noted. AI cannot resolve these — the decision depends on
whether two model numbers refer to the same physical product or different ones.

**For each item:**
- Look up both model names on the manufacturer's website or a datasheet archive
- If they are **different products**: confirm — the discrepancy checker grouped them
  wrongly and 14a (tighter matcher) will fix it automatically, no data change needed
- If they are the **same product with a naming error**: decide which name is canonical,
  rename the wrong WDR file, and update `Model=` inside it
- If they are the **same product, different production runs** (e.g. V2015): keep both,
  add `corrections:` to each sidecar noting the relationship
- Record your decision in the `Decision` column below

---

## Group A — Probable naming errors (likely same driver)

| Models | Difference | Check | Decision |
|--------|-----------|-------|----------|
| `Eminence CA15-4` vs `Eminence CA154` | Missing hyphen | Is CA154 a real Eminence part number, or a typo for CA15-4? | |
| `Eminence Lab 12C` vs `Eminence Lab12` | Space + C suffix | Are these the same driver? Eminence lists "Lab 12C" on their site | |
| `Tang Band W6-1139SI` vs `Tangband W6-1139SIF` | Brand typo + F suffix | Is SIF a variant of SI, or a different driver? Brand name typo strongly suggests data-entry error | |
| `Eminence Kappa-15LF` vs `Eminence Kappa-15LFA` | A suffix | LFA = aluminum surround variant of LF — different product, but check datasheet to confirm T/S differ | |
| `Eminence Alpha-6A DATS` vs `Eminence Alpha-6C DATS` | A vs C | DATS = measurement tool suffix. Alpha-6A and Alpha-6C are different drivers (different cone) | |
| `Eminence 2512` vs `Eminence 2512-8` | Impedance suffix | Are these the same driver — 2512 and 2512-8? Check if Eminence uses both names for one product | |
| `Eminence 3012LF-4` vs `Eminence 3015LF-4` | Size digit | 3012 (12-inch) vs 3015 (15-inch) — different products, but verify | |
| `Faital Pro 12FH510` vs `Faital Pro 12FH520` | Last digit | 510 vs 520 are different power-handling variants — confirm they are distinct products | |
| `Faital Pro 12HP1010` vs `Faital Pro 12HP1060` | Last two digits | Different power ratings — confirm distinct products | |
| `GRS 8FR-8 #2` vs `GRS 8PF-8 #2` | FR vs PF | Different model families — these are almost certainly different drivers | |

---

## Group B — Different sizes / impedances (almost certainly different products)

Human should **confirm** these are distinct products — no data change expected.
If the fuzzy matcher grouped them, 14a (exact normalised match) will fix automatically.

| Models | Difference |
|--------|-----------|
| `B&C 10FW64` vs `B&C 10NW64` | FW vs NW series |
| `B&C 10HPL64` vs `B&C 12HPL64` | 10" vs 12" |
| `B&C 10PLB76` / `B&C 12PLB76` / `B&C 15PLB76` | 10", 12", 15" |
| `B&C 12CL64` vs `B&C 12CL76` | 64 vs 76 mm voice coil |
| `B&C 12FW76` vs `B&C 15FW76` | 12" vs 15" |
| `B&C 12PS100` vs `B&C 15PS100` | 12" vs 15" |
| `B&C 12TBX100` / `B&C 15TBX100` / `B&C 18TBX100` | 12", 15", 18" |
| `B&C 15PS76` vs `B&C 18PS76` | 15" vs 18" |
| `B&C 21DS115` / `B&C 21DS115-4` / `B&C 21SW115-4` | DS vs SW, impedance |
| `B&C 21SW150` vs `B&C 21SW152` | 150 vs 152 model suffix |
| `B&C 8FG51` vs `B&C 8FW51` | FG vs FW series |
| `BLG RXM8A` vs `BLG RXM8B` | A vs B variant |
| `BMS 12N620` vs `BMS 15N620` | 12" vs 15" |
| `BMS 12S320` / `BMS 12S330` / `BMS 15S320` | Size + model suffix |
| `Celestion FTX0820` vs `Celestion TF0820` | FTX vs TF series |
| `Celestion TF1220` / `TF1225CX` / `TF1225e` | Model suffix |
| `Dayton Audio CX120-8` / `DC160-8` / `DC200-8` / `DC250-8` | Different sizes |
| `Dayton Audio DA115-8` … `ND105-8` (11 drivers) | All different models |
| `Dayton Audio DA270-8` … `SD270A-88` (6 drivers) | All different models |
| `Dayton Audio DC130B-4` / `DC160-4` / `DCS305-4` / `DCS380-4` | Different models |
| `Dayton Audio DC300-8` / `DC380-8` / `DVC310-88` | Different models |
| `Dayton Audio DCS205-4` / `DCS255-4` / `DCS385-4` / `DCS450-4` | Different sizes |
| `Dayton Audio IB385-8` vs `Dayton Audio ST385-8` | IB vs ST series |
| `Dayton Audio LS10-44` / `LS12-44` / `RS150-4` / `RS180-4` | Different models |
| `Dayton Audio QT210-4` vs `Dayton Audio ST210-8` | QT vs ST, impedance |
| `Dayton Audio RS100-8` / `RS125-8` / `RS150-8` | Different sizes |
| `Dayton Audio RS125-4` … `RSS315HO-4` (8 drivers) | All different models |
| `Dayton Audio RSS210HF-4` vs `RSS390HF-4` | Different sizes |
| `Dayton Audio RSS265HO-44` / `RSS315HO-44` / `RSS460HO-4` | Different sizes |
| `Dayton Audio SD215-88A` / `SD315-88` / `SD315A-88` | Different models |
| `Dayton Audio TIT280C-4` / `TIT320C-4` / `TIT400C-4` | Different sizes |
| `Dayton Audio UM10-22` / `UM12-22` / `UM15-22` / `UM18-22` | 10", 12", 15", 18" |
| `Eminence 2510` / `2510-4` / `2510-8` | Impedance variants |
| `Eminence 2512-8` vs `Eminence 2515` | Different models |
| `Eminence 3010LF` vs `Eminence 3015LF` | 10" vs 15" |
| `Eminence 3012HO` vs `Eminence 4012HO` | 30 vs 40 series |
| `Eminence Alpha-6A` / `Alpha-8A` / `Alphalite-6a` | Different models |
| `Eminence Beta-10CBMRA` … `Delta-10A` (6 drivers) | All different models |
| `Eminence Beta-12CX` vs `Eminence Beta-8CX` | 12" vs 8" |
| `Eminence Delta Pro-18C` vs `Delta Pro-8A` | 18" vs 8" |
| `Eminence Delta-12A` … `Delta-15A` (5 drivers) | Different models |
| `Eminence Eminator 1508` vs `Eminence Eminator 2515` | Different models |
| `Eminence Kappa Pro-10LF` / `12A` / `15LFC` | Different sizes |
| `Eminence Legend BP102-4` vs `Eminence Legend BP122` | Different models |
| `Eminence Omega Pro-15A` vs `Eminence Omega Pro-18A` | 15" vs 18" |
| `Eminence Sigma Pro 18-4` vs `Eminence Sigma Pro 18A-2` | Model suffix |
| `Faital Pro 10FE200` / `10FH520` / `6FE200` / `8FE200` | Different sizes/models |
| `Faital Pro 10PR310` / `12PR300` / `12PR310` | Different sizes |
| `Faital Pro 12FH510` / `12FH520` / `15FH510` / `15FH520` | Size + power variants |
| `Faital Pro 5FE120` vs `Faital Pro 6FE100` | 5" vs 6" |
| `GRS 10PF-8` / `10PR-8` / `12PF-8` / `15PF-8` | Different sizes |
| `GRS 10SW-4` vs `GRS 12SW-4` | 10" vs 12" |
| `GRS 4FR-8` vs `GRS 8FR-8` | 4" vs 8" |
| `Infinity 1060w` / `1260w` / `860w` | Different sizes |
| `JBL 2206H` vs `JBL 2226H` | 2206 vs 2226 |
| `MISCQ OOC10WF-4-4B` vs `MISCQ OOC12WF-4-4B` | 10" vs 12" |
| `Silver Flute W17RC38-04` vs `W17RC38-08` | 4Ω vs 8Ω |
| `Stereo Integrity DS4-d2` vs `Stereo Integrity HS24-D2` | Different series |
| `Stereo Integrity HS24 MKII D2` / `HST-12 mkII D2` / `HST-18 mkII D2` | Different sizes |
| `Stereo Integrity HST18 D1` … `HT15 D2` (6 drivers) | Different models |
| `Stereo Integrity IB-24` vs `Stereo Integrity SHS-24` | Different series |

---

## Group C — Same driver, legitimate variants (keep both, add sidecar notes)

| Models | Relationship | Action |
|--------|-------------|--------|
| `Dayton Audio DVC385-88` vs `DVC385-88 V2015` | Same driver, 2015 production revision | Add `corrections:` to each sidecar noting the other exists |
| `Dayton Audio ST255-8 (soft)` vs `ST255-8 (stiff)` | Same driver, different surround compliance measured | Add `corrections:` noting these are user-measured surround variants |
| `GRS 4FR-8 #1` / `GRS 4FR-8 #2` / `GRS 8FR-8 #1` | `#1`/`#2` = measurement variants; `4FR` vs `8FR` = different sizes — mixed group | Separate first: confirm 4FR vs 8FR are different products, then tag #1/#2 as measurement variants |
| `Stereo Integrity HT 18 D4 series #1` vs `#2` | Measurement variants of same driver | Tag with `issue: user_measurement_variant` |

---

## Group D — Genuine T/S conflicts (same model name, different values)

| Models | Notes |
|--------|-------|
| `B&C 8PS21 8" woofer` (2 copies) | Same name, different T/S — cross-reference against PE/SI to find authoritative values |
| *(blank entry)* | One entry had empty model name in the discrepancy report — locate the WDR file and fix |
