# Box pane

Screenshot: `docs/winisd/view_2_box.png`
View: Main window, left nav "Box" tab selected (Project section)

Already noted at parity level in `INPUT_PARITY.md` ("Box pane — parity"). Layout only, below.

## Fields & controls visible

Same outer chrome as `view_1_driver_drivers_standard.png` (title bar, toolbar, cursor readout, Projects list, Signal Generator, Project nav list with **Box** now highlighted, Color button) — see that file for the shared chrome wireframe.

Bottom content panel (Box tab body):

- Grey section header "passive radiator" (lower-case, spans full width) — labels the enclosure-type currently configured for this project (this project uses a PR-loaded box).
- "Rear chamber" grey sub-header.
- `Volume` field, value "6.00" (shown in **blue** = Calculated), unit "l" (litres).
- `Fh` field, value "40.25" (greyed-out/disabled-looking box), unit "Hz".
- A small line-art box+driver icon to the right of the Volume/Fh fields (side elevation silhouette of the enclosure with the driver cutout).
- "Advanced->" link/button at the bottom-left of the panel (opens the Ql/Qa/Qp losses popup per `WINISD.md` §5 — not shown open in this screenshot).

## Wireframe

```
+---------------------------------------------------------------+
| [same title bar / toolbar / cursor readout as view_1]          |
+---------------------+-------------------------------------------+
| Projects              | Graph (SPL curve, same axes as view_1)   |
| Signal Generator       |                                           |
| Project                |                                           |
|  Driver                |                                           |
|  Box (selected)        |                                           |
|  Passive Radiator      |                                           |
|  Filters               |                                           |
|  Signal                |                                           |
|  Advanced              |                                           |
|  Project               |                                           |
| [Color]                |                                           |
+---------------------+-------------------------------------------+
| passive radiator                                                |
| ---- Rear chamber ----              [box+driver icon]           |
| Volume [6.00 blue] l                                            |
| Fh     [40.25 greyed] Hz                                        |
|                                                                   |
| Advanced->                                                       |
+---------------------------------------------------------------+
```

## Other notable UI features

- The "passive radiator" grey label at the top of the content panel is a **read-only enclosure-type indicator**, not a control — it reflects whichever loading type (sealed/ported/PR) the project is currently set to (set elsewhere, e.g. via the "Passive Radiator" nav item's own configuration).
- `Fh`'s box has a visually greyed/disabled appearance, consistent with it being a **derived/read-only output** (the sealed-box tuning frequency resulting from Volume + driver Vas), not a user-entered value.
- `Volume` shown in blue (Calculated state) rather than green (Entered) in this particular project.
