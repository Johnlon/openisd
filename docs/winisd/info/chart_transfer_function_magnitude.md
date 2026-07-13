# Transfer function magnitude chart (Driver pane)

Screenshot: `docs/winisd/chart_transfer_function_magnitude.png`
View: Main window, "Driver" nav tab, chart-type toolbar dropdown set to **"Transfer function magnitude"**

## Fields & controls visible

Same bottom-panel fields as `view_1_driver_drivers_standard.md` (Brand/Model/Edit, Placement/Standard, Num. of drivers, Voice coil connection, Advanced options) — not repeated here.

Chart-specific details:

- Toolbar chart name reads "Transfer function magnitude"; cursor readout "38.01 Hz" / "-9.896 dB".
- Y axis: **-28 to +4 dB** in 1 dB steps — a relative/normalised dB scale, distinct from the SPL chart's 42-102 dB absolute scale (`chart_spl.md`). Matches the "Transfer func. magn." row in `options_plot_window.md`'s Limits table (Start -30, End 6).
- Two horizontal dashed reference lines at **0 dB** and **-3 dB** (the standard "system is at nominal / -3dB rolloff point" markers).
- A solid vertical + solid horizontal crosshair line at roughly (38 Hz, -10 dB) marking the current cursor position (matches the toolbar readout "38.01 Hz / -9.896 dB").
- X axis: log frequency 10–500 Hz.
- Single yellow trace: rises steeply from off-chart-bottom near 13 Hz, crosses -10 dB around 38 Hz, crosses -3 dB around 45 Hz, reaches 0 dB by ~90 Hz, flat at 0 dB from ~200-500 Hz.

## Wireframe

```
+---------------------------------------------------------------+
| [toolbar] Transfer function magnitude          38.01 Hz         |
|                                                 -9.896 dB        |
+---------------------+-------------------------------------------+
| Projects / nav (same as view_1) | Graph:                          |
|                                    4                              |
|                                    0 - - - - - - - - - - - (dashed)|
|                                   -3 - - - - - - - - - - - (dashed)|
|                                  -10 ----+---(crosshair)----------|
|                                       (yellow curve rising)       |
|                                  -28                              |
|                                    10  20  50  100  200  500      |
+---------------------+-------------------------------------------+
| [Driver tab fields, same as view_1_driver_drivers_standard]     |
+---------------------------------------------------------------+
```

## Other notable UI features

- The **solid crosshair lines** (as opposed to the dashed 0 dB/-3 dB reference lines) are a live cursor-position indicator tied to the toolbar's numeric readout — this is the general mechanism by which the "38.01 Hz / -9.896 dB" readout is produced on every chart in the app (mouse hover position on the plotted curve).
- 0 dB and -3 dB dashed reference lines are specific to the Transfer Function Magnitude chart type (per its own Limits row) — not present on the SPL chart (`chart_spl.png`), which has no such fixed reference lines.
