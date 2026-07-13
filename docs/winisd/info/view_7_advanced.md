# Project pane (filename says "advanced" but shows Project tab)

Screenshot: `docs/winisd/view_7_advanced.png`
View: Main window, left nav **"Project"** tab selected (Project section) — note: despite the filename, the highlighted/active nav item and content shown is "Project", not "Advanced".

## Fields & controls visible

Shared chrome (title bar, toolbar, cursor readout "38.01 Hz / -9.896 dB", Projects list "Epique15 - pr" selected, Signal Generator, Project nav with **Project** highlighted, Color button).

Bottom content panel:

- `Creator` field, value "johnl".
- `Created` field, value "21/06/2026".
- `Modified` field, value "22/06/2026".
- `Description` label + large multi-line text area (empty).

## Wireframe

```
+---------------------+-------------------------------------------+
| [shared nav chrome, Project selected] | Graph (SPL)                |
+---------------------+-------------------------------------------+
| Creator  [johnl]                                                 |
| Created  [21/06/2026]                                            |
| Modified [22/06/2026]                                            |
| Description                                                      |
| [                                                            ]   |
| [                                                            ]   |
+---------------------------------------------------------------+
```

## Other notable UI features

- This project-level "Creator/Created/Modified/Description" metadata block mirrors the Driver editor's General tab "Data provided by / Date added / Comment" pattern (`edit_driver_pg1_text.png`) — same metadata convention (who + when + free-text note) applied at both the project level and the individual-driver level.
- Date format is DD/MM/2026 in both places, consistent with the app's locale-driven date display.
- Flagging the filename/content mismatch here rather than silently renaming the file, since the screenshot set is fixed input — `SCREENSHOTS_INDEX.md` will note this pane actually shows the "Project" tab.
