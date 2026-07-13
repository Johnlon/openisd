# Passive Radiator pane

Screenshot: `docs/winisd/view_3_passive_radiator.png`
View: Main window, left nav "Passive Radiator" tab selected (Project section)

Already documented field-by-field in `INPUT_PARITY.md` ("Passive Radiator pane — parity") and `WINISD.md` §2 (PR parameter entry/derivation). Layout only, below.

## Fields & controls visible

Shared chrome (title bar, toolbar, cursor readout "38.01 Hz / -9.896 dB", Projects list "Epique15 - pr" selected, Signal Generator, Project nav with **Passive Radiator** highlighted, Color button) — see `view_2_box.md` for the shared-chrome wireframe.

Bottom content panel, two grey sub-headers side by side:

- **"Passive radiator parameters"** (left ~55% of width):
  - Row 1: `Vas` [4.80] l, `Qms` [3.300].
  - Row 2: `Fs` [30.00] Hz, `Sd` [95.0] cm^2.
  - Row 3: `Xmax` [19000.0] mm (note: this value is implausibly large for a real driver — likely a placeholder/default in this sample project, not a realistic PR spec).
- **"User options"** (right ~45% of width):
  - `Num. of PRs:` [1].
  - `Added mass to cone:` [0.0] g (unit shown as lowercase "g", grams).
  - `Fs (with added mass):` [30.00] Hz (read-only-looking, derived output).

## Wireframe

```
+---------------------+-------------------------------------------+
| [shared nav chrome]  | Graph                                     |
|  Passive Radiator     |                                           |
|  (selected)           |                                           |
+---------------------+-------------------------------------------+
| -- Passive radiator parameters --  | -------- User options ------ |
| Vas[4.80]l      Qms[3.300]         | Num. of PRs: [1]              |
| Fs[30.00]Hz     Sd[95.0]cm^2        | Added mass to cone: [0.0]g    |
| Xmax[19000.0]mm                     | Fs (with added mass): [30.00]Hz |
+---------------------------------------------------------------+
```

## Other notable UI features

- Layout mirrors the two-column "parameters | options" split pattern also seen on `view_3_ported.png` (Vents pane) and `view_2_box.md` — a recurring WinISD convention of primary specs on the left, count/derived-output fields on the right.
- `Fs (with added mass)` sits in the "User options" column even though it is a derived output, not a user option — likely grouped there because it responds live as `Added mass to cone` and `Num. of PRs` are edited.
