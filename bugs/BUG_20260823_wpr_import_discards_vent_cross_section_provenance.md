# `.wpr` import discarded vent cross-section provenance; re-export silently overwrote it

## Status
- crosscalc dropped on read, flipped on re-export: FIXED
- crosscalc semantics: RESOLVED as area provenance — the probe (winisd_research 109a2f9,
  VENT_SHAPE_CROSSCALC.md) found the available binary cannot produce crosscalc≠1 or Shape≠1
  at all, so the observed-geometry rule is compatible with every file it can write. Caveats
  carried in the research note: the probed binary is a Lazarus/LCL rebuild (original Delphi
  VCL untested), and bandpass front/intra vent tabs were not probed.

## Symptom

A `.wpr` states, per vent section, whether the cross-sectional area was CALCULATED from the
diameter (`crosscalc=1`) or ENTERED directly (`crosscalc=0`). Importing lost this fact
unconditionally, and re-export always wrote `crosscalc=1` — a file's own stated provenance
flipped by an open-then-save with no user action and no signal.

## Cause

The reader parsed every key generically, then narrowed the result into a fixed type
(`WprRawParse`) whose vent shape named only `dia`/`len`/`endCorrection` — so every key the
type did not name was destroyed on read, by construction. On the write side the flag was
computed from `entered.ventCrossArea`, a key nothing ever set, so it was constantly `1`.

Two more losses from the same narrowing, found in the same pass: `[Box]` chamber losses were
read under the invented key `Ql` (the file's keys are `Qlr`/`Qar`/`Qpr`) and PR count under
lowercase `npr` (the file writes `Npr`) — both silently never imported.

## Fix

Structural, not a patch: `WinISDProject` holds a generic section→key→value store that keeps
every key on read (commit 27f48bd); the narrowing types are gone, so there is nothing to drop
into. `fromWinISDProject` reads the real keys; `toWinISDProject` writes from the record.

`crosscalc` itself, after opus2's H1 review (interim ruling, main-exec 2026-08-23):

- It is AREA provenance only. An earlier fix in this record's history mapped `crosscalc=0` to
  `vent.shape='slotted'`, which built a ZERO-AREA vent on import — the file carries no
  width/height keys, and a slotted shape computes its area from them. That mapping is removed.
- Port SHAPE comes from observed geometry: a stated `dia1` is a round port. The invariant,
  pinned by test: no import may construct a vent whose area computes to zero while the file
  states a nonzero `dia1`.
- `crosscalc=0` is carried as `target.entered['ventCrossArea']` and written back from it, so
  the flag round-trips without touching shape.

## The probe's answer

The wine-harness probe (winisd_research 109a2f9, VENT_SHAPE_CROSSCALC.md) enumerated the Vents
tab in full: only diameter geometry is offered, `carea` is disabled and always π·(dia1/2)²
(verified by keystroke edit and save/read-back), `crosscalc` never leaves 1 and `Shape=` never
varies. The interim ruling is standing. OpenISD's slotted-vent support is therefore an OpenISD
EXTENSION beyond observed WinISD parity, and the crosscalc=0 import path handles a file class
no available binary can produce — kept because the format documents it, guarded by the carea
invariant.

## Verification

`packages/model/test/openisdProjectWinIsdMapping.test.ts`:
- "no import may build a vent whose area is zero while the file states a nonzero dia1" —
  red against the shape-mapping code, green now; asserts `carea` equals the real π·(d/2)².
- crosscalc=0 → `entered['ventCrossArea']` true, shape 'round', crosscalc=0 written back;
  crosscalc=1 → flag absent, crosscalc=1 written back.
- Import-side literal assertions for Qlr/Qar/Qpr, Npr, Nd.
