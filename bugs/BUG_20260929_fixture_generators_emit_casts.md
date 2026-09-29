# BUG_20260929_fixture_generators_emit_casts

**Status:** OPEN

## Symptom
Eight generators in `winisd_research/toys/` still print `] as readonly <Type>[],` into the openisd
capture fixtures. The type-aware lint (which now covers `packages/*/test`) rejects every cast, so
regenerating one of those fixtures brings lint errors back.

## Evidence
Checked 2026-09-29, `grep -n "as readonly" winisd_research/toys/*.py`: `pr_fixture_ts.py`,
`pr_tf_fixture_ts.py`, `bp4_fixture_ts.py`, `vented_port_gain_fixture_ts.py`,
`bp4_port_gain_fixture_ts.py`, `vented_fixture_ts.py`, `bp6_abc_fixture_ts.py`,
`pr_count_fixture_ts.py`. Fixed in winisd_research 9c4bd15: `plotted_fixture_ts.py` and
`dtvc_fixture_ts.py`, which now hoist each chart into a typed const and reproduce the committed
fixtures byte for byte.

## Cause
The committed fixtures were hand-converted to typed consts when lint covered tests; the generators
were not updated.

## Fix
Same change as 9c4bd15 in the eight generators: hoist each array to `const NAME: readonly T[] = [...]`.

## Verification
Regenerate one fixture per generator; the output equals the committed file and `npm run lint` is clean.
