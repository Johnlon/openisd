# Driver editor — Dimensions tab

Screenshot: `docs/winisd/edit_driver_pg4_dimensions.png`
View: "Driver editor" modal dialog, "Dimensions" tab (4th/last of 4)

Already documented field-by-field in `INPUT_PARITY.md` ("Driver editor → Dimensions tab") and `WINISD.md` §13 (Screen 4). Layout only, below.

## Fields & controls visible

Tab strip: General, Parameters, Advanced parameters, **Dimensions** (active).

Left column — grey "Dimensions" section header, then a vertical stack of 8 labelled fields: `Thick` [0.00] in, `Depth` [0.000] m, `Magnet Depth` [0.000] m, `Magnet` [0.000] m, `Basket` [0.000] m, `Outer` [0.000] m, `VCd` [0.000] m, `Dvol` [0.0] in^3.

Right side (roughly 55% of dialog width): a labelled line-art diagram of a driver cross-section (cone, basket, magnet) with dimension callouts and arrows: `Thick` (top, horizontal double-arrow at the frame lip), `Basket` (far-left vertical double-arrow, full basket diameter), `Magnet` (vertical double-arrow spanning the magnet height), `MagDpt` (horizontal double-arrow under the magnet, magnet depth), `Outer` (far-right vertical double-arrow, outer frame diameter), `Depth` (bottom horizontal double-arrow, full driver depth).

## Wireframe

```
+-------------------------------------------------------------+
| General Parameters Advanced parameters [Dimensions]           |
+-------------------------------------------------------------+
|                                              Thick            |
|  --- Dimensions ---            |<->|      /|                 |
|  Thick   [__] in                          / |                 |
|  Depth   [__] m         Basket  Magnet   /  | Outer            |
|  Magnet Depth [__] m      |      |      /   |                 |
|  Magnet  [__] m           |  [driver cross-section outline] | |
|  Basket  [__] m           |      |      \   |                 |
|  Outer   [__] m                           \  |                 |
|  VCd     [__] m                            \ |                 |
|  Dvol    [__] in^3            MagDpt        \|                 |
|                                    Depth                       |
+-------------------------------------------------------------+
| [legend] [x]Auto calc unknowns   [Save][Load][Clear][Cancel] |
+-------------------------------------------------------------+
```

## Other notable UI features

- The diagram is a static reference illustration (not interactive/editable) — it exists purely to disambiguate which physical measurement each field name refers to.
- Diagram callout labels use abbreviated names (`MagDpt`) that differ slightly from the field-list label (`Magnet Depth`) — both refer to the same field.
- A faint ghost-text overlay artifact ("number. The store t...") is visible bled across the bottom edge of this screenshot — unrelated capture bleed-through, not part of the WinISD UI.
- `driver_basket.png` is a tight crop of just this diagram's basket/magnet/cone line-art (no field labels visible in the crop) — see `driver_basket.md`.
