# Driver editor — General tab

Screenshot: `docs/winisd/edit_driver_pg1_text.png`
View: "Driver editor" modal dialog, "General" tab (first of 4 tabs)

## Fields & controls visible

- Dialog title bar: driver/basket icon, "Driver editor" title, minimize/maximize(disabled, greyed square)/close (X) buttons top-right.
- Tab strip (top): **General** (active/boxed), Parameters, Advanced parameters, Dimensions.
- "Manufacturer" label + full-width text input (empty).
- "Brand" label + text input (empty, left half width) and "Model" label + text input (empty, right half width) side by side.
- "Data provided by" label + text input, value "johnl" — and to its right "Date added" label + date input, value "01/07/2026".
- "Comment" label + large multi-line text area (empty), spans full dialog width, several lines tall.
- Bottom-left: colour legend — green swatch "Entered", blue swatch "Calculated", black swatch "Not available".
- Below legend: checkbox "Auto calculate unknowns" (checked).
- Bottom-right button row: "Save" (disk icon), "Load" (folder/load icon), "Clear" (blank square icon), "Cancel" (red X icon).

See `WINISD.md` §13 (Screen 1: General Tab) and §13.1 for field meaning.

## Wireframe

```
+-------------------------------------------------------------+
| [icon] Driver editor                        [-][□][X]       |
+-------------------------------------------------------------+
| [General] Parameters  Advanced parameters  Dimensions        |
+-------------------------------------------------------------+
| Manufacturer                                                 |
| [_____________________________________________________]     |
|                                                                |
| Brand                    Model                                |
| [___________]            [_________________________]  [Edit]|
|                                                                |
| Data provided by                     Date added               |
| [johnl_______________]               [01/07/2026]             |
|                                                                |
| Comment                                                       |
| [                                                        ]    |
| [                                                        ]    |
| [                                                        ]    |
|                                                                |
+-------------------------------------------------------------+
| [green]Entered [blue]Calculated [black]Not available          |
| [x] Auto calculate unknowns    [Save][Load][Clear][Cancel]    |
+-------------------------------------------------------------+
```

## Other notable UI features

- The ParState colour legend (green/blue/black swatches) and "Auto calculate unknowns" checkbox + Save/Load/Clear/Cancel button row are fixed UI chrome present at the bottom of **all four** Driver editor tabs (Parameters, Advanced parameters, Dimensions screenshots all repeat this same footer).
- This tab has no coloured (green/blue/black) fields itself — those markers apply to the numeric fields on the Parameters/Advanced/Dimensions tabs, not General's text metadata.
