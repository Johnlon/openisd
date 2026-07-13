# Filters — Filter Editor: Peaking 2nd order highpass

Screenshot: `docs/winisd/view_4_filters_edit_peaking_2nd_order_highpass.png`
View: Main window, "Filters" nav tab, "Filter Editor" popup open, `Filter type` = Peaking 2nd order highpass

## Fields & controls visible

Background: same as other filter-editor screenshots.

Filter Editor popup:

- `Filter type` dropdown, value **"Peaking 2nd order highpass"**.
- `Peak mag` field [6.000] dB.
- `Peak freq` field [20.000] Hz.
- Bottom buttons: `[+ Add]`, `[Cancel]`.

Only two parameter fields — the simplest field set of all 8 filter types.

## Wireframe

```
+---------------------------------------------------------------+
| [main window behind, Filters tab, graph + filter list]         |
|              +----------------------------+                    |
|              | Filter Editor      [_][□][X]|                   |
|              +----------------------------+                    |
|              | Filter type                 |                   |
|              | [Peaking 2nd order   v]     |                   |
|              | [highpass]                  |                   |
|              |                              |                   |
|              | Peak mag[6.000]dB           |                   |
|              | Peak freq[20.000]Hz         |                   |
|              |                              |                   |
|              |          [+ Add] [Cancel]   |                   |
|              +----------------------------+                    |
+---------------------------------------------------------------+
```

## Other notable UI features

- No Q/Order/Subtype field at all — this filter type is defined purely by a peak magnitude and peak frequency, implying a fixed/implicit Q (a 2nd-order resonant peaking highpass response, distinct from the plain "Highpass" filter type which exposes Order/Q/Cutoff/Subtype).
