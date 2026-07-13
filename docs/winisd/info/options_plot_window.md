# Options dialog — Plot Window tab

Screenshot: `docs/winisd/options_plot_window.png`
View: "Options" modal dialog, "Plot Window" tab

## Fields & controls visible

Tab strip: General, **Plot Window** (active).

**"Colors"** grey-bordered group box:

- `0 dB line` — black colour swatch + `[Change]` button.
- `-3dB line` — grey/black swatch + `[Change]` button.
- `Background` — white swatch + `[Change]` button.
- `Other lines` — grey swatch + `[Change]` button.
- `Labels` — black swatch + `[Change]` button.
- `Xmax limit` — red swatch + `[Change]` button.

**"Limits"** grey-bordered group box — a table with columns **Start / End / Unit**, one row per chart-scale dimension:

| Row                  | Start | End   | Unit     |
| -------------------- | ----- | ----- | -------- |
| Frequency range      | 10    | 500   | Hz       |
| Transfer func. magn. | -30   | 6     | dB       |
| EQ transfer func mag | -40   | 20    | dB       |
| Transfer func. phase | -180  | 180   | deg      |
| SPL                  | 40    | 105   | dB       |
| Cone excursion       | 0.0   | 30.0  | mm peak  |
| Impedance            | 0     | 50    | ohm      |
| Impedance phase      | -90   | 90    | deg      |
| Group delay          | 0     | 40    | ms       |
| Maximum power        | 0     | 500   | W        |
| Air velocity         | 0.00  | 40.00 | m/s peak |

Bottom-right: `[OK]`, `[Cancel]`.

## Wireframe

```
+-------------------------------------------------+
| [icon] Options                    [_][□][X]      |
+-------------------------------------------------+
| General [Plot Window]                             |
+-------------------------------------------------+
| Colors                                            |
| 0 dB line [black][Change]   Other lines[gry][Change]|
| -3dB line [Change]          Labels [black][Change] |
| Background[Change]          Xmax limit[red][Change]|
|                                                    |
| Limits            Start   End    Unit             |
| Frequency range    10     500    Hz                |
| Transfer func.magn -30    6      dB                |
| EQ transfer func mag -40  20     dB                |
| Transfer func.phase -180  180    deg               |
| SPL                 40    105    dB                |
| Cone excursion      0.0   30.0   mm peak           |
| Impedance           0     50     ohm               |
| Impedance phase     -90   90     deg               |
| Group delay         0     40     ms                |
| Maximum power       0     500    W                 |
| Air velocity        0.00  40.00  m/s peak          |
|                                                    |
|                          [OK]        [Cancel]     |
+-------------------------------------------------+
```

## Other notable UI features

- This is the master list of every chart type's Y-axis range and unit, in one place — a useful cross-check against the chart-type dropdown list (`chart_dropdown.png`), though the dropdown lists more chart variants (e.g. per-PR and per-port charts) than this Limits table has distinct rows for (several chart types likely share a Limits row, e.g. all "Transfer function magnitude"-family charts using the "Transfer func. magn." row).
- Colour-swatch `[Change]` buttons open a standard colour picker (not shown open in this screenshot) — this tab governs the visual styling of the graph seen throughout the main window, including the 0 dB / -3 dB dashed reference lines visible in `view_3_ported.png`.
