# Driver editor — Advanced parameters tab

Screenshot: `docs/winisd/edit_driver_pg3_advanced_parameters.png`
View: "Driver editor" modal dialog, "Advanced parameters" tab (3rd of 4)

Already documented field-by-field in `INPUT_PARITY.md` ("Driver editor → Advanced parameters tab"). Layout only, below.

## Fields & controls visible

Tab strip: General, Parameters, **Advanced parameters** (active), Dimensions.

Three grey section-header bars:

1. **"Thermal parameters"** — `AlfaVC` [0.0000] 1000/K, `R(t)` [0.00000] K/W, `C(t)` [0.00000] J/K.
2. **"Figure of merits"** — row 1: `SPLmaxLF` [0.00] dB, `SPLmax` [0.00] dB, `Rme` [0.00000] Ns/m, `gamma` [0.00000] N/(A*kg). Row 2: `Mpow` [0.00000] N/sqrt(W), `Mcost` [0.00000] kg/s, `EBP` [0.00] Hz, `Gloss` [0.0000] %.
3. **"Environment parameters"** — `c` [343.68] m/s (shown in **blue text** = Calculated state), `roo` [1.20095] kg/m^3 (also **blue** = Calculated).

Rest of the tab body below Environment parameters is empty whitespace (no further fields).

Footer: same ParState legend + Auto-calculate checkbox + Save/Load/Clear/Cancel as all other tabs.

## Wireframe

```
+-------------------------------------------------------------+
| General Parameters [Advanced parameters] Dimensions           |
+-------------------------------------------------------------+
| -------------------- Thermal parameters ----------------------|
| AlfaVC[__]1000/K   R(t)[__]K/W   C(t)[__]J/K                  |
| --------------------- Figure of merits ------------------------|
| SPLmaxLF[__]dB  SPLmax[__]dB  Rme[__]Ns/m   gamma[__]N/(A*kg) |
| Mpow[__]N/sqrt(W) Mcost[__]kg/s EBP[__]Hz   Gloss[__]%        |
| ------------------- Environment parameters ---------------------|
| c [343.68 blue] m/s     roo [1.20095 blue] kg/m^3              |
|                                                                |
|                 (rest of tab is blank)                        |
+-------------------------------------------------------------+
| [legend] [x]Auto calc unknowns   [Save][Load][Clear][Cancel] |
+-------------------------------------------------------------+
```

## Other notable UI features

- **`c` and `roo` are shown in blue (Calculated) even though this is a brand-new/blank driver** — confirms WinISD auto-populates default air constants (343.68 m/s, 1.20095 kg/m³) as a Calculated default rather than leaving them "Not available" (black). This matches the confirmed values in `WINISD.md` §"The air constants" / INPUT_PARITY.md.
- All other numeric fields on this tab are black-bordered plain (uncoloured/default) text boxes at their zero defaults — no green (Entered) values are shown since this is a fresh/empty driver.
