# Filters — Filter Editor: Lowpass (Subtype dropdown open)

Screenshot: `docs/winisd/view_4_filters_edit_lowpass.png`
View: Main window, "Filters" nav tab, "Filter Editor" popup open, `Filter type` = Lowpass, with the **Subtype dropdown expanded** showing its full option list

## Fields & controls visible

Background: same as other filter-editor screenshots.

Filter Editor popup:

- `Filter type` dropdown, value **"Lowpass"**.
- `Subtype` dropdown, **open/expanded**, showing 4 options in a listbox overlay:
  1. **Butterworth** (highlighted/selected, blue background)
  2. Linkwitz-Riley (4th order only)
  3. Bessel
  4. SOS, User specified fc and Q
- Behind the open dropdown listbox, partially obscured: `Order` field, `Q` field [0.707 visible at right], `Cutoff` field (value obscured by the dropdown list, "50.000" partially visible), unit "Hz".
- Bottom buttons `[+ Add]` `[Cancel]` (obscured behind the dropdown list in this screenshot, per the earlier highpass screenshot's layout).

## Wireframe

```
+---------------------------------------------------------------+
| [main window behind, Filters tab, graph + filter list]         |
|              +----------------------------+                    |
|              | Filter Editor      [_][□][X]|                   |
|              +----------------------------+                    |
|              | Filter type                 |                   |
|              | [Lowpass             v]     |                   |
|              | Subtype                     |                   |
|              | [Butterworth         v]     |                   |
|              | +--------------------------+|                   |
|              | | Butterworth (selected)   ||                   |
|              | | Linkwitz-Riley (4th ord.)||                   |
|              | | Bessel                   ||                   |
|              | | SOS, User specified fc,Q ||                   |
|              | +--------------------------+|                   |
|              +----------------------------+                    |
+---------------------------------------------------------------+
```

## Other notable UI features

- This is the definitive list of Lowpass/Highpass filter **subtypes**: Butterworth, Linkwitz-Riley (explicitly restricted to 4th order only per its own label), Bessel, and "SOS, User specified fc and Q" (a free-form biquad entry mode). `INPUT_PARITY.md` records OpenISD as having Butterworth + Linkwitz transform (a different, separate filter type) but not Bessel or Linkwitz-Riley subtypes for the Highpass/Lowpass filter types themselves.
- The dropdown is a standard combobox-with-listbox widget — selection highlight uses the same blue as elsewhere in the app (e.g. selected Projects-list rows).
