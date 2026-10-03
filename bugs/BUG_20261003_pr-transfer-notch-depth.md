# PR system transfer function: OpenISD peak +8.4 dB @65 Hz / notch -40 dB @43 Hz; WinISD peak +3.3 dB @71 Hz / trough -20 dB @41 Hz

Status: OPEN — investigating (2026-10-03). Evidence: /tmp/w.png (WinISD), /tmp/o.png (OpenISD), W5 nd140 + PR.
Numbers are John's readings (2026-10-03 06:35). My first reading of o.png misjudged the y-axis (said +3.5 dB peak); corrected here.

Same: -78.5 dB at 1 Hz, -20 dB hump at 30-34 Hz, flat 0 dB above 200 Hz.
Different: peak height and frequency, notch depth and frequency. This is NOT a sampling artifact: a 5 dB peak-height difference is a loss/damping difference.

Known: OpenISD's `winisd-lossy` PR box (`PassiveRadiatorBox.ts` L43-L73) already reproduces WinISD's form
(fixed Ral/Raa at WinISD's own wr incl. the Npr bug, Rpr = wp*Map_free/Qms, output = Cab branch current),
pinned to 1e-15 on runs/pr-w5-1.. by GHIDRA_FINDINGS.md §"Passive radiator box". So the engine formula is not
the first suspect; the inputs or the selected loss mode are.

Suspects, in order:
1. OpenISD project loss mode is not `winisd-lossy` (lossless / conventional-lossy gives a deeper notch and higher peak).
2. Different Ql / Qa / Qms (or Rms) / Npr / added mass between the two projects.
3. Both OpenISD traces (w5 nd140, w5 nd140pr) overlap exactly — check the PR trace is actually the PR box.
Next: dump OpenISD's PR + loss-mode + Ql/Qa settings and WinISD's PR pane + Advanced Ql/Qa for this project; run the
engine at those inputs and compare to w.png.
