# `.wpr` import discarded vent cross-section provenance; re-export silently overwrote it

## Status
- crosscalc dropped on read, flipped on re-export: FIXED
- what crosscalc/Shape actually mean in a real WinISD slot-port file: OPEN — awaiting the
  WinISD ground-truth probe

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

## Open half — the probe

Nothing in the repo measures a real `crosscalc=0` file: all 45 golden vent blocks are
`crosscalc=1`/`Shape=1`. The `.wpr` also carries a separate `Shape=` key nothing reads, which
is the likelier home of port shape. A wine-harness probe (dispatched by main-exec) will author
a slot port in real WinISD and read what it writes to `Shape`/`crosscalc`/`carea`/`dia1` — its
result refines the interpretation. The observed-geometry rule above is chosen so no probe
outcome forces this fix to be undone.

## Verification

`packages/model/test/openisdProjectWinIsdMapping.test.ts`:
- "no import may build a vent whose area is zero while the file states a nonzero dia1" —
  red against the shape-mapping code, green now; asserts `carea` equals the real π·(d/2)².
- crosscalc=0 → `entered['ventCrossArea']` true, shape 'round', crosscalc=0 written back;
  crosscalc=1 → flag absent, crosscalc=1 written back.
- Import-side literal assertions for Qlr/Qar/Qpr, Npr, Nd.
