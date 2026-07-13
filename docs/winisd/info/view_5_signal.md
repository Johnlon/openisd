# Signal pane

Screenshot: `docs/winisd/view_5_signal.png`
View: Main window, left nav "Signal" tab selected (Project section)

## Fields & controls visible

Shared chrome (title bar, toolbar, cursor readout "38.01 Hz / -9.896 dB", Projects list "Epique15 - pr" selected, Signal Generator, Project nav with **Signal** highlighted, Color button).

Bottom content panel, two grey sub-headers side by side:

- **"Listening place"** (left):
  - `Distance` field [1.000] m.
  - `Angle` field [0.0000] rad.
- **"Signal source"** (right):
  - `System input power` field [140.0] W.
  - `Driver input voltage (each)` field [15.2] V.
  - `Series resistance` field [0.100] ohm.

## Wireframe

```
+---------------------+-------------------------------------------+
| [shared nav chrome, Signal selected] | Graph (SPL, same as view_1)|
+---------------------+-------------------------------------------+
| ---- Listening place ----   | -------- Signal source --------   |
| Distance [1.000] m           | System input power [140.0] W     |
| Angle    [0.0000] rad         | Driver input voltage (each)[15.2]V|
|                                | Series resistance [0.100] ohm    |
+---------------------------------------------------------------+
```

## Other notable UI features

- `System input power` and `Driver input voltage (each)` are presumably linked (P = V²/R at a given impedance) — both are shown as plain editable fields with no colour-coded provenance marker in this pane (that marker scheme is specific to the Driver editor dialog).
- `Series resistance` (0.100 ohm) models cabling/amplifier output resistance in the signal chain, separate from the driver's own `Re`.
