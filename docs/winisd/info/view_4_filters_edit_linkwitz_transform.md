# Filters — Filter Editor: Linkwitz transform

Screenshot: `docs/winisd/view_4_filters_edit_linkwitz_transform.png`
View: Main window, "Filters" nav tab, "Filter Editor" popup open, `Filter type` = Linkwitz transform

## Fields & controls visible

Background: same as other filter-editor screenshots.

Filter Editor popup:

- `Filter type` dropdown, value **"Linkwitz transform"**.
- Row 1: `f0` field [50.000] Hz, `fp` field [20.000] Hz.
- Row 2: `Q0` field [0.707], `Qp` field [0.707].
- Bottom buttons: `[+ Add]`, `[Cancel]`.

No Subtype dropdown (consistent with all non-highpass/lowpass filter types).

## Wireframe

```
+---------------------------------------------------------------+
| [main window behind, Filters tab, graph + filter list]         |
|              +----------------------------+                    |
|              | Filter Editor      [_][□][X]|                   |
|              +----------------------------+                    |
|              | Filter type                 |                   |
|              | [Linkwitz transform  v]     |                   |
|              |                              |                   |
|              | f0[50.000]Hz      fp[20.000]Hz                  |
|              | Q0[0.707]         Qp[0.707]                      |
|              |                              |                   |
|              |          [+ Add] [Cancel]   |                   |
|              +----------------------------+                    |
+---------------------------------------------------------------+
```

## Other notable UI features

- Field naming pattern (f0/Q0 = actual/original driver+box resonance, fp/Qp = target/desired resonance) matches the standard Linkwitz-transform equalizer topology: it re-shapes the natural rolloff (f0, Q0) into a different target rolloff (fp, Qp), typically used to extend low-frequency response of a sealed box.
