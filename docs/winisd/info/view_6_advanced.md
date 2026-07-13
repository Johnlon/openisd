# Advanced pane

Screenshot: `docs/winisd/view_6_advanced.png`
View: Main window, left nav "Advanced" tab selected (Project section)

## Fields & controls visible

Shared chrome (title bar, toolbar, cursor readout, Projects list, Signal Generator, Project nav with **Advanced** highlighted, Color button).

Bottom content panel:

- `Temperature` field [293.15] K, with a "--->" arrow leading down to a derived readout `Sound velocity` [343.68] m/s.
- `Relative humidity` field [30.0000] %.
- `Air pressure` field [101325.0] Pa, with a derived readout `Air density` [1.20095] ka/m^3 (unit label as printed reads "ka/m^3", almost certainly a typo/rendering of "kg/m^3").
- Right-hand checkbox column (all unchecked in this screenshot):
  - `Simulate voice coil inductance`
  - `Force flat response`
  - `Use "transmission line"-model for port simulation`
  - `Rg is at driver side`
  - `SPL graph is Xmax limited`

## Wireframe

```
+---------------------+-------------------------------------------+
| [shared nav chrome, Advanced selected] | Graph (SPL)               |
+---------------------+-------------------------------------------+
| Temperature[293.15]K   Relative humidity[30.0000]%  Air pressure[101325.0]Pa |
|  --->                                                              |
| Sound velocity[343.68]m/s      Air density[1.20095]ka/m^3          |
|                                                                     |
|                          [ ] Simulate voice coil inductance         |
|                          [ ] Force flat response                    |
|                          [ ] Use "transmission line"-model for port |
|                          [ ] Rg is at driver side                    |
|                          [ ] SPL graph is Xmax limited               |
+---------------------------------------------------------------+
```

## Other notable UI features

- `Sound velocity` and `Air density` are **derived readouts** from Temperature/Relative humidity/Air pressure (same values duplicated in `edit_driver_pg3_advanced_parameters.png`'s Environment parameters section: c=343.68 m/s, roo=1.20095 kg/m³ — confirms these are the same global environment constants surfaced in two places).
- These 5 checkboxes are simulation-fidelity toggles that gate optional model complexity (VC inductance, forced-flat normalisation, transmission-line venting, generator-resistance placement, Xmax-limited SPL clipping) — all off by default.
- This is one of two "Options"-style panels for global project-level environment settings; compare `options_general.png` (app-level Options dialog) which has the _same_ Temperature/Air pressure/Relative humidity/Sound velocity fields at the application-default level, separate from this per-project Advanced pane.
