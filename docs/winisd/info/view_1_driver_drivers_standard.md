# Driver pane — Standard placement

Screenshot: `docs/winisd/view_1_driver_drivers_standard.png`
View: Main window, left nav "Driver" tab selected (Project section), "Standard" placement mode

## Fields & controls visible

- Title bar: "WinISD 0.7.0.950" with app icon, minimize/maximize/close (top-right).
- Toolbar (below title bar): folder-open dropdown, new-file, save, save-as (pencil icon), save-all icon, driver/basket icon (speaker), wrench (tools/options), info-circle with dropdown caret, chart-icon + current chart name "SPL" dropdown.
- Toolbar far-right: cursor readout "38.01 Hz" / "-9.896 dB" (two stacked lines).
- Left column "Projects" panel: checkbox list of open projects — one row "Epique15 - pr" highlighted blue/selected, checkbox ticked.
- Below Projects: "Signal Generator" section — "Generate" checkbox (unchecked), frequency field "13.20" + "Hz" unit label.
- Below that: "Project" section header, then a vertical tab list: Driver (selected/highlighted), Box, Passive Radiator, Filters, Signal, Advanced, Project.
- Bottom-left: yellow/olive "Color" button (sets the project's plotted curve colour).
- Main graph area (top-right, labelled "Graph"): SPL curve, Y axis 42–102 dB (2 dB steps), X axis log 10–500 Hz (gridlines at 10/20/50/100/200/500). Yellow trace rises from ~74 dB at 10 Hz to a shelf ~85 dB at 20-30 Hz, a step up around 30-40 Hz to ~102 dB peak near 50 Hz.
- Bottom panel (Driver tab content): "Brand" text field ("Dayton Audio"), "Model" text field ("E150HE-44"), "Edit" button (pencil icon) beside Model.
- "Placement" section header (grey bar) and "Advanced options" section header (grey bar), side by side.
- Left sub-column: "Num. of drivers" dropdown ("1"), radio buttons "Standard" (selected) / "Iso-Barik" (unselected), "Voice coil connection" dropdown ("Parallel"). A small basket-wiring diagram icon sits to the right of the Num. of drivers dropdown (single driver, standard wiring symbol).
- Right sub-column: "Voice coil temp rise" field ("0.00" K), "Voice coil resistance TC" field ("3.9000" 1000/K), "Added mass to cone" field ("0.00000" kg).

See `WINISD.md` §13.1 for field meaning (Placement/Standard vs Iso-Barik is BACKLOG P2 for OpenISD per `INPUT_PARITY.md`).

## Wireframe

```
+---------------------------------------------------------------+
| [icon] WinISD 0.7.0.950                      [_][□][X]        |
+---------------------------------------------------------------+
| [open v][new][save][save-as][save-all] [spk][wrench][i v] [chart SPL]   38.01 Hz |
|                                                                  -9.896 dB |
+---------------------+-------------------------------------------+
| Projects             | Graph                                     |
| [x] Epique15 - pr    |  102 ...(SPL curve, log-x 10-500Hz)... 42 |
|                       |  10   20   50   100   200   500          |
|                       |                                           |
| Signal Generator      |                                           |
| [ ] Generate  13.20Hz |                                           |
|                       |                                           |
| Project               |                                           |
|  Driver (selected)    |                                           |
|  Box                  |                                           |
|  Passive Radiator     |                                           |
|  Filters              |                                           |
|  Signal               |                                           |
|  Advanced             |                                           |
|  Project              |                                           |
| [Color]               |                                           |
+---------------------+-------------------------------------------+
| Brand [Dayton Audio]        Model [E150HE-44]      [Edit]        |
| ---- Placement ----          ---- Advanced options ----          |
| Num. of drivers [1 v]  [icon] Voice coil temp rise [0.00] K       |
| (o) Standard                 Voice coil resistance TC [3.9000]   |
| ( ) Iso-Barik                Added mass to cone [0.00000] kg      |
| Voice coil connection [Parallel v]                                |
+---------------------------------------------------------------+
```

## Other notable UI features

- Selected nav items (Driver in the Project list, Epique15-pr in Projects list) are highlighted with a light-blue background.
- The wiring-diagram icon changes shape between Standard and Iso-Barik modes (compare `view_1_driver_drivers_iso-barik.png` — same icon area shows a criss-cross "×" symbol for Iso-Barik).
- A faint ghost/overlay text artifact is visible bleeding across the very top edge of this particular screenshot (unrelated overlapping capture, not part of the WinISD UI — ignore).
