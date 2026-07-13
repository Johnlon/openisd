# Chart-type dropdown (full option list)

Screenshot: `docs/winisd/chart_dropdown.png`
View: Toolbar chart-type selector, **expanded** — the dropdown attached to the chart icon + name button in the main-window toolbar (compare collapsed state showing just "SPL" or "Transfer function magnitude" in other screenshots).

## Fields & controls visible

A single combobox listbox, current selection **"Transfer function magnitude"** (bullet-marked at top), followed by the full list of selectable chart types, grouped by blank-line separators:

Group 1 (core driver/box response):

- Transfer function magnitude (current)
- Transfer function phase
- Group Delay
- Maximum Power
- Maximum SPL
- Amplifier apparent load power (VA)
- SPL

Group 2 (driver mechanical/electrical):

- Cone excursion
- Impedance
- Impedance phase

Group 3 (passive radiator specific):

- Transfer function magnitude (PR)
- Transfer function phase (PR)
- Cone excursion (PR)

Group 4 (venting/port specific):

- Rear port - Air velocity
- Rear port - Gain
- Front port - Air velocity
- Front port - Gain
- Intrachamber Port - Air velocity

Group 5 (filter/EQ specific, list continues below visible crop — likely truncated):

- Transfer function magnitude (EQ/Filter)
- Transfer function phase (EQ/Filter)
- Group Delay (EQ/Filter)

## Wireframe

```
+----------------------------------------+
| [chart-icon] Transfer function magnitude|
+----------------------------------------+
| * Transfer function magnitude            |
|   Transfer function phase                |
|   Group Delay                             |
|   Maximum Power                           |
|   Maximum SPL                             |
|   Amplifier apparent load power (VA)      |
|   SPL                                     |
| ------------------------------------------ |
|   Cone excursion                          |
|   Impedance                               |
|   Impedance phase                         |
| ------------------------------------------ |
|   Transfer function magnitude (PR)        |
|   Transfer function phase (PR)            |
|   Cone excursion (PR)                     |
| ------------------------------------------ |
|   Rear port - Air velocity                |
|   Rear port - Gain                        |
|   Front port - Air velocity               |
|   Front port - Gain                       |
|   Intrachamber Port - Air velocity        |
| ------------------------------------------ |
|   Transfer function magnitude (EQ/Filter) |
|   Transfer function phase (EQ/Filter)     |
|   Group Delay (EQ/Filter)                 |
+----------------------------------------+
```

## Other notable UI features

- This confirms WinISD has **at least 20 distinct chart types**, far exceeding OpenISD's current chart set — a comprehensive gap list belongs in `INPUT_PARITY.md` under a "Charts" section (⚠ not yet cross-checked against `INPUT_PARITY.md`'s existing content in this pass).
- The PR-specific and port-specific chart groups confirm the app renders **separate named charts per physical sub-system** (front port vs rear port vs intrachamber port; PR cone excursion vs main-driver cone excursion) rather than folding them into one generic chart with a selector.
- The list may continue below the visible crop (cut off after "Group Delay (EQ/Filter)") — flagging this as a possible incomplete enumeration rather than asserting these are the only entries. ⚠ unverified whether more chart types exist below the crop.
