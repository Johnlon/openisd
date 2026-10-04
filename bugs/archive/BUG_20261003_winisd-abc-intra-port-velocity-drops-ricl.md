# NOTE_20261003_winisd-abc-intra-port-velocity-omits-leak-term

**Status:** WinISD omits a small term. The OpenISD default reproduces WinISD's chart; the yellow error switch "WinISD ABC intra-port velocity" (ABC boxes only), when unticked, gives the exact current through the port mass. Not a contradiction inside WinISD.

## What differs
Air speed in the intra port is the current through the port mass jωMai; Ricl is the leak around the
port. The exact current is V/[jωMai + Zf·(1 + jωMai/Ricl)]. WinISD's Intra port velocity chart is
V/(jωMai + Zf): it omits the term Zf·jωMai/Ricl. The gap is up to 1.35 dB and 4.6° near 110 Hz and
under 0.1 dB elsewhere (W5-1138SMF, abc-w5-1); at a very large Qiclfr the two agree.

## Retracted
An earlier version of this note claimed WinISD contradicts its own box load and called the chart a bug
(and the default drew V/(Zi + Zf)). That reading was wrong: V/(Zi + Zf) is the total current into the
intra element, which counts the leak current as port flow, and it is 14 dB off WinISD at 20 kHz. WinISD's
chart matches the port-mass current to 0.008 dB above 1 kHz. Evidence: winisd_research/PROBE_FINDINGS.md
(abc velocity self-consistency, `toys/abc_velocity_self_consistency.py`).

## Tests
`abc-intra-port-velocity.test.ts`, `winisd-abc-intra-port-velocity.test.ts`, `abc-winisd.test.ts`, `abc-large-qiclfr-winisd.test.ts`.
