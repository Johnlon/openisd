# drivers/sample — WinISD experiment files

This directory contains REAL WDR files created directly in WinISD 0.7.0.950 to
reverse-engineer its internal behaviour. **Not real drivers** — dummy values only.

THESE ARE REAL REFERENCES that have not been modified by AI. 

"Auto calculate unknowns" was always enabled during all experiments. Because WinISD
cannot derive anything from a single T/S input, every single-param probe produces
exactly one new E position — a clean, unambiguous mapping.

---

## Single-parameter probe files (`s-*.wdr`)

Each file has exactly one T/S field set to a non-zero value (unless noted). Comparing
its `ParState=` string against the blank file isolates the ParState index for that field.

| File | Field set | ParState pos | Notes |
|------|-----------|:---:|-------|
| `s-znom.wdr`      | Znom     |  0 | |
| `s-fs.wdr`        | Fs       |  1 | |
| `s-pe.wdr`        | Pe       |  2 | Pe=123; SPL=0; WinISD marks only Pe as E |
| `s-spl.wdr`       | SPL      |  3 | SPL can be directly entered; normally C when T/S present |
| `s-re.wdr`        | Re       |  4 | |
| `s-le.wdr`        | Le       |  5 | |
| `s-fle.wdr`       | fLe      |  6 | |
| `s-kle.wdr`       | KLe      |  7 | |
| `s-bl.wdr`        | BL       |  8 | |
| `s-xmax.wdr`      | Xmax     |  9 | |
| `s-xlim.wdr`      | Xlim     | 10 | ParState-only — WinISD does not write `Xlim=` as a WDR key |
| `s-cms.wdr`       | Cms      | 11 | |
| `s-qms.wdr`       | Qms      | 12 | |
| `s-qes.wdr`       | Qes      | 13 | |
| `s-qts.wdr`       | Qts      | 14 | WDR writes Qts first but ParState puts it at 14, after Qms/Qes |
| `s-rms.wdr`       | Rms      | 15 | |
| `s-mms.wdr`       | Mms      | 16 | |
| `s-sd.wdr`        | Sd       | 17 | |
| `s-vd.wdr`        | Vd       | 18 | |
| `s-vas.wdr`       | Vas      | 19 | Entered in ft³ in UI; stored as m³ in WDR |
| *(no probe)*      | ???      | 20 | Always N; not reachable via standard UI |
| `s-dd.wdr`        | Dd       | 21 | Effective cone diameter |
| `s-no.wdr`        | no       | 22 | η₀ efficiency; E when typed, C when computed from T/S, N when nothing set |
| `s-voicecoils.wdr`| numVC    | 23 | Already E in blank (defaults to 1); probe shows no new E but field identity confirmed |
| `s-hc.wdr`        | Hc       | 24 | |
| `s-hg.wdr`        | Hg       | 25 | |
| `s-splmax.wdr`    | SPLmax   | 26 | |
| `s-splmaxlf.wdr`  | SPLmaxLF | 27 | **Dirty probe** — also has Pe=E at pos 2 (Pe was accidentally set); SPLmaxLF=27 is still correct |
| `s-uspl.wdr`      | USPL     | 28 | |
| `s-alfavc.wdr`    | alfaVC   | 29 | |
| `s-r-t.wdr`       | Rt       | 30 | |
| `s-c-t.wdr`       | Ct       | 31 | |
| `s-gamma.wdr`     | gamma    | 32 | |
| `s-ebp.wdr`       | EBP      | 33 | **Surprise:** EBP is at 33, not adjacent to Rme/Mpow/Mcost in WDR write order |
| `s-rme.wdr`       | Rme      | 34 | |
| `s-mpow.wdr`      | Mpow     | 35 | |
| `s-mcost.wdr`     | Mcost    | 36 | |
| `s-gloss.wdr`     | Gloss    | 37 | |
| `s-thick.wdr`     | Thick    | 38 | |
| `s-depth.wdr`     | Depth    | 39 | |
| `s-magnetdepth.wdr` | MagDepth | 40 | |
| `s-magnet.wdr`    | MagDepth | 40 | **Broken probe** — file still sets `MagDepth=123` not `Magnet=123` |
| `s-driver-12345678.wdr` | Magnet | 41 | Confirmed via dims probe: Thick=1…DVol=8; pos 41=E from Magnet=4 |
| `s-basket.wdr`    | Basket   | 42 | |
| `s-outer.wdr`     | Outer    | 43 | |
| `s-vcd.wdr`       | Vcd      | 44 | |
| `s-dvol.wdr`      | DVol     | 45 | |
| *(no probe)*      | ???      | 46 | Always N; internal field with no WDR key |
| `s-c.wdr`         | c        | 47 | Speed of sound; C at standard conditions, E when explicitly entered |
| `s-roo.wdr`       | roo      | 48 | Air density; same behaviour as c |

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

| File | Scenario | ParState |
|------|----------|---------|
| `john-all-defaults.wdr` | Blank driver — nothing entered | `NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNNNNNNNNNNCC` |
| `john-all-set-then-cleaded.wdr` | All fields set, then Clear button hit | `NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNNNNNNNNNNCC` — identical to blank; Clear resets all state |
| `john-all-set.wdr` | Every Parameters-tab field typed in; physical dimensions at 0 | `EEEEEEEEEEEEEEEEEEEENEEEEEEEEEEEEEEEEENNNNNNNNNEE` |
| `john-all-entered-driver-dims.wdr` | Same as above plus all Dimensions-tab fields entered | `EEEEEEEEEEEEEEEEEEEENEEEEEEEEEEEEEEEEEEEEEEEEENEE` |
| `john-all-entered-driver-dim123s.wdr` | Same with sequential dim values | `EEEEEEEEEEEEEEEEEEEENEEEEEEEEEEEEEEEEEEEEEEEEENEE` — identical ParState to dims file |
| `john-all-noncalc-fields-manually-entered.wdr` | All black (enterable) fields filled; 57-field format | `CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC` |
| `John-all-manu-populated-init.wdr` | All enterable fields with sequential values | `CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC` |
| `John-all-manu-populated.wdr` | Resaved version of the above | `CEECEEECCEECEEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC` — identical |
| `John-all-manu-populated-ex.wdr` | Full set, then Fs and Qms removed | `CNECEEECCNNCCEECECCENCCEECCCCNNNCCCCCCNNNNNNNNNCC` — Fs→N, Znom and others cascade-invalidated |
| `s-driver-12345678.wdr` | Dims-only probe: Thick=1, Depth=2, MagDepth=3, Magnet=4, Basket=5, Outer=6, Vcd=7, DVol=8 | `NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNEEEEEEEENCC` — confirms pos 38–45; pos 46 stays N |

---

## Key findings

### WDR write order ≠ ParState internal order

WinISD writes WDR fields in one order but numbers its internal parameters differently.
Notable mismatches:

- **Qts** is written first in WDR but is at ParState pos 14 (after Qms=12, Qes=13)
- **EBP** appears in WDR near the dims block but is at ParState pos 33 (thermal group)
- **VCCon** appears in WDR between Gloss and c but has no confirmed ParState position

### Three unresolved positions

| Pos | Behaviour | Likely candidate |
|:---:|-----------|-----------------|
| 20 | Always N | Dia? VCCon? Unknown |
| 41 | Confirmed via s-driver-12345678 (Magnet=4) | Magnet |
| 46 | Always N | VCCon? Unknown |

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
2. **WinISD help files** — `research/winisd/help/`.

Do not infer WinISD behaviour from OpenISD source code, forum posts, or third-party
documentation without cross-checking against one of these two sources.
