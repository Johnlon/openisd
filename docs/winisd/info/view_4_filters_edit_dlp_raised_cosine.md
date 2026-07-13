# Filters — Filter Editor: DLP Raised Cosine

Screenshot: `docs/winisd/view_4_filters_edit_dlp_raised_cosine.png`
View: Main window, "Filters" nav tab, "Filter Editor" popup open, `Filter type` = DLP Raised Cosine

## Fields & controls visible

Background: same as `view_4_filters_edit_allpass.md` — Filters tab, SPL graph, one existing filter row "Lowpass (Butterworth, n=2, fc=50.00 Hz)", Add/Delete/Modify buttons.

Filter Editor popup:

- `Filter type` dropdown, value **"DLP Raised Cosine"**.
- `Center freq` field [100.000] Hz and `Gain` field [6.000] dB, same row.
- `Bandwidth` field [0.333] oct.
- Bottom buttons: `[+ Add]`, `[Cancel]`.

(No second stacked dialog or Snipping Tool toast in this screenshot, unlike the Allpass one.)

## Wireframe

```
+---------------------------------------------------------------+
| [main window behind, Filters tab, graph + filter list]         |
|              +----------------------------+                    |
|              | Filter Editor      [_][□][X]|                   |
|              +----------------------------+                    |
|              | Filter type                 |                   |
|              | [DLP Raised Cosine   v]     |                   |
|              |                              |                   |
|              | Center freq[100.000]Hz  Gain[6.000]dB           |
|              | Bandwidth[0.333]oct         |                   |
|              |                              |                   |
|              |          [+ Add] [Cancel]   |                   |
|              +----------------------------+                    |
+---------------------------------------------------------------+
```

## Other notable UI features

- Field set (Center freq, Gain, Bandwidth in octaves) is distinct from Parametric EQ's field set (Center freq, Gain, Q) — DLP Raised Cosine uses bandwidth-in-octaves instead of a Q factor. See `view_4_filters_edit_parametric_eq.md` for the comparison.
- "DLP" = delay/raised-cosine shelf-style filter per `INPUT_PARITY.md` ("DLP raised-cosine (delay)" row, marked ❌ for OpenISD).
