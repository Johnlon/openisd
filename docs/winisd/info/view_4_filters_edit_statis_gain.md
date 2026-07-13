# Filters — Filter Editor: Static gain

Screenshot: `docs/winisd/view_4_filters_edit_statis_gain.png`
View: Main window, "Filters" nav tab, "Filter Editor" popup open, `Filter type` = Static gain

## Fields & controls visible

Background: same as other filter-editor screenshots — Filters tab, SPL graph, existing filter row "Lowpass (Butterworth, n=2, fc=50.00 Hz)", Add/Delete/Modify buttons.

Filter Editor popup:

- `Filter type` dropdown, value **"Static gain"**.
- `Gain` field [0.000] dB.
- Bottom buttons: `[+ Add]`, `[Cancel]`.

Only one parameter field — the simplest of all 8 filter types (a flat broadband gain/attenuation, no frequency dependence).

## Wireframe

```
+---------------------------------------------------------------+
| [main window behind, Filters tab, graph + filter list]         |
|              +----------------------------+                    |
|              | Filter Editor      [_][□][X]|                   |
|              +----------------------------+                    |
|              | Filter type                 |                   |
|              | [Static gain         v]     |                   |
|              |                              |                   |
|              | Gain[0.000]dB               |                   |
|              |                              |                   |
|              |          [+ Add] [Cancel]   |                   |
|              +----------------------------+                    |
+---------------------------------------------------------------+
```

## Other notable UI features

- The filename has a typo ("statis_gain" vs "static_gain") — noted here since it affects the link target in `SCREENSHOTS_INDEX.md`.
- Completes the 8-type Filter Editor set: Allpass, DLP Raised Cosine, Highpass, Linkwitz transform, Lowpass, Parametric EQ, Peaking 2nd order highpass, Static gain.
