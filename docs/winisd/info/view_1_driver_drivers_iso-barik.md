# Driver pane — Iso-Barik placement

Screenshot: `docs/winisd/view_1_driver_drivers_iso-barik.png`
View: Main window, left nav "Driver" tab, "Iso-Barik" placement mode selected

## Fields & controls visible

Same layout as `view_1_driver_drivers_standard.png` (see that file for the full field inventory) with these differences:

- Projects list shows a differently-named project row: "sample_project_Epique15 -" (truncated, selected/highlighted).
- Radio button state: "Standard" unselected, **"Iso-Barik" selected**.
- "Num. of drivers" dropdown shows "1" with unit suffix "pair(s)" appended after the dropdown (Standard mode has no "pair(s)" suffix visible).
- The wiring-diagram icon (right of Num. of drivers) shows a **criss-cross "×" wiring symbol** between two opposed driver baskets — visually distinct from the single straight-line basket icon in Standard mode.
- Cursor readout top-right: "16.31 Hz" / "79.276 dB" (different cursor position than the Standard screenshot).
- Graph curve shape differs: rises to a peak ~99 dB near 50 Hz, dips slightly ~95 dB near 70-80 Hz, small secondary peak ~98 dB near 100 Hz, then rolls off steadily to ~68 dB at 500 Hz — a fuller/broader curve than the Standard-mode screenshot's simple rising ramp.

See `WINISD.md` §13.1 and `INPUT_PARITY.md` ("Iso-Barik" row, marked ❌ BACKLOG P2 for OpenISD).

## Wireframe

Identical panel arrangement to `view_1_driver_drivers_standard.png` — see that file's wireframe. Only the Placement radio selection, the wiring icon, and the graph curve differ.

## Other notable UI features

- Iso-Barik is a driver-pair loading configuration (two drivers mounted magnet-to-magnet in a shared sub-enclosure) — the "pair(s)" unit suffix on Num. of drivers confirms drivers are counted in pairs in this mode.
