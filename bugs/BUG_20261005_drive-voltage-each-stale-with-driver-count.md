# BUG_20261005_drive-voltage-each-stale-with-driver-count

**Status:** OPEN — needs John's decision

## Symptom
"Driver input voltage (each)" does not follow the driver count. W5-1138SMF, 1 W: 1.87 V with one
driver and still 1.87 V with four; each driver is fed P/4, so each sees about 0.94 V.

WinISD shows the same stale value (1.8 V at 4 drivers, 1 W; the real one 0.92 V): a linkage bug,
not to be copied (winisd_research probe, 2026-10-05).

## Why it is not fixed yet
`driveVoltage_V` is both the "(each)" readout and the sweep's `eg`, which the engine divides by √N
for each driver. Showing eg/√N, and taking an entered "(each)" voltage back to eg, changes the
power ↔ voltage solve. Decision needed: the readout shows eg/√N (and edits convert), or the label
drops "(each)".
