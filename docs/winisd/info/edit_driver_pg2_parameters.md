# Driver editor — Parameters tab

Screenshot: `docs/winisd/edit_driver_pg2_parameters.png`
View: "Driver editor" modal dialog, "Parameters" tab (2nd of 4)

Already documented field-by-field in `INPUT_PARITY.md` ("Driver editor → Parameters tab") — this file adds the on-screen layout/positions only.

## Fields & controls visible

Tab strip: General, **Parameters** (active), Advanced parameters, Dimensions.

Four grey section-header bars divide the tab, top to bottom, each spanning full dialog width:

1. **"Thiele/Small parameters"** — row 1: `Qes` [0.000], `Qms` [0.000], `Qts` [0.000], `Fs` [0.00] Hz. Row 2: `Vas` [0.0] in^3 (units shown as in³ — imperial, differs from WDR-native m³).
2. **"Electro-Mechanical parameters"** — row 1: `Mms` [0.00000] kg, `Cms` [0.0] um/N, `Rms` [0.00000] Ns/m, `Re` [0.000] ohm. Row 2: `BL` [0.00000] Tm, `Dd` [0.000] m, `Le` [0.000000] H, `Sd` [0.0000] m^2. Row 3: `fLe` [0.00000] kHz, `KLe` [0.000000] H*sqrt(Hz).
3. **"Large-Signal parameters"** — row 1: `Xmax` [0.000] m "peak", `Hc` [0.000] m, `Hg` [0.000] m, `Vd` [0] cm^3. Row 2: `Xlim` [0.000] m, `Pe` [0.0] W.
4. **"Miscellaneous parameters"** — row 1: `no` [0.0000] %, `Znom` [0.000] ohm, `USPL` [0.00] dB, `SPL` [0.00] dB. Row 2: `Voicecoils` [1] (plain number, not boxed like other fields), `Connection` dropdown [Parallel].

Footer (same on all 4 tabs): ParState colour legend (green=Entered, blue=Calculated, black=Not available), "Auto calculate unknowns" checkbox (checked), Save/Load/Clear/Cancel buttons.

## Wireframe

```
+-------------------------------------------------------------+
| General [Parameters] Advanced parameters  Dimensions          |
+-------------------------------------------------------------+
| ---------------- Thiele/Small parameters -------------------- |
| Qes[__] Qms[__] Qts[__]                          Fs[__]Hz     |
| Vas[__]in^3                                                   |
| ------------- Electro-Mechanical parameters ------------------ |
| Mms[__]kg  Cms[__]um/N  Rms[__]Ns/m         Re[__]ohm         |
| BL[__]Tm   Dd[__]m      Le[__]H             Sd[__]m^2         |
| fLe[__]kHz KLe[__]H*sqrt(Hz)                                  |
| ------------------ Large-Signal parameters -------------------- |
| Xmax[__]m peak  Hc[__]m         Hg[__]m       Vd[__]cm^3      |
| Xlim[__]m       Pe[__]W                                       |
| ---------------- Miscellaneous parameters --------------------- |
| no[__]%   Znom[__]ohm   USPL[__]dB   SPL[__]dB                |
| Voicecoils 1    Connection[Parallel v]                         |
+-------------------------------------------------------------+
| [legend] [x]Auto calc unknowns   [Save][Load][Clear][Cancel] |
+-------------------------------------------------------------+
```

## Other notable UI features

- Field grouping into 4 labelled bands (Thiele/Small, Electro-Mechanical, Large-Signal, Miscellaneous) is a layout fact not previously called out in `INPUT_PARITY.md` — useful for reproducing the driver-editor grouping in a UI skin.
- Units shown are a mix of metric and imperial by default (e.g. Vas in in³) — consistent with `WINISD.md` §14's unit-cycle table; every numeric field's unit is user-cyclable per that table.
- `Voicecoils` is the only integer field rendered without a boxed input outline in this screenshot (plain "1"); this may be a rendering/zoom artifact rather than a real style difference — not fully certain, flagged here rather than asserted.
