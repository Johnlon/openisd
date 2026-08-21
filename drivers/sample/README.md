# drivers/sample — WinISD experiment files

This directory contains REAL WDR files created directly in WinISD 0.7.0.950 to
reverse-engineer its internal behaviour. **Not real drivers** — dummy values only.

THESE ARE REAL REFERENCES that have not been modified by AI.

## 🔒 The only oracle is `winisd/`

`winisd/` holds files WinISD ITSELF wrote — typed into the real UI and saved by it. That
provenance is the only thing that makes a `.wdr` authoritative about the format.

**A third-party database's export of driver data into `.wdr` shape is NOT an oracle**, however
plausible or complete it looks. Such a file is one program's guess at WinISD's format, so its
key set, its precision and its `ParState` are all unverified — and it will happily agree with
a bug in our writer. Never take an expected value from one; never use one to assert
conformance. Parse-robustness input is the only legitimate use, and it must be labelled as
such at the point of use.

"Auto calculate unknowns" was always enabled during all experiments. Because WinISD
cannot derive anything from a single T/S input, every single-param probe produces
exactly one new E position — a clean, unambiguous mapping.

---

## Single-parameter probe files (`s-*.wdr`)

Each file has exactly one T/S field set to a non-zero value (unless noted). Comparing
its `ParState=` string against the blank file isolates the ParState index for that field.

| File                    | Field set | ParState pos | Notes                                                                                            |
| ----------------------- | --------- | :----------: | ------------------------------------------------------------------------------------------------ |
| `s-znom.wdr`            | Znom      |      0       |                                                                                                  |
| `s-fs.wdr`              | Fs        |      1       |                                                                                                  |
| `s-pe.wdr`              | Pe        |      2       | Pe=123; SPL=0; WinISD marks only Pe as E                                                         |
| `s-spl.wdr`             | SPL       |      3       | SPL can be directly entered; normally C when T/S present                                         |
| `s-re.wdr`              | Re        |      4       |                                                                                                  |
| `s-le.wdr`              | Le        |      5       |                                                                                                  |
| `s-fle.wdr`             | fLe       |      6       |                                                                                                  |
| `s-kle.wdr`             | KLe       |      7       |                                                                                                  |
| `s-bl.wdr`              | BL        |      8       |                                                                                                  |
| `s-xmax.wdr`            | Xmax      |      9       |                                                                                                  |
| `s-xlim.wdr`            | Xlim      |      10      | ParState-only — WinISD does not write `Xlim=` as a WDR key                                       |
| `s-cms.wdr`             | Cms       |      11      |                                                                                                  |
| `s-qms.wdr`             | Qms       |      12      |                                                                                                  |
| `s-qes.wdr`             | Qes       |      13      |                                                                                                  |
| `s-qts.wdr`             | Qts       |      14      | WDR writes Qts first but ParState puts it at 14, after Qms/Qes                                   |
| `s-rms.wdr`             | Rms       |      15      |                                                                                                  |
| `s-mms.wdr`             | Mms       |      16      |                                                                                                  |
| `s-sd.wdr`              | Sd        |      17      |                                                                                                  |
| `s-vd.wdr`              | Vd        |      18      |                                                                                                  |
| `s-vas.wdr`             | Vas       |      19      | Entered in ft³ in UI; stored as m³ in WDR                                                        |
| _(no probe)_            | ???       |      20      | Always N; not reachable via standard UI                                                          |
| `s-dd.wdr`              | Dd        |      21      | Effective cone diameter                                                                          |
| `s-no.wdr`              | no        |      22      | η₀ efficiency; E when typed, C when computed from T/S, N when nothing set                        |
| `s-voicecoils.wdr`      | numVC     |      23      | Already E in blank (defaults to 1); probe shows no new E but field identity confirmed            |
| `s-hc.wdr`              | Hc        |      24      |                                                                                                  |
| `s-hg.wdr`              | Hg        |      25      |                                                                                                  |
| `s-splmax.wdr`          | SPLmax    |      26      |                                                                                                  |
| `s-splmaxlf.wdr`        | SPLmaxLF  |      27      | **Dirty probe** — also has Pe=E at pos 2 (Pe was accidentally set); SPLmaxLF=27 is still correct |
| `s-uspl.wdr`            | USPL      |      28      |                                                                                                  |
| `s-alfavc.wdr`          | alfaVC    |      29      |                                                                                                  |
| `s-r-t.wdr`             | Rt        |      30      |                                                                                                  |
| `s-c-t.wdr`             | Ct        |      31      |                                                                                                  |
| `s-gamma.wdr`           | gamma     |      32      |                                                                                                  |
| `s-ebp.wdr`             | EBP       |      33      | **Surprise:** EBP is at 33, not adjacent to Rme/Mpow/Mcost in WDR write order                    |
| `s-rme.wdr`             | Rme       |      34      |                                                                                                  |
| `s-mpow.wdr`            | Mpow      |      35      |                                                                                                  |
| `s-mcost.wdr`           | Mcost     |      36      |                                                                                                  |
| `s-gloss.wdr`           | Gloss     |      37      |                                                                                                  |
| `s-thick.wdr`           | Thick     |      38      |                                                                                                  |
| `s-depth.wdr`           | Depth     |      39      |                                                                                                  |
| `s-magnetdepth.wdr`     | MagDepth  |      40      |                                                                                                  |
| `s-magnet.wdr`          | MagDepth  |      40      | **Broken probe** — file still sets `MagDepth=123` not `Magnet=123`                               |
| `s-driver-12345678.wdr` | Magnet    |      41      | Confirmed via dims probe: Thick=1…DVol=8; pos 41=E from Magnet=4                                 |
| `s-basket.wdr`          | Basket    |      42      |                                                                                                  |
| `s-outer.wdr`           | Outer     |      43      |                                                                                                  |
| `s-vcd.wdr`             | Vcd       |      44      |                                                                                                  |
| `s-dvol.wdr`            | DVol      |      45      |                                                                                                  |
| _(no probe)_            | ???       |      46      | Always N; internal field with no WDR key                                                         |
| `s-c.wdr`               | c         |      47      | Speed of sound; C at standard conditions, E when explicitly entered                              |
| `s-roo.wdr`             | roo       |      48      | Air density; same behaviour as c                                                                 |

### VCCon — save bug, position unknown

`VCCon` is a WDR field (parallel/serial wiring) but WinISD always writes `VCCon=1`
regardless of the UI setting — the save is buggy. Because it can never be set to E,
probing its ParState position is impossible. The connection probe files
(`s-connection-*.wdr`) all show no new E position.

`VCCon=1` means parallel; `VCCon=2` means serial. Reading is correct — opening a
hand-edited `VCCon=2` file does display as serial. Only saving is broken.

**Conclusion:** VCCon is not tracked in ParState. The s-driver-12345678 probe had
`VCCon=1` present and all 8 dim fields set, yet pos 46 stayed N. With all other
positions accounted for, VCCon has no ParState slot — it is pure WDR metadata.

---

## Confirmed ParState position map

```
Pos  Field       Source
---  -----       ------
  0  Znom        s-znom
  1  Fs          s-fs
  2  Pe          s-pe
  3  SPL         s-spl
  4  Re          s-re
  5  Le          s-le
  6  fLe         s-fle
  7  KLe         s-kle
  8  BL          s-bl
  9  Xmax        s-xmax
 10  Xlim        s-xlim  (ParState-only; no WDR key)
 11  Cms         s-cms
 12  Qms         s-qms
 13  Qes         s-qes
 14  Qts         s-qts
 15  Rms         s-rms
 16  Mms         s-mms
 17  Sd          s-sd
 18  Vd          s-vd
 19  Vas         s-vas
 20  ???         always N — unknown field
 21  Dd          s-dd
 22  no          s-no
 23  numVC       s-voicecoils (already E in blank)
 24  Hc          s-hc
 25  Hg          s-hg
 26  SPLmax      s-splmax
 27  SPLmaxLF    s-splmaxlf (dirty probe — also has Pe=E)
 28  USPL        s-uspl
 29  alfaVC      s-alfavc
 30  Rt          s-r-t
 31  Ct          s-c-t
 32  gamma       s-gamma
 33  EBP         s-ebp
 34  Rme         s-rme
 35  Mpow        s-mpow
 36  Mcost       s-mcost
 37  Gloss       s-gloss
 38  Thick       s-thick
 39  Depth       s-depth
 40  MagDepth    s-magnetdepth
 41  Magnet      s-driver-12345678 (Magnet=4 → pos 41=E confirmed)
 42  Basket      s-basket
 43  Outer       s-outer
 44  Vcd         s-vcd
 45  DVol        s-dvol
 46  ???         always N — unknown field
 47  c           s-c
 48  roo         s-roo
```

**Coverage: 47/49 confirmed.** Unknown: pos 20 (likely Dia — never probed), pos 46 (always N; VCCon is not tracked in ParState).
VCCon position also unknown due to save bug.

---

## Multi-parameter scenario files

| File                                           | Scenario                                                                                  | ParState                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `john-all-defaults.wdr`                        | Blank driver — nothing entered                                                            | `NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNNNNNNNNNNCC`                                              |
| `john-all-set-then-cleaded.wdr`                | All fields set, then Clear button hit                                                     | `NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNNNNNNNNNNCC` — identical to blank; Clear resets all state |
| `john-all-set.wdr`                             | Every Parameters-tab field typed in; physical dimensions at 0                             | `EEEEEEEEEEEEEEEEEEEENEEEEEEEEEEEEEEEEENNNNNNNNNEE`                                              |
| `john-all-entered-driver-dims.wdr`             | Same as above plus all Dimensions-tab fields entered                                      | `EEEEEEEEEEEEEEEEEEEENEEEEEEEEEEEEEEEEEEEEEEEEENEE`                                              |
| `john-all-entered-driver-dim123s.wdr`          | Same with sequential dim values                                                           | `EEEEEEEEEEEEEEEEEEEENEEEEEEEEEEEEEEEEEEEEEEEEENEE` — identical ParState to dims file            |
| `john-all-noncalc-fields-manually-entered.wdr` | All black (enterable) fields filled; 57-field format                                      | `CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC`                                              |
| `John-all-manu-populated-init.wdr`             | All enterable fields with sequential values                                               | `CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC`                                              |
| `John-all-manu-populated.wdr`                  | Resaved version of the above                                                              | `CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC` — identical                                  |
| `John-all-manu-populated-ex.wdr`               | Full set, then Fs and Qms removed                                                         | `CNECEEECCNNCCEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC` — Fs→N, Znom and others cascade-invalidated  |
| `s-driver-12345678.wdr`                        | Dims-only probe: Thick=1, Depth=2, MagDepth=3, Magnet=4, Basket=5, Outer=6, Vcd=7, DVol=8 | `NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNEEEEEEEENCC` — confirms pos 38–45; pos 46 stays N         |

---

## Key findings

### WDR write order ≠ ParState internal order

WinISD writes WDR fields in one order but numbers its internal parameters differently.
Notable mismatches:

- **Qts** is written first in WDR but is at ParState pos 14 (after Qms=12, Qes=13)
- **EBP** appears in WDR near the dims block but is at ParState pos 33 (thermal group)
- **VCCon** appears in WDR between Gloss and c but has no confirmed ParState position

### Three unresolved positions

| Pos | Behaviour                                  | Likely candidate    |
| :-: | ------------------------------------------ | ------------------- |
| 20  | Always N                                   | Dia? VCCon? Unknown |
| 41  | Confirmed via s-driver-12345678 (Magnet=4) | Magnet              |
| 46  | Always N                                   | VCCon? Unknown      |

### `no` (η₀) is at pos 22 and IS enterable

`no` can be E when typed directly, C when computed from T/S, or N when nothing is set.
The s-no probe confirms pos 22.

### Clear == blank

`john-all-set-then-cleaded.wdr` ParState is byte-for-byte identical to
`john-all-defaults.wdr`. The Clear button resets every param to N; numVC returns to
E=1; c/roo return to C.

### Pos 20 and 46 are permanently N

Neither position has ever been observed as anything other than N across all probe files
and multi-param scenarios, including `john-all-set.wdr` where every visible UI field
was entered. These positions may be internal WinISD fields with no corresponding UI
entry point.

---

## Authoritative sources

Only two sources are authoritative for WinISD behaviour:

1. **WinISD.exe itself** — behaviour observed by running the application.
2. **WinISD help files** — `docs/winisd_helpfiles/help/`.

Do not infer WinISD behaviour from OpenISD source code, forum posts, or third-party
documentation without cross-checking against one of these two sources.

---

## `beyma-8BR40N-cms-vas-inconsistency.wdr`

Produced in WinISD by clearing entered fields and letting the application recompute. Provided
2026-08-05.

**ParState decode** — entered: `Fs` `BL` `Cms` `Qms` `Qts` `Sd` `Vas` `Vd` `Dd`. Calculated by
WinISD: `Re` `Qes` `Rms` `Mms` `no` `gamma` `EBP` `Rme` `Mpow`.

### What it establishes

**1. `Rme = 2π·Fs·Mms/Qes` is exact; `Rme = BL²/Re` is not.** The first reproduces the stored
value to all 16 digits, the second is out by −0.17385 %. `WINISD_SCHEMA.md` §4 rows 3 and 4 present
these as one relation group; they are not equivalent in WinISD data.

**2. The cause is inconsistent INPUT, not a wrong formula.** The same −0.17385 % appears in three
independent places:

| comparison                                               | deviation  |
| -------------------------------------------------------- | ---------- |
| `Rme = BL²/Re` vs stored `Rme`                           | −0.17385 % |
| stored `Re` vs the `Qes = 2π·Fs·Mms·Re/BL²` identity     | −0.17385 % |
| `Cms` implied by entered `Vas` and `Sd` vs entered `Cms` | −0.17385 % |
| entered `Vas` vs `ρc²Sd²·Cms`                            | +0.17415 % |

Entered `Cms = 0.0013` and entered `Vas = 0.0891` disagree by 0.174 % given `Sd`. WinISD derives
`Mms` through the `Cms` chain and `Re` through the `Vas` chain and never reconciles them, so the
two `Rme` expressions land in different places. `BL²/Re` is a correct formula fed by an `Re` that
came from a different input.

**Consequence:** computing `Rme` both ways is a live consistency check on `Vas` against `Cms`.
A DQ tolerance wider than the entry disagreement cannot see it.

**3. The SPL/η₀ constant is derived, not a literal.**

    SPL = K + 10·log10(η₀)        K = 10·log10(ρ·c / (2π·p_ref²))        p_ref = 20e-6 Pa

Back-solved from this file, `K = 112.154453213`; the expression gives `112.154453213` — agreement
1.4e-13 dB. Reconstructing SPL from first principles (`p² = ρ·c·η₀/(2π)`, r = 1 m, half space)
reproduces the stored `SPL` to all 12 printed digits.

`K` therefore moves with `ρ` and `c`, and so with temperature, humidity and pressure:
112.1545 at WinISD's 20 °C/30 % RH defaults, 112.1593 for textbook dry-air constants, 112.0818 at
30 °C.

**4. `no` is the textbook η₀.** Both `4π²/c³ · Fs³·Vas/Qes` and `ρ/(2πc) · Bl²Sd²/(Re·Mms²)`
reproduce the stored value to 10+ digits.

### Caveat

The parameter values are not a real driver — fields were cleared to force recomputation, so
`η₀ = 0.18` is physically implausible. That does not affect any finding above: every one is a
relationship between the file's own numbers, and WinISD computed them from what it was given.
