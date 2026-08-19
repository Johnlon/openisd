# BUG — driver-editor Parameters/Advanced fields do not share a column edge

# Status
FIXED (re-verified 2026-08-19 — driver-editor-layout.browser.spec.ts full suite: 26/26 pass, this bug's own named test included)

## Symptom

The Parameters and Advanced parameters tabs read as scattered boxes rather than a table. Every
row starts its input at whatever x its own label happens to end at, so nothing lines up down the
panel. WinISD's own editor
(`docs/winisd/edit_driver_pg2_parameters.png`, `edit_driver_pg3_advanced_parameters.png`) right-
aligns each label against a shared input edge, giving four clean columns.

Measured input x per column, Parameters tab
(`packages/ui/test/ui/driver-editor-layout.browser.spec.ts`):

```
column 1: Qes@301, Vas@299
column 1: Mms@305, BL@293, fLe@297
column 2: Cms@472, Dd@463, KLe@468
column 3: Rms@637, Le@628
column 1: Xmax@309, Xlim@302
column 2: Hc@467, Pe@466
column 1: no@293, Voicecoils@333      <- 40px of drift in one column
column 2: Znom@472, Connection@502
```

## Cause

`.de-fld` is declared as a SUBGRID that spans three of its parent's tracks — the mechanism that
makes every row share one label/input/unit column:

```css
.de-fld { display: grid !important; grid-template-columns: subgrid !important; grid-column: span 3 !important; }
```

and a later rule cancels both halves of it:

```css
.de-cols > .de-fld,
.de-cols > * > .de-fld {
  grid-template-columns: max-content max-content max-content !important;
  grid-column: auto !important;
}
```

With `grid-column: auto` each field occupies ONE parent track, and with its own `max-content`
tracks it lays its label, input and unit out inside that track independently of every other
field. The input's x is therefore `track left + that field's own label width` — so "no" (293)
and "Voicecoils" (333) sit 40px apart in the same column, because their labels differ by 40px.

The parent `.de-cols` compounds it: `repeat(3, minmax(0, max-content)) 1fr` is four tracks, one
whole field per track, so there are no per-part tracks for a subgrid to share even if the
override were removed.

## Fix

Give `.de-cols` the tracks the subgrid needs — four field columns of three parts each
(`label`, `input`, `unit`) — and delete the override that cancels the subgrid. Then every field
in a column shares one label edge, one input edge and one unit edge, as WinISD does.

## Verification

`packages/ui/test/ui/driver-editor-layout.browser.spec.ts`:

- `Parameters/Advanced parameters: fields in the same column share one edge` — groups fields into
  visual rows, then asserts the nth field of every row starts its input at the same x.
- `…: every row holds the same number of fields` — a track that accepts an overflow field would
  turn a row into a different shape from the rows above it.
