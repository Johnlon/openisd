# The first exhaustive layout scan found 21 phone views at fault

Status: OPEN. `layout-scan.browser.spec.ts`, first run 10 Nov 2026, 374 px wide: 58 views opened, 37 pass, 21 fail. Each fails as a known fault (SCAN_KNOWN in the spec) until fixed.

- box-sealed (Box — sealed): 1 fault(s), first: G root@16 "Fsc" ends 40px before its box (at most 32)
- losses-sealed-Rear (Box losses — sealed Rear): 1 fault(s), first: G root@19 "Absorption Qa" ends 34px before its box (at most 32)
- tune-sealed (Tune — sealed): 1 fault(s), first: G root@16 "Box volume" ends 51px before its box (at most 32)
- what-if-sealed (What-if — sealed): 11 fault(s), first: R7 label "Qes" overlaps label "Auto Y" by 28x12
- losses-vented-Rear (Box losses — vented Rear): 1 fault(s), first: G root@19 "Absorption Qa" ends 34px before its box (at most 32)
- tune-vented (Tune — vented): 3 fault(s), first: R7 label "Drivers" overlaps label "Auto Y" by 47x12
- what-if-vented (What-if — vented): 13 fault(s), first: R7 label "Fs" overlaps label "Auto Y" by 19x12
- tune-box-passive-radiator (Tune — box-passive-radiator): 3 fault(s), first: R7 label "Drivers" overlaps label "Auto Y" by 47x12
- losses-box-passive-radiator-Rear (Box losses — box-passive-radiator Rear): 1 fault(s), first: G root@19 "Absorption Qa" ends 34px before its box (at most 32)
- what-if-box-passive-radiator (What-if — box-passive-radiator): 12 fault(s), first: R7 label "Fs" overlaps label "Auto Y" by 19x12
- tune-bandpass4 (Tune — bandpass4): 8 fault(s), first: R7 label "Power" overlaps label "Auto Y" by 43x12
- what-if-bandpass4 (What-if — bandpass4): 13 fault(s), first: R7 label "Input power" overlaps label "Auto Y" by 74x12
- what-if-bandpass6 (What-if — bandpass6): 13 fault(s), first: R7 label "Front port a" overlaps label "Auto Y" by 74x12
- tune-bandpass6 (Tune — bandpass6): 11 fault(s), first: R7 label "Front port a" overlaps label "Auto Y" by 74x12
- tune-abc (Tune — abc): 12 fault(s), first: R7 label "Front port a" overlaps label "Auto Y" by 74x12
- what-if-abc (What-if — abc): 14 fault(s), first: R7 label "Front port a" overlaps label "Auto Y" by 74x12
- tab-driver (Driver): 1 fault(s), first: G root@16 "Drivers" ends 37px before its box (at most 32)
- editor-parameters (Driver Editor — Parameters): 1 fault(s), first: R4 root@17 value widths differ: Qes:169/267, Qms:169/267, Qts:169/267, Fs:169/267, Vas:169/267, Mms:169/267, Cms:169/267, Rms:169/267, Re:169/267, BL:169/267, D
- options-plot-window (Options — Plot Window): 24 fault(s), first: R2 input#opt-phone-lim-fmin "10.0" text is cut 17px
- filter-lowpass (Filter card — LP): 1 fault(s), first: R4 mob-content@25 value widths differ: Subtype:265/349, Order:175/259, Q:175/259, Cutoff:175/259
- filter-highpass (Filter card — HP): 1 fault(s), first: R4 mob-content@25 value widths differ: Subtype:265/349, Order:175/259, Q:175/259, Cutoff:175/259

Full list: ui-gallery/T742-phone-clip/scan-result.json. Desktop views are not scanned yet (waits for T739's desktop opener).
