# Filters — Filter Editor: Parametric EQ

Screenshot: `docs/winisd/view_4_filters_edit_parametric_eq.png`
View: Main window, "Filters" nav tab, "Filter Editor" popup open, `Filter type` = Parametric EQ

## Fields & controls visible

Background: same as other filter-editor screenshots.

Filter Editor popup:

- `Filter type` dropdown, value **"Parametric EQ"**.
- `Center freq` field [30.000] Hz and `Gain` field [6.000] dB, same row.
- `Q` field [2.000].
- Bottom buttons: `[+ Add]`, `[Cancel]`.

## Wireframe

```
+---------------------------------------------------------------+
| [main window behind, Filters tab, graph + filter list]         |
|              +----------------------------+                    |
|              | Filter Editor      [_][□][X]|                   |
|              +----------------------------+                    |
|              | Filter type                 |                   |
|              | [Parametric EQ       v]     |                   |
|              |                              |                   |
|              | Center freq[30.000]Hz  Gain[6.000]dB            |
|              | Q[2.000]                     |                   |
|              |                              |                   |
|              |          [+ Add] [Cancel]   |                   |
|              +----------------------------+                    |
+---------------------------------------------------------------+
```

## Other notable UI features

- Field set (Center freq, Gain, Q) is the classic peaking-EQ parameter trio — compare to DLP Raised Cosine (`view_4_filters_edit_dlp_raised_cosine.md`), which uses Bandwidth-in-octaves instead of Q for otherwise the same Center-freq/Gain shape.
