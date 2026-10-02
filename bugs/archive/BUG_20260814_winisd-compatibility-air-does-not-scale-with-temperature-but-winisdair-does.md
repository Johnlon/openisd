# WinISD-compatibility air and temperature (CLOSED WONTFIX — diagnosis refuted by experiment)

# Status

WONTFIX — CLOSED 2026-10-01, superseded by experiment. The original diagnosis ("WinISD's
own frozen air does not scale with temperature") was REFUTED by the controlled probe the
2026-08-21 human ruling asked for. The original diagnosis text has been removed; this
record now holds only the closure.

The complete `c`/`roo` provenance story (measured rule, version history, and the
recollections this record grew out of, checked against evidence) is consolidated in
`docs/research/C_ROO_PROVENANCE.md`.

## Closure (2026-10-01)

The ruling of 2026-08-21 ("use a probe to figure out what winisd does FOR CERTAIN — mimic
WinISD unless its buggy") WAS carried out, as ledger QO93 (questions.yml, 2026-08-27,
answered by experiment): six controlled environments written to WinISD's own settings.ini
before launch, outputs read from the .wpr at 15 significant digits (winisd_research
FINDING-008, runs/qo93_air_output/results.jsonl).

Findings that refute the original diagnosis:

1. WinISD's c IS a live computation that moves with the environment: ideal-gas moist mixing `c = sqrt(1.4·R·T/M)`, cross-validated at the two temperatures NOT in the fit — 1.3e-7 relative at 313.15 K, 2.0e-8 at 273.15 K. Not frozen.
2. roo = 1.4·AP/c² to 1.3e-15..2.6e-15 — derived from c, never a stored constant.
3. The env-t-303/env-rh-30 goldens' byte-identical c/roo are explained: those scenarios vary the PROJECT's [Box] env, which WinISD never reads for c/roo — the pair comes from WinISD's APP-LEVEL Options environment, which those captures never changed. "Frozen across project-env changes" ≠ "frozen, full stop".
4. The measured row at 313.15 K (c 356.223844028178, rho 1.11788898381182 — air.test.ts's MEASURED table) shows WinISD's own app-level pair at 40 °C is far from the 293.15 K pair.

The current `winisdAir(tempK, humidityPct, pressurePa)` implementation in
`packages/design/engine/air.ts` (Hyland–Wexler + gamma·p/c²) reproduces all six measured
environments to ≤ 2.5e-15 relative (air.test.ts pins every row), which is the QO93-ruled
contract. The later QO88 (2026-08-23) and QO95 (2026-08-28, WinISD model now the DEFAULT)
rulings build on it. The env-t-303 parity leg stays correctly bounded in
test/winisd/fixtures/winisd-parity/divergences.json (the harness's air leg must approximate
the goldens' capture-time app-level defaults, which the scenarios' project env cannot
express).

No code change was ever needed or made for this record.
