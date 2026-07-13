# SPL chart (Driver pane, chart-type = SPL)

Screenshot: `docs/winisd/chart_spl.png`
View: Main window, "Driver" nav tab, chart-type toolbar dropdown set to **"SPL"** — functionally identical panel content to `view_1_driver_drivers_standard.png` (same project, same Driver-tab fields), included here specifically to document the SPL chart in isolation.

## Fields & controls visible

Same as `view_1_driver_drivers_standard.md` in full (Brand/Model/Edit, Placement/Standard radio, Num. of drivers, Voice coil connection, Advanced options fields) — see that file for the complete field inventory; not repeated here.

Chart-specific details:

- Toolbar chart name reads "SPL"; cursor readout "38.01 Hz" / "-9.896 dB".
- Y axis: 42–102 dB in 2 dB steps (absolute SPL scale — distinct from the Transfer Function Magnitude chart's -28 to +4 dB relative scale, see `chart_transfer_function_magnitude.md`).
- X axis: log frequency 10–500 Hz.
- Single yellow trace: rises ~74 dB (10 Hz) to a shelf ~85-86 dB (20-30 Hz), then a step rise to ~102 dB peak near 45-50 Hz.

## Wireframe

Identical to `view_1_driver_drivers_standard.md`'s wireframe (same panel arrangement) — refer there.

## Other notable UI features

- A faint ghost-text overlay artifact ("impedance so this is derivable") is visible bled across the very top edge of this screenshot — an unrelated overlapping capture, not part of the WinISD UI. This is the same kind of bleed-through artifact seen at the top of `view_1_driver_drivers_standard.png` and the bottom of `edit_driver_pg4_dimensions.png` — flagged as a recurring but non-WinISD rendering artifact across several of these screenshots, not evidence of any in-app feature.
- This screenshot exists specifically to pin down the SPL chart's Y-axis absolute-dB scale (40-105 dB per the Options → Plot Window → Limits table, `options_plot_window.md`) as distinct from relative-dB chart types.
