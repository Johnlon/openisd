# Options dialog — General tab

Screenshot: `docs/winisd/options_general.png`
View: "Options" modal dialog (app-level preferences, opened via the wrench/tools toolbar icon), "General" tab

## Fields & controls visible

- Dialog title bar: pencil/wrench icon, "Options" title, minimize/maximize/close.
- Tab strip: **General** (active), Plot Window.
- `Username` label + text input, value "johnl".
- **"Environment"** grey-bordered group box:
  - `Temperature` field [293.15] K.
  - `Air pressure` field [101325.0] Pa.
  - `Relative humidity` field [30.0000] %.
  - `Sound velocity` readout [343.68] m/s (derived, not user-editable — no unit-cycle box styling difference visible but positioned as an output alongside the 3 inputs).
- **"Units"** grey-bordered group box:
  - A single wide button: `Reset to Metric (l, mm, …)`.
- Bottom-right: `[OK]` (green check icon), `[Cancel]` (red X icon).
- Large empty whitespace area below the Units box (dialog has more vertical space than content on this tab).

## Wireframe

```
+-------------------------------------------------+
| [icon] Options                    [_][□][X]      |
+-------------------------------------------------+
| [General] Plot Window                             |
+-------------------------------------------------+
| Username                                          |
| [johnl_________________________________]         |
|                                                    |
| +-- Environment ------------------------------+   |
| | Temperature[293.15]K   Air pressure[101325.0]Pa|  |
| | Relative humidity[30.0000]%  Sound velocity[343.68]m/s|
| +----------------------------------------------+  |
|                                                    |
| +-- Units -------------------------------------+  |
| | [   Reset to Metric (l, mm, ...)    ]         |  |
| +----------------------------------------------+  |
|                                                    |
|                          [OK]        [Cancel]     |
+-------------------------------------------------+
```

## Other notable UI features

- This dialog sets the **application-default** environment constants (Temperature/Air pressure/Relative humidity), which appear to seed the per-project "Advanced" pane values (`view_6_advanced.png` shows identical values: 293.15 K / 101325.0 Pa / 30.0000% / 343.68 m/s) — i.e. new projects likely inherit these as their starting Advanced-pane defaults, though this inheritance is inferred from matching values, not directly observed/tested. ⚠ unverified.
- `Reset to Metric (l, mm, …)` is a one-click global unit-system reset button, distinct from the per-field unit-cycling behaviour described in `WINISD.md` §14 (clicking a field's unit label cycles that one field's unit) — this button resets _all_ fields app-wide back to metric in one action.
