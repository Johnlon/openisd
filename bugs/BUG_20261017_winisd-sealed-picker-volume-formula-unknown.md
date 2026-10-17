# BUG_20261017_winisd-sealed-picker-volume-formula-unknown

**Status:** FORMULA FOUND (2026-10-17); switch, cue and register rows still to do

## Symptom
WinISD's New Project wizard sealed alignment picker gives a volume whose Box tab Qtc is not the picked one: picking
Qtc 0.800 for the W5-1138SMF (Qts 0.49, Vas 4.85 L) gives Vb 3.134 L, and the Box tab then shows Qtc 0.787 (Ql 10).
The lossless formula gives 2.912 L. OpenISD's picker now gives the volume that shows the picked Qtc.

## Kind
A WinISD calculation bug (a value that contradicts WinISD's own Box tab) on the recommended reading; see
Classification. Per CLAUDE.md OpenISD does the correct thing by default, with a yellow switch under "Enable WinISD
bugs" that brings WinISD's picker volume back. John's ruling (17 Oct 2026): "either way I want the logocal self
consistent behaviour".

## John's ruling, 17 Oct 2026
"either way I want the logocal self consistent behaviour". OpenISD's default stays self-consistent: the picked
Qtc is the Qtc the Box tab shows (T347). The classification below only decides how WinISD's picker volume comes back.

## WinISD's formula (found 2026-10-17)
Function `0x45c140` in winisd.exe (sealed designer called by the New Project wizard). Validated on 41 wizard
captures, four drivers, max relative residual 3.8e-15:

```
Qes' = Qes * (Re + Rg) / Re       Rg = 0.1 (wizard constant, not read from any open project)
Qts' = 1 / (1/Qes' + 1/Qms)
Qt   = 1 / (1/Qts' + 1/Qa)        Qa = 100 (wizard default; Ql is not used)
Vb   = Vas / ((Qtc / Qt)^2 - 1)   Qtc 0.707 is 1/sqrt(2)
```

- Inputs OpenISD's switch needs: Rg (0.1 fixed in WinISD), Qa (100 fixed), Re, Qes, Qms, Vas. Ql is ignored.
- The lead was close: Rg is folded in as guessed; the missing piece is the extra 1/Qa term (Qt 0.50119 for the
  W5-1138SMF, not 0.5012 from Rg alone), and Ql plays no part.
- Evidence: `winisd_research/GHIDRA_FINDINGS.md` section "SEALED (CLOSED) ALIGNMENT PICKER FORMULA FOUND";
  captures `winisd_research/runs/sealed_picker_formula.jsonl` and `runs/closed_alignments.jsonl`; validator
  `winisd_research/toys/validate_sealed_picker_formula.py`; output `runs/sealed_picker_validation.txt`.
- The picker volume does not give the picked Qtc on WinISD's own Box tab, because the Box tab uses Ql 10 and the
  picker ignores Ql.

## WinISD picker vs OpenISD picker
OpenISD: `OpenISDDriver.sealedVolumeForQtc` (Rg 0.1, Ql 10, Qa 100), run from `packages/design` unmodified. "Box tab
at WinISD Vb" is OpenISD's lossy Qtc for the volume WinISD picked; only W5 0.800 -> 0.787 was seen on WinISD's own
Box tab (John), the other cells are computed.

| Driver | Picked Qtc | WinISD picker Vb (L) | OpenISD picker Vb (L) | Qtc on Box tab at WinISD Vb | Qtc on Box tab at OpenISD Vb |
|---|---|---|---|---|---|
| W5 | 0.577 | 14.9103 | 15.5376 | 0.5799 | 0.5770 |
| W5 | 0.707 | 4.8974 | 4.7997 | 0.7038 | 0.7071 |
| W5 | 0.800 | 3.1338 | 2.9559 | 0.7873 | 0.8000 |
| W5 | 1.000 | 1.6272 | 1.4269 | 0.9579 | 1.0000 |
| W5 | 1.200 | 1.0249 | 0.8415 | 1.1194 | 1.2000 |
| E150 | 0.577 | 6.6683 | 6.9738 | 0.5835 | 0.5770 |
| E150 | 0.707 | 3.4381 | 3.3744 | 0.7030 | 0.7071 |
| E150 | 0.800 | 2.4455 | 2.3092 | 0.7847 | 0.8000 |
| E150 | 1.000 | 1.4035 | 1.2316 | 0.9533 | 1.0000 |
| E150 | 1.200 | 0.9229 | 0.7580 | 1.1137 | 1.2000 |
| SA | 0.500 | 7.0821 | 7.7528 | 0.5153 | 0.5000 |
| SA | 0.577 | 4.8889 | 5.1123 | 0.5863 | 0.5770 |
| SA | 0.707 | 3.0106 | 2.9556 | 0.7021 | 0.7071 |
| SA | 0.800 | 2.2774 | 2.1510 | 0.7823 | 0.8000 |
| SA | 1.000 | 1.4004 | 1.2288 | 0.9488 | 1.0000 |
| SA | 1.200 | 0.9523 | 0.7818 | 1.1083 | 1.2000 |
| SB | 0.800 | 11.2635 | 10.6136 | 0.7887 | 0.8000 |
| SB | 1.000 | 5.4214 | 4.7515 | 0.9605 | 1.0000 |
| SB | 1.200 | 3.3180 | 2.7232 | 1.1226 | 1.2000 |
| SB | 1.500 | 1.9356 | 1.4474 | 1.3518 | 1.5000 |

OpenISD's pick sits a few percent from WinISD's at Qtc 0.577 to 0.707 and 10 to 25 percent away at Qtc 1.0 and above.

## Classification (unresolved for John)
Recommendation: (b) a calculation bug, yellow switch under "Enable WinISD bugs". Reasons:
- WinISD's picked volume gives a different Qtc on WinISD's own Box tab (0.800 picked, 0.787 shown): the value
  contradicts WinISD's own other display.
- The picker leaves out Ql while the Box tab it feeds includes it, and uses a Rg and Qa the user cannot see or change.
- Against: dropping losses when designing could be read as a deliberate simplification (a). The evidence does not
  show intent, so John decides if he reads it as (a).

## Fix
Formula found (above). Add the switch, the ≠W cue, the
`docs/research/ACCURACY_IMPROVEMENTS.md` row and the `docs/research/WINISD_PARITY.md` row.

## Verification
A unit test of the switch against the wine captures: Vb 3.1338 L for Qtc 0.800 on the W5-1138SMF, and the rows above.
