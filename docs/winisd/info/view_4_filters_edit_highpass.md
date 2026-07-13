# Filters — Filter Editor: Highpass

Screenshot: `docs/winisd/view_4_filters_edit_highpass.png`
View: Main window, "Filters" nav tab, "Filter Editor" popup open, `Filter type` = Highpass

## Fields & controls visible

Background: same as other filter-editor screenshots — Filters tab, SPL graph, existing filter row "Lowpass (Butterworth, n=2, fc=50.00 Hz)", Add/Delete/Modify buttons.

Filter Editor popup:

- `Filter type` dropdown, value **"Highpass"**.
- `Subtype` dropdown, value **"Butterworth"** (a second dropdown that only highpass/lowpass filter types expose — see `view_4_filters_edit_lowpass.md` for the full option list revealed when this dropdown is opened: Butterworth, Linkwitz-Riley (4th order only), Bessel, SOS User specified fc and Q).
- `Order` field [2.000] and `Q` field [0.707], same row.
- `Cutoff` field [20.000] Hz.
- Bottom buttons: `[+ Add]`, `[Cancel]`.

## Wireframe

```
+---------------------------------------------------------------+
| [main window behind, Filters tab, graph + filter list]         |
|              +----------------------------+                    |
|              | Filter Editor      [_][□][X]|                   |
|              +----------------------------+                    |
|              | Filter type                 |                   |
|              | [Highpass            v]     |                   |
|              | Subtype                     |                   |
|              | [Butterworth         v]     |                   |
|              |                              |                   |
|              | Order[2.000]      Q[0.707]  |                   |
|              | Cutoff[20.000]Hz            |                   |
|              |                              |                   |
|              |          [+ Add] [Cancel]   |                   |
|              +----------------------------+                    |
+---------------------------------------------------------------+
```

## Other notable UI features

- Highpass/Lowpass are the only two filter types with a **Subtype** sub-dropdown (Butterworth/Linkwitz-Riley/Bessel/SOS) — all other filter types (Allpass, DLP Raised Cosine, Linkwitz transform, Parametric EQ, Peaking 2nd order highpass, Static gain) go straight from `Filter type` to their parameter fields with no Subtype selector.
- `Order` and `Q` are both exposed even though Butterworth order/Q are mathematically linked for a given filter order — user can override Q independent of the Butterworth-standard 0.707, per the SOS "User specified fc and Q" subtype option.
