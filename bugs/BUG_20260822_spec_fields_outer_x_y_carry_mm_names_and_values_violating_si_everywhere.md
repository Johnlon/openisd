# outer_x_mm/outer_y_mm carry mm names and values — the SI-everywhere rule has no exceptions

Status: OPEN — winisd_tools half IN PROGRESS (rides the one-shot migration); openisd half
scheduled (this record gates the _SpecSection edit)

## The rule (John, 2026-08-22, verbatim)

"aren't we supposed to exclusively use SI units and only convert in / out at boundaries?
in from datasheets and web pages and out on the openisd screen where the unit is selectable"

SI everywhere INSIDE the system. Conversion exists at exactly two boundaries: parse-in
(datasheets, web pages) and display-out (the unit-selectable UI). A field NAME that encodes a
non-SI unit is the smell that the VALUE is non-SI.

## Symptom

The ten dimension fields were renamed to WinISD-SI names (Vcd, Hg, Hc, Thick, Depth, MagDepth,
Magnet, Basket, Outer, DVol) but `outer_x_mm`/`outer_y_mm` were left mm-named and mm-valued in
BOTH repos, on the stated ground "no WinISD equivalent" — copying openisd's own `_SpecSection`
note without questioning it. The note was wrong: having no WinISD name to adopt licenses
choosing an honest name, not keeping a non-SI unit.

**Evidence:** `openisd/packages/model/src/openisdDriver.ts` `_SpecSection` declares
`outer_x_mm?: _SpecEntry; outer_y_mm?: _SpecEntry;` amid SI members;
winisd_tools `record_registries.py` carried the same pair until 2026-08-22.

## Resolution (in flight)

winisd_tools (winisd_tool_fix session): `SpecField.OuterX` / `SpecField.OuterY` — PascalCase
matching the other nine dimension members; stored in METRES; parse options mm/cm/in; corpus
values ÷1000 in the SAME one-shot migration script as the ten (H1: one corpus touch).

openisd (this repo, after their commit): `_SpecSection.outer_x_mm/outer_y_mm` →
`OuterX/OuterY`, any consumer display logic converts at the UI boundary only.

Remaining descriptive fields checked against the rule: freq_low_hz/freq_high_hz (Hz IS SI),
power_peak_W (W), weight_kg (kg) — all conforming; only the mm pair violated.

## Verification

Post-migration corpus grep: zero `outer_x_mm|outer_y_mm` keys; spot-checked record shows
`OuterX:` in metres = old mm value ÷1000. openisd typecheck + unit suite green after the
member rename; a driver with OuterX renders its dimension via the unit-toggle path.
