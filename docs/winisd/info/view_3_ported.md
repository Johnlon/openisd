# Vents (ported box) pane — multi-project overlay

Screenshot: `docs/winisd/view_3_ported.png`
View: Main window, left nav "Vents" tab selected (Project section), two projects loaded and both checked/overlaid on one graph

This screenshot is the primary evidence cited in `FEATURE_COMPARISON.md` (§"Merged from WINISD_OPENISD_COMPARISON.md") (correction: WinISD _does_ overlay multiple designs) — see that file for the significance. Layout only, below.

## Fields & controls visible

- Toolbar: chart-type dropdown shows **"Transfer function magnitude"** (not SPL) as the active chart. Cursor readout top-right: "11.35 Hz" / "-35.541 dB".
- Projects list: **two rows, both checked** — "Epique15 - pr" and "Epique15-ported" (the second one is selected/highlighted blue).
- Project nav list: Driver, Box, **Vents** (highlighted/selected — note: this project's box type is ported, so the nav item reads "Vents" instead of "Passive Radiator"), Filters, Signal, Advanced, Project.
- Graph: two overlaid traces — a **green** trace (steep rise from ~-28 dB at ~13 Hz up to 0 dB by ~40 Hz, flat at 0 dB thereafter — the sealed/PR "Epique15-pr" transfer function) and a **yellow** trace (rises more slowly, peaks ~-6 dB near 90 Hz with a dip and second bump ~-8 dB near 100 Hz, then rolls off to ~-28 dB by 500 Hz — the ported "Epique15-ported" project). Two horizontal dashed reference lines at 0 dB and -3 dB. Y axis range -28 to +4 dB (this is the Transfer Function Magnitude chart's relative-dB scale, not the SPL chart's absolute scale).
- Bottom content panel, "Rear chamber" grey header, then **"Vents"** sub-section:
  - `Number` dropdown [1], `Shape` — a radio/round-shape icon selector (circle icon shown, implying round vent cross-section is selected).
  - `Vent diameter` dropdown-style field [10.20] cm.
  - `Vent length` field [1.978] m (greyed-out — derived/read-only).
  - `End Correction` dropdown [0.732].
  - `Cross area` field [0.0082] m^2 (greyed-out — derived).
  - `1st port resonance` field [86.87] Hz (greyed-out — derived).

See `WINISD.md` article reference `portterminology.html` (end-correction values 0.613/0.731/0.849) — 0.732 here is close to the one-flanged+one-free value (0.731), consistent with a port flanged on the inside baffle face only.

## Wireframe

```
+---------------------+-------------------------------------------+
| Projects              | Graph: Transfer function magnitude        |
| [x] Epique15 - pr     |   4 ... 0(--- dashed) -3(--- dashed) ...-28|
| [x] Epique15-ported   |   green trace -> flat 0dB by 40Hz         |
|   (selected)          |   yellow trace -> peaks ~-6dB near 90Hz   |
| Signal Generator       |   10  20  50  100  200  500              |
| Project                |                                           |
|  Driver                |                                           |
|  Box                   |                                           |
|  Vents (selected)      |                                           |
|  Filters               |                                           |
|  Signal                |                                           |
|  Advanced              |                                           |
|  Project               |                                           |
| [Color]                |                                           |
+---------------------+-------------------------------------------+
| Rear chamber                                                    |
| ---- Vents ----                                                 |
| Number[1 v]  Shape:(o round)                                    |
| Vent diameter [10.20 v] cm      End Correction [0.732 v]        |
| Vent length [1.978 greyed] m    Cross area [0.0082 greyed] m^2  |
|                                 1st port resonance [86.87 greyed]Hz|
+---------------------------------------------------------------+
```

## Other notable UI features

- **Confirms WinISD supports multi-project overlay**: two checkboxes ticked in the Projects list simultaneously renders both projects' curves on one graph in different colours (green/yellow), each project keeping its own assigned "Color" button colour.
- The left-nav label for the enclosure-tuning tab is **context-sensitive**: "Passive Radiator" for a PR-loaded project (`view_3_passive_radiator.png`), "Vents" for a ported project (this screenshot) — same tab position, different label/content depending on box type.
- `Vent length`, `Cross area`, and `1st port resonance` are greyed-out derived outputs; only `Number`, `Vent diameter`, `Shape`, and `End Correction` are user-editable inputs.
