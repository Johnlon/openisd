# Filters — Filter Editor: Allpass

Screenshot: `docs/winisd/view_4_filters_edit_allpass.png`
View: Main window, "Filters" nav tab, with the "Filter Editor" popup dialog open, `Filter type` = Allpass

## Fields & controls visible

- Background (behind the popup): main window on the Filters tab, graph showing an SPL curve with a small existing filter applied. Below the graph, the filters list panel shows one existing entry: checkbox-ticked row "Lowpass (Butterworth, n=2, fc=50.00 Hz)", with `[+ Add]`, `[Delete]`, `[Modify (pencil)]` buttons beneath the list.
- Foreground "Filter Editor" popup dialog (small, centered-right of screen):
  - Title bar "Filter Editor" with minimize/maximize/close.
  - `Filter type` label + dropdown, value **"Allpass"**.
  - `Order` field [1.000] and `Q` field [0.707], same row.
  - `Delay time` field [0.001] s.
  - Bottom buttons: `[+ Add]`, `[Cancel]`.
- A **second, partially-visible "Filter Editor" dialog** is stacked behind/to the right of the first (only its left edge visible) — same field layout (Filter type=Allpass, Order=1.000, Delay time=0.001) suggesting two Filter Editor windows are open simultaneously, or this is a rendering artifact of dragging a duplicate window.
- Further right, a Windows "Snipping Tool" notification toast is visible ("Screenshot copied to clipboard / Automatically saved to scree[n]... Mark-up an[d]...") — this is OS chrome from the screenshot-capture process itself, not part of WinISD.

## Wireframe

```
+---------------------------------------------------------------+
| [main window behind, Filters tab, graph + filter list]         |
|                                                                  |
|              +----------------------------+  +---------------+ |
|              | Filter Editor      [_][□][X]|  | Filter Editor |·|
|              +----------------------------+  | (Snipping Tool| |
|              | Filter type                 |  |  toast overlaps| |
|              | [Allpass          v]        |  |  here)         |
|              |                              |  +---------------+ |
|              | Order[1.000]      Q[0.707]  |                    |
|              | Delay time[0.001]s          |                    |
|              |                              |                    |
|              |          [+ Add] [Cancel]   |                    |
|              +----------------------------+                     |
+---------------------------------------------------------------+
```

## Other notable UI features

- `Order`, `Q`, and `Delay time` are the full parameter set for an Allpass filter — no additional fields beyond these three plus the type dropdown.
- Existing filter list entry format confirmed: `"<Type> (<Subtype>, n=<order>, fc=<freq> Hz)"` e.g. "Lowpass (Butterworth, n=2, fc=50.00 Hz)" — a single-line human-readable summary per filter row, with its own enable/disable checkbox.
- The Snipping Tool toast is incidental OS UI captured accidentally in this screenshot — not a WinISD feature.
